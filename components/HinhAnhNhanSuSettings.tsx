
import React, { useState, useRef } from 'react';
import { Upload, Trash2, Save, Copy, Image as ImageIcon, CheckCircle, AlertCircle, Loader, ExternalLink, Link, X } from 'lucide-react';

export const HinhAnhNhanSuSettings: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };
  
  // URL Web App Google Apps Script
  //const [scriptUrl, setScriptUrl] = useState<string>('https://script.google.com/macros/s/AKfycbxN4fgpCqup4WalCcz_yd42M9PtkNaeKHjIFHbAZ_9NKHPKcvn6yMwoDryOjtsjOK3U/exec');
  const [scriptUrl, setScriptUrl] = useState<string>('https://script.google.com/macros/s/AKfycbwz0w0iDaDgUSQbO_P5g-rdbuhyQc1mDgHYnRGg5Cx8cObS0TwXuE9Fbwq4xo_oY2wY/exec');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Constants
  const DRIVE_FOLDER_ID = "11mSKRfumZJY7Gil98b0mwLNCk_45uNu_";
  const DRIVE_FOLDER_LINK = "https://drive.google.com/drive/u/0/folders/11mSKRfumZJY7Gil98b0mwLNCk_45uNu_";
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/bmp', 'image/gif'];

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      showAlert("Vui lòng chỉ chọn file định dạng JPG, PNG, BMP hoặc GIF.");
      return;
    }

    // Create local preview URL
    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setGeneratedLink(null);
  };

  const handleDeleteImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setGeneratedLink(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper: Đọc file sang Base64 nguyên bản (KHÔNG NÉN, KHÔNG RESIZE)
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error("Failed to convert file to base64"));
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
  };

  const handleSaveImage = async () => {
    if (!selectedFile) return;

    if (!scriptUrl.trim()) {
        showAlert("Vui lòng nhập 'URL Web App' từ Google Apps Script.");
        return;
    }

    setIsSaving(true);
    setGeneratedLink(null);

    try {
        // 1. Đọc file gốc (Giữ nguyên chất lượng)
        const base64DataFull = await readFileAsBase64(selectedFile);
        
        // 2. Tách lấy phần data raw (bỏ header "data:image/..." nếu có)
        // Lưu ý: pop() sẽ lấy phần tử cuối cùng, an toàn cho cả trường hợp có hoặc không có dấu phẩy
        let base64Content = base64DataFull.includes(',') ? base64DataFull.split(',')[1] : base64DataFull;

        // --- CHUẨN HÓA BASE64 ---
        // Google Apps Script `Utilities.base64Decode` mặc định mong đợi Standard Base64 (+ /)
        // Nếu chuỗi chứa ký tự URL-Safe (- _), ta cần chuyển đổi về Standard.
        base64Content = base64Content.replace(/-/g, '+').replace(/_/g, '/');

        // Loại bỏ khoảng trắng và xuống dòng (nếu có do quá trình vận chuyển)
        base64Content = base64Content.replace(/\s/g, '');

        // Fix Padding: Độ dài chuỗi Base64 phải chia hết cho 4
        const padding = base64Content.length % 4;
        if (padding > 0) {
            base64Content += '='.repeat(4 - padding);
        }

        if (!base64Content) {
             throw new Error("Lỗi xử lý ảnh (Empty Data)");
        }

        // Đảm bảo MIME Type hợp lệ (fallback nếu file.type rỗng)
        const mimeType = selectedFile.type || 'image/jpeg';

        // 3. Gọi API
        const finalScriptUrl = `${scriptUrl.trim()}?nocache=${Date.now()}`;

        const response = await fetch(finalScriptUrl, {
            method: 'POST',
            mode: 'cors', 
            credentials: 'omit',
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8", 
            },
            body: JSON.stringify({
                file: base64Content, 
                filename: selectedFile.name, 
                mimeType: mimeType
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.result === 'success') {
            // Format link theo dạng https://drive.google.com/file/d/ID/view?usp=drivesdk
            let finalUrl = data.url;
            const idMatch = finalUrl.match(/[-\w]{25,}/); // Regex tìm ID Google Drive
            if (idMatch) {
                const fileId = idMatch[0];
                finalUrl = `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;
            }

            setGeneratedLink(finalUrl);
            showAlert("Upload thành công! Ảnh đã được lưu vào Drive.");
        } else {
            throw new Error(data.error || "Upload thất bại (Lỗi từ Script).");
        }

    } catch (error: any) {
        let msg = "Có lỗi xảy ra: " + error.message;
        
        if (error.name === 'TypeError' && (error.message === 'Failed to fetch' || error.message.includes('NetworkError'))) {
             msg = "Lỗi kết nối (Failed to fetch).\n\nNguyên nhân thường gặp:\n1. URL Script sai.\n2. Ảnh GỐC quá lớn (Quá giới hạn 50MB của Google).\n3. Trình duyệt chặn request cross-origin.";
        } else if (error.message && error.message.includes("Could not decode string")) {
             msg = "Lỗi giải mã ảnh (Base64 Error).\nHệ thống không giải mã được dữ liệu.\nVui lòng thử lại.";
        }
        
        showAlert(msg);
    } finally {
        setIsSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      showAlert("Đã sao chép đường liên kết!");
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-blue-600 bg-white p-4 mb-6 rounded-lg shadow-sm border border-gray-200 flex items-center">
        <ImageIcon className="mr-2 h-6 w-6" />
        Quản lý Hình ảnh Nhân sự
      </h2>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-8">
        
        {/* Configuration Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
             <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center">
                <Link className="h-4 w-4 mr-2 text-blue-500" />
                Cấu hình Google Apps Script URL (API Upload)
             </label>
             <div className="flex gap-2">
                 <input 
                    type="text" 
                    value={scriptUrl}
                    onChange={(e) => setScriptUrl(e.target.value)}
                    placeholder="Dán URL Web App từ Google Script..."
                    className="flex-1 text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2"
                 />
             </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          
          {/* Left Column: Image Preview Frame (3x4) */}
          <div className="flex flex-col items-center">
            <div className="text-sm font-medium text-gray-500 mb-2">Khung ảnh 3x4</div>
            
            <div 
              className="relative bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden shadow-inner transition-all hover:border-blue-400"
              style={{ width: '300px', height: '400px' }} // Fixed 3x4 Aspect Ratio
            >
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-6 text-gray-400">
                  <ImageIcon className="h-16 w-16 mx-auto mb-2 opacity-50" />
                  <p>Chưa có hình ảnh</p>
                  <p className="text-xs mt-1">Hỗ trợ JPG, PNG, BMP, GIF</p>
                </div>
              )}

              {/* Loading Overlay */}
              {isSaving && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white z-10">
                  <Loader className="h-10 w-10 animate-spin mb-2" />
                  <span>Đang tải lên Drive...</span>
                </div>
              )}
            </div>

            <div className="mt-4 w-[300px]">
                <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded border border-blue-100 flex flex-col gap-2">
                    <div>
                        <span className="font-semibold text-blue-700">Folder ID:</span> 
                        <span className="break-all font-mono text-[10px] ml-1">{DRIVE_FOLDER_ID}</span>
                    </div>
                    {/* Nút Mở Folder Google Drive */}
                    <a 
                        href={DRIVE_FOLDER_LINK} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-full px-3 py-2 mt-1 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50 hover:text-blue-800 transition-colors shadow-sm"
                    >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        Mở Thư mục Google Drive
                    </a>
                </div>
            </div>
          </div>

          {/* Right Column: Actions */}
          <div className="flex flex-col space-y-4 pt-4">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-blue-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>Quy trình:</strong> 
                    <br/>1. Chọn ảnh từ máy tính.
                    <br/>2. Nhấn "Lưu hình ảnh" để tải lên Google Drive.
                    <br/>3. Sau khi thành công, link sẽ hiện bên dưới.
                    <br/><span className="text-red-600 italic">Lưu ý: Ảnh sẽ được giữ nguyên dung lượng gốc (Không nén).</span>
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-bold text-gray-800 border-b pb-2 mb-2">Thao tác</h3>

            {/* Input hidden */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={onFileChange} 
              accept=".jpg,.jpeg,.png,.bmp,.gif" 
              className="hidden" 
            />

            {/* Buttons */}
            <button
              onClick={handleSelectFile}
              disabled={isSaving}
              className="flex items-center justify-center w-full px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <Upload className="h-5 w-5 mr-2" />
              Chọn ảnh từ máy
            </button>

            <button
              onClick={handleDeleteImage}
              disabled={!selectedFile || isSaving}
              className={`flex items-center justify-center w-full px-4 py-3 border border-gray-300 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors ${
                !selectedFile 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-white text-red-600 hover:bg-red-50 hover:border-red-300'
              }`}
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Xóa hình ảnh
            </button>

            <div className="border-t my-2 border-gray-100"></div>

            <button
              onClick={handleSaveImage}
              disabled={!selectedFile || isSaving}
              className={`flex items-center justify-center w-full px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors ${
                !selectedFile 
                  ? 'bg-green-300 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader className="h-5 w-5 mr-2 animate-spin" />
                  Đang xử lý...
                </>
              ) : generatedLink ? (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Lưu hình ảnh khác
                </>
              ) : (
                <>
                  <Save className="h-5 w-5 mr-2" />
                  Lưu hình ảnh
                </>
              )}
            </button>

            {/* KẾT QUẢ: Hiển thị Link tải ảnh và Nút Sao chép */}
            {generatedLink && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg animate-fade-in shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-green-800">Link tải ảnh</label>
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" /> Success
                    </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={generatedLink} 
                    className="block w-full text-sm border-green-300 rounded-md bg-white text-gray-600 focus:ring-green-500 focus:border-green-500 p-2 shadow-sm font-mono"
                  />
                  
                  {/* Nút Sao chép Link */}
                  <button
                    onClick={handleCopyLink}
                    className="flex-shrink-0 flex items-center justify-center px-4 py-2 border border-green-300 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm"
                    title="Sao chép đường liên kết"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Sao chép Link
                  </button>
                </div>
                
                <div className="mt-2 flex justify-end">
                    <a 
                        href={generatedLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs text-blue-600 hover:underline flex items-center"
                    >
                        <ExternalLink className="h-3 w-3 mr-1" /> Kiểm tra ảnh
                    </a>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
             <div className="bg-red-600 p-5 text-white flex items-center gap-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">Thông báo hệ thống</h3>
             </div>
             <div className="p-8 text-center">
                <p className="text-gray-700 font-medium leading-relaxed whitespace-pre-line">{alertMessage}</p>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                <button 
                  onClick={() => setIsAlertModalOpen(false)}
                  className="px-8 py-2 bg-red-600 text-white font-bold rounded-xl shadow-md hover:bg-red-700 transition-all active:scale-95 text-sm"
                >
                  Đóng thông báo
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
