import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { ThongTinBaoHiemCaNhan, BenhVien, NhanVien, DanhSachHSL, QuaTrinhDongBaoHiem, TiLeDongBH, RolePermission } from '../types';
import { 
  Search, Pencil, X, Save, CheckCircle2, Loader2, HeartPulse, 
  Filter, ChevronDown, FileDown, Plus, UserPlus, MoreHorizontal, 
  UserCheck, Building2, Wallet, AlertCircle, User, Eye, FileText, History, ClipboardList, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { checkPermission } from '../services/permissionService';

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

const getGoogleDriveImageUrl = (url: string) => {
  if (!url) return '';
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    const idMatch = url.match(/[-\w]{25,}/);
    if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[0]}`;
  }
  return url;
};

export const BaoHiemDanhSachThamGiaManagement: React.FC<Props> = ({ permissions, isAdmin, currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [insuranceList, setInsuranceList] = useState<ThongTinBaoHiemCaNhan[]>([]);
  const [benhVienList, setBenhVienList] = useState<BenhVien[]>([]);
  const [monthConfigs, setMonthConfigs] = useState<TiLeDongBH[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Permission checks
  const canCreate = checkPermission(permissions, isAdmin, 'baoHiem-danhSachThamGia', 'CREATE');
  const canUpdate = checkPermission(permissions, isAdmin, 'baoHiem-danhSachThamGia', 'UPDATE');
  const canDelete = checkPermission(permissions, isAdmin, 'baoHiem-danhSachThamGia', 'DELETE');
  const canRead = checkPermission(permissions, isAdmin, 'baoHiem-danhSachThamGia', 'READ');
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMonthlyRecordModalOpen, setIsMonthlyRecordModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  // New States for History Editing/Deleting
  const [isEditHistoryModalOpen, setIsEditHistoryModalOpen] = useState(false);
  const [isDeleteHistoryConfirmOpen, setIsDeleteHistoryConfirmOpen] = useState(false);
  const [editingHistoryItem, setEditingHistoryItem] = useState<QuaTrinhDongBaoHiem | null>(null);
  const [deletingHistoryItem, setDeletingHistoryItem] = useState<QuaTrinhDongBaoHiem | null>(null);

  const [editingItem, setEditingItem] = useState<ThongTinBaoHiemCaNhan | null>(null);
  const [detailItem, setDetailItem] = useState<ThongTinBaoHiemCaNhan | null>(null);
  const [insuranceHistory, setInsuranceHistory] = useState<QuaTrinhDongBaoHiem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('Thông tin đã được lưu thành công.');
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // States for Add New Monthly Record
  const [monthlyFormData, setMonthlyFormData] = useState({
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
    hsl: 0,
    hschucvu: 0,
    tongheso: 0,
    thaisan: false
  });

  // States for Add New Master Participation Modal
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [loadingAvailableStaff, setLoadingAvailableStaff] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [selectedStaffHSL, setSelectedStaffHSL] = useState<any>(null);
  const [addForm, setAddForm] = useState({
    sosobaohiem: '',
    noidangkykcb: 0
  });

  const staffDropdownRef = useRef<HTMLDivElement>(null);
  const staffSearchRef = useRef<HTMLInputElement>(null);

  // Filters state
  const [filters, setFilters] = useState({
    trinhdo: '',
    chucvu: '',
    donvi: '',
    thaisan: 'Tất cả',
    hetthamgia: 'Còn'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [insRes, nvRes, hslRes, bvRes, tdRes, pbRes, cvRes, monthRes] = await Promise.all([
        supabase.from('ThongTinBaoHiemCaNhan').select('*'),
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, gioitinh, ngaysinh, trinhdo, phongban, chucvu, hinhanh, danghiviec').eq('danghiviec', false),
        supabase.from('DanhSachHSL').select('manv, hsl, hschucvu, tongheso'),
        supabase.from('DanhMucBenhVien').select('*'),
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('DanhMucChucVu').select('*'),
        supabase.from('ThongTinBaoHiemHangThang').select('*').order('maso', { ascending: false })
      ]);

      if (insRes.error) throw insRes.error;

      const nvs = (nvRes.data || []).map(normalizeKeys);
      const hsls = (hslRes.data || []).map(normalizeKeys);
      const bvs = (bvRes.data || []).map(normalizeKeys) as BenhVien[];
      const tds = (tdRes.data || []).map(normalizeKeys);
      const pbs = (pbRes.data || []).map(normalizeKeys);
      const cvs = (cvRes.data || []).map(normalizeKeys);
      
      setBenhVienList(bvs);
      setMonthConfigs((monthRes.data || []).map(m => normalizeKeys(m)) as TiLeDongBH[]);

      const joined = (insRes.data || [])
        .map(item => {
          const base = normalizeKeys(item) as ThongTinBaoHiemCaNhan;
          const nv = nvs.find(e => String(e.manv) === String(base.manv));
          const hsl = hsls.find(h => String(h.manv) === String(base.manv));
          const bv = bvs.find(b => b.maso === base.noidangkykcb);

          if (nv) {
            const td = tds.find(t => String(t.matrinhdo) === String(nv.trinhdo));
            const pb = pbs.find(p => String(p.maphongban) === String(nv.phongban));
            const cv = cvs.find(c => String(c.machucvu) === String(nv.chucvu));

            return {
              ...base,
              holot: nv.holot,
              ten: nv.ten,
              gioitinh: nv.gioitinh,
              ngaysinh: nv.ngaysinh,
              hinhanh: nv.hinhanh,
              ten_trinhdo: td ? td.giatri : nv.trinhdo,
              ten_phongban: pb ? pb.giatri : nv.phongban,
              ten_chucvu: cv ? cv.giatri : nv.chucvu,
              hsl: hsl?.hsl,
              hschucvu: hsl?.hschucvu,
              tongheso: hsl?.tongheso,
              tenbenhvien: bv ? bv.tenbenhvien : String(base.noidangkykcb)
            };
          }
          return null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      setInsuranceList(joined);
    } catch (err: any) {
      setErrorMsg('Lỗi khi tải dữ liệu bảo hiểm: ' + (err.message || String(err)));
      setIsErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchInsuranceHistory = async (manv: string) => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('QuaTrinhDongBaoHiem')
        .select('*')
        .eq('manv', manv)
        .order('maso', { ascending: false });
      
      if (error) throw error;
      setInsuranceHistory(data || []);
    } catch (err: any) {
      setErrorMsg("Lỗi khi tải lịch sử bảo hiểm: " + (err.message || String(err)));
      setIsErrorModalOpen(true);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleClickOutside = (event: MouseEvent) => {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(event.target as Node)) {
        setIsStaffDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Logic Monthly Record Modal ---
  const availableMonthsForCurrentStaff = useMemo(() => {
    if (!detailItem) return [];
    const existingMonths = new Set(insuranceHistory.map(h => h.thangnam));
    return monthConfigs.filter(m => !existingMonths.has(m.thangnam));
  }, [monthConfigs, insuranceHistory, detailItem]);

  const filteredStaffInDropdown = useMemo(() => {
    if (!staffSearchQuery.trim()) return availableStaff;
    const lowerSearch = staffSearchQuery.toLowerCase();
    return availableStaff.filter(s => 
      `${s.holot} ${s.ten}`.toLowerCase().includes(lowerSearch) || 
      String(s.manv || '').toLowerCase().includes(lowerSearch) ||
      String(s.ten_phongban || '').toLowerCase().includes(lowerSearch)
    );
  }, [availableStaff, staffSearchQuery]);

  const handleOpenMonthlyRecord = () => {
    if (!detailItem) return;
    
    setMonthlyFormData({
      thangnam: availableMonthsForCurrentStaff[0]?.thangnam || '',
      mdttquydinh: availableMonthsForCurrentStaff[0]?.mdttquydinh || 0,
      mdtttruong: availableMonthsForCurrentStaff[0]?.mdtttruong || 0,
      bhxhtruong: availableMonthsForCurrentStaff[0]?.bhxhtruong || 0,
      bhxhnguoild: availableMonthsForCurrentStaff[0]?.bhxhnguoild || 0,
      bhyttruong: availableMonthsForCurrentStaff[0]?.bhyttruong || 0,
      bhytnguoild: availableMonthsForCurrentStaff[0]?.bhytnguoild || 0,
      bhtntruong: availableMonthsForCurrentStaff[0]?.bhtntruong || 0,
      bhtnnguoild: availableMonthsForCurrentStaff[0]?.bhtnnguoild || 0,
      bhatldtruong: availableMonthsForCurrentStaff[0]?.bhatldtruong || 0,
      hsl: detailItem.hsl || 0,
      hschucvu: detailItem.hschucvu || 0,
      tongheso: detailItem.tongheso || 0,
      thaisan: detailItem.thaisan || false
    });
    setIsMonthlyRecordModalOpen(true);
  };

  const handleMonthlyMonthChange = (thangnam: string) => {
    const config = monthConfigs.find(m => m.thangnam === thangnam);
    if (config) {
      setMonthlyFormData(prev => ({
        ...prev,
        thangnam,
        mdttquydinh: config.mdttquydinh,
        mdtttruong: config.mdtttruong,
        bhxhtruong: config.bhxhtruong,
        bhxhnguoild: config.bhxhnguoild,
        bhyttruong: config.bhyttruong,
        bhytnguoild: config.bhytnguoild,
        bhtntruong: config.bhtntruong,
        bhtnnguoild: config.bhtnnguoild,
        bhatldtruong: config.bhatldtruong
      }));
    } else {
      setMonthlyFormData(prev => ({ ...prev, thangnam }));
    }
  };

  const handleSaveMonthlyRecord = async () => {
    if (!detailItem || !monthlyFormData.thangnam) {
      setErrorMsg("Vui lòng chọn đầy đủ tháng/năm.");
      setIsErrorModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      let tienluongphucap = monthlyFormData.tongheso * monthlyFormData.mdtttruong;
      if (tienluongphucap < monthlyFormData.mdttquydinh) {
        tienluongphucap = monthlyFormData.mdttquydinh;
      }

      let bhxh = 0, bhyt = 0, bhtn = 0, bhatld = 0;
      if (!monthlyFormData.thaisan) {
        bhxh = Math.round(((monthlyFormData.bhxhtruong + monthlyFormData.bhxhnguoild) / 100) * tienluongphucap);
        bhyt = Math.round(((monthlyFormData.bhyttruong + monthlyFormData.bhytnguoild) / 100) * tienluongphucap);
        bhtn = Math.round(((monthlyFormData.bhtntruong + monthlyFormData.bhtnnguoild) / 100) * tienluongphucap);
        bhatld = Math.round((monthlyFormData.bhatldtruong / 100) * tienluongphucap);
      }

      const payload = {
        thangnam: monthlyFormData.thangnam,
        manv: detailItem.manv,
        hsl: monthlyFormData.hsl,
        hschucvu: monthlyFormData.hschucvu,
        tongheso: monthlyFormData.tongheso,
        tienluongphucap,
        bhxh,
        bhyt,
        bhtn,
        bhatld,
        thaisan: monthlyFormData.thaisan
      };

      const { error } = await supabase.from('QuaTrinhDongBaoHiem').insert([payload]);
      if (error) throw error;

      setIsMonthlyRecordModalOpen(false);
      setSuccessMsg(`Đã thêm số liệu bảo hiểm tháng ${monthlyFormData.thangnam} cho nhân sự ${detailItem.holot} ${detailItem.ten}.`);
      setIsSuccessModalOpen(true);
      fetchInsuranceHistory(detailItem.manv);
      fetchData();
    } catch (err: any) {
      setErrorMsg("Lỗi khi lưu số liệu: " + err.message);
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  // --- Logic Hiệu chỉnh/Xóa bản ghi lịch sử ---
  const handleOpenEditHistory = (record: QuaTrinhDongBaoHiem) => {
    setEditingHistoryItem({ ...record });
    setIsEditHistoryModalOpen(true);
  };

  const handleOpenDeleteHistory = (record: QuaTrinhDongBaoHiem) => {
    setDeletingHistoryItem(record);
    setIsDeleteHistoryConfirmOpen(true);
  };

  const calculateInsuranceRatesForRecord = (record: QuaTrinhDongBaoHiem) => {
    const config = monthConfigs.find(m => m.thangnam === record.thangnam);
    if (!config) return record;

    const hsl = parseFloat(String(record.hsl)) || 0;
    const hscv = parseFloat(String(record.hschucvu)) || 0;
    const tongHS = parseFloat((hsl + hscv).toFixed(2));
    
    let bhxh = 0, bhyt = 0, bhtn = 0, bhatld = 0;
    
    if (!record.thaisan) {
      const salary = record.tienluongphucap || 0;
      bhxh = Math.round(((config.bhxhtruong + config.bhxhnguoild) / 100) * salary);
      bhyt = Math.round(((config.bhyttruong + config.bhytnguoild) / 100) * salary);
      bhtn = Math.round(((config.bhtntruong + config.bhtnnguoild) / 100) * salary);
      bhatld = Math.round((config.bhatldtruong / 100) * salary);
    }

    return {
      ...record,
      tongheso: tongHS,
      bhxh,
      bhyt,
      bhtn,
      bhatld
    };
  };

  const handleSaveEditHistory = async () => {
    if (!editingHistoryItem) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('QuaTrinhDongBaoHiem')
        .update({
          hsl: editingHistoryItem.hsl,
          hschucvu: editingHistoryItem.hschucvu,
          tongheso: editingHistoryItem.tongheso,
          bhxh: editingHistoryItem.bhxh,
          bhyt: editingHistoryItem.bhyt,
          bhtn: editingHistoryItem.bhtn,
          bhatld: editingHistoryItem.bhatld,
          thaisan: editingHistoryItem.thaisan
        })
        .eq('maso', editingHistoryItem.maso);

      if (error) throw error;
      
      setIsEditHistoryModalOpen(false);
      setSuccessMsg(`Đã cập nhật thay đổi số liệu bảo hiểm tháng ${editingHistoryItem.thangnam}.`);
      setIsSuccessModalOpen(true);
      if (detailItem) fetchInsuranceHistory(detailItem.manv);
    } catch (err: any) {
      setErrorMsg("Lỗi cập nhật: " + err.message);
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const executeDeleteHistory = async () => {
    if (!deletingHistoryItem) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('QuaTrinhDongBaoHiem')
        .delete()
        .eq('maso', deletingHistoryItem.maso);
      
      if (error) throw error;
      
      setIsDeleteHistoryConfirmOpen(false);
      setSuccessMsg(`Đã xóa thông tin bảo hiểm tháng ${deletingHistoryItem.thangnam}.`);
      setIsSuccessModalOpen(true);
      if (detailItem) fetchInsuranceHistory(detailItem.manv);
    } catch (err: any) {
      setErrorMsg("Lỗi khi xóa: " + err.message);
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  // --- Logic Master Participation Modal ---
  const handleOpenAdd = async () => {
    setLoadingAvailableStaff(true);
    setIsAddModalOpen(true);
    setSelectedStaff(null);
    setSelectedStaffHSL(null);
    setAddForm({ sosobaohiem: '', noidangkykcb: benhVienList[0]?.maso || 0 });
    
    try {
      const [nvRes, pbRes, insRes] = await Promise.all([
        supabase.from('DanhSachNhanVien').select('*').eq('danghiviec', false),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('ThongTinBaoHiemCaNhan').select('manv')
      ]);

      const pbs = (pbRes.data || []).map(normalizeKeys);
      const existingManvs = new Set((insRes.data || []).map(item => String(item.manv)));

      const today = new Date();
      const available = (nvRes.data || [])
        .map(item => normalizeKeys(item))
        .filter(nv => {
          if (existingManvs.has(String(nv.manv))) return false;
          const birthDate = new Date(nv.ngaysinh);
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
          if (nv.gioitinh === true || nv.gioitinh === 'true' || nv.gioitinh === 1) {
            if (age > 61) return false;
          } else {
            if (age > 57) return false;
          }
          return true;
        })
        .map(nv => {
          const pb = pbs.find(p => p.maphongban === nv.phongban);
          return { ...nv, ten_phongban: pb ? pb.giatri : nv.phongban };
        });

      setAvailableStaff(available);
    } catch (err: any) {
      setErrorMsg("Lỗi tải nhân sự khả dụng: " + (err.message || String(err)));
      setIsErrorModalOpen(true);
    } finally {
      setLoadingAvailableStaff(false);
    }
  };

  const handleSelectStaff = async (staff: any) => {
    setSelectedStaff(staff);
    setIsStaffDropdownOpen(false);
    try {
      const { data, error } = await supabase
        .from('DanhSachHSL')
        .select('hsl, hschucvu, tongheso')
        .eq('manv', staff.manv)
        .maybeSingle();
      if (error) throw error;
      setSelectedStaffHSL(data ? normalizeKeys(data) : { hsl: 0, hschucvu: 0, tongheso: 0 });
    } catch (err: any) {
      setErrorMsg("Lỗi tra cứu HSL: " + (err.message || String(err)));
      setIsErrorModalOpen(true);
      setSelectedStaffHSL({ hsl: 0, hschucvu: 0, tongheso: 0 });
    }
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) {
      setErrorMsg("Vui lòng chọn nhân sự.");
      setIsErrorModalOpen(true);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        manv: selectedStaff.manv,
        sosobaohiem: addForm.sosobaohiem,
        noidangkykcb: addForm.noidangkykcb,
        thaisan: false,
        hetthamgia: false
      };
      const { error } = await supabase.from('ThongTinBaoHiemCaNhan').insert([payload]);
      if (error) throw error;
      setIsAddModalOpen(false);
      setSuccessMsg(`Đã thêm mới hồ sơ bảo hiểm cho nhân sự ${selectedStaff.holot} ${selectedStaff.ten}.`);
      setIsSuccessModalOpen(true);
      fetchData();
    } catch (err: any) {
      setErrorMsg('Lỗi khi thêm mới: ' + err.message);
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (item: ThongTinBaoHiemCaNhan) => {
    setEditingItem({ ...item });
    setIsEditModalOpen(true);
  };

  const handleOpenDetail = (item: ThongTinBaoHiemCaNhan) => {
    setDetailItem(item);
    setIsDetailModalOpen(true);
    setInsuranceHistory([]);
    fetchInsuranceHistory(item.manv);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('ThongTinBaoHiemCaNhan')
        .update({
          sosobaohiem: editingItem.sosobaohiem,
          noidangkykcb: editingItem.noidangkykcb,
          thaisan: editingItem.thaisan,
          hetthamgia: editingItem.hetthamgia
        })
        .eq('manv', editingItem.manv);
      if (error) throw error;
      setIsEditModalOpen(false);
      setSuccessMsg('Thông tin bảo hiểm cá nhân đã được cập nhật.');
      setIsSuccessModalOpen(true);
      fetchData();
    } catch (err: any) {
      setErrorMsg('Lỗi khi lưu dữ liệu: ' + err.message);
      setIsErrorModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '---';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN');
  };

  const getUniqueValues = (key: keyof ThongTinBaoHiemCaNhan): string[] => {
    const values = insuranceList.map(item => String((item as any)[key] || ''));
    return Array.from(new Set<string>(values)).filter(v => v !== '' && v !== 'undefined').sort();
  };

  const filteredData = useMemo(() => {
    return insuranceList.filter(item => {
      const search = searchTerm.toLowerCase();
      const fullName = `${item.holot} ${item.ten}`.toLowerCase();
      const matchesSearch = fullName.includes(search) || String(item.manv).toLowerCase().includes(search);
      if (!matchesSearch) return false;
      if (filters.trinhdo && item.ten_trinhdo !== filters.trinhdo) return false;
      if (filters.chucvu && item.ten_chucvu !== filters.chucvu) return false;
      if (filters.donvi && item.ten_phongban !== filters.donvi) return false;
      if (filters.thaisan !== 'Tất cả') {
        const isThaiSan = filters.thaisan === 'Thai sản';
        if (item.thaisan !== isThaiSan) return false;
      }
      if (filters.hetthamgia !== 'Tất cả') {
        const isHet = filters.hetthamgia === 'Hết';
        if (item.hetthamgia !== isHet) return false;
      }
      return true;
    });
  }, [insuranceList, searchTerm, filters]);

  const FilterSelect = ({ label, field, options }: { label: string, field: keyof typeof filters, options: string[] }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-red-600 pl-1">{label}</label>
      <div className="relative">
        <select
          value={(filters as any)[field]}
          onChange={e => setFilters(prev => ({ ...prev, [field]: e.target.value }))}
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 appearance-none bg-white font-medium text-gray-700 outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">Tất cả</option>
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );

  return (
    <div className="max-w-[1920px] mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2.5 rounded-xl shadow-lg shadow-red-100">
            <HeartPulse className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-blue-900 tracking-tight">Danh sách CBGVNV tham gia bảo hiểm</h2>
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            onClick={() => {
              const exportData = filteredData.map((item, index) => ({
                'STT': index + 1,
                'Mã NV': item.manv,
                'Họ và Tên': `${item.holot} ${item.ten}`,
                'Giới tính': item.gioitinh ? 'Nam' : 'Nữ',
                'Ngày sinh': formatDate(item.ngaysinh),
                'Trình độ': item.ten_trinhdo,
                'Chức vụ': item.ten_chucvu,
                'Đơn vị': item.ten_phongban,
                'HSL': item.hsl,
                'Số sổ BH': item.sosobaohiem,
                'Đăng ký KCB': item.tenbenhvien,
                'Thai sản': item.thaisan ? 'Thai sản' : '',
                'Tham gia': item.hetthamgia ? 'Hết' : 'Còn'
              }));
              const ws = XLSX.utils.json_to_sheet(exportData);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "BaoHiem");
              XLSX.writeFile(wb, "DanhSachThamGiaBaoHiem.xlsx");
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-md transition-all active:scale-95 text-sm"
          >
            <FileDown className="h-4 w-4" /> Xuất excel
          </button>
          <button
            onClick={handleOpenAdd}
            className={`flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md transition-all active:scale-95 text-sm ${!canCreate && 'hidden'}`}
          >
            <Plus className="h-4 w-4" /> Thêm mới
          </button>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
          <input
            type="text"
            placeholder="Tìm kiếm nhân sự theo tên hoặc mã nhân viên..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-blue-600 bg-white font-medium shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 bg-gray-50/50 rounded-xl border border-gray-100">
          <FilterSelect label="Trình độ" field="trinhdo" options={getUniqueValues('ten_trinhdo')} />
          <FilterSelect label="Chức vụ" field="chucvu" options={getUniqueValues('ten_chucvu')} />
          <FilterSelect label="Đơn vị" field="donvi" options={getUniqueValues('ten_phongban')} />
          <FilterSelect label="Chế độ thai sản" field="thaisan" options={['Tất cả', 'Thai sản']} />
          <FilterSelect label="Hết tham gia" field="hetthamgia" options={['Tất cả', 'Còn', 'Hết']} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1800px] w-full divide-y divide-gray-200 text-left border-collapse">
            <thead className="bg-gray-50/80 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight text-center w-16">STT</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight text-center w-24">Mã NV</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight">Họ và tên</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight text-center w-24">Giới tính</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight text-center w-32">Ngày sinh</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight">Trình độ</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight">Chức vụ</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight">Đơn vị</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight text-center">HSL</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight text-center">Hệ số CV</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight text-center">Tổng hệ số</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight">Số sổ bảo hiểm</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight">Đăng ký KCB</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight text-center">Chế độ thai sản</th>
                <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight text-center">Hết tham gia</th>
                {(canUpdate || canRead) && <th className="px-4 py-4 text-xs font-normal text-red-600 tracking-tight text-center w-40">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 font-normal">
              {loading ? (
                <tr>
                  <td colSpan={16} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-red-600" />
                    <p className="mt-2 text-gray-400 text-sm font-bold tracking-widest">Đang tải dữ liệu bảo hiểm...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy nhân sự phù hợp.</td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr key={item.manv} className="hover:bg-red-50/20 transition-colors">
                    <td className="px-4 py-4 text-sm text-gray-500 text-center">{index + 1}</td>
                    <td className="px-4 py-4 text-sm text-blue-600 text-center ">{item.manv}</td>
                    <td className="px-4 py-4 text-sm text-blue-900 ">{item.holot} {item.ten}</td>
                    <td className="px-4 py-4 text-sm text-blue-700 text-center">{item.gioitinh ? 'Nam' : 'Nữ'}</td>
                    <td className="px-4 py-4 text-sm text-blue-700 text-center">{formatDate(item.ngaysinh)}</td>
                    <td className="px-4 py-4 text-sm text-blue-700">{item.ten_trinhdo}</td>
                    <td className="px-4 py-4 text-sm text-blue-700">{item.ten_chucvu}</td>
                    <td className="px-4 py-4 text-sm text-blue-700">{item.ten_phongban}</td>
                    <td className="px-4 py-4 text-sm text-blue-700 text-center">{item.hsl ?? '---'}</td>
                    <td className="px-4 py-4 text-sm text-blue-700 text-center">{item.hschucvu ?? '---'}</td>
                    <td className="px-4 py-4 text-sm text-blue-700 text-center ">{item.tongheso ?? '---'}</td>
                    <td className="px-4 py-4 text-sm text-blue-700">{item.sosobaohiem}</td>
                    <td className="px-4 py-4 text-sm text-blue-700">{item.tenbenhvien}</td>
                    <td className="px-4 py-4 text-sm text-center">
                      {item.thaisan && <span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-lg border border-red-100 font-bold text-[11px]">Thai sản</span>}
                    </td>
                    <td className="px-4 py-4 text-sm text-center">
                      <span className={`font-bold ${item.hetthamgia ? 'text-red-600' : 'text-emerald-600'}`}>
                        {item.hetthamgia ? 'Hết' : 'Còn'}
                      </span>
                    </td>
                    {(canUpdate || canRead) && (
                      <td className="px-4 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => handleOpenDetail(item)}
                            className="px-2 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 border border-indigo-100"
                          >
                            <Eye size={14} /> Xem chi tiết
                          </button>
                          {canUpdate && (
                            <button 
                              onClick={() => handleOpenEdit(item)}
                              className="px-2 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 border border-blue-100"
                            >
                              <Pencil size={14} /> Hiệu chỉnh
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Record Modal (Thêm mới Số liệu BH bắt buộc) */}
      {isMonthlyRecordModalOpen && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#f0f4f8] rounded shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 border-2 border-indigo-200">
            <div className="bg-[#1e40af] p-3 text-white flex items-center gap-2 border-b">
              <ClipboardList size={18} />
              <h3 className="text-sm font-bold">Thêm mới Số liệu BH bắt buộc</h3>
            </div>

            <div className="p-4 space-y-6">
              {/* Group 1: Thời gian và Thông tin Bảo hiểm */}
              <div className="p-4 border-2 border-blue-400 rounded relative bg-white">
                <span className="absolute -top-3 left-3 bg-white px-2 text-xs font-bold text-blue-700">Thời gian và Thông tin Bảo hiểm</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">Tháng/Năm</label>
                    <select
                      className="w-full p-2 border-2 border-blue-300 rounded text-sm font-bold text-blue-900 outline-none"
                      value={monthlyFormData.thangnam}
                      onChange={e => handleMonthlyMonthChange(e.target.value)}
                    >
                      <option value="">-- Chọn Tháng/Năm --</option>
                      {availableMonthsForCurrentStaff.map(m => (
                        <option key={m.maso} value={m.thangnam}>{m.thangnam}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">Số tiền tối thiểu quy định</label>
                    <input readOnly type="text" value={monthlyFormData.mdttquydinh.toLocaleString()} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm font-bold text-gray-600" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">Số tiền tối thiểu Trường đóng</label>
                    <input readOnly type="text" value={monthlyFormData.mdtttruong.toLocaleString()} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm font-bold text-gray-600" />
                  </div>
                </div>
              </div>

              {/* Group 2: Thông tin Bảo hiểm Trường đóng */}
              <div className="p-4 border-2 border-red-400 rounded relative bg-white">
                <span className="absolute -top-3 left-3 bg-white px-2 text-xs font-bold text-red-600">Thông tin Bảo hiểm Trường đóng</span>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">% BHXH</label>
                    <input type="number" readOnly value={monthlyFormData.bhxhtruong} className="w-full p-2 bg-gray-50 border rounded text-sm font-bold text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">% BHYT</label>
                    <input type="number" readOnly value={monthlyFormData.bhyttruong} className="w-full p-2 bg-gray-50 border rounded text-sm font-bold text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">% BHTN</label>
                    <input type="number" readOnly value={monthlyFormData.bhtntruong} className="w-full p-2 bg-gray-50 border rounded text-sm font-bold text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">% BHATLĐ</label>
                    <input type="number" readOnly value={monthlyFormData.bhatldtruong} className="w-full p-2 bg-gray-50 border rounded text-sm font-bold text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">Tổng % Trường đóng</label>
                    <input readOnly type="text" value={(monthlyFormData.bhxhtruong + monthlyFormData.bhyttruong + monthlyFormData.bhtntruong + monthlyFormData.bhatldtruong).toFixed(1)} className="w-full p-2 bg-blue-50 border-2 border-blue-200 rounded text-sm font-black text-center text-blue-800" />
                  </div>
                </div>
              </div>

              {/* Group 3: Thông tin Bảo hiểm Người LĐ đóng */}
              <div className="p-4 border-2 border-blue-400 rounded relative bg-white">
                <span className="absolute -top-3 left-3 bg-white px-2 text-xs font-bold text-blue-600">Thông tin Bảo hiểm Người LĐ đóng</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">% BHXH</label>
                    <input type="number" readOnly value={monthlyFormData.bhxhnguoild} className="w-full p-2 bg-gray-50 border rounded text-sm font-bold text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">% BHYT</label>
                    <input type="number" readOnly value={monthlyFormData.bhytnguoild} className="w-full p-2 bg-gray-50 border rounded text-sm font-bold text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">% BHTN</label>
                    <input type="number" readOnly value={monthlyFormData.bhtnnguoild} className="w-full p-2 bg-gray-50 border rounded text-sm font-bold text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">Tổng % Người LĐ đóng</label>
                    <input readOnly type="text" value={(monthlyFormData.bhxhnguoild + monthlyFormData.bhytnguoild + monthlyFormData.bhtnnguoild).toFixed(1)} className="w-full p-2 bg-blue-50 border-2 border-blue-200 rounded text-sm font-black text-center text-blue-800" />
                  </div>
                </div>
              </div>

              {/* Group 4: Thông tin Hệ số Lương, Hệ số Chức vụ và Thai sản */}
              <div className="p-4 border-2 border-red-400 rounded relative bg-white">
                <span className="absolute -top-3 left-3 bg-white px-2 text-xs font-bold text-red-600">Thông tin Hệ số Lương, Hệ số Chức vụ và Thai sản</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">Hệ số Lương</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full p-2 border-2 border-blue-300 rounded text-sm font-bold text-blue-900 outline-none text-center" 
                      value={monthlyFormData.hsl}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setMonthlyFormData(prev => ({ ...prev, hsl: val, tongheso: parseFloat((val + prev.hschucvu).toFixed(2)) }));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">Hệ số Chức vụ</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full p-2 border-2 border-blue-300 rounded text-sm font-bold text-blue-900 outline-none text-center" 
                      value={monthlyFormData.hschucvu}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setMonthlyFormData(prev => ({ ...prev, hschucvu: val, tongheso: parseFloat((prev.hsl + val).toFixed(2)) }));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-blue-700">Tổng Hệ số</label>
                    <input readOnly type="text" value={monthlyFormData.tongheso} className="w-full p-2 bg-gray-50 border-2 border-gray-200 rounded text-sm font-black text-center text-blue-800" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <label className="text-xs font-bold text-blue-700">Thai sản</label>
                    <input 
                      type="checkbox" 
                      className="w-6 h-6 border-2 border-gray-300 rounded text-blue-600" 
                      checked={monthlyFormData.thaisan}
                      onChange={e => setMonthlyFormData(prev => ({ ...prev, thaisan: e.target.checked }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 p-4 border-t border-gray-200 flex justify-end gap-3">
              <button 
                onClick={handleSaveMonthlyRecord} 
                disabled={saving || !monthlyFormData.thangnam}
                className="px-10 py-2 bg-blue-700 text-white font-bold rounded shadow-md hover:bg-blue-800 transition-all active:scale-95 disabled:bg-gray-400 text-sm flex items-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Thêm vào
              </button>
              <button 
                onClick={() => setIsMonthlyRecordModalOpen(false)}
                className="px-10 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded shadow-sm hover:bg-gray-50 transition-all text-sm"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && detailItem && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in duration-200 border border-gray-100 flex flex-col max-h-[95vh]">
            <div className="bg-[#1e40af] p-5 text-white flex justify-between items-center flex-shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <FileText size={24} /> Thông tin chi tiết bảo hiểm cá nhân
              </h3>
              <button type="button" onClick={() => setIsDetailModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                <X size={28} />
              </button>
            </div>

            <div className="p-8 space-y-10 overflow-y-auto bg-white flex-1 custom-scrollbar">
               {/* Header Actions within Detail Form */}
               {canCreate && (
                 <div className="flex justify-end gap-2">
                   <button
                     onClick={handleOpenMonthlyRecord}
                     className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 shadow-md transition-all active:scale-95 text-xs"
                     title="Thêm mới số liệu BH"
                   >
                     <ClipboardList className="h-4 w-4" /> Thêm mới
                   </button>
                 </div>
               )}

               {/* 1. Personal Header */}
               <section className="flex flex-col md:flex-row gap-8 items-start bg-gray-50 p-6 rounded-2xl border border-gray-200">
                  <div className="w-[120px] h-[160px] bg-white border border-gray-300 rounded overflow-hidden shadow-md flex-shrink-0 flex items-center justify-center relative">
                      {detailItem.hinhanh ? (
                        <img src={getGoogleDriveImageUrl(detailItem.hinhanh)} alt="Ảnh" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-gray-200"><User size={48} /></div>
                      )}
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div><label className="text-[10px] font-bold text-red-600 block mb-0.5 tracking-widest">Họ và tên</label><p className="text-sm font-black text-blue-900 ">{detailItem.holot} {detailItem.ten}</p></div>
                      <div><label className="text-[10px] font-bold text-red-600 block mb-0.5 tracking-widest">Mã nhân viên</label><p className="text-sm font-black text-red-600">#{detailItem.manv}</p></div>
                      <div><label className="text-[10px] font-bold text-red-600 block mb-0.5 tracking-widest">Giới tính</label><p className="text-sm font-bold text-gray-700">{detailItem.gioitinh ? 'Nam' : 'Nữ'}</p></div>
                      <div><label className="text-[10px] font-bold text-red-600 block mb-0.5 tracking-widest">Ngày sinh</label><p className="text-sm font-bold text-gray-700">{formatDate(detailItem.ngaysinh)}</p></div>
                      <div><label className="text-[10px] font-bold text-red-600 block mb-0.5 tracking-widest">Trình độ</label><p className="text-sm font-bold text-gray-700 italic">{detailItem.ten_trinhdo}</p></div>
                      <div><label className="text-[10px] font-bold text-red-600 block mb-0.5 tracking-widest">Chức vụ</label><p className="text-sm font-bold text-gray-700">{detailItem.ten_chucvu}</p></div>
                      <div className="md:col-span-2 lg:col-span-3"><label className="text-[10px] font-bold text-red-600 block mb-0.5 tracking-widest">Đơn vị công tác</label><p className="text-sm font-bold text-blue-800">{detailItem.ten_phongban}</p></div>
                  </div>
               </section>

               {/* 2. Insurance & Salary Details */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <section className="space-y-4 border border-gray-100 p-6 rounded-2xl shadow-sm">
                      <h4 className="text-sm font-bold text-gray-800 border-b-2 border-indigo-100 pb-2 flex items-center gap-2">
                        <Wallet size={18} className="text-indigo-500" /> Thông tin Hệ số lương và Chức vụ
                      </h4>
                      <div className="space-y-3">
                         <div className="flex justify-between border-b border-gray-50 py-1">
                            <span className="text-xs font-bold text-red-600">Hệ số lương (hsl):</span>
                            <span className="text-sm font-black text-indigo-700">{detailItem.hsl ?? '---'}</span>
                         </div>
                         <div className="flex justify-between border-b border-gray-50 py-1">
                            <span className="text-xs font-bold text-red-600">Hệ số chức vụ (hscv):</span>
                            <span className="text-sm font-black text-indigo-700">{detailItem.hschucvu ?? '---'}</span>
                         </div>
                         <div className="flex justify-between border-b border-gray-50 py-1">
                            <span className="text-xs font-bold text-red-600">Tổng hệ số (tongheso):</span>
                            <span className="text-sm font-black text-red-600">{detailItem.tongheso ?? '---'}</span>
                         </div>
                      </div>
                  </section>

                  <section className="space-y-4 border border-gray-100 p-6 rounded-2xl shadow-sm">
                      <h4 className="text-sm font-bold text-gray-800 border-b-2 border-red-100 pb-2 flex items-center gap-2">
                        <HeartPulse size={18} className="text-red-500" /> Thông tin Bảo hiểm
                      </h4>
                      <div className="space-y-3">
                         <div className="flex justify-between border-b border-gray-50 py-1">
                            <span className="text-xs font-bold text-red-600">Số sổ bảo hiểm:</span>
                            <span className="text-sm font-black text-blue-800">{detailItem.sosobaohiem || 'Chưa cập nhật'}</span>
                         </div>
                         <div className="flex flex-col border-b border-gray-50 py-1">
                            <span className="text-xs font-bold text-red-600 mb-1">Nơi đăng ký khám chữa bệnh:</span>
                            <span className="text-sm font-bold text-gray-700">{detailItem.tenbenhvien}</span>
                         </div>
                         <div className="flex justify-between pt-2">
                            <div className="flex items-center gap-2">
                               <span className="text-xs font-bold text-red-600">Thai sản:</span>
                               {detailItem.thaisan ? (
                                 <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[10px] font-black border border-red-200">Đang hưởng</span>
                               ) : (
                                 <span className="bg-gray-50 text-gray-400 px-3 py-1 rounded-full text-[10px] font-bold border border-gray-200">Không</span>
                               )}
                            </div>
                            <div className="flex items-center gap-2">
                               <span className="text-xs font-bold text-red-600">Tham gia:</span>
                               {detailItem.hetthamgia ? (
                                 <span className="bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black">Đã hết</span>
                               ) : (
                                 <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[10px] font-black">Đang tham gia</span>
                               )}
                            </div>
                         </div>
                      </div>
                  </section>
               </div>

               {/* 3. Detailed Insurance History Table */}
               <section className="space-y-4">
                  <h4 className="text-sm font-bold text-gray-800 border-b-2 border-red-600 pb-2 flex items-center gap-2">
                    <History size={18} className="text-red-600" /> Quá trình đóng bảo hiểm cá nhân
                  </h4>
                  
                  <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 text-left border-collapse">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center w-12">STT</th>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center w-16">Mã số</th>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center w-24">Tháng/Năm</th>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center">HSL</th>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center">HS Chức vụ</th>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center">Tổng HS</th>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center">Tiền lương Phụ cấp</th>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center">BHXH</th>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center">BHYT</th>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center">BHTN</th>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center">BHATLD</th>
                          <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center">Thai sản</th>
                          {(canUpdate || canDelete) && <th className="px-4 py-3 text-[11px] font-bold text-red-600 text-center">Thao tác</th>}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {loadingHistory ? (
                          <tr>
                            <td colSpan={13} className="px-6 py-10 text-center">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto text-red-600" />
                              <p className="mt-2 text-[10px] font-bold text-gray-400">Đang trích xuất số liệu...</p>
                            </td>
                          </tr>
                        ) : insuranceHistory.length === 0 ? (
                          <tr>
                            <td colSpan={13} className="px-6 py-8 text-center text-gray-400 italic text-sm">không có dữ liệu quá trình đóng bảo hiểm.</td>
                          </tr>
                        ) : (
                          insuranceHistory.map((history, idx) => (
                            <tr key={history.maso} className="hover:bg-blue-50/30 transition-colors">
                              <td className="px-4 py-3 text-sm text-gray-500 text-center font-medium">{idx + 1}</td>
                              <td className="px-4 py-3 text-sm text-blue-600 text-center font-medium">{history.maso}</td>
                              <td className="px-4 py-3 text-sm text-gray-800 text-center font-black">{history.thangnam}</td>
                              <td className="px-4 py-3 text-sm text-gray-700 text-center font-medium">{history.hsl}</td>
                              <td className="px-4 py-3 text-sm text-gray-700 text-center font-medium">{history.hschucvu}</td>
                              <td className="px-4 py-3 text-sm text-red-600 text-center font-medium">{history.tongheso}</td>
                              <td className="px-4 py-3 text-sm text-gray-800 text-center font-medium">{history.tienluongphucap?.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-blue-700 text-center font-medium">{history.bhxh?.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-blue-700 text-center font-medium">{history.bhyt?.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-blue-700 text-center font-medium">{history.bhtn?.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-blue-700 text-center font-medium">{history.bhatld?.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-center">
                                {history.thaisan ? <span className="text-red-600 font-black">Có</span> : ''}
                              </td>
                              {(canUpdate || canDelete) && (
                                <td className="px-4 py-3 text-center">
                                  <div className="flex justify-center gap-2">
                                    {canUpdate && (
                                      <button 
                                        onClick={() => handleOpenEditHistory(history)}
                                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition-colors border border-blue-100"
                                        title="Hiệu chỉnh"
                                      >
                                        <Pencil size={14} />
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button 
                                        onClick={() => handleOpenDeleteHistory(history)}
                                        className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded transition-colors border border-red-100"
                                        title="Xóa"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
               </section>
            </div>

            <div className="bg-gray-50 p-6 flex justify-center border-t border-gray-200 flex-shrink-0">
               <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-12 py-2.5 bg-blue-900 text-white font-bold rounded-xl shadow-lg hover:bg-black transition-all active:scale-95 text-sm tracking-widest"
               >
                 Đóng hồ sơ
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hiệu chỉnh Quá trình đóng bảo hiểm */}
      {isEditHistoryModalOpen && editingHistoryItem && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#f2f7ff] rounded shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border-2 border-indigo-200">
            <div className="bg-[#1e40af] p-3 text-white flex items-center gap-2 border-b">
              <Pencil size={18} />
              <h3 className="text-sm font-bold tracking-tight">Hiệu chỉnh quá trình đóng bảo hiểm tháng {editingHistoryItem.thangnam}</h3>
            </div>

            <div className="p-4 space-y-6">
              {/* Group 1: HSL và Chức vụ */}
              <div className="p-4 border-2 border-red-400 rounded relative bg-white">
                <span className="absolute -top-3 left-3 bg-white px-2 text-[11px] font-bold text-red-600">HSL và Chức vụ</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">HSL</label>
                    <input 
                      type="number" step="0.01"
                      className="w-full p-2 border border-gray-300 rounded text-sm font-bold text-black bg-white outline-none focus:ring-1 focus:ring-blue-500"
                      value={editingHistoryItem.hsl}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditingHistoryItem(calculateInsuranceRatesForRecord({ ...editingHistoryItem, hsl: val }));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">Hệ số CV</label>
                    <input 
                      type="number" step="0.01"
                      className="w-full p-2 border border-gray-300 rounded text-sm font-bold text-black bg-white outline-none focus:ring-1 focus:ring-blue-500"
                      value={editingHistoryItem.hschucvu}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setEditingHistoryItem(calculateInsuranceRatesForRecord({ ...editingHistoryItem, hschucvu: val }));
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">Tổng HS</label>
                    <input readOnly type="text" value={editingHistoryItem.tongheso} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm font-black text-blue-800 text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">Tiền lương Phụ cấp</label>
                    <input readOnly type="text" value={editingHistoryItem.tienluongphucap?.toLocaleString()} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm font-black text-gray-700 text-right" />
                  </div>
                </div>
              </div>

              {/* Group 2: Bảo hiểm và Thai sản */}
              <div className="p-4 border-2 border-blue-400 rounded relative bg-white">
                <span className="absolute -top-3 left-3 bg-white px-2 text-[11px] font-bold text-blue-700">BHXH, BHYT, BHTN, BHATLAD và Thai sản</span>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">BHXH</label>
                    <input readOnly type="text" value={editingHistoryItem.bhxh?.toLocaleString()} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm font-bold text-blue-800 text-right" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">BHYT</label>
                    <input readOnly type="text" value={editingHistoryItem.bhyt?.toLocaleString()} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm font-bold text-blue-800 text-right" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">BHTN</label>
                    <input readOnly type="text" value={editingHistoryItem.bhtn?.toLocaleString()} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm font-bold text-blue-800 text-right" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-700">BHATLĐ</label>
                    <input readOnly type="text" value={editingHistoryItem.bhatld?.toLocaleString()} className="w-full p-2 bg-gray-50 border border-gray-300 rounded text-sm font-bold text-blue-800 text-right" />
                  </div>
                  <div className="flex flex-col items-center gap-1 mb-1">
                    <label className="text-[11px] font-bold text-gray-700">Thai sản</label>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                      checked={editingHistoryItem.thaisan}
                      onChange={e => {
                        setEditingHistoryItem(calculateInsuranceRatesForRecord({ ...editingHistoryItem, thaisan: e.target.checked }));
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 p-4 border-t border-gray-200 flex justify-start gap-2">
              <button 
                onClick={handleSaveEditHistory}
                disabled={saving}
                className="flex items-center gap-2 px-8 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded shadow-sm hover:bg-blue-50 hover:text-blue-700 transition-all text-xs"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} className="text-gray-400" />} Lưu
              </button>
              <button 
                onClick={() => setIsEditHistoryModalOpen(false)}
                className="flex items-center gap-2 px-8 py-2 bg-white border border-gray-300 text-gray-700 font-bold rounded shadow-sm hover:bg-red-50 hover:text-red-700 transition-all text-xs"
              >
                <X size={16} className="text-red-500" /> Kết thúc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Xóa Quá trình đóng bảo hiểm */}
      {isDeleteHistoryConfirmOpen && deletingHistoryItem && (
        <div className="fixed inset-0 z-[210] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-red-100">
            <div className="bg-red-600 p-5 text-white flex items-center gap-3">
              <AlertCircle className="h-7 w-7" />
              <h3 className="text-lg font-bold">Xác nhận xóa</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className="text-gray-800 font-bold text-base leading-relaxed">
                Bạn đồng ý xóa thông tin bảo hiểm tháng/năm <span className="text-red-600">{deletingHistoryItem.thangnam}</span>?
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center gap-3 border-t border-gray-100">
              <button 
                onClick={executeDeleteHistory}
                disabled={saving}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-md text-xs "
              >
                {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Đồng ý'}
              </button>
              <button 
                onClick={() => setIsDeleteHistoryConfirmOpen(false)}
                className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all text-xs "
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Master Participation Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="bg-[#1e40af] p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3">
                <UserPlus size={24} />
                Thêm mới CBGVNV tham gia BH bắt buộc
              </h3>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                <X size={28} />
              </button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto">
              <section className="space-y-4">
                <div className="relative" ref={staffDropdownRef}>
                  <label className="text-sm font-bold text-red-600 mb-2 block tracking-wide">Chọn nhân sự tham gia bảo hiểm *</label>
                  <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 bg-white transition-all">
                    <input 
                      readOnly
                      className="block w-full border-none px-4 py-3 text-sm font-bold text-gray-900 focus:ring-0 bg-white cursor-pointer" 
                      placeholder={selectedStaff ? `${selectedStaff.holot} ${selectedStaff.ten} (${selectedStaff.manv})` : "Click để tìm kiếm nhân viên..."}
                      onClick={() => {
                        setIsStaffDropdownOpen(true);
                        setTimeout(() => staffSearchRef.current?.focus(), 50);
                      }}
                      value={selectedStaff ? `${selectedStaff.holot} ${selectedStaff.ten}` : ""}
                    />
                    <div className="bg-gray-100 flex items-center px-4 border-l border-gray-200">
                      <MoreHorizontal className="h-5 w-5 text-gray-500" />
                    </div>
                  </div>

                  {isStaffDropdownOpen && (
                    <div className="absolute z-[110] left-0 right-0 mt-1 bg-white border border-gray-300 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-60 animate-in fade-in slide-in-from-top-2">
                       <div className="p-3 border-b border-gray-100 bg-gray-50">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input 
                              ref={staffSearchRef}
                              type="text" 
                              placeholder="Gõ mã, họ tên hoặc đơn vị..."
                              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                              value={staffSearchQuery}
                              onChange={e => setStaffSearchQuery(e.target.value)}
                            />
                          </div>
                       </div>
                       <div className="overflow-y-auto">
                          {loadingAvailableStaff ? (
                            <div className="p-6 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto text-blue-600" /></div>
                          ) : filteredStaffInDropdown.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 italic text-sm">Không tìm thấy nhân sự phù hợp hoặc nhân sự không đủ điều kiện.</div>
                          ) : (
                            filteredStaffInDropdown.map(st => (
                              <div key={st.manv} onClick={() => handleSelectStaff(st)} className="p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center transition-colors group">
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600">
                                      <User size={16} />
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700">{st.holot} {st.ten}</p>
                                      <p className="text-[10px] text-gray-500">Mã NV: {st.manv}</p>
                                    </div>
                                 </div>
                                 <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{st.ten_phongban}</span>
                              </div>
                            ))
                          )}
                       </div>
                    </div>
                  )}
                </div>

                {selectedStaff && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-blue-50 rounded-2xl border border-blue-100 shadow-inner animate-in fade-in duration-300">
                    <div>
                      <label className="text-[10px] font-bold text-blue-500 block mb-1">Họ và tên</label>
                      <p className="text-sm font-bold text-blue-900">{selectedStaff.holot} {selectedStaff.ten}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-blue-500 block mb-1">Mã nhân viên</label>
                      <p className="text-sm font-bold text-red-600">{selectedStaff.manv}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-blue-500 block mb-1">Đơn vị công tác</label>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-gray-400" />
                        <p className="text-sm font-bold text-blue-800">{selectedStaff.ten_phongban}</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-6">
                <h4 className="text-sm font-bold text-gray-800 border-b-2 border-indigo-100 pb-2 flex items-center gap-2 tracking-widest">
                  <Wallet size={18} className="text-indigo-500" />
                  Thông tin HSL và bảo hiểm
                </h4>
                
                {selectedStaffHSL && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-gray-50 rounded-2xl border border-gray-200 animate-in fade-in duration-300">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Hệ số lương (HSL)</label>
                      <p className="text-lg font-black text-indigo-700">{selectedStaffHSL.hsl ?? '---'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Hệ số chức vụ</label>
                      <p className="text-lg font-black text-indigo-700">{selectedStaffHSL.hschucvu ?? '---'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Tổng hệ số</label>
                      <p className="text-lg font-black text-red-600">{selectedStaffHSL.tongheso ?? '---'}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-bold text-red-600 mb-2 block">Số sổ bảo hiểm</label>
                    <input 
                      type="text"
                      placeholder="Nhập số sổ bảo hiểm..."
                      className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-blue-600 shadow-sm"
                      value={addForm.sosobaohiem}
                      onChange={e => setAddForm({ ...addForm, sosobaohiem: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-red-600 mb-2 block">Đăng ký KCB (chọn tên bệnh viện) *</label>
                    <div className="relative">
                      <select
                        className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer shadow-sm"
                        value={addForm.noidangkykcb}
                        onChange={e => setAddForm({ ...addForm, noidangkykcb: parseInt(e.target.value) })}
                      >
                        {benhVienList.map(bv => (
                          <option key={bv.maso} value={bv.maso}>{bv.tenbenhvien}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="bg-gray-100 p-6 flex justify-end gap-3 border-t border-gray-200 flex-shrink-0">
              <button 
                type="button" 
                onClick={() => setIsAddModalOpen(false)}
                className="px-8 py-3 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 shadow-md hover:bg-gray-50 transition-all text-xs"
              >
                Kết thúc
              </button>
              <button 
                type="button" 
                disabled={saving || !selectedStaff}
                onClick={handleSaveAdd}
                className="px-12 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:bg-gray-400 disabled:shadow-none flex items-center gap-2 text-xs"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Thêm vào
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Participation Modal */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#f2f7ff] rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border border-gray-300">
            <div className="bg-white p-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Pencil size={18} className="text-blue-600" />
                Hiệu chỉnh thông tin bảo hiểm cá nhân
              </h3>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-8 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
                  <span className="text-xs font-bold text-gray-400">Thông tin cá nhân</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                   <div className="flex flex-col gap-1">
                      <label className="text-sm font-normal text-red-600">Họ và tên</label>
                      <input 
                        type="text" 
                        readOnly 
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 cursor-not-allowed shadow-inner"
                        value={`${editingItem.holot} ${editingItem.ten}`}
                      />
                   </div>
                   <div className="flex flex-col gap-1">
                      <label className="text-sm font-normal text-red-600">Đơn vị</label>
                      <input 
                        type="text" 
                        readOnly 
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 cursor-not-allowed shadow-inner"
                        value={editingItem.ten_phongban || ''}
                      />
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-200 pb-1">
                  <span className="text-xs font-bold text-gray-400">Thông tin bảo hiểm</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-normal text-red-600">Số sổ bảo hiểm</label>
                    <input 
                      type="text"
                      className="w-full p-2.5 border border-red-200 rounded-xl text-sm font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      value={editingItem.sosobaohiem || ''}
                      onChange={e => setEditingItem({...editingItem, sosobaohiem: e.target.value})}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-normal text-red-600">Đăng ký KCB</label>
                    <select
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={editingItem.noidangkykcb}
                      onChange={e => setEditingItem({...editingItem, noidangkykcb: parseInt(e.target.value)})}
                    >
                      {benhVienList.map(bv => (
                        <option key={bv.maso} value={bv.maso}>{bv.tenbenhvien}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-12 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <span className="text-sm font-normal text-red-600">Thai sản</span>
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={editingItem.thaisan}
                        onChange={e => setEditingItem({...editingItem, thaisan: e.target.checked})}
                      />
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <span className="text-sm font-normal text-red-600">Hết tham gia</span>
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={editingItem.hetthamgia}
                        onChange={e => setEditingItem({...editingItem, hetthamgia: e.target.checked})}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-between gap-4 pt-6 border-t border-gray-200">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 py-3 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 shadow-md hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <Save size={18} className="text-gray-400" />
                  <span>Lưu</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 shadow-md hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <X size={18} className="text-red-500" />
                  <span>Kết thúc</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-[250] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-emerald-100">
            <div className="bg-emerald-600 p-5 text-white flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7" />
              <h3 className="text-lg font-bold">Thông báo</h3>
            </div>
            <div className="p-10 text-center space-y-4">
              <div className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                <CheckCircle2 size={40} />
              </div>
              <p className="text-gray-800 font-bold text-lg leading-relaxed">{successMsg}</p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-center border-t border-gray-50">
              <button 
                onClick={() => setIsSuccessModalOpen(false)}
                className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100 text-xs tracking-widest"
              >
                Kết thúc
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
              <p className="text-gray-800 font-bold text-lg leading-relaxed">{errorMsg}</p>
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

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 10px;
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};