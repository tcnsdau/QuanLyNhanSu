
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { DanhMucHSL, RolePermission } from '../types';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { 
  Plus, Pencil, Trash2, Search, X, Save, FileDown, 
  AlertCircle, Wallet, Loader2 
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const DanhMucHSLManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [list, setList] = useState<DanhMucHSL[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<DanhMucHSL>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);

  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  // Permission checks
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'luong-danhMucHSL', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'luong-danhMucHSL', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'luong-danhMucHSL', 'DELETE'), [permissions, isAdmin]);

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
        setErrorMessage('Lỗi tải quyền hạn Danh mục HSL: ' + (err.message || String(err)));
        setIsErrorModalOpen(true);
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('DanhMucHSL')
        .select('*')
        .order('maso', { ascending: true });
      
      if (error) throw error;
      setList(data || []);
    } catch (err: any) {
      setErrorMessage('Lỗi khi tải dữ liệu: ' + (err.message || String(err)));
      setIsErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAdd = () => {
    setModalError(null);
    setIsEditing(false);
    setFormData({
      loaingachbac: '',
      chucdanhtrinhdo: '',
      sonamnangbac: 0,
      sobac: 0,
      mucnangheso: 0,
      hesotoida: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: DanhMucHSL) => {
    setModalError(null);
    setIsEditing(true);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.loaingachbac?.trim()) {
      setModalError('Vui lòng nhập Loại ngạch bậc.');
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      if (isEditing && formData.maso) {
        const { maso, ...updates } = formData;
        const { error } = await supabase
          .from('DanhMucHSL')
          .update(updates)
          .eq('maso', maso);
        if (error) throw error;
      } else {
        // maso là Identity nên không gửi lên
        const { maso, ...insertData } = formData;
        const { error } = await supabase
          .from('DanhMucHSL')
          .insert([insertData]);
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

  const handleDelete = async (maso: number) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa mục HSL mã số ${maso} này không?`)) {
      const { error } = await supabase
        .from('DanhMucHSL')
        .delete()
        .eq('maso', maso);
      
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
      'Mã số': item.maso,
      'Loại ngạch bậc': item.loaingachbac,
      'Chức danh-Trình độ': item.chucdanhtrinhdo,
      'Số năm nâng bậc': item.sonamnangbac,
      'Số bậc': item.sobac,
      'Mức nâng hệ số': item.mucnangheso,
      'Hệ số tối đa': item.hesotoida
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhMucHSL");

    // Xuất file XLSX với UTF-8 (mặc định của thư viện xlsx)
    XLSX.writeFile(wb, "DanhMucHSL.xlsx");
  };

  const filteredList = list.filter(item => {
    const searchFields = [
      item.maso,
      item.loaingachbac,
      item.chucdanhtrinhdo
    ].map(f => String(f || '').toLowerCase());
    
    return searchFields.some(f => f.includes(searchTerm.toLowerCase()));
  });

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-100">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-blue-900 tracking-tight">Danh mục Hệ số lương (HSL)</h2>
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
              className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4 mr-2" /> Thêm mới
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm mã số, ngạch bậc, chức danh..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-black bg-white font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Tổng cộng: <span className="text-indigo-600 font-black">{filteredList.length}</span> danh mục
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-24">Mã số</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Loại ngạch bậc</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Chức danh-Trình độ</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Số năm nâng bậc</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Số bậc</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Mức nâng HS</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Hệ số tối đa</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-indigo-600" />
                    <p className="mt-2 text-gray-400 font-bold text-[10px] tracking-widest">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy dữ liệu phù hợp.</td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.maso} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="px-6 py-4 text-sm text-center">
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200 font-bold">
                        {item.maso}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-900 font-black tracking-tight">{item.loaingachbac}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-bold">{item.chucdanhtrinhdo}</td>
                    <td className="px-6 py-4 text-sm text-center font-bold text-blue-600">{item.sonamnangbac}</td>
                    <td className="px-6 py-4 text-sm text-blue-900 font-black tracking-tight">{item.sobac}</td>
                    <td className="px-6 py-4 text-sm text-center font-bold text-blue-600">{item.mucnangheso}</td>
                    <td className="px-6 py-4 text-sm text-center font-bold text-red-600">{item.hesotoida}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {canUpdate && (
                        <button onClick={() => handleOpenEdit(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors mr-2">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(item.maso)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
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
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSave} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 my-8">
            <div className="bg-indigo-800 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-wider flex items-center gap-3">
                {isEditing ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {isEditing ? 'Hiệu chỉnh danh mục HSL' : 'Thêm danh mục HSL mới'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="h-7 w-7" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {isEditing && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Mã số danh mục (Cố định)</p>
                    <p className="text-lg font-black text-indigo-800">#{formData.maso}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-indigo-600 tracking-widest mb-1.5 block">Loại ngạch bậc *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Giảng viên cao cấp, Chuyên viên..."
                    value={formData.loaingachbac || ''}
                    onChange={e => setFormData({ ...formData, loaingachbac: e.target.value })}
                    className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-indigo-600 tracking-widest mb-1.5 block">Chức danh-Trình độ</label>
                  <input
                    type="text"
                    placeholder="VD: Tiến sĩ, Thạc sĩ..."
                    value={formData.chucdanhtrinhdo || ''}
                    onChange={e => setFormData({ ...formData, chucdanhtrinhdo: e.target.value })}
                    className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-indigo-600 tracking-widest mb-1.5 block">Số năm nâng bậc</label>
                  <input
                    type="number"
                    step="1"
                    value={formData.sonamnangbac || 0}
                    onChange={e => setFormData({ ...formData, sonamnangbac: parseInt(e.target.value) || 0 })}
                    className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-indigo-600 tracking-widest mb-1.5 block">Số bậc</label>
                  <input
                    type="number"
                    step="1"
                    value={formData.sobac || 0}
                    onChange={e => setFormData({ ...formData, sobac: parseInt(e.target.value) || 0 })}
                    className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-indigo-600 tracking-widest mb-1.5 block">Mức nâng hệ số</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.mucnangheso || 0}
                    onChange={e => setFormData({ ...formData, mucnangheso: parseFloat(e.target.value) || 0 })}
                    className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-indigo-600 tracking-widest mb-1.5 block">Hệ số tối đa</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.hesotoida || 0}
                    onChange={e => setFormData({ ...formData, hesotoida: parseFloat(e.target.value) || 0 })}
                    className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

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
                Lưu danh mục
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

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left">
         <p className="text-[10px] text-red-400 font-bold tracking-widest italic">
            Hệ thống DAU HR Management | © Quản lý Nhân sự
        </p>
      </div>
    </div>
  );
};
