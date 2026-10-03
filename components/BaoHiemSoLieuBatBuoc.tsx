
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { QuaTrinhDongBaoHiem, TiLeDongBH, NhanVien, DanhSachHSL } from '../types';
import { 
  X, FileText, Search, Loader2, ChevronDown, 
  AlertCircle, FileDown, ShieldAlert, RefreshCw, Plus, Save, Database, CheckCircle2, Pencil, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

export const BaoHiemSoLieuBatBuoc: React.FC<{ onCancel: () => void }> = ({ onCancel }) => {
  const [months, setMonths] = useState<TiLeDongBH[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [currentMonthRatios, setCurrentMonthRatios] = useState<TiLeDongBH | null>(null);
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [insuranceData, setInsuranceData] = useState<QuaTrinhDongBaoHiem[]>([]);
  const [nameSearch, setNameSearch] = useState('');
  
  const [filters, setFilters] = useState({
    donvi: '',
    hsl: '',
    hschucvu: '',
    tongheso: '',
    tienluongphucap: '',
    thaisan: 'Tất cả'
  });

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [addMonth, setAddMonth] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [alertBtnText, setAlertBtnText] = useState('Đã hiểu');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Edit & Delete states
  const [editingRecord, setEditingRecord] = useState<QuaTrinhDongBaoHiem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [originalEditRecord, setOriginalEditRecord] = useState<QuaTrinhDongBaoHiem | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<QuaTrinhDongBaoHiem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  // Fix: Added missing 'saving' state for loading handling in Edit/Delete modals
  const [saving, setSaving] = useState(false);

  const fetchMonths = async () => {
    setLoadingMonths(true);
    try {
      const { data, error } = await supabase
        .from('ThongTinBaoHiemHangThang')
        .select('*')
        .order('maso', { ascending: false });
      if (error) throw error;

      const sortedData = (data || []).sort((a: any, b: any) => {
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

      setMonths(sortedData);
      if (sortedData && sortedData.length > 0 && !selectedMonth) {
        setSelectedMonth(sortedData[0].thangnam);
      }
    } catch (err: any) {
      setAlertMsg("Lỗi tải danh mục tháng: " + (err.message || String(err)));
      setShowAlert(true);
    } finally {
      setLoadingMonths(false);
    }
  };

  useEffect(() => {
    fetchMonths();
  }, []);

  const toNumber = (value: any) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const toInt = (value: any) => Math.round(toNumber(value));

  const setAlertMessage = (msg: string, btnText = 'Đã hiểu') => {
    setAlertMsg(msg);
    setAlertBtnText(btnText);
    setShowAlert(true);
  };

  const generatePreviewByMonth = async (monthValue: string, showExistsNotice = true) => {
    const { data: monthConfigRaw, error: monthErr } = await supabase
      .from('ThongTinBaoHiemHangThang')
      .select('*')
      .eq('thangnam', monthValue)
      .maybeSingle();

    if (monthErr) throw monthErr;

    if (!monthConfigRaw) {
      setAlertMessage(`Tháng/năm ${monthValue} chưa được cấu hình tỉ lệ đóng bảo hiểm!`);
      return { ok: false, exists: false };
    }

    const monthConfig = normalizeKeys(monthConfigRaw);
    setCurrentMonthRatios(monthConfig as TiLeDongBH);

    if (monthConfig.dacosolieu === true) {
      if (showExistsNotice) {
        setAlertMessage(`Số liệu BH bắt buộc của tháng/năm ${monthValue} đã có, hãy bấm nút “Tải danh sách” để xem số liệu!`);
      }
      return { ok: false, exists: true };
    }

    const [bhcnRes, nvRes, hslRes, pbRes] = await Promise.all([
      supabase.from('ThongTinBaoHiemCaNhan').select('manv, thaisan, hetthamgia').eq('hetthamgia', false),
      supabase.from('DanhSachNhanVien').select('manv, holot, ten, phongban, danghiviec').eq('danghiviec', false),
      supabase.from('DanhSachHSL').select('manv, hsl, hschucvu, tongheso, hetthamgia').eq('hetthamgia', false),
      supabase.from('DanhMucPhongBan').select('maphongban, giatri')
    ]);

    if (bhcnRes.error) throw bhcnRes.error;
    if (nvRes.error) throw nvRes.error;
    if (hslRes.error) throw hslRes.error;
    if (pbRes.error) throw pbRes.error;

    const bhcnList = (bhcnRes.data || []).map(normalizeKeys);
    const activeNvs = (nvRes.data || []).map(normalizeKeys);
    const activeHsls = (hslRes.data || []).map(normalizeKeys);
    const pbs = (pbRes.data || []).map(normalizeKeys);

    const generatedList: QuaTrinhDongBaoHiem[] = [];

    bhcnList.forEach((bhcn) => {
      const manv = String(bhcn.manv || '').trim();
      if (!manv) return;

      const nv = activeNvs.find(e => String(e.manv || '').trim() === manv);
      const hslItem = activeHsls.find(h => String(h.manv || '').trim() === manv);
      if (!nv || !hslItem) return;

      const pb = pbs.find(p => String(p.maphongban || '').trim() === String(nv.phongban || '').trim());
      const hsl = toNumber(hslItem.hsl);
      const hschucvu = toNumber(hslItem.hschucvu);
      const tonghesoRaw = toNumber(hslItem.tongheso);
      const tongheso = tonghesoRaw > 0 ? tonghesoRaw : Number((hsl + hschucvu).toFixed(2));

      const mdttquydinh = toNumber(monthConfig.mdttquydinh);
      const mdtttruong = toNumber(monthConfig.mdtttruong);
      const luongTheoTruong = tongheso * mdtttruong;
      const tienluongphucapRaw = luongTheoTruong < mdttquydinh ? mdttquydinh : luongTheoTruong;
      const tienluongphucap = toInt(tienluongphucapRaw);

      const bhxhRate = (toNumber(monthConfig.bhxhtruong) + toNumber(monthConfig.bhxhnguoild)) / 100;
      const bhytRate = (toNumber(monthConfig.bhyttruong) + toNumber(monthConfig.bhytnguoild)) / 100;
      const bhtnRate = (toNumber(monthConfig.bhtntruong) + toNumber(monthConfig.bhtnnguoild)) / 100;
      const bhatldRate = toNumber(monthConfig.bhatldtruong) / 100;

      const isThaiSan = bhcn.thaisan === true || bhcn.thaisan === 'true' || bhcn.thaisan === 1 || bhcn.thaisan === '1';

      let bhxh = toInt(bhxhRate * tienluongphucap);
      let bhyt = toInt(bhytRate * tienluongphucap);
      let bhtn = toInt(bhtnRate * tienluongphucap);
      let bhatld = toInt(bhatldRate * tienluongphucap);

      if (isThaiSan) {
        bhxh = 0;
        bhyt = 0;
        bhtn = 0;
        bhatld = 0;
      }

      generatedList.push({
        maso: 0,
        thangnam: monthValue,
        manv,
        holot: nv.holot,
        ten: nv.ten,
        ten_phongban: pb ? pb.giatri : nv.phongban,
        hsl,
        hschucvu,
        tongheso,
        tienluongphucap,
        bhxh,
        bhyt,
        bhtn,
        bhatld,
        thaisan: isThaiSan
      });
    });

    if (generatedList.length === 0) {
      setAlertMessage('Không tìm thấy nhân sự thỏa mãn điều kiện để tạo số liệu.');
      return { ok: false, exists: false };
    }

    setInsuranceData(generatedList);
    setSelectedMonth(monthValue);
    setNameSearch('');
    setIsPreviewMode(true);
    setShowTable(true);

    return { ok: true, exists: false };
  };

  const handleGenerateList = async () => {
    if (!selectedMonth) return;
    setLoadingData(true);
    setShowTable(false);
    setIsPreviewMode(false);
    
    try {
      // Get ratios for the selected month to use in editing calculation
      const config = months.find(m => m.thangnam === selectedMonth);
      setCurrentMonthRatios(config || null);

      const { data: rawInsurance, error: insError } = await supabase
        .from('QuaTrinhDongBaoHiem')
        .select('*')
        .eq('thangnam', selectedMonth);

      if (insError) throw insError;

      if (!rawInsurance || rawInsurance.length === 0) {
        setAlertMsg(`Số liệu bảo hiểm bắt buộc của tháng/năm ${selectedMonth} hiện chưa có!`);
        setShowAlert(true);
        setLoadingData(false);
        return;
      }

      const [nvRes, pbRes] = await Promise.all([
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, phongban'),
        supabase.from('DanhMucPhongBan').select('maphongban, giatri')
      ]);

      const nvs = (nvRes.data || []).map(normalizeKeys);
      const pbs = (pbRes.data || []).map(normalizeKeys);

      const joinedData = rawInsurance.map(item => {
        const base = normalizeKeys(item) as QuaTrinhDongBaoHiem;
        const nv = nvs.find(e => String(e.manv).trim() === String(base.manv).trim());
        const pb = pbs.find(p => String(p.maphongban).trim() === String(nv?.phongban).trim());

        return {
          ...base,
          holot: nv?.holot || '---',
          ten: nv?.ten || '---',
          ten_phongban: pb?.giatri || nv?.phongban || '---'
        };
      });

      setInsuranceData(joinedData);
      setShowTable(true);
    } catch (err: any) {
      setAlertMsg("Lỗi truy vấn dữ liệu: " + err.message);
      setShowAlert(true);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateData = async () => {
    if (!addMonth) return;
    setGenerating(true);
    
    try {
      const result = await generatePreviewByMonth(addMonth, false);
      if (!result.ok && result.exists) {
        setAlertMessage(`Tháng/năm ${addMonth} đã có số liệu bảo hiểm bắt buộc, hãy chọn tháng/năm chưa có số liệu để thực hiện tạo dữ liệu!`);
      }
      if (result.ok) {
        setIsAddModalOpen(false);
      }
    } catch (err: any) {
      setAlertMessage("Lỗi khi tạo số liệu: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateListBySelectedMonth = async () => {
    if (!selectedMonth) return;
    setLoadingData(true);
    try {
      await generatePreviewByMonth(selectedMonth, true);
    } catch (err: any) {
      setAlertMessage('Lỗi khi tạo danh sách: ' + (err.message || String(err)));
    } finally {
      setLoadingData(false);
    }
  };

  const handleSavePreview = async () => {
    setGenerating(true);
    try {
      const payload = insuranceData.map(item => ({
        thangnam: item.thangnam,
        manv: item.manv,
        hsl: item.hsl,
        hschucvu: item.hschucvu,
        tongheso: item.tongheso,
        tienluongphucap: toInt(item.tienluongphucap),
        bhxh: toInt(item.bhxh),
        bhyt: toInt(item.bhyt),
        bhtn: toInt(item.bhtn),
        bhatld: toInt(item.bhatld),
        thaisan: item.thaisan
      }));

      const { error: saveErr } = await supabase.from('QuaTrinhDongBaoHiem').insert(payload);
      if (saveErr) throw saveErr;

      const { error: updateErr } = await supabase
        .from('ThongTinBaoHiemHangThang')
        .update({ dacosolieu: true })
        .eq('thangnam', selectedMonth);
      
      if (updateErr) throw updateErr;

      setSuccessMsg(`Số liệu BH bắt buộc của tháng/năm ${selectedMonth} đã lưu !`);
      setShowSuccess(true);
      setIsPreviewMode(false);
      fetchMonths();
    } catch (err: any) {
      setAlertMessage("Lỗi khi lưu dữ liệu: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // --- Edit Logic ---
  const handleOpenEdit = (record: QuaTrinhDongBaoHiem) => {
    setEditingRecord({ ...record });
    setOriginalEditRecord({ ...record });
    setIsEditModalOpen(true);
  };

  const updateCalculations = (updated: QuaTrinhDongBaoHiem) => {
    if (!currentMonthRatios) return updated;
    const rates = normalizeKeys(currentMonthRatios);
    
    const hsl = parseFloat(String(updated.hsl)) || 0;
    const hscv = parseFloat(String(updated.hschucvu)) || 0;
    const tong = parseFloat((hsl + hscv).toFixed(2));
    
    let bhxh = 0, bhyt = 0, bhtn = 0, bhatld = 0;
    
    if (!updated.thaisan) {
      const luong = updated.tienluongphucap || 0;
      bhxh = Math.round(((rates.bhxhtruong + rates.bhxhnguoild) / 100) * luong);
      bhyt = Math.round(((rates.bhyttruong + rates.bhytnguoild) / 100) * luong);
      bhtn = Math.round(((rates.bhtntruong + rates.bhtnnguoild) / 100) * luong);
      bhatld = Math.round((rates.bhatldtruong / 100) * luong);
    }

    return {
      ...updated,
      tongheso: tong,
      bhxh,
      bhyt,
      bhtn,
      bhatld
    };
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setSaving(true);
    try {
      const { holot, ten, ten_phongban, ...payload } = editingRecord as any;
      const normalizedPayload = {
        ...payload,
        tienluongphucap: toInt(payload.tienluongphucap),
        bhxh: toInt(payload.bhxh),
        bhyt: toInt(payload.bhyt),
        bhtn: toInt(payload.bhtn),
        bhatld: toInt(payload.bhatld)
      };
      const { error } = await supabase
        .from('QuaTrinhDongBaoHiem')
        .update(normalizedPayload)
        .eq('maso', editingRecord.maso);

      if (error) throw error;
      
      setSuccessMsg("Đã cập nhập số liệu thay đổi.");
      setShowSuccess(true);
      setIsEditModalOpen(false);
      handleGenerateList(); // Refresh table
    } catch (err: any) {
      setAlertMsg("Lỗi khi cập nhật: " + err.message);
      setShowAlert(true);
    } finally {
      setSaving(false);
    }
  };

  const isEditChanged = useMemo(() => {
    if (!editingRecord || !originalEditRecord) return false;
    return (
      editingRecord.hsl !== originalEditRecord.hsl ||
      editingRecord.hschucvu !== originalEditRecord.hschucvu ||
      editingRecord.thaisan !== originalEditRecord.thaisan
    );
  }, [editingRecord, originalEditRecord]);

  // --- Delete Logic ---
  const handleOpenDelete = (record: QuaTrinhDongBaoHiem) => {
    setDeletingRecord(record);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!deletingRecord) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('QuaTrinhDongBaoHiem')
        .delete()
        .eq('maso', deletingRecord.maso);
      
      if (error) throw error;
      
      setIsDeleteModalOpen(false);
      handleGenerateList(); // Refresh table
    } catch (err: any) {
      setAlertMsg("Lỗi khi xóa: " + err.message);
      setShowAlert(true);
    } finally {
      setSaving(false);
    }
  };

  const getUniqueValues = (key: keyof QuaTrinhDongBaoHiem | 'ten_phongban') => {
    const values = insuranceData.map(item => String((item as any)[key] || ''));
    return Array.from(new Set(values)).filter(v => v !== '' && v !== 'undefined').sort();
  };

  const filteredList = useMemo(() => {
    return insuranceData
      .filter(item => {
        if (nameSearch.trim()) {
          const fullName = `${item.holot} ${item.ten}`.toLowerCase();
          if (!fullName.includes(nameSearch.toLowerCase())) return false;
        }
        if (filters.donvi && item.ten_phongban !== filters.donvi) return false;
        if (filters.hsl && String(item.hsl) !== filters.hsl) return false;
        if (filters.hschucvu && String(item.hschucvu) !== filters.hschucvu) return false;
        if (filters.tongheso && String(item.tongheso) !== filters.tongheso) return false;
        if (filters.tienluongphucap && String(item.tienluongphucap) !== filters.tienluongphucap) return false;
        if (filters.thaisan !== 'Tất cả') {
          const isThaiSan = filters.thaisan === 'Thai sản';
          if (item.thaisan !== isThaiSan) return false;
        }
        return true;
      })
      .sort((a, b) => (a.ten_phongban || '').localeCompare(b.ten_phongban || ''));
  }, [insuranceData, filters, nameSearch]);

  const handleExportExcel = () => {
    const exportData = filteredList.map((item, index) => ({
      'STT': index + 1,
      'Mã số': item.maso,
      'Mã NV': item.manv,
      'Họ và tên CBGVNV': `${item.holot} ${item.ten}`,
      'Đơn vị': item.ten_phongban,
      'Hệ số lương': item.hsl,
      'Hệ số chức vụ': item.hschucvu,
      'Tổng hệ số': item.tongheso,
      'Tiền lương phụ cấp': item.tienluongphucap,
      'BHXH': item.bhxh,
      'BHYT': item.bhyt,
      'BHTN': item.bhtn,
      'BHATLD': item.bhatld,
      'Thai sản': item.thaisan ? 'Thai sản' : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BH_BatBuoc");
    XLSX.writeFile(wb, `DanhSach_BH_BatBuoc_${selectedMonth.replace(/\//g, '_')}.xlsx`);
  };

  if (showTable) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500 max-w-[1920px] mx-auto pb-10 px-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start gap-6">
           <div className="flex items-start gap-3 flex-1">
              <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg mt-1">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-3 w-full">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-gray-800">Danh sách lao động tham gia bảo hiểm bắt buộc tháng {selectedMonth}</h2>
                  <p className="text-[11px] font-bold text-red-600 tracking-widest mt-1">Dữ liệu được trích từ hệ thống quản lý số liệu bảo hiểm DAU</p>
                </div>
                <div className="relative max-w-md">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
                   <input 
                      type="text"
                      placeholder="Tìm nhanh họ lót hoặc tên..."
                      className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-black shadow-sm"
                      value={nameSearch}
                      onChange={(e) => setNameSearch(e.target.value)}
                   />
                </div>
              </div>
           </div>

           <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
             {isPreviewMode ? (
               <>
                <button onClick={handleExportExcel} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all text-xs shadow-md">
                  <FileDown size={16} /> Xuất excel
                </button>
                <button onClick={handleSavePreview} disabled={generating} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-xs shadow-md disabled:bg-gray-400">
                  {generating ? <Loader2 className="animate-spin h-4 w-4" /> : <Save size={16} />} Lưu dữ liệu
                 </button>
                 <button onClick={() => { setShowTable(false); setIsPreviewMode(false); }} className="flex items-center gap-2 px-6 py-2 bg-gray-100 text-red-600 font-bold rounded-xl hover:bg-gray-200 transition-all text-xs border border-gray-200">
                    <X size={16} /> Đóng hồ sơ
                 </button>
               </>
             ) : (
               <>
                 <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-xs shadow-md">
                    <Plus size={16} /> Thêm mới
                 </button>
                 <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all text-xs shadow-md">
                    <FileDown size={16} /> Xuất excel
                 </button>
                 <button onClick={() => setShowTable(false)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all text-xs border border-gray-200">
                    <RefreshCw size={16} className="text-blue-600" /> Quay lại
                 </button>
               </>
             )}
           </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1800px] w-full divide-y divide-gray-200 text-left border-collapse">
              <thead className="bg-gray-50/80 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center w-16">STT</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center w-24">Mã số</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center w-24">Mã NV</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight w-48">Họ và tên CBGVNV</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight w-40">Đơn vị</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center">Hệ số lương</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center">Hệ số chức vụ</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center">Tổng hệ số</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center">Tiền lương phụ cấp</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center">BHXH</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center">BHYT</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center">BHTN</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center">BHATLD</th>
                  <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center">Thai sản</th>
                  {!isPreviewMode && <th className="px-3 py-4 text-xs font-bold text-red-600 tracking-tight text-center">Thao tác</th>}
                </tr>
                <tr className="bg-white border-b border-gray-100">
                  <th className="px-1 py-1"></th><th className="px-1 py-1"></th><th className="px-1 py-1"></th><th className="px-1 py-1"></th>
                  <th className="px-2 py-1.5">
                    <select value={filters.donvi} onChange={e => setFilters({...filters, donvi: e.target.value})} className="w-full text-[10px] border border-gray-300 rounded px-1 py-1 font-bold bg-white text-black">
                      <option value="">Tất cả</option>
                      {getUniqueValues('ten_phongban').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </th>
                  <th className="px-2 py-1.5">
                    <select value={filters.hsl} onChange={e => setFilters({...filters, hsl: e.target.value})} className="w-full text-[10px] border border-gray-300 rounded px-1 py-1 font-bold bg-white text-black text-center">
                      <option value="">Tất cả</option>
                      {getUniqueValues('hsl').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </th>
                  <th className="px-2 py-1.5">
                    <select value={filters.hschucvu} onChange={e => setFilters({...filters, hschucvu: e.target.value})} className="w-full text-[10px] border border-gray-300 rounded px-1 py-1 font-bold bg-white text-black text-center">
                      <option value="">Tất cả</option>
                      {getUniqueValues('hschucvu').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </th>
                  <th className="px-2 py-1.5">
                    <select value={filters.tongheso} onChange={e => setFilters({...filters, tongheso: e.target.value})} className="w-full text-[10px] border border-gray-300 rounded px-1 py-1 font-bold bg-white text-black text-center">
                      <option value="">Tất cả</option>
                      {getUniqueValues('tongheso').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </th>
                  <th className="px-2 py-1.5">
                    <select value={filters.tienluongphucap} onChange={e => setFilters({...filters, tienluongphucap: e.target.value})} className="w-full text-[10px] border border-gray-300 rounded px-1 py-1 font-bold bg-white text-black text-center">
                      <option value="">Tất cả</option>
                      {getUniqueValues('tienluongphucap').map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </th>
                  <th className="px-1 py-1"></th><th className="px-1 py-1"></th><th className="px-1 py-1"></th><th className="px-1 py-1"></th>
                  <th className="px-2 py-1.5">
                    <select value={filters.thaisan} onChange={e => setFilters({...filters, thaisan: e.target.value})} className="w-full text-[10px] border border-gray-300 rounded px-1 py-1 font-bold bg-white text-black text-center">
                      <option value="Tất cả">Tất cả</option>
                      <option value="Thai sản">Thai sản</option>
                    </select>
                  </th>
                  {!isPreviewMode && <th className="px-1 py-1"></th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredList.map((item, index) => (
                  <tr key={item.manv} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-3.5 text-sm text-blue-600 text-center">{index + 1}</td>
                    <td className="px-3 py-3.5 text-sm text-blue-600 text-center">{item.maso || '---'}</td>
                    <td className="px-3 py-3.5 text-sm text-blue-600 text-center">{item.manv}</td>
                    <td className="px-3 py-3.5 text-sm font-normal text-blue-600 max-w-[192px] truncate" title={`${item.holot} ${item.ten}`}>{item.holot} {item.ten}</td>
                    <td className="px-4 py-4 text-sm text-blue-600 font-sm max-w-[160px] truncate" title={item.ten_phongban}>{item.ten_phongban}</td>
                    <td className="px-3 py-3.5 text-sm text-center text-blue-600 font-normal">{item.hsl}</td>
                    <td className="px-3 py-3.5 text-sm text-center text-blue-600 font-normal">{item.hschucvu}</td>
                    <td className="px-3 py-3.5 text-sm text-center text-blue-600 font-normal">{item.tongheso}</td>
                    <td className="px-3 py-3.5 text-sm text-center text-blue-600 font-normal">{item.tienluongphucap?.toLocaleString()}</td>
                    <td className="px-3 py-3.5 text-sm text-center text-blue-600 font-normal">{item.bhxh?.toLocaleString()}</td>
                    <td className="px-3 py-3.5 text-sm text-center text-blue-600 font-normal">{item.bhyt?.toLocaleString()}</td>
                    <td className="px-3 py-3.5 text-sm text-center text-blue-600 font-normal">{item.bhtn?.toLocaleString()}</td>
                    <td className="px-3 py-3.5 text-sm text-center text-blue-600 font-normal">{item.bhatld?.toLocaleString()}</td>
                    <td className="px-3 py-3.5 text-center">
                      {item.thaisan ? <span className="text-red-500 font-bold text-xs">Thai sản</span> : ''}
                    </td>
                    {!isPreviewMode && (
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex justify-center gap-2">
                           <button 
                            onClick={() => handleOpenEdit(item)} 
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Hiệu chỉnh"
                           >
                             <Pencil size={16} />
                           </button>
                           <button 
                            onClick={() => handleOpenDelete(item)}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Xóa"
                           >
                             <Trash2 size={16} />
                           </button>
                        </div>
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
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-gray-100">
                <div className="bg-blue-600 p-5 text-white flex justify-between items-center">
                   <h3 className="text-lg font-bold flex items-center gap-2">
                      <Database size={20} /> Tạo số liệu bh bắt buộc
                   </h3>
                   <button onClick={() => setIsAddModalOpen(false)}><X size={24}/></button>
                </div>
                <div className="p-8 space-y-6">
                   <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-xs text-blue-700 leading-relaxed font-bold">
                        Hệ thống sẽ quét danh sách nhân sự đang làm việc, lấy hệ số lương hiện tại và đối chiếu với tỉ lệ đóng bảo hiểm của tháng được chọn để tạo số liệu tự động.
                      </p>
                   </div>
                   <div>
                      <label className="text-xs font-bold text-red-600 mb-1.5 block">Chọn Tháng/Năm khởi tạo *</label>
                      <select 
                        value={addMonth} 
                        onChange={e => setAddMonth(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-xl font-bold text-blue-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none"
                      >
                         <option value="">-- chọn tháng đã cấu hình tỉ lệ --</option>
                         {months.map(m => (
                           <option key={m.maso} value={m.thangnam}>
                             Tháng {m.thangnam} {m.dacosolieu ? '(đã có dữ liệu)' : '(chưa có dữ liệu)'}
                           </option>
                         ))}
                      </select>
                   </div>
                </div>
                <div className="bg-gray-50 p-5 border-t border-gray-200 flex justify-end gap-3">
                   <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-2 text-gray-600 font-bold hover:text-gray-800 transition-colors text-sm">hủy bỏ</button>
                   <button 
                      onClick={handleCreateData}
                      disabled={generating || !addMonth}
                      className="px-8 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-400 text-sm"
                   >
                      {generating ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} Tạo số liệu
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* Edit Modal */}
        {isEditModalOpen && editingRecord && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-100">
                <div className="bg-blue-800 p-5 text-white flex justify-between items-center">
                   <h3 className="text-lg font-bold flex items-center gap-2">
                      <Pencil size={20} /> Hiệu chỉnh Thông tin Bảo hiểm
                   </h3>
                   <button onClick={() => setIsEditModalOpen(false)}><X size={24}/></button>
                </div>
                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                   {/* Personal Info Section (Read-only) */}
                   <section className="space-y-4">
                      <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest border-b pb-1">Thông tin Cá nhân</h4>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs font-bold text-red-600 block">Mã NV</label>
                            <p className="text-sm font-bold text-gray-800 p-2 bg-gray-50 rounded-lg">{editingRecord.manv}</p>
                         </div>
                         <div>
                            <label className="text-xs font-bold text-red-600 block">Họ và Tên CBGVNV</label>
                            <p className="text-sm font-bold text-gray-800 p-2 bg-gray-50 rounded-lg">{editingRecord.holot} {editingRecord.ten}</p>
                         </div>
                         <div className="col-span-2">
                            <label className="text-xs font-bold text-red-600 block">Đơn vị</label>
                            <p className="text-sm font-bold text-gray-800 p-2 bg-gray-50 rounded-lg">{editingRecord.ten_phongban}</p>
                         </div>
                      </div>
                   </section>

                   {/* Editing Section */}
                   <section className="space-y-4 pt-4">
                      <h4 className="text-[10px] font-bold text-blue-500 uppercase tracking-widest border-b pb-1">Hiệu chỉnh thông tin</h4>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs font-bold text-red-600 block mb-1">HSL</label>
                            <input 
                              type="number" step="0.01"
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                              value={editingRecord.hsl}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setEditingRecord(updateCalculations({ ...editingRecord, hsl: val }));
                              }}
                            />
                         </div>
                         <div>
                            <label className="text-xs font-bold text-red-600 block mb-1">Hệ số Chức vụ</label>
                            <input 
                              type="number" step="0.01"
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                              value={editingRecord.hschucvu}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                setEditingRecord(updateCalculations({ ...editingRecord, hschucvu: val }));
                              }}
                            />
                         </div>
                         <div>
                            <label className="text-xs font-bold text-red-600 block">Tổng Hệ số</label>
                            <p className="text-sm font-bold text-blue-600 p-2 bg-blue-50 rounded-lg border border-blue-100">{editingRecord.tongheso}</p>
                         </div>
                         <div>
                            <label className="text-xs font-bold text-red-600 block mb-1">Thai sản</label>
                            <select 
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold bg-white text-red-600 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                              value={editingRecord.thaisan ? 'True' : 'False'}
                              onChange={e => {
                                const val = e.target.value === 'True';
                                setEditingRecord(updateCalculations({ ...editingRecord, thaisan: val }));
                              }}
                            >
                               <option value="False">Hết Thai sản (false)</option>
                               <option value="True">Thai sản (true)</option>
                            </select>
                         </div>
                         <div className="col-span-2">
                            <label className="text-xs font-bold text-red-600 block">Tiền lương Phụ cấp</label>
                            <p className="text-sm font-bold text-gray-800 p-2 bg-gray-50 rounded-lg">{editingRecord.tienluongphucap?.toLocaleString()} vnđ</p>
                         </div>
                      </div>
                   </section>

                   {/* Preview Calculated Values Section */}
                   <section className="space-y-3 pt-4 opacity-80">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b pb-1">Kết quả các khoản BH (tạm tính)</h4>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                         <div className="flex justify-between border-b border-gray-100 py-1">
                            <span className="text-[11px] font-bold text-red-600">bhxh:</span>
                            <span className="text-sm font-bold text-blue-600">{editingRecord.bhxh?.toLocaleString()}</span>
                         </div>
                         <div className="flex justify-between border-b border-gray-100 py-1">
                            <span className="text-[11px] font-bold text-red-600">bhyt:</span>
                            <span className="text-sm font-bold text-blue-600">{editingRecord.bhyt?.toLocaleString()}</span>
                         </div>
                         <div className="flex justify-between border-b border-gray-100 py-1">
                            <span className="text-[11px] font-bold text-red-600">bhtn:</span>
                            <span className="text-sm font-bold text-blue-600">{editingRecord.bhtn?.toLocaleString()}</span>
                         </div>
                         <div className="flex justify-between border-b border-gray-100 py-1">
                            <span className="text-[11px] font-bold text-red-600">bhatld:</span>
                            <span className="text-sm font-bold text-blue-600">{editingRecord.bhatld?.toLocaleString()}</span>
                         </div>
                      </div>
                   </section>
                </div>
                <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-end gap-3">
                   <button onClick={() => setIsEditModalOpen(false)} className="px-8 py-2 text-gray-600 font-bold hover:text-gray-800 transition-colors text-sm">Kết thúc</button>
                   <button 
                      onClick={handleSaveEdit}
                      disabled={saving || !isEditChanged}
                      className="px-10 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 flex items-center gap-2 disabled:bg-gray-400 text-sm"
                   >
                      {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} Lưu Thay đổi
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* Delete Modal */}
        {isDeleteModalOpen && deletingRecord && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-red-100">
                <div className="bg-red-600 p-5 text-white flex items-center gap-3">
                   <ShieldAlert size={24} />
                   <h3 className="text-lg font-bold">Xác nhận xóa</h3>
                </div>
                <div className="p-8 text-center space-y-4">
                   <p className="text-gray-700 font-bold text-sm leading-relaxed">Bạn chắc chắn xóa dữ liệu bảo hiểm này khỏi danh sách?</p>
                   <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <p className="text-xs font-black text-blue-900">{deletingRecord.holot} {deletingRecord.ten}</p>
                      <p className="text-[10px] font-bold text-red-600">Mã NV: {deletingRecord.manv}</p>
                   </div>
                </div>
                <div className="bg-gray-50 p-5 border-t border-gray-200 flex justify-center gap-4">
                   <button 
                      onClick={executeDelete}
                      disabled={saving}
                      className="px-8 py-2 bg-red-600 text-white font-bold rounded-xl shadow-md hover:bg-red-700 active:scale-95 text-sm"
                   >
                      Đồng ý
                   </button>
                   <button 
                      onClick={() => setIsDeleteModalOpen(false)}
                      className="px-8 py-2 bg-white text-gray-700 font-bold rounded-xl border border-gray-200 hover:bg-gray-100 active:scale-95 text-sm"
                   >
                      Kết thúc
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccess && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-emerald-100">
                <div className="bg-emerald-600 p-5 text-white flex items-center gap-3">
                  <CheckCircle2 className="h-7 w-7" />
                  <h3 className="text-lg font-bold">Thông báo</h3>
                </div>
                <div className="p-8 text-center space-y-4">
                  <div className="bg-emerald-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                    <CheckCircle2 size={32} />
                  </div>
                  <p className="text-gray-700 font-bold text-sm leading-relaxed">{successMsg}</p>
                </div>
                <div className="bg-gray-50 p-4 border-t border-gray-50 flex justify-center">
                  <button onClick={() => setShowSuccess(false)} className="px-10 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md transition-all text-xs uppercase tracking-widest">Đã hiểu</button>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#f2f7ff] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-white">
        <div className="bg-[#fff9e6] px-4 py-3 flex justify-between items-center border-b border-gray-200">
           <div className="flex items-center gap-2">
              <div className="bg-red-50 p-1 rounded shadow-sm"><FileText size={16} className="text-white" /></div>
              <span className="text-sm font-medium text-gray-800 tracking-tight">Số liệu Bảo hiểm bắt buộc hằng tháng</span>
           </div>
           <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="p-4 bg-white/50 rounded-xl border border-gray-100 shadow-inner">
             <label className="text-xs font-bold text-red-600 block mb-1">Số liệu Bảo hiểm</label>
             <div className="grid grid-cols-3 items-center gap-2">
                <span className="text-sm font-normal text-gray-800 col-span-1">Tháng/Năm</span>
                <div className="relative col-span-2">
                   {loadingMonths ? (
                     <div className="flex items-center gap-2 text-xs text-gray-400 p-2"><Loader2 size={12} className="animate-spin" /> đang tải...</div>
                   ) : (
                     <>
                      <select 
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded p-1.5 text-sm font-bold text-blue-900 outline-none focus:ring-1 focus:ring-blue-400 appearance-none pr-8 cursor-pointer"
                      >
                        {months.map(m => <option key={m.maso} value={m.thangnam}>{m.thangnam}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                     </>
                   )}
                </div>
             </div>
          </div>

          <div className="flex justify-center gap-4">
             <button 
               onClick={handleCreateListBySelectedMonth}
               disabled={loadingData || !selectedMonth}
                //className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-gray-300 rounded shadow-md hover:bg-blue-50 transition-all text-xs font-normal text-gray-700 min-w-[140px]"
                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-blue-100"
              >
               {loadingData ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <Plus size={16} className="text-blue-600" />} 
                Tạo Danh sách
             </button>
             <button 
                onClick={handleGenerateList}
                disabled={loadingData || !selectedMonth}
                // className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-gray-300 rounded shadow-md hover:bg-gray-50 transition-all text-xs font-normal text-gray-700 min-w-[140px]"
                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-blue-100"
              >
                {loadingData ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <FileText size={16} className="text-blue-500" />} 
                Tải Danh sách
             </button>
             <button 
                onClick={onCancel}
                // className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-gray-300 rounded shadow-md hover:bg-red-50 transition-all text-xs font-normal text-gray-700 min-w-[140px]"
                className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-blue-100"
             >
                <X size={16} className="text-red-500" /> Hủy bỏ
             </button>
          </div>
        </div>
      </div>

      {showAlert && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-red-100">
              <div className="bg-red-600 p-4 text-white flex items-center gap-3">
                 <ShieldAlert size={20} />
                 <h3 className="text-md font-bold">Thông báo Hệ thống</h3>
              </div>
              <div className="p-8 text-center">
                 <p className="text-gray-700 font-bold text-sm leading-relaxed">{alertMsg}</p>
              </div>
              <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                  <button onClick={() => setShowAlert(false)} className="px-10 py-2 bg-red-600 text-white font-bold rounded-xl shadow-md hover:bg-red-700 transition-all active:scale-95 text-xs uppercase tracking-widest">{alertBtnText}</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
