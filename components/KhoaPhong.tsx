
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { PhongBan, NhanVien, TrinhDo, ChucVu as ChucVuType } from '../types';
import { Building2, Search, Users, FileDown, Filter, Loader2, ChevronRight, User, GraduationCap, AlertCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

interface KhoaPhongProps {
  unitCode?: string;
}

export const KhoaPhong: React.FC<KhoaPhongProps> = ({ unitCode }) => {
  const [units, setUnits] = useState<PhongBan[]>([]);
  const [employees, setEmployees] = useState<NhanVien[]>([]);
  const [trinhDos, setTrinhDos] = useState<TrinhDo[]>([]);
  const [chucVus, setChucVus] = useState<ChucVuType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };
  
  // Filters
  const [filterTrinhDo, setFilterTrinhDo] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pbRes, nvRes, tdRes, cvRes] = await Promise.all([
          supabase.from('DanhMucPhongBan').select('*').order('sapxep', { ascending: true }),
          supabase.from('DanhSachNhanVien').select('*').eq('danghiviec', false),
          supabase.from('DanhMucTrinhDo').select('*'),
          supabase.from('DanhMucChucVu').select('*')
        ]);

        if (pbRes.error) throw pbRes.error;
        if (nvRes.error) throw nvRes.error;
        if (tdRes.error) throw tdRes.error;
        if (cvRes.error) throw cvRes.error;

        const normalizedUnits = (pbRes.data || []).map(normalizeKeys) as PhongBan[];
        const normalizedEmployees = (nvRes.data || []).map(normalizeKeys) as NhanVien[];
        const normalizedTrinhDos = (tdRes.data || []).map(normalizeKeys) as TrinhDo[];
        const normalizedChucVus = (cvRes.data || []).map(normalizeKeys) as ChucVuType[];

        setUnits(normalizedUnits);
        setEmployees(normalizedEmployees);
        setTrinhDos(normalizedTrinhDos);
        setChucVus(normalizedChucVus);
      } catch (err: any) {
        showAlert(`Lỗi khi tải dữ liệu: ${err.message || JSON.stringify(err)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Current unit employees
  const currentUnitEmployees = useMemo(() => {
    const targetUnit = unitCode;
    if (!targetUnit) return [];
    return employees
      .filter(e => String(e.phongban) === String(targetUnit))
      .sort((a, b) => (a.vithu || 0) - (b.vithu || 0));
  }, [employees, unitCode]);

  // Apply search and dropdown filters
  const filteredEmployees = useMemo(() => {
    return currentUnitEmployees.filter(e => {
      const fullName = `${e.holot} ${e.ten}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase());
      
      const matchesTrinhDo = !filterTrinhDo || String(e.trinhdo) === String(filterTrinhDo);
      
      return matchesSearch && matchesTrinhDo;
    });
  }, [currentUnitEmployees, searchTerm, filterTrinhDo]);

  // Get unique Trình độ and Chức vụ in current unit for dropdowns
  const currentTrinhDos = useMemo(() => {
    const ids = Array.from(new Set(currentUnitEmployees.map(e => e.trinhdo)));
    return trinhDos.filter(td => ids.includes(td.matrinhdo));
  }, [currentUnitEmployees, trinhDos]);

  // Statistics calculations
  const stats = useMemo(() => {
    const total = currentUnitEmployees.length;
    const male = currentUnitEmployees.filter(e => e.gioitinh === true).length;
    const female = currentUnitEmployees.filter(e => e.gioitinh === false).length;

    const degreeStats = {
      ts: 0,
      ths: 0,
      dh: 0,
      cd: 0,
      khac: 0
    };

    currentUnitEmployees.forEach(e => {
      const td = trinhDos.find(t => t.matrinhdo === e.trinhdo)?.giatri?.toLowerCase() || '';
      if (td.includes('tiến sĩ')) degreeStats.ts++;
      else if (td.includes('thạc sĩ')) degreeStats.ths++;
      else if (td.includes('đại học')) degreeStats.dh++;
      else if (td.includes('cao đẳng')) degreeStats.cd++;
      else degreeStats.khac++;
    });

    return { total, male, female, degreeStats };
  }, [currentUnitEmployees, trinhDos]);

  const handleExportExcel = () => {
    const unitName = units.find(u => u.maphongban === unitCode)?.giatri || 'DonVi';
    
    const exportData = filteredEmployees.map((e, idx) => ({
      'STT': idx + 1,
      'Mã NV': e.manv,
      'Họ và Tên': `${e.holot} ${e.ten}`,
      'Ngày sinh': e.ngaysinh ? new Date(e.ngaysinh).toLocaleDateString('vi-VN') : '',
      'Giới tính': e.gioitinh ? 'Nam' : 'Nữ',
      'Trình độ': trinhDos.find(td => td.matrinhdo === e.trinhdo)?.giatri || e.trinhdo,
      'Chức vụ': chucVus.find(cv => cv.machucvu === e.chucvu)?.giatri || e.chucvu,
      'SĐT': e.sodtdd,
      'Email': e.email,
      'Ngày thử việc': e.ngaythuviec ? new Date(e.ngaythuviec).toLocaleDateString('vi-VN') : '',
      'Ngày chính thức': e.ngaychinhthuc ? new Date(e.ngaychinhthuc).toLocaleDateString('vi-VN') : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachNhanSu");
    
    // XLSX format with UTF-8 is handled by the library
    XLSX.writeFile(wb, `Danh_sach_nhan_su_${unitName.replace(/\s+/g, '_')}.xlsx`);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-blue-600 gap-4">
      <Loader2 className="size-12 animate-spin" />
      <p className="font-bold text-sm tracking-widest">Đang tải dữ liệu Khoa, Phòng...</p>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
            <Building2 size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-red-900 tracking-tight">
              {units.find(u => String(u.maphongban) === String(unitCode))?.giatri || 'Danh sách các đơn vị Khoa, Phòng'}
            </h1>
            <p className="text-gray-500 text-sm font-medium">Xem danh sách chi tiết nhân sự theo đơn vị</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Tìm nhanh Tên Nhân sự ..."
              className="pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-sm w-full md:w-80"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
          >
            <FileDown size={18} />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Staff Stats */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-red-700">Thống kê theo Số lượng</h3>
            <Users size={18} className="text-blue-500" />
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-green-500">Tổng số nhân sự:</span>
              <span className="text-lg font-black text-blue-600">{stats.total}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-blue-500 h-full" style={{ width: `${stats.total > 0 ? (stats.male / stats.total) * 100 : 0}%` }}></div>
              <div className="bg-pink-500 h-full" style={{ width: `${stats.total > 0 ? (stats.female / stats.total) * 100 : 0}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] font-black tracking-widest">
              <span className="text-blue-600">Nam: {stats.male}</span>
              <span className="text-pink-600">Nữ: {stats.female}</span>
            </div>
          </div>
        </div>

        {/* Degree Stats */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-blue-700">Thống kê theo Trình độ</h3>
            <GraduationCap size={18} className="text-emerald-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-bold text-red-400">Tiến sĩ</p>
              <p className="text-sm font-black text-gray-700">{stats.degreeStats.ts}</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-bold text-blue-400">Thạc sĩ</p>
              <p className="text-sm font-black text-gray-700">{stats.degreeStats.ths}</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-bold text-green-400">Đại học</p>
              <p className="text-sm font-black text-gray-700">{stats.degreeStats.dh}</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-bold text-orange-400">Cao đẳng</p>
              <p className="text-sm font-black text-gray-700">{stats.degreeStats.cd}</p>
            </div>
            <div className="col-span-2 p-2 bg-gray-50 rounded-xl flex justify-between items-center">
              <p className="text-[10px] font-bold text-gray-400">Khác</p>
              <p className="text-sm font-black text-gray-700">{stats.degreeStats.khac}</p>
            </div>
          </div>
        </div>

        {/* Gender Stats */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-orange-700">Thống kê theo Giới tính</h3>
            <User size={18} className="text-pink-500" />
          </div>
          <div className="flex items-center gap-6 h-full pb-4">
            <div className="relative size-20">
              <svg className="size-full" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-pink-100" strokeWidth="4"></circle>
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-blue-500" strokeWidth="4" 
                  strokeDasharray={`${stats.total > 0 ? (stats.male / stats.total) * 100 : 0} 100`} strokeDashoffset="0"></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-black text-gray-700">{stats.total > 0 ? Math.round((stats.male / stats.total) * 100) : 0}%</span>
                <span className="text-[8px] font-bold text-gray-400">Nam</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="size-2 bg-blue-500 rounded-full"></div>
                <span className="text-xs font-bold text-gray-500">Nam:</span>
                <span className="text-xs font-black text-gray-700">{stats.male}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-2 bg-pink-500 rounded-full"></div>
                <span className="text-xs font-bold text-orange-500">Nữ:</span>
                <span className="text-xs font-black text-gray-700">{stats.female}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Table Filters */}
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <span className="text-xs font-black text-gray-400 tracking-widest">Bộ lọc:</span>
          </div>
          
          <select 
            className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={filterTrinhDo}
            onChange={(e) => setFilterTrinhDo(e.target.value)}
          >
            <option value="">Tất cả Trình độ</option>
            {currentTrinhDos.map(td => (
              <option key={td.matrinhdo} value={td.matrinhdo}>{td.giatri}</option>
            ))}
          </select>

          {(filterTrinhDo || searchTerm) && (
            <button 
              onClick={() => {
                setFilterTrinhDo('');
                setSearchTerm('');
              }}
              className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
            >
              Xóa lọc
            </button>
          )}
        </div>

        {/* Employee Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-16">STT</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest w-24">Mã NV</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Họ và Tên</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest w-32">Ngày sinh</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest w-24">Giới tính</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Trình độ</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Chức vụ</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">SĐT</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Email</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest w-32">Ngày thử việc</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest w-32">Ngày chính thức</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((e, idx) => (
                  <tr key={e.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold text-gray-400">{idx + 1}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-black tracking-widest">
                        {e.manv}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-black text-xs">
                          {e.ten.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-gray-900">{e.holot} {e.ten}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-gray-600">
                        {e.ngaysinh ? new Date(e.ngaysinh).toLocaleDateString('vi-VN') : '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black tracking-widest ${e.gioitinh ? 'text-blue-600' : 'text-pink-600'}`}>
                        {e.gioitinh ? 'Nam' : 'Nữ'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-gray-700">
                        {trinhDos.find(td => td.matrinhdo === e.trinhdo)?.giatri || e.trinhdo || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-gray-700">
                        {chucVus.find(cv => cv.machucvu === e.chucvu)?.giatri || e.chucvu || '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-gray-600">{e.sodtdd || '---'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-blue-600 italic underline decoration-blue-200 underline-offset-4">{e.email || '---'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-gray-600">
                        {e.ngaythuviec ? new Date(e.ngaythuviec).toLocaleDateString('vi-VN') : '---'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-gray-600">
                        {e.ngaychinhthuc ? new Date(e.ngaychinhthuc).toLocaleDateString('vi-VN') : '---'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="px-6 py-20 text-center">
                    <div className="size-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-4">
                      <Users size={32} />
                    </div>
                    <h3 className="text-lg font-black text-gray-900 mb-1">Không có dữ liệu nhân sự</h3>
                    <p className="text-gray-500 text-sm">Không tìm thấy nhân viên nào phù hợp với bộ lọc hiện tại.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Info */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 rounded-2xl border border-gray-100">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="size-2 bg-blue-600 rounded-full"></div>
            <span className="text-xs font-bold text-gray-500 tracking-widest">Tổng số nhân sự đơn vị:</span>
            <span className="text-sm font-black text-blue-600">{currentUnitEmployees.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-2 bg-emerald-600 rounded-full"></div>
            <span className="text-xs font-bold text-gray-500 tracking-widest">Kết quả tìm kiếm:</span>
            <span className="text-sm font-black text-emerald-600">{filteredEmployees.length}</span>
          </div>
        </div>
        <div className="text-[10px] font-black text-gray-400 tracking-widest">
          Hệ thống quản lý nhân sự DAU
        </div>
      </div>

      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
             <div className="bg-red-600 p-5 text-white flex items-center gap-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold uppercase tracking-tighter">Thông báo hệ thống</h3>
             </div>
             <div className="p-8 text-center">
                <p className="text-gray-700 font-bold leading-relaxed whitespace-pre-line">{alertMessage}</p>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                <button 
                  onClick={() => setIsAlertModalOpen(false)}
                  className="px-10 py-3 bg-red-600 text-white font-black rounded-2xl shadow-lg hover:bg-red-700 transition-all active:scale-95 text-sm uppercase tracking-widest"
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
