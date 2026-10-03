import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { TiLeDongBH, RolePermission } from '../types';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { Search, FileDown, Pencil, X, Save, CheckCircle2, Loader2, Info, Plus, Copy, ArrowDown, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BaoHiemTiLeDongManagementProps {
  permissions?: RolePermission[];
  isAdmin?: boolean;
  currentUser?: any;
}

export const BaoHiemTiLeDongManagement: React.FC<BaoHiemTiLeDongManagementProps> = ({ 
  permissions: initialPermissions, 
  isAdmin: initialIsAdmin,
  currentUser 
}) => {
  const [list, setList] = useState<TiLeDongBH[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[] | undefined>(initialPermissions);
  const [isAdmin, setIsAdmin] = useState<boolean | undefined>(initialIsAdmin);
  
  // Module code for this component
  const MODULE_CODE = 'baoHiem-tiLeDong';

  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, MODULE_CODE, 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, MODULE_CODE, 'UPDATE'), [permissions, isAdmin]);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [editingItem, setEditingItem] = useState<TiLeDongBH | null>(null);
  const [saving, setSaving] = useState(false);

  // States for Add New feature
  const [selectedRefMaso, setSelectedRefMaso] = useState<string>('');
  const [refData, setRefData] = useState<TiLeDongBH | null>(null);
  const [newData, setNewData] = useState<Partial<TiLeDongBH>>({
    thangnam: '',
    mdttquydinh: 0,
    mdtttruong: 0,
    bhxhtruong: 0,
    bhxhnguoild: 0,
    bhyttruong: 0,
    bhytnguoild: 0,
    bhtntruong: 0,
    bhtnnguoild: 0,
    bhatldtruong: 0,
    dacosolieu: false
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ThongTinBaoHiemHangThang')
        .select('*')
        .order('maso', { ascending: false });
      
      if (error) throw error;
      
      // Sắp xếp giảm dần theo giá trị Cột “Tháng/Năm”
      const sortedData = (data || []).sort((a, b) => {
        const parseThangNamVal = (str: string) => {
          if (!str || !str.includes('/')) return { month: 0, year: 0 };
          const [m, y] = str.split('/').map(Number);
          return { month: m || 0, year: y || 0 };
        };
        const pA = parseThangNamVal(a.thangnam || '');
        const pB = parseThangNamVal(b.thangnam || '');
        if (pA.year !== pB.year) {
          return pB.year - pA.year;
        }
        return pB.month - pA.month;
      });

      setList(sortedData);
    } catch (err: any) {
      setErrorMessage('Lỗi khi tải dữ liệu bảo hiểm: ' + (err.message || String(err)));
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

  useEffect(() => {
    if (selectedRefMaso) {
      const found = list.find(item => item.maso.toString() === selectedRefMaso);
      setRefData(found || null);
    } else {
      setRefData(null);
    }
  }, [selectedRefMaso, list]);

  const incrementMonth = (thangnam: string) => {
    if (!thangnam || !thangnam.includes('/')) return '';
    const [m, y] = thangnam.split('/').map(Number);
    let nm = m + 1;
    let ny = y;
    if (nm > 12) {
      nm = 1;
      ny += 1;
    }
    return `${String(nm).padStart(2, '0')}/${ny}`;
  };

  const handleCopyPaste = () => {
    if (!refData) return;
    setNewData({
      thangnam: incrementMonth(refData.thangnam),
      mdttquydinh: refData.mdttquydinh,
      mdtttruong: refData.mdtttruong,
      bhxhtruong: refData.bhxhtruong,
      bhxhnguoild: refData.bhxhnguoild,
      bhyttruong: refData.bhyttruong,
      bhytnguoild: refData.bhytnguoild,
      bhtntruong: refData.bhtntruong,
      bhtnnguoild: refData.bhtnnguoild,
      bhatldtruong: refData.bhatldtruong,
      dacosolieu: false
    });
  };

  const handleOpenEdit = (item: TiLeDongBH) => {
    setEditingItem({ ...item });
    setIsEditModalOpen(true);
  };

  const handleOpenAdd = () => {
    setSelectedRefMaso('');
    setRefData(null);
    setNewData({
      thangnam: '', mdttquydinh: 0, mdtttruong: 0, bhxhtruong: 0, bhxhnguoild: 0,
      bhyttruong: 0, bhytnguoild: 0, bhtntruong: 0, bhtnnguoild: 0, bhatldtruong: 0, dacosolieu: false
    });
    setIsAddModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSaving(true);
    try {
      const { maso, ...updates } = editingItem;
      const { error } = await supabase.from('ThongTinBaoHiemHangThang').update(updates).eq('maso', maso);
      if (error) throw error;
      setIsEditModalOpen(false);
      setSuccessMessage(`Đã cập nhật thay đổi thành công.`);
      setIsSuccessModalOpen(true);
      fetchData();
    } catch (err: any) {
      setErrorMessage('Lỗi: ' + err.message);
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const thangnam = (newData.thangnam || '').trim();
    if (!thangnam) {
      setErrorMessage("Vui lòng nhập Tháng/Năm.");
      setIsErrorModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      const exists = list.some(item => (item.thangnam || '').trim() === thangnam);
      if (exists) {
        setErrorMessage(`Thông tin Mức đóng và Tỉ lệ đóng Bảo hiểm cho tháng ${thangnam} đã được lưu! Xin vui lòng chọn “Tháng/Năm” khác`);
        setIsErrorModalOpen(true);
        setSaving(false);
        return;
      }

      const payload: any = {
        thangnam,
        mdttquydinh: Number(newData.mdttquydinh) || 0,
        mdtttruong: Number(newData.mdtttruong) || 0,
        bhxhtruong: Number(newData.bhxhtruong) || 0,
        bhxhnguoild: Number(newData.bhxhnguoild) || 0,
        bhyttruong: Number(newData.bhyttruong) || 0,
        bhytnguoild: Number(newData.bhytnguoild) || 0,
        bhtntruong: Number(newData.bhtntruong) || 0,
        bhtnnguoild: Number(newData.bhtnnguoild) || 0,
        bhatldtruong: Number(newData.bhatldtruong) || 0,
        dacosolieu: false
      };

      const { error } = await supabase.from('ThongTinBaoHiemHangThang').insert([payload]);
      if (error) {
        const errMsg = error.message || '';
        if (errMsg.includes('duplicate key') || errMsg.includes('23505') || errMsg.includes('ThongTinBaoHiemHangThang_thangnam_key1')) {
          setErrorMessage(`Thông tin Mức đóng và Tỉ lệ đóng Bảo hiểm cho tháng ${thangnam} đã được lưu! Xin vui lòng chọn “Tháng/Năm” khác`);
        } else {
          setErrorMessage('Lỗi: ' + errMsg);
        }
        setIsErrorModalOpen(true);
        return;
      }

      setIsAddModalOpen(false);
      setSuccessMessage(`Thông tin Mức đóng và Tỉ lệ đóng Bảo hiểm cho tháng ${thangnam} đã được lưu!`);
      setIsSuccessModalOpen(true);
      fetchData();
    } catch (err: any) {
      const errMsg = err.message || String(err);
      if (errMsg.includes('duplicate key') || errMsg.includes('23505') || errMsg.includes('ThongTinBaoHiemHangThang_thangnam_key1')) {
        setErrorMessage(`Thông tin Mức đóng và Tỉ lệ đóng Bảo hiểm cho tháng ${thangnam} đã được lưu! Xin vui lòng chọn “Tháng/Năm” khác`);
      } else {
        setErrorMessage('Lỗi: ' + errMsg);
      }
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const filteredList = useMemo(() => {
    return list.filter(item => 
      (item.thangnam || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [list, searchTerm]);

  // Định dạng hiển thị 1 chữ số lẻ
  const formatNum = (val: any) => {
    const n = parseFloat(val);
    return isNaN(n) ? "0.0" : n.toFixed(1);
  };

  const calculateTotalTruong = (item: any) => {
    const total = 100*((parseFloat(item?.bhxhtruong) || 0) + (parseFloat(item?.bhyttruong) || 0) + (parseFloat(item?.bhtntruong) || 0) + (parseFloat(item?.bhatldtruong) || 0));
    return total.toFixed(1);
  };

  const calculateTotalNLD = (item: any) => {
    const total = 100*((parseFloat(item?.bhxhnguoild) || 0) + (parseFloat(item?.bhytnguoild) || 0) + (parseFloat(item?.bhtnnguoild) || 0));
    return total.toFixed(1);
  };

  const InputGroup = ({ label, value, readOnly = false, onChange, type = "number" }: any) => (
    <div className="space-y-1">
      <label className="text-[12px] font-bold text-red-600 block pl-1">{label}</label>
      <input
        type={type}
        step="0.1"
        readOnly={readOnly}
        value={value ?? ''}
        onChange={onChange}
        className={`w-full p-2 border border-gray-300 rounded text-sm font-bold bg-white text-blue-600 outline-none focus:ring-1 focus:ring-blue-400 ${readOnly ? 'cursor-not-allowed' : ''}`}
      />
    </div>
  );

  return (
    <div className="max-w-[1920px] mx-auto space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-100">
            <Info className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-blue-900 tracking-tight ">Mức đóng và tỉ lệ đóng bảo hiểm</h2>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => {
            const exportData = filteredList.map((item, idx) => ({ 
              'STT': idx + 1, 
              'Tháng/Năm': item.thangnam, 
              'Quy định': item.mdttquydinh, 
              'Trường đóng': item.mdtttruong, 
              'BHXH_T (%)': formatNum(item.bhxhtruong), 
              'BHXH_LD (%)': formatNum(item.bhxhnguoild) 
            }));
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "TiLe");
            XLSX.writeFile(wb, "TiLeDongBH.xlsx");
          }} className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md">
            <FileDown className="h-4 w-4 mr-2" /> Xuất excel
          </button>
          {canCreate && (
            <button onClick={handleOpenAdd} className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md">
              <Plus className="h-4 w-4 mr-2" /> Thêm mới
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Tìm theo tháng/năm..." className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1600px] w-full divide-y divide-gray-200 text-left border-collapse">
            <thead className="bg-gray-50/80 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center w-16">STT</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">Tháng/Năm</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">Mức tối thiểu QĐ</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">Mức tối thiểu Trường</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">% BHXH Trường</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">% BHXH Người LĐ</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">% BHYT Trường</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">% BHYT Người LĐ</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">% BHTN Trường</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">% BHTN Người LĐ</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">% BHATLĐ Trường</th>
                {canUpdate && (
                  <th className="px-4 py-4 text-xs font-bold text-red-600 text-center w-32">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredList.map((item, index) => (
                <tr key={item.maso} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-4 py-4 text-sm text-center text-gray-500 font-bold">{index + 1}</td>
                  <td className="px-4 py-4 text-sm text-center text-blue-900 font-black">{item.thangnam}</td>
                  <td className="px-4 py-4 text-sm text-center font-bold">{item.mdttquydinh.toLocaleString()}</td>
                  <td className="px-4 py-4 text-sm text-center font-bold">{item.mdtttruong.toLocaleString()}</td>
                  <td className="px-4 py-4 text-sm text-center font-medium">{formatNum(item.bhxhtruong)}%</td>
                  <td className="px-4 py-4 text-sm text-center font-medium">{formatNum(item.bhxhnguoild)}%</td>
                  <td className="px-4 py-4 text-sm text-center font-medium">{formatNum(item.bhyttruong)}%</td>
                  <td className="px-4 py-4 text-sm text-center font-medium">{formatNum(item.bhytnguoild)}%</td>
                  <td className="px-4 py-4 text-sm text-center font-medium">{formatNum(item.bhtntruong)}%</td>
                  <td className="px-4 py-4 text-sm text-center font-medium">{formatNum(item.bhtnnguoild)}%</td>
                  <td className="px-4 py-4 text-sm text-center font-medium">{formatNum(item.bhatldtruong)}%</td>
                  {canUpdate && (
                    <td className="px-4 py-4 text-center">
                      <button onClick={() => handleOpenEdit(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-transparent hover:border-blue-100"><Pencil className="h-4 w-4" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4 flex flex-col animate-in zoom-in duration-200">
             <div className="bg-[#f2f7ff] border-b p-4 flex justify-between items-center">
                <h3 className="text-lg font-bold text-blue-900">Thêm mới Hồ sơ</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={24} /></button>
             </div>

             <div className="p-6 space-y-8">
                {/* 1. Vùng Thông tin Tham khảo */}
                <section className="space-y-4">
                  <h4 className="text-sm font-bold text-blue-800 border-b pb-1">Thông tin tham khảo</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     <div className="space-y-1">
                        <label className="text-[12px] font-bold text-red-600 block pl-1">Tháng/Năm</label>
                        <select 
                          value={selectedRefMaso} 
                          onChange={e => setSelectedRefMaso(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm font-bold bg-white text-blue-600 outline-none focus:ring-1 focus:ring-blue-400"
                        >
                           <option value="">-- Chọn Tháng/Năm --</option>
                           {list.map(item => <option key={item.maso} value={item.maso}>{item.thangnam}</option>)}
                        </select>
                     </div>
                     <InputGroup label="Số tiền tối thiểu Quy định" value={refData?.mdttquydinh} readOnly />
                     <InputGroup label="Số tiền tối thiểu Trường đóng" value={refData?.mdtttruong} readOnly />
                     <InputGroup label="% BHXH Trường đóng" value={refData?.bhxhtruong} readOnly />
                     <InputGroup label="% BHXH Người LĐ đóng" value={refData?.bhxhnguoild} readOnly />
                     <InputGroup label="% BHYT Trường đóng" value={refData?.bhyttruong} readOnly />
                     <InputGroup label="% BHYT Người LĐ đóng" value={refData?.bhytnguoild} readOnly />
                     <InputGroup label="% BHTN Trường đóng" value={refData?.bhtntruong} readOnly />
                     <InputGroup label="% BHTN Người LĐ đóng" value={refData?.bhtnnguoild} readOnly />
                     <InputGroup label="% BHATLĐ Trường đóng" value={refData?.bhatldtruong} readOnly />
                  </div>
                </section>

                <div className="flex justify-center border-t border-gray-100 pt-4">
                   <button 
                      onClick={handleCopyPaste}
                      disabled={!refData}
                      className="px-12 py-3 bg-white border-2 border-blue-200 text-blue-600 font-black rounded-2xl hover:bg-blue-50 transition-all flex items-center gap-3 shadow-md active:scale-95 disabled:opacity-50"
                   >
                      <Copy size={20} /> Copy and Paste
                   </button>
                </div>

                {/* 2. Vùng Thông tin Hồ sơ mới */}
                <section className="space-y-4">
                  <h4 className="text-sm font-bold text-blue-800 border-b pb-1">Thông tin Hồ sơ mới</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     <InputGroup label="Tháng/Năm" type="text" value={newData.thangnam} onChange={(e:any) => setNewData({...newData, thangnam: e.target.value})} />
                     <InputGroup label="Số tiền tối thiểu Quy định" value={newData.mdttquydinh} onChange={(e:any) => setNewData({...newData, mdttquydinh: parseFloat(e.target.value) || 0})} />
                     <InputGroup label="Số tiền tối thiểu Trường đóng" value={newData.mdtttruong} onChange={(e:any) => setNewData({...newData, mdtttruong: parseFloat(e.target.value) || 0})} />
                     <InputGroup label="% BHXH Trường đóng" value={newData.bhxhtruong} onChange={(e:any) => setNewData({...newData, bhxhtruong: parseFloat(e.target.value) || 0})} />
                     <InputGroup label="% BHXH Người LĐ đóng" value={newData.bhxhnguoild} onChange={(e:any) => setNewData({...newData, bhxhnguoild: parseFloat(e.target.value) || 0})} />
                     <InputGroup label="% BHYT Trường đóng" value={newData.bhyttruong} onChange={(e:any) => setNewData({...newData, bhyttruong: parseFloat(e.target.value) || 0})} />
                     <InputGroup label="% BHYT Người LĐ đóng" value={newData.bhytnguoild} onChange={(e:any) => setNewData({...newData, bhytnguoild: parseFloat(e.target.value) || 0})} />
                     <InputGroup label="% BHTN Trường đóng" value={newData.bhtntruong} onChange={(e:any) => setNewData({...newData, bhtntruong: parseFloat(e.target.value) || 0})} />
                     <InputGroup label="% BHTN Người LĐ đóng" value={newData.bhtnnguoild} onChange={(e:any) => setNewData({...newData, bhtnnguoild: parseFloat(e.target.value) || 0})} />
                     <InputGroup label="% BHATLĐ Trường đóng" value={newData.bhatldtruong} onChange={(e:any) => setNewData({...newData, bhatldtruong: parseFloat(e.target.value) || 0})} />
                  </div>
                </section>
             </div>

             <div className="bg-gray-100 p-5 flex justify-end gap-3 border-t">
                <button onClick={() => setIsAddModalOpen(false)} className="px-10 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 shadow-sm text-sm">Hủy bỏ</button>
                <button 
                  onClick={handleSaveNew} 
                  disabled={saving}
                  className="px-12 py-2.5 bg-blue-700 text-white font-bold rounded-xl hover:bg-blue-800 shadow-lg shadow-blue-100 flex items-center gap-2 active:scale-95 disabled:bg-gray-400 text-sm"
                >
                   {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu hồ sơ
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Edit Modal (Original implementation preserved) */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-4 animate-in zoom-in duration-200">
             <div className="bg-blue-800 p-5 text-white font-bold flex justify-between items-center">
                <span>HIỆU CHỈNH HỒ SƠ #{editingItem.maso}</span>
                <button onClick={() => setIsEditModalOpen(false)}><X size={24}/></button>
             </div>
             <form onSubmit={handleSaveEdit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                   <InputGroup label="Tháng/Năm" type="text" value={editingItem.thangnam} onChange={(e:any) => setEditingItem({...editingItem, thangnam: e.target.value})} />
                   <InputGroup label="Đã có số liệu" type="text" readOnly value={editingItem.dacosolieu ? 'True' : 'False'} />
                   <InputGroup label="Mức QĐ" value={editingItem.mdttquydinh} onChange={(e:any) => setEditingItem({...editingItem, mdttquydinh: parseFloat(e.target.value) || 0})} />
                   <InputGroup label="Mức Trường" value={editingItem.mdtttruong} onChange={(e:any) => setEditingItem({...editingItem, mdtttruong: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                   <div className="space-y-3 bg-gray-50 p-4 rounded-xl">
                      <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-b pb-1">Trường đóng (%)</h5>
                      <div className="grid grid-cols-2 gap-2">
                        <InputGroup label="BHXH" value={editingItem.bhxhtruong} onChange={(e:any) => setEditingItem({...editingItem, bhxhtruong: parseFloat(e.target.value) || 0})} />
                        <InputGroup label="BHYT" value={editingItem.bhyttruong} onChange={(e:any) => setEditingItem({...editingItem, bhyttruong: parseFloat(e.target.value) || 0})} />
                        <InputGroup label="BHTN" value={editingItem.bhtntruong} onChange={(e:any) => setEditingItem({...editingItem, bhtntruong: parseFloat(e.target.value) || 0})} />
                        <InputGroup label="BHATLĐ" value={editingItem.bhatldtruong} onChange={(e:any) => setEditingItem({...editingItem, bhatldtruong: parseFloat(e.target.value) || 0})} />
                      </div>
                   </div>
                   <div className="space-y-3 bg-gray-50 p-4 rounded-xl">
                      <h5 className="text-[10px] font-black text-blue-500 uppercase tracking-widest border-b pb-1">Người LĐ đóng (%)</h5>
                      <div className="grid grid-cols-2 gap-2">
                        <InputGroup label="BHXH" value={editingItem.bhxhnguoild} onChange={(e:any) => setEditingItem({...editingItem, bhxhnguoild: parseFloat(e.target.value) || 0})} />
                        <InputGroup label="BHYT" value={editingItem.bhytnguoild} onChange={(e:any) => setEditingItem({...editingItem, bhytnguoild: parseFloat(e.target.value) || 0})} />
                        <InputGroup label="BHTN" value={editingItem.bhtnnguoild} onChange={(e:any) => setEditingItem({...editingItem, bhtnnguoild: parseFloat(e.target.value) || 0})} />
                      </div>
                   </div>
                </div>
                <div className="pt-6 flex justify-end gap-3 border-t">
                   <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-6 py-2 text-gray-500 font-bold uppercase text-xs">Hủy</button>
                   <button type="submit" disabled={saving} className="px-8 py-2 bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2">
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu thay đổi
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
              <div className="bg-emerald-600 p-5 text-white flex items-center gap-3">
                 <CheckCircle2 size={28} />
                 <h3 className="text-lg font-bold">Thông báo</h3>
              </div>
              <div className="p-8 text-center space-y-4">
                 <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                    <Save size={32} />
                 </div>
                 <p className="text-gray-700 font-bold text-sm leading-relaxed">{successMessage}</p>
              </div>
              <div className="bg-gray-50 p-4 flex justify-center border-t">
                 <button onClick={() => setIsSuccessModalOpen(false)} className="px-12 py-2 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 shadow-md transition-all active:scale-95 text-xs uppercase tracking-widest">Đóng</button>
              </div>
           </div>
        </div>
      )}

      {/* Error Modal */}
      {isErrorModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-red-100">
              <div className="bg-red-600 p-5 text-white flex items-center gap-3">
                 <AlertCircle size={28} />
                 <h3 className="text-lg font-bold">Lỗi</h3>
              </div>
              <div className="p-8 text-center space-y-4">
                 <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-600 shadow-inner">
                    <AlertCircle size={32} />
                 </div>
                 <p className="text-gray-700 font-bold text-sm leading-relaxed">{errorMessage}</p>
              </div>
              <div className="bg-gray-50 p-4 flex justify-center border-t">
                 <button onClick={() => setIsErrorModalOpen(false)} className="px-12 py-2 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-md transition-all active:scale-95 text-xs uppercase tracking-widest">Đóng</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};