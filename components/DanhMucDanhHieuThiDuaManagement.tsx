
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission } from '../services/permissionService';
import { DanhHieuThiDua, RolePermission } from '../types';
import { Plus, Pencil, Trash2, Search, X, Save, FileDown, AlertCircle, Trophy, Loader2, Award } from 'lucide-react';
import * as XLSX from 'xlsx';

export const DanhMucDanhHieuThiDuaManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean }> = ({ permissions, isAdmin }) => {
  const [list, setList] = useState<DanhHieuThiDua[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Permission Logic
  const canCreate = checkPermission(permissions, isAdmin, 'danhMuc-danhHieuThiDua', 'CREATE');
  const canUpdate = checkPermission(permissions, isAdmin, 'danhMuc-danhHieuThiDua', 'UPDATE');
  const canDelete = checkPermission(permissions, isAdmin, 'danhMuc-danhHieuThiDua', 'DELETE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<DanhHieuThiDua>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean, type: 'error' | 'success', message: string }>({
    isOpen: false,
    type: 'error',
    message: ''
  });

  const showAlert = (message: string, type: 'error' | 'success' = 'error') => {
    setAlertModal({ isOpen: true, type, message });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('DanhMucDanhHieuThiDua')
        .select('*')
        .order('madanhhieu', { ascending: true });
      
      if (error) throw error;
      setList(data || []);
    } catch (err: any) {
      showAlert('Lỗi khi tải dữ liệu: ' + err.message);
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
    setFormData({ danhhieuthidua: '', capxetduyet: '', doituongapdung: 'Cá nhân' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: DanhHieuThiDua) => {
    setModalError(null);
    setIsEditing(true);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.danhhieuthidua?.trim()) {
      setModalError('Tên danh hiệu thi đua không được để trống.');
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      if (isEditing && formData.madanhhieu) {
        const { madanhhieu, ...updates } = formData;
        const { error } = await supabase
          .from('DanhMucDanhHieuThiDua')
          .update(updates)
          .eq('madanhhieu', madanhhieu);
        if (error) throw error;
      } else {
        // madanhhieu là Identity nên không gửi lên
        const { error } = await supabase
          .from('DanhMucDanhHieuThiDua')
          .insert([{ 
            danhhieuthidua: formData.danhhieuthidua,
            capxetduyet: formData.capxetduyet,
            doituongapdung: formData.doituongapdung
          }]);
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

  const handleDelete = async (madanhhieu: number) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa danh hiệu này không?`)) {
      const { error } = await supabase
        .from('DanhMucDanhHieuThiDua')
        .delete()
        .eq('madanhhieu', madanhhieu);
      
      if (error) {
        showAlert('Xóa thất bại: ' + error.message);
      } else {
        showAlert('Xóa danh hiệu thành công!', 'success');
        fetchData();
      }
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredList.map(item => ({
      'Mã Danh hiệu': item.madanhhieu,
      'Danh hiệu Thi đua': item.danhhieuthidua,
      'Cấp xét duyệt': item.capxetduyet,
      'Đối tượng áp dụng': item.doituongapdung
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhHieuThiDua");

    // Xuất file XLSX
    XLSX.writeFile(wb, "DanhMucDanhHieuThiDua.xlsx");
  };

  const filteredList = list.filter(item => {
    const name = (item.danhhieuthidua || '').toLowerCase();
    const code = String(item.madanhhieu || '').toLowerCase();
    const cap = (item.capxetduyet || '').toLowerCase();
    const obj = (item.doituongapdung || '').toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    return name.includes(lowerSearch) || code.includes(lowerSearch) || cap.includes(lowerSearch) || obj.includes(lowerSearch);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2.5 rounded-xl shadow-lg shadow-red-100">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-blue-900 tracking-tight ">Danh mục Danh hiệu Thi đua</h2>
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
              className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95"
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
              placeholder="Tìm kiếm danh hiệu, cấp xét duyệt..."
              // className="pl-10 w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50/50"
              className="pl-9 w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black bg-white font-medium"

              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs font-bold text-gray-400 tracking-widest">
            Tổng cộng: <span className="text-red-600">{filteredList.length}</span> danh hiệu thi đua
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-24">Mã số</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Danh hiệu Thi đua</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Cấp xét duyệt</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Đối tượng</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-600" />
                    <p className="mt-2 text-gray-400 font-bold text-[10px] tracking-widest">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy dữ liệu phù hợp.</td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.madanhhieu} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-6 py-4 text-sm text-center">
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200 font-bold">
                        {item.madanhhieu}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-900 font-black tracking-tight">{item.danhhieuthidua}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-bold">{item.capxetduyet || '---'}</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${item.doituongapdung === 'Tập thể' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                        {item.doituongapdung}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {canUpdate && (
                        <button onClick={() => handleOpenEdit(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors mr-2">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(item.madanhhieu)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
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
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSave} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-red-700 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-wider flex items-center gap-3">
                {isEditing ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {isEditing ? 'Hiệu chỉnh danh hiệu' : 'Thêm danh hiệu thi đua'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="h-7 w-7" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {isEditing && (
                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest mb-1.5 block">Mã danh hiệu (Identity)</label>
                  <input
                    type="text"
                    disabled
                    value={formData.madanhhieu || ''}
                    className="w-full p-3 border border-gray-100 rounded-xl bg-gray-50 font-black text-gray-400 cursor-not-allowed"
                  />
                </div>
              )}
              
              <div>
                <label className="text-[10px] font-black text-red-600 tracking-widest mb-1.5 block">Tên Danh hiệu Thi đua *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Chiến sĩ thi đua cơ sở"
                  value={formData.danhhieuthidua || ''}
                  onChange={e => setFormData({ ...formData, danhhieuthidua: e.target.value })}
                  //className="w-full p-3 border border-gray-200 rounded-xl font-bold focus:ring-4 focus:ring-red-500/10 focus:border-red-600 outline-none transition-all"
                  className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black text-red-600 tracking-widest mb-1.5 block">Cấp xét duyệt</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Cấp Trường, Cấp Bộ..."
                    value={formData.capxetduyet || ''}
                    onChange={e => setFormData({ ...formData, capxetduyet: e.target.value })}
                    //className="w-full p-3 border border-gray-200 rounded-xl font-bold focus:ring-4 focus:ring-red-500/10 focus:border-red-600 outline-none transition-all"
                    className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-red-600 tracking-widest mb-1.5 block">Đối tượng áp dụng</label>
                  <select
                    value={formData.doituongapdung || 'Cá nhân'}
                    onChange={e => setFormData({ ...formData, doituongapdung: e.target.value })}
                    // className="w-full p-3 border border-gray-200 rounded-xl font-bold focus:ring-4 focus:ring-red-500/10 focus:border-red-600 outline-none bg-white transition-all cursor-pointer"
                    className="w-full p-2 border border-gray-300 rounded font-bold text-black bg-white">
                    <option value="Cá nhân">Cá nhân</option>
                    <option value="Tập thể">Tập thể</option>
                  </select>
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
                className="px-6 py-2.5 text-gray-500 font-black text-xs hover:text-gray-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                disabled={saving} 
                className="px-10 py-2.5 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-xs"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu thông tin
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border ${alertModal.type === 'error' ? 'border-red-100' : 'border-green-100'}`}>
            <div className={`${alertModal.type === 'error' ? 'bg-red-600' : 'bg-green-600'} p-5 text-white flex items-center gap-3`}>
              {alertModal.type === 'error' ? <AlertCircle className="w-6 h-6" /> : <Save className="h-6 w-6" />}
              <h3 className="text-lg font-bold">{alertModal.type === 'error' ? 'Thông báo lỗi' : 'Thành công'}</h3>
            </div>
            <div className="p-8 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner ${alertModal.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                {alertModal.type === 'error' ? <X size={32} /> : <Save size={32} />}
              </div>
              <p className="text-gray-700 font-bold leading-relaxed whitespace-pre-line">{alertModal.message}</p>
            </div>
            <div className="p-6 bg-gray-50 flex justify-center">
              <button
                onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                className={`px-8 py-2 ${alertModal.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm`}
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
