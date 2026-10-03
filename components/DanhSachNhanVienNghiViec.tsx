
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { NhanVien, TrinhDo, PhongBan, ChucVu, ChucDanh, QuanHeGiaDinh, QuaTrinhDaoTao, DanhMucHDLD, DanhSachKyHDLD, DanhSachCaNhanHTNV, DanhSachCaNhanDHTD, DanhSachCaNhanKhenThuong, RolePermission } from '../types';
import { Search, Info, User, Phone, MapPin, Mail, Filter, FileDown, Pencil, Save, X, Users, GraduationCap, Plus, Trash2, ArrowUpDown, FileText, BadgeCheck, Briefcase as BriefcaseIcon, Calendar as CalendarIcon, CreditCard, Check, Edit2, Loader, Upload, Link as LinkIcon, Copy, FolderOpen, Eye, Image as ImageIcon, Clock, Trophy, Gift, Printer, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

export const DanhSachNhanVienNghiViec: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [nhanVienList, setNhanVienList] = useState<NhanVien[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);

  // Alert Modal State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'success' | 'error'>('error');

  const showAlert = (message: string, type: 'success' | 'error' = 'error') => {
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
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'hdld-ketThuc', 'UPDATE'), [permissions, isAdmin]);

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
      } catch (err) {
        showAlert('Lỗi tải quyền hạn Danh sách kết thúc HĐLĐ: ' + (err instanceof Error ? err.message : String(err)));
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);
  
  // Sorting State
  const [sortKey, setSortKey] = useState<string>('vithu'); 

  // Filter States
  const [filters, setFilters] = useState({
    gioitinh: '',
    trinhdo: '',
    phongban: '',
    chucvu: '',
    chucdanh: '',
    giangvien: ''
  });

  // Modal States
  const [selectedContact, setSelectedContact] = useState<NhanVien | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<NhanVien | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState<Partial<NhanVien>>({});
  const [savingDetails, setSavingDetails] = useState(false);

  // Contract History State
  const [staffContracts, setStaffContracts] = useState<any[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [danhMucHDLD, setDanhMucHDLD] = useState<DanhMucHDLD[]>([]);

  // Work History State (HTNV)
  const [staffWorkHistory, setStaffWorkHistory] = useState<DanhSachCaNhanHTNV[]>([]);
  const [loadingWorkHistory, setLoadingWorkHistory] = useState(false);

  // Awards History State (DHTD)
  const [staffAwards, setStaffAwards] = useState<DanhSachCaNhanDHTD[]>([]);
  const [loadingAwards, setLoadingAwards] = useState(false);

  // Commendations History State (Khen thuong)
  const [staffCommendations, setStaffCommendations] = useState<DanhSachCaNhanKhenThuong[]>([]);
  const [loadingCommendations, setLoadingCommendations] = useState(false);

  // Catalog Data
  const [trinhDoList, setTrinhDoList] = useState<TrinhDo[]>([]);
  const [phongBanList, setPhongBanList] = useState<PhongBan[]>([]);
  const [chucVuList, setChucVuList] = useState<ChucVu[]>([]);
  const [chucDanhList, setChucDanhList] = useState<ChucDanh[]>([]);

  // States for Lecturer, Family, and Education
  const [selectedLecturer, setSelectedLecturer] = useState<NhanVien | null>(null);
  const [isEditingLecturer, setIsEditingLecturer] = useState(false);
  const [lecturerForm, setLecturerForm] = useState<any>({});
  const [loadingModal, setLoadingModal] = useState(false);
  const [selectedFamilyMember, setSelectedFamilyMember] = useState<NhanVien | null>(null);
  const [familyData, setFamilyData] = useState<QuanHeGiaDinh[]>([]);
  const [selectedEducationMember, setSelectedEducationMember] = useState<NhanVien | null>(null);
  const [educationData, setEducationData] = useState<QuaTrinhDaoTao[]>([]);

  const normalizeObjectKeys = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      newObj[key.toLowerCase()] = obj[key];
    });
    return newObj;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tdRes, pbRes, cvRes, cdRes, nvRes, hdRes] = await Promise.all([
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('DanhMucChucVu').select('*'),
        supabase.from('DanhMucChucDanh').select('*'),
        supabase.from('DanhSachNhanVien').select('*').eq('danghiviec', true).order('vithu', { ascending: true }),
        supabase.from('DanhMucHDLD').select('*')
      ]);

      if (tdRes.data) setTrinhDoList(tdRes.data);
      if (pbRes.data) setPhongBanList(pbRes.data);
      if (cvRes.data) setChucVuList(cvRes.data);
      if (cdRes.data) setChucDanhList(cdRes.data);
      if (hdRes.data) setDanhMucHDLD(hdRes.data.map(item => normalizeObjectKeys(item)));

      if (nvRes.data) {
        const joinedData = nvRes.data.map((rawNv: any) => {
          const nv = normalizeObjectKeys(rawNv) as NhanVien;
          
          const findInCatalog = (catalog: any[], code: string, keyField: string, valField: string) => {
             if (!code || !catalog) return code;
             const found = catalog.find(item => String(item[keyField]) === String(code));
             return found ? found[valField] : code;
          };

          return {
            ...nv,
            ten_trinhdo: findInCatalog(tdRes.data || [], nv.trinhdo, 'matrinhdo', 'giatri'),
            ten_phongban: findInCatalog(pbRes.data || [], nv.phongban, 'maphongban', 'giatri'),
            ten_chucvu: findInCatalog(cvRes.data || [], nv.chucvu, 'machucvu', 'giatri'),
            ten_chucdanh: findInCatalog(cdRes.data || [], nv.chucdanh, 'machucdanh', 'giatri'),
          };
        });
        setNhanVienList(joinedData);
      }
    } catch (error) {
      showAlert("System error: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffContracts = async (manv: string) => {
    setLoadingContracts(true);
    try {
      const { data, error } = await supabase
        .from('DanhSachKyHDLD')
        .select('*')
        .eq('manv', manv)
        .order('tungay', { ascending: false });
      
      if (error) throw error;
      setStaffContracts((data || []).map(item => normalizeObjectKeys(item)));
    } catch (err) {
      showAlert("Lỗi tải HĐLĐ: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingContracts(false);
    }
  };

  const fetchStaffWorkHistory = async (manv: string) => {
    setLoadingWorkHistory(true);
    try {
      const { data, error } = await supabase
        .from('DanhSachCaNhanHTNV')
        .select('*')
        .eq('manv', manv);
      
      if (error) throw error;
      
      const sorted = (data || [])
        .map(item => normalizeObjectKeys(item) as DanhSachCaNhanHTNV)
        .sort((a, b) => b.namhoc.localeCompare(a.namhoc));
        
      setStaffWorkHistory(sorted);
    } catch (err) {
      showAlert("Lỗi tải quá trình công tác: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingWorkHistory(false);
    }
  };

  const fetchStaffAwards = async (manv: string) => {
    setLoadingAwards(true);
    try {
      const { data, error } = await supabase
        .from('DanhSachCaNhanDHTD')
        .select('*')
        .eq('manv', manv);
      
      if (error) throw error;
      
      const sorted = (data || [])
        .map(item => normalizeObjectKeys(item) as DanhSachCaNhanDHTD)
        .sort((a, b) => b.namhoc.localeCompare(a.namhoc));
        
      setStaffAwards(sorted);
    } catch (err) {
      showAlert("Lỗi tải danh hiệu thi đua: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingAwards(false);
    }
  };

  const fetchStaffCommendations = async (manv: string) => {
    setLoadingCommendations(true);
    try {
      const { data, error } = await supabase
        .from('DanhSachCaNhanKhenThuong')
        .select('*')
        .eq('manv', manv);
      
      if (error) throw error;
      
      const sorted = (data || [])
        .map(item => normalizeObjectKeys(item) as DanhSachCaNhanKhenThuong)
        .sort((a, b) => b.namhoc.localeCompare(a.namhoc));
        
      setStaffCommendations(sorted);
    } catch (err) {
      showAlert("Lỗi tải khen thưởng: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoadingCommendations(false);
    }
  };

  const handleOpenDetails = (nv: NhanVien) => {
    closeAllModals();
    setSelectedDetails(nv);
    setDetailsForm({ ...nv });
    setIsEditingDetails(false);
    fetchStaffContracts(nv.manv);
    fetchStaffWorkHistory(nv.manv);
    fetchStaffAwards(nv.manv);
    fetchStaffCommendations(nv.manv);
    fetchFamilyData(nv.manv);
    fetchEducationData(nv.manv);
  };

  const handleSaveDetails = async () => {
    if (!selectedDetails || !detailsForm) return;
    setSavingDetails(true);

    try {
      // Chỉ lưu giá trị danghiviec
      const updatePayload = {
        danghiviec: detailsForm.danghiviec
      };

      const { error } = await supabase
        .from('DanhSachNhanVien')
        .update(updatePayload)
        .eq('manv', selectedDetails.manv);

      if (error) throw error;

      showAlert("Cập nhật trạng thái nghỉ việc thành công!", 'success');
      setIsEditingDetails(false);
      fetchData(); // Tải lại danh sách (nhân viên đã bỏ nghỉ sẽ biến mất khỏi danh sách này)
      setSelectedDetails(null);
    } catch (err: any) {
      showAlert("Lỗi cập nhật: " + err.message);
    } finally {
      setSavingDetails(false);
    }
  };

  const closeAllModals = () => {
    setSelectedContact(null);
    setSelectedDetails(null);
    setIsEditingDetails(false);
    setSelectedLecturer(null);
    setSelectedFamilyMember(null);
    setSelectedEducationMember(null);
    setStaffContracts([]);
    setStaffWorkHistory([]);
    setStaffAwards([]);
    setStaffCommendations([]);
  };

  const handleOpenContact = (nv: NhanVien) => {
    closeAllModals();
    setSelectedContact(nv);
  };

  const handleOpenLecturerProfile = (nv: NhanVien) => {
    if (nv.giangvien) {
      closeAllModals();
      setSelectedLecturer(nv);
      setIsEditingLecturer(false);
      setLecturerForm({
        ngayqdtrogiang: nv.ngayqdtrogiang || '',
        ngayqdgiangvien: nv.ngayqdgiangvien || ''
      });
    }
  };

  const fetchFamilyData = async (manv: string) => {
    setLoadingModal(true);
    try {
        const { data, error } = await supabase.from('DanhSachQuanHeGiaDinh').select('*').eq('manv', manv); 
        if (!error) {
            setFamilyData((data || []).map(item => normalizeObjectKeys(item) as QuanHeGiaDinh));
        }
    } finally {
        setLoadingModal(false);
    }
  };

  const handleOpenFamily = async (nv: NhanVien) => {
    closeAllModals();
    setSelectedFamilyMember(nv);
    fetchFamilyData(nv.manv);
  };

  const fetchEducationData = async (manv: string) => {
    setLoadingModal(true);
    try {
        const { data, error } = await supabase.from('DanhSachQuaTrinhDaoTao').select('*').eq('manv', manv); 
        if (!error) {
            setEducationData((data || []).map(item => normalizeObjectKeys(item) as QuaTrinhDaoTao));
        }
    } finally {
        setLoadingModal(false);
    }
  };

  const handleOpenEducation = async (nv: NhanVien) => {
    closeAllModals();
    setSelectedEducationMember(nv);
    fetchEducationData(nv.manv);
  };

  const getGoogleDriveImageUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      const idMatch = url.match(/[-\w]{25,}/);
      if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[0]}`;
    }
    return url;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dateString;
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredData = nhanVienList.filter(nv => {
    const matchesSearch = (nv.ten?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (nv.holot?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesGioiTinh = filters.gioitinh ? (filters.gioitinh === 'Nam' ? nv.gioitinh === true : nv.gioitinh === false) : true;
    const matchesTrinhDo = filters.trinhdo ? nv.ten_trinhdo === filters.trinhdo : true;
    const matchesPhongBan = filters.phongban ? nv.ten_phongban === filters.phongban : true;
    const matchesChucVu = filters.chucvu ? nv.ten_chucvu === filters.chucvu : true;
    const matchesChucDanh = filters.chucdanh ? nv.ten_chucdanh === filters.chucdanh : true;
    const matchesGiangVien = filters.giangvien ? (filters.giangvien === 'true' ? nv.giangvien === true : nv.giangvien === false) : true;
    return matchesSearch && matchesGioiTinh && matchesTrinhDo && matchesPhongBan && matchesChucVu && matchesChucDanh && matchesGiangVien;
  }).sort((a, b) => {
      let valA: any = a[sortKey as keyof NhanVien] || '';
      let valB: any = b[sortKey as keyof NhanVien] || '';
      if (sortKey === 'ten_trinhdo') { valA = a.ten_trinhdo || ''; valB = b.ten_trinhdo || ''; }
      if (sortKey === 'ten_phongban') { valA = a.ten_phongban || ''; valB = b.ten_phongban || ''; }
      if (sortKey === 'ten_chucvu') { valA = a.ten_chucvu || ''; valB = b.ten_chucvu || ''; }
      if (typeof valA === 'string') return valA.localeCompare(valB as string);
      return (valA < valB ? -1 : valA > valB ? 1 : 0);
  });

  const handleExportExcel = () => {
    const dataToExport = filteredData.map(nv => ({ 'STT': nv.vithu, 'Mã NV': nv.manv, 'Họ lót': nv.holot, 'Tên': nv.ten, 'Ngày sinh': formatDate(nv.ngaysinh), 'Giới tính': nv.gioitinh ? 'Nam' : 'Nữ', 'Trình độ': nv.ten_trinhdo, 'Khoa / Phòng': nv.ten_phongban, 'Chức vụ': nv.ten_chucvu, 'Chức danh': nv.ten_chucdanh, 'Giảng viên': nv.giangvien ? 'Có' : 'Không', 'Nơi sinh': nv.noisinh, 'SĐT': nv.sodtdd, 'Email': nv.email, 'Số CCCD': nv.socccd }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachNhanSu");
    XLSX.writeFile(wb, "DanhSachNhanSuNghiViec_DAU.xlsx");
  };

  const handlePrintProfile = () => {
    if (!selectedDetails) return;
    // Logic tương tự HoSoNhanSuManagement
    showAlert("Chức năng in hồ sơ đang được chuẩn bị...", 'success');
  };

  const uniqueValues = (key: keyof NhanVien | 'ten_trinhdo' | 'ten_phongban' | 'ten_chucvu' | 'ten_chucdanh') => {
    return Array.from(new Set(nhanVienList.map(item => item[key as keyof NhanVien] as string))).filter(Boolean).sort();
  };

  // Re-usable input component with disabled logic
  const DetailInput = ({ label, field, type = "text", forceDisabled = false }: { label: string, field: keyof NhanVien, type?: string, forceDisabled?: boolean }) => {
    const isDisabled = forceDisabled || (isEditingDetails && field !== 'danghiviec');
    return (
      <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">{label}</label>
          {isEditingDetails ? (
              <input 
                  type={type}
                  disabled={isDisabled}
                  className={`w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 ${isDisabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                  value={(detailsForm[field] as string) || ''}
                  onChange={(e) => setDetailsForm({ ...detailsForm, [field]: type === 'checkbox' ? e.target.checked : e.target.value })}
                  checked={type === 'checkbox' ? (detailsForm[field] as boolean) : undefined}
              />
          ) : (
              <p className="text-sm font-bold text-blue-700">
                  {type === 'date' ? formatDate(selectedDetails![field] as string) : (type === 'checkbox' ? (selectedDetails![field] ? 'Có' : 'Không') : selectedDetails![field] || '---')}
              </p>
          )}
      </div>
    );
  };

  const DetailSelect = ({ label, field, options, keyField, valField }: { label: string, field: keyof NhanVien, options: any[], keyField: string, valField: string }) => {
    const isDisabled = isEditingDetails && field !== 'danghiviec';
    return (
      <div>
          <label className="text-xs text-gray-500 font-medium mb-1 block">{label}</label>
          {isEditingDetails ? (
              <select
                  disabled={isDisabled}
                  className={`w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 ${isDisabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                  value={(detailsForm[field] as string) || ''}
                  onChange={(e) => setDetailsForm({ ...detailsForm, [field]: e.target.value })}
              >
                  <option value="">-- Chọn --</option>
                  {options.map((opt, idx) => (
                      <option key={idx} value={opt[keyField]}>{opt[valField]}</option>
                  ))}
              </select>
          ) : (
              <p className="text-sm font-bold text-blue-700">{selectedDetails![`ten_${field}` as keyof NhanVien] || selectedDetails![field] || '---'}</p>
          )}
      </div>
    );
  };

  return (
    <div className="max-w-[1920px] mx-auto">
      <h2 className="text-2xl font-bold text-red-600 bg-white p-4 mb-6 rounded-lg shadow-sm border border-gray-200">
        Danh sách Nhân sự kết thúc HĐLĐ (Đã nghỉ việc)
      </h2>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
        <div className="flex flex-col gap-2 w-full md:w-auto">
            <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="Tìm kiếm theo Tên hoặc Họ lót..."
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex gap-2 w-full">
                <button onClick={handleExportExcel} className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none whitespace-nowrap">
                    <FileDown className="h-4 w-4 mr-2" /> Xuất danh sách Excel
                </button>
            </div>
        </div>
        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
             <div className="text-sm text-gray-500 whitespace-nowrap">
              Tổng số: <span className="font-bold text-red-600">{filteredData.length}</span> nhân sự đã nghỉ việc
            </div>
            <div className="flex items-center bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2">
                 <ArrowUpDown className="h-4 w-4 text-gray-500 mr-2" />
                 <span className="text-sm text-green-700 mr-2 whitespace-nowrap">Sắp xếp theo:</span>
                 <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="text-sm text-red-900 bg-transparent border-none focus:ring-0 cursor-pointer">
                     <option value="manv">Mã NV</option><option value="holot">Họ lót</option><option value="ten">Tên</option><option value="ten_trinhdo">Trình độ</option><option value="ten_phongban">Khoa/Phòng</option><option value="ten_chucvu">Chức vụ</option><option value="ngaythuviec">Ngày thử việc</option><option value="ngaychinhthuc">Ngày chính thức</option>
                 </select>
            </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow overflow-hidden rounded-lg border border-gray-200 flex flex-col h-[calc(100vh-300px)]">
        <div className="overflow-auto flex-1">
          <table className="min-w-max w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th rowSpan={2} className="px-3 py-3 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50">Thông tin</th>
                <th rowSpan={2} className="px-3 py-3 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50">STT</th>
                <th rowSpan={2} className="px-3 py-3 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50">Mã NV</th>
                <th rowSpan={2} className="px-3 py-3 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50">Họ lót</th>
                <th rowSpan={2} className="px-3 py-3 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50">Tên</th>
                <th rowSpan={2} className="px-3 py-3 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50">Ngày sinh</th>
                <th className="px-3 py-1 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50 border-b">Giới tính</th>
                <th className="px-3 py-1 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50 border-b">Trình độ</th>
                <th className="px-3 py-1 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50 border-b">Khoa / Phòng</th>
                <th className="px-3 py-1 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50 border-b">Chức vụ</th>
                <th className="px-3 py-1 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50 border-b">Chức danh</th>
                <th className="px-3 py-1 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50 border-b">Giảng viên</th>
                <th rowSpan={2} className="px-3 py-3 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50">SĐT</th>
                <th rowSpan={2} className="px-3 py-3 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50">Email</th>
                <th rowSpan={2} className="px-3 py-3 text-left text-xs font-bold text-red-500 tracking-wider bg-gray-50">Số CCCD</th>
              </tr>
              <tr>
                 <th className="px-1 py-1 bg-gray-50"><select onChange={(e) => handleFilterChange('gioitinh', e.target.value)} className="w-full text-xs border-gray-300 rounded focus:ring-blue-500"><option value="">Tất cả</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option></select></th>
                 <th className="px-1 py-1 bg-gray-50"><select onChange={(e) => handleFilterChange('trinhdo', e.target.value)} className="w-full text-xs border-gray-300 rounded focus:ring-blue-500"><option value="">Tất cả</option>{uniqueValues('ten_trinhdo').map((val, idx) => <option key={idx} value={val}>{val}</option>)}</select></th>
                 <th className="px-1 py-1 bg-gray-50"><select onChange={(e) => handleFilterChange('phongban', e.target.value)} className="w-full text-xs border-gray-300 rounded focus:ring-blue-500"><option value="">Tất cả</option>{uniqueValues('ten_phongban').map((val, idx) => <option key={idx} value={val}>{val}</option>)}</select></th>
                 <th className="px-1 py-1 bg-gray-50"><select onChange={(e) => handleFilterChange('chucvu', e.target.value)} className="w-full text-xs border-gray-300 rounded focus:ring-blue-500"><option value="">Tất cả</option>{uniqueValues('ten_chucvu').map((val, idx) => <option key={idx} value={val}>{val}</option>)}</select></th>
                 <th className="px-1 py-1 bg-gray-50"><select onChange={(e) => handleFilterChange('chucdanh', e.target.value)} className="w-full text-xs border-gray-300 rounded focus:ring-blue-500"><option value="">Tất cả</option>{uniqueValues('ten_chucdanh').map((val, idx) => <option key={idx} value={val}>{val}</option>)}</select></th>
                 <th className="px-1 py-1 bg-gray-50"><select onChange={(e) => handleFilterChange('giangvien', e.target.value)} className="w-full text-xs border-gray-300 rounded focus:ring-blue-500"><option value="">Tất cả</option><option value="true">Có</option><option value="false">Không</option></select></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (<tr><td colSpan={19} className="px-6 py-10 text-center text-sm text-gray-500">Đang tải...</td></tr>) : filteredData.length === 0 ? (<tr><td colSpan={19} className="px-6 py-10 text-center text-sm text-gray-500">Không tìm thấy nhân sự đã nghỉ việc.</td></tr>) : (
                filteredData.map((nv) => (
                  <tr key={nv.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-col space-y-1">
                            <button onClick={() => handleOpenContact(nv)} className="text-blue-600 hover:text-blue-800 text-xs border border-blue-200 bg-blue-50 rounded px-2 py-1">Thông tin Liên hệ</button>
                            <button onClick={() => handleOpenDetails(nv)} className="text-xs border rounded px-2 py-1 text-indigo-600 hover:text-indigo-800 border-indigo-200 bg-indigo-50">Thông tin Chi tiết</button>
                            <button onClick={() => handleOpenFamily(nv)} className="text-xs border rounded px-2 py-1 text-amber-600 hover:text-amber-800 border-amber-200 bg-amber-50">Quan hệ Gia đình</button>
                            <button onClick={() => handleOpenEducation(nv)} className="text-xs border rounded px-2 py-1 text-purple-600 hover:text-purple-800 border-purple-200 bg-purple-50">Quá trình Đào tạo</button>
                            <button 
                                onClick={() => handleOpenLecturerProfile(nv)}
                                disabled={!nv.giangvien}
                                className={`text-xs border rounded px-2 py-1 ${nv.giangvien ? 'text-teal-600 hover:text-teal-800 border-teal-200 bg-teal-50' : 'text-gray-400 border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'}`}
                            >Hồ sơ Giảng viên</button>
                        </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-center font-bold text-gray-600">{nv.vithu}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 font-medium">{nv.manv}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{nv.holot}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 font-bold">{nv.ten}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{formatDate(nv.ngaysinh)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{nv.gioitinh ? 'Nam' : 'Nữ'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{nv.ten_trinhdo}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{nv.ten_phongban}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{nv.ten_chucvu}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{nv.ten_chucdanh}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-center">{nv.giangvien ? '✓' : '-'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{nv.sodtdd}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{nv.email}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{nv.socccd}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Info Modal */}
      {selectedDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl overflow-hidden relative max-h-[95vh] flex flex-col">
                <button 
                    onClick={() => setSelectedDetails(null)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 z-10"
                >
                    <span className="sr-only">Close</span>
                    <X className="h-6 w-6" />
                </button>
                
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="flex justify-between items-center mb-6 border-b pb-3">
                        <h3 className="text-2xl font-bold text-indigo-800 flex items-center gap-2">
                            <FileText className="h-7 w-7" />
                            {isEditingDetails ? 'Hiệu chỉnh Trạng thái nghỉ việc' : 'Hồ sơ chi tiết nhân sự (Đã nghỉ việc)'}
                        </h3>
                        <div className="flex gap-2">
                            {!isEditingDetails && (
                                <button 
                                    onClick={handlePrintProfile}
                                    className="flex items-center px-4 py-2 bg-green-50 text-green-700 rounded-md hover:bg-green-100 text-sm font-bold shadow-sm transition-all border border-green-200"
                                >
                                    <Printer className="w-4 h-4 mr-2" />
                                    In hồ sơ (Lý lịch)
                                </button>
                            )}
                            {!isEditingDetails ? (
                                canUpdate && (
                                    <button 
                                        onClick={() => setIsEditingDetails(true)}
                                        className="flex items-center px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 text-sm font-bold shadow-sm transition-all"
                                    >
                                        <Edit2 className="w-4 h-4 mr-2" />
                                        Hiệu chỉnh Hồ sơ
                                    </button>
                                )
                            ) : (
                                <button 
                                    onClick={handleSaveDetails}
                                    disabled={savingDetails}
                                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-bold shadow-md transition-all disabled:opacity-50"
                                >
                                    {savingDetails ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Lưu Hồ sơ
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-3 flex flex-col items-center">
                            <div className="w-full aspect-[3/4] bg-gray-100 rounded-lg border-2 border-indigo-100 overflow-hidden shadow-inner flex items-center justify-center relative group">
                                {detailsForm.hinhanh ? (
                                    <img 
                                        src={getGoogleDriveImageUrl(detailsForm.hinhanh)} 
                                        alt="Avatar" 
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-red-400 text-xs font-medium">No Image</span>
                                )}
                            </div>
                            
                        </div>

                        <div className="lg:col-span-9 space-y-8">
                            <section>
                                <h5 className="flex items-center text-sm font-bold text-red-700 tracking-widest mb-4 border-l-4 border-indigo-500 pl-2">
                                    <User className="w-4 h-4 mr-2" /> Thông tin Cá nhân
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-sm">
                                    <DetailInput label="Họ lót" field="holot" />
                                    <DetailInput label="Tên" field="ten" />
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium mb-1 block">Giới tính</label>
                                        <p className="text-sm font-bold text-blue-700">{selectedDetails.gioitinh ? 'Nam' : 'Nữ'}</p>
                                    </div>
                                    <DetailInput label="Ngày sinh" field="ngaysinh" type="date" />
                                    <DetailInput label="Nơi sinh" field="noisinh" />
                                    <DetailInput label="Nguyên quán" field="nguyenquan" />
                                </div>
                            </section>

                            <section>
                                <h5 className="flex items-center text-sm font-bold text-green-700 tracking-widest mb-4 border-l-4 border-indigo-500 pl-2">
                                    <BriefcaseIcon className="w-4 h-4 mr-2" /> Công tác & Tổ chức
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-indigo-50/50 p-6 rounded-xl border border-indigo-100/50 shadow-sm">
                                    <DetailSelect label="Đơn vị (Khoa/Phòng)" field="phongban" options={phongBanList} keyField="maphongban" valField="giatri" />
                                    <DetailSelect label="Chức vụ" field="chucvu" options={chucVuList} keyField="machucvu" valField="giatri" />
                                    <DetailSelect label="Chức danh" field="chucdanh" options={chucDanhList} keyField="machucdanh" valField="giatri" />
                                    <DetailSelect label="Trình độ" field="trinhdo" options={trinhDoList} keyField="matrinhdo" valField="giatri" />
                                    <DetailInput label="Vị thứ (Sắp xếp)" field="vithu" type="number" />
                                    <DetailInput label="Ngày thử việc" field="ngaythuviec" type="date" />
                                    <DetailInput label="Ngày chính thức" field="ngaychinhthuc" type="date" />
                                    <div>
                                        <label className="text-xs font-bold text-red-600 mb-1 block">Đã nghỉ việc *</label>
                                        {isEditingDetails ? (
                                            <select className="w-full text-sm font-bold text-black bg-white border border-red-300 rounded px-2 py-1 focus:ring-1 focus:ring-red-500 shadow-sm" value={detailsForm.danghiviec ? 'true' : 'false'} onChange={e => setDetailsForm({...detailsForm, danghiviec: e.target.value === 'true'})} >
                                                <option value="false">Không (Đang làm)</option>
                                                <option value="true">Có (Đã nghỉ)</option>
                                            </select>
                                        ) : ( <p className="text-sm font-bold text-red-700 underline">{selectedDetails.danghiviec ? 'Có (Đã nghỉ)' : 'Không (Đang làm)'}</p> )}
                                    </div>
                                    <DetailInput label="Thời gian nghỉ việc" field="thoigiannghiviec" type="date" />
                                </div>
                            </section>

                            <section>
                                <h5 className="flex items-center text-sm font-bold text-red-700 tracking-widest mb-4 border-l-4 border-indigo-500 pl-2">
                                    <CreditCard className="w-4 h-4 mr-2" /> Thông tin Liên hệ
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-amber-50/30 p-6 rounded-xl border border-amber-100 shadow-sm">
                                    <DetailInput label="Số CCCD" field="socccd" />
                                    <DetailInput label="Ngày cấp CCCD" field="ngaycap" type="date" />
                                    <DetailInput label="Nơi cấp CCCD" field="noicap" />
                                    <DetailInput label="Số điện thoại" field="sodtdd" />
                                    <DetailInput label="Email" field="email" type="email" />
                                    <div className="sm:col-span-2">
                                        <DetailInput label="Địa chỉ hiện nay" field="noiohiennay" />
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-100 px-8 py-5 flex justify-between items-center border-t border-gray-200">
                    <span className="text-xs text-blue-400 italic">ID Hệ thống: {selectedDetails.id} | © DAU HR Management System</span>
                    <div className="flex gap-4">
                        {isEditingDetails && (
                            <button 
                                onClick={() => { setIsEditingDetails(false); setDetailsForm({...selectedDetails}); }} 
                                className="px-6 py-2 text-gray-600 font-bold hover:text-gray-800 transition-colors"
                            >
                                Hủy thay đổi
                            </button>
                        )}
                        <button 
                            onClick={() => setSelectedDetails(null)} 
                            className={`px-8 py-2 rounded-md text-sm font-bold shadow-md transition-all transform hover:scale-105 ${isEditingDetails ? 'bg-gray-400 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                            {isEditingDetails ? 'Thoát (Không lưu)' : 'Đóng hồ sơ'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Contact Info Modal */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden relative">
                <button 
                    onClick={() => setSelectedContact(null)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 z-10"
                >
                    <span className="sr-only">Close</span>
                    <X className="h-6 w-6" />
                </button>
                <div className="p-6">
                    <h3 className="text-xl font-bold text-center text-blue-900 mb-6 border-b pb-2 flex items-center justify-center gap-2">
                         <Phone className="h-5 w-5 text-blue-600" />
                         Thông tin Liên hệ
                    </h3>
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-[120px] h-[160px] bg-gray-100 rounded border border-gray-300 overflow-hidden flex items-center justify-center shadow-md relative mb-4">
                            {selectedContact.hinhanh ? (
                                <img src={getGoogleDriveImageUrl(selectedContact.hinhanh)} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-red-400 text-xs font-bold">Error Image</span>
                            )}
                        </div>
                        <h4 className="text-xl font-bold text-gray-900 text-center uppercase">{selectedContact.holot} {selectedContact.ten}</h4>
                        <div className="mt-2 text-center">
                            <p className="text-sm font-bold text-blue-600">{selectedContact.ten_chucvu}</p>
                            <p className="text-sm text-gray-600 font-medium">{selectedContact.ten_phongban}</p>
                        </div>
                    </div>
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="flex items-start">
                            <div className="bg-blue-50 p-2 rounded-full mr-3"><Phone className="h-4 w-4 text-blue-600" /></div>
                            <div><p className="text-[10px] text-red-400 font-bold tracking-wider">Số điện thoại</p><p className="text-sm font-bold text-blue-800">{selectedContact.sodtdd || 'Chưa cập nhật'}</p></div>
                        </div>
                        <div className="flex items-start">
                            <div className="bg-blue-50 p-2 rounded-full mr-3"><Mail className="h-4 w-4 text-blue-600" /></div>
                            <div><p className="text-[10px] text-red-400 font-bold tracking-wider">Email</p><p className="text-sm font-bold text-blue-800 break-all">{selectedContact.email || 'Chưa cập nhật'}</p></div>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 text-center border-t border-gray-100">
                    <button onClick={() => setSelectedContact(null)} className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-bold text-gray-700 hover:bg-gray-50 transition-colors">Đóng</button>
                </div>
            </div>
        </div>
      )}

      {/* Family Member Modal */}
      {selectedFamilyMember && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl overflow-hidden relative max-h-[90vh] flex flex-col">
                <button onClick={() => setSelectedFamilyMember(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 z-10"><X className="h-6 w-6" /></button>
                <div className="p-6 flex-1 overflow-auto">
                    <div className="flex justify-between items-center mb-6 border-b pb-3">
                        <h3 className="text-xl font-bold text-amber-600 flex items-center gap-2"><Users className="h-6 w-6" />Thông tin Quan hệ Gia đình</h3>
                    </div>
                    <div className="flex flex-col md:flex-row items-center mb-8 bg-amber-50 p-4 rounded-lg gap-6">
                        <div className="w-[120px] h-[160px] bg-gray-200 rounded border border-gray-300 overflow-hidden flex items-center justify-center shadow-md relative flex-shrink-0">
                            {selectedFamilyMember.hinhanh ? <img src={getGoogleDriveImageUrl(selectedFamilyMember.hinhanh)} alt="Avatar" className="w-full h-full object-cover" /> : <ImageIcon className="h-12 w-12 text-gray-400" />}
                        </div>
                        <div className="text-center md:text-left flex-1">
                             <h4 className="text-xl font-bold text-red-800">{selectedFamilyMember.holot} {selectedFamilyMember.ten}</h4>
                             <p className="text-sm text-blue-700 font-semibold mt-1">Chức vụ: <span className="text-gray-800">{selectedFamilyMember.ten_chucvu}</span></p>
                             <p className="text-sm text-blue-700 font-semibold">Mã NV: <span className="text-gray-800">{selectedFamilyMember.manv}</span></p>
                        </div>
                    </div>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-amber-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Mối quan hệ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Họ tên người thân</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Năm sinh</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Nghề nghiệp</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loadingModal ? (
                                    <tr><td colSpan={4} className="px-4 py-10 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-amber-600" /></td></tr>
                                ) : familyData.length === 0 ? (
                                    <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500 italic">Chưa có thông tin quan hệ gia đình.</td></tr>
                                ) : (
                                    familyData.map((item) => (
                                        <tr key={item.id} className="hover:bg-amber-50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-blue-700 font-bold">{item.moiquanhe}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.holot} {item.ten}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{item.namsinh}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{item.nghenghiep}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="bg-gray-100 px-6 py-4 text-center border-t border-gray-200"><button onClick={() => setSelectedFamilyMember(null)} className="px-10 py-2 rounded-md border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 shadow-sm transition-all">Đóng cửa sổ</button></div>
            </div>
        </div>
      )}

      {/* Education Modal */}
      {selectedEducationMember && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden relative max-h-[90vh] flex flex-col">
                <button onClick={() => setSelectedEducationMember(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 z-10"><X className="h-6 w-6" /></button>
                <div className="p-6 flex-1 overflow-auto">
                    <div className="flex justify-between items-center mb-6 border-b pb-3">
                        <h3 className="text-xl font-bold text-purple-600 flex items-center gap-2"><GraduationCap className="h-6 w-6" />Quá trình Đào tạo</h3>
                    </div>
                    <div className="flex flex-col md:flex-row items-center mb-8 bg-purple-50 p-4 rounded-lg gap-6">
                        <div className="w-[120px] h-[160px] bg-gray-200 rounded border border-gray-300 overflow-hidden flex items-center justify-center shadow-md relative flex-shrink-0">
                            {selectedEducationMember.hinhanh ? <img src={getGoogleDriveImageUrl(selectedEducationMember.hinhanh)} alt="Avatar" className="w-full h-full object-cover" /> : <ImageIcon className="h-12 w-12 text-gray-400" />}
                        </div>
                        <div className="text-center md:text-left flex-1">
                             <h4 className="text-xl font-bold text-red-800">{selectedEducationMember.holot} {selectedEducationMember.ten}</h4>
                             <p className="text-sm text-blue-700 font-semibold mt-1">Chức vụ: <span className="text-gray-800">{selectedEducationMember.ten_chucvu}</span></p>
                             <p className="text-sm text-blue-700 font-semibold">Mã NV: <span className="text-gray-800">{selectedEducationMember.manv}</span></p>
                        </div>
                    </div>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-purple-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Trình độ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Chuyên ngành</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Cơ sở đào tạo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Năm TN - Xếp loại</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loadingModal ? (
                                    <tr><td colSpan={4} className="px-4 py-10 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-purple-600" /></td></tr>
                                ) : educationData.length === 0 ? (
                                    <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500 italic">Chưa có thông tin quá trình đào tạo.</td></tr>
                                ) : (
                                    educationData.map((item) => (
                                        <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-blue-700 font-medium">{item.trinhdodaotao}</td>
                                            <td className="px-4 py-3 text-sm text-blue-900 font-medium">{item.chuyennganh}</td>
                                            <td className="px-4 py-3 text-sm text-blue-700">{item.cosodaotao}</td>
                                            <td className="px-4 py-3 text-sm text-blue-700 font-semibold">{item.namtnxeploai}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="bg-gray-100 px-6 py-4 text-center border-t border-gray-200"><button onClick={() => setSelectedEducationMember(null)} className="px-10 py-2 rounded-md border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 shadow-sm transition-all">Đóng cửa sổ</button></div>
            </div>
        </div>
      )}

      {/* Lecturer Profile Modal */}
      {selectedLecturer && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden relative max-h-[90vh] flex flex-col">
                  <button onClick={() => setSelectedLecturer(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 z-10"><X className="h-6 w-6" /></button>
                  <div className="p-6 flex-1 overflow-auto">
                      <div className="flex justify-between items-center mb-6 border-b pb-3">
                          <h3 className="text-xl font-bold text-teal-600 flex items-center gap-2"><CalendarIcon className="h-6 w-6" />Hồ sơ Giảng viên</h3>
                      </div>
                      <div className="flex flex-col md:flex-row items-center mb-8 bg-teal-50 p-4 rounded-lg gap-6">
                          <div className="w-[120px] h-[160px] bg-gray-200 rounded border border-gray-300 overflow-hidden flex items-center justify-center shadow-md relative flex-shrink-0">
                              {selectedLecturer.hinhanh ? (
                                  <img src={getGoogleDriveImageUrl(selectedLecturer.hinhanh)} alt="Avatar" className="w-full h-full object-cover" />
                              ) : (
                                  <span className="text-red-400 text-xs font-bold">Error Image</span>
                              )}
                          </div>
                          <div className="text-center md:text-left flex-1">
                              <h4 className="text-xl font-bold text-red-800">{selectedLecturer.holot} {selectedLecturer.ten}</h4>
                              <p className="text-sm text-blue-700 font-semibold mt-1">Chức vụ: <span className="text-gray-800">{selectedLecturer.ten_chucvu}</span></p>
                              <p className="text-sm text-blue-700 font-semibold">Đơn vị: <span className="text-gray-800">{selectedLecturer.ten_phongban}</span></p>
                              <p className="text-sm text-blue-700 font-semibold">Mã NV: <span className="text-gray-800">{selectedLecturer.manv}</span></p>
                          </div>
                      </div>
                      <section>
                          <h5 className="flex items-center text-sm font-bold text-teal-700 tracking-widest mb-4 border-l-4 border-teal-500 pl-2">
                              <CalendarIcon className="w-4 h-4 mr-2" /> Thời gian Quyết định
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-sm">
                              <div>
                                  <label className="text-xs text-red-500 font-medium mb-1 block">Quyết định Trợ giảng</label>
                                  <p className="text-sm font-bold text-blue-700">{formatDate(selectedLecturer.ngayqdtrogiang || '') || '---'}</p>
                              </div>
                              <div>
                                  <label className="text-xs text-red-500 font-medium mb-1 block">Quyết định Giảng viên</label>
                                  <p className="text-sm font-bold text-blue-700">{formatDate(selectedLecturer.ngayqdgiangvien || '') || '---'}</p>
                              </div>
                          </div>
                      </section>
                  </div>
                  <div className="bg-gray-50 px-6 py-4 text-center border-t border-gray-200"><button onClick={() => setSelectedLecturer(null)} className="px-10 py-2 rounded-md border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 shadow-sm transition-all">Đóng cửa sổ</button></div>
              </div>
          </div>
      )}

      {/* Alert Modal */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                {alertType === 'success' ? (
                  <div className="bg-green-100 p-3 rounded-full">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                ) : (
                  <div className="bg-red-100 p-3 rounded-full">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  </div>
                )}
              </div>
              <h3 className={`text-xl font-bold text-center mb-2 ${alertType === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {alertType === 'success' ? 'Thành công' : 'Thông báo lỗi'}
              </h3>
              <p className="text-gray-600 text-center text-sm leading-relaxed">
                {alertMessage}
              </p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-center">
              <button
                onClick={() => setIsAlertModalOpen(false)}
                className={`px-8 py-2 rounded-md text-sm font-bold shadow-sm transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  alertType === 'success' 
                    ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500' 
                    : 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
                }`}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
