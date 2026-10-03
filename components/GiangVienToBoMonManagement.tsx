
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { NhanSuBoMon, ToBoMon, NhanVien, PhongBan, ChucVu, TrinhDo, QuaTrinhDaoTao, RolePermission } from '../types';
import { Pencil, Trash2, Search, Users, FileDown, X, Save, Loader2, Plus, MoreHorizontal, UserPlus, ChevronDown, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { checkPermission, normalizePermissions } from '../services/permissionService';

// Helper function to ensure keys are lowercase
const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

export const GiangVienToBoMonManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [list, setList] = useState<NhanSuBoMon[]>([]);
  const [boMons, setBoMons] = useState<ToBoMon[]>([]);
  const [phongBans, setPhongBans] = useState<PhongBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);
  
  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);
  
  // Trạng thái lọc
  const [filterTrinhDo, setFilterTrinhDo] = useState('');
  const [filterBoMon, setFilterBoMon] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Trạng thái Hiệu chỉnh
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<NhanSuBoMon | null>(null);
  
  // Trạng thái Thêm mới (Add Lecturer to Department)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };

  // Permission checks
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'giangVienToBoMon', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'giangVienToBoMon', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'giangVienToBoMon', 'DELETE'), [permissions, isAdmin]);

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

          const mappedPermissions = normalizePermissions(rolePermData || [], moduleRes.data || [], permRes.data || []);
          setPermissions(mappedPermissions);
        }
      } catch (err: any) {
        showAlert('Lỗi tải quyền hạn Giảng viên Tổ Bộ môn: ' + (err.message || String(err)));
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
      const [nsRes, bmRes, pbRes] = await Promise.all([
        supabase
          .from('DanhSachNhanSuBoMon')
          .select('*')
          .eq('danghiviec', false)
          .order('vithubomon', { ascending: true })
          .order('vithunhansu', { ascending: true }),
        supabase.from('DanhMucToBoMon').select('*').order('sapxep', { ascending: true }),
        supabase.from('DanhMucPhongBan').select('*')
      ]);
      if (nsRes.data) setList(nsRes.data.map(item => normalizeKeys(item)));
      if (bmRes.data) setBoMons(bmRes.data.map(item => normalizeKeys(item)));
      if (pbRes.data) setPhongBans(pbRes.data.map(item => normalizeKeys(item)));
    } catch (error: any) {
      showAlert("Lỗi khi tải dữ liệu: " + (error.message || String(error)));
    } finally {
      setLoading(false);
    }
  };

  const formatDateView = (dateString: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateString;
  };

  const uniqueTrinhDos = useMemo(() => 
    Array.from(new Set(list.map(i => i.trinhdo))).filter(Boolean).sort()
  , [list]);

  const uniqueBoMons = useMemo(() => 
    Array.from(new Set(list.map(i => i.bomon))).filter(Boolean).sort()
  , [list]);

  const filteredList = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return list.filter(item => {
      const maNV = String(item.manv || '').toLowerCase();
      const fullName = `${item.holot} ${item.ten}`.toLowerCase();
      const matchesSearch = fullName.includes(lowerSearch) || maNV.includes(lowerSearch);
      const matchesTrinhDo = filterTrinhDo === '' || item.trinhdo === filterTrinhDo;
      const matchesBoMon = filterBoMon === '' || item.bomon === filterBoMon;
      return matchesSearch && matchesTrinhDo && matchesBoMon;
    });
  }, [list, searchTerm, filterTrinhDo, filterBoMon]);

  const handleDelete = async (id: any) => {
    if (!id) {
      showAlert("Không tìm thấy ID của nhân sự để thực hiện xóa.");
      return;
    }

    if (window.confirm("Bạn có chắc chắn muốn xóa nhân sự này ra khỏi danh sách bộ môn?")) {
      try {
        const { error, status } = await supabase
          .from('DanhSachNhanSuBoMon')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        showAlert("Đã xóa nhân sự khỏi danh sách bộ môn thành công!");
        
        // Cập nhật lại danh sách hiển thị
        await fetchData();
      } catch (err: any) {
        showAlert("Lỗi khi xóa nhân sự: " + (err.message || "Vui lòng kiểm tra quyền truy cập database."));
      }
    }
  };

  const handleOpenEdit = (item: NhanSuBoMon) => {
    setEditingItem({ ...item });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSaving(true);
    
    try {
      const selectedBM = boMons.find(bm => bm.giatri === editingItem.bomon);
      if (!selectedBM) throw new Error("Không tìm thấy thông tin bộ môn đã chọn.");

      const parentUnit = phongBans.find(pb => pb.maphongban === selectedBM.tructhuoc);
      const parentUnitName = parentUnit ? parentUnit.giatri : selectedBM.tructhuoc;

      const updates = {
        bomon: editingItem.bomon,
        masobomon: selectedBM.mabomon,
        vithubomon: selectedBM.sapxep || 0,
        tructhuoc: parentUnitName,
        chucvuquanly: editingItem.chucvuquanly || ''
      };

      const { error } = await supabase
        .from('DanhSachNhanSuBoMon')
        .update(updates)
        .eq('id', editingItem.id);

      if (error) throw error;

      showAlert("Cập nhật thông tin thành công!");
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      showAlert("Lỗi khi cập nhật: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredList.map((item, idx) => ({
      'STT': idx + 1,
      'Mã NV': item.manv,
      'Họ lót': item.holot,
      'Tên': item.ten,
      'Ngày sinh': formatDateView(item.ngaysinh),
      'Trình độ': item.trinhdo,
      'Chuyên ngành Đại học': item.chuyennganhdaotaodaihoc,
      'Bộ môn': item.bomon,
      'Chức vụ': item.chucvuquanly,
      'Sắp xếp BM': item.vithubomon,
      'Vị thứ nhân sự': item.vithunhansu
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GiangVienToBoMon");
    XLSX.writeFile(wb, "DanhSachGiangVienToBoMon.xlsx");
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 font-sans">
      <div className="mb-6 space-y-4">
         <div className="flex justify-between items-center">
            <h2 className="text-2xl font-black text-blue-800 flex items-center gap-2 tracking-tight">
               <Users className="h-7 w-7" /> Giảng viên Tổ Bộ môn
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={handleExportExcel}
                className="bg-green-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md hover:bg-green-700 transition-all active:scale-95"
              >
                 <FileDown className="h-5 w-5" /> Xuất Excel
              </button>
              {canCreate && (
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-blue-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 font-bold shadow-md hover:bg-blue-700 transition-all active:scale-95"
                >
                   <UserPlus className="h-5 w-5" /> Thêm mới Giảng viên
                </button>
              )}
            </div>
         </div>

         <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input 
               type="text" 
               placeholder="Tìm theo Mã NV hoặc Tên giảng viên..." 
               className="pl-9 p-2.5 border border-gray-300 rounded-xl text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition-all text-black bg-white"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1300px]">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-4 text-xs font-bold text-red-600 uppercase text-center w-12">STT</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600">Mã NV</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600">Họ lót</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600">Tên</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600">Ngày sinh</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600">
                  <div className="flex flex-col gap-1">
                    <span>Trình độ</span>
                    <select 
                      value={filterTrinhDo}
                      onChange={e => setFilterTrinhDo(e.target.value)}
                      className="text-[11px] text-blue-600 border border-blue-200 rounded p-1 bg-white font-bold outline-none cursor-pointer hover:bg-blue-50"
                    >
                      <option value="">-- Tất cả --</option>
                      {uniqueTrinhDos.map(td => <option key={td} value={td}>{td}</option>)}
                    </select>
                  </div>
                </th>
                <th className="px-4 py-4 text-xs font-bold text-red-600">Chuyên ngành Đại học</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600">
                  <div className="flex flex-col gap-1">
                    <span>Bộ môn</span>
                    <select 
                      value={filterBoMon}
                      onChange={e => setFilterBoMon(e.target.value)}
                      className="text-[11px] text-blue-600 border border-blue-200 rounded p-1 bg-white font-bold outline-none cursor-pointer hover:bg-blue-50"
                    >
                      <option value="">-- Tất cả --</option>
                      {uniqueBoMons.map(bm => <option key={bm} value={bm}>{bm}</option>)}
                    </select>
                  </div>
                </th>
                <th className="px-4 py-4 text-xs font-bold text-red-600">Chức vụ</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center">Sắp xếp BM</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-center whitespace-nowrap">Vị thứ nhân sự</th>
                <th className="px-4 py-4 text-xs font-bold text-red-600 text-right sticky right-0 bg-gray-50 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.1)]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr><td colSpan={12} className="px-4 py-20 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-600" /></td></tr>
              ) : filteredList.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-20 text-center text-gray-500 italic text-lg">Không tìm thấy dữ liệu phù hợp.</td></tr>
              ) : (
                filteredList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-4 py-3.5 text-sm text-black text-center">{index + 1}</td>
                    <td className="px-4 py-3.5 text-sm text-black">{item.manv}</td>
                    <td className="px-4 py-3.5 text-sm text-black">{item.holot}</td>
                    <td className="px-4 py-3.5 text-sm text-black font-bold">{item.ten}</td>
                    <td className="px-4 py-3.5 text-sm text-black whitespace-nowrap">{formatDateView(item.ngaysinh)}</td>
                    <td className="px-4 py-3.5 text-sm text-black">{item.trinhdo}</td>
                    <td className="px-4 py-3.5 text-xs text-black italic leading-tight">{item.chuyennganhdaotaodaihoc}</td>
                    <td className="px-4 py-3.5 text-sm text-black">{item.bomon}</td>
                    <td className="px-4 py-3.5 text-sm text-black">{item.chucvuquanly || '-'}</td>
                    <td className="px-4 py-3.5 text-sm text-black text-center">{item.vithubomon}</td>
                    <td className="px-4 py-3.5 text-sm text-black text-center">{item.vithunhansu}</td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap sticky right-0 bg-white group-hover:bg-blue-50/50 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)] transition-colors">
                       {canUpdate && (
                         <button 
                          type="button"
                          onClick={() => handleOpenEdit(item)} 
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors mr-1.5" 
                          title="Hiệu chỉnh"
                         >
                           <Pencil className="h-4 w-4" />
                         </button>
                       )}
                       {canDelete && (
                         <button 
                          type="button"
                          onClick={() => handleDelete(item.id)} 
                          className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors" 
                          title="Xóa khỏi bộ môn"
                         >
                           <Trash2 className="h-4 w-4" />
                         </button>
                       )}
                       {!canUpdate && !canDelete && <span className="text-gray-400 italic text-xs">Không có quyền</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
           <form onSubmit={handleSaveEdit} className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
              <div className="bg-blue-800 p-5 text-white font-bold flex justify-between items-center">
                 <span className="tracking-widest flex items-center gap-2">
                    <Pencil className="h-5 w-5" /> Hiệu chỉnh công tác
                 </span>
                 <button type="button" onClick={() => setIsEditModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X className="h-6 w-6" /></button>
              </div>
              <div className="p-6 space-y-6 text-black">
                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-inner">
                    <p className="text-[10px] font-bold text-blue-400 tracking-widest mb-1">Giảng viên</p>
                    <p className="text-base font-black text-blue-900">{editingItem.holot} {editingItem.ten}</p>
                    <p className="text-xs text-blue-600 font-bold mt-0.5">Mã NV: {editingItem.manv}</p>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block tracking-wide">Tên Bộ môn</label>
                    <select required value={editingItem.bomon} onChange={e => setEditingItem({...editingItem, bomon: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl font-bold text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm">
                        {boMons.map(bm => <option key={bm.id} value={bm.giatri}>{bm.giatri}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-gray-500 mb-1.5 block tracking-wide">Chức vụ quản lý bộ môn</label>
                    <select value={editingItem.chucvuquanly || ''} onChange={e => setEditingItem({...editingItem, chucvuquanly: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl font-bold text-black bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm">
                        <option value="">-- Không có chức vụ --</option>
                        <option value="Trưởng BM">Trưởng BM</option>
                        <option value="Phó Trưởng BM">Phó Trưởng BM</option>
                    </select>
                 </div>
              </div>
              <div className="bg-gray-50 p-5 flex justify-end gap-3 border-t border-gray-100">
                 <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-2 text-gray-500 font-bold hover:text-gray-800 transition-colors">Hủy bỏ</button>
                 <button type="submit" disabled={saving} className="px-8 py-2.5 bg-blue-800 text-white font-bold rounded-xl flex items-center gap-2 hover:bg-blue-900 shadow-lg transition-all active:scale-95 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Lưu thay đổi
                 </button>
              </div>
           </form>
        </div>
      )}

      {/* Add New Modal (AddLecturerToDepartment) */}
      {isAddModalOpen && (
        <AddLecturerToDepartmentModal 
          onClose={() => setIsAddModalOpen(false)} 
          boMons={boMons} 
          phongBans={phongBans}
          onSuccess={() => {
            setIsAddModalOpen(false);
            fetchData();
          }}
          showAlert={showAlert}
        />
      )}

      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
             <div className="bg-red-600 p-5 text-white flex items-center gap-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">Thông báo hệ thống</h3>
             </div>
             <div className="p-8 text-center">
                <p className="text-gray-700 font-medium leading-relaxed">{alertMessage}</p>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                <button 
                  onClick={() => setIsAlertModalOpen(false)}
                  className="px-8 py-2 bg-red-600 text-white font-bold rounded-xl shadow-md hover:bg-red-700 transition-all active:scale-95 text-sm"
                >
                  Đóng thông báo
                </button>
             </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};

// Sub-component: AddLecturerToDepartmentModal
interface AddModalProps {
  onClose: () => void;
  onSuccess: () => void;
  boMons: ToBoMon[];
  phongBans: PhongBan[];
  showAlert: (message: string) => void;
}

const AddLecturerToDepartmentModal: React.FC<AddModalProps> = ({ onClose, onSuccess, boMons, phongBans, showAlert }) => {
  const [loadingLecturers, setLoadingLecturers] = useState(false);
  const [availableLecturers, setAvailableLecturers] = useState<NhanVien[]>([]);
  const [existingMaNVs, setExistingMaNVs] = useState<Set<string>>(new Set());
  const [selectedLecturer, setSelectedLecturer] = useState<NhanVien | null>(null);
  const [searchText, setSearchText] = useState('');
  const [dropdownSearch, setDropdownSearch] = useState(''); 
  const [isSearching, setIsSearching] = useState(false);
  
  const [selectedBoMon, setSelectedBoMon] = useState('');
  const [hasPosition, setHasPosition] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [saving, setSaving] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropSearchInputRef = useRef<HTMLInputElement>(null);

  const CHUC_VU_BO_MON = [
    { id: '1', giatri: 'Trưởng BM' },
    { id: '2', giatri: 'Phó Trưởng BM' }
  ];

  useEffect(() => {
    const initData = async () => {
      const { data: existingData } = await supabase.from('DanhSachNhanSuBoMon').select('manv');
      if (existingData) {
        setExistingMaNVs(new Set(existingData.map(i => String(i.manv || ''))));
      }
      if (boMons.length > 0) setSelectedBoMon(boMons[0].giatri);
    };
    initData();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSearching(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [boMons]);

  const handleOpenSearch = async () => {
    setIsSearching(true);
    setLoadingLecturers(true);
    setDropdownSearch('');
    const { data } = await supabase
      .from('DanhSachNhanVien')
      .select('*')
      .eq('danghiviec', false)
      .eq('giangvien', true);
    
    if (data) {
      const normalizedData = data.map(item => normalizeKeys(item));
      const available = (normalizedData as NhanVien[]).filter(nv => !existingMaNVs.has(String(nv.manv || '')));
      setAvailableLecturers(available);
    }
    setLoadingLecturers(false);
    setTimeout(() => dropSearchInputRef.current?.focus(), 50);
  };

  const filteredDropdownLecturers = useMemo(() => {
    if (!dropdownSearch.trim()) return availableLecturers;
    const lowerSearch = dropdownSearch.toLowerCase();
    return availableLecturers.filter(nv => 
      `${nv.holot} ${nv.ten}`.toLowerCase().includes(lowerSearch) || 
      String(nv.manv || '').toLowerCase().includes(lowerSearch)
    );
  }, [availableLecturers, dropdownSearch]);

  const handleSelectLecturer = (nv: NhanVien) => {
    const unit = phongBans.find(pb => pb.maphongban === nv.phongban);
    setSelectedLecturer({
      ...nv,
      ten_phongban: unit?.giatri || nv.phongban
    });
    setSearchText(`${nv.holot} ${nv.ten}`);
    setIsSearching(false);
  };

  const handleAdd = async () => {
    if (!selectedLecturer) {
      showAlert("Vui lòng chọn giảng viên.");
      return;
    }
    if (!selectedBoMon) {
      showAlert("Vui lòng chọn bộ môn.");
      return;
    }

    setSaving(true);
    try {
      // 1. Tra cứu nhãn Trình độ (ví dụ: "Tiến sĩ")
      const { data: trinhDoRes } = await supabase
        .from('DanhMucTrinhDo')
        .select('giatri')
        .eq('matrinhdo', selectedLecturer.trinhdo)
        .maybeSingle();
      
      const trinhDoLabel = trinhDoRes?.giatri || selectedLecturer.trinhdo || '';

      // 2. Tra cứu quá trình đào tạo để lấy chuyên ngành DH và năm TN các cấp
      const { data: trainingRes } = await supabase
        .from('DanhSachQuaTrinhDaoTao')
        .select('*')
        .eq('manv', selectedLecturer.manv);
      
      const trainingData = (trainingRes || []).map(item => normalizeKeys(item)) as QuaTrinhDaoTao[];

      const findYear = (level: string) => {
        const found = trainingData.find(item => item.trinhdodaotao === level);
        return found ? found.namtnxeploai : '';
      };

      const chuyenNganhDH = trainingData.find(item => item.trinhdodaotao === 'Đại học')?.chuyennganh || '';
      const totNghiepDH = findYear('Đại học');
      const totNghiepThS = findYear('Thạc sĩ');
      const totNghiepTS = findYear('Tiến sĩ');

      // 3. Tra cứu thông tin Bộ môn & Đơn vị trực thuộc
      const boMonInfo = boMons.find(bm => bm.giatri === selectedBoMon);
      const unitLabel = phongBans.find(pb => pb.maphongban === boMonInfo?.tructhuoc)?.giatri || boMonInfo?.tructhuoc || '';

      // 4. Lưu vào bảng DanhSachNhanSuBoMon
      const payload = {
        manv: String(selectedLecturer.manv || ''),
        holot: selectedLecturer.holot || '',
        ten: selectedLecturer.ten || '',
        ngaysinh: selectedLecturer.ngaysinh || null,
        trinhdo: trinhDoLabel,
        chuyennganhdaotaodaihoc: chuyenNganhDH,
        masobomon: boMonInfo?.mabomon || '',
        bomon: selectedBoMon,
        vithubomon: boMonInfo?.sapxep || 0,
        tructhuoc: unitLabel,
        ngaychinhthuc: selectedLecturer.ngaychinhthuc || null,
        ngayqdtrogiang: selectedLecturer.ngayqdtrogiang || null,
        ngayqdgiangvien: selectedLecturer.ngayqdgiangvien || null,
        totnghiepdaihoc: totNghiepDH,
        totnghiepthacsy: totNghiepThS,
        totnghieptiensy: totNghiepTS,
        vithunhansu: selectedLecturer.vithu || 0,
        chucvuquanly: hasPosition ? selectedPosition : '',
        danghiviec: selectedLecturer.danghiviec || false
      };

      const { error } = await supabase.from('DanhSachNhanSuBoMon').insert([payload]);
      if (error) throw error;
      
      showAlert("Đã bổ sung giảng viên vào bộ môn thành công!");
      onSuccess();
    } catch (err: any) {
      showAlert("Lỗi khi thêm: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl shadow-2xl rounded-xl overflow-hidden border border-gray-200 flex flex-col transition-all">
        <div className="bg-green-50 px-6 py-4 border-b border-green-100 flex justify-between items-center">
          <h1 className="text-green-700 text-lg font-bold flex items-center gap-2 tracking-wide">
            <UserPlus className="h-6 w-6" />
            Bổ sung Giảng viên vào Bộ môn
          </h1>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-8 space-y-8 text-black">
          {/* Section 1: Chọn Giảng viên */}
          <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <h2 className="text-blue-700 font-bold mb-5 flex items-center text-xs tracking-widest">
              Chọn Giảng viên, Trợ giảng
            </h2>
            <div className="space-y-4">
              <div className="relative" ref={dropdownRef}>
                <div className="flex shadow-sm rounded-lg overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 bg-white transition-all">
                  <input 
                    className="block w-full border-none px-4 py-3 text-sm font-bold text-black focus:ring-0 bg-white cursor-pointer" 
                    placeholder="Click để chọn nhân sự..." 
                    type="text" 
                    readOnly
                    value={searchText}
                    onClick={handleOpenSearch}
                  />
                  <button 
                    onClick={handleOpenSearch}
                    className="inline-flex items-center px-4 bg-gray-100 border-l border-gray-200 text-gray-500 hover:bg-gray-100"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </div>
                
                {isSearching && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl max-h-[350px] flex flex-col overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b border-gray-200 sticky top-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input 
                                ref={dropSearchInputRef}
                                type="text"
                                placeholder="Tìm kiếm theo Tên hoặc Mã NV..."
                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-black focus:ring-1 focus:ring-blue-500 outline-none"
                                value={dropdownSearch}
                                onChange={(e) => setDropdownSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-1">
                        {loadingLecturers ? (
                            <div className="p-10 text-center text-gray-500"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-500"/></div>
                        ) : filteredDropdownLecturers.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {filteredDropdownLecturers.map(nv => (
                                    <div 
                                      key={nv.id} 
                                      onClick={() => handleSelectLecturer(nv)}
                                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors"
                                    >
                                      <p className="text-sm font-bold text-gray-900">{nv.holot} {nv.ten}</p>
                                      <p className="text-[10px] text-gray-500 mt-0.5">Mã NV: {nv.manv} | Email: {nv.email}</p>
                                    </div>
                                  ))}
                            </div>
                        ) : (
                            <div className="p-10 text-center text-gray-400 italic text-sm">Không tìm thấy dữ liệu</div>
                        )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <label className="block text-sm font-bold text-blue-800 whitespace-nowrap min-w-[80px]">Đơn vị</label>
                <input 
                  className="block w-full rounded-lg border-gray-200 bg-gray-50 text-black font-bold text-sm py-2.5 px-4 cursor-not-allowed border" 
                  readOnly 
                  type="text" 
                  value={selectedLecturer?.ten_phongban || ''} 
                  placeholder="---"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Chọn Bộ môn */}
          <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <h2 className="text-red-600 font-bold mb-5 flex items-center text-xs tracking-widest">
              Chọn Bộ môn - Chức vụ
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-6">
                <select 
                  value={selectedBoMon}
                  onChange={e => setSelectedBoMon(e.target.value)}
                  className="block w-full rounded-lg border-gray-300 text-black font-bold focus:border-red-500 focus:ring-red-500 text-sm py-2.5 shadow-sm bg-white"
                >
                  {boMons.map(bm => <option key={bm.id} value={bm.giatri}>{bm.giatri}</option>)}
                </select>
              </div>
              
              <div className="md:col-span-2 flex items-center">
                <input 
                  id="pos-check" 
                  type="checkbox" 
                  checked={hasPosition}
                  onChange={e => {
                      setHasPosition(e.target.checked);
                      if (!e.target.checked) setSelectedPosition('');
                      else setSelectedPosition(CHUC_VU_BO_MON[0].giatri);
                  }}
                  className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label className="ml-2 text-sm font-bold text-blue-700 cursor-pointer" htmlFor="pos-check">Chức vụ</label>
              </div>

              <div className="md:col-span-4">
                <select 
                  disabled={!hasPosition}
                  value={selectedPosition}
                  onChange={e => setSelectedPosition(e.target.value)}
                  className="block w-full rounded-lg text-sm py-2.5 shadow-inner font-bold bg-white text-black border-gray-300 disabled:opacity-50 disabled:bg-gray-50"
                >
                  {!hasPosition && <option value="">---</option>}
                  {hasPosition && CHUC_VU_BO_MON.map(cv => <option key={cv.id} value={cv.giatri}>{cv.giatri}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-5 bg-gray-50 border-t border-gray-200 flex justify-end gap-4">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-white text-gray-700 font-bold border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Hủy bỏ
          </button>
          <button 
            type="button"
            onClick={handleAdd}
            disabled={saving || !selectedLecturer}
            className="px-8 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu hồ sơ
          </button>
        </div>
      </div>
    </div>
  );
};
