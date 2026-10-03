
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission } from '../services/permissionService';
import { TrinhDo, RolePermission } from '../types';
import { Pencil, Trash2, Search, X, Save, FileDown, AlertCircle, Plus } from 'lucide-react';
import * as XLSX from 'xlsx'; // Import xlsx library

export const DanhMucTrinhDoManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean }> = ({ permissions, isAdmin }) => {
  const [trinhDoList, setTrinhDoList] = useState<TrinhDo[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Permission Logic
  const canCreate = checkPermission(permissions, isAdmin, 'danhMuc-trinhDo', 'CREATE');
  const canUpdate = checkPermission(permissions, isAdmin, 'danhMuc-trinhDo', 'UPDATE');
  const canDelete = checkPermission(permissions, isAdmin, 'danhMuc-trinhDo', 'DELETE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTrinhDo, setCurrentTrinhDo] = useState<TrinhDo | null>(null);
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

  const fetchTrinhDo = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('DanhMucTrinhDo').select('*').order('id', { ascending: true });
    if (error) {
      showAlert('Lỗi khi tải danh mục Trình độ: ' + error.message);
    } else {
      setTrinhDoList(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrinhDo();
  }, []);

  const handleOpenEdit = (trinhDo: TrinhDo) => {
    setModalError(null);
    setIsEditing(true);
    setCurrentTrinhDo(trinhDo);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrinhDo) return;

    setSaving(true);
    setModalError(null);

    // Validate if giatri is not empty
    if (!currentTrinhDo.giatri.trim()) {
      setModalError('Giá trị không được để trống.');
      setSaving(false);
      return;
    }

    // Check for duplicate giatri (excluding the current item if editing)
    const isGiaTriDuplicate = trinhDoList.some(td => 
        String(td.giatri || '').toLowerCase().trim() === String(currentTrinhDo.giatri || '').toLowerCase().trim() && (td.id !== currentTrinhDo.id)
    );

    if (isGiaTriDuplicate) {
        setModalError('Giá trị trình độ đã tồn tại. Vui lòng nhập giá trị khác.');
        setSaving(false);
        return;
    }

    // Since 'Trình độ' only has 'Hiệu chỉnh' and 'Xóa', there's no 'Add new'
    // So we only handle the update operation here.
    const { id, ...updates } = currentTrinhDo; // Exclude ID from updates payload
    const { error } = await supabase
        .from('DanhMucTrinhDo')
        .update(updates)
        .eq('id', id);

    if (error) {
        setModalError('Cập nhật thất bại: ' + error.message);
    } else {
        setIsModalOpen(false);
        fetchTrinhDo();
    }
    setSaving(false);
  };

  const handleDelete = async (id: number, matrinhdo: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa trình độ ${matrinhdo} này không?`)) {
      const { error } = await supabase.from('DanhMucTrinhDo').delete().eq('id', id);
      if (error) {
        showAlert('Xóa thất bại: ' + error.message);
      } else {
        showAlert('Xóa trình độ thành công!', 'success');
        fetchTrinhDo();
      }
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredTrinhDo.map(td => ({
      ID: td.id,
      'Mã Trình độ': td.matrinhdo,
      'Giá Trị': td.giatri,
      'Ghi Chú': td.ghichu,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhMucTrinhDo");

    XLSX.writeFile(wb, "DanhMucTrinhDo.xlsx");
  };

  const filteredTrinhDo = trinhDoList.filter(td => {
    if (!td) return false; // Ensure td itself is not null/undefined
    const maTrinhDo = String(td.matrinhdo || '').toLowerCase();
    const giaTri = String(td.giatri || '').toLowerCase();
    const ghiChu = String(td.ghichu || '').toLowerCase();
    const lowerSearchTerm = searchTerm.toLowerCase();
  
    return maTrinhDo.includes(lowerSearchTerm) || 
           giaTri.includes(lowerSearchTerm) || 
           ghiChu.includes(lowerSearchTerm);
  });

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-blue-600 bg-white p-4 mb-6 rounded-lg shadow-sm border border-gray-200">Quản lý Danh mục Trình độ</h2>
      
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full sm:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm theo mã, giá trị hoặc ghi chú..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex space-x-2 w-full sm:w-auto">
          {/* No "Add New" button as per user's request for this module */}
          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-800 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow overflow-hidden rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-500 tracking-wider">ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-500 tracking-wider">Mã Trình độ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-500 tracking-wider">Trình độ</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-500 tracking-wider">Ghi chú</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-red-500 tracking-wider">Hiệu chỉnh</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">Đang tải dữ liệu...</td>
                </tr>
              ) : filteredTrinhDo.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">Không tìm thấy trình độ nào.</td>
                </tr>
              ) : (
                filteredTrinhDo.map((td) => (
                  <tr key={td.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{td.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{td.matrinhdo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{td.giatri}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{td.ghichu}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {canUpdate && (
                        <button onClick={() => handleOpenEdit(td)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(td.id, td.matrinhdo)} className="text-red-600 hover:text-red-900">
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

      {/* Modal Form for Edit */}
      {isModalOpen && currentTrinhDo && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <form onSubmit={handleSave}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex justify-between items-center mb-5 border-b pb-2">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Hiệu Chỉnh Trình độ
                    </h3>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Mã Trình độ</label>
                      <input 
                        type="text" 
                        required 
                        disabled={true} // matrinhdo is always readonly
                        value={currentTrinhDo.matrinhdo} 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Giá Trị</label>
                      <input 
                        type="text" 
                        required 
                        value={currentTrinhDo.giatri} 
                        onChange={e => setCurrentTrinhDo({...currentTrinhDo, giatri: e.target.value})} 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ghi Chú</label>
                      <textarea
                        value={currentTrinhDo.ghichu}
                        onChange={e => setCurrentTrinhDo({...currentTrinhDo, ghichu: e.target.value})}
                        rows={3}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      ></textarea>
                    </div>
                  </div>

                  {modalError && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded mt-4 flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                      <p className="text-sm text-red-700 font-medium">{modalError}</p>
                    </div>
                  )}

                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" disabled={saving} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                    {saving ? 'Đang lưu...' : 'Lưu Thông Tin'}
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                    Hủy Bỏ
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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
