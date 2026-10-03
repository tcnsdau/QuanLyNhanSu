
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { NgayNghiLe } from '../types';
import { 
  Search, Plus, Pencil, Trash2, X, Save, 
  CalendarDays, Loader2, AlertCircle, CheckCircle2 
} from 'lucide-react';

export const NgayNghiLeManagement: React.FC = () => {
  const [list, setList] = useState<NgayNghiLe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

  const [messageContent, setMessageContent] = useState('');
  const [deletingItem, setDeletingItem] = useState<NgayNghiLe | null>(null);
  const [editingItem, setEditingItem] = useState<NgayNghiLe | null>(null);
  const [originalEditReason, setOriginalEditReason] = useState('');
  
  const [addForm, setAddForm] = useState({ ngaynghi: '', lydonghi: '' });
  const [saving, setSaving] = useState(false);

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('DanhSachNgayNghiLe')
        .select('*')
        .order('ngaynghi', { ascending: true });
      if (error) throw error;
      setList(data || []);
    } catch (err: any) {
      showAlert('Lỗi khi tải danh sách ngày nghỉ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  // fixed: Added missing handleOpenAdd function
  const handleOpenAdd = () => {
    setAddForm({ ngaynghi: '', lydonghi: '' });
    setIsAddModalOpen(true);
  };

  const handleDateChangeInAdd = (date: string) => {
    let reason = '';
    if (date) {
      const parts = date.split('-');
      const day = parts[2];
      const month = parts[1];
      
      if (day === '01' && month === '01') reason = 'Tết Dương lịch';
      else if (day === '30' && month === '04') reason = 'Lễ Chiến thắng 30/4';
      else if (day === '01' && month === '05') reason = 'Lễ Quốc tế Lao động 1/5';
      else if (day === '02' && month === '09') reason = 'Lễ Quốc Khánh 02/9';
    }
    setAddForm({ ngaynghi: date, lydonghi: reason });
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.ngaynghi || !addForm.lydonghi.trim()) return;

    setSaving(true);
    try {
      // Kiểm tra trùng ngày
      const isDuplicate = list.some(item => item.ngaynghi === addForm.ngaynghi);
      if (isDuplicate) {
        setMessageContent(`Ngày nghỉ Lễ ${formatDate(addForm.ngaynghi)} đã có, hãy chọn ngày khác`);
        setIsMessageModalOpen(true);
        setSaving(false);
        return;
      }

      // Tự động tính maso mới dựa trên giá trị lớn nhất trong table
      const { data: allMaso, error: fetchMasoError } = await supabase
        .from('DanhSachNgayNghiLe')
        .select('maso');

      let nextMaso = 1;
      if (!fetchMasoError && allMaso && allMaso.length > 0) {
        const masoNumbers = allMaso.map(item => parseInt(String(item.maso)) || 0);
        nextMaso = Math.max(...masoNumbers, 0) + 1;
      } else if (list && list.length > 0) {
        const masoNumbers = list.map(item => parseInt(String(item.maso)) || 0);
        nextMaso = Math.max(...masoNumbers, 0) + 1;
      }

      const { error } = await supabase
        .from('DanhSachNgayNghiLe')
        .insert([{ maso: nextMaso, ngaynghi: addForm.ngaynghi, lydonghi: addForm.lydonghi.trim() }]);

      if (error) throw error;

      setMessageContent(`Ngày nghỉ Lễ ${formatDate(addForm.ngaynghi)} đã lưu`);
      setIsMessageModalOpen(true);
      setIsAddModalOpen(false);
      fetchData();
    } catch (err: any) {
      showAlert('Lỗi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (item: NgayNghiLe) => {
    setEditingItem({ ...item });
    setOriginalEditReason(item.lydonghi);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.lydonghi.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('DanhSachNgayNghiLe')
        .update({ lydonghi: editingItem.lydonghi.trim() })
        .eq('maso', editingItem.maso);

      if (error) throw error;

      setMessageContent('Thông tin ngày nghỉ đã được cập nhập');
      setIsMessageModalOpen(true);
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      showAlert('Lỗi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deletingItem) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('DanhSachNgayNghiLe')
        .delete()
        .eq('maso', deletingItem.maso);
      if (error) throw error;
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (err: any) {
      showAlert('Lỗi: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredList = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return list.filter(item => 
      formatDate(item.ngaynghi).includes(s) || 
      (item.lydonghi || '').toLowerCase().includes(s)
    );
  }, [list, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-100">
            <CalendarDays className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-blue-900 tracking-tight">Danh sách ngày nghỉ trong năm</h2>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-all active:scale-95 text-sm"
        >
          <Plus className="h-4 w-4" /> Thêm mới
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm ngày nghỉ lễ hoặc nội dung nghỉ lễ..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white text-black font-medium"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-xs font-bold text-gray-400 tracking-widest">
           Tổng số: <span className="text-blue-600">{filteredList.length}</span> ngày nghỉ
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left border-collapse">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest text-center w-24">Mã số</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest text-center">Ngày nghỉ</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest">Lý do nghỉ</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest text-center w-48">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-indigo-600" />
                    <p className="mt-2 text-gray-400 text-xs tracking-widest">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy ngày nghỉ lễ nào.</td>
                </tr>
              ) : (
                filteredList.map((item) => (
                  <tr key={item.maso} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-center text-gray-600">{item.maso}</td>
                    <td className="px-6 py-4 text-sm text-center text-blue-900 font-bold">{formatDate(item.ngaynghi)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.lydonghi}</td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleOpenEdit(item)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-blue-100"
                        >
                          <Pencil size={14} /> Hiệu chỉnh
                        </button>
                        <button 
                          onClick={() => { setDeletingItem(item); setIsDeleteModalOpen(true); }}
                          className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-red-100"
                        >
                          <X size={14} /> Hủy bỏ
                        </button>
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
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveAdd} className="bg-[#f0f4f8] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="bg-white p-3 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <div className="bg-blue-600 p-1 rounded"><CalendarDays className="h-4 w-4 text-white" /></div>
                 <span className="text-sm font-bold text-gray-800">Thêm mới ngày nghỉ Lễ</span>
              </div>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <div className="p-6">
              <fieldset className="border border-gray-300 rounded-lg p-4 bg-white/50 space-y-4">
                 <legend className="px-2 text-xs font-bold text-gray-500">Ngày nghỉ và Lý do</legend>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-sm font-bold text-red-500">Ngày nghỉ Lễ</label>
                       <input 
                         type="date" 
                         required
                         className="w-full p-2 border border-gray-300 rounded text-sm font-bold text-blue-800 outline-none focus:ring-1 focus:ring-blue-400"
                         value={addForm.ngaynghi}
                         onChange={e => handleDateChangeInAdd(e.target.value)}
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-sm font-bold text-red-500">Lý do được nghỉ</label>
                       <input 
                         type="text" 
                         required
                         placeholder="Nhập lý do..."
                         className="w-full p-2 border-b border-blue-600 outline-none text-sm font-bold text-black bg-transparent"
                         value={addForm.lydonghi}
                         onChange={e => setAddForm({ ...addForm, lydonghi: e.target.value })}
                       />
                    </div>
                 </div>
              </fieldset>
            </div>

            <div className="bg-white/80 p-4 border-t flex justify-center gap-4">
               <button 
                 type="submit" 
                 disabled={saving || !addForm.ngaynghi || !addForm.lydonghi.trim()}
                 className="px-8 py-2 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2 text-sm font-bold text-gray-700 disabled:opacity-50"
               >
                 {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} className="text-gray-400" />}
                 Lưu hồ sơ
               </button>
               <button 
                 type="button" 
                 onClick={() => setIsAddModalOpen(false)}
                 className="px-8 py-2 bg-white border border-gray-300 rounded shadow-sm hover:bg-red-50 transition-all flex items-center gap-2 text-sm font-bold text-gray-700"
               >
                 <X size={16} className="text-red-500" />
                 Hủy bỏ
               </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveEdit} className="bg-[#f0f4f8] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="bg-white p-3 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <div className="bg-blue-600 p-1 rounded"><CalendarDays className="h-4 w-4 text-white" /></div>
                 <span className="text-sm font-bold text-gray-800">Hiệu chỉnh ngày nghỉ Lễ</span>
              </div>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            
            <div className="p-6">
              <fieldset className="border border-gray-300 rounded-lg p-4 bg-white/50 space-y-4">
                 <legend className="px-2 text-xs font-bold text-gray-500">Ngày nghỉ và Lý do</legend>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-sm font-bold text-red-500">Ngày nghỉ Lễ</label>
                       <input 
                         type="date" 
                         readOnly
                         disabled
                         className="w-full p-2 border border-gray-300 rounded text-sm font-bold text-gray-400 bg-gray-100 cursor-not-allowed shadow-inner"
                         value={editingItem.ngaynghi}
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-sm font-bold text-red-500">Lý do được nghỉ</label>
                       <input 
                         type="text" 
                         required
                         placeholder="Nhập lý do..."
                         className="w-full p-2 border-b border-blue-600 outline-none text-sm font-bold text-black bg-transparent"
                         value={editingItem.lydonghi}
                         onChange={e => setEditingItem({ ...editingItem, lydonghi: e.target.value })}
                       />
                    </div>
                 </div>
              </fieldset>
            </div>

            <div className="bg-white/80 p-4 border-t flex justify-center gap-4">
               <button 
                 type="submit" 
                 disabled={saving || !editingItem.lydonghi.trim() || editingItem.lydonghi === originalEditReason}
                 className="px-8 py-2 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 transition-all flex items-center gap-2 text-sm font-bold text-gray-700 disabled:opacity-50"
               >
                 {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} className="text-green-600" />}
                 Cập nhập
               </button>
               <button 
                 type="button" 
                 onClick={() => setIsEditModalOpen(false)}
                 className="px-8 py-2 bg-white border border-gray-300 rounded shadow-sm hover:bg-red-50 transition-all flex items-center gap-2 text-sm font-bold text-gray-700"
               >
                 <X size={16} className="text-red-500" />
                 Hủy bỏ
               </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingItem && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-red-100">
            <div className="bg-red-600 p-4 text-white flex items-center gap-3">
              <AlertCircle size={20} />
              <h3 className="text-md font-bold">Xác nhận xóa</h3>
            </div>
            <div className="p-8 text-center">
              <p className="text-gray-700 font-medium leading-relaxed">
                Bạn đồng ý xóa ngày nghỉ lễ <span className="text-red-600 font-bold">{formatDate(deletingItem.ngaynghi)}</span> ra khỏi danh sách?
              </p>
            </div>
            <div className="bg-gray-50 p-4 flex justify-center gap-3 border-t">
              <button 
                onClick={executeDelete}
                disabled={saving}
                className="flex-1 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all active:scale-95 text-sm"
              >
                {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Đồng ý'}
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal (Success/Alert) */}
      {isMessageModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-indigo-100">
            <div className="bg-indigo-600 p-4 text-white flex items-center gap-3">
              <CheckCircle2 size={20} />
              <h3 className="text-md font-bold">Thông báo</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-gray-700 font-bold text-sm leading-relaxed whitespace-pre-wrap">{messageContent}</p>
            </div>
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
              <button 
                onClick={() => setIsMessageModalOpen(false)} 
                className="px-10 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-md text-xs uppercase tracking-widest"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert Modal */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-red-100">
            <div className="bg-red-600 p-4 text-white flex items-center gap-3">
              <AlertCircle size={20} />
              <h3 className="text-md font-bold uppercase tracking-tight">Thông báo lỗi</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-gray-700 font-bold text-sm leading-relaxed whitespace-pre-wrap">{alertMessage}</p>
            </div>
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
              <button 
                onClick={() => setIsAlertModalOpen(false)} 
                className="px-10 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-md text-xs uppercase tracking-widest"
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
