
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { ToBoMon, PhongBan, RolePermission } from '../types';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { Plus, Pencil, Trash2, X, Save, FileDown, BookMarked, Loader2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

export const DanhMucToBoMonManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [list, setList] = useState<ToBoMon[]>([]);
  const [phongBans, setPhongBans] = useState<PhongBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<ToBoMon>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
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
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'toBoMon-danhMuc', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'toBoMon-danhMuc', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'toBoMon-danhMuc', 'DELETE'), [permissions, isAdmin]);

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
          // 3. Get Modules and Permissions for mapping
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
        setErrorMessage('Lỗi tải quyền hạn Danh mục Tổ Bộ môn: ' + (err.message || String(err)));
        setIsErrorModalOpen(true);
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
      const [bmRes, pbRes] = await Promise.all([
        supabase.from('DanhMucToBoMon').select('*').order('sapxep', { ascending: true }),
        supabase.from('DanhMucPhongBan').select('*')
      ]);
      
      if (bmRes.error) throw bmRes.error;
      if (pbRes.error) throw pbRes.error;

      if (bmRes.data) setList(bmRes.data);
      if (pbRes.data) setPhongBans(pbRes.data);
    } catch (err: any) {
      setErrorMessage('Lỗi khi tải dữ liệu: ' + (err.message || String(err)));
      setIsErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // Hàm tự động tạo mã bộ môn mới
  const generateNewMaBoMon = async () => {
    try {
      const { data, error } = await supabase.from('DanhMucToBoMon').select('mabomon');
      if (error) throw error;
      
      if (data && data.length > 0) {
        const numbers = data
          .map(item => parseInt(item.mabomon) || 0)
          .filter(num => num > 0);
        
        if (numbers.length > 0) {
          const maxNum = Math.max(...numbers);
          return (maxNum + 1).toString();
        }
      }
      return "1";
    } catch (err: any) {
      setErrorMessage("Lỗi tạo mã bộ môn: " + (err.message || String(err)));
      setIsErrorModalOpen(true);
      return "1";
    }
  };

  const handleOpenAdd = async () => {
    setIsEditing(false);
    setIsGeneratingCode(true);
    
    const newMaBM = await generateNewMaBoMon();
    
    setFormData({ 
      mabomon: newMaBM, 
      giatri: '', 
      tructhuoc: phongBans[0]?.maphongban || '', 
      sapxep: list.length + 1 
    });
    
    setIsGeneratingCode(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: ToBoMon) => {
    setIsEditing(true);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const { id, ...updates } = formData;
        const { error } = await supabase.from('DanhMucToBoMon').update(updates).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('DanhMucToBoMon').insert([formData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMessage('Lỗi khi lưu dữ liệu: ' + (err.message || String(err)));
      setIsErrorModalOpen(true);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Xóa bộ môn này?")) {
      try {
        const { error } = await supabase.from('DanhMucToBoMon').delete().eq('id', id);
        if (error) throw error;
        fetchData();
      } catch (err: any) {
        setErrorMessage('Lỗi khi xóa dữ liệu: ' + (err.message || String(err)));
        setIsErrorModalOpen(true);
      }
    }
  };

  const handleExportExcel = () => {
    const dataToExport = list.map(bm => ({
      'Mã Bộ môn': bm.mabomon,
      'Tên Bộ môn': bm.giatri,
      'Đơn vị quản lý': phongBans.find(pb => pb.maphongban === bm.tructhuoc)?.giatri || bm.tructhuoc,
      'Sắp xếp': bm.sapxep
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhMucToBoMon");
    XLSX.writeFile(wb, "DanhMucToBoMon.xlsx");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
         <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
            <BookMarked className="h-7 w-7" /> Danh mục Tổ Bộ môn
         </h2>
         <div className="flex gap-2">
            <button 
              onClick={handleExportExcel} 
              className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm hover:bg-blue-200 transition-colors"
            >
               <FileDown className="h-5 w-5" /> Xuất Excel
            </button>
            {canCreate && (
              <button 
                onClick={handleOpenAdd} 
                disabled={isGeneratingCode}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                 {isGeneratingCode ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} 
                 Thêm mới
              </button>
            )}
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-center text-xs font-bold text-red-600">Mã BM</th>
              <th className="px-6 py-4 text-xs font-bold text-red-600">Tên Bộ môn</th>
              <th className="px-6 py-4 text-xs font-bold text-red-600">Đơn vị quản lý</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-red-600">Sắp xếp</th>
              <th className="px-6 py-4 text-xs font-bold text-red-600 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Đang tải...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Không tìm thấy dữ liệu.</td></tr>
            ) : (
              list.map(bm => (
                <tr key={bm.id} className="hover:bg-blue-50/50">
                  <td className="px-6 py-4 text-center text-sm font-medium text-blue-700">{bm.mabomon}</td>
                  <td className="px-6 py-4 text-sm font-medium text-blue-700">{bm.giatri}</td>
                  <td className="px-6 py-4 text-sm font-medium text-blue-700">
                    {phongBans.find(pb => pb.maphongban === bm.tructhuoc)?.giatri || bm.tructhuoc}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-600">{bm.sapxep}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      {canUpdate && (
                        <button onClick={() => handleOpenEdit(bm)} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="Hiệu chỉnh">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(bm.id)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Xóa">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      {!canUpdate && !canDelete && (
                        <span className="text-xs text-gray-400 italic">Không có quyền</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
           <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-blue-700 p-4 text-white font-bold flex justify-between items-center">
                 <span>{isEditing ? 'HIỆU CHỈNH BỘ MÔN' : 'THÊM BỘ MÔN MỚI'}</span>
                 <button type="button" onClick={() => setIsModalOpen(false)}><X className="h-6 w-6" /></button>
              </div>
              <div className="p-6 space-y-4">
                 <div>
                    <label className="text-xs font-bold text-red-500 mb-1 block">Mã BM</label>
                    <input 
                      disabled
                      type="text" 
                      value={formData.mabomon} 
                      className="w-full p-2 border border-gray-200 rounded font-bold text-gray-500 bg-gray-50 cursor-not-allowed" 
                      title="Mã này được hệ thống tạo tự động"
                    />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-red-500 mb-1 block">Tên Bộ môn</label>
                    <input required type="text" value={formData.giatri} onChange={e => setFormData({...formData, giatri: e.target.value})} className="w-full p-2 border border-gray-300 rounded font-bold text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-red-500 mb-1 block">Trực thuộc Đơn vị</label>
                    <select value={formData.tructhuoc} onChange={e => setFormData({...formData, tructhuoc: e.target.value})} className="w-full p-2 border border-gray-300 rounded font-bold text-black bg-white">
                        {phongBans.map(pb => <option key={pb.id} value={pb.maphongban}>{pb.giatri}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-red-500 mb-1 block">Thứ tự sắp xếp</label>
                    <input type="number" value={formData.sapxep} onChange={e => setFormData({...formData, sapxep: parseInt(e.target.value) || 0})} className="w-full p-2 border border-gray-300 rounded font-bold text-black bg-white" />
                 </div>
              </div>
              <div className="bg-gray-50 p-4 flex justify-end gap-2">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-red-600 font-bold">Hủy</button>
                 <button type="submit" className="px-6 py-2 bg-blue-700 text-white font-bold rounded-lg flex items-center gap-2 hover:bg-blue-800 transition-colors">
                    <Save className="h-4 w-4" /> Lưu dữ liệu
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
