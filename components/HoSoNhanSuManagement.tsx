import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase, normalizeKeys } from '../services/supabase';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { NhanVien, TrinhDo, PhongBan, ChucVu, ChucDanh, QuanHeGiaDinh, QuaTrinhDaoTao, DanhMucHDLD, DanhSachKyHDLD, DanhSachCaNhanHTNV, DanhSachCaNhanDHTD, DanhSachCaNhanKhenThuong, RolePermission } from '../types';
import { Search, Info, User, Phone, MapPin, Mail, AlertTriangle, AlertCircle, Filter, FileDown, Pencil, Save, X, Users, GraduationCap, Plus, Trash2, ArrowUpDown, FileText, BadgeCheck, Briefcase as BriefcaseIcon, Calendar as CalendarIcon, CreditCard, Check, Edit2, Loader, Upload, Link as LinkIcon, Copy, FolderOpen, Eye, Image as ImageIcon, Clock, Trophy, Gift, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

const DetailInput = ({ 
  label, 
  field, 
  type = "text", 
  disabled = false,
  isEditing,
  detailsForm,
  setDetailsForm,
  selectedDetails,
  formatDate
}: { 
  label: string, 
  field: keyof NhanVien, 
  type?: string, 
  disabled?: boolean,
  isEditing: boolean,
  detailsForm: Partial<NhanVien>,
  setDetailsForm: (val: any) => void,
  selectedDetails: NhanVien,
  formatDate: (val: string) => string
}) => (
  <div>
      <label className="text-xs text-gray-500 font-medium mb-1 block">{label}</label>
      {isEditing ? (
          <input 
              type={type}
              disabled={disabled}
              className={`w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
              value={(detailsForm[field] as string) || ''}
              onChange={(e) => setDetailsForm({ ...detailsForm, [field]: type === 'checkbox' ? e.target.checked : e.target.value })}
              checked={type === 'checkbox' ? (detailsForm[field] as boolean) : undefined}
          />
      ) : (
          <p className="text-sm font-bold text-blue-700">
              {type === 'date' ? formatDate(selectedDetails[field] as string) : (type === 'checkbox' ? (selectedDetails[field] ? 'Có' : 'Không') : selectedDetails[field] || '---')}
          </p>
      )}
  </div>
);

const DetailSelect = ({ 
  label, 
  field, 
  options, 
  keyField, 
  valField,
  isEditing,
  detailsForm,
  setDetailsForm,
  selectedDetails
}: { 
  label: string, 
  field: keyof NhanVien, 
  options: any[], 
  keyField: string, 
  valField: string,
  isEditing: boolean,
  detailsForm: Partial<NhanVien>,
  setDetailsForm: (val: any) => void,
  selectedDetails: NhanVien
}) => (
  <div>
      <label className="text-xs text-gray-500 font-medium mb-1 block">{label}</label>
      {isEditing ? (
          <select
              className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500"
              value={(detailsForm[field] as string) || ''}
              onChange={(e) => setDetailsForm({ ...detailsForm, [field]: e.target.value })}
          >
              <option value="">-- Chọn --</option>
              {options.map((opt, idx) => (
                  <option key={idx} value={opt[keyField]}>{opt[valField]}</option>
              ))}
          </select>
      ) : (
          <p className="text-sm font-bold text-blue-700">{selectedDetails[`ten_${field}` as keyof NhanVien] || selectedDetails[field] || '---'}</p>
      )}
  </div>
);

interface Notification {
  message: string;
  type: 'error' | 'success';
}

export const HoSoNhanSuManagement: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [nhanVienList, setNhanVienList] = useState<NhanVien[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);
  const [notification, setNotification] = useState<Notification | null>(null);
  
  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);
  
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

  // Permission checks
  const canCreate = useMemo(() => checkPermission(permissions, isAdmin, 'hoSoNhanSu', 'CREATE'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'hoSoNhanSu', 'UPDATE'), [permissions, isAdmin]);
  const canDelete = useMemo(() => checkPermission(permissions, isAdmin, 'hoSoNhanSu', 'DELETE'), [permissions, isAdmin]);

  // Fetch latest permissions if currentUser is provided
  useEffect(() => {
    const fetchLatestPermissions = async () => {
      if (!currentUser?.id) return;
      
      try {
        const { data: rolePermData, error: rolePermError } = await supabase
          .from('RolePermissions')
          .select('*')
          .eq('userid', currentUser.id);

        if (rolePermError) throw rolePermError;

        if (rolePermData) {
          // Get Modules and Permissions for mapping
          const [moduleRes, permRes] = await Promise.all([
            supabase.from('Modules').select('*'),
            supabase.from('Permissions').select('*')
          ]);

          if (moduleRes.error) throw moduleRes.error;
          if (permRes.error) throw permRes.error;

          const mappedPermissions = normalizePermissions(rolePermData || [], moduleRes.data || [], permRes.data || []);
          setPermissions(mappedPermissions);
        }
      } catch (err) {
        setNotification({ message: 'Lỗi tải quyền hạn: ' + (err as Error).message, type: 'error' });
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);

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

  // Add New Member States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<Partial<NhanVien>>({
    manv: '',
    holot: '',
    ten: '',
    gioitinh: true,
    ngaysinh: '',
    noisinh: '',
    noiohiennay: '',
    sodtdd: '',
    email: '',
    socccd: '',
    ngaycap: '',
    noicap: '',
    ngaythuviec: '',
    ngaychinhthuc: '',
    trinhdo: '',
    chucdanh: '',
    phongban: '',
    chucvu: '',
    giangvien: false,
    danghiviec: false,
    hinhanh: '',
    vithu: 100
  });
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isUpdateSuccessModalOpen, setIsUpdateSuccessModalOpen] = useState(false);

  // Image Management (Shared logic for Add/Edit)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageLink, setUploadedImageLink] = useState<string>('');
  const IMAGE_UPLOAD_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwz0w0iDaDgUSQbO_P5g-rdbuhyQc1mDgHYnRGg5Cx8cObS0TwXuE9Fbwq4xo_oY2wY/exec';

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
    const [savingLecturer, setSavingLecturer] = useState(false);

  // Education Entry Form States
  const [isEducationEntryFormOpen, setIsEducationEntryFormOpen] = useState(false);
  const [educationEntryForm, setEducationEntryForm] = useState<Partial<QuaTrinhDaoTao>>({});
  const [isEditingEducationEntry, setIsEditingEducationEntry] = useState(false);
  const [isSavingEducation, setIsSavingEducation] = useState(false);

  // Family Entry Form States
  const [isFamilyEntryFormOpen, setIsFamilyEntryFormOpen] = useState(false);
  const [familyEntryForm, setFamilyEntryForm] = useState<Partial<QuanHeGiaDinh>>({});
  const [isEditingFamilyEntry, setIsEditingFamilyEntry] = useState(false);
  const [isSavingFamily, setIsSavingFamily] = useState(false);

  // Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'warning';
  }>({
    isOpen: false,
    message: '',
    type: 'success'
  });

  const showAlert = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setAlertModal({ isOpen: true, message, type });
  };

  const RELATIONSHIP_OPTIONS = ['Cha', 'Mẹ', 'Anh', 'Chị', 'Em', 'Chồng', 'Vợ', 'Con'];

  const normalizeObjectKeys = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      newObj[key.toLowerCase()] = obj[key];
    });
    return newObj;
  };

  const cleanDateFields = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    const dateFields = ['ngaysinh', 'ngaychinhthuc', 'ngaycap', 'ngaythuviec', 'ngayqdtrogiang', 'ngayqdgiangvien', 'thoigiannghiviec'];
    const cleaned = { ...obj };
    dateFields.forEach(field => {
      if (cleaned.hasOwnProperty(field) && (cleaned[field] === '' || cleaned[field] === undefined)) {
        cleaned[field] = null;
      }
    });
    return cleaned;
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tdRes, pbRes, cvRes, cdRes, nvRes, hdRes] = await Promise.all([
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('DanhMucChucVu').select('*'),
        supabase.from('DanhMucChucDanh').select('*'),
        supabase.from('DanhSachNhanVien').select('*').eq('danghiviec', false).order('vithu', { ascending: true }),
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
      setNotification({ message: "Lỗi hệ thống: " + (error as Error).message, type: 'error' });
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
      setNotification({ message: "Lỗi tải HĐLĐ: " + (err as Error).message, type: 'error' });
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
      setNotification({ message: "Lỗi tải quá trình công tác: " + (err as Error).message, type: 'error' });
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
      setNotification({ message: "Lỗi tải danh hiệu thi đua: " + (err as Error).message, type: 'error' });
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
      setNotification({ message: "Lỗi tải khen thưởng: " + (err as Error).message, type: 'error' });
    } finally {
      setLoadingCommendations(false);
    }
  };

  const generateNewMaNV = async () => {
    try {
      const { data, error } = await supabase
        .from('DanhSachNhanVien')
        .select('manv');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const numbers = data
          .map(item => parseInt(item.manv))
          .filter(num => !isNaN(num));
        
        if (numbers.length > 0) {
          const maxNum = Math.max(...numbers);
          return (maxNum + 1).toString();
        }
      }
      return "1001";
    } catch (err) {
      setNotification({ message: "Lỗi tạo MaNV: " + (err as Error).message, type: 'error' });
      return "1001";
    }
  };

  const handleOpenAddModal = async () => {
    const newMaNV = await generateNewMaNV();
    setAddForm({
      manv: newMaNV,
      holot: '',
      ten: '',
      gioitinh: true,
      ngaysinh: '',
      noisinh: '',
      noiohiennay: '',
      sodtdd: '',
      email: '',
      socccd: '',
      ngaycap: '',
      noicap: '',
      ngaythuviec: '',
      ngaychinhthuc: '',
      ngayqdtrogiang: '',
      ngayqdgiangvien: '',
      thoigiannghiviec: '',
      trinhdo: trinhDoList[0]?.matrinhdo || '',
      chucdanh: chucDanhList[0]?.machucdanh || '',
      phongban: phongBanList[0]?.maphongban || '',
      chucvu: chucVuList[0]?.machucvu || '',
      giangvien: false,
      danghiviec: false,
      hinhanh: '',
      vithu: nhanVienList.length + 1
    });
    setImagePreview(null);
    setUploadedImageLink('');
    setIsAddModalOpen(true);
  };

  const handleSaveNewMember = async () => {
    if (!addForm.manv || !addForm.holot || !addForm.ten) {
      showAlert("Vui lòng nhập đầy đủ Mã NV, Họ lót và Tên nhân sự.", 'warning');
      return;
    }

    setIsSavingNew(true);
    try {
      let finalAddForm = { ...addForm };
      
      // Nếu có chọn file ảnh mới, thực hiện tải lên trước khi lưu
      if (selectedImageFile) {
        try {
          const uploadedUrl = await handleImageUploadToGAS(true, selectedImageFile);
          if (uploadedUrl) {
            finalAddForm.hinhanh = uploadedUrl;
          }
        } catch (uploadErr) {
          showAlert("Lỗi tải ảnh lên Drive: " + (uploadErr as Error).message, 'error');
          setIsSavingNew(false);
          return;
        }
      }

      // Đảm bảo các trường ảo không được gửi lên Supabase
      const { ten_trinhdo, ten_phongban, ten_chucvu, ten_chucdanh, ...insertPayloadRaw } = finalAddForm as any;
      const insertPayload = cleanDateFields(insertPayloadRaw);

      const { error } = await supabase
        .from('DanhSachNhanVien')
        .insert([insertPayload]);

      if (error) {
        setNotification({ message: "Lỗi lưu nhân viên mới: " + error.message, type: 'error' });
        throw error;
      }

      setIsAddModalOpen(false);
      setSelectedImageFile(null); // Reset file sau khi lưu
      setImagePreview(null);
      fetchData();
      setIsSuccessModalOpen(true);
    } catch (err: any) {
      showAlert("Lỗi khi thêm mới: " + err.message, 'error');
    } finally {
      setIsSavingNew(false);
    }
  };

  const handleOpenDetails = (nv: NhanVien) => {
    closeAllModals();
    setSelectedDetails(nv);
    setDetailsForm({ ...nv });
    setIsEditingDetails(false);
    setImagePreview(null);
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
      let finalImageData = detailsForm.hinhanh || selectedDetails.hinhanh;
      
      // Nếu có chọn file ảnh mới, thực hiện tải lên trước khi lưu
      if (selectedImageFile) {
        try {
          const uploadedUrl = await handleImageUploadToGAS(false, selectedImageFile);
          if (uploadedUrl) {
            finalImageData = uploadedUrl;
          }
        } catch (uploadErr) {
          showAlert("Lỗi tải ảnh lên Drive: " + (uploadErr as Error).message, 'error');
          setSavingDetails(false);
          return;
        }
      }
      
      // Loại bỏ các trường ảo và các trường không nên update (như id, manv nếu manv là PK)
      const { id, manv, ten_trinhdo, ten_phongban, ten_chucvu, ten_chucdanh, ...updatePayloadRaw } = detailsForm as any;
      const updatePayload = cleanDateFields(updatePayloadRaw);
      
      // Đảm bảo payload gửi lên có chứa hinhanh đúng
      updatePayload.hinhanh = finalImageData;

      console.log("Đang cập nhật Supabase với payload:", updatePayload);

      const { error } = await supabase
        .from('DanhSachNhanVien')
        .update(updatePayload)
        .eq('manv', selectedDetails.manv);

      if (error) {
        setNotification({ message: "Lỗi cập nhật nhân viên: " + error.message, type: 'error' });
        throw error;
      }

      setIsUpdateSuccessModalOpen(true);
      setIsEditingDetails(false);
      
      // Cập nhật lại state local để hiển thị ngay lập tức
      const findInCatalog = (catalog: any[], code: string, keyField: string, valField: string) => {
        if (!code || !catalog) return code;
        const found = catalog.find(item => String(item[keyField]) === String(code));
        return found ? found[valField] : code;
      };

      const updatedDetails = {
        ...normalizeObjectKeys(updatePayload),
        manv: selectedDetails.manv, // Giữ lại manv
        id: selectedDetails.id,     // Giữ lại id
        ten_trinhdo: findInCatalog(trinhDoList, updatePayload.trinhdo, 'matrinhdo', 'giatri'),
        ten_phongban: findInCatalog(phongBanList, updatePayload.phongban, 'maphongban', 'giatri'),
        ten_chucvu: findInCatalog(chucVuList, updatePayload.chucvu, 'machucvu', 'giatri'),
        ten_chucdanh: findInCatalog(chucDanhList, updatePayload.chucdanh, 'machucdanh', 'giatri'),
      } as NhanVien;

      setSelectedDetails(updatedDetails);
      setDetailsForm(updatedDetails);
      
      // Reset file đã chọn sau khi lưu thành công
      setSelectedImageFile(null);
      setImagePreview(null);
      
      fetchData(); 
    } catch (err: any) {
      showAlert("Lỗi cập nhật: " + err.message, 'error');
    } finally {
      setSavingDetails(false);
    }
  };

  const closeAllModals = () => {
    setSelectedContact(null);
    setSelectedDetails(null);
    setIsAddModalOpen(false);
    setIsEditingDetails(false);
    setImagePreview(null);
    setSelectedImageFile(null);
    setSelectedLecturer(null);
    setSelectedFamilyMember(null);
    setSelectedEducationMember(null);
    setIsEducationEntryFormOpen(false);
    setIsFamilyEntryFormOpen(false);
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

    const handleSaveLecturerProfile = async () => {
        if (!selectedLecturer) return;
        setSavingLecturer(true);
        try {
            const updatesRaw = {
                ngayqdtrogiang: lecturerForm?.ngayqdtrogiang || '',
                ngayqdgiangvien: lecturerForm?.ngayqdgiangvien || ''
            } as Partial<NhanVien>;
            const updates = cleanDateFields(updatesRaw);

            const { error } = await supabase
                .from('DanhSachNhanVien')
                .update(updates)
                .eq('manv', selectedLecturer.manv);

            if (error) throw error;

            showAlert('Cập nhật hồ sơ giảng viên thành công!', 'success');
            setSelectedLecturer({ ...selectedLecturer, ...updates } as NhanVien);
            setIsEditingLecturer(false);
            fetchData();
        } catch (err: any) {
            showAlert('Lỗi cập nhật: ' + err.message, 'error');
        } finally {
            setSavingLecturer(false);
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
    setIsFamilyEntryFormOpen(false);
    fetchFamilyData(nv.manv);
  };

  const handleOpenAddFamilyEntry = () => {
    setIsEditingFamilyEntry(false);
    setFamilyEntryForm({
        manv: selectedFamilyMember?.manv,
        moiquanhe: RELATIONSHIP_OPTIONS[0],
        holot: '',
        ten: '',
        namsinh: '',
        nghenghiep: '',
        noicongtac: ''
    });
    setIsFamilyEntryFormOpen(true);
  };

  const handleOpenEditFamilyEntry = (item: QuanHeGiaDinh) => {
    setIsEditingFamilyEntry(true);
    setFamilyEntryForm({ ...item });
    setIsFamilyEntryFormOpen(true);
  };

  const handleSaveFamilyEntry = async () => {
    if (!familyEntryForm.moiquanhe || !familyEntryForm.ten) {
        showAlert("Vui lòng nhập đầy đủ Mối quan hệ và Tên người thân.", 'warning');
        return;
    }

    setIsSavingFamily(true);
    try {
        if (isEditingFamilyEntry && familyEntryForm.id) {
            const { id, ...updates } = familyEntryForm;
            const { error } = await supabase.from('DanhSachQuanHeGiaDinh').update(updates).eq('id', id);
            if (error) throw error;
            showAlert("Cập nhật quan hệ gia đình thành công!", 'success');
        } else {
            const { error } = await supabase.from('DanhSachQuanHeGiaDinh').insert([familyEntryForm]);
            if (error) throw error;
            showAlert("Thêm mới quan hệ gia đình thành công!", 'success');
        }
        setIsFamilyEntryFormOpen(false);
        if (selectedFamilyMember) fetchFamilyData(selectedFamilyMember.manv);
    } catch (err: any) {
        showAlert("Lỗi khi lưu thông tin gia đình: " + err.message, 'error');
    } finally {
        setIsSavingFamily(false);
    }
  };

  const handleDeleteFamilyEntry = async (id: number) => {
    // Sử dụng window.confirm cho đến khi có confirm modal chung
    if (!window.confirm("Bạn có chắc chắn muốn xóa thông tin người thân này không?")) return;
    try {
        const { error } = await supabase.from('DanhSachQuanHeGiaDinh').delete().eq('id', id);
        if (error) throw error;
        showAlert("Đã xóa thông tin người thân.", 'success');
        if (selectedFamilyMember) fetchFamilyData(selectedFamilyMember.manv);
    } catch (err: any) {
        showAlert("Lỗi khi xóa: " + err.message, 'error');
    }
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
    setIsEducationEntryFormOpen(false);
    fetchEducationData(nv.manv);
  };

  const handleOpenAddEducationEntry = () => {
    setIsEditingEducationEntry(false);
    setEducationEntryForm({
        manv: selectedEducationMember?.manv,
        trinhdodaotao: trinhDoList[0]?.giatri || '',
        chuyennganh: '',
        cosodaotao: '',
        namtnxeploai: ''
    });
    setIsEducationEntryFormOpen(true);
  };

  const handleOpenEditEducationEntry = (item: QuaTrinhDaoTao) => {
    setIsEditingEducationEntry(true);
    setEducationEntryForm({ ...item });
    setIsEducationEntryFormOpen(true);
  };

  const handleSaveEducationEntry = async () => {
    if (!educationEntryForm.trinhdodaotao || !educationEntryForm.chuyennganh) {
        showAlert("Vui lòng nhập đầy đủ Trình độ và Chuyên ngành đào tạo.", 'warning');
        return;
    }

    setIsSavingEducation(true);
    try {
        if (isEditingEducationEntry && educationEntryForm.id) {
            const { id, ...updates } = educationEntryForm;
            const { error } = await supabase.from('DanhSachQuaTrinhDaoTao').update(updates).eq('id', id);
            if (error) throw error;
            showAlert("Cập nhật quá trình đào tạo thành công!", 'success');
        } else {
            const { error } = await supabase.from('DanhSachQuaTrinhDaoTao').insert([educationEntryForm]);
            if (error) throw error;
            showAlert("Thêm mới quá trình đào tạo thành công!", 'success');
        }
        setIsEducationEntryFormOpen(false);
        if (selectedEducationMember) fetchEducationData(selectedEducationMember.manv);
    } catch (err: any) {
        showAlert("Lỗi khi lưu thông tin đào tạo: " + err.message, 'error');
    } finally {
        setIsSavingEducation(false);
    }
  };

  const handleDeleteEducationEntry = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa thông tin đào tạo này không?")) return;
    try {
        const { error } = await supabase.from('DanhSachQuaTrinhDaoTao').delete().eq('id', id);
        if (error) throw error;
        showAlert("Đã xóa thông tin đào tạo.", 'success');
        if (selectedEducationMember) fetchEducationData(selectedEducationMember.manv);
    } catch (err: any) {
        showAlert("Lỗi khi xóa: " + err.message, 'error');
    }
  };

  const getGoogleDriveImageUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      const idMatch = url.match(/[-\w]{25,}/);
      if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[0]}`;
    }
    return url;
  };

  const DEFAULT_AVATAR = "https://via.placeholder.com/150?text=No+Image";

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement;
    if (target.src !== DEFAULT_AVATAR) {
      target.src = DEFAULT_AVATAR;
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
  };

  const handleImageUploadToGAS = async (isAdd: boolean, fileToUpload?: File) => {
    const file = fileToUpload || selectedImageFile;
    if (!file) return null;
    
    const manv = isAdd ? addForm.manv : selectedDetails?.manv;
    if (!manv) return null;

    setUploadingImage(true);
    try {
        const base64DataFull = await readFileAsBase64(file);
        let base64Content = base64DataFull.includes(',') ? base64DataFull.split(',')[1] : base64DataFull;
        base64Content = base64Content.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
        const padding = base64Content.length % 4;
        if (padding > 0) base64Content += '='.repeat(4 - padding);

        const extension = file.name.split('.').pop();
        const newFilename = `${manv}.${extension}`;

        const response = await fetch(`${IMAGE_UPLOAD_SCRIPT_URL}?nocache=${Date.now()}`, {
            method: 'POST',
            mode: 'cors',
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ 
                file: base64Content, 
                filename: newFilename, 
                mimeType: file.type,
                folderId: "11mSKRfumZJY7Gil98b0mwLNCk_45uNu_" 
            })
        }).catch(err => {
            if (err.message.includes('Failed to fetch')) {
                throw new Error("Không thể kết nối tới máy chủ tải ảnh. Vui lòng kiểm tra kết nối mạng hoặc tắt các trình chặn quảng cáo (AdBlock).");
            }
            throw err;
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Máy chủ tải ảnh phản hồi lỗi ${response.status}. Vui lòng kiểm tra lại cấu hình Google Script.`);
        }
        
        const data = await response.json();

        if (data.result === 'success') {
            let finalUrl = data.url;
            const idMatch = finalUrl.match(/[-\w]{25,}/);
            if (idMatch) finalUrl = `https://drive.google.com/file/d/${idMatch[0]}/view?usp=drivesdk`;
            
            setUploadedImageLink(finalUrl);
            return finalUrl;
        } else throw new Error(data.error || "Upload failed");
    } catch (err: any) {
        setNotification({ message: "Lỗi upload: " + err.message, type: 'error' });
        throw err;
    } finally {
        setUploadingImage(false);
    }
  };

  const handlePreviewImage = (url: string) => {
    if (!url) {
        showAlert("Vui lòng nhập hoặc tải link ảnh trước.", 'warning');
        return;
    }
    setImagePreview(getGoogleDriveImageUrl(url));
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
    XLSX.writeFile(wb, "DanhSachNhanSu_DAU.xlsx");
  };

  const handlePrintProfile = () => {
    if (!selectedDetails) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showAlert("Vui lòng cho phép trình duyệt mở tab mới để in hồ sơ.", 'warning');
      return;
    }

    const now = new Date();
    const printTimeStr = `In vào lúc ${now.getHours()} giờ ${now.getMinutes()} phút ${now.getSeconds()} giây ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
    const reportDateStr = `Đà Nẵng, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8"/>
        <title>Lý Lịch Trích Ngang - ${selectedDetails.holot} ${selectedDetails.ten}</title>
        <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet"/>
        <style>
          @page { size: A4; margin: 20mm; }
          @media print {
            body { background: white; color: black; -webkit-print-color-adjust: exact; }
            .no-print { display: none; }
            footer { position: fixed; bottom: 0; width: 100%; border-top: 0.5px solid #ccc; padding-top: 5px; font-size: 10px; font-style: italic; display: flex; justify-content: space-between; }
            .page-number:after { content: "Trang " counter(page); }
          }
          body { font-family: 'Lora', 'Times New Roman', serif; font-size: 13px; line-height: 1.5; color: #333; margin: 0; padding: 0; }
          .container { width: 100%; }
          .header-title { text-align: center; margin-bottom: 25px; }
          .header-title h1 { text-transform: uppercase; font-size: 20px; margin: 0; padding: 0; letter-spacing: 1px; }
          .header-title p { font-style: italic; margin-top: 5px; font-size: 12px; }
          .section-title { font-weight: bold; text-transform: uppercase; border-bottom: 1.5px solid #333; margin: 20px 0 10px 0; font-size: 14px; padding-bottom: 2px; }
          .profile-grid { display: flex; gap: 20px; margin-bottom: 20px; }
          .profile-photo { width: 120px; height: 160px; border: 1px solid #333; overflow: hidden; flex-shrink: 0; }
          .profile-photo img { width: 100%; height: 100%; object-cover: cover; grayscale(100%); }
          .profile-info { flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .info-item { display: flex; }
          .info-label { font-weight: bold; width: 120px; flex-shrink: 0; }
          .info-value { flex: 1; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; text-align: center; }
          .text-center { text-align: center; }
          .report-footer { margin-top: 50px; display: flex; flex-direction: column; align-items: flex-end; }
          .report-footer .location-date { font-style: italic; margin-bottom: 10px; }
          .report-footer .department { font-weight: bold; text-transform: uppercase; width: 300px; text-align: center; }
          footer { font-size: 10px; color: #666; display: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-title">
            <h1>Lý Lịch Trích Ngang</h1>
            <p>Mã số CBGVNV: <strong>${selectedDetails.manv}</strong></p>
          </div>

          <div class="section-title">1. Thông tin cơ bản</div>
          <div class="profile-grid">
            <div class="profile-photo">
              <img src="${getGoogleDriveImageUrl(selectedDetails.hinhanh)}" alt="Photo" onerror="this.src='https://via.placeholder.com/150?text=No+Image'" />
            </div>
            <div class="profile-info">
              <div class="info-item" style="grid-column: span 2;"><span class="info-label">Họ và Tên:</span><span class="info-value"><strong>${selectedDetails.holot} ${selectedDetails.ten}</strong></span></div>
              <div class="info-item"><span class="info-label">Giới tính:</span><span class="info-value">${selectedDetails.gioitinh ? 'Nam' : 'Nữ'}</span></div>
              <div class="info-item"><span class="info-label">Ngày sinh:</span><span class="info-value">${formatDate(selectedDetails.ngaysinh)}</span></div>
              <div class="info-item" style="grid-column: span 2;"><span class="info-label">Nơi sinh:</span><span class="info-value">${selectedDetails.noisinh}</span></div>
              <div class="info-item"><span class="info-label">Số CMND/CCCD:</span><span class="info-value">${selectedDetails.socccd || '---'}</span></div>
              <div class="info-item"><span class="info-label">Ngày cấp:</span><span class="info-value">${formatDate(selectedDetails.ngaycap) || '---'}</span></div>
              <div class="info-item" style="grid-column: span 2;"><span class="info-label">Email:</span><span class="info-value">${selectedDetails.email}</span></div>
              <div class="info-item"><span class="info-label">Trình độ:</span><span class="info-value">${selectedDetails.ten_trinhdo}</span></div>
              <div class="info-item"><span class="info-label">Chức danh:</span><span class="info-value">${selectedDetails.ten_chucdanh}</span></div>
              <div class="info-item"><span class="info-label">Chức vụ:</span><span class="info-value">${selectedDetails.ten_chucvu}</span></div>
              <div class="info-item"><span class="info-label">Đơn vị:</span><span class="info-value">${selectedDetails.ten_phongban}</span></div>
            </div>
          </div>

          <div class="section-title">2. Quan hệ gia đình</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25%">Họ và Tên</th>
                <th style="width: 15%">Năm sinh</th>
                <th style="width: 15%">Mối quan hệ</th>
                <th style="width: 20%">Nghề nghiệp</th>
                <th>Nơi công tác</th>
              </tr>
            </thead>
            <tbody>
              ${familyData.length > 0 ? familyData.map(f => `
                <tr>
                  <td>${f.holot} ${f.ten}</td>
                  <td class="text-center">${f.namsinh}</td>
                  <td class="text-center">${f.moiquanhe}</td>
                  <td>${f.nghenghiep}</td>
                  <td>${f.noicongtac}</td>
                </tr>
              `).join('') : '<tr><td colspan="5" class="text-center">Chưa cập nhật dữ liệu</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">3. Quá trình đào tạo</div>
          <table>
            <thead>
              <tr>
                <th style="width: 20%">Trình độ Đào tạo</th>
                <th style="width: 30%">Chuyên ngành Đào tạo</th>
                <th style="width: 20%">Năm Tốt nghiệp - Loại</th>
                <th>Cơ sở Đào tạo</th>
              </tr>
            </thead>
            <tbody>
              ${educationData.length > 0 ? educationData.map(e => `
                <tr>
                  <td>${e.trinhdodaotao}</td>
                  <td>${e.chuyennganh}</td>
                  <td class="text-center">${e.namtnxeploai}</td>
                  <td>${e.cosodaotao}</td>
                </tr>
              `).join('') : '<tr><td colspan="4" class="text-center">Chưa cập nhật dữ liệu</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">4. Diễn biến hợp đồng lao động</div>
          <table>
            <thead>
              <tr>
                <th style="width: 15%">Số HĐLĐ</th>
                <th style="width: 45%">Loại Hợp đồng Lao động</th>
                <th style="width: 20%">Từ ngày</th>
                <th style="width: 20%">Đến ngày</th>
              </tr>
            </thead>
            <tbody>
              ${staffContracts.length > 0 ? staffContracts.map(c => {
                const hdType = danhMucHDLD.find(h => String(h.maso) === String(c.loaihd));
                return `
                <tr>
                  <td class="text-center">${c.sohd}</td>
                  <td>${hdType ? hdType.tenhdld : c.loaihd}</td>
                  <td class="text-center">${formatDate(c.tungay)}</td>
                  <td class="text-center">${String(c.loaihd) === '7' ? '' : formatDate(c.denngay)}</td>
                </tr>
                `;
              }).join('') : '<tr><td colspan="4" class="text-center">Chưa cập nhật dữ liệu</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">5. Công tác và tổ chức</div>
          <table>
            <thead>
              <tr>
                <th>Ngày thử việc</th>
                <th>Ngày chính thức</th>
                <th>Ngày QĐ Trợ giảng</th>
                <th>Ngày QĐ Giảng viên</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center">${formatDate(selectedDetails.ngaythuviec) || '---'}</td>
                <td class="text-center">${formatDate(selectedDetails.ngaychinhthuc) || '---'}</td>
                <td class="text-center">${formatDate(selectedDetails.ngayqdtrogiang) || '---'}</td>
                <td class="text-center">${formatDate(selectedDetails.ngayqdgiangvien) || '---'}</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">6. Quá trình công tác</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25%">Năm học xếp loại</th>
                <th style="width: 50%">Mức độ Hoàn thành nhiệm vụ</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${staffWorkHistory.length > 0 ? staffWorkHistory.map(w => `
                <tr>
                  <td class="text-center">${w.namhoc}</td>
                  <td class="text-center">${w.mucdohtnv}</td>
                  <td></td>
                </tr>
              `).join('') : '<tr><td colspan="3" class="text-center">Chưa có dữ liệu đánh giá</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">7. Thi đua và khen thưởng</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25%">Năm học</th>
                <th style="width: 50%">Danh hiệu thi đua / Hình thức khen thưởng</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${staffAwards.map(a => `
                <tr>
                  <td class="text-center">${a.namhoc}</td>
                  <td>Danh hiệu: ${a.danhhieuthidua}</td>
                  <td></td>
                </tr>
              `).join('')}
              ${staffCommendations.map(k => `
                <tr>
                  <td class="text-center">${k.namhoc}</td>
                  <td>Khen thưởng: ${k.hinhthuckhenthuong}</td>
                  <td></td>
                </tr>
              `).join('')}
              ${(staffAwards.length === 0 && staffCommendations.length === 0) ? '<tr><td colspan="3" class="text-center">Chưa có dữ liệu khen thưởng</td></tr>' : ''}
            </tbody>
          </table>

          <div class="report-footer">
            <div class="location-date">${reportDateStr}</div>
            <div class="department">Phòng Tổ chức – Hành chính</div>
          </div>
        </div>

        <footer style="display: flex; justify-content: space-between; position: fixed; bottom: 10mm; left: 20mm; right: 20mm; border-top: 0.5px solid #ccc; padding-top: 5px;">
          <div class="print-time">${printTimeStr}</div>
          <div class="page-count">Trang 1 / 1</div>
        </footer>

        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
              window.onafterprint = function() { window.close(); };
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const uniqueValues = (key: keyof NhanVien | 'ten_trinhdo' | 'ten_phongban' | 'ten_chucvu' | 'ten_chucdanh') => {
    return Array.from(new Set(nhanVienList.map(item => item[key as keyof NhanVien] as string))).filter(Boolean).sort();
  };



  return (
    <div className="max-w-[1920px] mx-auto">
      <h2 className="text-2xl font-bold text-blue-600 bg-white p-4 mb-6 rounded-lg shadow-sm border border-gray-200">
        Danh sách Nhân sự
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
                {canCreate && (
                    <button onClick={handleOpenAddModal} className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none whitespace-nowrap">
                        <Plus className="h-4 w-4 mr-2" /> Thêm mới hồ sơ
                    </button>
                )}
            </div>
        </div>
        <div className="flex flex-col items-end gap-2 w-full md:w-auto">
             <div className="text-sm text-gray-500 whitespace-nowrap">
              Tổng số: <span className="font-bold text-blue-600">{filteredData.length}</span> nhân sự
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
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (<tr><td colSpan={19} className="px-6 py-10 text-center text-sm text-gray-500">Đang tải...</td></tr>) : filteredData.length === 0 ? (<tr><td colSpan={19} className="px-6 py-10 text-center text-sm text-gray-500">Không tìm thấy nhân sự phù hợp.</td></tr>) : (
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

      {/* Add New Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl overflow-hidden relative max-h-[95vh] flex flex-col">
            <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
               <h3 className="text-xl font-bold flex items-center gap-2 tracking-wide">
                  <Plus className="h-6 w-6" /> Thêm mới Hồ sơ Nhân sự
               </h3>
               <button onClick={closeAllModals} className="text-white hover:text-blue-100"><X className="h-7 w-7" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
               {/* Region 1: Thông tin cơ bản */}
               <section className="mb-8">
                  <h5 className="text-sm font-bold text-blue-700 tracking-widest mb-4 border-l-4 border-red-600 pl-3">Thông tin cơ bản</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-xl border border-gray-200">
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Mã NV (Tự động)</label>
                        <input type="text" readOnly value={addForm.manv} className="w-full bg-gray-200 text-sm font-bold border border-gray-300 rounded px-3 py-2 cursor-not-allowed text-black" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500  mb-1 block">Họ lót *</label>
                        <input type="text" value={addForm.holot} onChange={e => setAddForm({...addForm, holot: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500" placeholder="Nhập họ lót" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Tên *</label>
                        <input type="text" value={addForm.ten} onChange={e => setAddForm({...addForm, ten: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500" placeholder="Nhập tên" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Giới tính</label>
                        <select value={addForm.gioitinh ? 'true' : 'false'} onChange={e => setAddForm({...addForm, gioitinh: e.target.value === 'true'})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2">
                           <option value="true">Nam</option><option value="false">Nữ</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Ngày sinh</label>
                        <input type="date" value={addForm.ngaysinh} onChange={e => setAddForm({...addForm, ngaysinh: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Nơi sinh</label>
                        <input type="text" value={addForm.noisinh} onChange={e => setAddForm({...addForm, noisinh: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2" placeholder="Nhập nơi sinh" />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="text-xs font-bold text-red-500 mb-1 block">Nơi ở hiện nay</label>
                        <input type="text" value={addForm.noiohiennay} onChange={e => setAddForm({...addForm, noiohiennay: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2" placeholder="Nhập địa chỉ" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Số ĐT Di động</label>
                        <input type="text" value={addForm.sodtdd} onChange={e => setAddForm({...addForm, sodtdd: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2" placeholder="Nhập SĐT" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Email </label>
                        <input type="email" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2" placeholder="Nhập email" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Số CCCD</label>
                        <input type="text" value={addForm.socccd} onChange={e => setAddForm({...addForm, socccd: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2" placeholder="Nhập CCCD" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Ngày cấp CCCD</label>
                        <input type="date" value={addForm.ngaycap} onChange={e => setAddForm({...addForm, ngaycap: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Nơi cấp CCCD</label>
                        <input type="text" value={addForm.noicap} onChange={e => setAddForm({...addForm, noicap: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Ngày thử việc</label>
                        <input type="date" value={addForm.ngaythuviec} onChange={e => setAddForm({...addForm, ngaythuviec: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Ngày chính thức</label>
                        <input type="date" value={addForm.ngaychinhthuc} onChange={e => setAddForm({...addForm, ngaychinhthuc: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Trình độ Đào tạo</label>
                        <select value={addForm.trinhdo} onChange={e => setAddForm({...addForm, trinhdo: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2">
                           {trinhDoList.map(td => <option key={td.matrinhdo} value={td.matrinhdo}>{td.giatri}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Chức danh</label>
                        <select value={addForm.chucdanh} onChange={e => setAddForm({...addForm, chucdanh: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2">
                           {chucDanhList.map(cd => <option key={cd.machucdanh} value={cd.machucdanh}>{cd.giatri}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Khoa / Phòng</label>
                        <select value={addForm.phongban} onChange={e => setAddForm({...addForm, phongban: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2">
                           {phongBanList.map(pb => <option key={pb.maphongban} value={pb.maphongban}>{pb.giatri}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Chức vụ</label>
                        <select value={addForm.chucvu} onChange={e => setAddForm({...addForm, chucvu: e.target.value})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2">
                           {chucVuList.map(cv => <option key={cv.machucvu} value={cv.machucvu}>{cv.giatri}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Loại hình nhân sự</label>
                        <select value={addForm.giangvien ? 'true' : 'false'} onChange={e => setAddForm({...addForm, giangvien: e.target.value === 'true'})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2">
                           <option value="true">Giảng viên</option><option value="false">CBNV</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-red-500 mb-1 block">Trạng thái làm việc</label>
                        <select value={addForm.danghiviec ? 'true' : 'false'} onChange={e => setAddForm({...addForm, danghiviec: e.target.value === 'true'})} className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2">
                           <option value="false">Không (Đang làm)</option><option value="true">Có (Đã nghỉ)</option>
                        </select>
                      </div>
                  </div>
               </section>

               {/* Region 2: Hình ảnh nhân sự */}
               <section>
                  <h5 className="text-sm font-bold text-blue-700 uppercase tracking-widest mb-4 border-l-4 border-blue-600 pl-3">Hình ảnh Nhân sự</h5>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 bg-blue-50 p-6 rounded-xl border border-blue-100">
                      {/* Khung ảnh 3x4 */}
                      <div className="md:col-span-3 flex flex-col items-center">
                          <div className="w-[150px] h-[200px] bg-white border-2 border-dashed border-gray-300 rounded overflow-hidden flex items-center justify-center shadow-inner relative">
                              {imagePreview ? (
                                  <img 
                                      src={imagePreview} 
                                      alt="Preview" 
                                      className="w-full h-full object-cover" 
                                      onError={handleImageError}
                                  />
                              ) : (
                                  <ImageIcon className="h-12 w-12 text-gray-300" />
                              )}
                              {uploadingImage && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                      <Loader className="h-8 w-8 text-white animate-spin" />
                                  </div>
                              )}
                          </div>
                          <span className="text-[10px] text-gray-400 mt-2">Kích thước 3x4</span>
                      </div>

                      {/* Controls */}
                      <div className="md:col-span-9 space-y-4">
                          <div>
                              <label className="text-xs font-bold text-blue-500 mb-1 block">Link ảnh (Google Drive)</label>
                              <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    value={addForm.hinhanh} 
                                    onChange={e => setAddForm({...addForm, hinhanh: e.target.value})} 
                                    className="flex-1 text-sm bg-white border border-gray-300 rounded px-3 py-2 font-mono text-black" 
                                    placeholder="https://drive.google.com/..." 
                                  />
                                  <button onClick={() => handlePreviewImage(addForm.hinhanh || '')} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded hover:bg-blue-700 transition-colors">
                                      <Eye className="h-4 w-4" /> Xem ảnh
                                  </button>
                              </div>
                          </div>

                          <div className="flex flex-wrap gap-3 p-4 bg-white border border-blue-200 rounded-lg shadow-sm">
                               <div className="w-full mb-2">
                                   <p className="text-xs font-bold text-red-600">Công cụ tải ảnh lên Drive:</p>
                               </div>
                               <input 
                                  type="file" 
                                  accept="image/*" 
                                  onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                          setSelectedImageFile(file);
                                          const reader = new FileReader();
                                          reader.onload = (ev) => setImagePreview(ev.target?.result as string);
                                          reader.readAsDataURL(file);
                                      }
                                  }} 
                                  className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                               />
                               <p className="text-[10px] text-blue-600 italic w-full">
                                   * Ảnh mới sẽ được tải lên khi bạn nhấn "Lưu hồ sơ".
                               </p>
                               <button onClick={() => window.open('https://drive.google.com/drive/u/0/folders/11mSKRfumZJY7Gil98b0mwLNCk_45uNu_', '_blank')} className="flex items-center gap-1 px-4 py-2 bg-gray-100 text-blue-700 text-xs font-bold rounded hover:bg-gray-200">
                                  <FolderOpen className="h-3 w-3" /> Mở Folder Drive
                               </button>
                          </div>
                      </div>
                  </div>
               </section>
            </div>

            <div className="bg-gray-100 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                <button onClick={closeAllModals} className="px-6 py-2 bg-white text-gray-700 font-bold border border-gray-300 rounded shadow-sm hover:bg-gray-50 transition-colors">Hủy bỏ</button>
                <button 
                   onClick={handleSaveNewMember} 
                   disabled={isSavingNew}
                   className="px-8 py-2 bg-blue-600 text-white font-bold rounded shadow-md hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                   {isSavingNew ? <Loader className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Lưu hồ sơ mới
                </button>
            </div>
          </div>
        </div>
      )}

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
                            {isEditingDetails ? 'Hiệu chỉnh Hồ sơ Nhân sự' : 'Hồ sơ chi tiết nhân sự'}
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
                                        Hiệu chỉnh hồ sơ
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
                                {imagePreview ? (
                                    <img 
                                        src={imagePreview} 
                                        alt="Preview" 
                                        className="w-full h-full object-cover" 
                                        onError={handleImageError}
                                    />
                                ) : detailsForm.hinhanh ? (
                                    <img 
                                        src={getGoogleDriveImageUrl(detailsForm.hinhanh)} 
                                        alt="Avatar" 
                                        className="w-full h-full object-cover"
                                        onError={handleImageError}
                                    />
                                ) : (
                                    <span className="text-red-400 text-xs font-medium">No Image</span>
                                )}
                            </div>
                            
                            <div className="w-full mt-4 space-y-3">
                                <label className="text-[10px] font-bold text-gray-500 block mb-1">Link Ảnh (Google Drive)</label>
                                <div className="flex gap-1">
                                    <input 
                                        type="text" 
                                        value={detailsForm.hinhanh || ''} 
                                        onChange={e => setDetailsForm({...detailsForm, hinhanh: e.target.value})}
                                        readOnly={!isEditingDetails}
                                        className={`flex-1 text-[10px] font-mono p-2 border rounded ${isEditingDetails ? 'bg-white border-blue-300 text-black' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                                    />
                                    <button onClick={() => handlePreviewImage(detailsForm.hinhanh || '')} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"><Eye className="h-4 w-4" /></button>
                                </div>
                                
                                {isEditingDetails && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                                        <p className="text-[10px] font-bold text-amber-800 uppercase">Chọn ảnh mới:</p>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    setSelectedImageFile(file);
                                                    const reader = new FileReader();
                                                    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
                                                    reader.readAsDataURL(file);
                                                }
                                            }} 
                                            className="text-[10px] w-full" 
                                        />
                                        <p className="text-[9px] text-amber-600 italic">
                                            * Ảnh mới sẽ được tải lên khi bạn nhấn "Lưu hồ sơ".
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="lg:col-span-9 space-y-8">
                            <section>
                                <h5 className="flex items-center text-sm font-bold text-red-700 tracking-widest mb-4 border-l-4 border-indigo-500 pl-2">
                                    <User className="w-4 h-4 mr-2" /> Thông tin Cá nhân
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-sm">
                                    <DetailInput label="Họ lót" field="holot" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <DetailInput label="Tên" field="ten" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium mb-1 block">Giới tính</label>
                                        {isEditingDetails ? (
                                            <select className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded p-1" value={detailsForm.gioitinh ? 'true' : 'false'} onChange={e => setDetailsForm({...detailsForm, gioitinh: e.target.value === 'true'})}>
                                                <option value="true">Nam</option><option value="false">Nữ</option>
                                            </select>
                                        ) : (<p className="text-sm font-bold text-blue-700">{selectedDetails.gioitinh ? 'Nam' : 'Nữ'}</p>)}
                                    </div>
                                    <DetailInput label="Ngày sinh" field="ngaysinh" type="date" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <DetailInput label="Nơi sinh" field="noisinh" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <DetailInput label="Nguyên quán" field="nguyenquan" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                </div>
                            </section>

                            <section>
                                <h5 className="flex items-center text-sm font-bold text-green-700 tracking-widest mb-4 border-l-4 border-indigo-500 pl-2">
                                    <BriefcaseIcon className="w-4 h-4 mr-2" /> Công tác & Tổ chức
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-indigo-50/50 p-6 rounded-xl border border-indigo-100/50 shadow-sm">
                                    <DetailSelect label="Đơn vị (Khoa/Phòng)" field="phongban" options={phongBanList} keyField="maphongban" valField="giatri" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} />
                                    <DetailSelect label="Chức vụ" field="chucvu" options={chucVuList} keyField="machucvu" valField="giatri" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} />
                                    <DetailSelect label="Chức danh" field="chucdanh" options={chucDanhList} keyField="machucdanh" valField="giatri" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} />
                                    <DetailSelect label="Trình độ" field="trinhdo" options={trinhDoList} keyField="matrinhdo" valField="giatri" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} />
                                    <DetailInput label="Vị thứ (Sắp xếp)" field="vithu" type="number" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <DetailInput label="Ngày thử việc" field="ngaythuviec" type="date" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <DetailInput label="Ngày chính thức" field="ngaychinhthuc" type="date" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <div>
                                        <label className="text-xs font-bold text-red-600 mb-1 block">Đã nghỉ việc</label>
                                        {isEditingDetails ? (
                                            <select className="w-full text-sm font-bold text-red-600 bg-white border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-red-500 shadow-sm" value={detailsForm.danghiviec ? 'true' : 'false'} onChange={e => setDetailsForm({...detailsForm, danghiviec: e.target.value === 'true'})} >
                                                <option value="false">Không (False)</option>
                                                <option value="true">Có (True)</option>
                                            </select>
                                        ) : ( <p className={`text-sm font-bold ${selectedDetails.danghiviec ? 'text-red-600 underline' : 'text-blue-700'}`}>{selectedDetails.danghiviec ? 'Có (Đã nghỉ)' : 'Không (Đang làm)'}</p> )}
                                    </div>
                                    <DetailInput label="Thời gian nghỉ việc" field="thoigiannghiviec" type="date" disabled={!detailsForm.danghiviec} isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                </div>
                            </section>

                            <section>
                                <h5 className="flex items-center text-sm font-bold text-blue-700 tracking-widest mb-4 border-l-4 border-indigo-500 pl-2">
                                    <CalendarIcon className="w-4 h-4 mr-2" /> Hồ sơ Giảng viên
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-sm">
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium mb-1 block">Chức danh công tác</label>
                                        {isEditingDetails ? (
                                            <select className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500" value={detailsForm.giangvien ? 'true' : 'false'} onChange={e => setDetailsForm({...detailsForm, giangvien: e.target.value === 'true'})} >
                                                <option value="true">Giảng viên</option><option value="false">CBNV</option>
                                            </select>
                                        ) : ( <p className="text-sm font-bold text-blue-700">{selectedDetails.giangvien ? 'Giảng viên' : 'CBNV'}</p> )}
                                    </div>
                                    <DetailInput label="Ngày QĐ Trợ giảng" field="ngayqdtrogiang" type="date" disabled={!detailsForm.giangvien} isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <DetailInput label="Ngày QĐ Giảng viên" field="ngayqdgiangvien" type="date" disabled={!detailsForm.giangvien} isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                </div>
                            </section>

                            <section>
                                <h5 className="flex items-center text-sm font-bold text-red-700 tracking-widest mb-4 border-l-4 border-indigo-500 pl-2">
                                    <CreditCard className="w-4 h-4 mr-2" /> Thông tin Liên hệ
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-amber-50/30 p-6 rounded-xl border border-amber-100 shadow-sm">
                                    <DetailInput label="Số CCCD" field="socccd" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <DetailInput label="Ngày cấp CCCD" field="ngaycap" type="date" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <DetailInput label="Nơi cấp CCCD" field="noicap" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <DetailInput label="Số điện thoại" field="sodtdd" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <DetailInput label="Email" field="email" type="email" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    <div className="sm:col-span-2">
                                        <DetailInput label="Địa chỉ hiện nay" field="noiohiennay" isEditing={isEditingDetails} detailsForm={detailsForm} setDetailsForm={setDetailsForm} selectedDetails={selectedDetails!} formatDate={formatDate} />
                                    </div>
                                </div>
                            </section>
                        </div>
                        
                        {/* New Labor Contract List Section */}
                        <div className="lg:col-span-12 mt-8">
                            <section>
                                <h5 className="flex items-center text-sm font-bold text-red-700 tracking-widest mb-4 border-l-4 border-indigo-500 pl-2">
                                    <FileText className="w-4 h-4 mr-2" /> Danh sách HĐLĐ
                                </h5>
                                <div className="overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">STT</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">Số hiệu</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">Loại Hợp đồng</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">Từ ngày</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">Đến ngày</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {loadingContracts ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-10 text-center">
                                                        <div className="flex justify-center items-center gap-2 text-indigo-600">
                                                            <Loader className="w-5 h-5 animate-spin" />
                                                            <span className="text-sm font-bold">Đang tải danh sách hợp đồng...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : staffContracts.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500 italic">
                                                        Không tìm thấy lịch sử hợp đồng lao động của nhân sự này.
                                                    </td>
                                                </tr>
                                            ) : (
                                                staffContracts.map((item, idx) => {
                                                    const hdType = danhMucHDLD.find(h => String(h.maso) === String(item.loaihd));
                                                    return (
                                                        <tr key={item.idhopdong} className="hover:bg-blue-50/50 transition-colors">
                                                            <td className="px-4 py-3 text-sm text-gray-500 font-normal">{idx + 1}</td>
                                                            <td className="px-4 py-3 text-sm text-blue-900 font-normal">{item.sohd}</td>
                                                            <td className="px-4 py-3 text-sm text-gray-700 font-normal">
                                                                {hdType ? hdType.tenhdld : (item.loaihd || '---')}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-gray-700 font-normal">
                                                                {formatDate(item.tungay)}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm text-red-600 font-normal">
                                                                {String(item.loaihd) === '7' ? '' : formatDate(item.denngay || '')}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>

                        {/* New Work History Section */}
                        <div className="lg:col-span-12 mt-8">
                            <section>
                                <h5 className="flex items-center text-sm font-bold text-red-700 tracking-widest mb-4 border-l-4 border-indigo-500 pl-2">
                                    <BriefcaseIcon className="w-4 h-4 mr-2" /> Quá trình công tác
                                </h5>
                                <div className="overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">STT</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">Năm học</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">Mức độ Hoàn thành nhiệm vụ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {loadingWorkHistory ? (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-10 text-center">
                                                        <div className="flex justify-center items-center gap-2 text-indigo-600">
                                                            <Loader className="w-5 h-5 animate-spin" />
                                                            <span className="text-sm font-bold">Đang tải quá trình công tác...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : staffWorkHistory.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500 italic">
                                                        Không tìm thấy lịch sử quá trình công tác của nhân sự này.
                                                    </td>
                                                </tr>
                                            ) : (
                                                staffWorkHistory.map((item, idx) => (
                                                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-500 font-normal">{idx + 1}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-700 font-normal">{item.namhoc}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-700 font-normal">{item.mucdohtnv}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>

                        {/* New Awards History Section */}
                        <div className="lg:col-span-12 mt-8">
                            <section>
                                <h5 className="flex items-center text-sm font-bold text-red-700 tracking-widest mb-4 border-l-4 border-indigo-500 pl-2">
                                    <Trophy className="w-4 h-4 mr-2" /> Danh hiệu Thi đua
                                </h5>
                                <div className="overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">STT</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">Năm học</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">Danh hiệu Thi đua</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {loadingAwards ? (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-10 text-center">
                                                        <div className="flex justify-center items-center gap-2 text-indigo-600">
                                                            <Loader className="w-5 h-5 animate-spin" />
                                                            <span className="text-sm font-bold">Đang tải danh hiệu thi đua...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : staffAwards.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500 italic">
                                                        Không tìm thấy lịch sử danh hiệu thi đua của nhân sự này.
                                                    </td>
                                                </tr>
                                            ) : (
                                                staffAwards.map((item, idx) => (
                                                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-500 font-normal">{idx + 1}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-700 font-normal">{item.namhoc}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-700 font-normal">{item.danhhieuthidua}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>

                        {/* New Commendations History Section */}
                        <div className="lg:col-span-12 mt-8">
                            <section>
                                <h5 className="flex items-center text-sm font-bold text-red-700 tracking-widest mb-4 border-l-4 border-indigo-500 pl-2">
                                    <Gift className="w-4 h-4 mr-2" /> Khen thưởng
                                </h5>
                                <div className="overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">STT</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">Năm học</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-red-600">Hình thức Khen thưởng</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {loadingCommendations ? (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-10 text-center">
                                                        <div className="flex justify-center items-center gap-2 text-indigo-600">
                                                            <Loader className="w-5 h-5 animate-spin" />
                                                            <span className="text-sm font-bold">Đang tải khen thưởng...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : staffCommendations.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500 italic">
                                                        Không tìm thấy lịch sử khen thưởng của nhân sự này.
                                                    </td>
                                                </tr>
                                            ) : (
                                                staffCommendations.map((item, idx) => (
                                                    <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                                                        <td className="px-4 py-3 text-sm text-gray-500 font-normal">{idx + 1}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-700 font-normal">{item.namhoc}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-700 font-normal">{item.hinhthuckhenthuong}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
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
       {/* Footer Info */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <p className="text-[10px] text-red-400 font-bold tracking-widest italic flex items-center gap-2">
          <Clock className="h-3 w-3" /> Hệ thống DAU HR Management | Danh sách nhân sự
        </p>
      </div>


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
                                <img 
                                    src={getGoogleDriveImageUrl(selectedContact.hinhanh)} 
                                    alt="Avatar" 
                                    className="w-full h-full object-cover"
                                    onError={handleImageError}
                                />
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
                        {canCreate && <button onClick={handleOpenAddFamilyEntry} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-md hover:bg-amber-700 shadow-sm transition-all"><Plus className="w-4 h-4" /> Thêm mới quan hệ gia đình</button>}
                    </div>

                    <div className="flex flex-col md:flex-row items-center mb-8 bg-amber-50 p-4 rounded-lg gap-6">
                        <div className="w-[120px] h-[160px] bg-gray-200 rounded border border-gray-300 overflow-hidden flex items-center justify-center shadow-md relative flex-shrink-0">
                            {selectedFamilyMember.hinhanh ? (
                                <img 
                                    src={getGoogleDriveImageUrl(selectedFamilyMember.hinhanh)} 
                                    alt="Avatar" 
                                    className="w-full h-full object-cover" 
                                    onError={handleImageError}
                                />
                            ) : <ImageIcon className="h-12 w-12 text-gray-400" />}
                        </div>
                        <div className="text-center md:text-left flex-1">
                             <h4 className="text-xl font-bold text-red-800">{selectedFamilyMember.holot} {selectedFamilyMember.ten}</h4>
                             <p className="text-sm text-blue-700 font-semibold mt-1">Chức vụ: <span className="text-gray-800">{selectedFamilyMember.ten_chucvu}</span></p>
                             <p className="text-sm text-blue-700 font-semibold">Mã NV: <span className="text-gray-800">{selectedFamilyMember.manv}</span></p>
                        </div>
                    </div>

                    {/* Entry Form (Conditional) */}
                    {isFamilyEntryFormOpen && (
                        <div className="mb-8 p-6 bg-white border-2 border-amber-200 rounded-xl shadow-lg animate-fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h5 className="text-md font-bold text-amber-800 tracking-wide">{isEditingFamilyEntry ? 'Hiệu chỉnh thông tin người thân' : 'Thêm thông tin người thân mới'}</h5>
                                <button onClick={() => setIsFamilyEntryFormOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-red-500 mb-1 block">Mối quan hệ</label>
                                    <select 
                                        value={familyEntryForm.moiquanhe} 
                                        onChange={e => setFamilyEntryForm({...familyEntryForm, moiquanhe: e.target.value})}
                                        className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-amber-500 shadow-sm"
                                    >
                                        <option value="">-- Chọn --</option>
                                        {RELATIONSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-red-500 mb-1 block">Họ lót</label>
                                    <input 
                                        type="text" 
                                        value={familyEntryForm.holot || ''} 
                                        onChange={e => setFamilyEntryForm({...familyEntryForm, holot: e.target.value})}
                                        className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-amber-500 shadow-sm"
                                        placeholder="Nhập họ lót"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-red-500 mb-1 block">Tên</label>
                                    <input 
                                        type="text" 
                                        value={familyEntryForm.ten || ''} 
                                        onChange={e => setFamilyEntryForm({...familyEntryForm, ten: e.target.value})}
                                        className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-amber-500 shadow-sm"
                                        placeholder="Nhập tên"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-red-500 mb-1 block">Năm sinh</label>
                                    <input 
                                        type="text" 
                                        value={familyEntryForm.namsinh || ''} 
                                        onChange={e => setFamilyEntryForm({...familyEntryForm, namsinh: e.target.value})}
                                        className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-amber-500 shadow-sm"
                                        placeholder="Nhập năm sinh"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-xs font-bold text-red-500 mb-1 block">Nghề nghiệp</label>
                                    <input 
                                        type="text" 
                                        value={familyEntryForm.nghenghiep || ''} 
                                        onChange={e => setFamilyEntryForm({...familyEntryForm, nghenghiep: e.target.value})}
                                        className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-amber-500 shadow-sm"
                                        placeholder="Nhập nghề nghiệp"
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <label className="text-xs font-bold text-red-500 mb-1 block">Nơi công tác</label>
                                    <input 
                                        type="text" 
                                        value={familyEntryForm.noicongtac || ''} 
                                        onChange={e => setFamilyEntryForm({...familyEntryForm, noicongtac: e.target.value})}
                                        className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-amber-500 shadow-sm"
                                        placeholder="Nhập nơi công tác"
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button onClick={() => setIsFamilyEntryFormOpen(false)} className="px-5 py-2 bg-gray-100 text-gray-700 font-bold rounded shadow-sm hover:bg-gray-200 transition-colors">Hủy bỏ</button>
                                <button 
                                    onClick={handleSaveFamilyEntry} 
                                    disabled={isSavingFamily}
                                    className="px-6 py-2 bg-green-600 text-white font-bold rounded shadow-md hover:bg-green-700 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSavingFamily ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Lưu thông tin
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-amber-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Mối quan hệ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Họ tên người thân</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Năm sinh</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Nghề nghiệp</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-red-700 tracking-wider">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loadingModal ? (
                                    <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-amber-600" /></td></tr>
                                ) : familyData.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500 italic">Chưa có thông tin quan hệ gia đình.</td></tr>
                                ) : (
                                    familyData.map((item) => (
                                        <tr key={item.id} className="hover:bg-amber-50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-blue-700 font-bold">{item.moiquanhe}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.holot} {item.ten}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{item.namsinh}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700">{item.nghenghiep}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-3">
                                                    {canUpdate && <button onClick={() => handleOpenEditFamilyEntry(item)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded transition-colors" title="Hiệu chỉnh"><Edit2 className="w-4 h-4" /></button>}
                                                    {canDelete && <button onClick={() => handleDeleteFamilyEntry(item.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors" title="Xóa"><Trash2 className="w-4 h-4" /></button>}
                                                </div>
                                            </td>
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
                        {canCreate && <button onClick={handleOpenAddEducationEntry} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-md hover:bg-purple-700 shadow-sm transition-all"><Plus className="w-4 h-4" /> Thêm mới thông tin đào tạo</button>}
                    </div>

                    <div className="flex flex-col md:flex-row items-center mb-8 bg-purple-50 p-4 rounded-lg gap-6">
                        <div className="w-[120px] h-[160px] bg-gray-200 rounded border border-gray-300 overflow-hidden flex items-center justify-center shadow-md relative flex-shrink-0">
                            {selectedEducationMember.hinhanh ? (
                                <img 
                                    src={getGoogleDriveImageUrl(selectedEducationMember.hinhanh)} 
                                    alt="Avatar" 
                                    className="w-full h-full object-cover" 
                                    onError={handleImageError}
                                />
                            ) : <ImageIcon className="h-12 w-12 text-gray-400" />}
                        </div>
                        <div className="text-center md:text-left flex-1">
                             <h4 className="text-xl font-bold text-red-800">{selectedEducationMember.holot} {selectedEducationMember.ten}</h4>
                             <p className="text-sm text-blue-700 font-semibold mt-1">Chức vụ: <span className="text-gray-800">{selectedEducationMember.ten_chucvu}</span></p>
                             <p className="text-sm text-blue-700 font-semibold">Mã NV: <span className="text-gray-800">{selectedEducationMember.manv}</span></p>
                        </div>
                    </div>

                    {/* Entry Form (Conditional) */}
                    {isEducationEntryFormOpen && (
                        <div className="mb-8 p-6 bg-white border-2 border-purple-200 rounded-xl shadow-lg animate-fade-in">
                            <div className="flex justify-between items-center mb-4">
                                <h5 className="text-md font-bold text-purple-800 tracking-wide">{isEditingEducationEntry ? 'Hiệu chỉnh thông tin đào tạo' : 'Thêm thông tin đào tạo mới'}</h5>
                                <button onClick={() => setIsEducationEntryFormOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-red-500 mb-1 block ">Trình độ đào tạo</label>
                                    <select 
                                        value={educationEntryForm.trinhdodaotao} 
                                        onChange={e => setEducationEntryForm({...educationEntryForm, trinhdodaotao: e.target.value})}
                                        className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-purple-500 shadow-sm"
                                    >
                                        <option value="">-- Chọn trình độ --</option>
                                        {trinhDoList.map(td => <option key={td.id} value={td.giatri}>{td.giatri}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-red-500 mb-1 block ">Chuyên ngành</label>
                                    <input 
                                        type="text" 
                                        value={educationEntryForm.chuyennganh || ''} 
                                        onChange={e => setEducationEntryForm({...educationEntryForm, chuyennganh: e.target.value})}
                                        className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-purple-500 shadow-sm"
                                        placeholder="Nhập chuyên ngành"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-red-500 mb-1 block">Cơ sở đào tạo</label>
                                    <input 
                                        type="text" 
                                        value={educationEntryForm.cosodaotao || ''} 
                                        onChange={e => setEducationEntryForm({...educationEntryForm, cosodaotao: e.target.value})}
                                        className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-purple-500 shadow-sm"
                                        placeholder="Nhập cơ sở đào tạo"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-red-500 mb-1 block ">Năm TN - Xếp loại</label>
                                    <input 
                                        type="text" 
                                        value={educationEntryForm.namtnxeploai || ''} 
                                        onChange={e => setEducationEntryForm({...educationEntryForm, namtnxeploai: e.target.value})}
                                        className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-purple-500 shadow-sm"
                                        placeholder="VD: 2020 - Khá"
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button onClick={() => setIsEducationEntryFormOpen(false)} className="px-5 py-2 bg-gray-100 text-gray-700 font-bold rounded shadow-sm hover:bg-gray-200 transition-colors">Hủy bỏ</button>
                                <button 
                                    onClick={handleSaveEducationEntry} 
                                    disabled={isSavingEducation}
                                    className="px-6 py-2 bg-green-600 text-white font-bold rounded shadow-md hover:bg-green-700 transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSavingEducation ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Lưu thông tin
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-purple-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Trình độ</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Chuyên ngành</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Cơ sở đào tạo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-red-700 tracking-wider">Năm TN - Xếp loại</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold text-red-700 tracking-wider">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loadingModal ? (
                                    <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-purple-600" /></td></tr>
                                ) : educationData.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500 italic">Chưa có thông tin quá trình đào tạo.</td></tr>
                                ) : (
                                    educationData.map((item) => (
                                        <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-blue-700 font-medium">{item.trinhdodaotao}</td>
                                            <td className="px-4 py-3 text-sm text-blue-900 font-medium">{item.chuyennganh}</td>
                                            <td className="px-4 py-3 text-sm text-blue-700">{item.cosodaotao}</td>
                                            <td className="px-4 py-3 text-sm text-blue-700 font-semibold">{item.namtnxeploai}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center gap-3">
                                                    {canUpdate && <button onClick={() => handleOpenEditEducationEntry(item)} className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded transition-colors" title="Hiệu chỉnh"><Edit2 className="w-4 h-4" /></button>}
                                                    {canDelete && <button onClick={() => handleDeleteEducationEntry(item.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors" title="Xóa"><Trash2 className="w-4 h-4" /></button>}
                                                </div>
                                            </td>
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
                                <div className="flex gap-2">
                                    {canUpdate && (!isEditingLecturer ? (
                                        <button onClick={() => setIsEditingLecturer(true)} className="flex items-center px-4 py-2 bg-teal-100 text-teal-700 rounded-md hover:bg-teal-200 text-sm font-bold shadow-sm transition-all">
                                            <Edit2 className="w-4 h-4 mr-2" /> Hiệu chỉnh hồ sơ
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={handleSaveLecturerProfile}
                                            disabled={savingLecturer}
                                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-bold shadow-md transition-all disabled:opacity-50"
                                        >
                                            {savingLecturer ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="h-4 w-4" />} Lưu hồ sơ
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row items-center mb-8 bg-teal-50 p-4 rounded-lg gap-6">
                                <div className="w-[120px] h-[160px] bg-gray-200 rounded border border-gray-300 overflow-hidden flex items-center justify-center shadow-md relative flex-shrink-0">
                                    {selectedLecturer.hinhanh ? (
                                        <img 
                                            src={getGoogleDriveImageUrl(selectedLecturer.hinhanh)} 
                                            alt="Avatar" 
                                            className="w-full h-full object-cover"
                                            onError={handleImageError}
                                        />
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
                                        {isEditingLecturer ? (
                                            <input 
                                                type="date" 
                                                className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-teal-500"
                                                value={lecturerForm?.ngayqdtrogiang || ''}
                                                onChange={(e) => setLecturerForm({ ...lecturerForm, ngayqdtrogiang: e.target.value })}
                                            />
                                        ) : (
                                            <p className="text-sm font-bold text-blue-700">{formatDate(selectedLecturer.ngayqdtrogiang || '') || '---'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs text-red-500 font-medium mb-1 block">Quyết định Giảng viên</label>
                                        {isEditingLecturer ? (
                                            <input 
                                                type="date" 
                                                className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-teal-500"
                                                value={lecturerForm?.ngayqdgiangvien || ''}
                                                onChange={(e) => setLecturerForm({ ...lecturerForm, ngayqdgiangvien: e.target.value })}
                                            />
                                        ) : (
                                            <p className="text-sm font-bold text-blue-700">{formatDate(selectedLecturer.ngayqdgiangvien || '') || '---'}</p>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                        <div className="bg-gray-100 px-6 py-4 text-center border-t border-gray-200"><button onClick={() => setSelectedLecturer(null)} className="px-10 py-2 rounded-md border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50 shadow-sm transition-all">Đóng cửa sổ</button></div>
                    </div>
                </div>
            )}

            <AnimatePresence>
                {notification && (
                    <motion.div 
                        initial={{ opacity: 0, y: -50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -50, x: '-50%' }}
                        className="fixed top-8 left-1/2 z-[100] w-full max-w-md px-4"
                    >
                        <div className={`p-4 rounded-2xl shadow-2xl flex items-center gap-3 border ${
                            notification.type === 'error' ? "bg-red-50 border-red-100 text-red-800" : "bg-green-50 border-green-100 text-green-800"
                        }`}>
                            {notification.type === 'error' ? (
                                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                            ) : (
                                <div className="w-5 h-5 bg-green-500 rounded-full" />
                            )}
                            <p className="text-sm font-medium flex-1">{notification.message}</p>
                            <button 
                                onClick={() => setNotification(null)}
                                className="p-1 hover:bg-black/5 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            <AnimatePresence>
                {isSuccessModalOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8 text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Thành công!</h3>
                                <p className="text-gray-600 mb-8">Đã lưu hồ sơ nhân sự mới thành công !</p>
                                <button 
                                    onClick={() => setIsSuccessModalOpen(false)}
                                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                >
                                    Đã hiểu
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isUpdateSuccessModalOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check className="w-8 h-8 text-green-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Thành công!</h3>
                                <p className="text-gray-600 mb-8">Đã cập nhập hồ sơ nhân sự thành công !</p>
                                <button 
                                    onClick={() => setIsUpdateSuccessModalOpen(false)}
                                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                >
                                    Đã hiểu
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Alert Modal */}
            <AnimatePresence>
                {alertModal.isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-8 text-center">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                                    alertModal.type === 'success' ? 'bg-green-100' : 
                                    alertModal.type === 'warning' ? 'bg-yellow-100' : 'bg-red-100'
                                }`}>
                                    {alertModal.type === 'success' ? (
                                        <Check className="w-8 h-8 text-green-600" />
                                    ) : alertModal.type === 'warning' ? (
                                        <AlertTriangle className="w-8 h-8 text-yellow-600" />
                                    ) : (
                                        <AlertCircle className="w-8 h-8 text-red-600" />
                                    )}
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    {alertModal.type === 'success' ? 'Thành công' : 
                                     alertModal.type === 'warning' ? 'Thông báo' : 'Lỗi'}
                                </h3>
                                <p className="text-gray-600 mb-8">{alertModal.message}</p>
                                <button
                                    onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                                    className={`w-full py-3 text-white font-bold rounded-xl transition-colors shadow-lg ${
                                        alertModal.type === 'success' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 
                                        alertModal.type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700 shadow-yellow-200' : 
                                        'bg-red-600 hover:bg-red-700 shadow-red-200'
                                    }`}
                                >
                                    Đóng
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

    </div>
  );
};