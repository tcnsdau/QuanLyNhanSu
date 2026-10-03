
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { RolePermission } from '../types';
import { 
  Plus, Pencil, Trash2, Search, X, Save, FileDown, 
  AlertCircle, CheckCircle2, AlertTriangle, Loader, 
  DatabaseBackup, Database
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface DSTable {
  maso: number;
  tenbang: string;
  diengiai: string;
}

interface DSTableManagementProps {
  onCancel?: () => void;
  permissions?: RolePermission[];
  isAdmin?: boolean;
  currentUser?: any;
}

export const DSTableManagement: React.FC<DSTableManagementProps> = ({ onCancel, permissions: initialPermissions, isAdmin, currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<DSTable[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTable, setEditingTable] = useState<DSTable | null>(null);
  const [formData, setFormData] = useState({
    tenbang: '',
    diengiai: ''
  });
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);

  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  // Permission checks
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'congCu-saoLuu', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'congCu-saoLuu', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'congCu-saoLuu', 'DELETE'), [permissions, isAdmin]);

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
        setNotifyModal({
          isOpen: true,
          type: 'error',
          message: 'Lỗi tải quyền hạn: ' + (err.message || String(err))
        });
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);

  // Notification state
  const [notifyModal, setNotifyModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'confirm';
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: 'success',
    message: ''
  });

  const fetchTables = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('DSTable')
        .select('*')
        .order('maso', { ascending: true });

      if (error) throw error;
      setTables(data || []);
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi khi tải danh mục bảng: ' + (err.message || err)
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const filteredTables = tables.filter(t => 
    t.tenbang.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.diengiai.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setEditingTable(null);
    setFormData({ tenbang: '', diengiai: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (table: DSTable) => {
    setIsEditMode(true);
    setEditingTable(table);
    setFormData({
      tenbang: table.tenbang,
      diengiai: table.diengiai
    });
    setIsModalOpen(true);
  };

  const validateForm = () => {
    if (!formData.tenbang.trim() || !formData.diengiai.trim()) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Tên bảng và Diễn giải không được để trống!'
      });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      // Check for duplicates
      const { data: existing, error: checkError } = await supabase
        .from('DSTable')
        .select('*')
        .or(`tenbang.eq."${formData.tenbang}",diengiai.eq."${formData.diengiai}"`);

      if (checkError) throw checkError;

      const isDuplicate = existing && existing.some(t => {
        if (isEditMode && editingTable && t.maso === editingTable.maso) return false;
        return t.tenbang === formData.tenbang || t.diengiai === formData.diengiai;
      });

      if (isDuplicate) {
        setNotifyModal({
          isOpen: true,
          type: 'error',
          message: 'Giá trị Tên bảng (Diễn giải) đã có, hãy chọn giá trị khác !'
        });
        return;
      }

      if (isEditMode && editingTable) {
        const { error } = await supabase
          .from('DSTable')
          .update({
            tenbang: formData.tenbang,
            diengiai: formData.diengiai
          })
          .eq('maso', editingTable.maso);

        if (error) throw error;
        setNotifyModal({
          isOpen: true,
          type: 'success',
          message: 'Hệ thống đã lưu các thay đổi'
        });
      } else {
        const { error } = await supabase
          .from('DSTable')
          .insert([{
            tenbang: formData.tenbang,
            diengiai: formData.diengiai
          }]);

        if (error) throw error;
        setNotifyModal({
          isOpen: true,
          type: 'success',
          message: 'Hệ thống đã lưu mới danh sách bảng'
        });
      }

      setIsModalOpen(false);
      fetchTables();
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Lỗi khi lưu dữ liệu: ' + (err.message || err)
      });
    }
  };

  const handleDelete = async (table: DSTable) => {
    setNotifyModal({
      isOpen: true,
      type: 'confirm',
      message: `Bạn xác nhận xóa Table ${table.tenbang} ra khỏi danh sách?`,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('DSTable')
            .delete()
            .eq('maso', table.maso);

          if (error) throw error;
          setNotifyModal({
            isOpen: true,
            type: 'success',
            message: 'Đã xóa bảng thành công'
          });
          fetchTables();
        } catch (err: any) {
          setNotifyModal({
            isOpen: true,
            type: 'error',
            message: 'Lỗi khi xóa bảng: ' + (err.message || err)
          });
        }
      }
    });
  };

  const handleExportExcel = async (tableName: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(tableName)
        .select('*');

      if (error) throw error;

      if (!data || data.length === 0) {
        setNotifyModal({
          isOpen: true,
          type: 'error',
          message: `Bảng ${tableName} không có dữ liệu để xuất!`
        });
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, tableName);
      
      // UTF-8 BOM is handled by xlsx library during writing
      XLSX.writeFile(workbook, `${tableName}_Backup_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      setNotifyModal({
        isOpen: true,
        type: 'success',
        message: `Đã xuất dữ liệu bảng ${tableName} ra file Excel`
      });
    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: `Lỗi khi xuất Excel bảng ${tableName}: ` + (err.message || err)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col h-full animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 flex justify-between items-center text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl">
            <DatabaseBackup className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Danh mục các Bảng dữ liệu</h2>
            <p className="text-xs text-blue-100">Quản lý và sao lưu dữ liệu hệ thống</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm bảng..."
              className="pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm focus:bg-white focus:text-gray-900 focus:outline-none transition-all w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {canCreate && (
            <button 
              onClick={handleOpenAdd}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Thêm mới
            </button>
          )}
          {onCancel && (
            <button 
              onClick={onCancel}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-blue-600 gap-4">
            <Loader className="h-12 w-12 animate-spin" />
            <p className="font-bold text-sm uppercase tracking-widest">Đang tải dữ liệu...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-4 text-sm font-bold text-red-600 tracking-tight text-center w-24">Mã số</th>
                  <th className="px-6 py-4 text-sm font-bold text-red-600 tracking-tight">Tên Bảng</th>
                  <th className="px-6 py-4 text-sm font-bold text-red-600 tracking-tight">Diễn giải</th>
                  <th className="px-6 py-4 text-sm font-bold text-red-600 tracking-tight text-center w-64">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTables.length > 0 ? (
                  filteredTables.map((table) => (
                    <tr key={table.maso} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-6 py-4 text-sm font-bold text-gray-500 text-center">{table.maso}</td>
                      <td className="px-6 py-4 text-sm font-bold text-blue-700">{table.tenbang}</td>
                      <td className="px-6 py-4 text-sm text-emerald-600">{table.diengiai}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          {canUpdate && (
                            <button 
                              onClick={() => handleOpenEdit(table)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all font-bold text-xs"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Hiệu chỉnh
                            </button>
                          )}
                          {canDelete && (
                            <button 
                              onClick={() => handleDelete(table)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all font-bold text-xs"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Xóa
                            </button>
                          )}
                          <button 
                            onClick={() => handleExportExcel(table.tenbang)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all font-bold text-xs"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            Xuất Excel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                      Không tìm thấy bảng dữ liệu nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-gray-100">
            <div className="bg-blue-700 p-4 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                {isEditMode ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {isEditMode ? 'Hiệu chỉnh Bảng dữ liệu' : 'Thêm mới Bảng dữ liệu'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Tên bảng</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  placeholder="Ví dụ: NhanVien"
                  value={formData.tenbang}
                  onChange={e => setFormData({...formData, tenbang: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 mb-1 block">Diễn giải</label>
                <textarea 
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                  placeholder="Mô tả nội dung bảng..."
                  value={formData.diengiai}
                  onChange={e => setFormData({...formData, diengiai: e.target.value})}
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 active:scale-95"
              >
                <Save className="h-4 w-4" />
                Lưu dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notifyModal.isOpen && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-gray-100">
            <div className={`${
              notifyModal.type === 'success' ? 'bg-emerald-600' : 
              notifyModal.type === 'error' ? 'bg-red-600' : 'bg-amber-500'
            } p-4 text-white flex items-center gap-3`}>
              {notifyModal.type === 'success' ? <CheckCircle2 size={24} /> : 
               notifyModal.type === 'error' ? <AlertCircle size={24} /> : <AlertTriangle size={24} />}
              <h3 className="text-lg font-bold">Thông báo</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className={`font-bold text-sm leading-relaxed ${
                notifyModal.type === 'error' ? 'text-red-700' : 'text-gray-800'
              }`}>
                {notifyModal.message}
              </p>
            </div>
            <div className="bg-gray-50 p-4 flex justify-center gap-3 border-t">
              {notifyModal.type === 'confirm' ? (
                <>
                  <button 
                    onClick={() => {
                      if (notifyModal.onConfirm) notifyModal.onConfirm();
                      setNotifyModal({ ...notifyModal, isOpen: false });
                    }} 
                    className="px-8 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-md transition-all active:scale-95 text-xs"
                  >
                    Đồng ý
                  </button>
                  <button 
                    onClick={() => setNotifyModal({ ...notifyModal, isOpen: false })} 
                    className="px-8 py-2 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 shadow-md transition-all active:scale-95 text-xs"
                  >
                    Hủy bỏ
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setNotifyModal({ ...notifyModal, isOpen: false })} 
                  className={`px-12 py-2 ${
                    notifyModal.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
                  } text-white font-bold rounded-xl hover:opacity-90 shadow-md transition-all active:scale-95 text-xs`}
                >
                  Đóng
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
