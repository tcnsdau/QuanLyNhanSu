import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { NhanVien, TrinhDo, PhongBan, ChucVu, DanhSachThaiSan, RolePermission } from '../types';
import { 
  Plus, FileDown, Search, Edit3, Trash2, X, CheckCircle2, 
  AlertCircle, AlertTriangle, Loader2, Save, Calendar, Filter,
  BookOpen, Users
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { checkPermission, normalizePermissions } from '../services/permissionService';

interface Props {
  permissions?: RolePermission[];
  isAdmin?: boolean;
  currentUser?: any;
  onCancel?: () => void;
}

// Hàm format ngày hiển thị dạng DD/MM/YYYY
const formatDateDisplay = (dateStr: any): string => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
    return str;
  }
  const cleanDate = str.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  return str;
};

// Hàm format ngày cho input date dạng YYYY-MM-DD
const formatDateInput = (dateStr: any): string => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return str.split('T')[0];
};

// Hàm tính ngày kết thúc từ ngày bắt đầu + số tháng
const calculateEndDate = (startDate: string, months: number): string => {
  if (!startDate || !months) return startDate || '';
  try {
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + Number(months));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

// Hàm tính tuổi nhân sự
const getStaffAge = (ngaysinh: string): number => {
  if (!ngaysinh) return 0;
  try {
    let birthDate: Date;
    if (ngaysinh.includes('/')) {
      const parts = ngaysinh.split('/');
      if (parts.length === 3) {
        birthDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
      } else {
        birthDate = new Date(ngaysinh);
      }
    } else {
      birthDate = new Date(ngaysinh);
    }
    if (isNaN(birthDate.getTime())) return 0;
    const now = new Date();
    let age = now.getFullYear() - birthDate.getFullYear();
    const m = now.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch {
    return 0;
  }
};

// Hàm lấy tất cả dữ liệu từ một bảng sử dụng pagination range 1000
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
      throw new Error(`Lỗi khi truy vấn bảng ${tableName}: ${error.message || JSON.stringify(error)}`);
    } else if (data && data.length > 0) {
      allData = allData.concat(data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return allData;
};

export const DanhSachThaiSanManagement: React.FC<Props> = ({
  permissions: initialPermissions,
  isAdmin: initialIsAdmin,
  currentUser,
  onCancel
}) => {
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);
  
  // Kiểm tra quyền Admin (Tài khoản Admin hoặc manv=1 hoặc prop isAdmin)
  const isAdmin = useMemo(() => {
    if (initialIsAdmin) return true;
    if (currentUser?.taikhoan === 'Admin' || currentUser?.username === 'Admin') return true;
    if (currentUser?.manv === '1' || currentUser?.manv === 1) return true;
    return false;
  }, [initialIsAdmin, currentUser]);

  // Đồng bộ khi prop initialPermissions thay đổi
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  // Kiểm tra quyền trên module Danh sách thai sản ('baoHiem-danhSachThaiSan')
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'baoHiem-danhSachThaiSan', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'baoHiem-danhSachThaiSan', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'baoHiem-danhSachThaiSan', 'DELETE'), [permissions, isAdmin]);
  const canRead = useMemo(() => checkPermission(permissions, isAdmin, 'baoHiem-danhSachThaiSan', 'READ'), [permissions, isAdmin]);

  // Tải quyền hạn mới nhất từ DB theo manv -> userid qua UserRoles / Users và RolePermissions
  useEffect(() => {
    const fetchLatestPermissions = async () => {
      if (isAdmin) return;
      
      const manv = currentUser?.manv;
      const directUserId = currentUser?.id || currentUser?.userid;

      try {
        let targetUserId = directUserId;

        // Nếu chưa có directUserId nhưng có manv, tra cứu userid thông qua Table UserRoles hoặc Users
        if (!targetUserId && manv) {
          const { data: userRoleData } = await supabase
            .from('UserRoles')
            .select('userid')
            .eq('manv', manv)
            .maybeSingle();

          if (userRoleData?.userid) {
            targetUserId = userRoleData.userid;
          } else {
            const { data: userData } = await supabase
              .from('Users')
              .select('id')
              .eq('manv', manv)
              .maybeSingle();
            if (userData?.id) {
              targetUserId = userData.id;
            }
          }
        }

        if (!targetUserId) return;

        // Lấy danh sách RolePermissions của người dùng
        const { data: rolePermData, error: rolePermError } = await supabase
          .from('RolePermissions')
          .select('*')
          .eq('userid', targetUserId);

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
        console.error('Lỗi tải quyền hạn Danh sách thai sản:', err?.message || err);
      }
    };

    fetchLatestPermissions();
  }, [currentUser, isAdmin]);

  const [loading, setLoading] = useState(true);
  const [dataList, setDataList] = useState<DanhSachThaiSan[]>([]);
  const [staffList, setStaffList] = useState<NhanVien[]>([]);
  const [trinhDoList, setTrinhDoList] = useState<TrinhDo[]>([]);
  const [phongBanList, setPhongBanList] = useState<PhongBan[]>([]);
  const [chucVuList, setChucVuList] = useState<ChucVu[]>([]);

  // Bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTrinhDo, setFilterTrinhDo] = useState('Tất cả');
  const [filterPhongBan, setFilterPhongBan] = useState('Tất cả');
  const [filterChucVu, setFilterChucVu] = useState('Tất cả');
  const [filterCheDo, setFilterCheDo] = useState('Tất cả');

  // Modal thêm mới
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStaffToAdd, setSelectedStaffToAdd] = useState<NhanVien | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const staffDropdownRef = useRef<HTMLDivElement>(null);

  const [addFormData, setAddFormData] = useState({
    thoigianthaisan: 6,
    batdau: new Date().toISOString().split('T')[0],
    ketthuc: calculateEndDate(new Date().toISOString().split('T')[0], 6),
    chedosinh: 'Sinh thường',
    ghichu: ''
  });

  // Modal hiệu chỉnh
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DanhSachThaiSan | null>(null);
  const [editFormData, setEditFormData] = useState({
    thoigianthaisan: 6,
    batdau: '',
    ketthuc: '',
    chedosinh: 'Sinh thường',
    ghichu: ''
  });

  // Modal xác nhận xóa
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    item: DanhSachThaiSan | null;
  }>({
    isOpen: false,
    item: null
  });

  // Modal thông báo hệ thống dạng Form
  const [noticeModal, setNoticeModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    message: string;
  }>({
    isOpen: false,
    type: 'info',
    message: ''
  });

  const [saving, setSaving] = useState(false);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(event.target as Node)) {
        setIsStaffDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tải dữ liệu
  const fetchData = async () => {
    setLoading(true);
    try {
      const [thaiSanData, nhanVienData, trinhDoData, phongBanData, chucVuData] = await Promise.all([
        fetchAllRecords('DanhSachThaiSan'),
        fetchAllRecords('DanhSachNhanVien'),
        fetchAllRecords('DanhMucTrinhDo'),
        fetchAllRecords('DanhMucPhongBan'),
        fetchAllRecords('DanhMucChucVu')
      ]);

      setStaffList(nhanVienData);
      setTrinhDoList(trinhDoData);
      setPhongBanList(phongBanData);
      setChucVuList(chucVuData);

      // Map thông tin nhân sự vào bảng Thai San
      const mappedData: DanhSachThaiSan[] = thaiSanData.map((item: any) => {
        const staff = nhanVienData.find((nv: any) => String(nv.manv).trim() === String(item.manv).trim());
        
        let ten_trinhdo = '';
        let ten_phongban = '';
        let ten_chucvu = '';

        if (staff) {
          const td = trinhDoData.find((t: any) => String(t.matrinhdo).trim() === String(staff.trinhdo).trim() || String(t.giatri).trim() === String(staff.trinhdo).trim());
          ten_trinhdo = td ? td.giatri : staff.trinhdo || '';

          const pb = phongBanData.find((p: any) => String(p.maphongban).trim() === String(staff.phongban).trim() || String(p.giatri).trim() === String(staff.phongban).trim());
          ten_phongban = pb ? pb.giatri : staff.phongban || '';

          const cv = chucVuData.find((c: any) => String(c.machucvu).trim() === String(staff.chucvu).trim() || String(c.giatri).trim() === String(staff.chucvu).trim());
          ten_chucvu = cv ? cv.giatri : staff.chucvu || '';
        }

        return {
          ...item,
          thoigianthaisan: Number(item.thoigianthaisan) || 0,
          holot: staff?.holot || '',
          ten: staff?.ten || '',
          trinhdo: staff?.trinhdo || '',
          phongban: staff?.phongban || '',
          chucvu: staff?.chucvu || '',
          ten_trinhdo,
          ten_phongban,
          ten_chucvu,
          ngaysinh: staff?.ngaysinh || '',
          gioitinh: staff?.gioitinh,
          danghiviec: staff?.danghiviec
        };
      });

      setDataList(mappedData);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu thai sản:', err);
      setNoticeModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi tải dữ liệu thai sản: ' + (err.message || String(err))
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Danh sách nhân sự khả dụng cho Thêm mới:
  // Đang làm việc (danghiviec === false), Nữ (gioitinh === false), tuổi <= 50, chưa có trong DanhSachThaiSan
  const availableStaffToAdd = useMemo(() => {
    const existingManvSet = new Set(dataList.map(item => String(item.manv).trim()));

    return staffList.filter((nv: any) => {
      // Đang làm việc
      const isWorking = nv.danghiviec === false || nv.danghiviec === 'false' || nv.danghiviec === 0 || nv.danghiviec === '0' || !nv.danghiviec;
      if (!isWorking) return false;

      // Giới tính là Nữ (gioitinh === false)
      const isFemale = nv.gioitinh === false || nv.gioitinh === 'false' || nv.gioitinh === 0 || nv.gioitinh === '0' || !nv.gioitinh;
      if (!isFemale) return false;

      // Tuổi <= 50
      const age = getStaffAge(nv.ngaysinh);
      if (age > 50 && age !== 0) return false;

      // Chưa có tên trong DanhSachThaiSan
      if (existingManvSet.has(String(nv.manv).trim())) return false;

      return true;
    });
  }, [staffList, dataList]);

  // Lọc dropdown tìm kiếm nhân sự trong Form thêm mới
  const filteredStaffSearch = useMemo(() => {
    if (!staffSearchQuery.trim()) return availableStaffToAdd;
    const query = staffSearchQuery.toLowerCase().trim();
    return availableStaffToAdd.filter(nv => {
      const manv = String(nv.manv || '').toLowerCase();
      const fullName = `${nv.holot || ''} ${nv.ten || ''}`.toLowerCase();
      const email = String(nv.email || '').toLowerCase();
      return manv.includes(query) || fullName.includes(query) || email.includes(query);
    });
  }, [availableStaffToAdd, staffSearchQuery]);

  // Các danh sách tùy chọn cho bộ lọc trong bảng
  const uniqueTrinhDoList = useMemo(() => {
    const set = new Set<string>();
    dataList.forEach(item => {
      if (item.ten_trinhdo) set.add(item.ten_trinhdo);
    });
    return Array.from(set).sort();
  }, [dataList]);

  const uniquePhongBanList = useMemo(() => {
    const set = new Set<string>();
    dataList.forEach(item => {
      if (item.ten_phongban) set.add(item.ten_phongban);
    });
    return Array.from(set).sort();
  }, [dataList]);

  const uniqueChucVuList = useMemo(() => {
    const set = new Set<string>();
    dataList.forEach(item => {
      if (item.ten_chucvu) set.add(item.ten_chucvu);
    });
    return Array.from(set).sort();
  }, [dataList]);

  const uniqueCheDoList = useMemo(() => {
    const set = new Set<string>();
    dataList.forEach(item => {
      if (item.chedosinh) set.add(item.chedosinh);
    });
    return Array.from(set).sort();
  }, [dataList]);

  // Lọc dữ liệu hiển thị trên bảng
  const filteredData = useMemo(() => {
    return dataList.filter(item => {
      if (filterTrinhDo !== 'Tất cả' && item.ten_trinhdo !== filterTrinhDo) return false;
      if (filterPhongBan !== 'Tất cả' && item.ten_phongban !== filterPhongBan) return false;
      if (filterChucVu !== 'Tất cả' && item.ten_chucvu !== filterChucVu) return false;
      if (filterCheDo !== 'Tất cả' && item.chedosinh !== filterCheDo) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const manv = String(item.manv || '').toLowerCase();
        const fullName = `${item.holot || ''} ${item.ten || ''}`.toLowerCase();
        const ghichu = String(item.ghichu || '').toLowerCase();
        if (!manv.includes(query) && !fullName.includes(query) && !ghichu.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [dataList, filterTrinhDo, filterPhongBan, filterChucVu, filterCheDo, searchTerm]);

  // Mở modal Thêm mới
  const handleOpenAddModal = () => {
    setSelectedStaffToAdd(null);
    setStaffSearchQuery('');
    const today = new Date().toISOString().split('T')[0];
    setAddFormData({
      thoigianthaisan: 6,
      batdau: today,
      ketthuc: calculateEndDate(today, 6),
      chedosinh: 'Sinh thường',
      ghichu: ''
    });
    setIsAddModalOpen(true);
  };

  // Chọn nhân viên trong modal thêm mới
  const handleSelectStaff = (staff: NhanVien) => {
    setSelectedStaffToAdd(staff);
    setStaffSearchQuery(`${staff.holot} ${staff.ten}`);
    setIsStaffDropdownOpen(false);
  };

  // Lấy tên chức danh / trình độ / phòng ban khi chọn nhân sự
  const selectedStaffDetails = useMemo(() => {
    if (!selectedStaffToAdd) {
      return {
        trinhdo: '',
        chucvu: '',
        phongban: ''
      };
    }
    const td = trinhDoList.find(t => String(t.matrinhdo).trim() === String(selectedStaffToAdd.trinhdo).trim() || String(t.giatri).trim() === String(selectedStaffToAdd.trinhdo).trim());
    const pb = phongBanList.find(p => String(p.maphongban).trim() === String(selectedStaffToAdd.phongban).trim() || String(p.giatri).trim() === String(selectedStaffToAdd.phongban).trim());
    const cv = chucVuList.find(c => String(c.machucvu).trim() === String(selectedStaffToAdd.chucvu).trim() || String(c.giatri).trim() === String(selectedStaffToAdd.chucvu).trim());

    return {
      trinhdo: td ? td.giatri : selectedStaffToAdd.trinhdo || '',
      chucvu: cv ? cv.giatri : selectedStaffToAdd.chucvu || '',
      phongban: pb ? pb.giatri : selectedStaffToAdd.phongban || ''
    };
  }, [selectedStaffToAdd, trinhDoList, phongBanList, chucVuList]);

  // Xử lý thay đổi số tháng / ngày bắt đầu trong Form thêm mới
  const handleAddMonthsChange = (months: number) => {
    setAddFormData(prev => ({
      ...prev,
      thoigianthaisan: months,
      ketthuc: calculateEndDate(prev.batdau, months)
    }));
  };

  const handleAddStartDateChange = (startDate: string) => {
    setAddFormData(prev => ({
      ...prev,
      batdau: startDate,
      ketthuc: calculateEndDate(startDate, prev.thoigianthaisan)
    }));
  };

  // Lưu Thêm Mới
  const handleSaveAdd = async () => {
    if (!selectedStaffToAdd) {
      setNoticeModal({
        isOpen: true,
        type: 'error',
        message: 'Vui lòng chọn Giảng viên Nhân viên trước khi lưu!'
      });
      return;
    }

    if (!addFormData.batdau) {
      setNoticeModal({
        isOpen: true,
        type: 'error',
        message: 'Vui lòng chọn ngày bắt đầu nghỉ thai sản!'
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        manv: selectedStaffToAdd.manv,
        thoigianthaisan: Number(addFormData.thoigianthaisan) || 6,
        batdau: addFormData.batdau,
        ketthuc: addFormData.ketthuc || calculateEndDate(addFormData.batdau, addFormData.thoigianthaisan),
        chedosinh: addFormData.chedosinh || 'Sinh thường',
        ghichu: (addFormData.ghichu || '').trim()
      };

      const { error } = await supabase.from('DanhSachThaiSan').insert([payload]);

      if (error) throw error;

      setIsAddModalOpen(false);
      setNoticeModal({
        isOpen: true,
        type: 'success',
        message: 'Hệ thống đã thêm mới hồ sơ thai sản'
      });
      await fetchData();
    } catch (err: any) {
      console.error('Lỗi khi thêm hồ sơ thai sản:', err);
      setNoticeModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi thêm mới dữ liệu: ' + (err.message || String(err))
      });
    } finally {
      setSaving(false);
    }
  };

  // Mở modal Hiệu chỉnh
  const handleOpenEditModal = (item: DanhSachThaiSan) => {
    setEditingItem(item);
    setEditFormData({
      thoigianthaisan: Number(item.thoigianthaisan) || 6,
      batdau: formatDateInput(item.batdau),
      ketthuc: formatDateInput(item.ketthuc),
      chedosinh: item.chedosinh || 'Sinh thường',
      ghichu: item.ghichu || ''
    });
    setIsEditModalOpen(true);
  };

  // Xử lý thay đổi số tháng / ngày bắt đầu trong Form hiệu chỉnh
  const handleEditMonthsChange = (months: number) => {
    setEditFormData(prev => ({
      ...prev,
      thoigianthaisan: months,
      ketthuc: calculateEndDate(prev.batdau, months)
    }));
  };

  const handleEditStartDateChange = (startDate: string) => {
    setEditFormData(prev => ({
      ...prev,
      batdau: startDate,
      ketthuc: calculateEndDate(startDate, prev.thoigianthaisan)
    }));
  };

  // Lưu Hiệu chỉnh
  const handleSaveEdit = async () => {
    if (!editingItem) return;

    if (!editFormData.batdau) {
      setNoticeModal({
        isOpen: true,
        type: 'error',
        message: 'Vui lòng chọn ngày bắt đầu nghỉ thai sản!'
      });
      return;
    }

    setSaving(true);
    try {
      const updates = {
        thoigianthaisan: Number(editFormData.thoigianthaisan) || 6,
        batdau: editFormData.batdau,
        ketthuc: editFormData.ketthuc || calculateEndDate(editFormData.batdau, editFormData.thoigianthaisan),
        chedosinh: editFormData.chedosinh || 'Sinh thường',
        ghichu: (editFormData.ghichu || '').trim()
      };

      let query = supabase.from('DanhSachThaiSan').update(updates);
      if (editingItem.id) {
        query = query.eq('id', editingItem.id);
      } else if (editingItem.maso) {
        query = query.eq('maso', editingItem.maso);
      } else {
        query = query.eq('manv', editingItem.manv);
      }

      const { error } = await query;
      if (error) throw error;

      setIsEditModalOpen(false);
      setNoticeModal({
        isOpen: true,
        type: 'success',
        message: 'Hệ thống đã lưu các thay đổi'
      });
      await fetchData();
    } catch (err: any) {
      console.error('Lỗi khi lưu thay đổi thai sản:', err);
      setNoticeModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi lưu thay đổi: ' + (err.message || String(err))
      });
    } finally {
      setSaving(false);
    }
  };

  // Xác nhận Xóa
  const handleOpenDeleteConfirm = (item: DanhSachThaiSan) => {
    setDeleteConfirm({
      isOpen: true,
      item
    });
  };

  const handleExecuteDelete = async () => {
    if (!deleteConfirm.item) return;
    const itemToDelete = deleteConfirm.item;
    const staffName = `${itemToDelete.holot || ''} ${itemToDelete.ten || ''}`.trim() || itemToDelete.manv;

    setSaving(true);
    try {
      let query = supabase.from('DanhSachThaiSan').delete();
      if (itemToDelete.id) {
        query = query.eq('id', itemToDelete.id);
      } else if (itemToDelete.maso) {
        query = query.eq('maso', itemToDelete.maso);
      } else {
        query = query.eq('manv', itemToDelete.manv);
      }

      const { error } = await query;
      if (error) throw error;

      setDeleteConfirm({ isOpen: false, item: null });
      setNoticeModal({
        isOpen: true,
        type: 'success',
        message: `Đã xóa hồ sơ thai sản của ${staffName} ra khỏi danh sách`
      });
      await fetchData();
    } catch (err: any) {
      console.error('Lỗi khi xóa hồ sơ thai sản:', err);
      setDeleteConfirm({ isOpen: false, item: null });
      setNoticeModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi xóa dữ liệu, hãy kiểm tra lại!'
      });
    } finally {
      setSaving(false);
    }
  };

  // Xuất Excel
  const handleExportExcel = () => {
    try {
      const exportData = filteredData.map((item, index) => ({
        'STT': index + 1,
        'Mã NV': item.manv,
        'Họ và Tên': `${item.holot || ''} ${item.ten || ''}`.trim(),
        'Trình độ': item.ten_trinhdo || '',
        'Đơn vị công tác': item.ten_phongban || '',
        'Chức vụ': item.ten_chucvu || '',
        'Số tháng': item.thoigianthaisan || '',
        'Bắt đầu': formatDateDisplay(item.batdau),
        'Kết thúc': formatDateDisplay(item.ketthuc),
        'Chế độ sinh': item.chedosinh || '',
        'Ghi chú': item.ghichu || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DanhSachThaiSan');
      XLSX.writeFile(wb, 'DanhSachGVNVNghiThaiSan.xlsx');
    } catch (err: any) {
      console.error('Lỗi xuất excel:', err);
      setNoticeModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi khi xuất file Excel: ' + (err.message || String(err))
      });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2.5">
            <span className="p-2 bg-pink-100 text-pink-700 rounded-xl">
              <Users className="h-5 w-5" />
            </span>
            Danh sách GVNV nghĩ chế độ thai sản
          </h2>
          <p className="text-xs text-gray-500 mt-1 ml-10">
            Quản lý hồ sơ giảng viên và nhân viên nghỉ chế độ thai sản
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-all active:scale-95 text-sm"
          >
            <FileDown className="h-4 w-4" /> Xuất Excel
          </button>
          
          {canCreate && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-all active:scale-95 text-sm"
            >
              <Plus className="h-4 w-4" /> Thêm mới
            </button>
          )}
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm Mã NV, Họ tên..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Lọc Trình độ */}
          <div>
            <select
              value={filterTrinhDo}
              onChange={e => setFilterTrinhDo(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Tất cả">Trình độ: Tất cả</option>
              {uniqueTrinhDoList.map(td => (
                <option key={td} value={td}>{td}</option>
              ))}
            </select>
          </div>

          {/* Lọc Đơn vị */}
          <div>
            <select
              value={filterPhongBan}
              onChange={e => setFilterPhongBan(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Tất cả">Đơn vị: Tất cả</option>
              {uniquePhongBanList.map(pb => (
                <option key={pb} value={pb}>{pb}</option>
              ))}
            </select>
          </div>

          {/* Lọc Chức vụ */}
          <div>
            <select
              value={filterChucVu}
              onChange={e => setFilterChucVu(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Tất cả">Chức vụ: Tất cả</option>
              {uniqueChucVuList.map(cv => (
                <option key={cv} value={cv}>{cv}</option>
              ))}
            </select>
          </div>

          {/* Lọc Chế độ sinh */}
          <div>
            <select
              value={filterCheDo}
              onChange={e => setFilterCheDo(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Tất cả">Chế độ sinh: Tất cả</option>
              {uniqueCheDoList.map(cd => (
                <option key={cd} value={cd}>{cd}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tổng số bản ghi */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
          <span>Tổng số: <strong className="text-gray-800 font-semibold">{filteredData.length}</strong> hồ sơ thai sản</span>
          {(filterTrinhDo !== 'Tất cả' || filterPhongBan !== 'Tất cả' || filterChucVu !== 'Tất cả' || filterCheDo !== 'Tất cả' || searchTerm) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterTrinhDo('Tất cả');
                setFilterPhongBan('Tất cả');
                setFilterChucVu('Tất cả');
                setFilterCheDo('Tất cả');
              }}
              className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
            >
              <X className="h-3.5 w-3.5" /> Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Bảng danh sách */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold">
                <th className="px-3.5 py-3 text-red-600 text-center whitespace-nowrap">STT</th>
                <th className="px-3.5 py-3 text-red-600 whitespace-nowrap">Mã NV</th>
                <th className="px-4 py-3 text-red-600 whitespace-nowrap">Họ và Tên</th>
                <th className="px-3.5 py-3 text-red-600 whitespace-nowrap">Trình độ</th>
                <th className="px-4 py-3 text-red-600 whitespace-nowrap">Đơn vị công tác</th>
                <th className="px-3.5 py-3 text-red-600 whitespace-nowrap">Chức vụ</th>
                <th className="px-3 py-3 text-red-600 text-center whitespace-nowrap">Số tháng</th>
                <th className="px-3.5 py-3 text-red-600 text-center whitespace-nowrap">Bắt đầu</th>
                <th className="px-3.5 py-3 text-red-600 text-center whitespace-nowrap">Kết thúc</th>
                <th className="px-3.5 py-3 text-red-600 whitespace-nowrap">Chế độ sinh</th>
                <th className="px-4 py-3 text-red-600 whitespace-nowrap">Ghi chú</th>
                {(canUpdate || canDelete) && (
                  <th className="px-3.5 py-3 text-red-600 text-center whitespace-nowrap">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs text-gray-800 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={(canUpdate || canDelete) ? 12 : 11} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Đang tải dữ liệu thai sản...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={(canUpdate || canDelete) ? 12 : 11} className="px-6 py-12 text-center text-gray-500">
                    Không tìm thấy bản ghi thai sản nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.id || item.maso || item.manv} className="hover:bg-pink-50/20 transition-colors">
                    <td className="px-3.5 py-3 text-center text-gray-500 font-normal">{index + 1}</td>
                    <td className="px-3.5 py-3 text-blue-600 font-normal whitespace-nowrap">{item.manv}</td>
                    <td className="px-4 py-3 font-normal text-gray-900 whitespace-nowrap">
                      {`${item.holot || ''} ${item.ten || ''}`.trim()}
                    </td>
                    <td className="px-3.5 py-3 text-gray-700 font-normal whitespace-nowrap">{item.ten_trinhdo || '---'}</td>
                    <td className="px-4 py-3 text-gray-700 font-normal whitespace-nowrap">{item.ten_phongban || '---'}</td>
                    <td className="px-3.5 py-3 text-gray-700 font-normal whitespace-nowrap">{item.ten_chucvu || '---'}</td>
                    <td className="px-3 py-3 text-center text-gray-800 font-normal whitespace-nowrap">{item.thoigianthaisan}</td>
                    <td className="px-3.5 py-3 text-center text-gray-700 font-normal whitespace-nowrap">{formatDateDisplay(item.batdau)}</td>
                    <td className="px-3.5 py-3 text-center text-gray-700 font-normal whitespace-nowrap">{formatDateDisplay(item.ketthuc)}</td>
                    <td className="px-3.5 py-3 text-gray-800 font-normal whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[11px] ${item.chedosinh === 'Phẫu thuật' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                        {item.chedosinh || 'Sinh thường'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-normal max-w-xs truncate" title={item.ghichu || ''}>
                      {item.ghichu || '---'}
                    </td>
                    {(canUpdate || canDelete) && (
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {canUpdate && (
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Hiệu chỉnh"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleOpenDeleteConfirm(item)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* ========================================================================= */}
      {/* FORM THÊM MỚI (ThemMoi.JPG) */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#f0f2f5] rounded-xl shadow-2xl border border-gray-300 w-full max-w-2xl overflow-hidden font-sans">
            {/* Window Title Bar */}
            <div className="bg-white px-4 py-2.5 border-b border-gray-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📝</span>
                <span className="font-semibold text-gray-800 text-sm">Thêm mới GVNV nghĩ thai sản</span>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-500 hover:text-red-600 p-1 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Group 1: Thông tin Giảng viên Nhân viên */}
              <fieldset className="border border-gray-300 rounded-md p-3.5 bg-white/60">
                <legend className="px-2 text-xs font-semibold text-blue-900">
                  Thông tin Giảng viên Nhân viên
                </legend>

                <div className="space-y-2.5 text-xs text-gray-800">
                  {/* Row 1: Họ và Tên GVNV + Mã NV */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <label className="col-span-3 text-gray-800 font-medium">Họ và Tên GVNV</label>
                    <div className="col-span-6 relative" ref={staffDropdownRef}>
                      {/* Selection Box / Trigger */}
                      <div
                        onClick={() => setIsStaffDropdownOpen(!isStaffDropdownOpen)}
                        className="w-full flex items-center justify-between border border-gray-300 rounded bg-white cursor-pointer hover:border-gray-400 overflow-hidden"
                      >
                        <div className="px-2.5 py-1.5 text-xs truncate">
                          {selectedStaffToAdd ? (
                            <span className="text-red-600 font-semibold">
                              {selectedStaffToAdd.holot} {selectedStaffToAdd.ten}
                            </span>
                          ) : (
                            <span className="text-gray-400">
                              Click để chọn nhân sự...
                            </span>
                          )}
                        </div>
                        <div className="bg-gray-100 px-3 py-1.5 border-l border-gray-300 text-gray-600 hover:bg-gray-200 text-xs font-bold shrink-0">
                          ...
                        </div>
                      </div>

                      {/* Dropdown Card như mẫu TimKiem.jpg */}
                      {isStaffDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl p-2.5 space-y-2 z-30 min-w-[340px]">
                          {/* Search Input */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Tìm kiếm theo Tên hoặc Mã NV..."
                              value={staffSearchQuery}
                              onChange={e => setStaffSearchQuery(e.target.value)}
                              autoFocus
                              className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                            />
                            {staffSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setStaffSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>

                          {/* List items */}
                          <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                            {filteredStaffSearch.length === 0 ? (
                              <div className="p-3 text-xs text-gray-500 text-center">
                                Không tìm thấy nhân sự phù hợp (Nữ, đang làm việc, &le; 50 tuổi)
                              </div>
                            ) : (
                              filteredStaffSearch.map(staff => (
                                <div
                                  key={staff.manv}
                                  onClick={() => handleSelectStaff(staff)}
                                  className="py-2 px-2.5 hover:bg-blue-50 cursor-pointer rounded transition-colors text-left"
                                >
                                  <div className="font-bold text-gray-900 text-xs">
                                    {staff.holot} {staff.ten}
                                  </div>
                                  <div className="text-[11px] text-gray-500 mt-0.5">
                                    Mã NV: {staff.manv} | Email: {staff.email || 'Chưa cập nhật'}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <label className="col-span-1 text-right text-gray-800 font-medium pr-1">Mã NV</label>
                    <div className="col-span-2">
                      <input
                        type="text"
                        readOnly
                        value={selectedStaffToAdd?.manv || ''}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-xs text-red-600 text-center font-semibold"
                      />
                    </div>
                  </div>

                  {/* Row 2: Trình độ + Chức vụ */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <label className="col-span-3 text-gray-800 font-medium">Trình độ</label>
                    <div className="col-span-4">
                      <input
                        type="text"
                        readOnly
                        value={selectedStaffDetails.trinhdo}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded bg-gray-100 text-xs text-red-600 font-medium"
                      />
                    </div>
                    <label className="col-span-2 text-right text-gray-800 font-medium pr-1">Chức vụ</label>
                    <div className="col-span-3">
                      <input
                        type="text"
                        readOnly
                        value={selectedStaffDetails.chucvu}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded bg-gray-100 text-xs text-red-600 font-medium"
                      />
                    </div>
                  </div>

                  {/* Row 3: Đơn vị công tác */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <label className="col-span-3 text-gray-800 font-medium">Đơn vị công tác</label>
                    <div className="col-span-9">
                      <input
                        type="text"
                        readOnly
                        value={selectedStaffDetails.phongban}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded bg-gray-100 text-xs text-red-600 font-medium"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Group 2: Thông tin chế độ thai sản (Thu hẹp DateTimePicker hiển thị trên 1 dòng như ThayDoiHIenThi.jpg) */}
              <fieldset className="border border-gray-300 rounded-md p-3.5 bg-white/60">
                <legend className="px-2 text-xs font-semibold text-blue-900">
                  Thông tin chế độ thai sản
                </legend>

                <div className="space-y-2.5 text-xs text-gray-800">
                  {/* Row 1: Số tháng nghĩ + Bắt đầu + Kết thúc trên cùng 1 hàng */}
                  <div className="flex items-center gap-2 text-xs">
                    <label className="text-blue-900 font-medium shrink-0">Số tháng nghĩ</label>
                    <select
                      value={addFormData.thoigianthaisan}
                      onChange={e => handleAddMonthsChange(Number(e.target.value))}
                      className="w-16 px-2 py-1 border border-gray-300 rounded bg-white text-xs text-red-600 font-semibold focus:outline-none focus:border-blue-500 shrink-0"
                    >
                      {Array.from({ length: 24 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num} className="text-red-600 font-semibold">{num}</option>
                      ))}
                    </select>

                    <label className="text-blue-900 font-medium shrink-0 ml-1">Bắt đầu</label>
                    <input
                      type="date"
                      value={addFormData.batdau}
                      onChange={e => handleAddStartDateChange(e.target.value)}
                      className="w-32 px-1.5 py-1 border border-gray-300 rounded bg-white text-xs text-red-600 font-semibold focus:outline-none focus:border-blue-500 shrink-0"
                    />

                    <label className="text-blue-900 font-medium shrink-0 ml-1">Kết thúc</label>
                    <input
                      type="date"
                      value={addFormData.ketthuc}
                      onChange={e => setAddFormData({ ...addFormData, ketthuc: e.target.value })}
                      className="w-32 px-1.5 py-1 border border-gray-300 rounded bg-white text-xs text-red-600 font-semibold focus:outline-none focus:border-blue-500 shrink-0"
                    />
                  </div>

                  {/* Row 2: Chế độ sinh + Ghi chú */}
                  <div className="flex items-center gap-2 text-xs">
                    <label className="text-blue-900 font-medium shrink-0 w-[84px]">Chế độ sinh</label>
                    <select
                      value={addFormData.chedosinh}
                      onChange={e => setAddFormData({ ...addFormData, chedosinh: e.target.value })}
                      className="w-32 px-2 py-1 border border-gray-300 rounded bg-white text-xs text-red-600 font-semibold focus:outline-none focus:border-blue-500 shrink-0"
                    >
                      <option value="Sinh thường" className="text-red-600 font-semibold">Sinh thường</option>
                      <option value="Phẫu thuật" className="text-red-600 font-semibold">Phẫu thuật</option>
                    </select>

                    <label className="text-blue-900 font-medium shrink-0 ml-1">Ghi chú</label>
                    <input
                      type="text"
                      value={addFormData.ghichu}
                      onChange={e => setAddFormData({ ...addFormData, ghichu: e.target.value })}
                      placeholder="Nhập ghi chú (nếu có)..."
                      className="flex-1 px-2.5 py-1 border border-gray-300 rounded bg-white text-xs text-red-600 font-medium placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Action Buttons (Style như ảnh ThemMoi.JPG) */}
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleSaveAdd}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-white hover:bg-gray-50 text-gray-800 font-medium text-xs rounded border border-gray-300 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <span className="text-gray-700 text-sm">💾</span>
                  )}
                  <span>Lưu mới</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-white hover:bg-gray-50 text-gray-800 font-medium text-xs rounded border border-gray-300 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="text-red-600 font-bold text-sm">✕</span>
                  <span>Hủy bỏ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FORM HIỆU CHỈNH (HieuChinh.JPG) */}
      {/* ========================================================================= */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#f0f2f5] rounded-xl shadow-2xl border border-gray-300 w-full max-w-2xl overflow-hidden font-sans">
            {/* Window Title Bar */}
            <div className="bg-white px-4 py-2.5 border-b border-gray-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📝</span>
                <span className="font-semibold text-gray-800 text-sm">Hiệu chỉnh thông tin nghĩ thai sản</span>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-500 hover:text-red-600 p-1 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Group 1: Thông tin Giảng viên Nhân viên (Chữ màu đỏ, readOnly) */}
              <fieldset className="border border-gray-300 rounded-md p-3.5 bg-white/60">
                <legend className="px-2 text-xs font-semibold text-blue-900">
                  Thông tin Giảng viên Nhân viên
                </legend>

                <div className="space-y-2.5 text-xs text-gray-800">
                  {/* Row 1: Họ và Tên GVNV + Mã NV */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <label className="col-span-3 text-gray-800 font-medium">Họ và Tên GVNV</label>
                    <div className="col-span-6">
                      <input
                        type="text"
                        readOnly
                        value={`${editingItem.holot || ''} ${editingItem.ten || ''}`.trim()}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded bg-white text-xs text-red-600 font-medium focus:outline-none"
                      />
                    </div>
                    <label className="col-span-1 text-right text-gray-800 font-medium pr-1">Mã NV</label>
                    <div className="col-span-2">
                      <input
                        type="text"
                        readOnly
                        value={editingItem.manv}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-xs text-red-600 text-center font-medium focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Row 2: Trình độ + Chức vụ */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <label className="col-span-3 text-gray-800 font-medium">Trình độ</label>
                    <div className="col-span-4">
                      <input
                        type="text"
                        readOnly
                        value={editingItem.ten_trinhdo || '---'}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded bg-white text-xs text-red-600 font-medium focus:outline-none"
                      />
                    </div>
                    <label className="col-span-2 text-right text-gray-800 font-medium pr-1">Chức vụ</label>
                    <div className="col-span-3">
                      <input
                        type="text"
                        readOnly
                        value={editingItem.ten_chucvu || '---'}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded bg-white text-xs text-red-600 font-medium focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Row 3: Đơn vị công tác */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <label className="col-span-3 text-gray-800 font-medium">Đơn vị công tác</label>
                    <div className="col-span-9">
                      <input
                        type="text"
                        readOnly
                        value={editingItem.ten_phongban || '---'}
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded bg-white text-xs text-red-600 font-medium focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Group 2: Thông tin chế độ thai sản (Cho phép hiệu chỉnh) */}
              <fieldset className="border border-gray-300 rounded-md p-3.5 bg-white/60">
                <legend className="px-2 text-xs font-semibold text-blue-900">
                  Thông tin chế độ thai sản
                </legend>

                <div className="space-y-2.5 text-xs text-gray-800">
                  {/* Row 1: Số tháng nghĩ + Bắt đầu + Kết thúc */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <label className="col-span-3 text-blue-900 font-medium">Số tháng nghĩ</label>
                    <div className="col-span-2">
                      <select
                        value={editFormData.thoigianthaisan}
                        onChange={e => handleEditMonthsChange(Number(e.target.value))}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
                    </div>

                    <label className="col-span-1 text-center text-blue-900 font-medium">Bắt đầu</label>
                    <div className="col-span-3">
                      <input
                        type="date"
                        value={editFormData.batdau}
                        onChange={e => handleEditStartDateChange(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded bg-white text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <label className="col-span-1 text-center text-blue-900 font-medium">Kết thúc</label>
                    <div className="col-span-2">
                      <input
                        type="date"
                        value={editFormData.ketthuc}
                        onChange={e => setEditFormData({ ...editFormData, ketthuc: e.target.value })}
                        className="w-full px-1.5 py-1 border border-gray-300 rounded bg-white text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Row 2: Chế độ sinh + Ghi chú */}
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <label className="col-span-3 text-blue-900 font-medium">Chế độ sinh</label>
                    <div className="col-span-3">
                      <select
                        value={editFormData.chedosinh}
                        onChange={e => setEditFormData({ ...editFormData, chedosinh: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded bg-white text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                      >
                        <option value="Sinh thường">Sinh thường</option>
                        <option value="Phẫu thuật">Phẫu thuật</option>
                      </select>
                    </div>

                    <label className="col-span-1 text-center text-blue-900 font-medium">Ghi chú</label>
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={editFormData.ghichu}
                        onChange={e => setEditFormData({ ...editFormData, ghichu: e.target.value })}
                        placeholder="Nhập ghi chú (nếu có)..."
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded bg-white text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Action Buttons (Style như ảnh HieuChinh.JPG) */}
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-white hover:bg-gray-50 text-gray-800 font-medium text-xs rounded border border-gray-300 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <span className="text-gray-700 text-sm">💾</span>
                  )}
                  <span>Lưu thay đổi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-white hover:bg-gray-50 text-gray-800 font-medium text-xs rounded border border-gray-300 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="text-red-600 font-bold text-sm">✕</span>
                  <span>Hủy bỏ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL XÁC NHẬN XÓA */}
      {/* ========================================================================= */}
      {deleteConfirm.isOpen && deleteConfirm.item && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="text-base font-bold text-gray-800">Xác nhận xóa hồ sơ thai sản</h3>

            <p className="text-sm text-gray-600 leading-relaxed">
              Bạn chắc chắn muốn xóa hồ sơ thai sản của GVNV{' '}
              <strong className="text-red-600 font-semibold">
                {`${deleteConfirm.item.holot || ''} ${deleteConfirm.item.ten || ''}`.trim() || deleteConfirm.item.manv}
              </strong>{' '}
              ra khỏi danh sách?
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={saving}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? 'Đang xóa...' : 'Đồng ý'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm({ isOpen: false, item: null })}
                disabled={saving}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-all active:scale-95 disabled:opacity-50"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL THÔNG BÁO HỆ THỐNG */}
      {/* ========================================================================= */}
      {noticeModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden p-6 text-center space-y-4">
            <div className="mx-auto flex items-center justify-center">
              {noticeModal.type === 'success' ? (
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              ) : noticeModal.type === 'error' ? (
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6" />
                </div>
              )}
            </div>

            <p className="text-sm font-medium text-gray-800 leading-relaxed">
              {noticeModal.message}
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setNoticeModal({ isOpen: false, type: 'info', message: '' })}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
