
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission } from '../services/permissionService';
import { 
  RolePermission, Role, Module, Permission, UserRole, 
  NhanVien, PhongBan, ChucVu 
} from '../types';
import { 
  Search, FileDown, Pencil, Trash2, Plus, X, Save, 
  Loader2, Shield, User, LayoutGrid, ChevronDown, MoreHorizontal,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

export const RolePermissionManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean }> = ({ permissions: currentUserPermissions, isAdmin }) => {
  const [list, setList] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Catalog data
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [staffList, setStaffList] = useState<NhanVien[]>([]);
  const [phongBans, setPhongBans] = useState<PhongBan[]>([]);
  const [chucVus, setChucVus] = useState<ChucVu[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [permissionQueue, setPermissionQueue] = useState<any[]>([]);

  // Notification & Confirmation states
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'warning';
  }>({ isOpen: false, message: '', type: 'success' });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    item: RolePermission | null;
  }>({ isOpen: false, item: null });

  // Form state
  const [formData, setFormData] = useState({
    userid: 0,
    roleid: 0,
    moduleid: 0,
    permissionid: 0
  });

  // Selected user info for display in modal
  const [selectedUserInfo, setSelectedUserInfo] = useState<{
    userid: number;
    manv: string;
    hoten: string;
    rolename: string;
  } | null>(null);

  // User search dropdown state
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Filter states
  const [filters, setFilters] = useState({
    id: '',
    userid: '',
    hoten: '',
    donvi: '',
    chucvu: '',
    modulename: '',
    rolename: '',
    permissionname: ''
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getUniqueValues = (key: keyof RolePermission) => {
    return Array.from(new Set(list.map(item => String(item[key] || '')))).filter(Boolean).sort();
  };

  // Permission Logic
  const canCreate = checkPermission(currentUserPermissions, isAdmin, 'phanQuyenChucNang', 'CREATE');
  const canUpdate = checkPermission(currentUserPermissions, isAdmin, 'phanQuyenChucNang', 'UPDATE');
  const canDelete = checkPermission(currentUserPermissions, isAdmin, 'phanQuyenChucNang', 'DELETE');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        rpRes, rRes, mRes, pRes, urRes, nvRes, pbRes, cvRes
      ] = await Promise.all([
        supabase.from('RolePermissions').select('*'),
        supabase.from('Roles').select('*'),
        supabase.from('Modules').select('*'),
        supabase.from('Permissions').select('*'),
        supabase.from('UserRoles').select('*'),
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, phongban, chucvu'),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('DanhMucChucVu').select('*')
      ]);

      if (rpRes.error) throw rpRes.error;

      const rps = (rpRes.data || []).map(normalizeKeys);
      const rs = (rRes.data || []).map(normalizeKeys);
      const ms = (mRes.data || []).map(normalizeKeys);
      const ps = (pRes.data || []).map(normalizeKeys);
      const urs = (urRes.data || []).map(normalizeKeys);
      const nvs = (nvRes.data || []).map(normalizeKeys);
      const pbs = (pbRes.data || []).map(normalizeKeys);
      const cvs = (cvRes.data || []).map(normalizeKeys);

      setRoles(rs);
      setModules(ms);
      setPermissions(ps);
      setUserRoles(urs);
      setStaffList(nvs);
      setPhongBans(pbs);
      setChucVus(cvs);

      // Process joins for display
      const processedList: RolePermission[] = rps.map(rp => {
        const userRole = urs.find(ur => ur.userid === rp.userid);
        const staff = userRole ? nvs.find(nv => nv.manv === userRole.manv) : null;
        const module = ms.find(m => m.id === rp.moduleid);
        const role = rs.find(r => r.id === rp.roleid);
        const permission = ps.find(p => p.id === rp.permissionid);
        const pb = staff ? pbs.find(p => p.maphongban === staff.phongban) : null;
        const cv = staff ? cvs.find(c => c.machucvu === staff.chucvu) : null;

        return {
          ...rp,
          manv: userRole?.manv || '',
          hoten: staff ? `${staff.holot} ${staff.ten}` : '',
          donvi: pb ? pb.giatri : staff?.phongban || '',
          chucvu: cv ? cv.giatri : staff?.chucvu || '',
          modulename: module ? module.modulename : '',
          rolename: role ? role.rolename : '',
          permissionname: permission ? permission.permissionname : ''
        };
      });

      setList(processedList);
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'warning',
        message: 'Lỗi khi tải dữ liệu: ' + (err.message || err)
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredUsers = useMemo(() => {
    const query = userSearchQuery.toLowerCase();
    return userRoles.map(ur => {
      const staff = staffList.find(nv => nv.manv === ur.manv);
      const role = roles.find(r => r.id === ur.roleid);
      return {
        ...ur,
        hoten: staff ? `${staff.holot} ${staff.ten}` : '',
        rolename: role ? role.rolename : ''
      };
    }).filter(u => 
      String(u.manv || '').toLowerCase().includes(query) || 
      String(u.hoten || '').toLowerCase().includes(query) ||
      u.userid?.toString().includes(query)
    );
  }, [userRoles, staffList, roles, userSearchQuery]);

  const handleSelectUser = (user: any) => {
    setFormData({ ...formData, userid: user.userid, roleid: user.roleid });
    setSelectedUserInfo({
      userid: user.userid,
      manv: user.manv,
      hoten: user.hoten,
      rolename: user.rolename
    });
    setIsUserDropdownOpen(false);
    setUserSearchQuery('');
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({ userid: 0, roleid: 0, moduleid: 0, permissionid: 0 });
    setSelectedUserInfo(null);
    setModalError(null);
    setPermissionQueue([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: RolePermission) => {
    setIsEditing(true);
    setEditingId(item.id);
    setFormData({
      userid: item.userid,
      roleid: item.roleid,
      moduleid: item.moduleid,
      permissionid: item.permissionid
    });
    
    const userRole = userRoles.find(ur => ur.userid === item.userid);
    const role = roles.find(r => r.id === item.roleid);
    setSelectedUserInfo({
      userid: item.userid,
      manv: userRole?.manv || '',
      hoten: item.hoten || '',
      rolename: role?.rolename || ''
    });
    
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleAddToQueue = () => {
    if (formData.userid === 0 || formData.moduleid === 0 || formData.permissionid === 0) {
      setModalError('Vui lòng nhập đầy đủ các thông tin bắt buộc.');
      return;
    }

    const module = modules.find(m => m.id === formData.moduleid);
    const permission = permissions.find(p => p.id === formData.permissionid);

    // Check in existing list
    const isDuplicateInList = list.some(item => 
      item.userid === formData.userid && 
      item.moduleid === formData.moduleid && 
      item.permissionid === formData.permissionid
    );

    // Check in queue
    const isDuplicateInQueue = permissionQueue.some(item => 
      item.userid === formData.userid && 
      item.moduleid === formData.moduleid && 
      item.permissionid === formData.permissionid
    );

    if (isDuplicateInList || isDuplicateInQueue) {
      setNotification({
        isOpen: true,
        type: 'warning',
        message: `User ${selectedUserInfo?.hoten} đã được phân quyền Tác vụ ${permission?.permissionname} đối với Chức năng ${module?.modulename}. Hãy chọn lại nhé!`
      });
      return;
    }

    const newItem = {
      ...formData,
      hoten: selectedUserInfo?.hoten,
      manv: selectedUserInfo?.manv,
      modulename: module?.modulename,
      permissionname: permission?.permissionname,
      rolename: selectedUserInfo?.rolename
    };

    setPermissionQueue([...permissionQueue, newItem]);
    setModalError(null);
    
    // Reset selections for next entry but keep user if they want to add more for same user?
    // User request says "phân quyền cho nhiều nhân sự" - maybe they want to pick another user.
    // I'll reset module and permission but keep user for convenience if they want to add multiple perms for one user.
    setFormData(prev => ({ ...prev, moduleid: 0, permissionid: 0 }));
  };

  const handleRemoveFromQueue = (index: number) => {
    setPermissionQueue(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isEditing) {
      if (formData.userid === 0 || formData.moduleid === 0 || formData.permissionid === 0) {
        setModalError('Vui lòng nhập đầy đủ các thông tin bắt buộc.');
        return;
      }

      setSaving(true);
      try {
        // Check for existing permission (excluding current)
        const isDuplicate = list.some(item => 
          item.userid === formData.userid && 
          item.moduleid === formData.moduleid && 
          item.permissionid === formData.permissionid &&
          item.id !== editingId
        );

        if (isDuplicate) {
          const module = modules.find(m => m.id === formData.moduleid);
          const permission = permissions.find(p => p.id === formData.permissionid);
          setNotification({
            isOpen: true,
            type: 'warning',
            message: `User ${selectedUserInfo?.hoten} đã được phân quyền Tác vụ ${permission?.permissionname} đối với Chức năng ${module?.modulename}. Hãy chọn lại nhé!`
          });
          setSaving(false);
          return;
        }

        if (editingId) {
          const { error } = await supabase
            .from('RolePermissions')
            .update(formData)
            .eq('id', editingId);
          if (error) throw error;
        }

        setIsModalOpen(false);
        fetchData();
        setNotification({
          isOpen: true,
          type: 'success',
          message: `Cập nhật phân quyền thành công cho ${selectedUserInfo?.hoten}!`
        });
      } catch (err: any) {
        setModalError('Lỗi khi lưu: ' + (err.message || err));
      } finally {
        setSaving(false);
      }
    } else {
      // Batch save logic
      if (permissionQueue.length === 0) {
        setModalError('Danh sách hàng đợi trống. Vui lòng thêm ít nhất một phân quyền.');
        return;
      }

      setSaving(true);
      try {
        const dataToInsert = permissionQueue.map(item => ({
          userid: item.userid,
          roleid: item.roleid,
          moduleid: item.moduleid,
          permissionid: item.permissionid
        }));

        const { error } = await supabase
          .from('RolePermissions')
          .insert(dataToInsert);
        
        if (error) throw error;

        setIsModalOpen(false);
        setPermissionQueue([]);
        fetchData();
        setNotification({
          isOpen: true,
          type: 'success',
          message: `Đã lưu thành công ${permissionQueue.length} phân quyền!`
        });
      } catch (err: any) {
        setModalError('Lỗi khi lưu: ' + (err.message || err));
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = (item: RolePermission) => {
    setDeleteConfirm({ isOpen: true, item });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.item) return;
    
    try {
      const { error } = await supabase
        .from('RolePermissions')
        .delete()
        .eq('id', deleteConfirm.item.id);
      if (error) throw error;
      
      setNotification({
        isOpen: true,
        type: 'success',
        message: `Đã xóa phân quyền thành công!`
      });
      setDeleteConfirm({ isOpen: false, item: null });
      fetchData();
    } catch (err: any) {
      setNotification({
        isOpen: true,
        type: 'warning',
        message: 'Lỗi khi xóa: ' + (err.message || err)
      });
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredList.map((item, index) => ({
      'STT': index + 1,
      'ID': item.id,
      'User ID': item.userid,
      'Họ và Tên': item.hoten,
      'Đơn vị': item.donvi,
      'Chức vụ': item.chucvu,
      'Chức năng': item.modulename,
      'Quyền hạn': item.rolename,
      'Tác vụ': item.permissionname
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PhanQuyenChucNang");
    
    // Add UTF-8 BOM for correct Vietnamese display in Excel
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = "PhanQuyenChucNang.xlsx";
    link.click();
  };

  const sortedModules = useMemo(() => {
    const order = [
      'Hồ sơ Cá nhân',
      'Danh sách Nhân sự',
      'Danh sách Nhân sự Khoa, Phòng',
      'Tổ Bộ môn',
      'Hợp đồng Lao động',
      'Lương và HSL',
      'Bảo hiểm',
      'Nâng cao Trình độ',
      'Quá trình công tác',
      'Thi đua',
      'Khen thưởng',
      'Thống kê số liệu',
      'Danh mục',
      'Công cụ',
      'Cài đặt',
      'Hình ảnh Nhân sự',
      'Quản lý người dùng',
      'Phân quyền sử dụng',
      'Danh mục chức năng',
      'Phân quyền chức năng'
    ];

    return [...modules].filter(m => m.enable).sort((a, b) => {
      const indexA = order.indexOf(a.modulename);
      const indexB = order.indexOf(b.modulename);
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.modulename.localeCompare(b.modulename);
    });
  }, [modules]);

  const sortedPermissions = useMemo(() => {
    return [...permissions].sort((a, b) => (a.id || 0) - (b.id || 0));
  }, [permissions]);

  const filteredList = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return list.filter(item => {
      const matchesSearch = 
        String(item.hoten || '').toLowerCase().includes(query) ||
        String(item.modulename || '').toLowerCase().includes(query) ||
        String(item.rolename || '').toLowerCase().includes(query) ||
        String(item.permissionname || '').toLowerCase().includes(query);

      const matchesId = !filters.id || String(item.id) === filters.id;
      const matchesUserId = !filters.userid || String(item.userid) === filters.userid;
      const matchesHoTen = !filters.hoten || item.hoten === filters.hoten;
      const matchesDonVi = !filters.donvi || item.donvi === filters.donvi;
      const matchesChucVu = !filters.chucvu || item.chucvu === filters.chucvu;
      const matchesChucNang = !filters.modulename || item.modulename === filters.modulename;
      const matchesQuyenHan = !filters.rolename || item.rolename === filters.rolename;
      const matchesTacVu = !filters.permissionname || item.permissionname === filters.permissionname;

      return matchesSearch && matchesId && matchesUserId && matchesHoTen && matchesDonVi && matchesChucVu && matchesChucNang && matchesQuyenHan && matchesTacVu;
    });
  }, [list, searchTerm, filters]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-100">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-blue-900 tracking-tight">Hệ thống Phân quyền chức năng</h2>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition-all border border-emerald-200"
          >
            <FileDown className="h-4 w-4 mr-2" /> Xuất danh sách Excel
          </button>
          {canCreate && (
          <button
            onClick={handleOpenAdd}
            className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4 mr-2" /> Thêm mới
          </button>
          )}
        </div>
      </div>

      {/* Search and Table Section */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm họ tên, chức năng, quyền hạn..."
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50/50 font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs font-bold text-gray-400 tracking-widest">
            Tổng cộng: <span className="text-blue-600 font-black">{filteredList.length}</span> bản ghi
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th rowSpan={2} className="px-6 py-4 text-[11px] font-black text-red-600 tracking-widest text-center w-16 border-b">STT</th>
                <th className="px-6 py-4 text-[11px] font-black text-red-600 tracking-widest text-center w-16 border-b">ID</th>
                <th className="px-6 py-4 text-[11px] font-black text-red-600 tracking-widest border-b">User ID</th>
                <th className="px-6 py-4 text-[11px] font-black text-red-600 tracking-widest border-b">Họ và Tên</th>
                <th className="px-6 py-4 text-[11px] font-black text-red-600 tracking-widest border-b">Đơn vị</th>
                <th className="px-6 py-4 text-[11px] font-black text-red-600 tracking-widest border-b">Chức vụ</th>
                <th className="px-6 py-4 text-[11px] font-black text-red-600 tracking-widest border-b">Chức năng</th>
                <th className="px-6 py-4 text-[11px] font-black text-red-600 tracking-widest border-b">Quyền hạn</th>
                <th className="px-6 py-4 text-[11px] font-black text-red-600 tracking-widest border-b">Tác vụ</th>
                <th rowSpan={2} className="px-6 py-4 text-[11px] font-black text-red-600 tracking-widest text-right border-b">Thao tác</th>
              </tr>
              <tr className="bg-gray-50/30">
                <th className="px-2 py-2 border-b">
                  <select 
                    value={filters.id} 
                    onChange={e => handleFilterChange('id', e.target.value)}
                    className="w-full text-[10px] font-bold border-gray-200 rounded-lg focus:ring-blue-500 bg-white py-1"
                  >
                    <option value="">Tất cả</option>
                    {getUniqueValues('id' as any).map(val => <option key={val} value={val}>{val}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2 border-b">
                  <select 
                    value={filters.userid} 
                    onChange={e => handleFilterChange('userid', e.target.value)}
                    className="w-full text-[10px] font-bold border-gray-200 rounded-lg focus:ring-blue-500 bg-white py-1"
                  >
                    <option value="">Tất cả</option>
                    {getUniqueValues('userid' as any).map(val => <option key={val} value={val}>{val}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2 border-b">
                  <select 
                    value={filters.hoten} 
                    onChange={e => handleFilterChange('hoten', e.target.value)}
                    className="w-full text-[10px] font-bold border-gray-200 rounded-lg focus:ring-blue-500 bg-white py-1"
                  >
                    <option value="">Tất cả</option>
                    {getUniqueValues('hoten' as any).map(val => <option key={val} value={val}>{val}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2 border-b">
                  <select 
                    value={filters.donvi} 
                    onChange={e => handleFilterChange('donvi', e.target.value)}
                    className="w-full text-[10px] font-bold border-gray-200 rounded-lg focus:ring-blue-500 bg-white py-1"
                  >
                    <option value="">Tất cả</option>
                    {getUniqueValues('donvi' as any).map(val => <option key={val} value={val}>{val}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2 border-b">
                  <select 
                    value={filters.chucvu} 
                    onChange={e => handleFilterChange('chucvu', e.target.value)}
                    className="w-full text-[10px] font-bold border-gray-200 rounded-lg focus:ring-blue-500 bg-white py-1"
                  >
                    <option value="">Tất cả</option>
                    {getUniqueValues('chucvu' as any).map(val => <option key={val} value={val}>{val}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2 border-b">
                  <select 
                    value={filters.modulename} 
                    onChange={e => handleFilterChange('modulename', e.target.value)}
                    className="w-full text-[10px] font-bold border-gray-200 rounded-lg focus:ring-blue-500 bg-white py-1"
                  >
                    <option value="">Tất cả</option>
                    {getUniqueValues('modulename' as any).map(val => <option key={val} value={val}>{val}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2 border-b">
                  <select 
                    value={filters.rolename} 
                    onChange={e => handleFilterChange('rolename', e.target.value)}
                    className="w-full text-[10px] font-bold border-gray-200 rounded-lg focus:ring-blue-500 bg-white py-1"
                  >
                    <option value="">Tất cả</option>
                    {getUniqueValues('rolename' as any).map(val => <option key={val} value={val}>{val}</option>)}
                  </select>
                </th>
                <th className="px-2 py-2 border-b">
                  <select 
                    value={filters.permissionname} 
                    onChange={e => handleFilterChange('permissionname', e.target.value)}
                    className="w-full text-[10px] font-bold border-gray-200 rounded-lg focus:ring-blue-500 bg-white py-1"
                  >
                    <option value="">Tất cả</option>
                    {getUniqueValues('permissionname' as any).map(val => <option key={val} value={val}>{val}</option>)}
                  </select>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-600" />
                    <p className="mt-2 text-gray-400 font-bold text-[11px] tracking-widest">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy dữ liệu phù hợp.</td>
                </tr>
              ) : (
                filteredList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-6 py-4 text-sm text-center text-gray-400">{index + 1}</td>
                    <td className="px-6 py-4 text-sm text-center font-bold text-gray-700">{item.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.userid}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-900">{item.hoten}</span>
                        <span className="text-[10px] font-bold text-blue-500 tracking-tighter">Mã NV: {item.manv}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.donvi}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.chucvu}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[11px] font-black border border-blue-100">
                        {item.modulename}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-bold">{item.rolename}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-black border border-emerald-100">
                        {item.permissionname}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {canUpdate && (
                      <button onClick={() => handleOpenEdit(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors mr-1">
                        <Pencil className="h-4 w-4" />
                      </button>
                      )}
                      {canDelete && (
                      <button onClick={() => handleDelete(item)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Section */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSave} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 my-8">
            <div className="bg-blue-800 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-wider flex items-center gap-3">
                {isEditing ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {isEditing ? 'Hiệu chỉnh phân quyền' : 'Thêm mới phân quyền cho User'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="h-7 w-7" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {/* User Selection */}
              <div className="space-y-4">
                <div className="relative" ref={userDropdownRef}>
                  <label className="text-[11px] font-black text-red-600 tracking-widest mb-1.5 block">Chọn User *</label>
                  
                  <div 
                    onClick={() => !isEditing && setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className={`flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold transition-all ${!isEditing ? 'cursor-pointer hover:border-blue-400' : 'opacity-70 cursor-not-allowed'}`}
                  >
                    <span className={selectedUserInfo ? 'text-gray-900' : 'text-gray-400'}>
                      {selectedUserInfo ? `${selectedUserInfo.hoten} (${selectedUserInfo.manv})` : 'Click để chọn User...'}
                    </span>
                    <MoreHorizontal className="h-5 w-5 text-gray-400" />
                  </div>

                  {isUserDropdownOpen && !isEditing && (
                    <div className="absolute z-[120] left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl divide-y divide-gray-100 overflow-hidden flex flex-col max-h-[350px] animate-in fade-in zoom-in duration-200">
                      <div className="p-3 bg-gray-50/50 sticky top-0">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input 
                            type="text"
                            placeholder="Tìm kiếm theo Mã NV hoặc Tên..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            autoFocus
                          />
                        </div>
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map(u => (
                            <div 
                              key={u.id} 
                              onClick={() => handleSelectUser(u)}
                              className="p-4 hover:bg-blue-50 cursor-pointer transition-colors group flex items-start gap-3 border-b border-gray-50 last:border-0"
                            >
                              <div className="bg-gray-100 p-2 rounded-xl group-hover:bg-blue-100 flex-shrink-0">
                                <User className="h-5 w-5 text-gray-400 group-hover:text-blue-600" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-black text-gray-900 group-hover:text-blue-900 truncate">
                                  {u.hoten}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[11px] font-bold text-gray-500">Mã NV: {u.manv}</span>
                                  <span className="text-gray-300">|</span>
                                  <span className="text-[11px] font-bold text-blue-600">User ID: {u.userid}</span>
                                </div>
                                <p className="text-[10px] text-emerald-600 font-bold mt-0.5">{u.rolename}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-10 text-center text-gray-400 italic text-sm">Không tìm thấy User phù hợp.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selectedUserInfo && (
                  <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 grid grid-cols-2 gap-4 animate-in fade-in duration-300 shadow-inner">
                    <div>
                      <p className="text-[10px] font-black text-blue-400 tracking-widest mb-0.5">User ID</p>
                      <p className="text-sm font-black text-blue-900">{selectedUserInfo.userid}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-400 tracking-widest mb-0.5">Quyền hạn (Role)</p>
                      <p className="text-sm font-black text-emerald-700">{selectedUserInfo.rolename}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                {/* Module Selection */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-red-600 tracking-widest block">Chọn Chức năng *</label>
                  <select
                    value={formData.moduleid}
                    onChange={e => setFormData({ ...formData, moduleid: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value={0}>-- Chọn chức năng --</option>
                    {sortedModules.map(m => (
                      <option key={m.id} value={m.id}>{m.modulename}</option>
                    ))}
                  </select>
                </div>

                {/* Permission Selection */}
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-red-600 tracking-widest block">Chọn Tác vụ *</label>
                  <select
                    value={formData.permissionid}
                    onChange={e => setFormData({ ...formData, permissionid: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value={0}>-- Chọn tác vụ --</option>
                    {sortedPermissions.map(p => (
                      <option key={p.id} value={p.id}>{p.permissionname}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!isEditing && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={handleAddToQueue}
                    className="px-8 py-2.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center gap-2 text-xs"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm vào Danh sách
                  </button>
                </div>
              )}

              {permissionQueue.length > 0 && !isEditing && (
                <div className="mt-6 border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                    <h4 className="text-[11px] font-black text-blue-800">Danh sách User được phân quyền</h4>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-[11px] font-bold text-red-600 text-center">STT</th>
                          <th className="px-4 py-2 text-[11px] font-bold text-red-600 text-left">Họ và Tên</th>
                          <th className="px-4 py-2 text-[11px] font-bold text-red-600 text-left">Chức năng</th>
                          <th className="px-4 py-2 text-[11px] font-bold text-red-600 text-left">Quyền hạn</th>
                          <th className="px-4 py-2 text-[11px] font-bold text-red-600 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {permissionQueue.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2 text-[11px] text-center text-gray-500">{index + 1}</td>
                            <td className="px-4 py-2 text-[11px] font-bold text-gray-900">{item.hoten}</td>
                            <td className="px-4 py-2 text-[11px] text-blue-600 font-medium">{item.modulename}</td>
                            <td className="px-4 py-2 text-[11px] text-emerald-600 font-medium">{item.permissionname}</td>
                            <td className="px-4 py-2 text-center">
                              <button 
                                type="button"
                                onClick={() => handleRemoveFromQueue(index)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
                onClick={() => setIsModalOpen(false)} 
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
                Lưu phân quyền
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Notification Modal */}
      {notification.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className={`p-6 text-white flex items-center gap-3 ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-amber-500'}`}>
              {notification.type === 'success' ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              <h3 className="text-lg font-black tracking-wider">Thông báo</h3>
            </div>
            <div className="p-8">
              <p className="text-sm font-bold text-gray-700 leading-relaxed text-center">
                {notification.message}
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center border-t border-gray-100">
              <button 
                onClick={() => setNotification({ ...notification, isOpen: false })}
                className={`px-10 py-2.5 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 text-xs ${notification.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'}`}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && deleteConfirm.item && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-red-600 p-6 text-white flex items-center gap-3">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-black tracking-wider">Xác nhận xóa</h3>
            </div>
            <div className="p-8">
              <p className="text-sm font-bold text-gray-700 leading-relaxed">
                Bạn chắc chắn muốn xóa tác vụ <span className="text-red-600 font-black">{deleteConfirm.item.permissionname}</span> đối với Chức năng <span className="text-blue-700 font-black">{deleteConfirm.item.modulename}</span> của User <span className="text-gray-900 font-black">{deleteConfirm.item.hoten}</span>?
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, item: null })}
                className="px-6 py-2 text-gray-500 font-black text-xs hover:text-gray-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={confirmDelete}
                className="px-8 py-2.5 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 text-xs"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
