import React, { useState, useEffect, useMemo } from 'react';
import { supabase, normalizeKeys } from '../services/supabase';
import { checkPermission } from '../services/permissionService';
import { 
  NhanVien, 
  UserSession, 
  TrinhDo, 
  PhongBan, 
  ChucVu, 
  ChucDanh, 
  DanhMucHDLD, 
  DanhSachCaNhanHTNV, 
  DanhSachCaNhanDHTD, 
  DanhSachCaNhanKhenThuong,
  QuanHeGiaDinh,
  QuaTrinhDaoTao,
  RolePermission
} from '../types';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  Building2, 
  Shield, 
  FileText, 
  Printer, 
  Edit2, 
  Save, 
  X, 
  Loader, 
  Upload, 
  Eye, 
  FolderOpen,
  Calendar,
  Trophy,
  Gift,
  BadgeCheck,
  Clock,
  Plus,
  Trash2,
  Pencil,
  History,
  Users,
  CheckCircle2,
  AlertTriangle,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const SectionHeader = ({ icon: Icon, title, colorClass = "text-indigo-800" }: { icon: any, title: string, colorClass?: string }) => (
  <h5 className={`flex items-center text-sm font-bold ${colorClass} tracking-widest mb-4 border-l-4 border-indigo-500 pl-2`}>
    <Icon className="w-4 h-4 mr-2" /> {title}
  </h5>
);

const InfoItem = ({ 
  label, 
  value, 
  field, 
  editable = false,
  isEditing = false,
  editValue = '',
  onUpdate
}: { 
  label: string, 
  value: any, 
  field?: keyof NhanVien, 
  editable?: boolean,
  isEditing?: boolean,
  editValue?: string,
  onUpdate?: (val: string) => void
}) => (
  <div className="space-y-1">
    <label className="text-xs text-gray-500 font-medium block">{label}</label>
    {isEditing && editable && field ? (
      <input 
        type="text"
        className="w-full text-sm font-bold text-black bg-white border border-blue-300 rounded p-1 focus:ring-1 focus:ring-blue-500"
        value={editValue}
        onChange={(e) => onUpdate && onUpdate(e.target.value)}
      />
    ) : (
      <p className="text-sm font-bold text-blue-800">{value || '---'}</p>
    )}
  </div>
);

interface UserProfileProps {
  session: UserSession;
  permissions?: RolePermission[];
  isAdmin?: boolean;
}

const RELATIONSHIP_OPTIONS = ['Cha', 'Mẹ', 'Anh', 'Chị', 'Em', 'Chồng', 'Vợ', 'Con'];

