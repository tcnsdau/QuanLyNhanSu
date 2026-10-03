
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission } from '../services/permissionService';
import { UserRole, Role, UserAccount, NhanVien, PhongBan, RolePermission } from '../types';
import { 
  Search, Plus, Users, Loader2, X, Save, FileUp,
  User as UserIcon, Building2, Mail, ShieldCheck, MoreHorizontal, CheckCircle2, AlertTriangle, Shield, ChevronDown, ChevronUp, Pencil, Trash2
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

export const UserRoleManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean }> = ({ permissions, isAdmin }) => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Permission Logic
  const canCreate = checkPermission(permissions, isAdmin, 'phanQuyen', 'CREATE');
  const canUpdate = checkPermission(permissions, isAdmin, 'phanQuyen', 'UPDATE');
  const canDelete = checkPermission(permissions, isAdmin, 'phanQuyen', 'DELETE');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  // Form states
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | ''>('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [expandedRoleRows, setExpandedRoleRows] = useState<Record<string, boolean>>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUserRole, setEditingUserRole] = useState<(UserRole & { roles: string[]; roleIds: number[] }) | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<number | ''>('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    user: (UserRole & { roles: string[]; roleIds: number[] }) | null;
  }>({
    isOpen: false,
    user: null
  });
  const [deleting, setDeleting] = useState(false);

  const userDropdownRef = useRef<HTMLDivElement>(null);

  const [notifyModal, setNotifyModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    message: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [urRes, rRes, uRes, nvRes, pbRes] = await Promise.all([
        supabase.from('UserRoles').select('*'),
        supabase.from('Roles').select('*').order('rolecode', { ascending: true }),
        supabase.from('Users').select('*'),
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, phongban'),
        supabase.from('DanhMucPhongBan').select('*')
      ]);

      if (urRes.error) throw urRes.error;
      if (rRes.error) throw rRes.error;

      const allRoles = (rRes.data || []).map(normalizeKeys) as Role[];
      setRoles(allRoles);

      const allUsers = (uRes.data || []).map(normalizeKeys) as UserAccount[];
      const allNV = (nvRes.data || []).map(normalizeKeys) as any[];
      const allPB = (pbRes.data || []).map(normalizeKeys) as PhongBan[];

      const joinedData = (urRes.data || []).map(ur => {
        const normalizedUR = normalizeKeys(ur) as UserRole;
        const user = allUsers.find(u => Number(u.id) === Number(normalizedUR.userid));
        const role = allRoles.find(r => Number(r.id) === Number(normalizedUR.roleid));
        const nv = user ? allNV.find(n => String(n.manv) === String(user.manv)) : null;
        const pb = nv ? allPB.find(p => String(p.maphongban) === String(nv.phongban)) : null;

        return {
          ...normalizedUR,
          username: user?.username,
          email: user?.email,
          manv: user?.manv,
          holot: nv?.holot,
          ten: nv?.ten,
          ten_phongban: pb?.giatri || nv?.phongban,
          rolecode: role?.rolecode,
          rolename: role?.rolename
        };
      });

      setUserRoles(joinedData);
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi tải danh sách phân quyền: ' + (err.message || err)
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

  const handleOpenAdd = async () => {
    setIsAddModalOpen(true);
    setSelectedUser(null);
    setSelectedRoleId('');
    setUserSearchQuery('');
    setLoadingUsers(true);
    try {
      const [uRes, nvRes, pbRes, urRes] = await Promise.all([
        supabase.from('Users').select('*'),
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, phongban'),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('UserRoles').select('userid')
      ]);
      
      const existingUserIds = new Set((urRes.data || []).map(ur => Number(ur.userid)));
      
      const allNV = (nvRes.data || []).map(normalizeKeys);
      const allPB = (pbRes.data || []).map(normalizeKeys);
      const allUsers = (uRes.data || [])
        .map(u => {
          const normalized = normalizeKeys(u);
          const nv = allNV.find(n => String(n.manv) === String(normalized.manv));
          const pb = nv ? allPB.find(p => String(p.maphongban) === String(nv.phongban)) : null;
          return {
            ...normalized,
            holot: nv?.holot || '',
            ten: nv?.ten || '',
            ten_phongban: pb?.giatri || nv?.phongban || ''
          };
        })
        .filter(u => !existingUserIds.has(Number(u.id)));

      setUsers(allUsers);
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi tải danh sách người dùng: ' + (err.message || err)
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenImportModal = () => {
    setImportFile(null);
    setIsImportModalOpen(true);
  };

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

        const requiredColumns = ['userid', 'roleid'];
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

        const userRolesToInsert = [];
        for (const row of json) {
          const normalizedRow = normalizeKeys(row);
          if (!normalizedRow.userid || !normalizedRow.roleid) {
            setNotifyModal({
              isOpen: true,
              type: 'error',
              message: 'Bỏ qua hàng do thiếu dữ liệu bắt buộc: ' + JSON.stringify(normalizedRow)
            });
            continue;
          }

          userRolesToInsert.push({
            userid: Number(normalizedRow.userid),
            roleid: Number(normalizedRow.roleid),
          });
        }

        if (userRolesToInsert.length > 0) {
          const { error } = await supabase.from('UserRoles').insert(userRolesToInsert);
          if (error) throw error;

          setNotifyModal({
            isOpen: true,
            type: 'success',
            message: `Đã import thành công ${userRolesToInsert.length} phân quyền.`
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

  const handleSelectUser = (u: UserAccount) => {
    setSelectedUser(u);
    setIsUserDropdownOpen(false);
    setUserSearchQuery('');
  };

  const handleSave = async () => {
    if (!selectedUser || !selectedRoleId) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Vui lòng chọn người dùng và Role.'
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('UserRoles').insert([{
        userid: selectedUser.id,
        roleid: selectedRoleId,
        manv: selectedUser.manv
      }]);

      if (error) throw error;

      setNotifyModal({
        isOpen: true,
        type: 'success',
        message: 'Lưu số liệu thành công'
      });
      setIsAddModalOpen(false);
      fetchData();
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi khi lưu: ' + err.message
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return users.slice(0, 20);
    const s = userSearchQuery.toLowerCase();
    return users.filter(u => 
      (u.username || '').toLowerCase().includes(s) || 
      String(u.manv).toLowerCase().includes(s) || 
      (u.email || '').toLowerCase().includes(s) ||
      `${u.holot} ${u.ten}`.toLowerCase().includes(s)
    ).slice(0, 20);
  }, [users, userSearchQuery]);

  const filteredUserRoles = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return userRoles.filter(ur => 
      (ur.username || '').toLowerCase().includes(s) || 
      String(ur.manv).toLowerCase().includes(s) || 
      (ur.email || '').toLowerCase().includes(s) ||
      `${ur.holot} ${ur.ten}`.toLowerCase().includes(s)
    );
  }, [userRoles, searchTerm]);

  const groupedUserRoles = useMemo(() => {
    const grouped = new Map<string, (UserRole & { roles: string[]; roleIds: number[] })>();

    filteredUserRoles.forEach(ur => {
      const key = String(ur.userid ?? ur.manv ?? ur.id);
      const roleLabel = [ur.rolecode, ur.rolename].filter(Boolean).join(' - ');
      const roleId = Number(ur.roleid);

      if (!grouped.has(key)) {
        grouped.set(key, {
          ...ur,
          roles: roleLabel ? [roleLabel] : [],
          roleIds: !Number.isNaN(roleId) ? [roleId] : []
        });
        return;
      }

      const existing = grouped.get(key)!;
      if (roleLabel && !existing.roles.includes(roleLabel)) {
        existing.roles.push(roleLabel);
      }
      if (!Number.isNaN(roleId) && !existing.roleIds.includes(roleId)) {
        existing.roleIds.push(roleId);
      }
    });

    return Array.from(grouped.values());
  }, [filteredUserRoles]);

  const handleOpenEdit = (ur: UserRole & { roles: string[]; roleIds: number[] }) => {
    setEditingUserRole(ur);
    setEditingRoleId(ur.roleIds[0] || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUserRole || !editingRoleId) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Vui lòng chọn Role cần điều chỉnh.'
      });
      return;
    }

    setSavingEdit(true);
    try {
      const { error: deleteError } = await supabase
        .from('UserRoles')
        .delete()
        .eq('userid', editingUserRole.userid);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase.from('UserRoles').insert([
        {
          userid: editingUserRole.userid,
          roleid: editingRoleId,
          manv: editingUserRole.manv
        }
      ]);

      if (insertError) throw insertError;

      setNotifyModal({
        isOpen: true,
        type: 'success',
        message: 'Lưu số liệu thay đổi thành công'
      });
      setIsEditModalOpen(false);
      setEditingUserRole(null);
      setEditingRoleId('');
      fetchData();
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi khi lưu thay đổi: ' + err.message
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenDelete = (ur: UserRole & { roles: string[]; roleIds: number[] }) => {
    setDeleteConfirm({
      isOpen: true,
      user: ur
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.user) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('UserRoles')
        .delete()
        .eq('userid', deleteConfirm.user.userid);

      if (error) throw error;

      setDeleteConfirm({
        isOpen: false,
        user: null
      });
      setNotifyModal({
        isOpen: true,
        type: 'success',
        message: 'Xóa tài khoản người dùng thành công'
      });
      fetchData();
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi khi xóa: ' + err.message
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-800 p-2.5 rounded-xl shadow-lg">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-blue-900 tracking-tight">Hệ thống phân quyền sử dụng cho User</h2>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {canCreate && (
            <button onClick={handleOpenAdd} className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-all">
              <Plus className="h-4 w-4 mr-2" /> Thêm mới
            </button>
          )}
          {canCreate && (
            <button onClick={handleOpenImportModal} className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md transition-all">
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
            placeholder="Tìm nhanh User theo Manv, Tên hoặc Email..." 
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left border-collapse">
            <thead className="bg-gray-50/80 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-16">STT</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-16">ID</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-20">Userid</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-24">Manv</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600">Họ và Tên</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600">Đơn vị</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600">Username</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 text-center w-44">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-600" />
                    <p className="mt-2 text-gray-400 font-bold text-xs">đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : groupedUserRoles.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy phân quyền nào.</td>
                </tr>
              ) : (
                groupedUserRoles.map((ur, idx) => {
                  const rowKey = `${ur.userid}-${ur.manv || ur.id}`;
                  const isExpanded = !!expandedRoleRows[rowKey];

                  return (
                  <tr key={rowKey} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-center text-gray-500">{idx + 1}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-500">{ur.id}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-500">{ur.userid}</td>
                    <td className="px-6 py-4 text-sm text-center text-red-600 font-bold">{ur.manv}</td>
                    <td className="px-6 py-4 text-sm text-blue-900 font-bold">{ur.holot} {ur.ten}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{ur.ten_phongban}</td>
                    <td className="px-6 py-4 text-sm text-gray-800">{ur.username}</td>
                    <td className="px-6 py-4 text-sm text-blue-600 italic">{ur.email || '---'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-indigo-600">
                      <div className="relative group max-w-[280px]">
                        <div className="flex items-center gap-2">
                          <span className="truncate block">
                            {ur.roles[0] || '---'}
                            {ur.roles.length > 1 ? ` (+${ur.roles.length - 1})` : ''}
                          </span>
                          {ur.roles.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedRoleRows(prev => ({
                                  ...prev,
                                  [rowKey]: !prev[rowKey]
                                }))
                              }
                              className="inline-flex items-center justify-center rounded p-0.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                              title="Xem đầy đủ Role"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          )}
                        </div>

                        {ur.roles.length > 1 && (
                          <div className="pointer-events-none absolute left-0 top-full mt-1 z-20 hidden min-w-[240px] max-w-[320px] rounded-lg bg-gray-900 p-2 text-xs font-semibold text-white shadow-xl group-hover:block">
                            <div className="mb-1 text-[11px] text-gray-200">Danh sách Role:</div>
                            <ul className="space-y-1">
                              {ur.roles.map((role, roleIdx) => (
                                <li key={`${rowKey}-hover-${roleIdx}`}>{role}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {isExpanded && ur.roles.length > 1 && (
                          <ul className="mt-2 space-y-1 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2 text-xs font-semibold text-indigo-700">
                            {ur.roles.map((role, roleIdx) => (
                              <li key={`${rowKey}-expand-${roleIdx}`}>{role}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ur)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Hiệu chỉnh</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(ur)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 font-semibold hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Users Modal */}
      {isImportModalOpen && ( 
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            <div className="bg-gray-50 border-b p-5 flex justify-between items-center">
              <h3 className="text-xl font-bold text-blue-900">Import Danh sách phân quyền người dùng</h3>
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

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#f0f0f0] rounded-lg shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border-t-4 border-blue-600">
            {/* Header */}
            <div className="bg-white px-4 py-2 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="size-5 flex items-center justify-center">
                  <img src="https://lh3.googleusercontent.com/d/1OD0yKOMSr4sY3dnYcxsCNHypDna9BfT3" className="w-full" alt="Icon" />
                </div>
                <h3 className="text-sm font-medium text-gray-600">Phân quyền sử dụng người dùng</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* User Selection Section */}
              <div className="border border-gray-300 rounded-md p-6 relative bg-white/50">
                <span className="absolute -top-3 left-4 bg-[#f0f0f0] px-2 text-sm font-bold text-red-500">Tìm và chọn người dùng</span>
                
                <div className="space-y-4">
                  <div className="relative" ref={userDropdownRef}>
                    <label className="text-sm font-bold text-blue-800 block mb-1">Họ và Tên</label>
                    <input 
                      type="text"
                      className="w-full h-9 px-3 border border-gray-300 bg-white text-black text-sm focus:border-blue-500 outline-none"
                      placeholder="Nhập Tên, Username, Email để tìm nhanh Users"
                      value={selectedUser ? `${selectedUser.holot} ${selectedUser.ten}` : userSearchQuery}
                      onChange={e => {
                        setUserSearchQuery(e.target.value);
                        if (selectedUser) setSelectedUser(null);
                        setIsUserDropdownOpen(true);
                      }}
                      onFocus={() => setIsUserDropdownOpen(true)}
                    />
                    {isUserDropdownOpen && (
                      <div className="absolute z-[160] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-xl overflow-hidden flex flex-col max-h-60">
                        {loadingUsers ? (
                          <div className="p-4 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
                        ) : filteredUsers.length === 0 ? (
                          <div className="p-4 text-center text-gray-400 text-sm">Không tìm thấy người dùng</div>
                        ) : (
                          <div className="overflow-y-auto bg-white">
                            {filteredUsers.map(u => (
                              <button 
                                key={u.id}
                                onClick={() => handleSelectUser(u)}
                                className="w-full text-left px-4 py-2 bg-white hover:bg-gray-100 border-b border-gray-50 last:border-none transition-colors group"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-bold text-black">{u.manv} - {u.holot} {u.ten}</span>
                                  <span className="text-[10px] text-gray-500 group-hover:text-black">{u.username}</span>
                                </div>
                                <div className="text-[10px] text-gray-600">{u.ten_phongban} | {u.email}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-blue-800 block mb-1">Mã NV</label>
                      <input 
                        readOnly
                        className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm outline-none"
                        value={selectedUser?.manv || ''}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-blue-800 block mb-1">Đơn vị</label>
                      <input 
                        readOnly
                        className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm outline-none"
                        value={selectedUser?.ten_phongban || ''}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-blue-800 block mb-1">UserName</label>
                      <input 
                        readOnly
                        className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm outline-none"
                        value={selectedUser?.username || ''}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-blue-800 block mb-1">Email</label>
                      <input 
                        readOnly
                        className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm outline-none"
                        value={selectedUser?.email || ''}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Role Selection Section */}
              <div className="border border-gray-300 rounded-md p-6 relative bg-white/50">
                <span className="absolute -top-3 left-4 bg-[#f0f0f0] px-2 text-sm font-bold text-red-500">Xác định Roles</span>
                
                <div>
                  <label className="text-sm font-bold text-blue-800 block mb-1">Danh sách Roles</label>
                  <select 
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white transition-all shadow-sm text-black"
                    value={selectedRoleId}
                    onChange={e => setSelectedRoleId(Number(e.target.value))}
                  >
                    <option value="" className="text-black bg-white font-bold">-- Chọn Role --</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id} className="text-black bg-white font-bold">{r.rolecode} - {r.rolename}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-center gap-6 pt-2">
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-3 bg-white border border-gray-300 px-8 py-2 text-sm font-bold text-black hover:bg-gray-100 shadow-sm transition-all disabled:opacity-50 group"
                >
                  <div className="size-8 flex items-center justify-center">
                    <img src="https://lh3.googleusercontent.com/d/1OD0yKOMSr4sY3dnYcxsCNHypDna9BfT3" className="w-full group-hover:scale-110 transition-transform" alt="Save" />
                  </div>
                  <span>Lưu Hồ sơ</span>
                </button>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
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

      {/* Edit Modal */}
      {isEditModalOpen && editingUserRole && (
        <div className="fixed inset-0 z-[160] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#f0f0f0] rounded-lg shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border-t-4 border-blue-600">
            <div className="bg-white px-4 py-2 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="size-5 flex items-center justify-center">
                  <img src="https://lh3.googleusercontent.com/d/1OD0yKOMSr4sY3dnYcxsCNHypDna9BfT3" className="w-full" alt="Icon" />
                </div>
                <h3 className="text-sm font-medium text-gray-600">Hiệu chỉnh quyền sử dụng</h3>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingUserRole(null);
                  setEditingRoleId('');
                }}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="border border-gray-300 rounded-md p-4 relative bg-white/50">
                <span className="absolute -top-3 left-4 bg-[#f0f0f0] px-2 text-sm font-bold text-red-500">Thông tin Tài khoản người dùng</span>

                <div className="space-y-4 mt-2">
                  <div>
                    <label className="text-sm font-bold text-blue-800 block mb-1">Họ và Tên</label>
                    <input
                      readOnly
                      className="w-full h-9 px-3 border border-gray-300 bg-white text-black text-sm outline-none"
                      value={`${editingUserRole.holot || ''} ${editingUserRole.ten || ''}`.trim()}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-blue-800 block mb-1">Mã NV</label>
                      <input
                        readOnly
                        className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm outline-none"
                        value={editingUserRole.manv || ''}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-blue-800 block mb-1">Đơn vị</label>
                      <input
                        readOnly
                        className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm outline-none"
                        value={editingUserRole.ten_phongban || ''}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-blue-800 block mb-1">Username</label>
                      <input
                        readOnly
                        className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm outline-none"
                        value={editingUserRole.username || ''}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-blue-800 block mb-1">Email</label>
                      <input
                        readOnly
                        className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm outline-none"
                        value={editingUserRole.email || ''}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-gray-300 rounded-md p-4 relative bg-white/50">
                <span className="absolute -top-3 left-4 bg-[#f0f0f0] px-2 text-sm font-bold text-red-500">Xác định Roles điều chỉnh</span>

                <div className="mt-2">
                  <label className="text-sm font-bold text-blue-800 block mb-1">Danh sách Roles</label>
                  <select
                    className="w-full p-2.5 border border-gray-300 rounded text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white transition-all text-black"
                    value={editingRoleId}
                    onChange={e => setEditingRoleId(Number(e.target.value))}
                  >
                    <option value="" className="text-black bg-white font-bold">-- Chọn Role --</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id} className="text-black bg-white font-bold">{r.rolecode} - {r.rolename}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-center gap-6 pt-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex items-center gap-3 bg-white border border-gray-300 px-8 py-2 text-sm font-bold text-black hover:bg-gray-100 shadow-sm transition-all disabled:opacity-50 group"
                >
                  <div className="size-8 flex items-center justify-center">
                    <img src="https://lh3.googleusercontent.com/d/1OD0yKOMSr4sY3dnYcxsCNHypDna9BfT3" className="w-full group-hover:scale-110 transition-transform" alt="Save" />
                  </div>
                  <span>Lưu thay đổi</span>
                </button>
                <button
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingUserRole(null);
                    setEditingRoleId('');
                  }}
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

      {/* Delete Confirm Modal */}
      {deleteConfirm.isOpen && deleteConfirm.user && (
        <div className="fixed inset-0 z-[170] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="bg-red-600 p-4 text-white flex items-center gap-3">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">Xác nhận xóa</h3>
            </div>
            <div className="p-6 text-center">
              <p className="font-bold text-sm leading-relaxed text-gray-800">
                Bạn muốn xóa Tài khoản người dùng “{`${deleteConfirm.user.holot || ''} ${deleteConfirm.user.ten || ''}`.trim()}” này ra khỏi danh sách?
              </p>
            </div>
            <div className="bg-gray-50 p-4 flex justify-center gap-4 border-t">
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-8 py-2 bg-red-600 text-white font-black rounded-xl hover:opacity-90 shadow-md transition-all active:scale-95 text-xs"
              >
                Đồng ý
              </button>
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, user: null })}
                className="px-8 py-2 bg-gray-500 text-white font-black rounded-xl hover:opacity-90 shadow-md transition-all active:scale-95 text-xs"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
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
    </div>
  );
};
