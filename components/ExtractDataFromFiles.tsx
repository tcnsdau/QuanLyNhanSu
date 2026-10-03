import React, { useState } from 'react';
import { Upload, RefreshCw, FileText, Languages, Copy, CheckCircle, File as FileIcon, X, Download, Search, ChevronRight } from 'lucide-react';
import { extractText, translateText } from '../services/geminiService';

const LANGUAGES = [
  { label: 'Tiếng Việt', value: 'Vietnamese' },
  { label: 'Tiếng Anh', value: 'English' },
  { label: 'Tiếng Pháp', value: 'French' },
  { label: 'Tiếng Trung Quốc', value: 'Chinese' },
  { label: 'Tiếng Nhật Bản', value: 'Japanese' },
];

// Renamed component to match filename and used named export to fix the import error in AdminDashboard.tsx
export const ExtractDataFromFiles: React.FC = () => {
  const [fileData, setFileData] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  
  const [isExtracting, setIsExtracting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  
  const [extractSearch, setExtractSearch] = useState('');
  const [translateSearch, setTranslateSearch] = useState('');
  const [targetLang, setTargetLang] = useState(LANGUAGES[0].value);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFileData({
          base64: reader.result as string,
          mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          name: file.name
        });
        setExtractedText('');
        setTranslatedText('');
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const onExtract = async () => {
    if (!fileData) return;
    setIsExtracting(true);
    setError(null);
    try {
      const text = await extractText(fileData.base64, fileData.mimeType);
      setExtractedText(text);
    } catch (err: any) {
      setError("Lỗi trích xuất: " + (err.message || "Vui lòng thử lại"));
    } finally {
      setIsExtracting(false);
    }
  };

  const onTranslate = async () => {
    if (!extractedText) return;
    setIsTranslating(true);
    setError(null);
    try {
      const langLabel = LANGUAGES.find(l => l.value === targetLang)?.label || targetLang;
      const text = await translateText(extractedText, langLabel);
      setTranslatedText(text);
    } catch (err: any) {
      setError("Lỗi dịch thuật: " + (err.message || "Vui lòng thử lại"));
    } finally {
      setIsTranslating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadText = (text: string, filename: string) => {
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5 font-bold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center py-10 px-4 sm:px-6">
      <header className="max-w-6xl w-full mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-red-900 tracking-tight flex items-center gap-3">
            <span className="p-2 bg-indigo-600 rounded-2xl text-white shadow-lg"><FileText size={32} /></span>
            AI Document Processor
          </h1>
          <p className="text-blue-500 mt-2 text-lg font-medium">Hệ thống trích xuất và dịch thuật tài liệu thông minh</p>
        </div>
      </header>

      <main className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
            <h2 className="text-sm font-black text-indigo-600 tracking-[0.2em] mb-6 uppercase flex items-center gap-2">
              <Upload size={18} />
              Trích xuất dữ liệu
            </h2>
            
            <div className={`relative border-2 border-dashed rounded-3xl p-6 transition-all duration-300 min-h-[220px] flex items-center justify-center mb-6 ${
              fileData ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-200 bg-slate-50 hover:border-indigo-300'
            }`}>
              {!fileData ? (
                <label className="flex flex-col items-center justify-center w-full py-8 cursor-pointer group text-center">
                  <div className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="text-indigo-500" />
                  </div>
                  <span className="text-slate-700 font-bold block">Tải tài liệu lên</span>
                  <span className="text-slate-400 text-xs mt-1">PDF, JPG, PNG (Max 10MB)</span>
                  <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="hidden" />
                </label>
              ) : (
                <div className="relative w-full">
                  <div className="flex flex-col items-center gap-4">
                    {fileData.mimeType === 'application/pdf' ? (
                      <FileIcon size={64} className="text-red-500" />
                    ) : (
                      <img src={fileData.base64} alt="Preview" className="w-full max-h-[180px] object-contain rounded-xl shadow-sm" />
                    )}
                    <div className="text-center w-full">
                      <p className="text-slate-900 font-bold text-sm truncate px-4">{fileData.name}</p>
                      <button 
                        onClick={() => setFileData(null)}
                        className="mt-2 text-red-500 text-xs font-bold hover:underline flex items-center gap-1 mx-auto"
                      >
                        <X size={14} /> Thay đổi tệp
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={onExtract}
              disabled={!fileData || isExtracting}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-white shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 ${
                !fileData || isExtracting
                  ? 'bg-slate-300 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {isExtracting ? <RefreshCw className="animate-spin" /> : <ChevronRight />}
              {isExtracting ? 'Đang trích xuất...' : 'Bắt đầu trích xuất'}
            </button>

            {error && <div className="mt-4 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-bold animate-shake">{error}</div>}
          </div>
        </section>

        <section className="lg:col-span-8 flex flex-col gap-8">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 min-h-[300px] flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-500" />
                Kết quả trích xuất
              </h3>
              
              {extractedText && (
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Tìm kiếm từ khóa trong kết quả..." 
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none placeholder-red-500 font-medium"
                    value={extractSearch}
                    onChange={(e) => setExtractSearch(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex-1 bg-slate-50/50 rounded-3xl p-6 border border-slate-100 relative group">
              {isExtracting ? (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 gap-3 animate-pulse">
                   <RefreshCw className="animate-spin" size={32} />
                   <p className="font-bold">Đang quét dữ liệu...</p>
                </div>
              ) : extractedText ? (
                <>
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => copyToClipboard(extractedText, 'ext')} className="p-2 bg-white shadow-sm border rounded-lg text-slate-400 hover:text-indigo-600"><Copy size={16} /></button>
                    <button onClick={() => downloadText(extractedText, 'trich-xuat.txt')} className="p-2 bg-white shadow-sm border rounded-lg text-slate-400 hover:text-indigo-600"><Download size={16} /></button>
                  </div>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                    {highlightText(extractedText, extractSearch)}
                  </p>
                </>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-slate-300 gap-2 py-12">
                   <FileText size={48} className="opacity-20" />
                   <p className="font-bold">Dữ liệu trích xuất sẽ hiển thị tại đây</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-sm font-black text-red-500 tracking-[0.2em] mb-6 uppercase flex items-center gap-2">
              <Languages size={18} />
              Dịch dữ liệu
            </h2>

            <div className="flex flex-col md:flex-row items-end gap-4 mb-8">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-400 mb-2 ml-1">NGÔN NGỮ DỊCH</label>
                <div className="relative">
                  <Languages className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <select 
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl appearance-none font-bold text-slate-700 focus:ring-2 focus:ring-red-500 outline-none cursor-pointer"
                  >
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={onTranslate}
                disabled={!extractedText || isTranslating}
                className={`px-10 py-4 rounded-2xl font-bold text-white shadow-xl transition-all flex items-center gap-2 ${
                  !extractedText || isTranslating
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 shadow-red-100 active:scale-95'
                }`}
              >
                {isTranslating ? <RefreshCw className="animate-spin" size={20} /> : <Languages size={20} />}
                Bắt đầu dịch
              </button>
            </div>

            <div className="flex flex-col">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pt-4 border-t border-slate-50">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle className="text-red-500" />
                  Kết quả dịch
                </h3>
                
                {translatedText && (
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Tìm kiếm trong kết quả dịch..." 
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none placeholder-red-500 font-medium"
                      value={translateSearch}
                      onChange={(e) => setTranslateSearch(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="bg-red-50/30 rounded-3xl p-8 border border-red-100/50 min-h-[200px] relative group">
                {isTranslating ? (
                   <div className="h-full w-full flex flex-col items-center justify-center text-red-300 gap-3 py-10">
                      <RefreshCw className="animate-spin" size={32} />
                      <p className="font-bold">Đang xử lý bản dịch...</p>
                   </div>
                ) : translatedText ? (
                  <>
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => copyToClipboard(translatedText, 'trans')} className="p-2 bg-white shadow-sm border rounded-lg text-slate-400 hover:text-red-500"><Copy size={16} /></button>
                      <button onClick={() => downloadText(translatedText, 'ban-dich.txt')} className="p-2 bg-white shadow-sm border rounded-lg text-slate-400 hover:text-red-500"><Download size={16} /></button>
                    </div>
                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap font-serif-vi text-xl italic">
                      {highlightText(translatedText, translateSearch)}
                    </p>
                  </>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center text-slate-200 gap-2 py-10">
                     <Languages size={48} className="opacity-10" />
                     <p className="font-bold">Bản dịch sẽ hiển thị tại đây</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-auto pt-20 pb-10 text-blue-400 text-sm w-full text-center max-w-6xl border-t border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; 2026 AI Text Transformer • Trí tuệ nhân tạo trích xuất và dịch tài liệu</p>
          <div className="flex gap-6">
            <a href="https://dau.edu.vn/" target="_blank" rel="noopener noreferrer" className="hover:text-red-500 transition-colors font-semibold">Da Nang Architecture University</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
