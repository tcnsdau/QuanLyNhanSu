import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { DanhSachCaNhanHTNV, NhanVien, MucDoHTNV, NamHoc, TrinhDo, ChucVu, RolePermission } from '../types';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { Search, FileDown, FileUp, UserCheck, Loader2, Filter, ChevronDown, RefreshCw, AlertCircle, Pencil, Trash2, X, Save, Plus, User, Building2, MoreHorizontal } from 'lucide-react';
import * as XLSX from 'xlsx';

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

const fetchAllRecords = async (tableName: string) => {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Lỗi khi truy vấn bảng ${tableName}: ${error.message}`);
    } else if (data && data.length > 0) {
      allData = allData.concat(data);
      from += PAGE_SIZE;
      // Nếu số lượng bản ghi trả về bằng đúng PAGE_SIZE thì có khả năng vẫn còn dữ liệu
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return allData;
};

export const DanhSachCaNhanHTNVManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<DanhSachCaNhanHTNV[]>([]);
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [mucDoOptions, setMucDoOptions] = useState<MucDoHTNV[]>([]);
  const [namHocOptions, setNamHocOptions] = useState<NamHoc[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);

  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  // Permission checks
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'htnv-ca-nhan', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'htnv-ca-nhan', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'htnv-ca-nhan', 'DELETE'), [permissions, isAdmin]);

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
        setAlertModal({ isOpen: true, message: 'Lỗi tải quyền hạn Mức độ HTNV Cá nhân: ' + (err.message || err) });
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);
  
  // States cho modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DanhSachCaNhanHTNV | null>(null);
  
  // State cho Form thông báo thay thế alert
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: '' });

  // State cho Form xác nhận xóa
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean, id: number | null, name: string, year: string }>({
    isOpen: false,
    id: null,
    name: '',
    year: ''
  });

  // Form Thêm mới
  const [addForm, setAddForm] = useState({
    manv: '',
    trinhdo: '',
    chucvu: '',
    donvi: '',
    mucdohtnv: '',
    namhoc: ''
  });
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const staffDropdownRef = useRef<HTMLDivElement>(null);
  const staffSearchRef = useRef<HTMLInputElement>(null);

  // Form Hiệu chỉnh
  const [editForm, setEditForm] = useState({
    mucdohtnv: '',
    namhoc: ''
  });
  
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState({
    trinhdo: '',
    chucvu: '',
    donvi: '',
    mucdohtnv: '',
    namhoc: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rawHTNV, rawNV, rawMucDo, rawNamHoc, rawPB, rawTD, rawCV] = await Promise.all([
        fetchAllRecords('DanhSachCaNhanHTNV'),
        fetchAllRecords('DanhSachNhanVien'),
        fetchAllRecords('DanhMucMucDoHTNV'),
        fetchAllRecords('DanhMucNamHoc'),
        fetchAllRecords('DanhMucPhongBan'),
        fetchAllRecords('DanhMucTrinhDo'),
        fetchAllRecords('DanhMucChucVu')
      ]);

      const normalizedNV = rawNV.map(item => normalizeKeys(item));
      const normalizedHTNV = rawHTNV.map(item => normalizeKeys(item));
      const normalizedPB = rawPB.map(item => normalizeKeys(item));
      const normalizedTD = rawTD.map(item => normalizeKeys(item)) as TrinhDo[];
      const normalizedCV = rawCV.map(item => normalizeKeys(item)) as ChucVu[];
      
      setMucDoOptions(rawMucDo.map(item => normalizeKeys(item)));
      
      const sortedNamHoc = rawNamHoc
        .map(item => normalizeKeys(item))
        .sort((a, b) => String(b.manamhoc).localeCompare(String(a.manamhoc), undefined, { numeric: true }));
      setNamHocOptions(sortedNamHoc);

      const activeStaff = normalizedNV
        .filter(nv => nv.danghiviec === false || nv.danghiviec === 'false' || nv.danghiviec === 0)
        .map(nv => {
          const pb = normalizedPB.find(p => p.maphongban === nv.phongban);
          const td = normalizedTD.find(t => String(t.matrinhdo) === String(nv.trinhdo));
          const cv = normalizedCV.find(c => String(c.machucvu) === String(nv.chucvu));
          
          return {
            ...nv,
            ten_phongban: pb ? pb.giatri : nv.phongban,
            ten_trinhdo: td ? td.giatri : nv.trinhdo,
            ten_chucvu: cv ? cv.giatri : nv.chucvu
          };
        });
      setAllStaff(activeStaff);

      const activeEmployeeMap = new Map();
      activeStaff.forEach(nv => {
        activeEmployeeMap.set(String(nv.manv), nv);
      });

      const joinedData: DanhSachCaNhanHTNV[] = normalizedHTNV
        .filter(ht => activeEmployeeMap.has(String(ht.manv)))
        .map(ht => {
          const nvInfo = activeEmployeeMap.get(String(ht.manv));
          return {
            ...ht,
            holot: nvInfo?.holot || '',
            ten: nvInfo?.ten || '',
            danghiviec: false
          };
        });

      joinedData.sort((a, b) => (a.ten || '').localeCompare(b.ten || ''));
      setDataList(joinedData);
      
    } catch (err: any) {
      setAlertModal({ isOpen: true, message: "Không thể tải dữ liệu: " + err.message });
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

  // --- Logic Thêm mới ---
  const handleOpenAdd = () => {
    setAddForm({ manv: '', trinhdo: '', chucvu: '', donvi: '', mucdohtnv: '', namhoc: '' });
    setSelectedStaff(null);
    setStaffSearchQuery('');
    setIsAddModalOpen(true);
  };

  const handleSelectStaffForAdd = (staff: any) => {
    setSelectedStaff(staff);
    setAddForm({
      ...addForm,
      manv: staff.manv,
      trinhdo: staff.ten_trinhdo, 
      chucvu: staff.ten_chucvu,   
      donvi: staff.ten_phongban
    });
    setIsStaffDropdownOpen(false);
  };

  const handleSaveAdd = async () => {
    if (!addForm.manv || !addForm.mucdohtnv || !addForm.namhoc) {
      setAlertModal({ isOpen: true, message: "Vui lòng chọn nhân sự, mức độ đánh giá và năm học." });
      return;
    }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('DanhSachCaNhanHTNV')
        .select('*')
        .eq('manv', addForm.manv)
        .eq('namhoc', addForm.namhoc);

      if (existing && existing.length > 0) {
        const item = normalizeKeys(existing[0]);
        setAlertModal({ 
          isOpen: true, 
          message: `Nhân sự này đã được đánh giá mức độ HTNV là ${item.mucdohtnv} ở năm học ${item.namhoc} !` 
        });
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('DanhSachCaNhanHTNV').insert([addForm]);
      if (error) throw error;

      setIsAddModalOpen(false);
      fetchData();
    } catch (err: any) {
      setAlertModal({ isOpen: true, message: "Lỗi khi lưu: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  // --- Logic Hiệu chỉnh ---
  const handleOpenEdit = (item: DanhSachCaNhanHTNV) => {
    setEditingItem(item);
    setEditForm({ mucdohtnv: item.mucdohtnv || '', namhoc: item.namhoc || '' });
    setIsEditModalOpen(true);
  };

  const handleSaveUpdate = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('DanhSachCaNhanHTNV')
        .select('*')
        .eq('manv', editingItem.manv)
        .eq('namhoc', editForm.namhoc)
        .neq('id', editingItem.id);

      if (existing && existing.length > 0) {
        const item = normalizeKeys(existing[0]);
        setAlertModal({ 
          isOpen: true, 
          message: `Nhân sự này đã được đánh giá mức độ HTNV là ${item.mucdohtnv} ở năm học ${item.namhoc} !` 
        });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('DanhSachCaNhanHTNV')
        .update({ mucdohtnv: editForm.mucdohtnv, namhoc: editForm.namhoc })
        .eq('id', editingItem.id);

      if (error) throw error;
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      setAlertModal({ isOpen: true, message: "Lỗi: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  // --- Logic Xóa ---
  const handleDelete = (id: number, name: string, year: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      id,
      name,
      year
    });
  };

  const executeDelete = async () => {
    if (!deleteConfirmModal.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('DanhSachCaNhanHTNV').delete().eq('id', deleteConfirmModal.id);
      if (error) throw error;
      setDeleteConfirmModal({ isOpen: false, id: null, name: '', year: '' });
      fetchData();
    } catch (err: any) {
      setAlertModal({ isOpen: true, message: "Lỗi: " + err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          setAlertModal({ isOpen: true, message: "File Excel không có dữ liệu." });
          return;
        }

        setSaving(true);
        const imports = data.map(item => normalizeKeys(item));
        const { error } = await supabase.from('DanhSachCaNhanHTNV').insert(imports);
        if (error) throw error;

        fetchData();
      } catch (err: any) {
        setAlertModal({ isOpen: true, message: "Lỗi khi import: " + err.message });
      } finally {
        setSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- Logic hiển thị ---
  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      const search = searchTerm.toLowerCase();
      const fullName = `${item.holot} ${item.ten}`.toLowerCase();
      const matchesSearch = fullName.includes(search) || String(item.manv).toLowerCase().includes(search);
      
      if (!matchesSearch) return false;
      if (filters.trinhdo && item.trinhdo !== filters.trinhdo) return false;
      if (filters.chucvu && item.chucvu !== filters.chucvu) return false;
      if (filters.donvi && item.donvi !== filters.donvi) return false;
      if (filters.mucdohtnv && item.mucdohtnv !== filters.mucdohtnv) return false;
      if (filters.namhoc && item.namhoc !== filters.namhoc) return false;

      return true;
    });
  }, [dataList, searchTerm, filters]);

  const filteredStaffDropdown = useMemo(() => {
    if (!staffSearchQuery.trim()) return allStaff.slice(0, 50);
    const s = staffSearchQuery.toLowerCase();
    return allStaff.filter(st => 
      String(st.manv).toLowerCase().includes(s) || 
      st.ten_phongban.toLowerCase().includes(s) ||
      `${st.holot} ${st.ten}`.toLowerCase().includes(s)
    ).slice(0, 50);
  }, [allStaff, staffSearchQuery]);

  const getUniqueValues = (key: keyof DanhSachCaNhanHTNV) => {
    const values = dataList.map(item => String(item[key] || ''));
    const unique = Array.from(new Set(values)).filter(v => v !== '' && v !== 'undefined');
    if (key === 'namhoc') {
      // Fix: Cast unique to string[] to resolve localeCompare on unknown type error
      return (unique as string[]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    }
    return unique.sort();
  };

  const getHTNVBadgeStyle = (mucdo: string) => {
    const s = String(mucdo || '');
    if (s.includes('Xuất sắc')) return 'bg-red-50 text-red-600 border-red-100';
    if (s.includes('Tốt')) return 'bg-blue-50 text-blue-600 border-blue-100';
    if (s === 'Hoàn thành nhiệm vụ') return 'bg-green-50 text-green-600 border-green-100';
    return 'bg-gray-50 text-black border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-blue-600 gap-4">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="font-bold text-sm tracking-widest ">Đang đồng bộ dữ liệu đánh giá...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-100">
                <UserCheck className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Danh sách đánh giá mức độ HTNV cá nhân</h2>
            </div>
            
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Tìm theo mã hoặc tên nhân sự..."
                // className="pl-9 w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50/50"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto self-end">
            {canCreate && (
              <>
                <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 border border-indigo-200 transition-all text-sm whitespace-nowrap"
                >
                  <FileUp className="h-4 w-4" /> Import danh sách
                </button>
              </>
            )}
            <button 
              onClick={() => {
                const exportData = filteredData.map((item, index) => ({
                  'STT': index + 1,
                  'Mã nhân viên': item.manv,
                  'Họ và tên': `${item.holot} ${item.ten}`,
                  'Trình độ': item.trinhdo,
                  'Chức vụ': item.chucvu,
                  'Đơn vị': item.donvi,
                  'Mức độ HTNV': item.mucdohtnv,
                  'Năm học': item.namhoc
                }));
                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "DanhSachHTNV");
                XLSX.writeFile(wb, "Danh_sach_HTNV_Ca_nhan.xlsx");
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md transition-all text-sm whitespace-nowrap"
            >
              <FileDown className="h-4 w-4" /> Xuất Excel
            </button>
            {canCreate && (
              <button 
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg transition-all active:scale-95 text-sm whitespace-nowrap"
              >
                <Plus className="h-4 w-4" /> Thêm mới
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center w-12">STT</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600">Họ và tên</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600">Trình độ</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600">Chức vụ</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 whitespace-nowrap">Đơn vị</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">Mức độ HTNV</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center w-32">Năm học</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">Thao tác</th>
              </tr>
              <tr className="bg-white/50 border-b border-gray-100">
                <th className="px-2 py-2"></th>
                <th className="px-2 py-2"><div className="text-[10px] text-gray-400 font-medium pl-2 italic">Lọc dữ liệu:</div></th>
                <th className="px-2 py-2">
                  <select value={filters.trinhdo} onChange={e => setFilters({...filters, trinhdo: e.target.value})} className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-blue-600 font-bold outline-none text-left appearance-none">
                    <option value="">Tất cả</option>
                    {getUniqueValues('trinhdo').map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2">
                  <select value={filters.chucvu} onChange={e => setFilters({...filters, chucvu: e.target.value})} className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-blue-600 font-bold outline-none text-left appearance-none">
                    <option value="">Tất cả</option>
                    {getUniqueValues('chucvu').map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2">
                  <select value={filters.donvi} onChange={e => setFilters({...filters, donvi: e.target.value})} className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-blue-600 font-bold outline-none text-left appearance-none">
                    <option value="">Tất cả</option>
                    {getUniqueValues('donvi').map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2">
                  <select value={filters.mucdohtnv} onChange={e => setFilters({...filters, mucdohtnv: e.target.value})} className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-red-600 font-bold outline-none text-center appearance-none">
                    <option value="">Tất cả</option>
                    {getUniqueValues('mucdohtnv').map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2">
                  <select value={filters.namhoc} onChange={e => setFilters({...filters, namhoc: e.target.value})} className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 font-bold outline-none text-center appearance-none">
                    <option value="">Tất cả</option>
                    {getUniqueValues('namhoc').map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy kết quả phù hợp.</td></tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.id || index} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-4 text-sm text-gray-400 text-center font-bold">{index + 1}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800">{item.holot} {item.ten}</span>
                        <span className="text-[10px] font-bold text-blue-500">Mã NV: {item.manv}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-gray-600">{item.trinhdo}</td>
                    <td className="px-4 py-4 text-sm text-gray-600 font-medium">{item.chucvu}</td>
                    <td className="px-4 py-4 text-sm text-blue-700 font-medium whitespace-nowrap">{item.donvi}</td>
                    <td className="px-4 py-4 text-center">
                       <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${getHTNVBadgeStyle(item.mucdohtnv)}`}>
                         {item.mucdohtnv}
                       </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-center text-gray-800 font-bold">{item.namhoc}</td>
                    <td className="px-4 py-4 text-center">
                       <div className="flex items-center justify-center gap-2">
                          {canUpdate && (
                            <button onClick={() => handleOpenEdit(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg border border-transparent hover:border-blue-200" title="Hiệu chỉnh"><Pencil className="w-4 h-4" /></button>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(item.id, `${item.holot} ${item.ten}`, item.namhoc)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg border border-transparent hover:border-red-200" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                          )}
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-100">
          <p className="text-[10px] text-gray-500 font-bold tracking-widest">Hiển thị: <span className="text-blue-600 text-xs">{filteredData.length}</span> bản ghi</p>
          <button onClick={fetchData} className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 hover:text-blue-700 tracking-tighter"><RefreshCw className="h-3 w-3" /> Làm mới dữ liệu</button>
        </div>
      </div>

      {/* Modal Thêm mới */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
             <div className="bg-blue-700 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Plus className="w-6 h-6" />
                  <h3 className="text-xl font-bold">Thêm mới hồ sơ cá nhân đánh giá mức độ HTNV</h3>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X className="w-7 h-7" /></button>
             </div>

             <div className="p-8 space-y-8">
                <section>
                   <label className="text-xs font-bold text-red-600 mb-2 block">Mã nhân viên (tìm và chọn) *</label>
                   <div className="relative" ref={staffDropdownRef}>
                      <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 bg-white">
                        <input 
                          readOnly
                          //className="block w-full border-none px-4 py-3 text-sm font-bold text-black focus:ring-0 cursor-pointer" 
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-red-900"
                          placeholder={selectedStaff ? `${selectedStaff.holot} ${selectedStaff.ten} (${selectedStaff.manv})` : "Click để chọn nhân sự..."}
                          onClick={() => {
                            setIsStaffDropdownOpen(true);
                            setTimeout(() => staffSearchRef.current?.focus(), 50);
                          }}
                        />
                        <div className="bg-gray-100 flex items-center px-4 border-l border-gray-200"><MoreHorizontal className="h-5 w-5 text-gray-500" /></div>
                      </div>

                      {isStaffDropdownOpen && (
                        <div className="absolute z-[110] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-60">
                           <div className="p-2 border-b border-gray-100 bg-gray-50">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input 
                                  ref={staffSearchRef}
                                  type="text" 
                                  placeholder="Tìm mã, tên hoặc đơn vị..."
                                  className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                  value={staffSearchQuery}
                                  onChange={e => setStaffSearchQuery(e.target.value)}
                                />
                              </div>
                           </div>
                           <div className="overflow-y-auto">
                              {filteredStaffDropdown.map(st => (
                                <div key={st.manv} onClick={() => handleSelectStaffForAdd(st)} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center">
                                   <div>
                                      <p className="text-sm font-bold text-gray-900">{st.holot} {st.ten}</p>
                                      <p className="text-[10px] text-gray-500">Mã NV: {st.manv}</p>
                                   </div>
                                   <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{st.ten_phongban}</span>
                                </div>
                              ))}
                           </div>
                        </div>
                      )}
                   </div>
                </section>

                {selectedStaff && (
                  <section className="animate-in fade-in slide-in-from-top-2">
                     <div className="grid grid-cols-2 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-inner">
                        <div>
                          <label className="text-[10px] font-bold text-red-600 mb-0.5 block">Họ và tên</label>
                          <p className="text-sm font-bold text-blue-900">{selectedStaff.holot} {selectedStaff.ten}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-red-600 mb-0.5 block">Trình độ</label>
                          <p className="text-sm font-bold text-gray-800">{addForm.trinhdo}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-red-600 mb-0.5 block">Chức vụ</label>
                          <p className="text-sm font-bold text-gray-800">{addForm.chucvu}</p>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-red-600 mb-0.5 block">Tên phòng ban</label>
                          <p className="text-sm font-bold text-blue-800">{addForm.donvi}</p>
                        </div>
                     </div>
                  </section>
                )}

                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-red-600 mb-1.5 block">Mức độ HTNV *</label>
                    <select 
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={addForm.mucdohtnv}
                      onChange={e => setAddForm({...addForm, mucdohtnv: e.target.value})}
                    >
                       <option value="">-- Chọn mức độ --</option>
                       {mucDoOptions.map(opt => <option key={opt.mamucdohtnv} value={opt.mucdohtnv}>{opt.mucdohtnv}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-red-600 mb-1.5 block">Năm học *</label>
                    <select 
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={addForm.namhoc}
                      onChange={e => setAddForm({...addForm, namhoc: e.target.value})}
                    >
                       <option value="">-- Chọn năm học --</option>
                       {namHocOptions.map(opt => <option key={opt.id} value={opt.giatri}>{opt.giatri}</option>)}
                    </select>
                  </div>
                </section>
             </div>

             <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-2 text-gray-700 font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">Đóng hồ sơ</button>
                <button 
                  disabled={saving || !addForm.manv}
                  onClick={handleSaveAdd}
                  className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-300"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu hồ sơ
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Modal Hiệu chỉnh */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
             <div className="bg-blue-800 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Pencil className="w-6 h-6 text-blue-200" />
                  <h3 className="text-xl font-bold">Hiệu chỉnh đánh giá mức độ HTNV cá nhân</h3>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X className="h-7 w-7" /></button>
             </div>

             <div className="p-8 space-y-8">
                <section>
                   <h5 className="flex items-center text-xs font-bold text-red-600 tracking-widest mb-4 border-l-4 border-blue-600 pl-3">Thông tin cá nhân</h5>
                   <div className="grid grid-cols-2 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-inner">
                      <div><label className="text-[10px] font-bold text-red-600 mb-0.5 block">Họ và tên</label><p className="text-sm font-bold text-blue-900">{editingItem.holot} {editingItem.ten}</p></div>
                      <div><label className="text-[10px] font-bold text-red-600 mb-0.5 block">Mã nhân sự</label><p className="text-sm font-bold text-red-600">{editingItem.manv}</p></div>
                      <div><label className="text-[10px] font-bold text-red-600 mb-0.5 block">Trình độ</label><p className="text-sm font-bold text-gray-800">{editingItem.trinhdo}</p></div>
                      <div><label className="text-[10px] font-bold text-red-600 mb-0.5 block">Chức vụ</label><p className="text-sm font-bold text-gray-800">{editingItem.chucvu}</p></div>
                      <div className="col-span-2"><label className="text-[10px] font-bold text-red-600 mb-0.5 block">Đơn vị công tác</label><p className="text-sm font-bold text-blue-800">{editingItem.donvi}</p></div>
                   </div>
                </section>

                <section>
                   <h5 className="flex items-center text-xs font-bold text-blue-700 tracking-widest mb-4 border-l-4 border-blue-600 pl-3">Thông tin hiệu chỉnh</h5>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[11px] font-bold text-red-600 mb-1.5 block">Mức độ HTNV *</label>
                        <select className="w-full p-2.5 bg-white border border-gray-300 rounded-xl font-bold text-blue-600" value={editForm.mucdohtnv} onChange={e => setEditForm({...editForm, mucdohtnv: e.target.value})}>
                           <option value="">-- Chọn mức độ --</option>
                           {mucDoOptions.map(opt => <option key={opt.mamucdohtnv} value={opt.mucdohtnv}>{opt.mucdohtnv}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-red-600 mb-1.5 block">Năm học *</label>
                        <select className="w-full p-2.5 bg-white border border-gray-300 rounded-xl font-bold text-gray-800" value={editForm.namhoc} onChange={e => setEditForm({...editForm, namhoc: e.target.value})}>
                           <option value="">-- Chọn năm học --</option>
                           {namHocOptions.map(opt => <option key={opt.id} value={opt.giatri}>{opt.giatri}</option>)}
                        </select>
                      </div>
                   </div>
                </section>
             </div>

             <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                <button onClick={() => setIsEditModalOpen(false)} className="px-6 py-2 text-gray-700 font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors">Đóng hồ sơ</button>
                <button 
                  disabled={saving || (editForm.mucdohtnv === editingItem.mucdohtnv && editForm.namhoc === editingItem.namhoc)}
                  onClick={handleSaveUpdate}
                  className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-300"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu thay đổi
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Form thông báo xác nhận xóa */}
      {deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
             <div className="bg-red-600 p-5 text-white flex items-center gap-3">
                <Trash2 className="w-6 h-6" />
                <h3 className="text-lg font-bold">Xác nhận xóa hồ sơ</h3>
             </div>
             <div className="p-8 text-center">
                <p className="text-gray-700 font-medium leading-relaxed">
                  Bạn có chắc chắn muốn xóa hồ sơ của <span className="text-red-600 font-bold">{deleteConfirmModal.name}</span> ở năm học <span className="text-blue-600 font-bold">{deleteConfirmModal.year}</span>?
                </p>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center gap-3">
                <button 
                  onClick={() => setDeleteConfirmModal({ isOpen: false, id: null, name: '', year: '' })}
                  className="px-6 py-2 bg-white text-gray-700 font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-all active:scale-95 text-sm"
                >
                  Hủy bỏ
                </button>
                <button 
                  disabled={saving}
                  onClick={executeDelete}
                  className="px-8 py-2 bg-red-600 text-white font-bold rounded-xl shadow-md hover:bg-red-700 transition-all active:scale-95 text-sm flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Đồng ý
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Form thông báo thay thế alert */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
             <div className="bg-red-600 p-5 text-white flex items-center gap-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">Thông báo hệ thống</h3>
             </div>
             <div className="p-8 text-center">
                <p className="text-gray-700 font-medium leading-relaxed">{alertModal.message}</p>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                <button 
                  onClick={() => setAlertModal({ isOpen: false, message: '' })}
                  className="px-8 py-2 bg-red-600 text-white font-bold rounded-xl shadow-md hover:bg-red-700 transition-all active:scale-95"
                >
                  Đóng thông báo
                </button>
             </div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <p className="text-[10px] text-red-400 font-bold tracking-widest italic">Hệ thống DAU HR Management | © Quản lý Nhân sự</p>
      </div>
    </div>
  );
};
