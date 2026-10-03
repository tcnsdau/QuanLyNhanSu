
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission } from '../services/permissionService';
import { ChucDanh, RolePermission } from '../types';
import { Plus, Pencil, Trash2, Search, X, Save, FileDown, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx'; // Import xlsx library

export const DanhMucChucDanhManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean }> = ({ permissions, isAdmin }) => {
  const [chucDanhList, setChucDanhList] = useState<ChucDanh[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Permission Logic
  const canCreate = checkPermission(permissions, isAdmin, 'danhMuc-chucDanh', 'CREATE');
  const canUpdate = checkPermission(permissions, isAdmin, 'danhMuc-chucDanh', 'UPDATE');
  const canDelete = checkPermission(permissions, isAdmin, 'danhMuc-chucDanh', 'DELETE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentChucDanh, setCurrentChucDanh] = useState<ChucDanh | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchChucDanh = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('DanhMucChucDanh').select('*').order('id', { ascending: true });
    if (error) {
      setErrorMessage('Lỗi khi tải danh mục Chức danh: ' + error.message);
      setIsErrorModalOpen(true);
    } else {
      setChucDanhList(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchChucDanh();
  }, []);

 // Tạo mã chức danh tự động (dạng số)
async function generateNewMaChucDanh () {
    try {
        const { data, error } = await supabase
            .from('DanhMucChucDanh')
            .select('machucdanh');
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            // Lấy tất cả mã, chuyển sang số, tìm giá trị max
            const numbers = data
                .map(item => parseInt(item.machucdanh) || 0)
                .filter(num => num > 0);
            
            if (numbers.length > 0) {
                const newNum = Math.max(...numbers);
                return String(newNum + 1);
            }
        }
        return '1';
    } catch (err: any) {
        setErrorMessage('Lỗi tạo mã: ' + (err.message || String(err)));
        setIsErrorModalOpen(true);
        return '1';
    }
}


  const handleOpenAdd = async () => {
    setModalError(null);
    setIsEditing(false);
    const newMaChucDanh = await generateNewMaChucDanh();
    setCurrentChucDanh({ id: 0, machucdanh: newMaChucDanh, giatri: '', ghichu: '' }); // id will be ignored by Supabase for insert
    setIsModalOpen(true);
  };

  const handleOpenEdit = (chucDanh: ChucDanh) => {
    setModalError(null);
    setIsEditing(true);
    setCurrentChucDanh(chucDanh);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChucDanh) return;

    setSaving(true);
    setModalError(null);

    // Validate if giatri is not empty
    if (!currentChucDanh.giatri.trim()) {
      setModalError('Giá trị không được để trống.');
      setSaving(false);
      return;
    }

    // Check for duplicate machucdanh or giatri (only for new entries or if changed for existing)
    const isMaChucDanhDuplicate = chucDanhList.some(cd => 
        String(cd.machucdanh || '') === String(currentChucDanh.machucdanh || '') && (!isEditing || cd.id !== currentChucDanh.id)
    );
    const isGiaTriDuplicate = chucDanhList.some(cd => 
        String(cd.giatri || '').toLowerCase().trim() === String(currentChucDanh.giatri || '').toLowerCase().trim() && (!isEditing || cd.id !== currentChucDanh.id)
    );

    if (isMaChucDanhDuplicate) {
        setModalError('Mã chức danh đã tồn tại. Vui lòng chọn mã khác.');
        setSaving(false);
        return;
    }
    if (isGiaTriDuplicate) {
        setModalError('Giá trị chức danh đã tồn tại. Vui lòng nhập giá trị khác.');
        setSaving(false);
        return;
    }


    if (isEditing) {
      const { id, ...updates } = currentChucDanh; // Exclude ID from updates payload
      const { error } = await supabase
        .from('DanhMucChucDanh')
        .update(updates)
        .eq('id', id);

      if (error) {
        setModalError('Cập nhật thất bại: ' + error.message);
      } else {
        setIsModalOpen(false);
        fetchChucDanh();
      }
    } else {
      // Add new
      const { error } = await supabase.from('DanhMucChucDanh').insert([currentChucDanh]);
      if (error) {
        setModalError('Thêm mới thất bại: ' + error.message);
      } else {
        setIsModalOpen(false);
        fetchChucDanh();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: number, machucdanh: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa chức danh ${machucdanh} này không?`)) {
      const { error } = await supabase.from('DanhMucChucDanh').delete().eq('id', id);
      if (error) {
        setErrorMessage('Xóa thất bại: ' + error.message);
        setIsErrorModalOpen(true);
      } else {
        fetchChucDanh();
      }
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredChucDanh.map(cd => ({
      ID: cd.id,
      'Mã Chức danh': cd.machucdanh,
      'Giá Trị': cd.giatri,
      'Ghi Chú': cd.ghichu,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhMucChucDanh");

    XLSX.writeFile(wb, "DanhMucChucDanh.xlsx");
  };

  const filteredChucDanh = chucDanhList.filter(cd => {
    if (!cd) return false;
    const maChucDanh = String(cd.machucdanh || '').toLowerCase();
    const giaTri = String(cd.giatri || '').toLowerCase();
    const ghiChu = String(cd.ghichu || '').toLowerCase();
    const lowerSearchTerm = searchTerm.toLowerCase();
  
    return maChucDanh.includes(lowerSearchTerm) || 
           giaTri.includes(lowerSearchTerm) || 
           ghiChu.includes(lowerSearchTerm);
  });

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-blue-600 bg-white p-4 mb-6 rounded-lg shadow-sm border border-gray-200">Quản lý Danh mục Chức danh</h2>
      
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
          {canCreate && (
            <button
              onClick={handleOpenAdd}
              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Thêm mới
            </button>
          )}
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
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-500 tracking-wider">Mã số</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-500 tracking-wider">Chức danh</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-red-500 tracking-wider">Ghi chú</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-red-500 tracking-wider">Hiệu chỉnh</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">Đang tải dữ liệu...</td>
                </tr>
              ) : filteredChucDanh.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">Không tìm thấy chức danh nào.</td>
                </tr>
              ) : (
                filteredChucDanh.map((cd) => (
                  <tr key={cd.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cd.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cd.machucdanh}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cd.giatri}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cd.ghichu}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {canUpdate && (
                        <button onClick={() => handleOpenEdit(cd)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(cd.id, cd.machucdanh)} className="text-red-600 hover:text-red-900">
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

      {/* Modal Form for Add/Edit */}
      {isModalOpen && currentChucDanh && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              <form onSubmit={handleSave}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex justify-between items-center mb-5 border-b pb-2">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {isEditing ? 'Hiệu Chỉnh Chức danh' : 'Thêm Mới Chức danh'}
                    </h3>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Mã Chức danh</label>
                      <input 
                        type="text" 
                        required 
                        disabled={true} // machucdanh is always readonly (non-editable)
                        value={currentChucDanh.machucdanh} 
                        onChange={e => setCurrentChucDanh({...currentChucDanh, machucdanh: e.target.value})} 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Chức danh</label>
                      <input 
                        type="text" 
                        required 
                        value={currentChucDanh.giatri} 
                        onChange={e => setCurrentChucDanh({...currentChucDanh, giatri: e.target.value})} 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ghi Chú</label>
                      <textarea
                        value={currentChucDanh.ghichu}
                        onChange={e => setCurrentChucDanh({...currentChucDanh, ghichu: e.target.value})}
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
