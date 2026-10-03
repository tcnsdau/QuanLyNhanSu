
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { DanhSachHSL, DanhMucHSL, NhanVien, TrinhDo, PhongBan, ChucVu } from '../types';
// Add Info icon to imports
import { Search, FileDown, Calculator, Loader2, Calendar, Filter, ChevronDown, Award, Building2, User, Info, AlertCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

export const DuKienNangLuongList: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [hslList, setHslList] = useState<DanhSachHSL[]>([]);
  const [hslCatalog, setHslCatalog] = useState<DanhMucHSL[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Q1');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [filterDept, setFilterDept] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  const periods = [
    { id: 'Q1', label: 'Quý 1', start: '01/01', end: '31/03' },
    { id: 'Q2', label: 'Quý 2', start: '01/04', end: '30/06' },
    { id: 'Q3', label: 'Quý 3', start: '01/07', end: '30/09' },
    { id: 'Q4', label: 'Quý 4', start: '01/10', end: '31/12' },
    { id: 'NY', label: `Năm ${nextYear}`, start: '01/01', end: '31/12' }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hslRes, nvRes, catRes, tdRes, pbRes, cvRes] = await Promise.all([
        supabase.from('DanhSachHSL').select('*').eq('dienxet', true),
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, trinhdo, phongban, chucvu, ngaychinhthuc').eq('danghiviec', false),
        supabase.from('DanhMucHSL').select('*'),
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('DanhMucChucVu').select('*')
      ]);

      if (hslRes.error) throw hslRes.error;

      const employees = (nvRes.data || []).map(normalizeKeys);
      const catalog = (catRes.data || []).map(normalizeKeys);
      const trinhDos = (tdRes.data || []).map(normalizeKeys);
      const phongBans = (pbRes.data || []).map(normalizeKeys);
      const chucVus = (cvRes.data || []).map(normalizeKeys);

      setHslCatalog(catalog);

      const processed = (hslRes.data || []).map(item => {
        const h = normalizeKeys(item) as DanhSachHSL;
        const emp = employees.find(e => String(e.manv) === String(h.manv));
        if (!emp) return null;

        const rule = catalog.find(c => String(c.maso) === String(h.manangluong));
        if (!rule) return null;

        // Calculate due date
        const startDate = new Date(h.thoigianbatdau);
        const dueDate = new Date(startDate);
        dueDate.setFullYear(dueDate.getFullYear() + (rule.sonamnangbac || 0));

        // New salary logic
        const newHsl = parseFloat(((h.hsl || 0) + (rule.mucnangheso || 0)).toFixed(2));
        const isOver = newHsl > (rule.hesotoida || 999);

        return {
          ...h,
          holot: emp.holot,
          ten: emp.ten,
          ngaychinhthuc: emp.ngaychinhthuc,
          ten_trinhdo: trinhDos.find(t => String(t.matrinhdo) === String(emp.trinhdo))?.giatri || emp.trinhdo,
          ten_phongban: phongBans.find(p => String(p.maphongban) === String(emp.phongban))?.giatri || emp.phongban,
          ten_chucvu: chucVus.find(c => String(c.machucvu) === String(emp.chucvu))?.giatri || emp.chucvu,
          dueDate,
          newHsl,
          ghiChu: isOver ? 'HSL vượt bậc' : ''
        };
      }).filter(Boolean);

      setHslList(processed as any);
    } catch (err: any) {
      showAlert("Lỗi dữ liệu nâng lương: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    const selected = periods.find(p => p.id === selectedPeriod);
    if (!selected) return [];

    const periodYear = selectedPeriod === 'NY' ? nextYear : currentYear;
    const [day, month] = selected.end.split('/').map(Number);
    const periodEndDate = new Date(periodYear, month - 1, day, 23, 59, 59);

    return hslList.filter(item => {
      // 1. Time logic: dueDate <= periodEndDate
      if ((item as any).dueDate > periodEndDate) return false;

      // 2. Search logic
      const search = searchTerm.toLowerCase();
      const fullName = `${item.holot} ${item.ten}`.toLowerCase();
      if (searchTerm && !fullName.includes(search)) return false;

      // 3. Dropdown filters
      if (filterDept && (item as any).ten_phongban !== filterDept) return false;
      if (filterLevel && (item as any).ten_trinhdo !== filterLevel) return false;

      return true;
    }).sort((a, b) => (a as any).dueDate - (b as any).dueDate);
  }, [hslList, selectedPeriod, searchTerm, filterDept, filterLevel, currentYear, nextYear]);

  const uniqueDepts = useMemo(() => Array.from(new Set(hslList.map(i => (i as any).ten_phongban))).sort(), [hslList]);
  const uniqueLevels = useMemo(() => Array.from(new Set(hslList.map(i => (i as any).ten_trinhdo))).sort(), [hslList]);

  const formatDate = (d: any) => {
    if (!d) return '---';
    const date = new Date(d);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  const handleExportExcel = () => {
    const periodLabel = periods.find(p => p.id === selectedPeriod)?.label || '';
    const exportData = filteredData.map((item, idx) => ({
      'STT': idx + 1,
      'Mã nhân viên': item.manv,
      'Họ và tên': `${item.holot} ${item.ten}`,
      'Trình độ': (item as any).ten_trinhdo,
      'Chức vụ': (item as any).ten_chucvu,
      'Phòng ban': (item as any).ten_phongban,
      'Ngày chính thức': formatDate(item.ngaychinhthuc),
      'HSL hiện hưởng': item.hsl,
      'Thời gian hưởng': formatDate(item.thoigianbatdau),
      'HSL mới': (item as any).newHsl,
      'Thời gian bắt đầu hưởng': formatDate((item as any).dueDate),
      'Ghi chú': (item as any).ghiChu
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dự kiến nâng lương");
    
    // Xuất file XLSX với UTF-8 (mặc định trong xlsx library)
    XLSX.writeFile(wb, `DanhSachDuKienNangLuong_${selectedPeriod}_${currentYear}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-blue-600 gap-4">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="font-bold text-sm tracking-widest uppercase">Đang phân tích lộ trình nâng lương...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-100">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-blue-900 tracking-tight">Danh sách dự kiến nâng lương</h2>
        </div>
        
        <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
           <span className="text-xs font-bold text-blue-700 whitespace-nowrap">Thời gian dự kiến nâng lương:</span>
           <div className="relative">
             <select 
               value={selectedPeriod}
               onChange={e => setSelectedPeriod(e.target.value)}
               className="bg-white border border-blue-200 rounded-lg text-sm font-bold text-blue-900 px-8 py-1.5 appearance-none focus:ring-2 focus:ring-blue-400 outline-none cursor-pointer"
             >
               {periods.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
             </select>
             <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400 pointer-events-none" />
           </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo họ tên nhân sự..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black bg-gray-50/50 font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95 text-sm"
          >
            <FileDown className="h-4 w-4 mr-2" /> Xuất Excel
          </button>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
           <div className="space-y-1">
              <label className="text-[10px] font-bold text-blue-500 px-1 uppercase tracking-wider">Lọc phòng ban</label>
              <div className="relative">
                  <select 
                    value={filterDept} 
                    onChange={e => setFilterDept(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 appearance-none bg-white font-bold text-gray-700 outline-none focus:ring-1 focus:ring-blue-400 shadow-sm"
                  >
                    <option value="">Tất cả phòng ban</option>
                    {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <Building2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              </div>
           </div>

           <div className="space-y-1">
              <label className="text-[10px] font-bold text-blue-500 px-1 uppercase tracking-wider">Lọc trình độ</label>
              <div className="relative">
                  <select 
                    value={filterLevel} 
                    onChange={e => setFilterLevel(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 appearance-none bg-white font-bold text-gray-700 outline-none focus:ring-1 focus:ring-blue-400 shadow-sm"
                  >
                    <option value="">Tất cả trình độ</option>
                    {uniqueLevels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <Award className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              </div>
           </div>
           
           <div className="lg:col-span-2 flex items-end justify-end">
              <div className="text-xs font-bold text-gray-400 bg-white px-4 py-2 rounded-lg border border-gray-100 flex items-center gap-2">
                 <Info className="h-4 w-4 text-blue-500" />
                 Danh sách dự kiến: <span className="text-blue-700 text-sm ml-1 font-black">{filteredData.length}</span> nhân sự
              </div>
           </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead className="bg-gray-50/80 sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider text-center w-12">Stt</th>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider text-center w-20">Manv</th>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider">Họ tên nhân viên</th>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider">Trình độ</th>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider">Chức vụ</th>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider">Phòng ban</th>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider text-center">Ngày chính thức</th>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider text-center">Hsl hiện hưởng</th>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider text-center">Thời gian hưởng</th>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider text-center">Hsl mới</th>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider text-center">Thời gian bắt đầu hưởng</th>
                <th className="px-4 py-4 text-[10px] font-bold text-red-600 tracking-wider">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredData.map((item: any, idx) => (
                <tr key={item.manv} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-4 text-xs font-bold text-gray-500 text-center">{idx + 1}</td>
                  <td className="px-4 py-4 text-xs font-black text-blue-900 text-center">{item.manv}</td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold text-blue-800">{item.holot} {item.ten}</span>
                  </td>
                  <td className="px-4 py-4 text-xs font-medium text-gray-700 italic">{item.ten_trinhdo}</td>
                  <td className="px-4 py-4 text-xs font-medium text-gray-700">{item.ten_chucvu}</td>
                  <td className="px-4 py-4 text-xs font-bold text-blue-600">{item.ten_phongban}</td>
                  <td className="px-4 py-4 text-xs font-medium text-gray-600 text-center">{formatDate(item.ngaychinhthuc)}</td>
                  <td className="px-4 py-4 text-sm font-black text-indigo-700 text-center">{item.hsl}</td>
                  <td className="px-4 py-4 text-xs font-bold text-gray-500 text-center">{formatDate(item.thoigianbatdau)}</td>
                  <td className="px-4 py-4 text-sm font-black text-emerald-600 text-center">{item.newHsl}</td>
                  <td className="px-4 py-4 text-xs font-black text-red-600 text-center">{formatDate(item.dueDate)}</td>
                  <td className="px-4 py-4">
                    {item.ghiChu ? (
                       <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-50 text-red-600 border border-red-100">
                          {item.ghiChu}
                       </span>
                    ) : (
                       <span className="text-[10px] text-gray-300 italic">Dự kiến định kỳ</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-20 text-center text-gray-400 italic">
                    Không có nhân sự nào đến hạn nâng lương trong khoảng thời gian đã chọn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left">
         <p className="text-[10px] text-red-400 font-bold tracking-widest italic">
            Hệ thống DAU HR Management | © Quản lý Nhân sự
         </p>
      </div>

      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
             <div className="bg-red-600 p-5 text-white flex items-center gap-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">Thông báo hệ thống</h3>
             </div>
             <div className="p-8 text-center">
                <p className="text-gray-700 font-medium leading-relaxed">{alertMessage}</p>
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
