
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission } from '../services/permissionService';
import { UserAccount, NhanVien, PhongBan, RolePermission } from '../types';
import { 
  Search, FileDown, Plus, Users, Loader2, X, Save, FileUp,
  User as UserIcon, Building2, Mail, ShieldCheck, MoreHorizontal, CheckCircle2, KeyRound, AlertTriangle, Edit2
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Giả lập hàm băm mật khẩu Argon2 sử dụng crypto subtle API (SHA-256)
const hashPasswordArgon2 = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `$argon2id$v=19$m=65536,t=3,p=4$${hashHex}`;
};

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

export const UserManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean }> = ({ permissions, isAdmin }) => {
  const [userList, setUserList] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Admin Change Password States
  const [isAdminPassModalOpen, setIsAdminPassModalOpen] = useState(false);
  const [adminRecord, setAdminRecord] = useState<UserAccount | null>(null);
  const [adminPassForm, setAdminPassForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // User Action States
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [isUserPassModalOpen, setIsUserPassModalOpen] = useState(false);
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);
  const [userPassForm, setUserPassForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [userInfoForm, setUserInfoForm] = useState({
    username: '',
    email: '',
    enable: true
  });
  
  // Custom Notification Modal State
  const [notifyModal, setNotifyModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    message: ''
  });

  // Add New User Form States
  const [addForm, setAddForm] = useState({
    manv: '',
    username: '',
    password: '',
    email: '',
    donvi: '',
    holot: '',
    ten: ''
  });

  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [loadingStaff, setLoadingStaff] = useState(false);
  
  const staffDropdownRef = useRef<HTMLDivElement>(null);
  const staffSearchRef = useRef<HTMLInputElement>(null);

  // Permission Logic
  const canCreate = checkPermission(permissions, isAdmin, 'quanLyNguoiDung', 'CREATE');
  const canUpdate = checkPermission(permissions, isAdmin, 'quanLyNguoiDung', 'UPDATE');
  const canDelete = checkPermission(permissions, isAdmin, 'quanLyNguoiDung', 'DELETE');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, nvRes, pbRes] = await Promise.all([
        supabase.from('Users').select('*').order('id', { ascending: true }),
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, phongban, email'),
        supabase.from('DanhMucPhongBan').select('*')
      ]);

      if (usersRes.error) throw usersRes.error;

      const nvs = (nvRes.data || []).map(normalizeKeys);
      const pbs = (pbRes.data || []).map(normalizeKeys);

      const allUsers = (usersRes.data || []).map(item => normalizeKeys(item) as UserAccount);
      
      // Theo yêu cầu: Tài khoản Admin là Tài khoản có ID=1
      const admin = allUsers.find(u => Number(u.id) === 1);
      setAdminRecord(admin || null);

      const joinedData = allUsers
        // Chỉ hiển thị Tài khoản người dùng (ID != 1), không hiển thị Admin
        .filter(u => Number(u.id) !== 1)
        .map(u => {
          const nv = nvs.find(e => String(e.manv) === String(u.manv));
          const pb = nv ? pbs.find(p => String(p.maphongban) === String(nv.phongban)) : null;

          return {
            ...u,
            holot: nv?.holot || '---',
            ten: nv?.ten || '---',
            ten_phongban: pb ? pb.giatri : (nv?.phongban || '---')
          };
        });

      setUserList(joinedData);
      setAvailableStaff(nvs.map(nv => {
        const pb = pbs.find(p => String(p.maphongban) === String(nv.phongban));
        return { ...nv, ten_phongban: pb ? pb.giatri : nv.phongban };
      }));
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi tải danh sách người dùng: ' + (err.message || err)
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

  const handleOpenAdd = () => {
    setAddForm({ manv: '', username: '', password: '', email: '', donvi: '', holot: '', ten: '' });
    setStaffSearchQuery('');
    setIsStaffDropdownOpen(false);
    setIsAddModalOpen(true);
  };

  const handleOpenImportModal = () => {
    setImportFile(null);
    setIsImportModalOpen(true);
  };

  const handleOpenAdminPass = () => {
    setAdminPassForm({
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setIsAdminPassModalOpen(true);
  };

  const handleOpenUserPass = (u: UserAccount) => {
    setSelectedUser(u);
    setUserPassForm({ newPassword: '', confirmPassword: '' });
    setIsUserPassModalOpen(true);
  };

  const handleOpenUserInfo = (u: UserAccount) => {
    setSelectedUser(u);
    setUserInfoForm({
      username: u.username || '',
      email: u.email || '',
      enable: u.enable ?? true
    });
    setIsUserInfoModalOpen(true);
  };

  const handleOpenAddStaffDropdown = async () => {
    setIsStaffDropdownOpen(true);
    setLoadingStaff(true);
    setStaffSearchQuery('');
    try {
      const [nvRes, pbRes] = await Promise.all([
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, phongban, email').eq('danghiviec', false),
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
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi tải danh sách nhân viên: ' + (err.message || err)
      });
    } finally {
      setLoadingStaff(false);
      setTimeout(() => staffSearchRef.current?.focus(), 100);
    }
  };

  const handleSelectStaff = (s: any) => {
    setAddForm({
      ...addForm,
      manv: s.manv,
      email: s.email || '',
      donvi: s.ten_phongban || '',
      holot: s.holot,
      ten: s.ten
    });
    setIsStaffDropdownOpen(false);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.manv || !addForm.password) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Vui lòng chọn nhân sự và nhập mật khẩu.'
      });
      return;
    }

    setSaving(true);
    try {
      const passwordHash = await hashPasswordArgon2(addForm.password);
      
      const payload = {
        manv: addForm.manv,
        username: addForm.username || '',
        email: addForm.email || '',
        passwordhash: passwordHash,
        enable: true
      };

      const { error } = await supabase.from('Users').insert([payload]);
      if (error) throw error;

      setIsAddModalOpen(false);
      setShowSuccess(true);
      fetchData();
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi khi thêm mới: ' + (err.message || err)
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdminPassword = async () => {
    if (!adminRecord) return;
    
    const isOldPassEmpty = !adminRecord.passwordhash || adminRecord.passwordhash === '';
    
    // 1. Kiểm tra mật khẩu cũ nếu có dữ liệu băm đã lưu
    if (!isOldPassEmpty) {
      const hashedOldInput = await hashPasswordArgon2(adminPassForm.oldPassword);
      if (hashedOldInput !== adminRecord.passwordhash) {
        setNotifyModal({
          isOpen: true,
          type: 'error',
          message: 'Mật khẩu cũ không đúng hoặc mật khẩu mới không hợp lệ. Kiểm tra lại nhé !'
        });
        return;
      }
    }

    // 2. Kiểm tra mật khẩu mới và xác nhận mật khẩu
    if (!adminPassForm.newPassword || adminPassForm.newPassword !== adminPassForm.confirmPassword) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Mật khẩu cũ không đúng hoặc mật khẩu mới không hợp lệ. Kiểm tra lại nhé !'
      });
      return;
    }

    setSaving(true);
    try {
      const newHash = await hashPasswordArgon2(adminPassForm.newPassword);
      const { error } = await supabase
        .from('Users')
        .update({ passwordhash: newHash })
        .eq('id', adminRecord.id);

      if (error) throw error;

      setIsAdminPassModalOpen(false);
      setNotifyModal({
        isOpen: true,
        type: 'success',
        message: 'Thay đổi mật khẩu thành công!'
      });
      fetchData();
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi khi thay đổi mật khẩu: ' + (err.message || err)
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUserPassword = async () => {
    if (!selectedUser) return;
    if (userPassForm.newPassword !== userPassForm.confirmPassword) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Mật khẩu mới không trùng khớp. Kiểm tra lại nhé !'
      });
      return;
    }

    setSaving(true);
    try {
      const newHash = await hashPasswordArgon2(userPassForm.newPassword);
      const { error } = await supabase
        .from('Users')
        .update({ passwordhash: newHash })
        .eq('id', selectedUser.id);

      if (error) throw error;

      setIsUserPassModalOpen(false);
      setNotifyModal({
        isOpen: true,
        type: 'success',
        message: 'Thay đổi mật khẩu người dùng thành công!'
      });
      fetchData();
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi khi thay đổi mật khẩu người dùng: ' + (err.message || err)
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUserInfo = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    try {
      // Kiểm tra trùng lặp
      const { data: duplicates } = await supabase
        .from('Users')
        .select('id, username, email')
        .or(`username.eq.${userInfoForm.username},email.eq.${userInfoForm.email}`)
        .neq('id', selectedUser.id);

      if (duplicates && duplicates.length > 0) {
        setNotifyModal({
          isOpen: true,
          type: 'error',
          message: 'Username hoặc Email đã tồn tại, kiểm tra lại nhé !'
        });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('Users')
        .update({
          username: userInfoForm.username,
          email: userInfoForm.email,
          enable: userInfoForm.enable
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      setIsUserInfoModalOpen(false);
      setNotifyModal({
        isOpen: true,
        type: 'success',
        message: 'Thay đổi thông tin tài khoản thành công!'
      });
      fetchData();
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi khi thay đổi thông tin: ' + (err.message || err)
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredStaffDropdown = useMemo(() => {
    if (!staffSearchQuery.trim()) return availableStaff.slice(0, 50);
    const s = staffSearchQuery.toLowerCase();
    return availableStaff.filter(st => 
      String(st.manv).toLowerCase().includes(s) || 
      `${st.holot} ${st.ten}`.toLowerCase().includes(s)
    ).slice(0, 50);
  }, [availableStaff, staffSearchQuery]);

  const filteredUsers = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return userList.filter(u => 
      (u.username || '').toLowerCase().includes(s) || 
      String(u.manv).toLowerCase().includes(s) || 
      (u.email || '').toLowerCase().includes(s) ||
      `${u.holot} ${u.ten}`.toLowerCase().includes(s)
    );
  }, [userList, searchTerm]);

  const handleImportExcel = async () => {
    if (!importFile) return;

    setSaving(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        const requiredColumns = ['username', 'enable', 'manv', 'email'];
        const missingColumns = requiredColumns.filter(col => !Object.keys(json[0] || {}).includes(col));

        if (missingColumns.length > 0) {
          setNotifyModal({
            isOpen: true,
            type: 'error',
            message: `File Excel thiếu các cột bắt buộc: ${missingColumns.join(', ')}`
          });
          setSaving(false);
          return;
        }

        const usersToInsert = [];
        for (const row of json) {
          const normalizedRow = normalizeKeys(row);
          if (!normalizedRow.username || !normalizedRow.manv) {
            setNotifyModal({
              isOpen: true,
              type: 'error',
              message: 'Bỏ qua hàng do thiếu dữ liệu bắt buộc: ' + JSON.stringify(normalizedRow)
            });
            continue;
          }

          usersToInsert.push({
            username: normalizedRow.username,
            enable: normalizedRow.enable ?? true,
            manv: normalizedRow.manv,
            email: normalizedRow.email || null,
          });
        }

        if (usersToInsert.length > 0) {
          const { error } = await supabase.from('Users').insert(usersToInsert);
          if (error) throw error;

          setNotifyModal({
            isOpen: true,
            type: 'success',
            message: `Đã import thành công ${usersToInsert.length} người dùng.`
          });
          setIsImportModalOpen(false);
          fetchData();
        } else {
          setNotifyModal({
            isOpen: true,
            type: 'error',
            message: 'Không có dữ liệu hợp lệ để import.'
          });
        }
      };
      reader.readAsArrayBuffer(importFile);
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: `Lỗi khi import file: ${err.message}`
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredUsers.map((u, idx) => ({
      'ID': u.id,
      'Username': u.username,
      'Mã NV': u.manv,
      'Họ và Tên': `${u.holot} ${u.ten}`,
      'Đơn vị': u.ten_phongban,
      'Email': u.email,
      'Enable': u.enable ? 'True' : 'False'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachNguoiDung");
    XLSX.writeFile(wb, "DanhSachNguoiDung_HRM.xlsx");
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-800 p-2.5 rounded-xl shadow-lg">
            <Users className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-blue-900 tracking-tight">Quản lý Danh sách User</h2>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {isAdmin && (
            <button onClick={handleOpenAdminPass} className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-md">
              <KeyRound className="h-4 w-4 mr-2" /> Đổi mật khẩu Admin
            </button>
          )}
          <button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md">
            <FileDown className="h-4 w-4 mr-2" /> Xuất Excel
          </button>
          {canCreate && (
            <button onClick={handleOpenImportModal} className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md">
              <FileUp className="h-4 w-4 mr-2" /> Import Danh sách
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm theo Username, Mã NV hoặc Email..." 
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="mt-4">
          {canCreate && (
          <button onClick={handleOpenAdd} className="flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-all">
            <Plus className="h-4 w-4 mr-2" /> Thêm mới
          </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left border-collapse">
            <thead className="bg-gray-50/80 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-16">ID</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600">Username</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-32">Mã NV</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600">Họ và Tên</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600">Đơn vị</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-24">Enable</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-48">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-600" />
                    <p className="mt-2 text-gray-400 font-bold text-xs">đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy người dùng nào.</td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-center text-gray-500">{u.id}</td>
                    <td className="px-6 py-4 text-sm text-blue-900 font-bold">{u.username || '---'}</td>
                    <td className="px-6 py-4 text-sm text-center text-red-600 font-bold">{u.manv}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{u.holot} {u.ten}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{u.ten_phongban}</td>
                    <td className="px-6 py-4 text-sm text-blue-600 italic">{u.email || '---'}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${u.enable ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {u.enable ? 'True' : 'False'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        {canUpdate && (
                        <button 
                          onClick={() => handleOpenUserPass(u)}
                          className="px-2 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 border border-amber-100"
                        >
                          <KeyRound size={14} /> Đổi password
                        </button>
                        )}
                        {canUpdate && (
                        <button 
                          onClick={() => handleOpenUserInfo(u)}
                          className="px-2 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 border border-blue-100"
                        >
                          <Edit2 size={14} /> Hiệu chỉnh
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

      {/* Admin Change Password Modal (Admin ID=1) */}
      {isAdminPassModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#f0f0f0] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border-t-4 border-blue-600">
            <div className="bg-white px-4 py-2 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="size-5 flex items-center justify-center">
                  <img src="https://lh3.googleusercontent.com/d/1OD0yKOMSr4sY3dnYcxsCNHypDna9BfT3" className="w-full" alt="Icon" />
                </div>
                <h3 className="text-sm font-medium text-gray-600">Thay đổi password tài khoản admin</h3>
              </div>
              <button onClick={() => setIsAdminPassModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="border border-gray-300 rounded-md p-6 relative bg-white/50 mt-2">
                <span className="absolute -top-3 left-4 bg-[#f0f0f0] px-2 text-sm font-bold text-red-500">Thông tin</span>
                
                <div className="space-y-5">
                  <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                    <label className="text-sm font-bold text-blue-800">Mật khẩu cũ</label>
                    <input 
                      type="password"
                      disabled={!adminRecord?.passwordhash || adminRecord?.passwordhash === ''}
                      className={`w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm focus:border-blue-500 outline-none ${(!adminRecord?.passwordhash || adminRecord?.passwordhash === '') ? 'bg-gray-100 cursor-not-allowed opacity-50' : ''}`}
                      value={adminPassForm.oldPassword}
                      onChange={e => setAddForm({ ...addForm })} // dummy update
                      onInput={(e: any) => setAdminPassForm({...adminPassForm, oldPassword: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                    <label className="text-sm font-bold text-blue-800">Mật khẩu mới</label>
                    <input 
                      type="password"
                      className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm focus:border-blue-500 outline-none"
                      value={adminPassForm.newPassword}
                      onChange={e => setAdminPassForm({...adminPassForm, newPassword: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                    <label className="text-sm font-bold text-blue-800">Xác nhận mật khẩu mới</label>
                    <input 
                      type="password"
                      className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm focus:border-blue-500 outline-none"
                      value={adminPassForm.confirmPassword}
                      onChange={e => setAdminPassForm({...adminPassForm, confirmPassword: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4 mt-6">
                <button 
                  onClick={handleSaveAdminPassword}
                  disabled={saving}
                  className="flex items-center gap-2 bg-white border border-gray-300 px-6 py-1.5 text-sm font-medium text-black hover:bg-gray-100 shadow-sm transition-all disabled:opacity-50"
                >
                  <FileDown className="size-5 text-blue-500" />
                  <span>Lưu thay đổi</span>
                </button>
                <button 
                  onClick={() => setIsAdminPassModalOpen(false)}
                  className="flex items-center gap-2 bg-white border border-gray-300 px-6 py-1.5 text-sm font-medium text-black hover:bg-gray-100 shadow-sm transition-all"
                >
                  <X className="size-5 text-red-500" />
                  <span>Hủy bỏ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Change Password Modal */}
      {isUserPassModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#f0f0f0] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border-t-4 border-amber-500">
            <div className="bg-white px-4 py-2 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="size-5 flex items-center justify-center">
                  <KeyRound className="h-4 w-4 text-amber-500" />
                </div>
                <h3 className="text-sm font-medium text-gray-600">Thay đổi password người dùng</h3>
              </div>
              <button onClick={() => setIsUserPassModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="border border-gray-300 rounded-md p-6 relative bg-white/50 mt-2">
                <span className="absolute -top-3 left-4 bg-[#f0f0f0] px-2 text-sm font-bold text-red-500">Thông tin</span>
                
                <div className="space-y-5">
                  <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                    <label className="text-sm font-bold text-blue-800">Mật khẩu mới</label>
                    <input 
                      type="password"
                      className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm focus:border-blue-500 outline-none"
                      value={userPassForm.newPassword}
                      onChange={e => setUserPassForm({...userPassForm, newPassword: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                    <label className="text-sm font-bold text-blue-800">Xác nhận mật khẩu mới</label>
                    <input 
                      type="password"
                      className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm focus:border-blue-500 outline-none"
                      value={userPassForm.confirmPassword}
                      onChange={e => setUserPassForm({...userPassForm, confirmPassword: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4 mt-6">
                <button 
                  onClick={handleSaveUserPassword}
                  disabled={saving}
                  className="flex items-center gap-2 bg-white border border-gray-300 px-6 py-1.5 text-sm font-medium text-black hover:bg-gray-100 shadow-sm transition-all disabled:opacity-50"
                >
                  <FileDown className="size-5 text-blue-500" />
                  <span>Lưu thay đổi</span>
                </button>
                <button 
                  onClick={() => setIsUserPassModalOpen(false)}
                  className="flex items-center gap-2 bg-white border border-gray-300 px-6 py-1.5 text-sm font-medium text-black hover:bg-gray-100 shadow-sm transition-all"
                >
                  <X className="size-5 text-red-500" />
                  <span>Hủy bỏ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Info Modal */}
      {isUserInfoModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#f0f0f0] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border-t-4 border-blue-600">
            <div className="bg-white px-4 py-2 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="size-5 flex items-center justify-center">
                  <Edit2 className="h-4 w-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-600">Hiệu chỉnh thông tin</h3>
              </div>
              <button onClick={() => setIsUserInfoModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="border border-gray-300 rounded-md p-6 relative bg-white/50 mt-2">
                <span className="absolute -top-3 left-4 bg-[#f0f0f0] px-2 text-sm font-bold text-red-500">Thông tin tài khoản</span>
                
                <div className="space-y-5">
                  <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                    <label className="text-sm font-bold text-blue-800">Username</label>
                    <input 
                      type="text"
                      className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm focus:border-blue-500 outline-none"
                      value={userInfoForm.username}
                      onChange={e => setUserInfoForm({...userInfoForm, username: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                    <label className="text-sm font-bold text-blue-800">Email</label>
                    <input 
                      type="email"
                      className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm focus:border-blue-500 outline-none"
                      value={userInfoForm.email}
                      onChange={e => setUserInfoForm({...userInfoForm, email: e.target.value})}
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox"
                      id="disable-account"
                      className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500"
                      checked={!userInfoForm.enable}
                      onChange={e => setUserInfoForm({...userInfoForm, enable: !e.target.checked})}
                    />
                    <label htmlFor="disable-account" className="text-sm italic font-bold text-red-500">Vô hiệu hóa tài khoản</label>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4 mt-6">
                <button 
                  onClick={handleSaveUserInfo}
                  disabled={saving}
                  className="flex items-center gap-2 bg-white border border-gray-300 px-6 py-1.5 text-sm font-medium text-black hover:bg-gray-100 shadow-sm transition-all disabled:opacity-50"
                >
                  <FileDown className="size-5 text-blue-500" />
                  <span>Lưu thay đổi</span>
                </button>
                <button 
                  onClick={() => setIsUserInfoModalOpen(false)}
                  className="flex items-center gap-2 bg-white border border-gray-300 px-6 py-1.5 text-sm font-medium text-black hover:bg-gray-100 shadow-sm transition-all"
                >
                  <X className="size-5 text-red-500" />
                  <span>Hủy bỏ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* General Notification Modal */}
      {notifyModal.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-gray-100">
            <div className={`${notifyModal.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} p-4 text-white flex items-center gap-3`}>
              {notifyModal.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              <h3 className="text-lg font-bold">Thông báo</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className={`font-bold text-sm leading-relaxed ${notifyModal.type === 'error' ? 'text-red-700' : 'text-gray-800'}`}>
                {notifyModal.message}
              </p>
            </div>
            <div className="bg-gray-50 p-4 flex justify-center border-t">
              <button 
                onClick={() => setNotifyModal({ ...notifyModal, isOpen: false })} 
                className={`px-12 py-2 ${notifyModal.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white font-black rounded-xl hover:opacity-90 shadow-md transition-all active:scale-95 text-xs uppercase tracking-widest`}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Users Modal */}
      {isImportModalOpen && ( 
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            <div className="bg-gray-50 border-b p-5 flex justify-between items-center">
              <h3 className="text-xl font-bold text-blue-900">Import Danh sách người dùng</h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={28} /></button>
            </div>

            <div className="p-8 space-y-6">
              <div className="border border-gray-300 rounded-md p-6 relative bg-white/50">
                <span className="absolute -top-3 left-4 bg-[#f0f0f0] px-2 text-sm font-bold text-red-500">Chọn File Excel</span>
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={e => setImportFile(e.target.files ? e.target.files[0] : null)}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
                {importFile && <p className="mt-2 text-sm text-gray-600">Đã chọn file: {importFile.name}</p>}
              </div>

              <div className="flex justify-center gap-6 pt-2">
                <button 
                  onClick={handleImportExcel}
                  disabled={!importFile}
                  className="flex items-center gap-3 bg-white border border-gray-300 px-8 py-2 text-sm font-bold text-black hover:bg-gray-100 shadow-sm transition-all disabled:opacity-50 group"
                >
                  <div className="size-8 flex items-center justify-center">
                    <FileUp className="size-8 text-blue-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <span>Import Dữ liệu</span>
                </button>
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="flex items-center gap-3 bg-white border border-gray-300 px-8 py-2 text-sm font-bold text-black hover:bg-gray-100 shadow-sm transition-all group"
                >
                  <div className="size-8 flex items-center justify-center">
                    <X className="size-8 text-red-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <span>Hủy bỏ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            <div className="bg-gray-50 border-b p-5 flex justify-between items-center">
              <h3 className="text-xl font-bold text-blue-900">Thêm mới tài khoản người dùng</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={28} /></button>
            </div>

            <div className="p-8 space-y-10 overflow-y-auto">
               <section className="space-y-6">
                  <h4 className="text-sm font-bold text-blue-600 border-b-2 border-red-50 pb-1">Thêm người dùng từ danh sách nhân sự</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 relative" ref={staffDropdownRef}>
                      <label className="text-sm font-normal text-red-600 block mb-1.5">Họ và Tên</label>
                      <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 bg-white transition-all">
                        <input 
                          readOnly
                          className="block w-full border-none px-4 py-2.5 text-sm font-bold text-blue-900 focus:ring-0 bg-white cursor-pointer" 
                          placeholder={addForm.manv ? `${addForm.manv} - ${addForm.holot} ${addForm.ten}` : "Nhập tên nhân sự để tìm nhanh"}
                          onClick={handleOpenAddStaffDropdown}
                        />
                        <div className="bg-gray-100 flex items-center px-4 border-l border-gray-200">
                          <MoreHorizontal className="h-5 w-5 text-gray-500" />
                        </div>
                      </div>

                      {isStaffDropdownOpen && (
                        <div className="absolute z-[160] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-60">
                           <div className="p-3 border-b border-gray-100 bg-gray-50">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input 
                                  ref={staffSearchRef}
                                  type="text" 
                                  placeholder="Tìm mã hoặc tên..."
                                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                                  value={staffSearchQuery}
                                  onChange={e => setStaffSearchQuery(e.target.value)}
                                />
                              </div>
                           </div>
                           <div className="overflow-y-auto">
                              {loadingStaff ? (
                                <div className="p-6 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-blue-600" /></div>
                              ) : filteredStaffDropdown.length === 0 ? (
                                <div className="p-6 text-center text-gray-400 italic text-sm">Không tìm thấy nhân sự phù hợp.</div>
                              ) : (
                                filteredStaffDropdown.map(st => (
                                  <div key={st.manv} onClick={() => handleSelectStaff(st)} className="p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center transition-colors">
                                     <div>
                                        <p className="text-sm font-bold text-gray-900">{st.manv} - {st.holot} {st.ten}</p>
                                        <p className="text-[10px] text-blue-600 font-bold">{st.ten_phongban}</p>
                                     </div>
                                  </div>
                                ))
                              )}
                           </div>
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2">
                       <label className="text-sm font-normal text-red-600 block mb-1.5">Đơn vị</label>
                       <input readOnly type="text" value={addForm.donvi} className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold text-blue-900 bg-gray-50 shadow-inner" />
                    </div>
                  </div>
               </section>

               <section className="space-y-6">
                  <h4 className="text-sm font-bold text-blue-600 border-b-2 border-red-50 pb-1">Thông tin tài khoản</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                       <label className="text-sm font-normal text-red-600 block mb-1.5">Mã NV</label>
                       <input readOnly type="text" value={addForm.manv} className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold text-blue-900 bg-gray-50 shadow-inner" />
                    </div>
                    <div>
                       <label className="text-sm font-normal text-red-600 block mb-1.5">Email</label>
                       <input readOnly type="text" value={addForm.email} className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold text-blue-900 bg-gray-50 shadow-inner" />
                    </div>
                    <div>
                       <label className="text-sm font-normal text-red-600 block mb-1.5">Username</label>
                       <input 
                        type="text" 
                        className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={addForm.username}
                        onChange={e => setAddForm({...addForm, username: e.target.value})}
                       />
                    </div>
                    <div>
                       <label className="text-sm font-normal text-red-600 block mb-1.5">Password</label>
                       <input 
                        type="password" 
                        required
                        className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={addForm.password}
                        onChange={e => setAddForm({...addForm, password: e.target.value})}
                       />
                    </div>
                  </div>
               </section>
            </div>

            <div className="bg-gray-50 p-6 border-t border-gray-100 flex justify-center gap-6">
               <button 
                  onClick={handleSaveAdd}
                  disabled={saving || !addForm.manv || !addForm.password.trim()}
                  className="px-10 py-2.5 bg-white border-2 border-blue-600 text-blue-900 font-bold rounded-xl shadow-md hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:border-gray-200"
               >
                  <UserIcon size={18} />
                  {saving ? <Loader2 className="animate-spin h-5 w-5" /> : 'Thêm mới'}
               </button>
               <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-10 py-2.5 bg-white border-2 border-red-600 text-red-600 font-bold rounded-xl shadow-md hover:bg-red-50 transition-all flex items-center gap-2"
               >
                  <X size={20} />
                  Hủy bỏ
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification Modal (Add User) */}
      {showSuccess && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-emerald-100">
              <div className="bg-emerald-600 p-5 text-white flex items-center gap-3">
                 <CheckCircle2 size={28} />
                 <h3 className="text-lg font-bold">Thông báo</h3>
              </div>
              <div className="p-10 text-center space-y-4">
                 <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                    <Save size={32} />
                 </div>
                 <p className="text-gray-800 font-bold text-sm leading-relaxed">Đã thêm mới tài khoản người dùng cho nhân sự</p>
              </div>
              <div className="bg-gray-50 p-4 flex justify-center border-t">
                 <button onClick={() => setShowSuccess(false)} className="px-12 py-2 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 shadow-md transition-all active:scale-95 text-xs uppercase tracking-widest">Đóng</button>
              </div>
           </div>
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left">
         <p className="text-[10px] text-red-400 font-bold tracking-widest italic">
            Hệ thống DAU HR Management | © Quản lý Nhân sự
        </p>
      </div>
    </div>
  );
};
