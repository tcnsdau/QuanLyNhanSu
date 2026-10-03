
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { DanhSachGVNganhDaoTao, RolePermission, NhanVien, ChucDanh, TrinhDo, DanhMucNganhDaoTao, PhongBan } from '../types';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { 
  Plus, Pencil, Trash2, X, Save, FileDown, 
  Search, AlertTriangle, CheckCircle2, Loader2,
  Users, UserPlus, Filter, RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  permissions?: RolePermission[];
  isAdmin?: boolean;
  currentUser?: any;
}

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

export const DanhSachGVNganhDaoTaoManagement: React.FC<Props> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [data, setData] = useState<DanhSachGVNganhDaoTao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);
  
  // Metadata states for dropdowns and display
  const [employees, setEmployees] = useState<NhanVien[]>([]);
  const [chucDanhs, setChucDanhs] = useState<ChucDanh[]>([]);
  const [trinhDos, setTrinhDos] = useState<TrinhDo[]>([]);
  const [nganhs, setNganhs] = useState<DanhMucNganhDaoTao[]>([]);
  const [phongBans, setPhongBans] = useState<PhongBan[]>([]);

  // Filter states
  const [filterChucDanh, setFilterChucDanh] = useState('');
  const [filterTrinhDo, setFilterTrinhDo] = useState('');
  const [filterNganh, setFilterNganh] = useState('');
  const [filterPhongBan, setFilterPhongBan] = useState('');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  
  const [editingRecord, setEditingRecord] = useState<DanhSachGVNganhDaoTao | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<DanhSachGVNganhDaoTao | null>(null);
  
  const [formData, setFormData] = useState({
    manv: '',
    chucdanh: '',
    trinhdo: '',
    nganhdaotao: '',
    phongban: ''
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
  const canRead = useMemo(() => checkPermission(permissions, isAdmin, 'nganhHoc-giangVien', 'READ'), [permissions, isAdmin]);
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'nganhHoc-giangVien', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'nganhHoc-giangVien', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'nganhHoc-giangVien', 'DELETE'), [permissions, isAdmin]);

  // Fetch latest permissions
  useEffect(() => {
    const fetchLatestPermissions = async () => {
      // Step 1: Check if Admin
      if (isAdmin || currentUser?.username === 'Admin' || String(currentUser?.manv) === '1') return;
      
      const userId = currentUser?.id || currentUser?.userid;
      const manv = currentUser?.manv;
      
      if (!userId && !manv) return;
      
      try {
        let finalUserId = userId;
        
        // Step 2: Use manv to determine userid via table UserRoles/Users as requested
        if (!finalUserId && manv) {
          const { data: userData, error: userError } = await supabase
            .from('Users')
            .select('id')
            .eq('manv', manv)
            .maybeSingle();
          if (userData) finalUserId = userData.id;
        }

        if (!finalUserId) return;

        // Step 3: Check RolePermissions through userid
        const { data: rolePermData, error: rolePermError } = await supabase
          .from('RolePermissions')
          .select(`
            *,
            Modules!inner(modulecode, modulename),
            Permissions!inner(permissioncode, permissionname)
          `)
          .eq('userid', finalUserId);

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
        console.error('Error fetching permissions Danh sách GV theo ngành:', err);
      }
    };

    fetchLatestPermissions();
  }, [currentUser, isAdmin]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Tải dữ liệu từ các bảng liên quan
      const [mainRes, nvRes, cdRes, tdRes, nganhRes, pbRes] = await Promise.all([
        supabase.from('DanhSachGVNganhDaoTao').select('*'),
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, ngaysinh, chucdanh, trinhdo, phongban, danghiviec'),
        supabase.from('DanhMucChucDanh').select('*'),
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhMucNganhDaoTao').select('*'),
        supabase.from('DanhMucPhongBan').select('*')
      ]);

      if (mainRes.error) throw mainRes.error;
      if (nvRes.error) throw nvRes.error;
      if (cdRes.error) throw cdRes.error;
      if (tdRes.error) throw tdRes.error;
      if (nganhRes.error) throw nganhRes.error;
      if (pbRes.error) throw pbRes.error;

      const normMain = (mainRes.data || []).map(normalizeKeys) as DanhSachGVNganhDaoTao[];
      const normAllNV = (nvRes.data || []).map(normalizeKeys) as (NhanVien & { danghiviec?: boolean | string | number })[];
      const normCD = (cdRes.data || []).map(normalizeKeys) as ChucDanh[];
      const normTD = (tdRes.data || []).map(normalizeKeys) as TrinhDo[];
      const normNganh = (nganhRes.data || []).map(normalizeKeys) as DanhMucNganhDaoTao[];
      const normPB = (pbRes.data || []).map(normalizeKeys) as PhongBan[];

      // Lọc danh sách nhân viên đang làm việc (danghiviec === false) phục vụ cho form thêm mới
      const activeEmployees = normAllNV.filter(n => {
        const isResigned = n.danghiviec === true || String(n.danghiviec).toLowerCase() === 'true';
        return !isResigned;
      }) as NhanVien[];

      setEmployees(activeEmployees);
      setChucDanhs(normCD);
      setTrinhDos(normTD);
      setNganhs(normNganh);
      setPhongBans(normPB);

      // 2. Lần lượt kiểm tra từng manv trong DanhSachGVNganhDaoTao
      const recordsToDeleteIds: number[] = [];
      const updateTasks: Promise<any>[] = [];
      const validRecords: DanhSachGVNganhDaoTao[] = [];

      for (const item of normMain) {
        const nv = normAllNV.find(n => String(n.manv).trim() === String(item.manv).trim());

        const isResigned = nv ? (nv.danghiviec === true || String(nv.danghiviec).toLowerCase() === 'true') : false;

        if (isResigned) {
          // Nếu giá trị danghiviec=True (GV đã nghỉ việc): Thực hiện xóa manv này ra khỏi Table DanhSachGVNganhDaoTao
          if (item.id) {
            recordsToDeleteIds.push(item.id);
          }
        } else {
          // Nếu giá trị danghiviec=False (GV còn làm việc):
          // Tiếp tục thực hiện cập nhật giá trị chucdanh và trinhdo từ Table DanhSachNhanVien vào Table DanhSachGVNganhDaoTao
          let currentChucDanh = item.chucdanh;
          let currentTrinhDo = item.trinhdo;
          const fieldUpdates: any = {};

          if (nv) {
            const nvCD = nv.chucdanh != null ? String(nv.chucdanh).trim() : '';
            const itemCD = item.chucdanh != null ? String(item.chucdanh).trim() : '';
            if (nv.chucdanh !== undefined && nvCD !== itemCD) {
              fieldUpdates.chucdanh = nv.chucdanh;
              currentChucDanh = String(nv.chucdanh);
            }

            const nvTD = nv.trinhdo != null ? String(nv.trinhdo).trim() : '';
            const itemTD = item.trinhdo != null ? String(item.trinhdo).trim() : '';
            if (nv.trinhdo !== undefined && nvTD !== itemTD) {
              fieldUpdates.trinhdo = nv.trinhdo;
              currentTrinhDo = String(nv.trinhdo);
            }

            if (Object.keys(fieldUpdates).length > 0 && item.id) {
              updateTasks.push(
                Promise.resolve(supabase.from('DanhSachGVNganhDaoTao').update(fieldUpdates).eq('id', item.id))
              );
            }
          }

          validRecords.push({
            ...item,
            chucdanh: currentChucDanh,
            trinhdo: currentTrinhDo
          });
        }
      }

      // Thực thi xóa các giảng viên đã nghỉ việc khỏi database
      if (recordsToDeleteIds.length > 0) {
        await supabase.from('DanhSachGVNganhDaoTao').delete().in('id', recordsToDeleteIds);
      }

      // Thực thi cập nhật chức danh, trình độ có thay đổi vào database
      if (updateTasks.length > 0) {
        await Promise.all(updateTasks);
      }

      // 3. Hiển thị “Danh sách Giảng viên theo Ngành đào tạo” với giá trị chức danh và trình độ đã được cập nhập
      const mappedData = validRecords.map(item => {
        const nv = normAllNV.find(n => String(n.manv).trim() === String(item.manv).trim());
        const cd = normCD.find(c => String(c.machucdanh) === String(item.chucdanh));
        const td = normTD.find(t => String(t.matrinhdo) === String(item.trinhdo));
        const nganh = normNganh.find(n => String(n.manganh) === String(item.nganhdaotao));
        const pb = normPB.find(p => String(p.maphongban) === String(item.phongban));

        return {
          ...item,
          holot: nv?.holot || '---',
          ten: nv?.ten || '---',
          ngaysinh: nv?.ngaysinh || '',
          ten_chucdanh: cd?.giatri || '---',
          ten_trinhdo: td?.giatri || '---',
          ten_nganh: nganh?.tennganh || '---',
          ten_phongban: pb?.giatri || '---'
        };
      }) as DanhSachGVNganhDaoTao[];

      setData(mappedData);
    } catch (error: any) {
      console.error('Error fetching and synchronizing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = 
        String(item.manv).toLowerCase().includes(searchLower) ||
        (item.holot || '').toLowerCase().includes(searchLower) ||
        (item.ten || '').toLowerCase().includes(searchLower);
      
      const matchChucDanh = !filterChucDanh || String(item.chucdanh) === filterChucDanh;
      const matchTrinhDo = !filterTrinhDo || String(item.trinhdo) === filterTrinhDo;
      const matchNganh = !filterNganh || String(item.nganhdaotao) === filterNganh;
      const matchPhongBan = !filterPhongBan || String(item.phongban) === filterPhongBan;

      return matchSearch && matchChucDanh && matchTrinhDo && matchNganh && matchPhongBan;
    });
  }, [data, searchTerm, filterChucDanh, filterTrinhDo, filterNganh, filterPhongBan]);

  const handleOpenAdd = () => {
    setFormData({
      manv: '',
      chucdanh: '',
      trinhdo: '',
      nganhdaotao: '',
      phongban: ''
    });
    setIsAddModalOpen(true);
  };

  const handleEmployeeChange = (manv: string) => {
    const nv = employees.find(e => String(e.manv) === manv);
    if (nv) {
      setFormData({
        ...formData,
        manv,
        chucdanh: String(nv.chucdanh || ''),
        trinhdo: String(nv.trinhdo || ''),
        phongban: String(nv.phongban || '')
      });
    } else {
      setFormData({
        ...formData,
        manv,
        chucdanh: '',
        trinhdo: '',
        phongban: ''
      });
    }
  };

  const handleAdd = async () => {
    if (!formData.manv || !formData.nganhdaotao) return;
    
    setSaving(true);
    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from('DanhSachGVNganhDaoTao')
        .select('id')
        .eq('manv', formData.manv)
        .eq('nganhdaotao', formData.nganhdaotao)
        .maybeSingle();
      
      if (existing) {
        setErrorMessage('Giảng viên này đã được phân công vào ngành đào tạo này rồi.');
        setIsErrorModalOpen(true);
        setSaving(false);
        return;
      }

      const { error } = await supabase.from('DanhSachGVNganhDaoTao').insert([formData]);
      if (error) throw error;

      setMessage('Đã thêm mới giảng viên vào ngành đào tạo thành công');
      setIsAddModalOpen(false);
      setIsSuccessModalOpen(true);
      fetchAllData();
    } catch (error: any) {
      setErrorMessage('Lỗi khi lưu dữ liệu: ' + error.message);
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (record: DanhSachGVNganhDaoTao) => {
    setEditingRecord(record);
    setFormData({
      manv: record.manv,
      chucdanh: record.chucdanh,
      trinhdo: record.trinhdo,
      nganhdaotao: record.nganhdaotao,
      phongban: record.phongban
    });
    setIsEditModalOpen(true);
  };

  const handleEdit = async () => {
    if (!editingRecord) return;
    if (formData.nganhdaotao === editingRecord.nganhdaotao) {
      setIsEditModalOpen(false);
      return;
    }

    setSaving(true);
    try {
      // Check if already exists in another record
      const { data: existing } = await supabase
        .from('DanhSachGVNganhDaoTao')
        .select('id')
        .eq('manv', formData.manv)
        .eq('nganhdaotao', formData.nganhdaotao)
        .neq('id', editingRecord.id)
        .maybeSingle();

      if (existing) {
        setErrorMessage('Giảng viên này đã được phân công vào ngành đào tạo mục tiêu.');
        setIsErrorModalOpen(true);
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('DanhSachGVNganhDaoTao')
        .update({ nganhdaotao: formData.nganhdaotao })
        .eq('id', editingRecord.id);
      
      if (error) throw error;

      setMessage('Đã cập nhập ngành đào tạo cho giảng viên thành công');
      setIsEditModalOpen(false);
      setIsSuccessModalOpen(true);
      fetchAllData();
    } catch (error: any) {
      setErrorMessage('Lỗi khi cập nhật: ' + error.message);
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (record: DanhSachGVNganhDaoTao) => {
    setDeletingRecord(record);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingRecord) return;
    
    try {
      const { error } = await supabase
        .from('DanhSachGVNganhDaoTao')
        .delete()
        .eq('id', deletingRecord.id);
      
      if (error) throw error;

      setMessage(`Đã xóa giảng viên ${deletingRecord.holot} ${deletingRecord.ten} khỏi ngành đào tạo`);
      setIsDeleteModalOpen(false);
      setIsSuccessModalOpen(true);
      fetchAllData();
    } catch (error: any) {
      setErrorMessage('Lỗi khi xóa: ' + error.message);
      setIsErrorModalOpen(true);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map((item, index) => ({
      'STT': index + 1,
      'Mã NV': item.manv,
      'Họ lót': item.holot,
      'Tên': item.ten,
      'Ngày sinh': item.ngaysinh ? new Date(item.ngaysinh).toLocaleDateString('vi-VN') : '',
      'Chức danh': item.ten_chucdanh,
      'Trình độ': item.ten_trinhdo,
      'Đơn vị công tác': item.ten_phongban,
      'Ngành đào tạo': item.ten_nganh
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh_sach_GV_theo_nganh");
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = window.URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DS_giang_vien_theo_nganh_${new Date().getTime()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to filter employees not already in list for addition
  const availableEmployees = useMemo(() => {
    // Actually, one employee can probably be in multiple majors?
    // User request says "Chọn Giảng viên từ Danh sách (Chỉ hiển thị giảng viên chưa có trong Danh sách giảng viên theo ngành)"
    // This implies a 1-to-1 or at least avoiding duplicates.
    const assignedManvs = new Set(data.map(d => String(d.manv)));
    return employees.filter(e => !assignedManvs.has(String(e.manv)));
  }, [employees, data]);

  if (!loading && !canRead) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl shadow-sm border border-gray-100 animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-red-50 rounded-full">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Không có quyền truy cập</h3>
          <p className="text-gray-500 max-w-md">
            Bạn không có quyền xem chức năng "Danh sách GV theo ngành". Vui lòng liên hệ quản trị viên để được cấp quyền.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-blue-900 flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg">
                <Users className="text-blue-600 h-6 w-6" />
              </div>
              Danh sách Giảng viên theo Ngành đào tạo
            </h2>
            <p className="text-sm text-gray-500 mt-1">Phân công và quản lý đội ngũ giảng viên theo từng ngành đào tạo</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {canCreate && (
              <button 
                onClick={handleOpenAdd}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
              >
                <UserPlus size={18} />
                Thêm mới
              </button>
            )}
            
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all active:scale-95"
            >
              <FileDown size={18} />
              Xuất Excel
            </button>
            
            <button 
              onClick={fetchAllData}
              className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-6 border-t border-gray-50">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 h-4 w-4" />
            <input 
              type="text"
              placeholder="Mã NV, Họ tên..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Chức danh Filter */}
          <select 
            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
            value={filterChucDanh}
            onChange={(e) => setFilterChucDanh(e.target.value)}
          >
            <option value="">Tất cả chức danh</option>
            {chucDanhs.map(cd => (
              <option key={cd.machucdanh} value={cd.machucdanh}>{cd.giatri}</option>
            ))}
          </select>

          {/* Trình độ Filter */}
          <select 
            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
            value={filterTrinhDo}
            onChange={(e) => setFilterTrinhDo(e.target.value)}
          >
            <option value="">Tất cả trình độ</option>
            {trinhDos.map(td => (
              <option key={td.matrinhdo} value={td.matrinhdo}>{td.giatri}</option>
            ))}
          </select>

          {/* Phòng ban Filter */}
          <select 
            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
            value={filterPhongBan}
            onChange={(e) => setFilterPhongBan(e.target.value)}
          >
            <option value="">Tất cả đơn vị</option>
            {phongBans.map(pb => (
              <option key={pb.maphongban} value={pb.maphongban}>{pb.giatri}</option>
            ))}
          </select>

          {/* Ngành Filter */}
          <select 
            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white font-medium text-blue-600"
            value={filterNganh}
            onChange={(e) => setFilterNganh(e.target.value)}
          >
            <option value="">Tất cả ngành đào tạo</option>
            {nganhs.map(n => (
              <option key={n.manganh} value={n.manganh}>{n.tennganh}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest text-center w-16">STT</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest text-center w-28">Mã NV</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest ">Họ lót</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest ">Tên</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest text-center">Ngày sinh</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest ">Chức danh</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest ">Trình độ</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest ">Đơn vị / Ngành đào tạo</th>
                <th className="px-6 py-4 text-xs font-bold text-red-600 tracking-widest text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                      <p className="text-sm text-gray-400 font-medium">Đang tải dữ liệu giảng viên...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Filter className="h-10 w-10 text-gray-200" />
                      <p className="text-sm text-gray-400 font-medium">Không tìm thấy giảng viên nào phù hợp bộ lọc</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.id} className="hover:bg-blue-50/20 transition-colors group">
                    <td className="px-6 py-4 text-sm text-gray-400 text-center font-medium">{index + 1}</td>
                    <td className="px-6 py-4 text-sm text-blue-800 text-center font-black">{item.manv}</td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">{item.holot}</td>
                    <td className="px-6 py-4 text-sm text-blue-700 font-bold">{item.ten}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 text-center">{item.ngaysinh ? new Date(item.ngaysinh).toLocaleDateString('vi-VN') : '---'}</td>
                    <td className="px-6 py-4 text-sm text-emerald-600 font-medium">{item.ten_chucdanh}</td>
                    <td className="px-6 py-4 text-sm text-indigo-600 font-medium">{item.ten_trinhdo}</td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] text-gray-400 font-bold tracking-tighter">{item.ten_phongban}</p>
                      <p className="text-sm text-blue-600 font-bold">{item.ten_nganh}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {canUpdate && (
                          <button 
                            onClick={() => handleOpenEdit(item)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex items-center gap-1.5 text-xs font-black tracking-tighter"
                            title="Hiệu chỉnh Ngành đào tạo"
                          >
                            <Pencil size={14} />
                            Hiệu chỉnh
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleOpenDelete(item)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center gap-1.5 text-xs font-black tracking-tighter"
                            title="Xóa Giảng viên"
                          >
                            <Trash2 size={14} />
                            Xóa
                          </button>
                        )}
                        {!canUpdate && !canDelete && (
                          <span className="text-[10px] text-gray-400 italic">Chỉ xem</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50/50 px-6 py-3 border-t border-gray-100 flex justify-between items-center">
          <p className="text-xs text-gray-400 font-bold italic">Hiển thị {filteredData.length} trên tổng số {data.length} bản ghi</p>
          <p className="text-[10px] text-blue-300 font-black tracking-widest uppercase">DAU HRM SYSTEM</p>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border border-gray-100">
            <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 tracking-wide">
                  <UserPlus size={20} />
                  Thêm mới Giảng viên vào Ngành Đào tạo
                </h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="hover:rotate-90 transition-transform">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Giảng viên Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-red-500 tracking-wider flex items-center gap-2">
                  Chọn Giảng viên
                </label>
                <select 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-blue-900"
                  value={formData.manv}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                >
                  <option value="">-- Chọn giảng viên từ danh sách nhân viên --</option>
                  {availableEmployees.map(e => (
                    <option key={e.manv} value={e.manv}>
                      [{e.manv}] {e.holot} {e.ten} - {e.ten_phongban}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 italic italic tracking-tight">Lưu ý: Chỉ hiển thị giảng viên chưa có trong danh sách phân công.</p>
              </div>

              {/* Read-only info from employee */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/30 p-5 rounded-2xl border border-blue-50">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-blue-400 tracking-widest">Đơn vị công tác</p>
                  <p className="text-sm font-bold text-blue-900">
                    {phongBans.find(p => String(p.maphongban) === formData.phongban)?.giatri || '---'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-blue-400  tracking-widest">Chức danh</p>
                  <p className="text-sm font-bold text-blue-900">
                    {chucDanhs.find(c => String(c.machucdanh) === formData.chucdanh)?.giatri || '---'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-blue-400  tracking-widest">Trình độ chuyên môn</p>
                  <p className="text-sm font-bold text-blue-900">
                    {trinhDos.find(t => String(t.matrinhdo) === formData.trinhdo)?.giatri || '---'}
                  </p>
                </div>
              </div>

              {/* Ngành Đào tạo Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-red-500 tracking-wider flex items-center gap-2 ">
                  Ngành Đào tạo 
                </label>
                <select 
                  className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold text-blue-600"
                  value={formData.nganhdaotao}
                  onChange={(e) => setFormData({...formData, nganhdaotao: e.target.value})}
                >
                  <option value="">-- Chọn ngành đào tạo --</option>
                  {nganhs.map(n => (
                    <option key={n.manganh} value={n.manganh}>{n.tennganh}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="px-6 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors tracking-widest"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleAdd}
                disabled={saving || !formData.manv || !formData.nganhdaotao}
                className="px-8 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none flex items-center gap-2 text-sm tracking-wide"
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
              <h3 className="text-lg font-bold flex items-center gap-2 tracking-wide">
                <Pencil size={20} />
                Hiệu chỉnh Ngành Đào tạo
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="hover:rotate-90 transition-transform">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 flex flex-col gap-3">
                 <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-gray-400 tracking-widest">Giảng viên / Nhân sự</p>
                    <p className="text-xs font-black text-blue-600">Mã NV: {editingRecord.manv}</p>
                 </div>
                 <p className="text-lg font-black text-blue-900">{editingRecord.holot} {editingRecord.ten}</p>
                 <div className="flex gap-4">
                    <p className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">{editingRecord.ten_chucdanh}</p>
                    <p className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">{editingRecord.ten_trinhdo}</p>
                 </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-red-500 tracking-wider flex items-center gap-2">
                  Ngành Đào tạo mới
                </label>
                <select 
                  className="w-full px-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-indigo-600"
                  value={formData.nganhdaotao}
                  onChange={(e) => setFormData({...formData, nganhdaotao: e.target.value})}
                >
                  {nganhs.map(n => (
                    <option key={n.manganh} value={n.manganh}>{n.tennganh}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 italic">Chọn học ngành đào tạo mới để thay đổi phân công cho giảng viên này.</p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="px-6 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors tracking-widest"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleEdit}
                disabled={saving}
                className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none flex items-center gap-2 text-sm tracking-wide"
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-red-100">
            <div className="bg-red-600 p-6 text-white flex items-center gap-3">
              <AlertTriangle size={28} />
              <h3 className="text-lg font-bold  tracking-tight">Xác nhận hủy bỏ</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-gray-700 font-medium leading-relaxed">
                Bạn có chắc chắn muốn xóa giảng viên <span className="font-black text-red-600">{deletingRecord.holot} {deletingRecord.ten}</span> ra khỏi ngành đào tạo <span className="font-bold text-blue-600">{deletingRecord.ten_nganh}</span> không?
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center gap-4 border-t border-gray-100">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-8 py-2 text-sm font-bold text-gray-400 hover:text-gray-700 transition-colors tracking-widest"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleDelete}
                className="px-10 py-2 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95 text-sm tracking-wide"
              >
                Đồng ý xóa
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
              <h3 className="text-lg font-bold tracking-tight">Thành công</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-gray-700 font-bold text-sm leading-relaxed">
                {message}
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center border-t border-gray-100">
              <button 
                onClick={() => setIsSuccessModalOpen(false)}
                className="px-12 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 text-sm tracking-widest"
              >
                Xác nhận
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
              <h3 className="text-lg font-bold tracking-tight">Thông báo lỗi</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-red-700 font-bold text-sm leading-relaxed">
                {errorMessage}
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center border-t border-gray-100">
              <button 
                onClick={() => setIsErrorModalOpen(false)}
                className="px-12 py-2 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all active:scale-95 text-sm tracking-widest"
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
