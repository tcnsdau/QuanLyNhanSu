
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { DanhMucNganhDaoTao, RolePermission } from '../types';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { 
  Plus, Pencil, Trash2, X, Save, FileDown, 
  Search, AlertTriangle, CheckCircle2, Loader2,
  GraduationCap, BookOpen, Layers, Hash
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  permissions?: RolePermission[];
  isAdmin?: boolean;
  currentUser?: any;
}

export const DanhMucNganhDaoTaoManagement: React.FC<Props> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [data, setData] = useState<DanhMucNganhDaoTao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  
  const [editingRecord, setEditingRecord] = useState<DanhMucNganhDaoTao | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<DanhMucNganhDaoTao | null>(null);
  const [formData, setFormData] = useState({
    manganh: '',
    tennganh: '',
    khoinganh: '',
    linhvuc: ''
  });
  
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  // Permission checks
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'nganhHoc-danhMuc', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'nganhHoc-danhMuc', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'nganhHoc-danhMuc', 'DELETE'), [permissions, isAdmin]);
  const canRead = useMemo(() => checkPermission(permissions, isAdmin, 'nganhHoc-danhMuc', 'READ'), [permissions, isAdmin]);

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
        console.error('Error fetching permissions:', err);
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase
        .from('DanhMucNganhDaoTao')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;
      setData(result || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data.filter(item => 
    item.tennganh.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.manganh.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAdd = () => {
    setFormData({ manganh: '', tennganh: '', khoinganh: '', linhvuc: '' });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (record: DanhMucNganhDaoTao) => {
    setEditingRecord(record);
    setFormData({
      manganh: record.manganh,
      tennganh: record.tennganh,
      khoinganh: record.khoinganh,
      linhvuc: record.linhvuc
    });
    setIsEditModalOpen(true);
  };

  const handleOpenDelete = (record: DanhMucNganhDaoTao) => {
    setDeletingRecord(record);
    setIsDeleteModalOpen(true);
  };

  const checkExists = async (manganh: string, tennganh: string, excludeId?: number) => {
    let query = supabase.from('DanhMucNganhDaoTao').select('id, manganh, tennganh');
    
    const { data: existing } = await query;
    if (!existing) return { manganhExists: false, tennganhExists: false };

    const manganhExists = existing.some(item => 
      item.manganh.toLowerCase() === manganh.toLowerCase() && item.id !== excludeId
    );
    const tennganhExists = existing.some(item => 
      item.tennganh.toLowerCase() === tennganh.toLowerCase() && item.id !== excludeId
    );

    return { manganhExists, tennganhExists };
  };

  const handleAdd = async () => {
    if (!formData.manganh || !formData.tennganh || !formData.khoinganh || !formData.linhvuc) return;
    
    setSaving(true);
    try {
      const { manganhExists, tennganhExists } = await checkExists(formData.manganh, formData.tennganh);
      
      if (manganhExists) {
        setErrorMessage(`Mã ngành này đã tồn tại, hãy nhập Mã ngành mới`);
        setIsErrorModalOpen(true);
        setSaving(false);
        return;
      }
      if (tennganhExists) {
        setErrorMessage(`Tên ngành này đã tồn tại, hãy nhập Tên ngành mới`);
        setIsErrorModalOpen(true);
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('DanhMucNganhDaoTao').insert([formData]);
      if (error) throw error;

      setMessage('Đã lưu nội dung xong');
      setIsAddModalOpen(false);
      setIsSuccessModalOpen(true);
      fetchData();
    } catch (error: any) {
      setErrorMessage('Lỗi khi lưu dữ liệu: ' + error.message);
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editingRecord) return;
    
    // Check if anything changed
    const isChanged = 
      formData.manganh !== editingRecord.manganh ||
      formData.tennganh !== editingRecord.tennganh ||
      formData.khoinganh !== editingRecord.khoinganh ||
      formData.linhvuc !== editingRecord.linhvuc;
    
    if (!isChanged) {
      setIsEditModalOpen(false);
      return;
    }

    setSaving(true);
    try {
      // Only check existence if manganh or tennganh changed
      if (formData.manganh !== editingRecord.manganh || formData.tennganh !== editingRecord.tennganh) {
        const { manganhExists, tennganhExists } = await checkExists(formData.manganh, formData.tennganh, editingRecord.id);
        
        if (formData.manganh !== editingRecord.manganh && manganhExists) {
          setErrorMessage(`Mã ngành này đã tồn tại, hãy điều chỉnh lại!`);
          setIsErrorModalOpen(true);
          setSaving(false);
          return;
        }
        if (formData.tennganh !== editingRecord.tennganh && tennganhExists) {
          setErrorMessage(`Tên ngành này đã tồn tại, hãy điều chỉnh lại!`);
          setIsErrorModalOpen(true);
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from('DanhMucNganhDaoTao')
        .update(formData)
        .eq('id', editingRecord.id);
      
      if (error) throw error;

      setMessage('Đã cập nhập nội dung thay đổi');
      setIsEditModalOpen(false);
      setIsSuccessModalOpen(true);
      fetchData();
    } catch (error: any) {
      setErrorMessage('Lỗi khi cập nhật: ' + error.message);
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRecord) return;
    
    try {
      const { error } = await supabase
        .from('DanhMucNganhDaoTao')
        .delete()
        .eq('id', deletingRecord.id);
      
      if (error) throw error;

      setMessage(`Tên ngành Đào tạo ${deletingRecord.tennganh} đã được xóa khỏi danh sách`);
      setIsDeleteModalOpen(false);
      setIsSuccessModalOpen(true);
      fetchData();
    } catch (error: any) {
      setErrorMessage('Lỗi khi xóa: ' + error.message);
      setIsErrorModalOpen(true);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      'Mã số': item.id,
      'Mã ngành': item.manganh,
      'Tên ngành Đào tạo': item.tennganh,
      'Khối ngành': item.khoinganh,
      'Lĩnh vực Đào tạo': item.linhvuc
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh sách ngành đào tạo");
    
    // Generate buffer
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Create download link
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Danh_sach_nganh_dao_tao_${new Date().getTime()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isFormValid = formData.manganh && formData.tennganh && formData.khoinganh && formData.linhvuc;

  if (!loading && !canRead) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-gray-100 animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-red-50 rounded-full">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Không có quyền truy cập</h3>
          <p className="text-gray-500 max-w-md">
            Bạn không có quyền xem chức năng "Danh mục Ngành Đào tạo". Vui lòng liên hệ quản trị viên để được cấp quyền.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
            <GraduationCap className="text-blue-600" />
            Danh mục Ngành Đào tạo
          </h2>
          <p className="text-sm text-gray-500 mt-1">Quản lý danh mục các ngành đào tạo của nhà trường</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input 
              type="text"
              placeholder="Tìm kiếm ngành đào tạo..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {canCreate && (
            <button 
              onClick={handleOpenAdd}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
            >
              <Plus size={18} />
              Thêm mới
            </button>
          )}
          
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-all active:scale-95"
          >
            <FileDown size={18} />
            Xuất Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-sm font-bold text-red-600">Mã số</th>
                <th className="px-6 py-4 text-sm font-bold text-red-600">(Mã ngành</th>
                <th className="px-6 py-4 text-sm font-bold text-red-600">Tên ngành Đào tạo</th>
                <th className="px-6 py-4 text-sm font-bold text-red-600">Khối ngành</th>
                <th className="px-6 py-4 text-sm font-bold text-red-600">Lĩnh vực Đào tạo</th>
                <th className="px-6 py-4 text-sm font-bold text-red-600 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                      <p className="text-sm text-gray-400 font-medium">Đang tải dữ liệu...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <BookOpen className="h-10 w-10 text-gray-200" />
                      <p className="text-sm text-gray-400 font-medium">Không tìm thấy dữ liệu phù hợp</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4 text-sm text-blue-600">{item.id}</td>
                    <td className="px-6 py-4 text-sm text-blue-600">{item.manganh}</td>
                    <td className="px-6 py-4 text-sm text-blue-600 font-medium">{item.tennganh}</td>
                    <td className="px-6 py-4 text-sm text-blue-600">{item.khoinganh}</td>
                    <td className="px-6 py-4 text-sm text-blue-600">{item.linhvuc}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {canUpdate && (
                          <button 
                            onClick={() => handleOpenEdit(item)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                            title="Hiệu chỉnh"
                          >
                            <Pencil size={14} />
                            Hiệu chỉnh
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleOpenDelete(item)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium"
                            title="Xóa"
                          >
                            <Trash2 size={14} />
                            Xóa
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
        <div className="bg-gray-50/50 px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 font-medium italic">Tổng số: {filteredData.length} ngành đào tạo</p>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-100">
            <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Plus size={20} />
                Thêm mới ngành Đào tạo
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="hover:rotate-90 transition-transform">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-red-500 tracking-wider flex items-center gap-2">
                    <Hash size={14} className="text-blue-500" />
                    Mã ngành
                  </label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Nhập mã ngành..."
                    value={formData.manganh}
                    onChange={(e) => setFormData({...formData, manganh: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-red-500 tracking-wider flex items-center gap-2">
                    <BookOpen size={14} className="text-blue-500" />
                    Tên ngành Đào tạo
                  </label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Nhập tên ngành đào tạo..."
                    value={formData.tennganh}
                    onChange={(e) => setFormData({...formData, tennganh: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-red-500 tracking-wider flex items-center gap-2">
                    <Layers size={14} className="text-blue-500" />
                    Khối ngành
                  </label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Nhập khối ngành..."
                    value={formData.khoinganh}
                    onChange={(e) => setFormData({...formData, khoinganh: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-red-500 tracking-wider flex items-center gap-2">
                    <GraduationCap size={14} className="text-blue-500" />
                    Lĩnh vực Đào tạo
                  </label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Nhập lĩnh vực đào tạo..."
                    value={formData.linhvuc}
                    onChange={(e) => setFormData({...formData, linhvuc: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleAdd}
                disabled={saving || !isFormValid}
                className="px-8 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none flex items-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Lưu dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-100">
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Pencil size={20} />
                Hiệu chỉnh ngành Đào tạo
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="hover:rotate-90 transition-transform">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-red-500 tracking-wider flex items-center gap-2">
                    <Hash size={14} className="text-indigo-500" />
                    Mã ngành
                  </label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={formData.manganh}
                    onChange={(e) => setFormData({...formData, manganh: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 tracking-wider flex items-center gap-2">
                    <BookOpen size={14} className="text-indigo-500" />
                    Tên ngành Đào tạo
                  </label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={formData.tennganh}
                    onChange={(e) => setFormData({...formData, tennganh: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-red-500 tracking-wider flex items-center gap-2">
                    <Layers size={14} className="text-indigo-500" />
                    Khối ngành
                  </label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={formData.khoinganh}
                    onChange={(e) => setFormData({...formData, khoinganh: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-red-500 tracking-wider flex items-center gap-2">
                    <GraduationCap size={14} className="text-indigo-500" />
                    Lĩnh vực Đào tạo
                  </label>
                  <input 
                    type="text"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={formData.linhvuc}
                    onChange={(e) => setFormData({...formData, linhvuc: e.target.value})}
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-6 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleEdit}
                disabled={saving}
                className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none flex items-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingRecord && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
            <div className="bg-red-600 p-6 text-white flex items-center gap-3">
              <AlertTriangle size={28} />
              <h3 className="text-lg font-bold">Xác nhận xóa</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-gray-700 font-medium leading-relaxed">
                Bạn chắc chắn muốn xóa Tên ngành Đào tạo <span className="font-bold text-red-600">{deletingRecord.tennganh}</span> ra khỏi danh sách?
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center gap-4 border-t border-gray-100">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-8 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleDelete}
                className="px-10 py-2 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-emerald-100">
            <div className="bg-emerald-600 p-6 text-white flex items-center gap-3">
              <CheckCircle2 size={28} />
              <h3 className="text-lg font-bold">Thông báo</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-gray-700 font-bold text-sm leading-relaxed">
                {message}
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center border-t border-gray-100">
              <button 
                onClick={() => setIsSuccessModalOpen(false)}
                className="px-12 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {isErrorModalOpen && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-red-100">
            <div className="bg-red-600 p-6 text-white flex items-center gap-3">
              <AlertTriangle size={28} />
              <h3 className="text-lg font-bold">Thông báo</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-red-700 font-bold text-sm leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center border-t border-gray-100">
              <button 
                onClick={() => setIsErrorModalOpen(false)}
                className="px-12 py-2 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95"
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
