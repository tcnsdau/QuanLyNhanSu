
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { NhanVien, TrinhDo, PhongBan, ChucVu } from '../types';
import { 
  Search, FileDown, X, Loader2, Filter, 
  ChevronDown, CheckCircle2, AlertCircle, 
  Calendar, Info, Plus, User, MoreHorizontal, 
  UserCheck, BarChart2, Sigma, LayoutGrid
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface NghiPhepNam {
  maso: number;
  manv: string;
  ngaybatdau: string;
  ngayketthuc: string;
  songaynghi: number;
  ghichu?: string;
}

interface ThongKeResult {
  stt: number;
  manv: string;
  hoten: string;
  trinhdo: string;
  chucvu: string;
  donvi: string;
  nam: number;
  tongngaynghi: number;
  ghichu: string;
}

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

export const ThongKeNghiPhepManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState<NhanVien[]>([]);
  const [trinhDos, setTrinhDos] = useState<TrinhDo[]>([]);
  const [chucVus, setChucVus] = useState<ChucVu[]>([]);
  const [phongBans, setPhongBans] = useState<PhongBan[]>([]);
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [scope, setScope] = useState<'all' | 'individual'>('all');
  const [selectedStaff, setSelectedStaff] = useState<NhanVien | null>(null);
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  
  const [results, setResults] = useState<ThongKeResult[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };

  const staffDropdownRef = useRef<HTMLDivElement>(null);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result = [];
    for (let y = currentYear; y >= 2007; y--) {
      result.push(y);
    }
    return result;
  }, []);

  useEffect(() => {
    fetchInitialData();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(event.target as Node)) {
        setIsStaffDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [nvRes, tdRes, cvRes, pbRes] = await Promise.all([
        supabase.from('DanhSachNhanVien').select('*').eq('danghiviec', false).order('ten', { ascending: true }),
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhMucChucVu').select('*'),
        supabase.from('DanhMucPhongBan').select('*')
      ]);

      if (nvRes.error) throw nvRes.error;
      
      setStaffList((nvRes.data || []).map(normalizeKeys));
      setTrinhDos((tdRes.data || []).map(normalizeKeys));
      setChucVus((cvRes.data || []).map(normalizeKeys));
      setPhongBans((pbRes.data || []).map(normalizeKeys));
    } catch (err: any) {
      showAlert('Lỗi khi tải dữ liệu ban đầu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredStaffForDropdown = useMemo(() => {
    if (!staffSearchQuery) return staffList;
    const query = staffSearchQuery.toLowerCase();
    return staffList.filter(s => 
      (s.ten?.toLowerCase() || '').includes(query) || 
      (s.holot?.toLowerCase() || '').includes(query) || 
      String(s.manv || '').toLowerCase().includes(query)
    );
  }, [staffList, staffSearchQuery]);

  const handleStatistics = async () => {
    setIsCalculating(true);
    setHasCalculated(false);
    try {
      let query = supabase.from('DanhSachNghiPhepNam').select('*');
      
      // Filter by year
      // Assuming ngaybatdau is used to determine the year
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      query = query.gte('ngaybatdau', startDate).lte('ngaybatdau', endDate);

      if (scope === 'individual' && selectedStaff) {
        query = query.eq('manv', selectedStaff.manv);
      }

      const { data, error } = await query;
      if (error) throw error;

      const leaveRecords = (data || []).map(normalizeKeys) as NghiPhepNam[];
      
      // Group by manv
      const grouped = leaveRecords.reduce((acc: any, curr) => {
        if (!acc[curr.manv]) {
          acc[curr.manv] = {
            manv: curr.manv,
            tongngaynghi: 0,
            ghichu: []
          };
        }
        acc[curr.manv].tongngaynghi += curr.songaynghi;
        if (curr.ghichu) acc[curr.manv].ghichu.push(curr.ghichu);
        return acc;
      }, {});

      // Map to results
      const finalResults: ThongKeResult[] = Object.values(grouped).map((item: any, index: number) => {
        const staff = staffList.find(s => s.manv === item.manv);
        return {
          stt: index + 1,
          manv: item.manv,
          hoten: staff ? `${staff.holot} ${staff.ten}` : item.manv,
          trinhdo: staff ? (trinhDos.find(td => td.matrinhdo === staff.trinhdo)?.giatri || staff.trinhdo) : '',
          chucvu: staff ? (chucVus.find(cv => cv.machucvu === staff.chucvu)?.giatri || staff.chucvu) : '',
          donvi: staff ? (phongBans.find(pb => pb.maphongban === staff.phongban)?.giatri || staff.phongban) : '',
          nam: selectedYear,
          tongngaynghi: item.tongngaynghi,
          ghichu: item.ghichu.join('; ')
        };
      });

      setResults(finalResults);
      setHasCalculated(true);
    } catch (err: any) {
      showAlert('Lỗi khi tính toán thống kê: ' + err.message);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCancel = () => {
    setResults([]);
    setHasCalculated(false);
    setScope('all');
    setSelectedStaff(null);
    setStaffSearchQuery('');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-blue-600">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p className="font-bold animate-pulse">Đang chuẩn bị dữ liệu thống kê...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Form Section */}
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-4 flex items-center gap-3">
          <BarChart2 className="text-white" size={24} />
          <h2 className="text-white font-black text-lg tracking-tight">Thống kê ngày nghỉ phép</h2>
        </div>
        
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Năm Thống kê */}
            <div className="md:col-span-3 space-y-2">
              <label className="text-sm font-bold text-blue-700 block">Năm thống kê</label>
              <div className="relative">
                <select 
                  className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>
            </div>

            {/* Nhân sự Thống kê */}
            <div className="md:col-span-9 space-y-4">
              <label className="text-sm font-bold text-purple-700 block">Nhân sự thống kê</label>
              <div className="flex flex-wrap items-center gap-8">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="radio" 
                      name="scope" 
                      className="peer sr-only"
                      checked={scope === 'all'}
                      onChange={() => setScope('all')}
                    />
                    <div className="size-6 border-2 border-gray-300 rounded-full peer-checked:border-blue-600 transition-all"></div>
                    <div className="size-3 bg-blue-600 rounded-full absolute scale-0 peer-checked:scale-100 transition-transform"></div>
                  </div>
                  <span className="text-sm font-bold text-red-600 group-hover:text-red-700 transition-colors">Tất cả</span>
                </label>

                <div className="flex items-center gap-4 flex-1">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="radio" 
                        name="scope" 
                        className="peer sr-only"
                        checked={scope === 'individual'}
                        onChange={() => setScope('individual')}
                      />
                      <div className="size-6 border-2 border-gray-300 rounded-full peer-checked:border-blue-600 transition-all"></div>
                      <div className="size-3 bg-blue-600 rounded-full absolute scale-0 peer-checked:scale-100 transition-transform"></div>
                    </div>
                    <span className="text-sm font-bold text-red-600 group-hover:text-red-700 transition-colors whitespace-nowrap">Nhân sự</span>
                  </label>

                  {/* Staff Dropdown */}
                  <div className="relative flex-1 max-w-md" ref={staffDropdownRef}>
                    <div 
                      onClick={() => scope === 'individual' && setIsStaffDropdownOpen(!isStaffDropdownOpen)}
                      className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium flex items-center justify-between cursor-pointer transition-all ${
                        scope !== 'individual' ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'
                      }`}
                    >
                      <span className={selectedStaff ? 'text-gray-900 font-bold' : 'text-gray-400'}>
                        {selectedStaff ? `${selectedStaff.holot} ${selectedStaff.ten}` : 'Nhập tên nhân sự để tìm nhanh'}
                      </span>
                      <MoreHorizontal size={18} className="text-gray-400" />
                    </div>

                    {isStaffDropdownOpen && scope === 'individual' && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                        <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                              type="text"
                              autoFocus
                              placeholder="Tìm kiếm theo tên hoặc mã nv..."
                              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                              value={staffSearchQuery}
                              onChange={(e) => setStaffSearchQuery(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {filteredStaffForDropdown.length > 0 ? (
                            filteredStaffForDropdown.map(s => (
                              <div 
                                key={s.manv}
                                onClick={() => {
                                  setSelectedStaff(s);
                                  setIsStaffDropdownOpen(false);
                                  setStaffSearchQuery('');
                                }}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                              >
                                <p className="text-sm font-bold text-gray-900">{s.holot} {s.ten}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px] font-black tracking-widest text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Mã NV: {s.manv}</span>
                                  <span className="text-[10px] font-medium text-gray-400">Email: {s.email}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-8 text-center text-gray-400 italic text-sm">Không tìm thấy nhân sự</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-10">
            <button 
              onClick={handleStatistics}
              disabled={isCalculating || (scope === 'individual' && !selectedStaff)}
              className="flex items-center gap-3 px-10 py-4 bg-white border-2 border-orange-500 text-orange-600 rounded-2xl font-black text-sm hover:bg-orange-50 transition-all shadow-lg shadow-orange-100 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {isCalculating ? <Loader2 className="animate-spin" size={20} /> : <Sigma size={20} />}
              Thống kê
            </button>
            <button 
              onClick={handleCancel}
              className="flex items-center gap-3 px-10 py-4 bg-white border-2 border-red-500 text-red-600 rounded-2xl font-black text-sm hover:bg-red-50 transition-all shadow-lg shadow-red-100 active:scale-95"
            >
              <X size={20} />
              Hủy bỏ
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {hasCalculated && (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-800 tracking-tight">Kết quả thống kê</h3>
                <p className="text-xs font-bold text-gray-400">Tìm thấy {results.length} bản ghi</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider text-center border-b border-gray-100">STT</th>
                  <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider border-b border-gray-100">Họ và Tên</th>
                  <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider border-b border-gray-100">Trình độ</th>
                  <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider border-b border-gray-100">Chức vụ</th>
                  <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider border-b border-gray-100">Đơn vị công tác</th>
                  <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider text-center border-b border-gray-100">Năm nghỉ phép</th>
                  <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider text-center border-b border-gray-100">Tổng số ngày đã nghỉ</th>
                  <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider border-b border-gray-100">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.length > 0 ? (
                  results.map((r, idx) => (
                    <tr key={r.manv} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4 text-center text-sm font-medium text-gray-400">{idx + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-black text-xs">
                            {r.hoten.split(' ').pop()?.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-gray-900">{r.hoten}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-600">{r.trinhdo}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-600">{r.chucvu}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-600">{r.donvi}</td>
                      <td className="px-6 py-4 text-center text-sm font-black text-blue-600">{r.nam}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-sm font-black">
                          {r.tongngaynghi}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 italic max-w-xs truncate" title={r.ghichu}>
                        {r.ghichu || '---'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="size-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200 mx-auto mb-4">
                        <LayoutGrid size={40} />
                      </div>
                      <p className="text-gray-400 font-bold">Không có dữ liệu nghỉ phép trong năm {selectedYear}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
