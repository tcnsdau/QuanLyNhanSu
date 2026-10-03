
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { NhanVien, NgayNghiLe, TrinhDo, PhongBan, ChucVu, RolePermission } from '../types';
import { checkPermission, normalizePermissions } from '../services/permissionService';
// added Info icon to imports
import { Search, FileDown, Pencil, X, Save, Calculator, Loader2, Filter, ChevronDown, CheckCircle2, AlertCircle, Calendar, Info, Plus, User, MoreHorizontal, UserCheck, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface NghiPhepNam {
  maso: number;
  manv: string;
  ngaybatdau: string;
  ngayketthuc: string;
  songaynghi: number;
  // Join fields
  holot?: string;
  ten?: string;
  ten_trinhdo?: string;
  ten_chucvu?: string;
  ten_phongban?: string;
}

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

export const NghiPhepNamManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [list, setList] = useState<NghiPhepNam[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);

  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  // Permission checks
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'congCu-quanLyCongPhep-danhSach', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'congCu-quanLyCongPhep-danhSach', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'congCu-quanLyCongPhep-danhSach', 'DELETE'), [permissions, isAdmin]);

  // Fetch latest permissions if currentUser is provided
  useEffect(() => {
    const fetchLatestPermissions = async () => {
      const userId = currentUser?.id || currentUser?.userid;
      if (!userId) return;
      
      try {
        const { data: rolePermData, error: rolePermError } = await supabase
          .from('RolePermissions')
          .select(`
            *,
            Modules!inner(modulecode, modulename),
            Permissions!inner(permissioncode, permissionname)
          `)
          .eq('userid', userId);

        if (rolePermError) throw rolePermError;

        if (rolePermData) {
          const [moduleRes, permRes] = await Promise.all([
            supabase.from('Modules').select('*'),
            supabase.from('Permissions').select('*')
          ]);

          if (moduleRes.error) throw moduleRes.error;
          if (permRes.error) throw permRes.error;

          const mappedPerms = normalizePermissions(rolePermData || [], moduleRes.data || [], permRes.data || []);
          setPermissions(mappedPerms);
        }
      } catch (err: any) {
        setMsgModal({
          isOpen: true,
          type: 'error',
          message: 'Lỗi tải quyền hạn Nghỉ phép năm: ' + (err.message || String(err))
        });
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);
  
  // Danh mục bổ trợ
  const [phongBans, setPhongBans] = useState<PhongBan[]>([]);

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NghiPhepNam | null>(null);
  const [saving, setSaving] = useState(false);
  
  // State cho xác nhận xóa
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; item: NghiPhepNam | null }>({
    isOpen: false,
    item: null
  });
  
  // State cho Form thêm mới
  const [addForm, setAddForm] = useState({
    manv: '',
    ngaybatdau: '',
    ngayketthuc: '',
    songaynghi: 0,
    ten_phongban: ''
  });
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  
  const staffDropdownRef = useRef<HTMLDivElement>(null);
  const staffSearchRef = useRef<HTMLInputElement>(null);

  // Notification states
  const [msgModal, setMsgModal] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' }>({
    isOpen: false,
    message: '',
    type: 'success'
  });

  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear; y >= 2007; y--) {
      arr.push(y.toString());
    }
    return arr;
  }, [currentYear]);

  const [filters, setFilters] = useState({
    trinhdo: '',
    chucvu: '',
    donvi: '',
    year: currentYear.toString()
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [npRes, nvRes, tdRes, pbRes, cvRes, holidayRes] = await Promise.all([
        supabase.from('DanhSachNghiPhepNam').select('*'),
        supabase.from('DanhSachNhanVien')
          .select('manv, holot, ten, trinhdo, phongban, chucvu, danghiviec')
          .eq('danghiviec', false),
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('DanhMucChucVu').select('*'),
        supabase.from('DanhSachNgayNghiLe').select('ngaynghi')
      ]);

      if (npRes.error) throw npRes.error;

      const nvs = (nvRes.data || []).map(normalizeKeys);
      const tds = (tdRes.data || []).map(normalizeKeys);
      const pbs = (pbRes.data || []).map(normalizeKeys);
      const cvs = (cvRes.data || []).map(normalizeKeys);
      const hols = (holidayRes.data || []).map(h => h.ngaynghi);
      setHolidays(hols);
      setPhongBans(pbs);

      // Thực hiện Join và lọc bỏ các bản ghi không tìm thấy nhân viên
      const joined = (npRes.data || []).map(item => {
        const base = normalizeKeys(item) as NghiPhepNam;
        const nv = nvs.find(e => String(e.manv) === String(base.manv));
        
        if (nv) {
          const td = tds.find(t => String(t.matrinhdo) === String(nv.trinhdo));
          const pb = pbs.find(p => String(p.maphongban) === String(nv.phongban));
          const cv = cvs.find(c => String(c.machucvu) === String(nv.chucvu));
          return {
            ...base,
            holot: nv.holot,
            ten: nv.ten,
            ten_trinhdo: td ? td.giatri : nv.trinhdo,
            ten_phongban: pb ? pb.giatri : nv.phongban,
            ten_chucvu: cv ? cv.giatri : nv.chucvu
          };
        }
        return null;
      }).filter((item): item is NonNullable<typeof item> => item !== null);

      setList(joined);
    } catch (err: any) {
      setMsgModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi tải dữ liệu: ' + (err.message || String(err))
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleClickOutside = (event: MouseEvent) => {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(event.target as Node)) {
        setIsStaffDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Hàm tính toán số ngày nghỉ theo quy định
  const calculateDays = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    if (start > end) return -1; // Đánh dấu không hợp lệ

    let totalDays = 0;
    let current = new Date(start);

    while (current <= end) {
      const dateString = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay(); // 0: CN, 6: T7

      const isHoliday = holidays.includes(dateString);
      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;

      if (!isHoliday && !isSunday) {
        if (isSaturday) {
          totalDays += 0.5;
        } else {
          totalDays += 1;
        }
      }
      current.setDate(current.getDate() + 1);
    }
    return totalDays;
  };

  // --- Logic Thêm mới ---
  const handleOpenAdd = async () => {
    setLoadingStaff(true);
    setAddForm({
      manv: '',
      ngaybatdau: new Date().toISOString().split('T')[0],
      ngayketthuc: new Date().toISOString().split('T')[0],
      songaynghi: 0,
      ten_phongban: ''
    });
    setSelectedStaff(null);
    setStaffSearchQuery('');
    setIsAddModalOpen(true);
    
    try {
      const { data, error } = await supabase
        .from('DanhSachNhanVien')
        .select('manv, holot, ten, phongban')
        .eq('danghiviec', false);
      if (error) throw error;
      
      const nvs = (data || []).map(normalizeKeys);
      setAvailableStaff(nvs);
    } catch (err: any) {
      setMsgModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi tải nhân sự: ' + (err.message || String(err))
      });
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleSelectStaffForAdd = (s: any) => {
    setSelectedStaff(s);
    const pb = phongBans.find(p => p.maphongban === s.phongban);
    setAddForm(prev => ({ 
      ...prev, 
      manv: s.manv,
      ten_phongban: pb ? pb.giatri : s.phongban 
    }));
    setIsStaffDropdownOpen(false);
  };

  const handleCalculateAddDays = () => {
    const result = calculateDays(addForm.ngaybatdau, addForm.ngayketthuc);
    if (result === -1) {
      setMsgModal({
        isOpen: true,
        type: 'error',
        message: 'Giá trị ngày bắt đầu nghỉ và ngày kết thúc nghỉ không hợp lệ, chọn lại giá trị mới!'
      });
      return;
    }
    setAddForm({ ...addForm, songaynghi: result });
  };

  const handleSaveAdd = async () => {
    if (!addForm.manv || !addForm.ngaybatdau || !addForm.ngayketthuc) {
      setMsgModal({
        isOpen: true,
        type: 'error',
        message: 'Vui lòng chọn đầy đủ thông tin nhân sự và thời gian nghỉ.'
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('DanhSachNghiPhepNam')
        .insert([{
          manv: addForm.manv,
          ngaybatdau: addForm.ngaybatdau,
          ngayketthuc: addForm.ngayketthuc,
          songaynghi: addForm.songaynghi
        }]);

      if (error) throw error;

      setIsAddModalOpen(false);
      setMsgModal({
        isOpen: true,
        type: 'success',
        message: 'Đã thêm mới đăng ký nghỉ phép năm cho CBNV'
      });
      fetchData();
    } catch (err: any) {
      setMsgModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi: ' + (err.message || String(err))
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredStaffInDropdown = useMemo(() => {
    if (!staffSearchQuery.trim()) return availableStaff.slice(0, 50);
    const lowerSearch = staffSearchQuery.toLowerCase();
    return availableStaff.filter(s => 
      `${s.holot} ${s.ten}`.toLowerCase().includes(lowerSearch) || 
      String(s.manv || '').toLowerCase().includes(lowerSearch)
    );
  }, [availableStaff, staffSearchQuery]);

  // --- Logic Hiệu chỉnh ---
  const handleOpenEdit = (item: NghiPhepNam) => {
    setEditingItem({ ...item });
    setIsEditModalOpen(true);
  };

  const handleUpdateDays = () => {
    if (!editingItem) return;
    const result = calculateDays(editingItem.ngaybatdau, editingItem.ngayketthuc);
    if (result === -1) {
      setMsgModal({
        isOpen: true,
        type: 'error',
        message: 'Giá trị ngày bắt đầu nghỉ và ngày kết thúc nghỉ không hợp lệ, chọn lại giá trị mới!'
      });
      return;
    }
    setEditingItem({ ...editingItem, songaynghi: result });
  };

  const handleSaveUpdate = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      const { maso, ngaybatdau, ngayketthuc, songaynghi } = editingItem;
      const { error } = await supabase
        .from('DanhSachNghiPhepNam')
        .update({ ngaybatdau, ngayketthuc, songaynghi })
        .eq('maso', maso);

      if (error) throw error;

      setIsEditModalOpen(false);
      setMsgModal({
        isOpen: true,
        type: 'success',
        message: 'Đã cập nhập thay đổi nghỉ phép năm cho nhân sự xong'
      });
      fetchData();
    } catch (err: any) {
      setMsgModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi: ' + (err.message || String(err))
      });
    } finally {
      setSaving(false);
    }
  };

  // --- Logic Xóa ---
  const handleDelete = (item: NghiPhepNam) => {
    setConfirmDelete({ isOpen: true, item });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete.item) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('DanhSachNghiPhepNam')
        .delete()
        .eq('maso', confirmDelete.item.maso);

      if (error) throw error;

      setConfirmDelete({ isOpen: false, item: null });
      setMsgModal({
        isOpen: true,
        type: 'success',
        message: 'Đã xóa nhân sự ra khỏi danh sách nghỉ phép năm thành công'
      });
      fetchData();
    } catch (err: any) {
      setMsgModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi: ' + (err.message || String(err))
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map((item, idx) => ({
      'STT': idx + 1,
      'Mã NV': item.manv,
      'Họ và Tên': `${item.holot} ${item.ten}`,
      'Trình độ': item.ten_trinhdo,
      'Chức vụ': item.ten_chucvu,
      'Đơn vị công tác': item.ten_phongban,
      'Ngày bắt đầu nghỉ': formatDate(item.ngaybatdau),
      'Ngày kết thúc nghỉ': formatDate(item.ngayketthuc),
      'Số ngày nghỉ': item.songaynghi
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NghiPhepNam");
    
    // Xuất với UTF-8 BOM
    XLSX.writeFile(wb, "DanhSachNghiPhepNam.xlsx");
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  const uniqueValues = (key: keyof NghiPhepNam) => {
    const vals = list.map(item => String(item[key] || '')).filter(v => v !== '');
    return Array.from(new Set(vals)).sort();
  };

  const filteredData = useMemo(() => {
    return list.filter(item => {
      const fullName = `${item.holot} ${item.ten}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      
      if (filters.trinhdo && item.ten_trinhdo !== filters.trinhdo) return false;
      if (filters.chucvu && item.ten_chucvu !== filters.chucvu) return false;
      if (filters.donvi && item.ten_phongban !== filters.donvi) return false;
      
      // Lọc theo năm của ngày bắt đầu nghỉ
      if (filters.year) {
        const itemYear = item.ngaybatdau ? item.ngaybatdau.split('-')[0] : '';
        if (itemYear !== filters.year) return false;
      }
      
      return true;
    });
  }, [list, searchTerm, filters]);

  return (
    <div className="max-w-[1920px] mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-100">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-blue-900 tracking-tight">Danh sách nghỉ phép năm</h2>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-all active:scale-95 text-sm"
            >
              <Plus className="h-4 w-4" /> Thêm mới
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md transition-all active:scale-95 text-sm"
          >
            <FileDown className="h-4 w-4" /> Xuất Excel
          </button>
        </div>
      </div>

      {/* Toolbar & Filter */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm họ và tên..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white text-black font-medium shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-red-600 pl-1">Năm</label>
            <div className="relative">
              <select
                value={filters.year}
                onChange={e => setFilters(prev => ({ ...prev, year: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 appearance-none bg-white font-medium text-gray-700 outline-none focus:ring-1 focus:ring-blue-400"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-red-600 pl-1">Trình độ</label>
            <div className="relative">
              <select
                value={filters.trinhdo}
                onChange={e => setFilters(prev => ({ ...prev, trinhdo: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 appearance-none bg-white font-medium text-gray-700 outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Tất cả</option>
                {uniqueValues('ten_trinhdo').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-red-600 pl-1">Chức vụ</label>
            <div className="relative">
              <select
                value={filters.chucvu}
                onChange={e => setFilters(prev => ({ ...prev, chucvu: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 appearance-none bg-white font-medium text-gray-700 outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Tất cả</option>
                {uniqueValues('ten_chucvu').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-red-600 pl-1">Đơn vị công tác</label>
            <div className="relative">
              <select
                value={filters.donvi}
                onChange={e => setFilters(prev => ({ ...prev, donvi: e.target.value }))}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 appearance-none bg-white font-medium text-gray-700 outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">Tất cả</option>
                {uniqueValues('ten_phongban').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left border-collapse">
            <thead className="bg-gray-50/80 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-4 text-[13px] font-bold text-red-600 tracking-tight text-center w-16">STT</th>
                <th className="px-4 py-4 text-[13px] font-bold text-red-600 tracking-tight text-center w-24">Mã NV</th>
                <th className="px-4 py-4 text-[13px] font-bold text-red-600 tracking-tight">Họ và Tên</th>
                <th className="px-4 py-4 text-[13px] font-bold text-red-600 tracking-tight">Trình độ</th>
                <th className="px-4 py-4 text-[13px] font-bold text-red-600 tracking-tight">Chức vụ</th>
                <th className="px-4 py-4 text-[13px] font-bold text-red-600 tracking-tight">Đơn vị công tác</th>
                <th className="px-4 py-4 text-[13px] font-bold text-red-600 tracking-tight text-center">Ngày bắt đầu nghỉ</th>
                <th className="px-4 py-4 text-[13px] font-bold text-red-600 tracking-tight text-center">Ngày kết thúc nghỉ</th>
                <th className="px-4 py-4 text-[13px] font-bold text-red-600 tracking-tight text-center">Số ngày nghỉ</th>
                <th className="px-4 py-4 text-[13px] font-bold text-red-600 tracking-tight text-center w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-600" />
                    <p className="mt-2 text-gray-400 text-sm font-bold tracking-widest">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy dữ liệu phù hợp.</td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.maso} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-4 text-sm text-gray-500 text-center font-bold">{index + 1}</td>
                    <td className="px-4 py-4 text-sm text-blue-600 text-center font-bold">{item.manv}</td>
                    <td className="px-4 py-4 text-sm text-blue-900 font-bold">{item.holot} {item.ten}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{item.ten_trinhdo}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{item.ten_chucvu}</td>
                    <td className="px-4 py-4 text-sm text-blue-800 font-bold">{item.ten_phongban}</td>
                    <td className="px-4 py-4 text-sm text-gray-700 text-center">{formatDate(item.ngaybatdau)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700 text-center">{formatDate(item.ngayketthuc)}</td>
                    <td className="px-4 py-4 text-sm text-red-600 text-center font-black">{item.songaynghi}</td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        {canUpdate && (
                          <button 
                            onClick={() => handleOpenEdit(item)}
                            className="w-28 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-blue-100"
                            title="Hiệu chỉnh nghỉ phép năm"
                          >
                            <Pencil size={14} /> Hiệu chỉnh
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(item)}
                            className="w-28 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 border border-red-100"
                            title="Xóa nhân sự khỏi danh sách"
                          >
                            <Trash2 size={14} /> Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#f0f4f8] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border-2 border-indigo-200">
            <div className="bg-white p-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <div className="bg-blue-600 p-1.5 rounded shadow-md"><Plus className="h-5 w-5 text-white" /></div>
                 <span className="text-base font-bold text-gray-800">Thêm CBNV đăng ký nghỉ phép năm</span>
              </div>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={28} /></button>
            </div>

            <div className="p-8 space-y-8 bg-white/50">
               {/* Phần Chọn CBGVNV */}
               <fieldset className="border border-gray-300 rounded-lg p-6 relative">
                 <legend className="px-2 text-xs font-bold text-red-600 bg-white/80">Chọn CBGVCNV đăng ký nghỉ phép năm</legend>
                 <div className="space-y-4">
                    <div className="relative" ref={staffDropdownRef}>
                      <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 bg-white">
                        <input 
                          readOnly
                          className="block w-full border-none px-4 py-2.5 text-sm font-bold text-black focus:ring-0 cursor-pointer" 
                          placeholder={selectedStaff ? `${selectedStaff.manv} - ${selectedStaff.holot} ${selectedStaff.ten}` : "Click để tìm kiếm và chọn nhân sự..."}
                          onClick={() => {
                            setIsStaffDropdownOpen(true);
                            setTimeout(() => staffSearchRef.current?.focus(), 50);
                          }}
                        />
                        <div className="bg-gray-100 flex items-center px-4 border-l border-gray-200"><MoreHorizontal className="h-5 w-5 text-gray-500" /></div>
                      </div>

                      {isStaffDropdownOpen && (
                        <div className="absolute z-[130] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-60 animate-in fade-in slide-in-from-top-2">
                           <div className="p-2 border-b border-gray-100 bg-gray-50">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input 
                                  ref={staffSearchRef}
                                  type="text" 
                                  placeholder="Tìm mã hoặc tên nhân sự..."
                                  className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                                  value={staffSearchQuery}
                                  onChange={e => setStaffSearchQuery(e.target.value)}
                                />
                              </div>
                           </div>
                           <div className="overflow-y-auto">
                              {loadingStaff ? (
                                <div className="p-6 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-blue-600" /></div>
                              ) : filteredStaffInDropdown.length === 0 ? (
                                <div className="p-6 text-center text-gray-400 italic text-sm">Không tìm thấy nhân sự phù hợp.</div>
                              ) : (
                                filteredStaffInDropdown.map(st => (
                                  <div key={st.manv} onClick={() => handleSelectStaffForAdd(st)} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center transition-colors">
                                     <div>
                                        <p className="text-sm font-bold text-gray-900">{st.manv} - {st.holot} {st.ten}</p>
                                     </div>
                                  </div>
                                ))
                              )}
                           </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                       <label className="text-sm font-bold text-red-600 whitespace-nowrap min-w-[60px]">Đơn vị</label>
                       <input 
                         readOnly
                         type="text"
                         className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 shadow-inner"
                         value={addForm.ten_phongban}
                       />
                    </div>
                 </div>
               </fieldset>

               {/* Thời gian nghỉ phép */}
               <fieldset className="border border-gray-300 rounded-lg p-6 relative space-y-6">
                 <legend className="px-2 text-xs font-bold text-red-600 bg-white/80">Thời gian nghỉ phép</legend>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                    <div className="space-y-1">
                       <label className="text-sm font-bold text-red-600">Từ ngày</label>
                       <input 
                         type="date"
                         className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold bg-white text-blue-800 shadow-inner outline-none focus:ring-1 focus:ring-blue-400"
                         value={addForm.ngaybatdau}
                         onChange={e => setAddForm({ ...addForm, ngaybatdau: e.target.value })}
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-sm font-bold text-red-600">Đến ngày</label>
                       <input 
                         type="date"
                         className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold bg-white text-blue-800 shadow-inner outline-none focus:ring-1 focus:ring-blue-400"
                         value={addForm.ngayketthuc}
                         onChange={e => setAddForm({ ...addForm, ngayketthuc: e.target.value })}
                       />
                    </div>
                 </div>

                 <div className="flex items-center gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={handleCalculateAddDays}
                      className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-300 rounded shadow-md hover:bg-gray-50 transition-all text-sm font-bold text-blue-800 active:scale-95"
                    >
                       <Calculator className="h-4 w-4 text-red-500" /> Số ngày nghỉ
                    </button>
                    <input 
                      readOnly
                      type="text"
                      className="w-20 p-2.5 bg-white border border-gray-300 rounded text-center text-sm font-black text-red-600 shadow-inner"
                      value={addForm.songaynghi}
                    />
                 </div>
               </fieldset>

               <div className="flex justify-start gap-4 pt-4">
                  <button 
                    onClick={handleSaveAdd}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-300 rounded shadow-lg hover:bg-indigo-50 transition-all active:scale-95 text-sm font-bold text-gray-700"
                  >
                     {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5 text-blue-600" />} Thêm vào
                  </button>
                  <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-300 rounded shadow-lg hover:bg-red-50 transition-all active:scale-95 text-sm font-bold text-gray-700"
                  >
                     <X className="h-5 w-5 text-red-600" /> Kết thúc
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#f0f4f8] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border-2 border-indigo-200">
            <div className="bg-white p-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <div className="bg-blue-600 p-1.5 rounded shadow-md"><Pencil className="h-5 w-5 text-white" /></div>
                 <span className="text-base font-bold text-gray-800">Hiệu chỉnh thời gian nghỉ phép</span>
              </div>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={28} /></button>
            </div>

            <div className="p-8 space-y-8 bg-white/50">
               {/* Thông tin CBGVNV */}
               <fieldset className="border border-gray-300 rounded-lg p-6 relative">
                 <legend className="px-2 text-xs font-bold text-red-600 bg-white/80">Thông tin CBGVNV</legend>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-baseline gap-2">
                       <span className="text-sm font-medium text-gray-600">Họ tên:</span>
                       <span className="text-base font-black text-blue-800">{editingItem.holot} {editingItem.ten}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                       <span className="text-sm font-medium text-gray-600">Đơn vị:</span>
                       <span className="text-base font-black text-blue-800">{editingItem.ten_phongban}</span>
                    </div>
                 </div>
               </fieldset>

               {/* Thời gian nghỉ phép */}
               <fieldset className="border border-gray-300 rounded-lg p-6 relative space-y-6">
                 <legend className="px-2 text-xs font-bold text-red-600 bg-white/80">Thời gian nghỉ phép</legend>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                    <div className="space-y-1">
                       <label className="text-sm font-bold text-red-600">Từ ngày</label>
                       <input 
                         type="date"
                         className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold bg-white text-blue-800 shadow-inner outline-none focus:ring-1 focus:ring-blue-400"
                         value={editingItem.ngaybatdau}
                         onChange={e => setEditingItem({ ...editingItem, ngaybatdau: e.target.value })}
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-sm font-bold text-red-600">Đến ngày</label>
                       <input 
                         type="date"
                         className="w-full p-2.5 border border-red-200 rounded-xl text-sm font-bold bg-white text-blue-800 shadow-inner outline-none focus:ring-1 focus:ring-blue-400"
                         value={editingItem.ngayketthuc}
                         onChange={e => setEditingItem({ ...editingItem, ngayketthuc: e.target.value })}
                       />
                    </div>
                 </div>

                 <div className="flex items-center gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={handleUpdateDays}
                      className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-300 rounded shadow-md hover:bg-gray-50 transition-all text-sm font-bold text-blue-800 active:scale-95"
                    >
                       <Calculator className="h-4 w-4 text-red-500" /> Số ngày nghỉ
                    </button>
                    <input 
                      readOnly
                      type="text"
                      className="w-20 p-2.5 bg-white border border-gray-300 rounded text-center text-sm font-black text-red-600 shadow-inner"
                      value={editingItem.songaynghi}
                    />
                 </div>
               </fieldset>

               <div className="flex justify-start gap-4 pt-4">
                  <button 
                    onClick={handleSaveUpdate}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-300 rounded shadow-lg hover:bg-indigo-50 transition-all active:scale-95 text-sm font-bold text-gray-700"
                  >
                     {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5 text-blue-600" />} Cập nhập
                  </button>
                  <button 
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-300 rounded shadow-lg hover:bg-red-50 transition-all active:scale-95 text-sm font-bold text-gray-700"
                  >
                     <X className="h-5 w-5 text-red-600" /> Hủy bỏ
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete.isOpen && confirmDelete.item && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
              <div className="bg-red-600 p-4 text-white flex items-center gap-3">
                 <AlertCircle size={24} />
                 <h3 className="text-lg font-bold">Xác nhận xóa</h3>
              </div>
              <div className="p-8 text-center">
                 <p className="text-gray-800 font-bold text-sm leading-relaxed">
                   Bạn chắc chắn muốn xóa GVNV <span className="text-red-600 font-black">{confirmDelete.item.holot} {confirmDelete.item.ten}</span> ra khỏi danh sách nghỉ phép năm {confirmDelete.item.ngaybatdau.split('-')[0]}?
                 </p>
              </div>
              <div className="bg-gray-50 p-4 flex justify-center gap-4 border-t">
                 <button 
                  onClick={handleConfirmDelete}
                  disabled={saving}
                  className="px-8 py-2 bg-red-600 text-white font-black rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center gap-2"
                 >
                   {saving ? <Loader2 size={14} className="animate-spin" /> : null} Đồng ý
                 </button>
                 <button 
                  onClick={() => setConfirmDelete({ isOpen: false, item: null })} 
                  className="px-8 py-2 bg-gray-200 text-gray-700 font-black rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-widest"
                 >
                   Hủy bỏ
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Msg Modal */}
      {msgModal.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-indigo-100">
              <div className={`${msgModal.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} p-4 text-white flex items-center gap-3`}>
                 {msgModal.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                 <h3 className="text-lg font-bold">Thông báo</h3>
              </div>
              <div className="p-8 text-center">
                 <p className="text-gray-800 font-bold text-sm leading-relaxed whitespace-pre-wrap">{msgModal.message}</p>
              </div>
              <div className="bg-gray-50 p-4 flex justify-center border-t">
                 <button 
                  onClick={() => setMsgModal({ ...msgModal, isOpen: false })} 
                  className={`px-12 py-2 ${msgModal.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white font-black rounded-xl shadow-md transition-all active:scale-95 text-xs uppercase tracking-widest`}
                 >
                   Đã hiểu
                 </button>
              </div>
           </div>
        </div>
      )}
      
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
         <p className="text-[10px] text-red-400 font-bold tracking-widest italic flex items-center gap-2">
            <Info className="h-3 w-3" /> Hệ thống DAU HR Management | Quản lý nghỉ phép năm
         </p>
      </div>
    </div>
  );
};
