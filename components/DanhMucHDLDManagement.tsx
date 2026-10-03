
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { DanhMucHDLD, RolePermission } from '../types';
import { Plus, Pencil, Trash2, Search, X, Save, FileDown, AlertCircle, FileText, Loader2, RefreshCcw, Database } from 'lucide-react';
import * as XLSX from 'xlsx';

export const DanhMucHDLDManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [list, setList] = useState<DanhMucHDLD[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);

  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  // Permission Logic
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'hdld-danhMuc', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'hdld-danhMuc', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'hdld-danhMuc', 'DELETE'), [permissions, isAdmin]);

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
        setErrorMessage('Lỗi tải quyền hạn Danh mục HĐLĐ: ' + (err.message || String(err)));
        setIsErrorModalOpen(true);
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<DanhMucHDLD>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('DanhMucHDLD')
        .select('*')
        .order('id', { ascending: true });
      
      if (fetchError) {
        // Xử lý lỗi cụ thể khi không tìm thấy bảng
        if (fetchError.message.includes('Could not find the table')) {
          throw new Error('Bảng "DanhMucHDLD" chưa tồn tại trong Database. Vui lòng kiểm tra lại cấu trúc bảng trên Supabase.');
        }
        throw fetchError;
      }
      setList(data || []);
    } catch (err: any) {
      setErrorMessage('Lỗi khi tải dữ liệu: ' + (err.message || 'Không thể kết nối với máy chủ dữ liệu.'));
      setIsErrorModalOpen(true);
      setError(err.message || 'Không thể kết nối với máy chủ dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateNewMaso = async () => {
    try {
      const { data, error } = await supabase.from('DanhMucHDLD').select('maso');
      if (error) throw error;
      if (data && data.length > 0) {
        const numbers = data
          .map(item => parseInt(String(item.maso)) || 0)
          .filter(num => num > 0);
        if (numbers.length > 0) {
          const maxNum = Math.max(...numbers);
          return String(maxNum + 1);
        }
      }
      return '1';
    } catch (err) {
      return '1';
    }
  };

  const handleOpenAdd = async () => {
    setModalError(null);
    setIsEditing(false);
    const newMaso = await generateNewMaso();
    setFormData({ maso: newMaso, tenhdld: '', thoihan: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: DanhMucHDLD) => {
    setModalError(null);
    setIsEditing(true);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tenhdld?.trim()) {
      setModalError('Tên HĐLĐ không được để trống.');
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      if (isEditing && formData.id) {
        const { id, ...updates } = formData;
        const { error } = await supabase
          .from('DanhMucHDLD')
          .update(updates)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('DanhMucHDLD')
          .insert([formData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setModalError('Lỗi khi lưu dữ liệu: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, maso: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa loại hợp đồng mã số ${maso} này không?`)) {
      const { error } = await supabase.from('DanhMucHDLD').delete().eq('id', id);
      if (error) {
        setErrorMessage('Xóa thất bại: ' + error.message);
        setIsErrorModalOpen(true);
      } else {
        fetchData();
      }
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredList.map(item => ({
      'ID': item.id,
      'Mã số': item.maso,
      'Tên loại HĐLĐ': item.tenhdld,
      'Thời hạn': item.thoihan
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhMucHDLD");
    XLSX.writeFile(wb, "DanhMucHDLD.xlsx");
  };

  const filteredList = list.filter(item => {
    // Ép kiểu String() để tránh lỗi .toLowerCase is not a function nếu dữ liệu là kiểu Number
    const maso = String(item.maso || '').toLowerCase();
    const ten = String(item.tenhdld || '').toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    return maso.includes(lowerSearch) || ten.includes(lowerSearch);
  });

  // Giao diện khi bị lỗi kết nối bảng
  if (error) {
    return (
      <div className="max-w-4xl mx-auto mt-20 p-8 bg-white rounded-3xl shadow-xl border border-red-100 text-center animate-in fade-in zoom-in duration-300">
        <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tight">Lỗi Cấu trúc Dữ liệu</h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
          {error}
          <br />
          <span className="text-xs font-bold text-red-400 mt-2 block italic">
            Gợi ý: Hãy tạo Table "DanhMucHDLD" trong SQL Editor của Supabase trước khi sử dụng.
          </span>
        </p>
        <div className="flex justify-center gap-4">
          <button 
            onClick={fetchData}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            <RefreshCcw className="h-5 w-5" /> Thử lại
          </button>
          <button 
            onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
            className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
          >
            <Database className="h-5 w-5" /> Supabase Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-4">
        <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2 tracking-tight">
          <FileText className="h-7 w-7" /> Danh mục Hợp đồng Lao động
        </h2>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            disabled={loading || list.length === 0}
            onClick={handleExportExcel}
            className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 transition-all disabled:opacity-50"
          >
            <FileDown className="h-4 w-4 mr-2" /> Xuất Excel
          </button>
          {canCreate && (
            <button
              disabled={loading}
              onClick={handleOpenAdd}
              className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-all disabled:opacity-50"
            >
              <Plus className="h-4 w-4 mr-2" /> Thêm mới
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm theo mã số hoặc tên loại HĐ..."
          className="pl-9 w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black bg-white"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider text-center w-16">ID</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider">Mã số</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider">Tên loại HĐLĐ</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider">Thời hạn</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-500 italic">Không tìm thấy dữ liệu.</td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500 text-center">{item.id}</td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-700">{item.maso}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.tenhdld}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.thoihan}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {canUpdate && (
                        <button onClick={() => handleOpenEdit(item)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg mr-2 transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(item.id, String(item.maso))} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSave} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-blue-800 p-5 text-white font-bold flex justify-between items-center">
              <span className="tracking-widest flex items-center gap-2">
                <FileText className="h-5 w-5" /> {isEditing ? 'Hiệu chỉnh loại HĐ' : 'Thêm mới loại Hợp đồng Lao động'}
              </span>
              <button type="button" onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X className="h-6 w-6" /></button>
            </div>
            <div className="p-6 space-y-5 text-black">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">Mã số (Tự động)</label>
                <input
                  type="text"
                  disabled
                  value={formData.maso || ''}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 font-bold text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-red-500 mb-1.5 block">Tên loại Hợp đồng *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: HĐ không xác định thời hạn"
                  value={formData.tenhdld || ''}
                  onChange={e => setFormData({ ...formData, tenhdld: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-red-500 mb-1.5 block">Thời hạn Hợp đồng</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Không xác định, 12 tháng..."
                  value={formData.thoihan || ''}
                  onChange={e => setFormData({ ...formData, thoihan: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                />
              </div>

              {modalError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-lg flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                  <p className="text-xs text-red-700 font-bold">{modalError}</p>
                </div>
              )}
            </div>
            <div className="bg-gray-50 p-5 flex justify-end gap-3 border-t border-gray-100">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-gray-500 font-bold hover:text-gray-800 transition-colors">Hủy bỏ</button>
              <button type="submit" disabled={saving} className="px-8 py-2.5 bg-blue-800 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-blue-900 shadow-lg transition-all active:scale-95 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu thông tin
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error Modal */}
      {isErrorModalOpen && (
        <div className="fixed inset-0 z-[250] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-red-100">
            <div className="bg-red-600 p-5 text-white flex items-center gap-3">
              <AlertCircle className="h-7 w-7" />
              <h3 className="text-lg font-bold">Lỗi</h3>
            </div>
            <div className="p-10 text-center space-y-4">
              <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-red-600 shadow-inner">
                <AlertCircle size={40} />
              </div>
              <p className="text-gray-800 font-bold text-lg leading-relaxed">{errorMessage}</p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center border-t border-gray-50">
              <button 
                onClick={() => setIsErrorModalOpen(false)}
                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-100 text-xs tracking-widest"
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
