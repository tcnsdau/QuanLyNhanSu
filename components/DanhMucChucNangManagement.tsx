
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission } from '../services/permissionService';
import { Module, RolePermission } from '../types';
import { 
  Plus, Edit2, Trash2, FileDown, X, Save, 
  CheckCircle2, AlertTriangle, Loader2, Search,
  ToggleLeft, ToggleRight, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const DanhMucChucNangManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean }> = ({ permissions, isAdmin }) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Permission Logic
  const canCreate = checkPermission(permissions, isAdmin, 'danhMucChucNang', 'CREATE');
  const canUpdate = checkPermission(permissions, isAdmin, 'danhMucChucNang', 'UPDATE');
  const canDelete = checkPermission(permissions, isAdmin, 'danhMucChucNang', 'DELETE');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    modulename: '',
    modulecode: '',
    enable: true
  });
  
  // Message states
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('Modules')
        .select('*')
        .order('id', { ascending: true });
      
      if (error) throw error;
      setModules(data || []);
    } catch (err: any) {
      setErrorMessage('Lỗi khi tải danh mục chức năng: ' + (err.message || String(err)));
      setIsErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = modules.map((m, index) => ({
      'STT': index + 1,
      'ID': m.id,
      'Tên chức năng': m.modulename,
      'Mã code': m.modulecode,
      'Hiệu lực': m.enable ? 'Có hiệu lực' : 'Không hiệu lực'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhMucChucNang");
    
    // Add UTF-8 BOM for Vietnamese characters
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Danh_muc_chuc_nang.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validateModule = async (name: string, code: string, excludeId?: number) => {
    let query = supabase.from('Modules').select('modulename, modulecode');
    
    const { data, error } = await query;
    if (error) return false;

    const exists = data.some(m => 
      (m.modulename.toLowerCase() === name.toLowerCase() || m.modulecode.toLowerCase() === code.toLowerCase()) &&
      (!excludeId || (modules.find(mod => mod.id === excludeId)?.modulename !== name || modules.find(mod => mod.id === excludeId)?.modulecode !== code))
    );

    // More precise check: only check if name or code changed
    if (excludeId) {
      const original = modules.find(m => m.id === excludeId);
      if (original) {
        const nameChanged = original.modulename.toLowerCase() !== name.toLowerCase();
        const codeChanged = original.modulecode.toLowerCase() !== code.toLowerCase();
        
        if (!nameChanged && !codeChanged) return false; // No change in name/code, no need to check uniqueness
        
        const duplicate = data.find(m => {
          const isSameModule = (modules.find(mod => mod.modulename === m.modulename && mod.modulecode === m.modulecode)?.id === excludeId);
          if (isSameModule) return false;
          
          if (nameChanged && m.modulename.toLowerCase() === name.toLowerCase()) return true;
          if (codeChanged && m.modulecode.toLowerCase() === code.toLowerCase()) return true;
          return false;
        });
        return !!duplicate;
      }
    } else {
      return data.some(m => m.modulename.toLowerCase() === name.toLowerCase() || m.modulecode.toLowerCase() === code.toLowerCase());
    }
    
    return false;
  };

  const handleAddModule = async () => {
    if (!formData.modulename || !formData.modulecode) {
      setMessage({ text: 'Vui lòng nhập đầy đủ thông tin', type: 'warning' });
      return;
    }

    const isDuplicate = await validateModule(formData.modulename, formData.modulecode);
    if (isDuplicate) {
      setMessage({ text: `Tên chức năng (${formData.modulecode}) này đã tồn tại, hãy nhập giá trị khác`, type: 'error' });
      return;
    }

    try {
      const { error } = await supabase
        .from('Modules')
        .insert([{ 
          modulename: formData.modulename, 
          modulecode: formData.modulecode,
          enable: true 
        }]);
      
      if (error) throw error;
      
      setMessage({ text: 'Chức năng mới đã được lưu vào Hệ thống', type: 'success' });
      setTimeout(() => {
        setShowAddModal(false);
        setMessage(null);
        fetchModules();
      }, 1500);
    } catch (err: any) {
      setErrorMessage('Lỗi khi thêm chức năng: ' + (err.message || String(err)));
      setIsErrorModalOpen(true);
      setMessage({ text: 'Lỗi khi lưu chức năng', type: 'error' });
    }
  };

  const handleEditModule = async () => {
    if (!selectedModule) return;

    const nameChanged = selectedModule.modulename !== formData.modulename;
    const codeChanged = selectedModule.modulecode !== formData.modulecode;

    if (nameChanged || codeChanged) {
      const isDuplicate = await validateModule(formData.modulename, formData.modulecode, selectedModule.id);
      if (isDuplicate) {
        setMessage({ text: `Tên chức năng (${formData.modulecode}) này đã tồn tại, hãy điều chỉnh lại`, type: 'error' });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('Modules')
        .update({ 
          modulename: formData.modulename, 
          modulecode: formData.modulecode,
          enable: formData.enable
        })
        .eq('id', selectedModule.id);
      
      if (error) throw error;
      
      setMessage({ text: 'Hệ thống đã lưu các thay đổi', type: 'success' });
      setTimeout(() => {
        setShowEditModal(false);
        setMessage(null);
        fetchModules();
      }, 1500);
    } catch (err: any) {
      setErrorMessage('Lỗi khi cập nhật chức năng: ' + (err.message || String(err)));
      setIsErrorModalOpen(true);
      setMessage({ text: 'Lỗi khi cập nhật chức năng', type: 'error' });
    }
  };

  const handleDeleteModule = async () => {
    if (!selectedModule) return;

    try {
      const { error } = await supabase
        .from('Modules')
        .delete()
        .eq('id', selectedModule.id);
      
      if (error) throw error;
      
      setShowDeleteModal(false);
      fetchModules();
    } catch (err: any) {
      setErrorMessage('Lỗi khi xóa chức năng: ' + (err.message || String(err)));
      setIsErrorModalOpen(true);
    }
  };

  const filteredModules = modules.filter(m => 
    m.modulename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.modulecode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800 tracking-tight">Danh mục chức năng</h1>
          <p className="text-gray-500 text-sm">Quản lý các module chức năng trên hệ thống</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <FileDown size={18} />
            Xuất Excel
          </button>
          {canCreate && (
            <button 
              onClick={() => {
                setFormData({ modulename: '', modulecode: '', enable: true });
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Plus size={18} />
              Thêm mới
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder="Tìm kiếm chức năng..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs font-bold text-gray-400">
            Tổng số: {filteredModules.length} chức năng
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider text-center">STT</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider">Tên chức năng</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider">Mã code</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider text-center">Hiệu lực</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-wider text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin mx-auto text-blue-600" size={32} />
                    <p className="mt-2 text-gray-500 font-medium">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredModules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="text-gray-300 mb-2">
                      <Search size={48} className="mx-auto" />
                    </div>
                    <p className="text-gray-500 font-medium">Không tìm thấy chức năng nào</p>
                  </td>
                </tr>
              ) : (
                filteredModules.map((m, index) => (
                  <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-center text-sm font-medium text-gray-500">{index + 1}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-700">{m.id}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{m.modulename}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-mono">
                        {m.modulecode}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider ${
                        m.enable ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {m.enable ? 'Có hiệu lực' : 'Không hiệu lực'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        {canUpdate && (
                          <button 
                            onClick={() => {
                              setSelectedModule(m);
                              setFormData({ modulename: m.modulename, modulecode: m.modulecode, enable: m.enable });
                              setShowEditModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Hiệu chỉnh"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => {
                              setSelectedModule(m);
                              setShowDeleteModal(true);
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
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
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-black tracking-tight">Thêm mới Chức năng</h3>
              <button onClick={() => setShowAddModal(false)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                <p className="text-xs font-bold text-blue-600 tracking-widest mb-4">Thông tin</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-red-600 mb-1">Tên chức năng</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={formData.modulename}
                      onChange={(e) => setFormData({ ...formData, modulename: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-red-600 mb-1">Mã code</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={formData.modulecode}
                      onChange={(e) => setFormData({ ...formData, modulecode: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {message && (
                <div className={`p-3 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                  'bg-amber-50 text-amber-700 border border-amber-100'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <p className="text-xs font-bold">{message.text}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={handleAddModule}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                >
                  <Save size={18} />
                  Lưu hồ sơ
                </button>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
                >
                  <X size={18} />
                  Hủy bỏ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
              <h3 className="text-white font-black tracking-tight">Hiệu chỉnh Chức năng</h3>
              <button onClick={() => setShowEditModal(false)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                <p className="text-xs font-bold text-blue-600 tracking-widest mb-4">Thông tin</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-red-600 mb-1">Tên chức năng</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={formData.modulename}
                      onChange={(e) => setFormData({ ...formData, modulename: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-red-600 mb-1">Mã code</label>
                    <input 
                      type="text"
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={formData.modulecode}
                      onChange={(e) => setFormData({ ...formData, modulecode: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <label className="text-xs font-bold text-red-600">Hiệu lực</label>
                    <button 
                      onClick={() => setFormData({ ...formData, enable: !formData.enable })}
                      className="flex items-center gap-2 focus:outline-none"
                    >
                      {formData.enable ? (
                        <ToggleRight className="text-blue-600" size={32} />
                      ) : (
                        <ToggleLeft className="text-gray-300" size={32} />
                      )}
                      <span className={`text-xs font-black ${formData.enable ? 'text-blue-600' : 'text-gray-400'}`}>
                        {formData.enable ? 'On' : 'Off'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {message && (
                <div className={`p-3 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                  message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' :
                  'bg-amber-50 text-amber-700 border border-amber-100'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                  <p className="text-xs font-bold">{message.text}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={handleEditModule}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
                >
                  <Save size={18} />
                  Lưu thay đổi
                </button>
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all"
                >
                  <X size={18} />
                  Hủy bỏ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="size-16 bg-red-50 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-black text-gray-900 mb-2">Xác nhận xóa</h3>
              <p className="text-sm text-gray-500 font-medium">Bạn đồng ý xóa chức năng này ra khỏi danh sách?</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button 
                onClick={handleDeleteModule}
                className="flex-1 py-4 text-sm font-black text-red-600 hover:bg-red-50 transition-colors"
              >
                Đồng ý
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-4 text-sm font-black text-gray-500 hover:bg-gray-50 border-l border-gray-100 transition-colors"
              >
                Hủy bỏ
              </button>
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
