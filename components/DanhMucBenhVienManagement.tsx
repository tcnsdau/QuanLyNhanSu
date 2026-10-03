import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { BenhVien, RolePermission } from '../types';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { Search, Plus, Pencil, Trash2, X, Save, FileDown, Loader2, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface DanhMucBenhVienManagementProps {
  permissions?: RolePermission[];
  isAdmin?: boolean;
  currentUser?: any;
}

export const DanhMucBenhVienManagement: React.FC<DanhMucBenhVienManagementProps> = ({ 
  permissions: initialPermissions, 
  isAdmin: initialIsAdmin,
  currentUser 
}) => {
  const [list, setList] = useState<BenhVien[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[] | undefined>(initialPermissions);
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(initialIsAdmin);
  
  // Module code for this component
  const MODULE_CODE = 'baoHiem-danhMucBenhVien';

  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, MODULE_CODE, 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, MODULE_CODE, 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, MODULE_CODE, 'DELETE'), [permissions, isAdmin]);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<BenhVien>>({ tenbenhvien: '', diachi: '' });
  const [originalData, setOriginalData] = useState<Partial<BenhVien>>({ tenbenhvien: '', diachi: '' });
  const [saving, setSaving] = useState(false);

  // Confirm delete state
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; item: BenhVien | null }>({
    isOpen: false,
    item: null,
  });

  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('DanhMucBenhVien')
        .select('*')
        .order('maso', { ascending: true });
      
      if (error) throw error;
      setList(data || []);
    } catch (err: any) {
      setErrorMessage('Lỗi khi tải danh mục bệnh viện: ' + (err.message || String(err)));
      setIsErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Fetch latest permissions if currentUser is provided
    if (currentUser) {
      const fetchPermissions = async () => {
        try {
          const { data: rolePermData, error: rolePermError } = await supabase
            .from('RolePermissions')
            .select('*')
            .eq('userid', currentUser.id);

          if (rolePermError) throw rolePermError;

          const [moduleRes, permRes] = await Promise.all([
            supabase.from('Modules').select('*'),
            supabase.from('Permissions').select('*')
          ]);

          if (moduleRes.error) throw moduleRes.error;
          if (permRes.error) throw permRes.error;

          const normalized = normalizePermissions(rolePermData || [], moduleRes.data || [], permRes.data || []);
          setPermissions(normalized);
        } catch (err) {
          setErrorMessage('Error fetching permissions: ' + (err instanceof Error ? err.message : String(err)));
          setIsErrorModalOpen(true);
        }
      };
      fetchPermissions();
    }
  }, [currentUser]);

  const handleOpenAdd = () => {
    setIsEditing(false);
    const empty = { tenbenhvien: '', diachi: '' };
    setFormData(empty);
    setOriginalData(empty);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: BenhVien) => {
    setIsEditing(true);
    setFormData({ ...item });
    setOriginalData({ ...item });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.tenbenhvien?.trim();
    const address = formData.diachi?.trim();

    if (!name || !address) return;

    setSaving(true);
    try {
      // Kiểm tra trùng tên Bệnh viện hoặc Địa chỉ
      // Quy tắc: Mỗi tên bệnh viện và địa chỉ chỉ tồn tại duy nhất
      let query = supabase
        .from('DanhMucBenhVien')
        .select('maso')
        .or(`tenbenhvien.eq."${name}",diachi.eq."${address}"`);
      
      if (isEditing && formData.maso) {
        query = query.neq('maso', formData.maso);
      }

      const { data: duplicate } = await query;

      if (duplicate && duplicate.length > 0) {
        setErrorMessage('Trùng tên Bệnh viện hoặc Địa chỉ!');
        setIsErrorModalOpen(true);
        setSaving(false);
        return;
      }

      if (isEditing && formData.maso) {
        const { error } = await supabase
          .from('DanhMucBenhVien')
          .update({ 
            tenbenhvien: name, 
            diachi: address 
          })
          .eq('maso', formData.maso);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('DanhMucBenhVien')
          .insert([{ 
            tenbenhvien: name, 
            diachi: address 
          }]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMessage('Lỗi khi lưu dữ liệu: ' + err.message);
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete.item) return;
    try {
      const { error } = await supabase
        .from('DanhMucBenhVien')
        .delete()
        .eq('maso', confirmDelete.item.maso);
      if (error) throw error;
      setConfirmDelete({ isOpen: false, item: null });
      fetchData();
    } catch (err: any) {
      setErrorMessage('Lỗi khi xóa: ' + err.message);
      setIsErrorModalOpen(true);
    }
  };

  const handleExportExcel = () => {
    // Chuẩn bị dữ liệu theo các cột yêu cầu
    const exportData = filteredList.map((item, index) => ({
      'STT': index + 1,
      'Mã số': item.maso,
      'Tên Bệnh viện': item.tenbenhvien,
      'Địa chỉ': item.diachi,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhMucBenhVien");
    
    // Xuất file XLSX với UTF-8 (mặc định của thư viện)
    XLSX.writeFile(wb, "DanhMucBenhVien_KhamChuaBenh.xlsx");
  };

  const filteredList = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return list.filter(item => 
      (item.tenbenhvien || '').toLowerCase().includes(search) || 
      (item.diachi || '').toLowerCase().includes(search)
    );
  }, [list, searchTerm]);

  // Kiểm tra sự thay đổi để kích hoạt nút Lưu (chỉ dành cho Hiệu chỉnh)
  const isDataChanged = useMemo(() => {
    if (!isEditing) return true; // Thêm mới luôn cho phép lưu
    return formData.tenbenhvien?.trim() !== originalData.tenbenhvien?.trim() || 
           formData.diachi?.trim() !== originalData.diachi?.trim();
  }, [formData, originalData, isEditing]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2.5 rounded-xl shadow-lg shadow-red-100">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-blue-900 tracking-tight">Danh sách Bệnh viện khám và chữa bệnh</h2>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={handleExportExcel}
            disabled={filteredList.length === 0}
            className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl hover:bg-blue-200 transition-all border border-blue-200 disabled:opacity-50"
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

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm Tên Bệnh viện hoặc Địa chỉ..."
            //className="pl-10 w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all bg-gray-50/50"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* List Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left border-collapse">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-sm font-normal text-red-600 tracking-wider text-center w-20">STT</th>
                <th className="px-6 py-4 text-sm font-normal text-red-600 tracking-wider text-center w-24">Mã số</th>
                <th className="px-6 py-4 text-sm font-normal text-red-600 tracking-wider">Tên bệnh viện</th>
                <th className="px-6 py-4 text-sm font-normal text-red-600 tracking-wider">Địa chỉ</th>
                {(canUpdate || canDelete) && (
                  <th className="px-6 py-4 text-sm font-normal text-red-600 tracking-wider text-center w-48">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-red-600" />
                    <p className="mt-2 text-gray-400 text-xs tracking-widest">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy bệnh viện nào phù hợp.</td>
                </tr>
              ) : (
                filteredList.map((item, index) => (
                  <tr key={item.maso} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-center text-gray-600">{index + 1}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600">{item.maso}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.tenbenhvien}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.diachi}</td>
                    {(canUpdate || canDelete) && (
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <div className="flex justify-center gap-2">
                          {canUpdate && (
                            <button 
                              onClick={() => handleOpenEdit(item)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-blue-100"
                            >
                              <Pencil size={14} /> Hiệu chỉnh
                            </button>
                          )}
                          {canDelete && (
                            <button 
                              onClick={() => setConfirmDelete({ isOpen: true, item })}
                              className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-red-100"
                            >
                              <Trash2 size={14} /> Xóa
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

      {/* Add/Edit Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSave} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-red-700 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3">
                {isEditing ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {isEditing ? 'Hiệu chỉnh' : 'Thêm mới bệnh viện'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="h-7 w-7" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div>
                <label className="text-sm font-normal text-red-600 mb-1.5 block">Tên bệnh viện</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên bệnh viện..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all font-bold bg-white text-black"
                  value={formData.tenbenhvien || ''}
                  onChange={e => setFormData({ ...formData, tenbenhvien: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-sm font-normal text-red-600 mb-1.5 block">Địa chỉ</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Nhập địa chỉ bệnh viện..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all font-bold bg-white text-black"
                  value={formData.diachi || ''}
                  onChange={e => setFormData({ ...formData, diachi: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-6 py-2.5 text-gray-500 font-bold text-xs hover:text-gray-700 transition-colors uppercase"
              >
                Nút đóng hồ sơ
              </button>
              <button 
                type="submit" 
                disabled={saving || !isDataChanged} 
                className="px-8 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50 disabled:bg-gray-400 disabled:shadow-none flex items-center gap-2 text-xs uppercase"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete.isOpen && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 text-center space-y-4">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-red-600 border border-red-100">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">Xác nhận xóa</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Bạn có chắc chắn muốn xóa bệnh viện <span className="text-red-600 font-bold">{confirmDelete.item?.tenbenhvien}</span> khỏi hệ thống không?
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center gap-3 border-t border-gray-100">
              <button 
                onClick={() => setConfirmDelete({ isOpen: false, item: null })}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all text-xs uppercase shadow-sm"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 text-xs uppercase"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Footer Info */}
      <div className="text-center pt-4">
        <p className="text-[10px] text-red-400 font-bold tracking-widest italic opacity-60">
          DAU HRMS - QUẢN LÝ DANH MỤC BỆNH VIỆN KHÁM CHỮA BỆNH
        </p>
      </div>

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