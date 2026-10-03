
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { NhanVien, DanhSachKyHDLD, DanhMucHDLD, TrinhDo, PhongBan, RolePermission } from '../types';
import { Search, X, FileText, Loader2, Calendar, User, ShieldCheck, Plus, Save, UserCheck, ChevronLeft, ChevronRight, Hash, Pencil, Trash2, AlertCircle } from 'lucide-react';

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

// Kiểm tra trạng thái nghỉ việc chính xác (Đồng bộ với Overview)
const isActiveEmployee = (flag: any) => {
    if (flag === true || flag === 'true' || flag === 1 || flag === '1') return false; 
    return true; 
};

/**
 * Hàm hỗ trợ lấy TẤT CẢ dữ liệu từ một bảng sử dụng range (vượt giới hạn 1000 của Supabase)
 */
const fetchAllRecords = async (tableName: string) => {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Lỗi khi truy vấn bảng ${tableName}: ${error.message}`);
    } else if (data && data.length > 0) {
      allData = allData.concat(data);
      from += PAGE_SIZE;
      // Nếu số lượng bản ghi trả về bằng đúng PAGE_SIZE thì có khả năng vẫn còn dữ liệu
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return allData;
};

export const DanhSachKyHDLDManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [allContracts, setAllContracts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<NhanVien[]>([]);
  const [contractTypes, setContractTypes] = useState<DanhMucHDLD[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'error' | 'success'>('error');

  const showAlert = (message: string, type: 'error' | 'success' = 'error') => {
    setAlertMessage(message);
    setAlertType(type);
    setIsAlertModalOpen(true);
  };

  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  // Permission Logic
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'hdld-danhSachKy', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'hdld-danhSachKy', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'hdld-danhSachKy', 'DELETE'), [permissions, isAdmin]);

  // Fetch latest permissions if currentUser is provided
  useEffect(() => {
    const fetchLatestPermissions = async () => {
      const userId = currentUser?.id || currentUser?.userid;
      if (!userId) return;
      
      try {
        const { data: rolePermData, error: rolePermError } = await supabase
          .from('RolePermissions')
          .select('*')
          .eq('userid', userId);

        if (rolePermError) throw rolePermError;

        if (rolePermData) {
          // Get Modules and Permissions for mapping
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
        showAlert('Lỗi tải quyền hạn Danh sách ký HĐLĐ: ' + (err.message || err));
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15; // Tăng số lượng hiển thị mỗi trang để dễ theo dõi

  // Modal states for adding new contract
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEmpForNew, setSelectedEmpForNew] = useState<NhanVien | null>(null);
  const [newContract, setNewContract] = useState<Partial<DanhSachKyHDLD>>({
    sohd: '',
    loaihd: '',
    tungay: '',
    denngay: ''
  });
  const [savingContract, setSavingContract] = useState(false);
  const [empSearchInModal, setEmpSearchInModal] = useState('');

  // Edit/Delete states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingContract, setDeletingContract] = useState<any>(null);
  const [notification, setNotification] = useState<{ isOpen: boolean, message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Tải toàn bộ dữ liệu (Sử dụng hàm fetchAllRecords để lấy đủ > 1000 dòng)
      const [rawEmps, rawContracts, rawHdTypes, rawTrinhDos, rawPhongBans] = await Promise.all([
        fetchAllRecords('DanhSachNhanVien'),
        fetchAllRecords('DanhSachKyHDLD'),
        fetchAllRecords('DanhMucHDLD'),
        fetchAllRecords('DanhMucTrinhDo'),
        fetchAllRecords('DanhMucPhongBan')
      ]);

      const normalizedEmps = rawEmps.map(e => normalizeKeys(e)) as NhanVien[];
      const normalizedContracts = rawContracts.map(c => normalizeKeys(c)) as DanhSachKyHDLD[];
      const normalizedHdTypes = rawHdTypes.map(d => normalizeKeys(d)) as DanhMucHDLD[];
      const normalizedTrinhDos = rawTrinhDos.map(t => normalizeKeys(t)) as TrinhDo[];
      const normalizedPhongBans = rawPhongBans.map(p => normalizeKeys(p)) as PhongBan[];

      // 2. Tạo Map nhân viên đang làm việc để lọc nhanh
      const activeEmployeeMap = new Map();
      normalizedEmps.forEach(e => {
        if (isActiveEmployee(e.danghiviec)) {
          // Gán thêm tên trình độ và phòng ban cho nhân viên
          const td = normalizedTrinhDos.find(t => t.matrinhdo === e.trinhdo);
          const pb = normalizedPhongBans.find(p => p.maphongban === e.phongban);
          activeEmployeeMap.set(String(e.manv), {
            ...e,
            ten_trinhdo: td?.giatri || e.trinhdo,
            ten_phongban: pb?.giatri || e.phongban
          });
        }
      });

      setEmployees(Array.from(activeEmployeeMap.values()));
      setContractTypes(normalizedHdTypes);

      // 3. Lọc Hợp đồng: Chỉ lấy các hợp đồng có MaNV thuộc danh sách đang làm việc
      const validJoinedContracts = normalizedContracts
        .filter(c => activeEmployeeMap.has(String(c.manv)))
        .map(c => {
          const emp = activeEmployeeMap.get(String(c.manv));
          const type = normalizedHdTypes.find(t => String(t.maso) === String(c.loaihd));
          
          return {
            ...c,
            ho_ten: emp ? `${emp.holot} ${emp.ten}` : 'N/A',
            ngay_sinh: emp?.ngaysinh || '',
            trinh_do: emp?.ten_trinhdo || 'N/A',
            don_vi: emp?.ten_phongban || 'N/A',
            ten_loaihd: type?.tenhdld || `Mã: ${c.loaihd}`
          };
        });

      // 4. Sắp xếp: Mặc định theo Mã NV tăng dần (hoặc ID Hợp đồng giảm dần tùy nhu cầu)
      const sorted = validJoinedContracts.sort((a, b) => {
        const nvA = String(a.manv || '');
        const nvB = String(b.manv || '');
        return nvA.localeCompare(nvB, undefined, { numeric: true });
      });

      setAllContracts(sorted);
      console.log(`[Debug] Đã tải ${normalizedContracts.length} HĐ gốc. Sau khi lọc NS còn việc: ${sorted.length} HĐ.`);
      
    } catch (err: any) {
      showAlert("Lỗi tải dữ liệu: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setSelectedEmpForNew(null);
    setNewContract({
      sohd: '',
      loaihd: contractTypes[0]?.maso || '',
      tungay: new Date().toISOString().split('T')[0],
      denngay: ''
    });
    setEmpSearchInModal('');
    setIsAddModalOpen(true);
  };

  const handleSaveContract = async () => {
    if (!selectedEmpForNew || !newContract.sohd || !newContract.loaihd || !newContract.tungay) {
      showAlert("Vui lòng chọn nhân sự và nhập đầy đủ thông tin hợp đồng.");
      return;
    }

    setSavingContract(true);
    try {
      const { data: maxIdData } = await supabase
        .from('DanhSachKyHDLD')
        .select('idhopdong')
        .order('idhopdong', { ascending: false })
        .limit(1);

      let nextId = 1;
      if (maxIdData && maxIdData.length > 0) {
        nextId = Number(maxIdData[0].idhopdong) + 1;
      }

      const empContracts = allContracts.filter(c => String(c.manv) === String(selectedEmpForNew.manv));
      const solan = empContracts.length + 1;
      
      const payload = {
        idhopdong: nextId,
        sohd: newContract.sohd,
        manv: selectedEmpForNew.manv,
        loaihd: newContract.loaihd,
        solan,
        tungay: newContract.tungay,
        denngay: newContract.denngay || null
      };

      const { error } = await supabase.from('DanhSachKyHDLD').insert([payload]);
      if (error) throw error;

      showAlert("Đã ký hợp đồng mới thành công!", 'success');
      setIsAddModalOpen(false);
      fetchData();
    } catch (err: any) {
      showAlert("Lỗi khi lưu: " + err.message);
    } finally {
      setSavingContract(false);
    }
  };

  const handleOpenEdit = (contract: any) => {
    setEditingContract({ ...contract });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingContract) return;
    setSavingContract(true);
    try {
      const { error } = await supabase
        .from('DanhSachKyHDLD')
        .update({
          sohd: editingContract.sohd,
          loaihd: editingContract.loaihd,
          tungay: editingContract.tungay,
          denngay: editingContract.denngay || null
        })
        .eq('idhopdong', editingContract.idhopdong);

      if (error) throw error;

      setIsEditModalOpen(false);
      setNotification({ isOpen: true, message: "Hệ thống đã lưu các thay đổi của Hợp đồng" });
      fetchData();
    } catch (err: any) {
      showAlert("Lỗi khi lưu: " + err.message);
    } finally {
      setSavingContract(false);
    }
  };

  const handleOpenDelete = (contract: any) => {
    setDeletingContract(contract);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingContract) return;
    try {
      const { error } = await supabase
        .from('DanhSachKyHDLD')
        .delete()
        .eq('idhopdong', deletingContract.idhopdong);

      if (error) throw error;

      setIsDeleteModalOpen(false);
      setNotification({ isOpen: true, message: "Đã xóa Hợp đồng Lao động ra khỏi danh sách" });
      fetchData();
    } catch (err: any) {
      showAlert("Lỗi khi xóa: " + err.message);
    }
  };

  const filteredContracts = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return allContracts.filter(c => 
      (c.ho_ten || '').toLowerCase().includes(search) ||
      String(c.manv || '').toLowerCase().includes(search) ||
      String(c.sohd || '').toLowerCase().includes(search)
    );
  }, [allContracts, searchTerm]);

  // Phân trang
  const totalPages = Math.ceil(filteredContracts.length / rowsPerPage);
  const paginatedContracts = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredContracts.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredContracts, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const formatDate = (d: string) => {
    if (!d) return '';
    const parts = d.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-blue-600 gap-4">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="font-bold tracking-widest text-sm">Đang tải danh sách hợp đồng...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-blue-900 uppercase tracking-tight">
              Danh sách Hợp đồng Lao động
            </h2>
            <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-bold text-red-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 tracking-widest">
                    Danh sách HĐLĐ của nhân sự đang làm việc
                </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Tìm theo Mã NV, Họ tên hoặc Số HĐ..."
              className="pl-9 w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black bg-white font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            <div className="text-sm text-red-500 whitespace-nowrap">
              Tổng số HĐLĐ hiện có: <span className="font-black text-blue-600 text-2xl">{allContracts.length}</span>
            </div>
            {canCreate && (
              <button 
                onClick={handleOpenAdd}
                className="px-6 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95 flex items-center gap-2 text-sm"
              >
                <Plus className="h-5 w-5" /> Thêm mới
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FULL LIST SECTION */}
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col min-h-[600px]">
        <div className="bg-blue-900 p-5 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-200" />
                </div>
                <h3 className="text-lg font-black text-white tracking-wider">Danh sách Hợp đồng lao động</h3>
            </div>
            <div className="flex items-center gap-4">
                 <span className="text-white text-xs font-black bg-blue-700/50 px-4 py-1.5 rounded-full border border-blue-600/50 tracking-tighter">
                    Tổng số HĐLĐ: {filteredContracts.length}
                </span>
            </div>
        </div>
        
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-32">Mã HĐ/NV</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest ">Họ và Tên CBGVNV</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center ">Thông tin HĐLĐ (Số hiệu/Loại)</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-right ">Hiệu lực HĐLĐ</th>
                {(canUpdate || canDelete) && (
                  <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-32">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedContracts.map((c) => (
                <tr key={c.idhopdong} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 shadow-sm">ID: {c.idhopdong}</span>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-100">NV: {c.manv}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-blue-900">{c.ho_ten}</span>
                            <span className="text-[10px] font-bold text-gray-500 italic bg-gray-100 px-1.5 py-0.5 rounded">Ngày sinh: {formatDate(c.ngay_sinh)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">{c.trinh_do}</span>
                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{c.don_vi}</span>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="inline-flex flex-col items-center">
                        <span className="text-sm font-black text-gray-800">{c.sohd}</span>
                        <span className="text-[10px] font-bold text-red-600 mt-0.5 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100">{c.ten_loaihd}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-green-400">Từ ngày: </span>
                            <span className="text-xs font-black text-gray-700">{formatDate(c.tungay)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-green-400">Đến ngày: </span>
                            <span className={`text-xs font-black ${c.denngay ? 'text-red-600' : 'text-indigo-600'}`}>
                                {c.denngay ? formatDate(c.denngay) : 'KHÔNG THỜI HẠN'}
                            </span>
                        </div>
                    </div>
                  </td>
                  {(canUpdate || canDelete) && (
                    <td className="px-6 py-5 text-center">
                      <div className="flex justify-center gap-2">
                        {canUpdate && (
                          <button 
                            onClick={() => handleOpenEdit(c)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Hiệu chỉnh"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleOpenDelete(c)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredContracts.length === 0 && (
                <tr>
                   <td colSpan={4} className="py-24 text-center text-gray-400 italic font-bold">
                       Không tìm thấy dữ liệu hợp đồng lao động nào cho nhân sự đang làm việc.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination UI */}
        <div className="bg-gray-50 px-6 py-5 flex justify-between items-center border-t border-gray-200">
            <div className="text-[11px] text-gray-500 font-black tracking-widest">
                Trang <span className="text-blue-600 text-sm">{currentPage}</span> / {totalPages || 1}
            </div>
            <div className="flex items-center gap-2">
                <button 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-2 rounded-xl bg-white border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-all"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                
                <div className="flex gap-1.5">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum = i + 1;
                        if (totalPages > 5 && currentPage > 3) {
                            pageNum = currentPage - 3 + i + 1;
                            if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                        }
                        if (pageNum <= 0) return null;
                        
                        return (
                            <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`w-10 h-10 flex items-center justify-center rounded-xl text-xs font-black transition-all ${currentPage === pageNum ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                </div>

                <button 
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-2 rounded-xl bg-white border border-gray-200 shadow-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-all"
                >
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>
            <div className="text-[10px] text-gray-400 font-bold tracking-tighter">
                Hiển thị {rowsPerPage} bản ghi / trang
            </div>
        </div>
      </div>

      {/* Add New Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200 border border-gray-200">
            <div className="bg-blue-800 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black uppercase tracking-wider flex items-center gap-3">
                <Plus className="h-6 w-6" /> Ký kết Hợp đồng lao động mới
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="hover:bg-white/10 rounded-full p-1 transition-colors"><X className="h-7 w-7"/></button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8 bg-white">
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200 shadow-inner">
                    <h4 className="text-xs font-black text-red-800 tracking-widest mb-4 flex items-center gap-2">
                        <User className="h-4 w-4" /> 1. Chọn nhân sự thực hiện ký kết
                    </h4>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Gõ để tìm theo Mã NV hoặc Tên..."
                            className="pl-9 w-full p-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black font-bold shadow-sm"
                            value={empSearchInModal}
                            onChange={e => setEmpSearchInModal(e.target.value)}
                        />
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl bg-white divide-y divide-gray-50 shadow-sm">
                        {employees.filter(e => 
                            `${e.holot} ${e.ten}`.toLowerCase().includes(empSearchInModal.toLowerCase()) || 
                            String(e.manv || '').toLowerCase().includes(empSearchInModal.toLowerCase())
                        ).map(emp => (
                            <div 
                                key={emp.manv} 
                                onClick={() => setSelectedEmpForNew(emp)}
                                className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${selectedEmpForNew?.manv === emp.manv ? 'bg-blue-50 border-l-4 border-blue-600 shadow-inner' : 'hover:bg-gray-50'}`}
                            >
                                <div>
                                    <p className="text-sm font-black text-blue-900">{emp.holot} {emp.ten}</p>
                                    <p className="text-[10px] font-bold text-red-500 tracking-tighter">{emp.manv} | {emp.ten_phongban}</p>
                                </div>
                                {selectedEmpForNew?.manv === emp.manv && <UserCheck className="h-5 w-5 text-blue-600" />}
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`p-6 rounded-3xl border transition-all ${selectedEmpForNew ? 'bg-white border-blue-200 shadow-md' : 'bg-gray-50 border-gray-100 opacity-50 pointer-events-none'}`}>
                    <h4 className="text-xs font-black text-blue-800 tracking-widest mb-4 flex items-center gap-2">
                        <FileText className="h-4 w-4" /> 2. Chi tiết HĐLĐ
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-bold text-red-500 mb-1.5 block">Số hiệu Hợp đồng *</label>
                            <input 
                                type="text"
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black shadow-sm"
                                placeholder="VD: 045/HĐLĐ-DAU"
                                value={newContract.sohd}
                                onChange={e => setNewContract({...newContract, sohd: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-red-500 mb-1.5 block">Loại hình Hợp đồng *</label>
                            <select 
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-blue-600 shadow-sm cursor-pointer"
                                value={newContract.loaihd}
                                onChange={e => setNewContract({...newContract, loaihd: e.target.value})}
                            >
                                {contractTypes.map(t => <option key={t.maso} value={t.maso}>{t.tenhdld}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-red-500 mb-1.5 block">Ngày bắt đầu *</label>
                            <input 
                                type="date"
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black shadow-sm"
                                value={newContract.tungay}
                                onChange={e => setNewContract({...newContract, tungay: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-red-500 mb-1.5 block">Ngày kết thúc</label>
                            <input 
                                type="date"
                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black shadow-sm"
                                value={newContract.denngay || ''}
                                onChange={e => setNewContract({...newContract, denngay: e.target.value})}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-gray-100 p-6 flex justify-end gap-4 border-t border-gray-200">
                <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-2 text-gray-600 font-bold hover:text-gray-800 transition-colors">Hủy bỏ</button>
                <button 
                    onClick={handleSaveContract}
                    disabled={savingContract || !selectedEmpForNew}
                    className="px-10 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50 text-xs"
                >
                    {savingContract ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Xác nhận ký kết
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingContract && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in duration-200 border border-gray-200">
            <div className="bg-blue-800 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-wider flex items-center gap-3">
                <Pencil className="h-6 w-6" /> Hiệu chỉnh hợp đồng lao động
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="hover:bg-white/10 rounded-full p-1 transition-colors"><X className="h-7 w-7"/></button>
            </div>

            <div className="p-8 space-y-6 bg-white">
              <div>
                <label className="text-sm font-bold text-red-600 mb-1.5 block">Số hiệu hợp đồng</label>
                <input 
                  type="text"
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black shadow-sm"
                  value={editingContract.sohd || ''}
                  onChange={e => setEditingContract({...editingContract, sohd: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-bold text-red-600 mb-1.5 block">Loại hình hợp đồng</label>
                <select 
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-blue-600 shadow-sm cursor-pointer"
                  value={editingContract.loaihd || ''}
                  onChange={e => setEditingContract({...editingContract, loaihd: e.target.value})}
                >
                  {contractTypes.map(t => <option key={t.maso} value={t.maso}>{t.tenhdld}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-red-600 mb-1.5 block">Ngày bắt đầu</label>
                <input 
                  type="date"
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black shadow-sm"
                  value={editingContract.tungay || ''}
                  onChange={e => setEditingContract({...editingContract, tungay: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-bold text-red-600 mb-1.5 block">Ngày kết thúc</label>
                <input 
                  type="date"
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black shadow-sm"
                  value={editingContract.denngay || ''}
                  onChange={e => setEditingContract({...editingContract, denngay: e.target.value})}
                />
              </div>
            </div>

            <div className="bg-gray-100 p-6 flex justify-end gap-4 border-t border-gray-200">
              <button onClick={() => setIsEditModalOpen(false)} className="px-6 py-2 text-gray-600 font-bold hover:text-gray-800 transition-colors">Hủy bỏ</button>
              <button 
                onClick={handleSaveEdit}
                disabled={savingContract}
                className="px-10 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50 text-xs"
              >
                {savingContract ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Lưu thông tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && deletingContract && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="bg-red-600 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-wider flex items-center gap-3">
                <Trash2 className="h-6 w-6" /> Xác nhận xóa
              </h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="hover:bg-white/10 rounded-full p-1 transition-colors"><X className="h-7 w-7"/></button>
            </div>
            <div className="p-8 text-center">
              <p className="text-gray-700 font-medium leading-relaxed">
                Bạn chắc chắn xóa hợp đồng lao động của nhân sự <span className="text-red-600 font-black">{deletingContract.ho_ten}</span> ra khỏi danh sách?
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center gap-4 border-t border-gray-100">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-8 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-all">Hủy bỏ</button>
              <button onClick={handleConfirmDelete} className="px-8 py-2.5 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all">Đồng ý</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notification?.isOpen && (
        <div className="fixed inset-0 z-[130] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-300 border border-gray-100">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCheck className="h-10 w-10" />
              </div>
              <p className="text-gray-800 font-black text-lg leading-tight">{notification.message}</p>
              <button 
                onClick={() => setNotification(null)}
                className="w-full py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border ${alertType === 'error' ? 'border-red-100' : 'border-green-100'}`}>
             <div className={`${alertType === 'error' ? 'bg-red-600' : 'bg-green-600'} p-5 text-white flex items-center gap-3`}>
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">Thông báo hệ thống</h3>
             </div>
             <div className="p-8 text-center">
                <p className="text-gray-700 font-medium leading-relaxed">
                  {alertMessage}
                </p>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                <button 
                  onClick={() => setIsAlertModalOpen(false)} 
                  className={`px-8 py-2 ${alertType === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm`}
                >
                  Đóng thông báo
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
