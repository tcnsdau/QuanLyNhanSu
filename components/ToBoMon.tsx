
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { ToBoMon as ToBoMonType } from '../types';
import { BookMarked, Search, Users, ArrowRight, LayoutGrid, List, GraduationCap, Building2, Layers, AlertCircle } from 'lucide-react';

export const ToBoMon: React.FC = () => {
  const [subjectGroups, setSubjectGroups] = useState<ToBoMonType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };

  useEffect(() => {
    const fetchSubjectGroups = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('DanhMucToBoMon')
          .select('*')
          .order('sapxep', { ascending: true });

        if (error) throw error;
        setSubjectGroups(data as ToBoMonType[]);
      } catch (err: any) {
        showAlert('Lỗi khi tải danh sách Tổ Bộ Môn: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjectGroups();
  }, []);

  const filteredGroups = subjectGroups.filter(g => 
    g.giatri.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.mabomon.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.tructhuoc || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-blue-600 gap-4">
      <div className="size-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-black text-sm uppercase tracking-widest">Đang tải danh sách Tổ Bộ Môn...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-10 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-gray-100 pb-10">
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-indigo-600 mb-2">
            <div className="size-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <BookMarked size={24} />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em]">Đơn vị chuyên môn</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Tổ Bộ Môn</h1>
          <p className="text-gray-500 font-medium max-w-2xl">
            Các tổ bộ môn chuyên sâu, nơi hội tụ các giảng viên trình độ cao, thực hiện công tác giảng dạy và nghiên cứu khoa học.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm bộ môn..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-2xl">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Subject Groups Display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGroups.map((group) => (
            <div 
              key={group.id} 
              className="group bg-white p-8 rounded-[2rem] shadow-lg border border-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
            >
              <div className="size-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                <Layers size={28} />
              </div>
              
              <div className="flex-1">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">Mã: {group.mabomon}</p>
                <h3 className="text-lg font-black text-gray-900 leading-tight mb-2 group-hover:text-indigo-700 transition-colors">
                  {group.giatri}
                </h3>
                <div className="flex items-center gap-2 text-gray-400 mb-4">
                  <Building2 size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{group.tructhuoc || 'Trực thuộc Khoa'}</span>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400">
                  <GraduationCap size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Giảng viên</span>
                </div>
                <button className="size-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest w-32">Mã Bộ môn</th>
                <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest">Tên Tổ Bộ Môn</th>
                <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest">Trực thuộc</th>
                <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center w-32">Thứ tự</th>
                <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGroups.map((group) => (
                <tr key={group.id} className="hover:bg-indigo-50/20 transition-colors group">
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-black uppercase tracking-widest">
                      {group.mabomon}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-base font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">
                      {group.giatri}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-gray-500">{group.tructhuoc || '---'}</span>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <span className="text-sm font-bold text-gray-400">{group.sapxep}</span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="inline-flex items-center gap-2 text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest">
                      Xem danh sách <ArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredGroups.length === 0 && (
        <div className="py-20 text-center">
          <div className="size-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-6">
            <BookMarked size={40} />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">Không tìm thấy bộ môn</h3>
          <p className="text-gray-500 text-sm">Thử thay đổi từ khóa tìm kiếm của bạn.</p>
        </div>
      )}

      {/* Alert Modal */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-red-100">
            <div className="bg-red-600 p-4 text-white flex items-center gap-3">
              <AlertCircle size={20} />
              <h3 className="text-md font-bold uppercase tracking-tight">Thông báo lỗi</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-gray-700 font-bold text-sm leading-relaxed whitespace-pre-wrap">{alertMessage}</p>
            </div>
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
              <button 
                onClick={() => setIsAlertModalOpen(false)} 
                className="px-10 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-md text-xs uppercase tracking-widest"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