export const UserProfile: React.FC<UserProfileProps> = ({ session, permissions, isAdmin }) => {
  const [profile, setProfile] = useState<NhanVien | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<NhanVien>>({});
  const [saving, setSaving] = useState(false);

  // Related Data States
  const [staffContracts, setStaffContracts] = useState<any[]>([]);
  const [staffWorkHistory, setStaffWorkHistory] = useState<DanhSachCaNhanHTNV[]>([]);
  const [staffAwards, setStaffAwards] = useState<DanhSachCaNhanDHTD[]>([]);
  const [staffCommendations, setStaffCommendations] = useState<DanhSachCaNhanKhenThuong[]>([]);
  const [familyData, setFamilyData] = useState<QuanHeGiaDinh[]>([]);
  const [educationData, setEducationData] = useState<QuaTrinhDaoTao[]>([]);
  const [danhMucHDLD, setDanhMucHDLD] = useState<DanhMucHDLD[]>([]);

  // Modal states for Family and Education
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [isEducationModalOpen, setIsEducationModalOpen] = useState(false);
  const [isFamilyEntryFormOpen, setIsFamilyEntryFormOpen] = useState(false);
  const [isEducationEntryFormOpen, setIsEducationEntryFormOpen] = useState(false);
  const [isEditingFamilyEntry, setIsEditingFamilyEntry] = useState(false);
  const [isEditingEducationEntry, setIsEditingEducationEntry] = useState(false);
  const [familyEntryForm, setFamilyEntryForm] = useState<Partial<QuanHeGiaDinh>>({});
  const [educationEntryForm, setEducationEntryForm] = useState<Partial<QuaTrinhDaoTao>>({});
  const [isSavingFamily, setIsSavingFamily] = useState(false);
  const [isSavingEducation, setIsSavingEducation] = useState(false);

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const [notifyModal, setNotifyModal] = useState<{ isOpen: boolean, type: 'success' | 'error', message: string }>({
    isOpen: false,
    type: 'success',
    message: ''
  });

  const [confirmModal, setConfirmModal] = useState<{ 
    isOpen: boolean, 
    title: string, 
    message: string, 
    onConfirm: () => void 
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Permissions
  const canRead = checkPermission(permissions, isAdmin, 'traCuu-hoSo', 'READ') || checkPermission(permissions, isAdmin, 'hoSoNhanSu', 'READ');
  const canCreate = checkPermission(permissions, isAdmin, 'traCuu-hoSo', 'CREATE') || checkPermission(permissions, isAdmin, 'hoSoNhanSu', 'CREATE');
  const canUpdate = checkPermission(permissions, isAdmin, 'traCuu-hoSo', 'UPDATE') || checkPermission(permissions, isAdmin, 'hoSoNhanSu', 'UPDATE');
  const canDelete = checkPermission(permissions, isAdmin, 'traCuu-hoSo', 'DELETE') || checkPermission(permissions, isAdmin, 'hoSoNhanSu', 'DELETE');

  // Catalog Data
  const [trinhDoList, setTrinhDoList] = useState<TrinhDo[]>([]);
  const [phongBanList, setPhongBanList] = useState<PhongBan[]>([]);
  const [chucVuList, setChucVuList] = useState<ChucVu[]>([]);
  const [chucDanhList, setChucDanhList] = useState<ChucDanh[]>([]);

  // Image Management
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const IMAGE_UPLOAD_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwz0w0iDaDgUSQbO_P5g-rdbuhyQc1mDgHYnRGg5Cx8cObS0TwXuE9Fbwq4xo_oY2wY/exec';

  const normalizeObjectKeys = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      newObj[key.toLowerCase()] = obj[key];
    });
    return newObj;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
  };

  const getGoogleDriveImageUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
      const idMatch = url.match(/[-\w]{25,}/);
      if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[0]}`;
    }
    return url;
  };

  const fetchData = async () => {
    const manv = session.manv || (session.type === 'employee' ? session.employeeData?.taikhoan : null);
    if (!manv) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [tdRes, pbRes, cvRes, cdRes, nvRes, hdRes] = await Promise.all([
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('DanhMucChucVu').select('*'),
        supabase.from('DanhMucChucDanh').select('*'),
        supabase.from('DanhSachNhanVien').select('*').eq('manv', manv).maybeSingle(),
        supabase.from('DanhMucHDLD').select('*')
      ]);

      if (tdRes.data) setTrinhDoList(tdRes.data);
      if (pbRes.data) setPhongBanList(pbRes.data);
      if (cvRes.data) setChucVuList(cvRes.data);
      if (cdRes.data) setChucDanhList(cdRes.data);
      if (hdRes.data) setDanhMucHDLD(hdRes.data.map(item => normalizeKeys(item)));

      if (nvRes.data) {
        const nv = normalizeKeys(nvRes.data) as NhanVien;
        const findInCatalog = (catalog: any[], code: string, keyField: string, valField: string) => {
          if (!code || !catalog) return code;
          const found = catalog.find(item => String(item[keyField]) === String(code));
          return found ? found[valField] : code;
        };

        const joinedProfile = {
          ...nv,
          ten_trinhdo: findInCatalog(tdRes.data || [], nv.trinhdo, 'matrinhdo', 'giatri'),
          ten_phongban: findInCatalog(pbRes.data || [], nv.phongban, 'maphongban', 'giatri'),
          ten_chucvu: findInCatalog(cvRes.data || [], nv.chucvu, 'machucvu', 'giatri'),
          ten_chucdanh: findInCatalog(cdRes.data || [], nv.chucdanh, 'machucdanh', 'giatri'),
        };
        setProfile(joinedProfile);
        setEditForm(joinedProfile);

        // Fetch related data
        fetchRelatedData(manv);
      }
    } catch (err: any) {
      setNotifyModal({ isOpen: true, type: 'error', message: 'Lỗi tải hồ sơ: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedData = async (manv: string) => {
    try {
      const [hdRes, htRes, dtRes, ktRes, famRes, eduRes] = await Promise.all([
        supabase.from('DanhSachKyHDLD').select('*').eq('manv', manv).order('tungay', { ascending: false }),
        supabase.from('DanhSachCaNhanHTNV').select('*').eq('manv', manv),
        supabase.from('DanhSachCaNhanDHTD').select('*').eq('manv', manv),
        supabase.from('DanhSachCaNhanKhenThuong').select('*').eq('manv', manv),
        supabase.from('DanhSachQuanHeGiaDinh').select('*').eq('manv', manv),
        supabase.from('DanhSachQuaTrinhDaoTao').select('*').eq('manv', manv)
      ]);

      if (hdRes.data) setStaffContracts(hdRes.data.map(item => normalizeKeys(item)));
      if (htRes.data) setStaffWorkHistory(htRes.data.map(item => normalizeKeys(item)).sort((a, b) => b.namhoc.localeCompare(a.namhoc)));
      if (dtRes.data) setStaffAwards(dtRes.data.map(item => normalizeKeys(item)).sort((a, b) => b.namhoc.localeCompare(a.namhoc)));
      if (ktRes.data) setStaffCommendations(ktRes.data.map(item => normalizeKeys(item)).sort((a, b) => b.namhoc.localeCompare(a.namhoc)));
      if (famRes.data) setFamilyData(famRes.data.map(item => normalizeKeys(item) as QuanHeGiaDinh));
      if (eduRes.data) setEducationData(eduRes.data.map(item => normalizeKeys(item) as QuaTrinhDaoTao));
    } catch (err: any) {
      setNotifyModal({ isOpen: true, type: 'error', message: 'Lỗi tải dữ liệu liên quan: ' + err.message });
    }
  };

  useEffect(() => {
    fetchData();
  }, [session]);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleImageUploadToGAS = async (file: File): Promise<string | null> => {
    if (!profile?.manv) return null;
    setUploadingImage(true);
    try {
      const base64DataFull = await readFileAsBase64(file);
      let base64 = base64DataFull.includes(',') ? base64DataFull.split(',')[1] : base64DataFull;
      // Làm sạch chuỗi base64
      base64 = base64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
      const padding = base64.length % 4;
      if (padding > 0) base64 += '='.repeat(4 - padding);

      const extension = file.name.split('.').pop();
      const filename = `${profile.manv}.${extension}`;

      const payload = {
        file: base64,
        filename: filename,
        mimeType: file.type,
        folderId: "11mSKRfumZJY7Gil98b0mwLNCk_45uNu_"
      };

      const response = await fetch(IMAGE_UPLOAD_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
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

      const result = await response.json();
      if (result.result === 'success') {
        let finalUrl = result.url;
        const idMatch = finalUrl.match(/[-\w]{25,}/);
        if (idMatch) {
          finalUrl = `https://drive.google.com/file/d/${idMatch[0]}/view?usp=drivesdk`;
        }
        return finalUrl;
      } else {
        throw new Error(result.error || 'Lỗi không xác định từ server');
      }
    } catch (err: any) {
      throw err;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      let finalImageUrl = editForm.hinhanh;

      if (selectedImageFile) {
        try {
          const uploadedUrl = await handleImageUploadToGAS(selectedImageFile);
          if (uploadedUrl) {
            finalImageUrl = uploadedUrl;
          }
        } catch (uploadErr: any) {
          setNotifyModal({ isOpen: true, type: 'error', message: 'Lỗi tải ảnh: ' + uploadErr.message });
          setSaving(false);
          return;
        }
      }

      // Only update allowed fields: noisinh, nguyên quán, sodtdd, noiohiennay, hinhanh, socccd, ngaycap, noicap
      const updates = {
        noisinh: editForm.noisinh,
        nguyenquan: editForm.nguyenquan,
        sodtdd: editForm.sodtdd,
        noiohiennay: editForm.noiohiennay,
        hinhanh: finalImageUrl,
        socccd: editForm.socccd,
        ngaycap: editForm.ngaycap,
        noicap: editForm.noicap
      };

      const { error } = await supabase
        .from('DanhSachNhanVien')
        .update(updates)
        .eq('manv', profile.manv);

      if (error) {
        throw error;
      }

      setNotifyModal({ isOpen: true, type: 'success', message: 'Cập nhật hồ sơ thành công!' });
      setIsEditing(false);
      setSelectedImageFile(null);
      setImagePreview(null);
      fetchData();
    } catch (err: any) {
      setNotifyModal({ isOpen: true, type: 'error', message: 'Lỗi cập nhật: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  // Family Handlers
  const fetchFamilyData = async () => {
    const manv = session.manv || (session.type === 'employee' ? session.employeeData?.taikhoan : null);
    if (!manv) return;
    const { data, error } = await supabase.from('DanhSachQuanHeGiaDinh').select('*').eq('manv', manv);
    if (!error && data) {
      setFamilyData(data.map(item => normalizeKeys(item) as QuanHeGiaDinh));
    }
  };

  const handleOpenAddFamilyEntry = () => {
    setIsEditingFamilyEntry(false);
    setFamilyEntryForm({
      manv: profile?.manv,
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
      setNotifyModal({ isOpen: true, type: 'error', message: "Vui lòng nhập đầy đủ Mối quan hệ và Tên người thân." });
      return;
    }

    setIsSavingFamily(true);
    try {
      if (isEditingFamilyEntry && familyEntryForm.id) {
        const { id, ...updates } = familyEntryForm;
        const { error } = await supabase.from('DanhSachQuanHeGiaDinh').update(updates).eq('id', id);
        if (error) throw error;
        setNotifyModal({ isOpen: true, type: 'success', message: "Cập nhật quan hệ gia đình thành công!" });
      } else {
        const { error } = await supabase.from('DanhSachQuanHeGiaDinh').insert([familyEntryForm]);
        if (error) throw error;
        setNotifyModal({ isOpen: true, type: 'success', message: "Thêm mới quan hệ gia đình thành công!" });
      }
      setIsFamilyEntryFormOpen(false);
      fetchFamilyData();
    } catch (err: any) {
      setNotifyModal({ isOpen: true, type: 'error', message: "Lỗi khi lưu thông tin gia đình: " + err.message });
    } finally {
      setIsSavingFamily(false);
    }
  };

  const handleDeleteFamilyEntry = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận xóa',
      message: 'Bạn có chắc chắn muốn xóa thông tin người thân này không?',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('DanhSachQuanHeGiaDinh').delete().eq('id', id);
          if (error) throw error;
          setNotifyModal({ isOpen: true, type: 'success', message: "Đã xóa thông tin người thân." });
          fetchFamilyData();
        } catch (err: any) {
          setNotifyModal({ isOpen: true, type: 'error', message: "Lỗi khi xóa: " + err.message });
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Education Handlers
  const fetchEducationData = async () => {
    const manv = session.manv || (session.type === 'employee' ? session.employeeData?.taikhoan : null);
    if (!manv) return;
    const { data, error } = await supabase.from('DanhSachQuaTrinhDaoTao').select('*').eq('manv', manv);
    if (!error && data) {
      setEducationData(data.map(item => normalizeKeys(item) as QuaTrinhDaoTao));
    }
  };

  const handleOpenAddEducationEntry = () => {
    setIsEditingEducationEntry(false);
    setEducationEntryForm({
      manv: profile?.manv,
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
      setNotifyModal({ isOpen: true, type: 'error', message: "Vui lòng nhập đầy đủ Trình độ và Chuyên ngành đào tạo." });
      return;
    }

    setIsSavingEducation(true);
    try {
      if (isEditingEducationEntry && educationEntryForm.id) {
        const { id, ...updates } = educationEntryForm;
        const { error } = await supabase.from('DanhSachQuaTrinhDaoTao').update(updates).eq('id', id);
        if (error) throw error;
        setNotifyModal({ isOpen: true, type: 'success', message: "Cập nhật quá trình đào tạo thành công!" });
      } else {
        const { error } = await supabase.from('DanhSachQuaTrinhDaoTao').insert([educationEntryForm]);
        if (error) throw error;
        setNotifyModal({ isOpen: true, type: 'success', message: "Thêm mới quá trình đào tạo thành công!" });
      }
      setIsEducationEntryFormOpen(false);
      fetchEducationData();
    } catch (err: any) {
      setNotifyModal({ isOpen: true, type: 'error', message: "Lỗi khi lưu thông tin đào tạo: " + err.message });
    } finally {
      setIsSavingEducation(false);
    }
  };

  const handleDeleteEducationEntry = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Xác nhận xóa',
      message: 'Bạn có chắc chắn muốn xóa thông tin đào tạo này không?',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('DanhSachQuaTrinhDaoTao').delete().eq('id', id);
          if (error) throw error;
          setNotifyModal({ isOpen: true, type: 'success', message: "Đã xóa thông tin đào tạo." });
          fetchEducationData();
        } catch (err: any) {
          setNotifyModal({ isOpen: true, type: 'error', message: "Lỗi khi xóa: " + err.message });
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handlePrintProfile = () => {
    if (!profile) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportDateStr = `Đà Nẵng, ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}`;
    const printTimeStr = `Thời gian in: ${new Date().toLocaleString('vi-VN')}`;

    const htmlContent = `
      <html>
      <head>
        <title>Hồ sơ Nhân sự - ${profile.holot} ${profile.ten}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; color: #333; margin: 0; padding: 0; }
          .container { width: 100%; }
          .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .header-left { text-align: center; width: 45%; }
          .header-right { text-align: center; width: 50%; }
          .title { text-align: center; font-size: 16pt; font-weight: bold; text-transform: uppercase; margin: 30px 0; }
          .section-title { font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #333; margin: 20px 0 10px 0; padding-bottom: 3px; font-size: 13pt; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
          .info-item { display: flex; }
          .info-label { font-weight: bold; min-width: 120px; }
          .info-value { border-bottom: 1px dotted #999; flex-grow: 1; padding-left: 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11pt; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
          .text-center { text-align: center; }
          .report-footer { margin-top: 40px; display: flex; flex-direction: column; align-items: flex-end; }
          .location-date { font-style: italic; margin-bottom: 5px; }
          .department { font-weight: bold; margin-right: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-left">
              <div>TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG</div>
              <div style="font-weight: bold; text-decoration: underline;">PHÒNG TỔ CHỨC – HÀNH CHÍNH</div>
            </div>
            <div class="header-right">
              <div style="font-weight: bold;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div style="font-weight: bold; text-decoration: underline;">Độc lập – Tự do – Hạnh phúc</div>
            </div>
          </div>

          <div class="title">SƠ YẾU LÝ LỊCH TRÍCH NGANG</div>

          <div class="section-title">1. Thông tin cá nhân</div>
          <div style="display: flex; gap: 20px;">
            <div style="width: 120px; height: 160px; border: 1px solid #333; display: flex; align-items: center; justify-content: center;">
              ${profile.hinhanh ? `<img src="${getGoogleDriveImageUrl(profile.hinhanh)}" style="width: 100%; height: 100%; object-cover: cover;">` : 'Ảnh 3x4'}
            </div>
            <div style="flex-grow: 1;">
              <div class="info-grid">
                <div class="info-item" style="grid-column: span 2;"><span class="info-label">Họ và Tên:</span><span class="info-value" style="font-weight: bold; text-transform: uppercase;">${profile.holot} ${profile.ten}</span></div>
                <div class="info-item"><span class="info-label">Mã nhân viên:</span><span class="info-value">${profile.manv}</span></div>
                <div class="info-item"><span class="info-label">Giới tính:</span><span class="info-value">${profile.gioitinh ? 'Nam' : 'Nữ'}</span></div>
                <div class="info-item"><span class="info-label">Ngày sinh:</span><span class="info-value">${formatDate(profile.ngaysinh)}</span></div>
                <div class="info-item" style="grid-column: span 2;"><span class="info-label">Nơi sinh:</span><span class="info-value">${profile.noisinh}</span></div>
                <div class="info-item"><span class="info-label">Số CCCD:</span><span class="info-value">${profile.socccd || '---'}</span></div>
                <div class="info-item"><span class="info-label">Ngày cấp:</span><span class="info-value">${formatDate(profile.ngaycap) || '---'}</span></div>
                <div class="info-item" style="grid-column: span 2;"><span class="info-label">Email:</span><span class="info-value">${profile.email}</span></div>
                <div class="info-item"><span class="info-label">Trình độ:</span><span class="info-value">${profile.ten_trinhdo}</span></div>
                <div class="info-item"><span class="info-label">Chức danh:</span><span class="info-value">${profile.ten_chucdanh}</span></div>
                <div class="info-item"><span class="info-label">Chức vụ:</span><span class="info-value">${profile.ten_chucvu}</span></div>
                <div class="info-item"><span class="info-label">Đơn vị:</span><span class="info-value">${profile.ten_phongban}</span></div>
              </div>
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

          <div class="report-footer">
            <div class="location-date">${reportDateStr}</div>
            <div class="department">Phòng Tổ chức – Hành chính</div>
          </div>
        </div>

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

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 text-blue-600 gap-4">
      <Loader className="size-12 animate-spin" />
      <p className="font-bold text-sm tracking-widest">Đang tải hồ sơ...</p>
    </div>
  );

  if (!profile) return (
    <div className="p-12 text-center bg-white rounded-3xl shadow-xl border border-gray-100 max-w-md mx-auto mt-10">
      <div className="size-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
        <Shield size={40} />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Không tìm thấy hồ sơ</h2>
      <p className="text-gray-500 text-sm">Vui lòng liên hệ quản trị viên để cập nhật thông tin nhân sự của bạn.</p>
    </div>
  );



  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <h3 className="text-2xl font-bold text-indigo-800 flex items-center gap-2">
          <FileText className="h-7 w-7" />
          {isEditing ? 'Hiệu chỉnh Hồ sơ Nhân sự' : 'Hồ sơ chi tiết nhân sự'}
        </h3>
        <div className="flex gap-2">
          {!isEditing && (
            <button 
              onClick={() => setIsQRModalOpen(true)}
              className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 text-sm font-bold shadow-sm transition-all border border-blue-200"
            >
              <QrCode className="w-4 h-4 mr-2" />
              Tạo mã QR
            </button>
          )}
          {!isEditing && (
            <button 
              onClick={handlePrintProfile}
              className="flex items-center px-4 py-2 bg-green-50 text-green-700 rounded-md hover:bg-green-100 text-sm font-bold shadow-sm transition-all border border-green-200"
            >
              <Printer className="w-4 h-4 mr-2" />
              In hồ sơ (Lý lịch)
            </button>
          )}
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)}
              className="flex items-center px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 text-sm font-bold shadow-sm transition-all"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Hiệu chỉnh hồ sơ
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-bold shadow-md transition-all disabled:opacity-50"
              >
                {saving ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Lưu hồ sơ
              </button>
              <button 
                onClick={() => { setIsEditing(false); setEditForm(profile); setImagePreview(null); }}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-bold shadow-sm transition-all"
              >
                <X className="w-4 h-4 mr-2" />
                Hủy bỏ
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Photo & Image Link */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
            <div className="w-full aspect-[3/4] bg-gray-50 rounded-lg border-2 border-indigo-50 overflow-hidden shadow-inner flex items-center justify-center relative group">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : editForm.hinhanh ? (
                <img 
                  src={getGoogleDriveImageUrl(editForm.hinhanh)} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center text-gray-300">
                  <User size={64} />
                  <span className="text-[10px] font-bold uppercase mt-2">Chưa có ảnh</span>
                </div>
              )}
            </div>
            
            <div className="w-full mt-6 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Link ảnh (Google Drive)</label>
                <div className="flex gap-1">
                  <input 
                    type="text" 
                    value={editForm.hinhanh || ''} 
                    onChange={e => setEditForm({...editForm, hinhanh: e.target.value})}
                    readOnly={!isEditing}
                    className={`flex-1 text-[10px] font-mono p-2 border rounded ${isEditing ? 'bg-white border-blue-300 text-black' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                  />
                  <button onClick={() => window.open(editForm.hinhanh || '', '_blank')} className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"><Eye className="h-4 w-4" /></button>
                </div>
              </div>
              
              {isEditing && (
                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">
                  <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest">Thay đổi ảnh cá nhân:</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      setSelectedImageFile(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setImagePreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} 
                    className="text-[10px] w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700" 
                  />
                  <p className="text-[8px] text-blue-600 italic">Ảnh mới sẽ được tải lên khi bạn nhấn "Lưu hồ sơ".</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {/* Personal Info Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <SectionHeader icon={User} title="Thông tin cá nhân" colorClass="text-red-700" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
              <InfoItem label="Họ lót" value={profile.holot} />
              <InfoItem label="Tên" value={profile.ten} />
              <InfoItem label="Giới tính" value={profile.gioitinh ? 'Nam' : 'Nữ'} />
              <InfoItem label="Ngày sinh" value={formatDate(profile.ngaysinh)} />
              <InfoItem label="Nơi sinh" value={profile.noisinh} field="noisinh" editable={true} isEditing={isEditing} editValue={editForm.noisinh || ''} onUpdate={(val) => setEditForm({...editForm, noisinh: val})} />
              <InfoItem label="Nguyên quán" value={profile.nguyenquan} field="nguyenquan" editable={true} isEditing={isEditing} editValue={editForm.nguyenquan || ''} onUpdate={(val) => setEditForm({...editForm, nguyenquan: val})} />
            </div>
          </div>

          {/* Work & Organization Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <SectionHeader icon={Briefcase} title="Công tác & Tổ chức" colorClass="text-emerald-700" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
              <InfoItem label="Đơn vị (Khoa/Phòng)" value={profile.ten_phongban} />
              <InfoItem label="Chức vụ" value={profile.ten_chucvu} />
              <InfoItem label="Chức danh" value={profile.ten_chucdanh} />
              <InfoItem label="Trình độ" value={profile.ten_trinhdo} />
              <InfoItem label="Vị thứ (Sắp xếp)" value={profile.vithu} />
              <InfoItem label="Ngày thử việc" value={formatDate(profile.ngaythuviec)} />
              <InfoItem label="Ngày chính thức" value={formatDate(profile.ngaychinhthuc)} />
              <InfoItem label="Đã nghỉ việc" value={profile.danghiviec ? 'Có (Đã nghỉ)' : 'Không (Đang làm)'} />
              <InfoItem label="Thời gian nghỉ việc" value={formatDate(profile.ngaynghiviec || '')} />
            </div>
          </div>

          {/* Lecturer Profile Section (Conditional) */}
          {profile.giangvien && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <SectionHeader icon={GraduationCap} title="Hồ sơ giảng viên" colorClass="text-blue-700" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                <InfoItem label="Chức danh công tác" value="Giảng viên" />
                <InfoItem label="Ngày QĐ Trợ giảng" value={formatDate(profile.ngayqdtrogiang || '')} />
                <InfoItem label="Ngày QĐ Giảng viên" value={formatDate(profile.ngayqdgiangvien || '')} />
              </div>
            </div>
          )}

          {/* Contact Info Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <SectionHeader icon={Phone} title="Thông tin liên hệ" colorClass="text-red-700" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-amber-50/30 p-6 rounded-xl border border-amber-100">
              <InfoItem label="Số CCCD" value={profile.socccd} field="socccd" editable={true} isEditing={isEditing} editValue={editForm.socccd || ''} onUpdate={(val) => setEditForm({...editForm, socccd: val})} />
              <InfoItem label="Ngày cấp CCCD" value={formatDate(profile.ngaycap || '')} field="ngaycap" editable={true} isEditing={isEditing} editValue={editForm.ngaycap || ''} onUpdate={(val) => setEditForm({...editForm, ngaycap: val})} />
              <InfoItem label="Nơi cấp CCCD" value={profile.noicap} field="noicap" editable={true} isEditing={isEditing} editValue={editForm.noicap || ''} onUpdate={(val) => setEditForm({...editForm, noicap: val})} />
              <InfoItem label="Số điện thoại" value={profile.sodtdd} field="sodtdd" editable={true} isEditing={isEditing} editValue={editForm.sodtdd || ''} onUpdate={(val) => setEditForm({...editForm, sodtdd: val})} />
              <InfoItem label="Email" value={profile.email} />
              <div className="sm:col-span-3">
                <InfoItem label="Địa chỉ hiện nay" value={profile.noiohiennay} field="noiohiennay" editable={true} isEditing={isEditing} editValue={editForm.noiohiennay || ''} onUpdate={(val) => setEditForm({...editForm, noiohiennay: val})} />
              </div>
            </div>
          </div>

          {/* Family Relations Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <SectionHeader icon={Users} title="Quan hệ Gia đình" colorClass="text-red-700" />
              <button 
                onClick={() => setIsFamilyModalOpen(true)}
                className="flex items-center px-3 py-1.5 text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
                title="Thêm mới, Hiệu chỉnh và Xóa"
              >
                <History className="h-4 w-4 mr-2" /> Xem chi tiết
              </button>
            </div>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-red-600 tracking-wider">Họ và Tên</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 tracking-wider w-32">Mối quan hệ</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 tracking-wider w-24">Năm sinh</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-red-600 tracking-wider">Nghề nghiệp</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {familyData.length > 0 ? familyData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-medium text-gray-900">{item.holot} {item.ten}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-700">{item.moiquanhe}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-700">{item.namsinh}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{item.nghenghiep}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400 italic">Chưa có dữ liệu quan hệ gia đình</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Training History Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <SectionHeader icon={GraduationCap} title="Quá trình Đào tạo" colorClass="text-red-700" />
              <button 
                onClick={() => setIsEducationModalOpen(true)}
                className="flex items-center px-3 py-1.5 text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
                title="Thêm mới, Hiệu chỉnh và Xóa"
              >
                <History className="h-4 w-4 mr-2" /> Xem chi tiết
              </button>
            </div>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-red-600 uppercase tracking-wider">Trình độ</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-red-600 uppercase tracking-wider">Chuyên ngành</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-red-600 uppercase tracking-wider">Cơ sở đào tạo</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 uppercase tracking-wider w-32">Năm TN - Loại</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {educationData.length > 0 ? educationData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-medium text-gray-900">{item.trinhdodaotao}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{item.chuyennganh}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{item.cosodaotao}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-700">{item.namtnxeploai}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400 italic">Chưa có dữ liệu quá trình đào tạo</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contracts Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <SectionHeader icon={FileText} title="Danh sách HĐLĐ" colorClass="text-red-700" />
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 uppercase tracking-wider w-16">STT</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 uppercase tracking-wider w-24">Số hiệu</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-red-600 uppercase tracking-wider">Loại hợp đồng</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 uppercase tracking-wider w-32">Từ ngày</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 uppercase tracking-wider w-32">Đến ngày</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {staffContracts.length > 0 ? staffContracts.map((c, idx) => {
                    const hdType = danhMucHDLD.find(h => String(h.maso) === String(c.loaihd));
                    return (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-center text-xs text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3 text-center text-xs font-bold text-blue-600">{c.sohd}</td>
                        <td className="px-4 py-3 text-xs text-gray-700">{hdType ? hdType.tenhdld : c.loaihd}</td>
                        <td className="px-4 py-3 text-center text-xs text-gray-700">{formatDate(c.tungay)}</td>
                        <td className="px-4 py-3 text-center text-xs text-red-600 font-medium">{String(c.loaihd) === '7' ? '' : formatDate(c.denngay)}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400 italic">Chưa có dữ liệu hợp đồng</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Work History Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <SectionHeader icon={BadgeCheck} title="Quá trình công tác" colorClass="text-red-700" />
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 uppercase tracking-wider w-16">STT</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 uppercase tracking-wider w-32">Năm học</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-red-600 uppercase tracking-wider">Mức độ hoàn thành nhiệm vụ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {staffWorkHistory.length > 0 ? staffWorkHistory.map((w, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-700">{w.namhoc}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{w.mucdohtnv}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-gray-400 italic">Chưa có dữ liệu quá trình công tác</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Awards Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <SectionHeader icon={Trophy} title="Danh hiệu thi đua" colorClass="text-red-700" />
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 uppercase tracking-wider w-16">STT</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 uppercase tracking-wider w-32">Năm học</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-red-600 uppercase tracking-wider">Danh hiệu thi đua</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {staffAwards.length > 0 ? staffAwards.map((a, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-700">{a.namhoc}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{a.danhhieuthidua}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-gray-400 italic">Chưa có dữ liệu danh hiệu thi đua</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commendations Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <SectionHeader icon={Gift} title="Khen thưởng" colorClass="text-red-700" />
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 uppercase tracking-wider w-16">STT</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-red-600 uppercase tracking-wider w-32">Năm học</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-red-600 uppercase tracking-wider">Hình thức khen thưởng</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {staffCommendations.length > 0 ? staffCommendations.map((k, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-700">{k.namhoc}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">{k.hinhthuckhenthuong}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-gray-400 italic">Chưa có dữ liệu khen thưởng</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Family Member Modal */}
      {isFamilyModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-red-700 to-red-600 px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Thông tin Quan hệ Gia đình</h2>
                  <p className="text-red-100 text-xs">Quản lý danh sách người thân của nhân sự</p>
                </div>
              </div>
              <button onClick={() => setIsFamilyModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex justify-end items-center mb-6">
                {canCreate && (
                  <button 
                    onClick={handleOpenAddFamilyEntry}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 font-bold text-sm"
                    title="Thêm mới quan hệ gia đình"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Thêm mới
                  </button>
                )}
              </div>

              {isFamilyEntryFormOpen && (
                <div className="mb-8 p-6 bg-red-50/50 rounded-2xl border border-red-100 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center gap-2 mb-4 text-red-800 font-bold">
                    <Edit2 className="h-5 w-5" />
                    <h4>{isEditingFamilyEntry ? 'Hiệu chỉnh thông tin người thân' : 'Thêm mới người thân'}</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-red-500 mb-1 ">Mối quan hệ <span className="text-red-500">*</span></label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium"
                        value={familyEntryForm.moiquanhe || ''}
                        onChange={(e) => setFamilyEntryForm({ ...familyEntryForm, moiquanhe: e.target.value })}
                      >
                        <option value="">-- Chọn --</option>
                        {RELATIONSHIP_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-500 mb-1 ">Họ lót</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium"
                        value={familyEntryForm.holot || ''}
                        onChange={(e) => setFamilyEntryForm({ ...familyEntryForm, holot: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-500 mb-1 ">Tên <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium"
                        value={familyEntryForm.ten || ''}
                        onChange={(e) => setFamilyEntryForm({ ...familyEntryForm, ten: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-500 mb-1 ">Năm sinh</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium"
                        value={familyEntryForm.namsinh || ''}
                        onChange={(e) => setFamilyEntryForm({ ...familyEntryForm, namsinh: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-500 mb-1 ">Nghề nghiệp</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium"
                        value={familyEntryForm.nghenghiep || ''}
                        onChange={(e) => setFamilyEntryForm({ ...familyEntryForm, nghenghiep: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-500 mb-1 ">Nơi công tác (Địa chỉ nhà) </label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm font-medium"
                        value={familyEntryForm.noicongtac || ''}
                        onChange={(e) => setFamilyEntryForm({ ...familyEntryForm, noicongtac: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button 
                      onClick={() => setIsFamilyEntryFormOpen(false)}
                      className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      Hủy bỏ
                    </button>
                    <button 
                      onClick={handleSaveFamilyEntry}
                      disabled={isSavingFamily}
                      className="flex items-center px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-bold text-sm disabled:opacity-50"
                    >
                      {isSavingFamily ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Lưu thông tin
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-red-600 text-xs font-bold">
                    <tr>
                      <th className="px-4 py-4">Mối quan hệ</th>
                      <th className="px-4 py-4">Họ và Tên</th>
                      <th className="px-4 py-4">Năm sinh</th>
                      <th className="px-4 py-4">Nghề nghiệp</th>
                      <th className="px-4 py-4">Nơi công tác</th>
                      {(canUpdate || canDelete) && <th className="px-4 py-4 text-center">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {familyData.length > 0 ? familyData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-red-50/30 transition-colors group">
                        <td className="px-4 py-4 font-bold text-red-700">{item.moiquanhe}</td>
                        <td className="px-4 py-4 font-medium text-gray-900">{item.holot} {item.ten}</td>
                        <td className="px-4 py-4 text-gray-600">{item.namsinh}</td>
                        <td className="px-4 py-4 text-gray-600">{item.nghenghiep}</td>
                        <td className="px-4 py-4 text-gray-600">{item.noicongtac}</td>
                        {(canUpdate || canDelete) && (
                          <td className="px-4 py-4">
                            <div className="flex justify-center gap-2">
                              {canUpdate && (
                                <button 
                                  onClick={() => handleOpenEditFamilyEntry(item)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Hiệu chỉnh"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                              )}
                              {canDelete && (
                                <button 
                                  onClick={() => handleDeleteFamilyEntry(item.id!)}
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
                    )) : (
                      <tr>
                        <td colSpan={(canUpdate || canDelete) ? 6 : 5} className="px-4 py-12 text-center text-gray-400 italic">Chưa có dữ liệu người thân</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setIsFamilyModalOpen(false)}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-bold text-sm shadow-sm"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Education Modal */}
      {isEducationModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-6 py-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Quá trình Đào tạo</h2>
                  <p className="text-blue-100 text-xs">Quản lý lịch sử học tập và bằng cấp</p>
                </div>
              </div>
              <button onClick={() => setIsEducationModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex justify-end items-center mb-6">
                {canCreate && (
                  <button 
                    onClick={handleOpenAddEducationEntry}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 font-bold text-sm"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Thêm mới
                  </button>
                )}
              </div>

              {isEducationEntryFormOpen && (
                <div className="mb-8 p-6 bg-blue-50/50 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center gap-2 mb-4 text-blue-800 font-bold">
                    <Edit2 className="h-5 w-5" />
                    <h4>{isEditingEducationEntry ? 'Hiệu chỉnh thông tin đào tạo' : 'Thêm mới quá trình đào tạo'}</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-red-500 mb-1 ">Trình độ Đào tạo <span className="text-red-500">*</span></label>
                      <select 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                        value={educationEntryForm.trinhdodaotao || ''}
                        onChange={(e) => setEducationEntryForm({ ...educationEntryForm, trinhdodaotao: e.target.value })}
                      >
                        <option value="">-- Chọn --</option>
                        {trinhDoList.map(opt => <option key={opt.matrinhdo} value={opt.giatri}>{opt.giatri}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-500 mb-1 ">Chuyên ngành <span className="text-red-500">*</span></label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                        value={educationEntryForm.chuyennganh || ''}
                        onChange={(e) => setEducationEntryForm({ ...educationEntryForm, chuyennganh: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-500 mb-1 ">Cơ sở đào tạo</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                        value={educationEntryForm.cosodaotao || ''}
                        onChange={(e) => setEducationEntryForm({ ...educationEntryForm, cosodaotao: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-red-500 mb-1 ">Năm tốt nghiệp - Loại</label>
                      <input 
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                        value={educationEntryForm.namtnxeploai || ''}
                        onChange={(e) => setEducationEntryForm({ ...educationEntryForm, namtnxeploai: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-6">
                    <button 
                      onClick={() => setIsEducationEntryFormOpen(false)}
                      className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      Hủy bỏ
                    </button>
                    <button 
                      onClick={handleSaveEducationEntry}
                      disabled={isSavingEducation}
                      className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-sm disabled:opacity-50"
                    >
                      {isSavingEducation ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Lưu thông tin
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-red-600 text-xs font-bold">
                    <tr>
                      <th className="px-4 py-4">Trình độ</th>
                      <th className="px-4 py-4">Chuyên ngành</th>
                      <th className="px-4 py-4">Cơ sở đào tạo</th>
                      <th className="px-4 py-4">Năm TN - Loại</th>
                      {(canUpdate || canDelete) && <th className="px-4 py-4 text-center">Thao tác</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {educationData.length > 0 ? educationData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-4 py-4 font-bold text-blue-700">{item.trinhdodaotao}</td>
                        <td className="px-4 py-4 font-medium text-gray-900">{item.chuyennganh}</td>
                        <td className="px-4 py-4 text-gray-600">{item.cosodaotao}</td>
                        <td className="px-4 py-4 text-gray-600">{item.namtnxeploai}</td>
                        {(canUpdate || canDelete) && (
                          <td className="px-4 py-4">
                            <div className="flex justify-center gap-2">
                              {canUpdate && (
                                <button 
                                  onClick={() => handleOpenEditEducationEntry(item)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Hiệu chỉnh"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                              )}
                              {canDelete && (
                                <button 
                                  onClick={() => handleDeleteEducationEntry(item.id!)}
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
                    )) : (
                      <tr>
                        <td colSpan={(canUpdate || canDelete) ? 5 : 4} className="px-4 py-12 text-center text-gray-400 italic">Chưa có dữ liệu đào tạo</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setIsEducationModalOpen(false)}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-bold text-sm shadow-sm"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <p className="text-[10px] text-red-400 font-bold tracking-widest italic flex items-center gap-2">
          <Clock className="h-3 w-3" /> Hệ thống DAU HR Management | Hồ sơ cá nhân nhân sự
        </p>
      </div>

      {/* QR Code Modal */}
      {isQRModalOpen && profile && (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[400px] overflow-hidden animate-in zoom-in duration-200 relative">
            <button 
              onClick={() => setIsQRModalOpen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
            >
              <X size={20} />
            </button>

            {/* Header with Gradient */}
            <div className="bg-gradient-to-b from-indigo-600 to-purple-700 p-6 text-center text-white space-y-1 pb-16">
              <h4 className="text-base font-bold uppercase tracking-wider">BỘ GIÁO DỤC VÀ ĐÀO TẠO</h4>
              <p className="text-xs font-medium opacity-90">Trường Đại học Kiến trúc Đà Nẵng</p>
            </div>

            {/* Profile Image Overlap */}
            <div className="relative -mt-14 flex justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gray-100">
                {profile.hinhanh ? (
                  <img 
                    src={getGoogleDriveImageUrl(profile.hinhanh)} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <User size={48} />
                  </div>
                )}
              </div>
            </div>

            {/* Info Section */}
            <div className="p-5 pt-3 space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4 shadow-inner border border-gray-100">
                <h5 className="text-center text-indigo-700 font-bold uppercase tracking-widest mb-3 text-xs">Thông tin nhân sự</h5>
                <div className="space-y-3 text-center">
                  <div className="border-b border-gray-200 pb-2">
                    <p className="text-[10px] text-indigo-500 font-bold tracking-wider mb-0.5">Họ và Tên</p>
                    <p className="text-sm font-bold text-red-600">{profile.holot} {profile.ten}</p>
                  </div>
                  <div className="border-b border-gray-200 pb-2">
                    <p className="text-[10px] text-indigo-500 font-bold tracking-wider mb-0.5">Email</p>
                    <p className="text-sm font-bold text-red-600">{profile.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-500 font-bold tracking-wider mb-0.5">Số Điện Thoại</p>
                    <p className="text-sm font-bold text-red-600">{profile.sodtdd || '---'}</p>
                  </div>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 bg-white border-2 border-gray-100 rounded-2xl shadow-md">
                  <QRCodeSVG 
                    value={`Họ và Tên: ${profile.holot} ${profile.ten}\nTrình độ: ${profile.ten_trinhdo}\nChức vụ: ${profile.ten_chucvu}\nĐơn vị công tác: ${profile.ten_phongban}\nEmail: ${profile.email}\nSố điện thoại: ${profile.sodtdd || '---'}`}
                    size={150}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="text-[9px] text-red-400 font-medium tracking-widest text-center">Quét mã QR để xem thông tin chi tiết</p>
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-center">
              <button 
                onClick={() => setIsQRModalOpen(false)} 
                className="flex items-center gap-2 px-10 py-2 bg-gray-800 text-white rounded-xl font-bold text-sm hover:bg-gray-900 transition-all shadow-md"
              >
                <X size={16} />
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notifyModal.isOpen && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-gray-100">
            <div className={`${notifyModal.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} p-4 text-white flex items-center gap-3`}>
              {notifyModal.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              <h3 className="text-lg font-bold">Thông báo</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className={`font-bold text-sm leading-relaxed ${notifyModal.type === 'error' ? 'text-red-700' : 'text-gray-800'}`}>
                {notifyModal.message}
              </p>
            </div>
            <div className="bg-gray-50 p-4 flex justify-center border-t">
              <button 
                onClick={() => setNotifyModal({ ...notifyModal, isOpen: false })} 
                className={`px-12 py-2 ${notifyModal.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white font-black rounded-xl hover:opacity-90 shadow-md transition-all active:scale-95 text-xs uppercase tracking-widest`}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-gray-100">
            <div className="bg-blue-600 p-4 text-white flex items-center gap-3">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">{confirmModal.title}</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="font-bold text-sm leading-relaxed text-gray-800">
                {confirmModal.message}
              </p>
            </div>
            <div className="bg-gray-50 p-4 flex justify-center gap-3 border-t">
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
                className="px-6 py-2 bg-white border border-gray-300 text-gray-700 font-black rounded-xl hover:bg-gray-50 shadow-sm transition-all active:scale-95 text-xs uppercase tracking-widest"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={confirmModal.onConfirm} 
                className="px-6 py-2 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-md transition-all active:scale-95 text-xs uppercase tracking-widest"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
