import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { DanhSachTapTheHTNV, MucDoHTNV, NamHoc, PhongBan, ToBoMon, RolePermission } from '../types';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { Search, FileDown, FileUp, Users, Loader2, RefreshCw, AlertCircle, Pencil, Trash2, X, Save, Plus, Building2, CheckCircle2, MoreHorizontal } from 'lucide-react';
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
      // Nếu số lượng bản ghi trả về ít hơn PAGE_SIZE tức là đã hết dữ liệu
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return allData;
};

export const DanhSachTapTheHTNVManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<DanhSachTapTheHTNV[]>([]);
  const [mucDoOptions, setMucDoOptions] = useState<MucDoHTNV[]>([]);
  const [namHocOptions, setNamHocOptions] = useState<NamHoc[]>([]);
  const [phongBanOptions, setPhongBanOptions] = useState<PhongBan[]>([]);
  const [toBoMonOptions, setToBoMonOptions] = useState<ToBoMon[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);

  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  // Permission checks
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'htnv-tap-the', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'htnv-tap-the', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'htnv-tap-the', 'DELETE'), [permissions, isAdmin]);

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
        showAlert('Lỗi tải quyền hạn Mức độ HTNV Tập thể: ' + (err.message || String(err)));
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);
  
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  
  // Searchable Unit Dropdown state
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const unitDropdownRef = useRef<HTMLDivElement>(null);
  const unitSearchRef = useRef<HTMLInputElement>(null);

  // State cho Form xác nhận xóa
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, id: number | null, name: string, year: string }>({
    isOpen: false,
    id: null,
    name: '',
    year: ''
  });
  
  const [editingItem, setEditingItem] = useState<DanhSachTapTheHTNV | null>(null);
  const [editForm, setEditForm] = useState({ mucdohtnv: '', namhoc: '' });
  const [addForm, setAddForm] = useState({ tendonvi: '', mucdohtnv: '', namhoc: '' });
  
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters state
  const [filters, setFilters] = useState({
    tendonvi: '',
    namhoc: '',
    mucdohtnv: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rawTapThe, rawMucDo, rawNamHoc, rawPhongBan, rawToBoMon] = await Promise.all([
        fetchAllRecords('DanhSachTapTheHTNV'),
        fetchAllRecords('DanhMucMucDoHTNV'),
        fetchAllRecords('DanhMucNamHoc'),
        fetchAllRecords('DanhMucPhongBan'),
        fetchAllRecords('DanhMucToBoMon')
      ]);

      setDataList(rawTapThe.map(item => normalizeKeys(item)));
      setMucDoOptions(rawMucDo.map(item => normalizeKeys(item)));
      setPhongBanOptions(rawPhongBan.map(item => normalizeKeys(item)));
      setToBoMonOptions(rawToBoMon.map(item => normalizeKeys(item)));
      
      // Sắp xếp năm học giảm dần theo manamhoc
      const sortedNamHoc = rawNamHoc
        .map(item => normalizeKeys(item))
        .sort((a, b) => String(b.manamhoc).localeCompare(String(a.manamhoc), undefined, { numeric: true }));
      setNamHocOptions(sortedNamHoc);
      
    } catch (err: any) {
      showAlert("Lỗi tải dữ liệu: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Unified Unique Units List
  const unifiedUnitsList = useMemo(() => {
    const pbNames = phongBanOptions.map(pb => pb.giatri);
    const bmNames = toBoMonOptions.map(bm => bm.giatri);
    const combined = Array.from(new Set([...pbNames, ...bmNames]))
      .filter(name => name && name.trim() !== '')
      .sort((a, b) => a.localeCompare(b));
    return combined;
  }, [phongBanOptions, toBoMonOptions]);

  const filteredUnitsForDropdown = useMemo(() => {
    if (!unitSearchQuery.trim()) return unifiedUnitsList;
    const query = unitSearchQuery.toLowerCase();
    return unifiedUnitsList.filter(u => u.toLowerCase().includes(query));
  }, [unifiedUnitsList, unitSearchQuery]);

  useEffect(() => {
    fetchData();
    const handleClickOutside = (event: MouseEvent) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target as Node)) {
        setIsUnitDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };

  // --- Actions ---
  const handleOpenAdd = () => {
    setAddForm({ tendonvi: '', mucdohtnv: '', namhoc: namHocOptions.find(n => n.macdinh)?.giatri || '' });
    setUnitSearchQuery('');
    setIsUnitDropdownOpen(false);
    setIsAddModalOpen(true);
  };

  const handleSaveAdd = async () => {
    if (!addForm.tendonvi || !addForm.mucdohtnv || !addForm.namhoc) {
      showAlert("Vui lòng chọn đầy đủ thông tin đơn vị, mức độ và năm học.");
      return;
    }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('DanhSachTapTheHTNV')
        .select('*')
        .eq('tendonvi', addForm.tendonvi)
        .eq('namhoc', addForm.namhoc);

      if (existing && existing.length > 0) {
        const item = normalizeKeys(existing[0]);
        showAlert(`Tập thể này đã được đánh giá mức độ HTNV là ${item.mucdohtnv} ở năm học ${item.namhoc} !`);
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('DanhSachTapTheHTNV').insert([addForm]);
      if (error) throw error;

      setIsAddModalOpen(false);
      fetchData();
    } catch (err: any) {
      showAlert("Lỗi khi thêm mới: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (item: DanhSachTapTheHTNV) => {
    setEditingItem(item);
    setEditForm({ mucdohtnv: item.mucdohtnv || '', namhoc: item.namhoc || '' });
    setIsEditModalOpen(true);
  };

  const handleSaveUpdate = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('DanhSachTapTheHTNV')
        .select('*')
        .eq('tendonvi', editingItem.tendonvi)
        .eq('namhoc', editForm.namhoc)
        .neq('id', editingItem.id);

      if (existing && existing.length > 0) {
        const item = normalizeKeys(existing[0]);
        showAlert(`Tập thể này đã được đánh giá mức độ HTNV là ${item.mucdohtnv} ở năm học ${item.namhoc} !`);
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('DanhSachTapTheHTNV')
        .update({ mucdohtnv: editForm.mucdohtnv, namhoc: editForm.namhoc })
        .eq('id', editingItem.id);

      if (error) throw error;
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      showAlert("Lỗi: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number, name: string, year: string) => {
    setConfirmModal({
      isOpen: true,
      id,
      name,
      year
    });
  };

  const executeDelete = async () => {
    if (!confirmModal.id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from('DanhSachTapTheHTNV').delete().eq('id', confirmModal.id);
      if (error) throw error;
      
      setConfirmModal({ isOpen: false, id: null, name: '', year: '' });
      fetchData();
    } catch (err: any) {
      showAlert("Lỗi: " + err.message);
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
          showAlert("File Excel không có dữ liệu.");
          return;
        }

        setSaving(true);
        const imports = data.map(item => normalizeKeys(item));
        const { error } = await supabase.from('DanhSachTapTheHTNV').insert(imports);
        if (error) throw error;

        showAlert(`Đã import thành công ${imports.length} bản ghi!`);
        fetchData();
      } catch (err: any) {
        showAlert("Lỗi khi import: " + err.message);
      } finally {
        setSaving(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- Helpers ---
  const getUniqueValues = (key: keyof DanhSachTapTheHTNV) => {
    const values = dataList.map(item => String(item[key] || ''));
    const unique = Array.from(new Set(values)).filter(v => v !== '' && v !== 'undefined');
    if (key === 'namhoc') {
      // Fix: Cast unique to string[] to resolve localeCompare on unknown type error
      return (unique as string[]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    }
    return unique.sort();
  };

  const getHTNVColor = (mucdo: string) => {
    const s = String(mucdo || '').toLowerCase();
    if (s.includes('xuất sắc')) return 'text-red-600 font-bold';
    if (s.includes('tốt')) return 'text-blue-600 font-bold';
    if (s === 'hoàn thành nhiệm vụ') return 'text-green-600 font-bold';
    return 'text-black font-medium';
  };

  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (item.tendonvi || '').toLowerCase().includes(search);
      
      if (!matchesSearch) return false;
      if (filters.tendonvi && item.tendonvi !== filters.tendonvi) return false;
      if (filters.namhoc && item.namhoc !== filters.namhoc) return false;
      if (filters.mucdohtnv && item.mucdohtnv !== filters.mucdohtnv) return false;

      return true;
    });
  }, [dataList, searchTerm, filters]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-blue-600 gap-4">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="font-bold text-sm tracking-widest ">Đang đồng bộ dữ liệu đánh giá tập thể...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-100">
                <Users className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Danh sách đánh giá mức độ HTNV tập thể</h2>
            </div>
            
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Tìm nhanh theo Tên đơn vị..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-red-900"
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
                  'Tên đơn vị': item.tendonvi,
                  'Năm học': item.namhoc,
                  'Mức độ HTNV': item.mucdohtnv
                }));
                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "DanhSachTapThe");
                XLSX.writeFile(wb, "Danh_sach_HTNV_Tap_the.xlsx");
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
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-16">STT</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600">Tên đơn vị</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-40">Năm học</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center">Mức độ HTNV</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-32">Thao tác</th>
              </tr>
              <tr className="bg-white/50 border-b border-gray-100">
                <th className="px-2 py-2"></th>
                <th className="px-4 py-2">
                  <select value={filters.tendonvi} onChange={e => setFilters({...filters, tendonvi: e.target.value})} className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-blue-600 font-bold outline-none appearance-none">
                    <option value="">Tất cả đơn vị</option>
                    {getUniqueValues('tendonvi').map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </th>
                <th className="px-4 py-2 text-center">
                  <select value={filters.namhoc} onChange={e => setFilters({...filters, namhoc: e.target.value})} className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 font-bold outline-none text-center appearance-none">
                    <option value="">Tất cả</option>
                    {getUniqueValues('namhoc').map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </th>
                <th className="px-4 py-2">
                  <select value={filters.mucdohtnv} onChange={e => setFilters({...filters, mucdohtnv: e.target.value})} className="w-full text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-red-600 font-bold outline-none text-center appearance-none">
                    <option value="">Tất cả mức độ</option>
                    {getUniqueValues('mucdohtnv').map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy dữ liệu phù hợp.</td></tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-400 text-center font-bold">{index + 1}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{item.tendonvi}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600 font-medium">{item.namhoc}</td>
                    <td className={`px-6 py-4 text-sm text-center ${getHTNVColor(item.mucdohtnv)}`}>
                      {item.mucdohtnv}
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex items-center justify-center gap-2">
                          {canUpdate && (
                            <button onClick={() => handleOpenEdit(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg border border-transparent hover:border-blue-200" title="Hiệu chỉnh"><Pencil className="w-4 h-4" /></button>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(item.id, item.tendonvi, item.namhoc)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg border border-transparent hover:border-red-200" title="Xóa"><Trash2 className="w-4 h-4" /></button>
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
          <p className="text-[10px] text-gray-500 font-bold tracking-widest">Đang hiển thị: <span className="text-blue-600 text-xs">{filteredData.length}</span> bản ghi</p>
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
                  <h3 className="text-xl font-bold">Hồ sơ đánh giá</h3>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X className="w-7 h-7" /></button>
             </div>

             <div className="p-8 space-y-6">
                <div className="relative" ref={unitDropdownRef}>
                  <label className="text-xs font-bold text-red-600 mb-1.5 block">Chọn Tập thể *</label>
                  <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 bg-white">
                    <input 
                      readOnly
                      // className="block w-full border-none px-4 py-3 text-sm font-bold text-black focus:ring-0 cursor-pointer" 
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-red-900"
                      placeholder={addForm.tendonvi || "Click để chọn hoặc tìm Tên tập thể..."}
                      onClick={() => {
                        setIsUnitDropdownOpen(true);
                        setTimeout(() => unitSearchRef.current?.focus(), 50);
                      }}
                    />
                    <div className="bg-gray-100 flex items-center px-4 border-l border-gray-200"><MoreHorizontal className="h-5 w-5 text-gray-500" /></div>
                  </div>
                  
                  {isUnitDropdownOpen && (
                    <div className="absolute z-[110] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-60">
                       <div className="p-2 border-b border-gray-100 bg-gray-50">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input 
                              ref={unitSearchRef}
                              type="text" 
                              placeholder="Tìm tên đơn vị..."
                              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                              value={unitSearchQuery}
                              onChange={e => setUnitSearchQuery(e.target.value)}
                            />
                          </div>
                       </div>
                       <div className="overflow-y-auto">
                          {filteredUnitsForDropdown.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 italic text-xs">Không tìm thấy đơn vị phù hợp</div>
                          ) : (
                            filteredUnitsForDropdown.map((unit, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => {
                                  setAddForm({...addForm, tendonvi: unit});
                                  setIsUnitDropdownOpen(false);
                                }} 
                                className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex items-center justify-between group"
                              >
                                 <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700">{unit}</p>
                                 {addForm.tendonvi === unit && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                              </div>
                            ))
                          )}
                       </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>
             </div>

             <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-2.5 bg-white text-gray-700 font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors text-sm">Đóng hồ sơ</button>
                <button 
                  disabled={saving}
                  onClick={handleSaveAdd}
                  className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-300 text-sm"
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
                  <Pencil className="w-6 h-6 text-red-200" />
                  <h3 className="text-xl font-bold">Hiệu chỉnh đánh giá mức độ HTNV tập thể</h3>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X className="h-7 w-7" /></button>
             </div>

             <div className="p-8 space-y-8">
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-inner">
                   <label className="text-[10px] font-bold text-red-600 mb-1 block tracking-widest">Tên đơn vị</label>
                   <p className="text-lg font-bold text-blue-900 flex items-center gap-2">
                     <Building2 className="w-5 h-5 text-blue-600" />
                     {editingItem.tendonvi}
                   </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-red-600 mb-1.5 block">Mức độ HTNV *</label>
                    <select 
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editForm.mucdohtnv} 
                      onChange={e => setEditForm({...editForm, mucdohtnv: e.target.value})}
                    >
                       <option value="">-- Chọn mức độ --</option>
                       {mucDoOptions.map(opt => <option key={opt.mamucdohtnv} value={opt.mucdohtnv}>{opt.mucdohtnv}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-red-600 mb-1.5 block">Năm học *</label>
                    <select 
                      className="w-full p-2.5 bg-white border border-gray-300 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editForm.namhoc} 
                      onChange={e => setEditForm({...editForm, namhoc: e.target.value})}
                    >
                       <option value="">-- Chọn năm học --</option>
                       {namHocOptions.map(opt => <option key={opt.id} value={opt.giatri}>{opt.giatri}</option>)}
                    </select>
                  </div>
                </div>
             </div>

             <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                <button onClick={() => setIsEditModalOpen(false)} className="px-6 py-2.5 bg-white text-gray-700 font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors text-sm">Đóng hồ sơ</button>
                <button 
                  disabled={saving || (editForm.mucdohtnv === editingItem.mucdohtnv && editForm.namhoc === editingItem.namhoc)}
                  onClick={handleSaveUpdate}
                  className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-300 text-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu thay đổi
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận xóa */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
             <div className="bg-red-600 p-5 text-white flex items-center gap-3">
                <Trash2 className="w-6 h-6" />
                <h3 className="text-lg font-bold">Xác nhận xóa hồ sơ</h3>
             </div>
             <div className="p-8 text-center">
                <p className="text-gray-700 font-medium leading-relaxed">
                  Bạn có chắc chắn muốn xóa hồ sơ đánh giá của đơn vị <span className="text-red-600 font-bold">{confirmModal.name}</span> ở năm học <span className="text-blue-600 font-bold">{confirmModal.year}</span>?
                </p>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center gap-3">
                <button 
                  onClick={() => setConfirmModal({ isOpen: false, id: null, name: '', year: '' })}
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

      {/* Alert Modal */}
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

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <p className="text-[10px] text-red-400 font-bold tracking-widest italic flex items-center gap-2">
           <CheckCircle2 className="w-3 h-3" />
           Hệ thống DAU HR Management | © Quản lý Nhân sự
        </p>
      </div>
    </div>
  );
};
