import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { Upload, Download, Eye, X, FileText, Loader2, Trash2, AlertTriangle, ZoomIn, ZoomOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PDFPageInfo {
  pageNumber: number;
  thumbnailUrl: string;
}

interface Notification {
  message: string;
  type: 'error' | 'success';
}

export const SplitPDFManagement = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PDFPageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [notification, setNotification] = useState<Notification | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      await processFile(selectedFile);
    }
  };

  const processFile = async (pdfFile: File) => {
    setIsLoading(true);
    setFile(pdfFile);
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const pageInfos: PDFPageInfo[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 3.0 }); // Increased for ultra-sharp thumbnails
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (context) {
          // Fill with white background for better contrast and clarity
          context.fillStyle = 'white';
          context.fillRect(0, 0, viewport.width, viewport.height);
          
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await (page.render({ canvasContext: context, viewport } as any)).promise;
          pageInfos.push({
            pageNumber: i,
            thumbnailUrl: canvas.toDataURL('image/jpeg', 0.95),
          });
        }
      }
      setPages(pageInfos);
    } catch (error) {
      setNotification({
        message: 'Có lỗi xảy ra khi xử lý file PDF. Vui lòng kiểm tra lại định dạng file.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPage = async (pageNumber: number) => {
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const newPdfDoc = await PDFDocument.create();
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNumber - 1]);
      newPdfDoc.addPage(copiedPage);
      
      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Filename convention: Số trang – Tên Tài liệu tải lên.PDF
      const fileName = `Trang${pageNumber}- ${file.name}`;
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotification({
        message: 'Có lỗi xảy ra khi tách trang PDF. Vui lòng thử lại.',
        type: 'error'
      });
    }
  };

  const handlePreviewPage = async (pageNumber: number, scale: number = 1.0) => {
    if (!file) return;
    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(pageNumber);
      // Increased base scale to 6.0 for maximum resolution
      const viewport = page.getViewport({ scale: scale * 6.0 }); 
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context) {
        // Fill with white background for better contrast and clarity
        context.fillStyle = 'white';
        context.fillRect(0, 0, viewport.width, viewport.height);

        // Ensure maximum quality image smoothing
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await (page.render({ 
          canvasContext: context, 
          viewport,
          intent: 'print'
        } as any)).promise;
        
        // Use PNG for lossless quality
        setPreviewUrl(canvas.toDataURL('image/png')); 
        setPreviewPage(pageNumber);
        setZoom(scale);
      }
    } catch (error) {
      setNotification({
        message: 'Không thể xem trước trang này. Vui lòng thử lại.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleZoomIn = () => {
    if (previewPage) {
      const newZoom = Math.min(zoom + 0.2, 3.0);
      handlePreviewPage(previewPage, newZoom);
    }
  };

  const handleZoomOut = () => {
    if (previewPage) {
      const newZoom = Math.max(zoom - 0.2, 0.4);
      handlePreviewPage(previewPage, newZoom);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setPages([]);
    setPreviewPage(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="text-neutral-900 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tight mb-2 text-red-900">
            Split PDF into Multiple Files
          </h1>
          <p className="text-blue-500">Tách các trang PDF thành các file riêng biệt một cách nhanh chóng.</p>
        </header>

        {!file ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 rounded-3xl p-12 bg-white shadow-sm hover:border-neutral-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="bg-neutral-100 p-6 rounded-full mb-6">
              <Upload className="w-12 h-12 text-neutral-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Tải dữ liệu lên</h2>
            <p className="text-blue-400 text-center max-w-xs">
              Nhấp để chọn file PDF hoặc kéo và thả file vào đây
            </p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="application/pdf" 
              className="hidden" 
            />
          </motion.div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-neutral-100">
              <div className="flex items-center gap-3">
                <div className="bg-red-50 p-2 rounded-lg">
                  <FileText className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h3 className="font-medium truncate max-w-[200px] md:max-w-md">{file.name}</h3>
                  <p className="text-xs text-neutral-400">{pages.length} trang</p>
                </div>
              </div>
              <button 
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Hủy bỏ
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              {pages.map((page) => (
                <motion.div
                  key={page.pageNumber}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="group relative bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden aspect-[3/4] flex flex-col"
                >
                  {/* Toolbar */}
                  <div className="absolute top-0 left-0 right-0 p-2 flex justify-center gap-2 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                      onClick={() => handlePreviewPage(page.pageNumber)}
                      className="p-1.5 bg-white rounded-lg text-neutral-700 hover:bg-neutral-100 shadow-sm transition-colors"
                      title="Xem nội dung"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDownloadPage(page.pageNumber)}
                      className="p-1.5 bg-blue-600 rounded-lg text-white hover:bg-blue-700 shadow-sm transition-colors"
                      title="Tải về"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 flex items-center justify-center p-4 bg-neutral-100/50">
                    <img 
                      src={page.thumbnailUrl} 
                      alt={`Page ${page.pageNumber}`} 
                      className="max-w-full max-h-full shadow-md border border-neutral-200"
                    />
                  </div>
                  
                  <div className="p-2 text-center bg-white border-t border-neutral-100">
                    <span className="text-xs font-bold text-neutral-500">Trang {page.pageNumber}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-3xl shadow-xl flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="font-medium text-neutral-700">Đang xử lý...</p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4"
            >
              <div className={cn(
                "p-4 rounded-2xl shadow-2xl flex items-center gap-3 border",
                notification.type === 'error' ? "bg-red-50 border-red-100 text-red-800" : "bg-green-50 border-green-100 text-green-800"
              )}>
                {notification.type === 'error' ? (
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                ) : (
                  <div className="w-5 h-5 bg-green-500 rounded-full" />
                )}
                <p className="text-sm font-medium flex-1">{notification.message}</p>
                <button 
                  onClick={() => setNotification(null)}
                  className="p-1 hover:bg-black/5 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {previewPage && previewUrl && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60] p-4"
              onClick={() => setPreviewPage(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-3xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold text-lg">Trang {previewPage}</h3>
                    
                    {/* Zoom Controls */}
                    <div className="flex items-center bg-neutral-100 rounded-full px-1 py-1 border border-neutral-200">
                      <button 
                        onClick={handleZoomOut}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-white rounded-full transition-all text-sm font-medium"
                      >
                        <ZoomOut className="w-4 h-4" />
                        Thu nhỏ
                      </button>
                      <div className="w-px h-4 bg-neutral-300 mx-1" />
                      <span className="px-2 text-sm font-bold text-neutral-600 min-w-[50px] text-center">
                        {Math.round(zoom * 100)}%
                      </span>
                      <div className="w-px h-4 bg-neutral-300 mx-1" />
                      <button 
                        onClick={handleZoomIn}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-white rounded-full transition-all text-sm font-medium"
                      >
                        <ZoomIn className="w-4 h-4" />
                        Phóng to
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPreviewPage(null)}
                    className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-8 bg-neutral-200 flex justify-center">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="max-w-full shadow-2xl" 
                    style={{ 
                      imageRendering: 'auto',
                    }}
                  />
                </div>
                <div className="p-4 border-t border-neutral-100 flex justify-end">
                  <button 
                    onClick={() => handleDownloadPage(previewPage)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                  >
                    <Download className="w-5 h-5" />
                    Tải trang này về
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
