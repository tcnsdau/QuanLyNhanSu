
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission } from '../services/permissionService';
import { HinhThucKhenThuong, RolePermission } from '../types';
import { Plus, Pencil, Trash2, Search, X, Save, FileDown, AlertCircle, Trophy, Loader2, Gift } from 'lucide-react';
import * as XLSX from 'xlsx';

export const DanhMucHinhThucKhenThuongManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean }> = ({ permissions, isAdmin }) => {
  const [list, setList] = useState<HinhThucKhenThuong[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Permission Logic
  const canCreate = checkPermission(permissions, isAdmin, 'danhMuc-hinhThucKhenThuong', 'CREATE');
  const canUpdate = checkPermission(permissions, isAdmin, 'danhMuc-hinhThucKhenThuong', 'UPDATE');
  const canDelete = checkPermission(permissions, isAdmin, 'danhMuc-hinhThucKhenThuong', 'DELETE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<HinhThucKhenThuong>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('DanhMucHinhThucKhenThuong')
        .select('*')
        .order('makhenthuong', { ascending: true });
      
      if (error) throw error;
      setList(data || []);
    } catch (err: any) {
      setErrorMessage('Lỗi khi tải dữ liệu: ' + err.message);
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
    setFormData({ hinhthuckhenthuong: '', capxetduyet: '', doituongapdung: 'Cá nhân' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: HinhThucKhenThuong) => {
    setModalError(null);
    setIsEditing(true);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hinhthuckhenthuong?.trim()) {
      setModalError('Tên hình thức khen thưởng không được để trống.');
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      if (isEditing && formData.makhenthuong) {
        const { makhenthuong, ...updates } = formData;
        const { error } = await supabase
          .from('DanhMucHinhThucKhenThuong')
          .update(updates)
          .eq('makhenthuong', makhenthuong);
        if (error) throw error;
      } else {
        // makhenthuong là Identity nên không gửi lên
        const { error } = await supabase
          .from('DanhMucHinhThucKhenThuong')
          .insert([{ 
            hinhthuckhenthuong: formData.hinhthuckhenthuong,
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

  const handleDelete = async (makhenthuong: number) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa hình thức khen thưởng này không?`)) {
      const { error } = await supabase
        .from('DanhMucHinhThucKhenThuong')
        .delete()
        .eq('makhenthuong', makhenthuong);
      
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
      'Mã Khen thưởng': item.makhenthuong,
      'Hình thức Khen thưởng': item.hinhthuckhenthuong,
      'Cấp xét duyệt': item.capxetduyet,
      'Đối tượng áp dụng': item.doituongapdung
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhMucKhenThuong");

    XLSX.writeFile(wb, "DanhMucHinhThucKhenThuong.xlsx");
  };

  const filteredList = list.filter(item => {
    const name = (item.hinhthuckhenthuong || '').toLowerCase();
    const cap = (item.capxetduyet || '').toLowerCase();
    const obj = (item.doituongapdung || '').toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    return name.includes(lowerSearch) || cap.includes(lowerSearch) || obj.includes(lowerSearch);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 p-2.5 rounded-xl shadow-lg shadow-orange-100">
            <Gift className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-black text-blue-900 tracking-tight">Danh mục Hình thức Khen thưởng</h2>
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
              className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
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
              placeholder="Tìm kiếm hình thức, cấp xét duyệt..."
              className="pl-9 w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black bg-white font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs font-bold text-gray-400 tracking-widest">
            Tổng cộng: <span className="text-orange-600">{filteredList.length}</span> Hình thức khen thưởng
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-24 ">Mã khen thưởng</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest ">Hình thức Khen thưởng</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest ">Cấp xét duyệt</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center ">Đối tượng</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-right ">Thao tác</th>
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
                  <tr key={item.makhenthuong} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-6 py-4 text-sm text-center">
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200 font-bold">
                        {item.makhenthuong}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-900 font-black tracking-tight">{item.hinhthuckhenthuong}</td>
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
                        <button onClick={() => handleDelete(item.makhenthuong)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
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
            <div className="bg-blue-900 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-wider flex items-center gap-3">
                {isEditing ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {isEditing ? 'Hiệu chỉnh khen thưởng' : 'Thêm hình thức mới'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="h-7 w-7" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {isEditing && (
                <div>
                  <label className="text-[10px] font-black text-red-400 tracking-widest mb-1.5 block">Mã khen thưởng (Identity)</label>
                  <input
                    type="text"
                    disabled
                    value={formData.makhenthuong || ''}
                    className="w-full p-3 border border-gray-100 rounded-xl bg-gray-50 font-black text-gray-400 cursor-not-allowed"
                  />
                </div>
              )}
              
              <div>
                <label className="text-[10px] font-black text-red-600 tracking-widest mb-1.5 block">Hình thức Khen thưởng *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Giấy khen, Bằng khen..."
                  value={formData.hinhthuckhenthuong || ''}
                  onChange={e => setFormData({ ...formData, hinhthuckhenthuong: e.target.value })}
                  className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                  autoFocus
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
                    className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-red-600 tracking-widest mb-1.5 block">Đối tượng áp dụng</label>
                  <select
                    value={formData.doituongapdung || 'Cá nhân'}
                    onChange={e => setFormData({ ...formData, doituongapdung: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded font-bold text-black bg-white focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
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
                className="px-10 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 uppercase text-xs"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu thông tin
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
