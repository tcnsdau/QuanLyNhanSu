
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { NhanVien } from '../types';
import { User, Mail, Phone, Shield, Award, Users, Search, GraduationCap, Building2, ShieldAlert, X } from 'lucide-react';

export const BGH: React.FC = () => {
  const [leaders, setLeaders] = useState<NhanVien[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean, message: string }>({
    isOpen: false,
    message: ''
  });

  const showAlert = (message: string) => {
    setAlertModal({ isOpen: true, message });
  };

  useEffect(() => {
    const fetchLeaders = async () => {
      setLoading(true);
      try {
        // Lọc các chức vụ thuộc Ban Giám Hiệu hoặc Hội đồng trường
        // Giả sử các chức vụ này có từ khóa: Hiệu trưởng, Phó Hiệu trưởng, Chủ tịch Hội đồng
        const { data, error } = await supabase
          .from('DanhSachNhanVien')
          .select('*')
          .or('chucvu.ilike.%Hiệu trưởng%,chucvu.ilike.%Chủ tịch Hội đồng%,chucvu.ilike.%Phó Hiệu trưởng%')
          .eq('danghiviec', false)
          .order('vithu', { ascending: true });

        if (error) throw error;
        setLeaders(data as NhanVien[]);
      } catch (err: any) {
        showAlert("Lỗi tải danh sách lãnh đạo: " + (err.message || err));
      } finally {
        setLoading(false);
      }
    };

    fetchLeaders();
  }, []);

  const getGoogleDriveImageUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      const idMatch = url.match(/[-\w]{25,}/);
      if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[0]}`;
    }
    return url;
  };

  const filteredLeaders = leaders.filter(l => 
    `${l.holot} ${l.ten}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.chucvu || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-blue-600 gap-4">
      <div className="size-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-black text-sm uppercase tracking-widest">Đang tải danh sách Ban Giám Hiệu...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-10 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-100 pb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-blue-600 mb-2">
            <div className="size-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Shield size={24} />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em]">Lãnh đạo nhà trường</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Ban Giám Hiệu & Hội đồng trường</h1>
          <p className="text-gray-500 font-medium max-w-2xl">
            Đội ngũ lãnh đạo tâm huyết, dẫn dắt Trường Đại học Kiến trúc Đà Nẵng phát triển bền vững và không ngừng đổi mới.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm kiếm lãnh đạo..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Leaders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredLeaders.map((leader, index) => (
          <div 
            key={leader.id} 
            className="group bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col"
          >
            {/* Image Section */}
            <div className="relative h-72 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10"></div>
              {leader.hinhanh ? (
                <img 
                  src={getGoogleDriveImageUrl(leader.hinhanh)} 
                  alt={leader.ten} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-200">
                  <User size={100} />
                </div>
              )}
              
              {/* Floating Badge */}
              <div className="absolute top-6 right-6 z-20">
                <div className="size-12 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-blue-600 shadow-lg group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                  <Award size={24} />
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-8 flex-1 flex flex-col">
              <div className="mb-6">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-2">{leader.chucvu || 'Thành viên'}</p>
                <h3 className="text-xl font-black text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                  {leader.holot} {leader.ten}
                </h3>
              </div>

              <div className="space-y-4 mb-8 flex-1">
                <div className="flex items-center gap-3 text-gray-500">
                  <GraduationCap size={16} className="text-blue-400" />
                  <span className="text-xs font-bold">{leader.trinhdo || 'Đang cập nhật'}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500">
                  <Building2 size={16} className="text-emerald-400" />
                  <span className="text-xs font-bold">{leader.phongban || 'Ban Giám Hiệu'}</span>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-50 flex justify-between items-center">
                <div className="flex gap-2">
                  <button className="size-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all">
                    <Mail size={16} />
                  </button>
                  <button className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all">
                    <Phone size={16} />
                  </button>
                </div>
                <button className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-blue-600 transition-colors">
                  Xem hồ sơ
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredLeaders.length === 0 && (
        <div className="py-20 text-center">
          <div className="size-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-6">
            <Users size={40} />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">Không tìm thấy kết quả</h3>
          <p className="text-gray-500 text-sm">Thử thay đổi từ khóa tìm kiếm của bạn.</p>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
            <div className="bg-red-600 p-5 text-white flex items-center gap-3">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-lg font-bold">Thông báo lỗi</h3>
            </div>
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 shadow-inner text-red-500">
                <ShieldAlert size={32} />
              </div>
              <p className="text-gray-700 font-bold leading-relaxed whitespace-pre-line">{alertModal.message}</p>
            </div>
            <div className="p-6 bg-gray-50 flex justify-center">
              <button
                onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                className="px-8 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
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
