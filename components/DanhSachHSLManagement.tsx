
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { DanhSachHSL, NhanVien, TrinhDo, PhongBan, ChucVu, DanhMucHSL, RolePermission } from '../types';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { Search, FileDown, Wallet, Loader2, Filter, Info, ChevronDown, Pencil, X, Save, AlertCircle, Image as ImageIcon, Plus, User, Building2, MoreHorizontal, UserCheck, Award, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

const getGoogleDriveImageUrl = (url: string) => {
  if (!url) return '';
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    const idMatch = url.match(/[-\w]{25,}/);
    if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[0]}`;
  }
  return url;
};

export const DanhSachHSLManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [list, setList] = useState<DanhSachHSL[]>([]);
  const [hslCatalog, setHslCatalog] = useState<DanhMucHSL[]>([]);
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
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'luong-danhSachHSL', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'luong-danhSachHSL', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'luong-danhSachHSL', 'DELETE'), [permissions, isAdmin]);

  // Fetch latest permissions if currentUser is provided
  useEffect(() => {
    const fetchLatestPermissions = async () => {
      const userId = currentUser?.id || currentUser?.userid;
      if (!userId) return;
      
      try {
        const { data: rolePermData, error: rolePermError } = await supabase
          .from('RolePermissions')
          .select('*')
          .eq('userid', userId);

        if (rolePermError) throw rolePermError;

        if (rolePermData) {
          // Get Modules and Permissions for mapping
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
        showAlert('Lỗi tải quyền hạn Danh sách HSL: ' + (err.message || err));
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);
  
  // Modals States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DanhSachHSL | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'error' | 'success'>('error');

  const showAlert = (message: string, type: 'error' | 'success' = 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setIsAlertModalOpen(true);
  };

  // Add New Form States
  const [addForm, setAddForm] = useState<Partial<DanhSachHSL>>({
    manv: '',
    hsl: 0,
    hschucvu: 0,
    tongheso: 0,
    thoigianbatdau: '',
    manangluong: '',
    dienxet: true,
    lydokhongxet: '',
    hetthamgia: false
  });
  const [selectedStaffForAdd, setSelectedStaffForAdd] = useState<any>(null);
  const [isAddStaffDropdownOpen, setIsAddStaffDropdownOpen] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const addStaffSearchRef = useRef<HTMLInputElement>(null);

  // Filters State - Default hetthamgia is 'False'
  const [filters, setFilters] = useState({
    trinhdo: '',
    phongban: '',
    chucvu: '',
    manangluong: '',
    hsl: '',
    thoigianbatdau: '',
    hschucvu: '',
    tongheso: '',
    dienxet: '',
    hetthamgia: 'False'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [hslRes, nvRes, tdRes, pbRes, cvRes, hslCatRes] = await Promise.all([
        supabase.from('DanhSachHSL').select('*'),
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, ngaychinhthuc, trinhdo, phongban, chucvu, hinhanh'),
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('DanhMucChucVu').select('*'),
        supabase.from('DanhMucHSL').select('*').order('maso', { ascending: true })
      ]);

      if (hslRes.error) throw hslRes.error;

      const employees = (nvRes.data || []).map(normalizeKeys);
      const levels = (tdRes.data || []).map(normalizeKeys);
      const departments = (pbRes.data || []).map(normalizeKeys);
      const positions = (cvRes.data || []).map(normalizeKeys);
      const catalogs = (hslCatRes.data || []).map(normalizeKeys);
      setHslCatalog(catalogs);

      const joinedData = (hslRes.data || []).map(item => {
        const normalizedHSL = normalizeKeys(item) as DanhSachHSL;
        const emp = employees.find(e => String(e.manv) === String(normalizedHSL.manv));
        
        if (emp) {
          const td = levels.find(l => String(l.matrinhdo) === String(emp.trinhdo));
          const pb = departments.find(p => String(p.maphongban) === String(emp.phongban));
          const cv = positions.find(c => String(c.machucvu) === String(emp.chucvu));

          return {
            ...normalizedHSL,
            holot: emp.holot,
            ten: emp.ten,
            ngaychinhthuc: emp.ngaychinhthuc,
            hinhanh: emp.hinhanh,
            ten_trinhdo: td ? td.giatri : emp.trinhdo,
            ten_phongban: pb ? pb.giatri : emp.phongban,
            ten_chucvu: cv ? cv.giatri : emp.chucvu
          };
        }
        return normalizedHSL;
      });

      setList(joinedData);
    } catch (err: any) {
      showAlert('Lỗi khi tải dữ liệu: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleClickOutside = (event: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(event.target as Node)) {
        setIsAddStaffDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenAddStaffDropdown = async () => {
    setIsAddStaffDropdownOpen(true);
    setLoadingStaff(true);
    setStaffSearchQuery('');
    try {
      const [nvRes, pbRes] = await Promise.all([
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, phongban').eq('danghiviec', false),
        supabase.from('DanhMucPhongBan').select('maphongban, giatri')
      ]);
      
      if (nvRes.error) throw nvRes.error;
      const departments = (pbRes.data || []).map(normalizeKeys);
      const employees = (nvRes.data || []).map(item => {
        const normalized = normalizeKeys(item);
        const pb = departments.find(d => String(d.maphongban) === String(normalized.phongban));
        return {
          ...normalized,
          ten_phongban: pb ? pb.giatri : normalized.phongban
        };
      });
      setAvailableStaff(employees);
    } catch (err: any) {
      showAlert("Lỗi tải danh sách nhân viên: " + (err.message || err));
    } finally {
      setLoadingStaff(false);
      setTimeout(() => addStaffSearchRef.current?.focus(), 100);
    }
  };

  const filteredStaffInDropdown = useMemo(() => {
    if (!staffSearchQuery.trim()) return availableStaff;
    const lowerSearch = staffSearchQuery.toLowerCase();
    return availableStaff.filter(s => 
      `${s.holot} ${s.ten}`.toLowerCase().includes(lowerSearch) || 
      String(s.manv || '').toLowerCase().includes(lowerSearch) ||
      String(s.ten_phongban || '').toLowerCase().includes(lowerSearch)
    );
  }, [availableStaff, staffSearchQuery]);

  const handleSelectStaffForAdd = (s: any) => {
    setSelectedStaffForAdd(s);
    setAddForm(prev => ({ ...prev, manv: s.manv }));
    setIsAddStaffDropdownOpen(false);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN');
  };

  // Fix: Explicitly specify return type string[] and generic type for Set to resolve unknown type errors
  const uniqueValues = (key: keyof DanhSachHSL): string[] => {
    const values = list.map(item => String(item[key] ?? ''));
    return Array.from(new Set<string>(values))
      .filter(val => val !== '' && val !== 'undefined')
      .sort((a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }));
  };

  const filteredList = useMemo(() => {
    return list.filter(item => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        String(item.holot || '').toLowerCase().includes(search) ||
        String(item.ten || '').toLowerCase().includes(search) ||
        String(item.ten_phongban || '').toLowerCase().includes(search) ||
        String(item.hsl || '').toLowerCase().includes(search) ||
        String(item.manv || '').toLowerCase().includes(search);

      if (!matchesSearch) return false;

      if (filters.trinhdo && item.ten_trinhdo !== filters.trinhdo) return false;
      if (filters.phongban && item.ten_phongban !== filters.phongban) return false;
      if (filters.chucvu && item.ten_chucvu !== filters.chucvu) return false;
      if (filters.manangluong && String(item.manangluong) !== filters.manangluong) return false;
      if (filters.hsl && String(item.hsl) !== filters.hsl) return false;
      if (filters.thoigianbatdau && String(item.thoigianbatdau) !== filters.thoigianbatdau) return false;
      if (filters.hschucvu && String(item.hschucvu) !== filters.hschucvu) return false;
      if (filters.tongheso && String(item.tongheso) !== filters.tongheso) return false;
      
      if (filters.dienxet !== '') {
        const val = filters.dienxet === 'Có';
        if (item.dienxet !== val) return false;
      }

      if (filters.hetthamgia !== '') {
        const val = filters.hetthamgia === 'True';
        if (item.hetthamgia !== val) return false;
      }

      return true;
    });
  }, [list, searchTerm, filters]);

  const handleExportExcel = () => {
    const dataToExport = filteredList.map(item => ({
      'Mã nhân viên': item.manv,
      'Họ lót': item.holot,
      'Tên': item.ten,
      'Ngày chính thức': formatDate(item.ngaychinhthuc),
      'Trình độ': item.ten_trinhdo,
      'Đơn vị': item.ten_phongban,
      'Chức vụ': item.ten_chucvu,
      'Mã nâng lương': item.manangluong,
      'Hệ số lương': item.hsl,
      'Thời gian hưởng': formatDate(item.thoigianbatdau),
      'Hệ số chức vụ': item.hschucvu,
      'Tổng hệ số': item.tongheso,
      'Diện xét': item.dienxet ? 'Có' : 'Không',
      'Lý do không xét': item.lydokhongxet,
      'Hết tham gia': item.hetthamgia ? 'Có' : 'Không'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachHSL");
    XLSX.writeFile(wb, "DanhSachHuongHSL.xlsx");
  };

  const handleOpenEdit = (item: DanhSachHSL) => {
    setEditingItem({ ...item });
    setModalError(null);
    setIsEditModalOpen(true);
  };

  const calculateTongHeSo = (hsl: number | string, hsCv: number | string) => {
    const valHsl = parseFloat(String(hsl)) || 0;
    const valHsCv = parseFloat(String(hsCv)) || 0;
    return parseFloat((valHsl + valHsCv).toFixed(2));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editingItem.hsl || !editingItem.thoigianbatdau) {
      setModalError("Hệ số lương và Thời gian hưởng không được để trống.");
      return;
    }

    setSaving(true);
    try {
      const { 
        manv,
        holot, ten, ngaychinhthuc, ten_trinhdo, ten_phongban, ten_chucvu, hinhanh,
        ...payload 
      } = editingItem as any;

      const { error } = await supabase
        .from('DanhSachHSL')
        .update(payload)
        .eq('manv', manv);

      if (error) throw error;

      showAlert("Cập nhật thông tin Hệ số lương thành công!", 'success');
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.manv || !addForm.hsl || !addForm.thoigianbatdau) {
      setModalError("Vui lòng chọn nhân sự, nhập Hệ số lương và Thời gian hưởng.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        manv: addForm.manv,
        manangluong: addForm.manangluong || '',
        hsl: addForm.hsl,
        hschucvu: addForm.hschucvu || 0,
        tongheso: addForm.tongheso,
        thoigianbatdau: addForm.thoigianbatdau,
        dienxet: true, // Giá trị cố định khi thêm mới
        lydokhongxet: '', // Mặc định để trống
        hetthamgia: false // Mặc định là đang tham gia
      };

      const { error } = await supabase.from('DanhSachHSL').insert([payload]);
      if (error) throw error;

      showAlert("Thêm mới hồ sơ thành công!", 'success');
      setIsAddModalOpen(false);
      fetchData();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (manv: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa hồ sơ HSL của nhân sự có mã ${manv}?`)) {
      try {
        const { error } = await supabase
          .from('DanhSachHSL')
          .delete()
          .eq('manv', manv);
        
        if (error) throw error;
        
        showAlert("Xóa hồ sơ HSL thành công!", 'success');
        fetchData();
      } catch (err: any) {
        showAlert("Lỗi khi xóa: " + err.message);
      }
    }
  };

  const FilterSelect = ({ label, field, options }: { label: string, field: keyof typeof filters, options: string[] }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-blue-600 pl-1">{label}</label>
      <div className="relative">
        <select
          value={filters[field]}
          onChange={e => setFilters(prev => ({ ...prev, [field]: e.target.value }))}
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 appearance-none bg-white font-medium text-gray-700 outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">Tất cả</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );

  // Derived label for selected rank in modals
  const selectedRankInfoEdit = useMemo(() => {
    if (!editingItem || !editingItem.manangluong) return '---';
    const found = hslCatalog.find(cat => String(cat.maso) === String(editingItem.manangluong));
    return found ? found.chucdanhtrinhdo : '---';
  }, [editingItem, hslCatalog]);

  const selectedRankInfoAdd = useMemo(() => {
    if (!addForm.manangluong) return '---';
    const found = hslCatalog.find(cat => String(cat.maso) === String(addForm.manangluong));
    return found ? found.chucdanhtrinhdo : '---';
  }, [addForm.manangluong, hslCatalog]);

  return (
    <div className="max-w-[1920px] mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-100">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-blue-900 uppercase tracking-tight">Danh sách nhân sự hưởng HSL</h2>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {canCreate && (
            <button
              onClick={() => {
                setModalError(null);
                setAddForm({
                  manv: '', hsl: 0, hschucvu: 0, tongheso: 0, thoigianbatdau: '', manangluong: hslCatalog[0]?.maso.toString() || '', 
                  dienxet: true, lydokhongxet: '', hetthamgia: false
                });
                setSelectedStaffForAdd(null);
                setIsAddModalOpen(true);
              }}
              className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4 mr-2" /> Thêm mới
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95"
          >
            <FileDown className="h-4 w-4 mr-2" /> Xuất Excel
          </button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm theo Mã NV, Họ tên, Đơn vị, HSL..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black bg-gray-50/50 font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
            <Info className="h-4 w-4 text-blue-500" />
            Số lượng nhân sự trong danh sách: <span className="text-blue-700 text-sm ml-1">{filteredList.length}</span>
          </div>
        </div>

        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-3 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
          <FilterSelect label="Trình độ" field="trinhdo" options={uniqueValues('ten_trinhdo')} />
          <FilterSelect label="Đơn vị" field="phongban" options={uniqueValues('ten_phongban')} />
          <FilterSelect label="Chức vụ" field="chucvu" options={uniqueValues('ten_chucvu')} />
          <FilterSelect label="Mã nâng lương" field="manangluong" options={uniqueValues('manangluong')} />
          <FilterSelect label="HSL" field="hsl" options={uniqueValues('hsl')} />
          <FilterSelect label="Thời gian hưởng" field="thoigianbatdau" options={uniqueValues('thoigianbatdau')} />
          <FilterSelect label="HS Chức vụ" field="hschucvu" options={uniqueValues('hschucvu')} />
          <FilterSelect label="Tổng hệ số" field="tongheso" options={uniqueValues('tongheso')} />
          <FilterSelect label="Diện xét" field="dienxet" options={['Có', 'Không']} />
          <FilterSelect label="Hết tham gia" field="hetthamgia" options={['True', 'False']} />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-[1500px] w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-20">Mã NV</th>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest">Họ và Tên</th>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest">Trình độ / Đơn vị / Chức vụ</th>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Mã nâng</th>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">HSL</th>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Thời gian hưởng</th>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">HS Chức vụ</th>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Tổng HS</th>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Diện xét</th>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest">Lý do không xét</th>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Hết tham gia</th>
                <th className="px-4 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-24">
                  {(canUpdate || canDelete) ? 'Thao tác' : ''}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-indigo-600" />
                    <p className="mt-2 text-gray-400 font-bold text-[10px] tracking-widest">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy nhân sự phù hợp với bộ lọc.</td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.manv} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="px-4 py-4 text-sm text-center">
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200 font-bold">
                        {item.manv}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-blue-900">{item.holot} {item.ten}</span>
                        <span className="text-[10px] text-gray-500 font-medium">Chính thức: {formatDate(item.ngaychinhthuc)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col text-[11px] leading-tight space-y-1">
                        <span className="text-indigo-600 font-bold italic">{item.ten_trinhdo}</span>
                        <span className="text-gray-800 font-bold">{item.ten_phongban}</span>
                        <span className="text-gray-600 font-medium">{item.ten_chucvu}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-center font-bold text-gray-600">{item.manangluong}</td>
                    <td className="px-4 py-4 text-sm text-center font-black text-indigo-600">{item.hsl}</td>
                    <td className="px-4 py-4 text-sm text-center font-bold text-blue-600">{formatDate(item.thoigianbatdau)}</td>
                    <td className="px-4 py-4 text-sm text-center text-gray-700">{item.hschucvu}</td>
                    <td className="px-4 py-4 text-sm text-center font-black text-red-600">{item.tongheso}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-black ${item.dienxet ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                        {item.dienxet ? 'Có' : 'Không'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 italic max-w-[200px] truncate" title={item.lydokhongxet}>
                        {item.lydokhongxet || '---'}
                    </td>
                    <td className="px-4 py-4 text-center">
                       {item.hetthamgia ? (
                         <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" title="Hết tham gia"></span>
                       ) : (
                         <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-200" title="Đang tham gia"></span>
                       )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex justify-center gap-1">
                        {canUpdate && (
                          <button 
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                            title="Hiệu chỉnh HSL"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDelete(item.manv)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            title="Xóa hồ sơ HSL"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        {!canUpdate && !canDelete && (
                          <span className="text-[10px] text-gray-400 italic">No access</span>
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
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveAdd} className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in duration-200 my-8">
            <div className="bg-indigo-700 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-wider flex items-center gap-3">
                <Plus className="h-6 w-6" /> Thêm mới Hồ sơ hưởng HSL
              </h3>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="h-7 w-7" />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              {/* Personnel Selection Dropdown */}
              <section className="space-y-4">
                <div className="relative" ref={addDropdownRef}>
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1.5 block">Chọn nhân sự *</label>
                  <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 bg-white transition-all">
                    <input 
                      className="block w-full border-none px-4 py-3 text-sm font-bold text-black focus:ring-0 bg-white cursor-pointer" 
                      placeholder={selectedStaffForAdd ? `${selectedStaffForAdd.holot} ${selectedStaffForAdd.ten} (${selectedStaffForAdd.manv})` : "Click để tìm kiếm nhân viên..."}
                      type="text" 
                      readOnly
                      onClick={handleOpenAddStaffDropdown}
                      value={selectedStaffForAdd ? `${selectedStaffForAdd.holot} ${selectedStaffForAdd.ten}` : ""}
                    />
                    <button 
                      type="button"
                      onClick={handleOpenAddStaffDropdown}
                      className="inline-flex items-center px-4 bg-gray-50 border-l border-gray-200 text-gray-500 hover:bg-gray-100"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>

                  {isAddStaffDropdownOpen && (
                    <div className="absolute z-[120] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl divide-y divide-gray-100 overflow-hidden flex flex-col max-h-[350px] animate-in fade-in zoom-in duration-100">
                      <div className="p-3 bg-gray-50/50 sticky top-0">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input 
                            ref={addStaffSearchRef}
                            type="text"
                            placeholder="Gõ Mã NV, Tên hoặc Đơn vị..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-black font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                            value={staffSearchQuery}
                            onChange={(e) => setStaffSearchQuery(e.target.value)}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto custom-scrollbar flex-1">
                        {loadingStaff ? (
                          <div className="p-10 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500" />
                          </div>
                        ) : filteredStaffInDropdown.length > 0 ? (
                          <div className="divide-y divide-gray-50">
                            {filteredStaffInDropdown.map(s => (
                              <div 
                                key={s.manv} 
                                onClick={() => handleSelectStaffForAdd(s)}
                                className="p-4 hover:bg-indigo-50 cursor-pointer transition-colors group flex items-start gap-3"
                              >
                                <div className="bg-gray-100 p-2 rounded-lg group-hover:bg-indigo-100 flex-shrink-0">
                                  <User className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-black text-gray-900 group-hover:text-indigo-900 truncate">
                                    {s.holot} {s.ten}
                                  </span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] font-bold text-gray-500">Mã NV: {s.manv}</span>
                                    <span className="text-gray-300">|</span>
                                    <span className="text-[11px] font-bold text-blue-600">{s.ten_phongban}</span>
                                  </div>
                                </div>
                                {addForm.manv === s.manv && <UserCheck className="h-4 w-4 ml-auto text-green-600" />}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-10 text-center text-gray-400 italic text-sm">Không tìm thấy nhân sự</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selectedStaffForAdd && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center gap-3 animate-in fade-in duration-200 shadow-inner">
                    <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                      <Building2 className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tight block">Đơn vị công tác</label>
                      <p className="text-sm font-bold text-gray-800">{selectedStaffForAdd.ten_phongban}</p>
                    </div>
                  </div>
                )}
              </section>

              {/* Data Inputs organized as per the provided image layout */}
              <section className="space-y-6">
                <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-4 border-b pb-2">Thông tin HSL</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  
                  {/* Row 1: Loại ngạch bậc and Derived Info */}
                  <div>
                    <label className="text-xs font-bold text-blue-700 mb-1.5 block">Loại ngạch bậc</label>
                    <select 
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                      value={addForm.manangluong || ''}
                      onChange={e => setAddForm({...addForm, manangluong: e.target.value})}
                    >
                      <option value="">-- Chọn Loại ngạch bậc --</option>
                      {hslCatalog.map(cat => (
                        <option key={cat.maso} value={cat.maso}>{cat.loaingachbac}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-blue-400 mb-1.5 block">Chức danh – Trình độ (Thông tin ngạch bậc)</label>
                    <div className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-indigo-600 flex items-center gap-2">
                       <Award className="h-4 w-4" />
                       {selectedRankInfoAdd}
                    </div>
                  </div>

                  {/* Row 2: Salary Coefficient and Effective Date */}
                  <div>
                    <label className="text-xs font-bold text-blue-700 mb-1.5 block">Hệ số lương*</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                      value={addForm.hsl || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setAddForm(prev => ({
                          ...prev,
                          hsl: val,
                          tongheso: calculateTongHeSo(val, prev.hschucvu || 0)
                        }));
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-blue-700 mb-1.5 block">Thời gian hưởng*</label>
                    <input 
                      type="date"
                      required
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                      value={addForm.thoigianbatdau || ''}
                      onChange={e => setAddForm(prev => ({ ...prev, thoigianbatdau: e.target.value }))}
                    />
                  </div>

                  {/* Row 3: Position Coefficient and Total */}
                  <div>
                    <label className="text-xs font-bold text-blue-700 mb-1.5 block">Hệ số chức vụ</label>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Có thể để trống hoặc 0"
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                      value={addForm.hschucvu || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setAddForm(prev => ({
                          ...prev,
                          hschucvu: val,
                          tongheso: calculateTongHeSo(prev.hsl || 0, val)
                        }));
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-blue-500 mb-1.5 block">Tổng hệ số (Tự động tính)</label>
                    <input 
                      type="number"
                      disabled
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-black bg-gray-50 text-red-600 cursor-not-allowed"
                      value={addForm.tongheso || ''}
                    />
                  </div>
                </div>
              </section>

              {modalError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-800 font-bold">{modalError}</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setIsAddModalOpen(false)} 
                className="px-6 py-2 text-gray-500 font-black text-xs hover:text-red-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                disabled={saving} 
                className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-xs"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu hồ sơ mới
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSaveEdit} className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in duration-200 my-8">
            <div className="bg-indigo-700 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-wider flex items-center gap-3">
                <Pencil className="h-6 w-6" /> Hiệu chỉnh Hệ số lương
              </h3>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="h-7 w-7" />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              {/* Part 1: Read-only info */}
              <section className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-6 border-b pb-2">Thông tin nhân sự</h4>
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Photo Frame 3x4 */}
                  <div className="w-[105px] h-[140px] bg-gray-200 rounded-lg border-2 border-white shadow-md overflow-hidden flex items-center justify-center flex-shrink-0 relative group">
                    {editingItem.hinhanh ? (
                      <img 
                        src={getGoogleDriveImageUrl(editingItem.hinhanh)} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent && !parent.querySelector('.error-text')) {
                              const span = document.createElement('span');
                              span.className = 'error-text text-red-400 text-[10px] font-bold text-center p-2';
                              span.innerText = 'Error Image';
                              parent.appendChild(span);
                          }
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-2 text-center">
                        <span className="text-red-400 text-[10px] font-black uppercase leading-tight">Error Image</span>
                      </div>
                    )}
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 flex-1">
                    <div>
                      <p className="text-[10px] font-bold text-red-400 tracking-tighter">Mã NV</p>
                      <p className="text-sm font-black text-indigo-900">{editingItem.manv}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-red-400 tracking-tighter">Họ lót</p>
                      <p className="text-sm font-bold text-blue-800">{editingItem.holot}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-red-400 tracking-tighter">Tên</p>
                      <p className="text-sm font-bold text-blue-800">{editingItem.ten}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-red-400 tracking-tighter">Trình độ</p>
                      <p className="text-sm font-bold text-blue-600 italic">{editingItem.ten_trinhdo}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-red-400 tracking-tighter">Ngày chính thức</p>
                      <p className="text-sm font-bold text-blue-700">{formatDate(editingItem.ngaychinhthuc)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-red-400 tracking-tighter">Chức vụ</p>
                      <p className="text-sm font-bold text-blue-700">{editingItem.ten_chucvu}</p>
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <p className="text-[10px] font-bold text-red-400 tracking-tighter">Đơn vị công tác</p>
                      <p className="text-sm font-bold text-blue-800">{editingItem.ten_phongban}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Part 2: Editable info */}
              <section className="space-y-6">
                <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-4 border-b pb-2">Hiệu chỉnh Thông tin</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {/* Row 1: Grade/Rank and Derived Info */}
                  <div>
                    <label className="text-xs font-bold text-blue-700 mb-1.5 block">Loại ngạch bậc</label>
                    <select 
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                      value={editingItem.manangluong || ''}
                      onChange={e => setEditingItem({...editingItem, manangluong: e.target.value})}
                    >
                      <option value="">-- Chọn Loại ngạch bậc --</option>
                      {hslCatalog.map(cat => (
                        <option key={cat.maso} value={cat.maso}>{cat.loaingachbac}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-blue-400 mb-1.5 block">Chức danh – Trình độ (Thông tin ngạch bậc)</label>
                    <div className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black text-indigo-600 flex items-center gap-2">
                       <Award className="h-4 w-4" />
                       {selectedRankInfoEdit}
                    </div>
                  </div>

                  {/* Row 2: Salary Coefficient and Effective Date */}
                  <div>
                    <label className="text-xs font-bold text-blue-700 mb-1.5 block">Hệ số lương*</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                      value={editingItem.hsl || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditingItem({
                          ...editingItem,
                          hsl: val,
                          tongheso: calculateTongHeSo(val, editingItem.hschucvu)
                        });
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-blue-700 mb-1.5 block">Thời gian hưởng*</label>
                    <input 
                      type="date"
                      required
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                      value={editingItem.thoigianbatdau || ''}
                      onChange={e => setEditingItem({...editingItem, thoigianbatdau: e.target.value})}
                    />
                  </div>

                  {/* Row 3: Position Coefficient and Total */}
                  <div>
                    <label className="text-xs font-bold text-blue-700 mb-1.5 block">Hệ số chức vụ</label>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="Có thể để trống hoặc 0"
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                      value={editingItem.hschucvu || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditingItem({
                          ...editingItem,
                          hschucvu: val,
                          tongheso: calculateTongHeSo(editingItem.hsl, val)
                        });
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-blue-500 mb-1.5 block">Tổng hệ số (Tự động tính)</label>
                    <input 
                      type="number"
                      disabled
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-black bg-gray-50 text-red-600 cursor-not-allowed"
                      value={editingItem.tongheso || ''}
                    />
                  </div>

                  {/* Row 4: Status Fields */}
                  <div>
                    <label className="text-xs font-bold text-blue-700 mb-1.5 block">Diện xét</label>
                    <select 
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                      value={editingItem.dienxet ? 'True' : 'False'}
                      onChange={e => setEditingItem({...editingItem, dienxet: e.target.value === 'True'})}
                    >
                      <option value="True">Có (True)</option>
                      <option value="False">Không (False)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-indigo-700 mb-1.5 block">Hết tham gia</label>
                    <select 
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                      value={editingItem.hetthamgia ? 'True' : 'False'}
                      onChange={e => setEditingItem({...editingItem, hetthamgia: e.target.value === 'True'})}
                    >
                      <option value="True">Đã hết tham gia (True)</option>
                      <option value="False">Đang tham gia (False)</option>
                    </select>
                  </div>

                  {/* Row 5: Long text field */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-blue-700 mb-1.5 block">Lý do không xét</label>
                    <textarea 
                      rows={2}
                      className="w-full p-3 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-black"
                      placeholder="Nhập lý do nếu không xét..."
                      value={editingItem.lydokhongxet || ''}
                      onChange={e => setEditingItem({...editingItem, lydokhongxet: e.target.value})}
                    />
                  </div>
                </div>
              </section>

              {modalError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-800 font-bold">{modalError}</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setIsEditModalOpen(false)} 
                className="px-6 py-2 text-gray-500 font-black text-xs hover:text-red-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                disabled={saving} 
                className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-xs"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu hồ sơ
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left">
         <p className="text-[10px] text-red-400 font-bold tracking-widest italic">
            Hệ thống DAU HR Management | © Quản lý Nhân sự
        </p>
      </div>

      {/* Alert Modal */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border ${alertType === 'error' ? 'border-red-100' : 'border-green-100'}`}>
             <div className={`${alertType === 'error' ? 'bg-red-600' : 'bg-green-600'} p-5 text-white flex items-center gap-3`}>
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">Thông báo hệ thống</h3>
             </div>
             <div className="p-8 text-center">
                <p className="text-gray-700 font-medium leading-relaxed">
                  {alertMessage}
                </p>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                <button 
                  onClick={() => setIsAlertModalOpen(false)} 
                  className={`px-8 py-2 ${alertType === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm`}
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
