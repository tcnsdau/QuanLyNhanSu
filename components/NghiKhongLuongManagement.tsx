
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { NghiKhongLuong, NhanVien, TrinhDo, PhongBan, ChucVu, RolePermission } from '../types';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { 
  Search, FileDown, Ban, Loader2, Filter, Eye, EyeOff, Plus, X, Save, User, MoreHorizontal, Calendar, Check, Building2, Pencil, Trash2, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Helper function to ensure keys are lowercase
const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

export const NghiKhongLuongManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [list, setList] = useState<NghiKhongLuong[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);

  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  // Permission checks
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'luong-nghiKhongLuong', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'luong-nghiKhongLuong', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'luong-nghiKhongLuong', 'DELETE'), [permissions, isAdmin]);

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
      } catch (err) {
        showAlert('Lỗi tải quyền hạn Nghỉ không lương: ' + (err instanceof Error ? err.message : String(err)));
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };

  const [itemToEdit, setItemToEdit] = useState<NghiKhongLuong | null>(null);
  const [itemToDelete, setItemToDelete] = useState<NghiKhongLuong | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<NghiKhongLuong & { donvi?: string }>>({
    manv: '',
    tungay: '',
    denngay: '',
    sothangnghi: 0,
    ghichu: '',
    khonghienthi: false,
    donvi: ''
  });

  // Searchable Dropdown States
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropSearchInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [nklRes, nvRes, tdRes, pbRes, cvRes] = await Promise.all([
        supabase.from('DanhSachNghiKhongLuong').select('*'),
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, trinhdo, phongban, chucvu'),
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('DanhMucChucVu').select('*')
      ]);

      if (nklRes.error) throw nklRes.error;

      const employees = (nvRes.data || []).map(normalizeKeys);
      const levels = (tdRes.data || []).map(normalizeKeys);
      const departments = (pbRes.data || []).map(normalizeKeys);
      const positions = (cvRes.data || []).map(normalizeKeys);

      const joinedData = (nklRes.data || []).map(item => {
        const normalized = normalizeKeys(item) as NghiKhongLuong;
        const emp = employees.find(e => String(e.manv) === String(normalized.manv));
        
        if (emp) {
          const td = levels.find(l => String(l.matrinhdo) === String(emp.trinhdo));
          const pb = departments.find(p => String(p.maphongban) === String(emp.phongban));
          const cv = positions.find(c => String(c.machucvu) === String(emp.chucvu));

          return {
            ...normalized,
            holot: emp.holot,
            ten: emp.ten,
            ten_trinhdo: td ? td.giatri : emp.trinhdo,
            ten_phongban: pb ? pb.giatri : emp.phongban,
            ten_chucvu: cv ? cv.giatri : emp.chucvu
          };
        }
        return normalized;
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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      manv: '',
      tungay: new Date().toISOString().split('T')[0],
      denngay: '',
      sothangnghi: 0,
      ghichu: '',
      khonghienthi: false,
      donvi: ''
    });
    setIsDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: NghiKhongLuong) => {
    setItemToEdit(item);
    setFormData({
      manv: item.manv,
      tungay: item.tungay,
      denngay: item.denngay || '',
      sothangnghi: item.sothangnghi || 0,
      ghichu: item.ghichu || '',
      khonghienthi: item.khonghienthi,
      donvi: item.ten_phongban
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (item: NghiKhongLuong) => {
    setItemToDelete(item);
    setIsDeleteConfirmOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('DanhSachNghiKhongLuong')
        .update({
          tungay: formData.tungay,
          denngay: formData.denngay || null,
          sothangnghi: formData.sothangnghi || 0,
          ghichu: formData.ghichu || ''
        })
        .eq('id', itemToEdit.id);

      if (error) throw error;

      setIsEditModalOpen(false);
      setNotificationMessage("Hệ thống đã lưu các thay đổi thông tin của nhân sự nghỉ không lương");
      setIsNotificationOpen(true);
      fetchData();
    } catch (err: any) {
      showAlert("Lỗi khi cập nhật: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('DanhSachNghiKhongLuong')
        .delete()
        .eq('id', itemToDelete.id);

      if (error) throw error;

      setIsDeleteConfirmOpen(false);
      setNotificationMessage("Đã xóa Nhân sự nghỉ không lương ra khỏi danh sách");
      setIsNotificationOpen(true);
      fetchData();
    } catch (err: any) {
      showAlert("Lỗi khi xóa: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDropdown = async () => {
    setIsDropdownOpen(true);
    setLoadingStaff(true);
    setDropdownSearch('');
    try {
      const [nvRes, pbRes] = await Promise.all([
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, phongban').eq('danghiviec', false),
        supabase.from('DanhMucPhongBan').select('maphongban, giatri')
      ]);
      
      if (nvRes.error) throw nvRes.error;
      
      const departments = (pbRes.data || []).map(normalizeKeys);
      const employeesWithPB = (nvRes.data || []).map(item => {
        const normalized = normalizeKeys(item);
        const pb = departments.find(d => String(d.maphongban) === String(normalized.phongban));
        return {
          ...normalized,
          ten_phongban: pb ? pb.giatri : normalized.phongban
        };
      });

      setAvailableEmployees(employeesWithPB);
    } catch (err: any) {
      showAlert("Lỗi tải danh sách nhân viên: " + err.message);
    } finally {
      setLoadingStaff(false);
      setTimeout(() => dropSearchInputRef.current?.focus(), 100);
    }
  };

  const filteredDropdownStaff = useMemo(() => {
    if (!dropdownSearch.trim()) return availableEmployees;
    const lowerSearch = dropdownSearch.toLowerCase();
    return availableEmployees.filter(nv => 
      `${nv.holot} ${nv.ten}`.toLowerCase().includes(lowerSearch) || 
      String(nv.manv || '').toLowerCase().includes(lowerSearch) ||
      String(nv.ten_phongban || '').toLowerCase().includes(lowerSearch)
    );
  }, [availableEmployees, dropdownSearch]);

  const handleSelectStaff = (nv: any) => {
    setFormData({
      ...formData,
      manv: nv.manv,
      holot: nv.holot,
      ten: nv.ten,
      donvi: nv.ten_phongban
    });
    setIsDropdownOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.manv || !formData.tungay) {
      showAlert("Vui lòng chọn nhân sự và ngày bắt đầu nghỉ.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('DanhSachNghiKhongLuong')
        .insert([{
          manv: formData.manv,
          tungay: formData.tungay,
          denngay: formData.denngay || null,
          sothangnghi: formData.sothangnghi || 0,
          ghichu: formData.ghichu || '',
          khonghienthi: false
        }]);

      if (error) throw error;

      setNotificationMessage("Thêm mới nhân sự nghỉ không lương thành công!");
      setIsNotificationOpen(true);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      showAlert("Lỗi khi lưu: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN');
  };

  const handleExportExcel = () => {
    const dataToExport = filteredList.map(item => ({
      'Mã NV': item.manv,
      'Họ lót': item.holot,
      'Tên': item.ten,
      'Trình độ': item.ten_trinhdo,
      'Đơn vị': item.ten_phongban,
      'Chức vụ': item.ten_chucvu,
      'Nghỉ từ ngày': formatDate(item.tungay),
      'Đi làm lại': formatDate(item.denngay),
      'Số tháng nghỉ': item.sothangnghi,
      'Lý do nghỉ': item.ghichu,
      'Trạng thái': item.khonghienthi ? 'Ẩn' : 'Hiện'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NghiKhongLuong");
    XLSX.writeFile(wb, "DanhSachNghiKhongLuong.xlsx");
  };

  const filteredList = list.filter(item => {
    if (visibilityFilter === 'visible' && item.khonghienthi) return false;
    if (visibilityFilter === 'hidden' && !item.khonghienthi) return false;

    const search = searchTerm.toLowerCase();
    const matchesSearch = 
      String(item.holot || '').toLowerCase().includes(search) ||
      String(item.ten || '').toLowerCase().includes(search) ||
      String(item.ten_phongban || '').toLowerCase().includes(search) ||
      String(item.manv || '').toLowerCase().includes(search);
    
    return matchesSearch;
  });

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2.5 rounded-xl shadow-lg shadow-red-100">
            <Ban className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-blue-900 tracking-tight">Danh sách Nhân sự nghỉ không lương</h2>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-blue-100 text-blue-700 font-bold rounded-xl hover:bg-blue-200 transition-all border border-blue-200"
          >
            <FileDown className="h-4 w-4 mr-2" /> Xuất Excel
          </button>
          {canCreate && (
            <button
              onClick={handleOpenAdd}
              className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4 mr-2" /> Thêm mới
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Section */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo Mã NV, Họ tên, Đơn vị..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-black bg-white font-medium shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 shadow-inner">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={visibilityFilter}
              onChange={e => setVisibilityFilter(e.target.value as any)}
              className="bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="visible">Đang hiển thị (Hiện)</option>
              <option value="hidden">Đã bị ẩn (Ẩn)</option>
            </select>
          </div>
          <div className="text-xs font-bold text-gray-400 tracking-widest whitespace-nowrap">
            Tổng: <span className="text-indigo-600 font-black">{filteredList.length}</span> nhân sự
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-20">Mã NV</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest w-48">Họ tên nhân viên</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Đơn vị</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Nghỉ từ ngày</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Đi làm lại</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Tháng nghỉ</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest w-40">Lý do nghỉ</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-24">Trạng thái</th>
                {(canUpdate || canDelete) && (
                  <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-32">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-indigo-600" />
                    <p className="mt-2 text-gray-400 font-bold text-[10px] tracking-widest">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy nhân sự nghỉ không lương.</td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id} className={`hover:bg-indigo-50/40 transition-colors ${item.khonghienthi ? 'bg-gray-50/50 opacity-70' : ''}`}>
                    <td className="px-6 py-4 text-sm text-center text-red-600">
                        {item.manv}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      {item.holot} {item.ten}
                    </td>
                    <td className="px-6 py-4 text-sm text-black">
                      {item.ten_phongban}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-red-600">{formatDate(item.tungay)}</td>
                    <td className="px-6 py-4 text-sm text-center text-blue-600">{formatDate(item.denngay)}</td>
                    <td className="px-6 py-4 text-sm text-center text-black">
                          {item.sothangnghi} tháng
                    </td>
                    <td className="px-6 py-4 text-sm text-black truncate w-40" title={item.ghichu}>
                      {item.ghichu || '---'}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-black">
                      {item.khonghienthi ? 'Ẩn' : 'Hiện'}
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
                              title="Hiệu chỉnh"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleOpenDelete(item)}
                              className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors border border-red-100"
                              title="Xóa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSave} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 my-8">
            <div className="bg-red-700 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-wider flex items-center gap-3">
                <Plus className="h-6 w-6" /> Thêm mới nhân sự nghỉ không lương
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="h-7 w-7" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {/* Personnel Search Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <label className="text-[11px] font-bold text-red-600 tracking-tight mb-1.5 block">Chọn nhân sự *</label>
                <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-red-500 bg-white transition-all">
                  <input 
                    className="block w-full border-none px-4 py-3 text-sm font-bold text-black focus:ring-0 bg-white cursor-pointer" 
                    placeholder={formData.manv ? `${formData.holot} ${formData.ten} (${formData.manv})` : "Click để tìm kiếm nhân viên..."}
                    type="text" 
                    readOnly
                    onClick={handleOpenDropdown}
                    value={formData.manv ? `${formData.holot} ${formData.ten}` : ""}
                  />
                  <button 
                    type="button"
                    onClick={handleOpenDropdown}
                    className="inline-flex items-center px-4 bg-gray-50 border-l border-gray-200 text-gray-500 hover:bg-gray-100"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-[120] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl divide-y divide-gray-100 overflow-hidden flex flex-col max-h-[300px] animate-in fade-in zoom-in duration-100">
                    <div className="p-3 bg-gray-50/50 sticky top-0">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input 
                          ref={dropSearchInputRef}
                          type="text"
                          placeholder="Gõ Mã NV, Tên hoặc Đơn vị..."
                          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-black font-bold focus:ring-1 focus:ring-red-500 outline-none"
                          value={dropdownSearch}
                          onChange={(e) => setDropdownSearch(e.target.value)}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {loadingStaff ? (
                        <div className="p-10 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-red-600" />
                        </div>
                      ) : filteredDropdownStaff.length > 0 ? (
                        <div className="divide-y divide-gray-50">
                          {filteredDropdownStaff.map(nv => (
                            <div 
                              key={nv.manv} 
                              onClick={() => handleSelectStaff(nv)}
                              className="p-4 hover:bg-red-50 cursor-pointer transition-colors group flex items-start gap-3"
                            >
                              <div className="bg-gray-100 p-2 rounded-lg group-hover:bg-red-100 flex-shrink-0">
                                <User className="h-5 w-5 text-gray-400 group-hover:text-red-600" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-black text-gray-900 group-hover:text-red-900 truncate">
                                  {nv.holot} {nv.ten}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px] font-bold text-gray-500">Mã NV: {nv.manv}</span>
                                  <span className="text-gray-300">|</span>
                                  <span className="text-[11px] font-bold text-blue-600">{nv.ten_phongban}</span>
                                </div>
                              </div>
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

              {/* Display Unit Name after selection */}
              {formData.manv && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center gap-3 animate-in fade-in duration-200">
                  <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                    <Building2 className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 tracking-tight block">Đơn vị công tác</label>
                    <p className="text-sm font-bold text-gray-800">{formData.donvi}</p>
                  </div>
                </div>
              )}

              {/* Rest of the form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[11px] font-bold text-red-600 tracking-tight mb-1.5 block">Nghỉ từ ngày *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={formData.tungay || ''}
                      onChange={e => setFormData({ ...formData, tungay: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none bg-white text-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-red-600 tracking-tight mb-1.5 block">Đi làm lại</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      value={formData.denngay || ''}
                      onChange={e => setFormData({ ...formData, denngay: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none bg-white text-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-red-600 tracking-tight mb-1.5 block">Tháng nghỉ</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="VD: 6"
                    value={formData.sothangnghi || ''}
                    onChange={e => setFormData({ ...formData, sothangnghi: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none bg-white text-black"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-red-600 tracking-tight mb-1.5 block">Lý do ngỉ</label>
                  <textarea
                    rows={3}
                    placeholder="Lý do nghỉ, quyết định số..."
                    value={formData.ghichu || ''}
                    onChange={e => setFormData({ ...formData, ghichu: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-red-500 outline-none text-black bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-6 py-2.5 text-gray-500 font-black text-xs hover:text-gray-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                disabled={saving || !formData.manv} 
                className="px-10 py-2.5 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-xs"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu hồ sơ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleUpdate} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 my-8">
            <div className="bg-blue-700 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-wider flex items-center gap-3">
                <Pencil className="h-6 w-6" /> Hiệu chỉnh thông tin nghỉ không lương
              </h3>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="h-7 w-7" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {/* Personnel Info (Read-only) */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center gap-3">
                <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                  <User className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 tracking-tight block">Nhân sự</label>
                  <p className="text-sm font-black text-blue-900">{formData.holot} {formData.ten} ({formData.manv})</p>
                  <p className="text-[10px] font-bold text-gray-500">{formData.donvi}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[11px] font-bold text-red-600 tracking-tight mb-1.5 block">Nghỉ từ ngày *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={formData.tungay || ''}
                      onChange={e => setFormData({ ...formData, tungay: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-red-600 tracking-tight mb-1.5 block">Đi làm lại</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      value={formData.denngay || ''}
                      onChange={e => setFormData({ ...formData, denngay: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-red-600 tracking-tight mb-1.5 block">Tháng nghỉ</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="VD: 6"
                    value={formData.sothangnghi || ''}
                    onChange={e => setFormData({ ...formData, sothangnghi: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-red-600 tracking-tight mb-1.5 block">Lý do nghỉ</label>
                  <textarea
                    rows={3}
                    placeholder="Lý do nghỉ, quyết định số..."
                    value={formData.ghichu || ''}
                    onChange={e => setFormData({ ...formData, ghichu: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none text-black bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setIsEditModalOpen(false)} 
                className="px-6 py-2.5 text-gray-500 font-black text-xs hover:text-gray-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                disabled={saving} 
                className="px-10 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-xs"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="h-10 w-10 text-red-600" />
              </div>
              <h3 className="text-xl font-black text-blue-900 mb-2">Xác nhận xóa</h3>
              <p className="text-sm text-gray-500 font-bold leading-relaxed">
                Bạn chắc chắn xóa Nhân sự nghỉ không lương này ra khỏi danh sách?
              </p>
              {itemToDelete && (
                <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-1">Nhân sự</p>
                  <p className="text-sm font-bold text-gray-800">{itemToDelete.holot} {itemToDelete.ten}</p>
                  <p className="text-[10px] font-bold text-gray-400">Mã NV: {itemToDelete.manv}</p>
                </div>
              )}
            </div>
            <div className="bg-gray-50 p-6 flex gap-3 border-t border-gray-100">
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 px-6 py-3 text-gray-500 font-black text-xs hover:text-gray-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {isNotificationOpen && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-gray-800 leading-relaxed">
                {notificationMessage}
              </p>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setIsNotificationOpen(false)}
                className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal (Error) */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-red-100">
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

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-[10px] text-red-400 font-bold italic text-left tracking-widest">
         Hệ thống DAU HR Management | © Quản lý Nhân sự
      </div>
    </div>
  );
};
