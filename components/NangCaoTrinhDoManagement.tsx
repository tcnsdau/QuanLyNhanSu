
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { NangCaoTrinhDo, NhanVien, PhongBan } from '../types';
import { 
  Plus, Pencil, Trash2, Search, X, Save, FileDown, 
  AlertCircle, GraduationCap, Loader2, User, MoreHorizontal, ChevronDown, Printer, Activity
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Helper function to ensure keys are lowercase to avoid casing issues from Database
const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

export const NangCaoTrinhDoManagement: React.FC = () => {
  const [list, setList] = useState<NangCaoTrinhDo[]>([]);
  const [phongBans, setPhongBans] = useState<PhongBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<NangCaoTrinhDo>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // State cho Form "Theo dõi tiến trình Học tập Nâng cao Trình độ"
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };

  // States cho Delete Confirmation
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<NangCaoTrinhDo | null>(null);

  // States cho Searchable Dropdown nhân sự
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [availableLecturers, setAvailableLecturers] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [existingStaffIds, setExistingStaffIds] = useState<Set<string>>(new Set());
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropSearchInputRef = useRef<HTMLInputElement>(null);

  const getErrorMessage = (err: any) => {
    if (!err) return 'Lỗi không xác định';
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    return String(err);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resList, resPB] = await Promise.all([
        supabase.from('DanhSachHocTapNangCaoTrinhDo').select('*').order('maso', { ascending: false }),
        supabase.from('DanhMucPhongBan').select('*').order('giatri', { ascending: true })
      ]);
      
      if (resList.error) throw resList.error;
      if (resPB.error) throw resPB.error;

      const normalizedList = (resList.data || []).map(item => normalizeKeys(item) as NangCaoTrinhDo);
      const normalizedPBs = (resPB.data || []).map(item => normalizeKeys(item) as PhongBan);

      setList(normalizedList);
      setPhongBans(normalizedPBs);
      
      // Lưu tập hợp MaNV đã có trong danh sách học tập
      setExistingStaffIds(new Set(normalizedList.map(item => String(item.manv))));
    } catch (err: any) {
      showAlert('Lỗi khi tải dữ liệu: ' + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Xử lý mở dropdown và tải danh sách nhân viên khả dụng
  const handleOpenDropdown = async () => {
    setIsDropdownOpen(true);
    setLoadingStaff(true);
    setDropdownSearch('');
    
    try {
      // Lấy tất cả nhân viên chưa nghỉ việc
      const { data, error } = await supabase
        .from('DanhSachNhanVien')
        .select('manv, holot, ten, phongban, email')
        .eq('danghiviec', false);
      
      if (error) throw error;

      // Lọc bỏ những người đã có trong bảng học tập nâng cao
      const available = (data || [])
        .map(item => {
          const normalized = normalizeKeys(item);
          const pb = phongBans.find(p => p.maphongban === normalized.phongban);
          return {
            ...normalized,
            ten_phongban: pb ? pb.giatri : normalized.phongban
          };
        })
        .filter(nv => !existingStaffIds.has(String(nv.manv)));

      setAvailableLecturers(available);
    } catch (err) {
      showAlert("Lỗi tải danh sách nhân viên: " + getErrorMessage(err));
    } finally {
      setLoadingStaff(false);
      // Focus vào ô tìm kiếm nhỏ sau khi dropdown mở
      setTimeout(() => dropSearchInputRef.current?.focus(), 100);
    }
  };

  // Lọc danh sách nhân viên hiển thị trong dropdown dựa trên từ khóa tìm kiếm
  const filteredDropdownStaff = useMemo(() => {
    if (!dropdownSearch.trim()) return availableLecturers;
    const lowerSearch = dropdownSearch.toLowerCase();
    return availableLecturers.filter(nv => 
      `${nv.holot} ${nv.ten}`.toLowerCase().includes(lowerSearch) || 
      String(nv.manv || '').toLowerCase().includes(lowerSearch)
    );
  }, [availableLecturers, dropdownSearch]);

  const handleSelectStaff = (nv: any) => {
    setFormData({
      ...formData,
      manv: nv.manv,
      holot: nv.holot,
      ten: nv.ten,
      donvi: nv.ten_phongban
    });
    setIsDropdownOpen(false);
  };

  const handleOpenAdd = () => {
    setModalError(null);
    setIsEditing(false);
    setFormData({ 
      trinhdohoctapnangcao: 'Thạc sĩ', 
      diadiemhoctap: 'Trong nước',
      chuyennganhhoctap: '',
      cosodaotao: '',
      namtn: '',
      thoigianhoc: ''
    });
    setIsDropdownOpen(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: NangCaoTrinhDo) => {
    setModalError(null);
    setIsEditing(true);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.manv || !formData.chuyennganhhoctap?.trim() || !formData.namtn?.trim() || !formData.thoigianhoc?.trim() || !formData.cosodaotao?.trim()) {
      setModalError('Vui lòng chọn nhân sự và nhập đầy đủ các thông tin bắt buộc (*).');
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      if (isEditing && formData.manv !== undefined) {
        const { maso, ...updates } = formData;
        const editPayload = {
          chuyennganhhoctap: updates.chuyennganhhoctap,
          namtn: updates.namtn,
          trinhdohoctapnangcao: updates.trinhdohoctapnangcao,
          diadiemhoctap: updates.diadiemhoctap,
          cosodaotao: updates.cosodaotao,
          thoigianhoc: updates.thoigianhoc
        };
        const { error } = await supabase
          .from('DanhSachHocTapNangCaoTrinhDo')
          .update(editPayload)
          .eq('manv', updates.manv); // Sử dụng manv làm khóa chính để lưu thay vì maso
        if (error) throw error;
      } else {
        // Tự động tính maso mới dựa trên giá trị lớn nhất trong table
        const { data: allMaso, error: fetchMasoError } = await supabase
          .from('DanhSachHocTapNangCaoTrinhDo')
          .select('maso');
        
        let nextMaso = 1;
        if (!fetchMasoError && allMaso && allMaso.length > 0) {
          const masoNumbers = allMaso.map(item => parseInt(String(item.maso)) || 0);
          nextMaso = Math.max(...masoNumbers) + 1;
        }

        const insertData = { ...formData, maso: nextMaso };
        const { error } = await supabase
          .from('DanhSachHocTapNangCaoTrinhDo')
          .insert([insertData]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setModalError('Lỗi khi lưu dữ liệu: ' + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (item: NangCaoTrinhDo) => {
    setItemToDelete(item);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('DanhSachHocTapNangCaoTrinhDo')
        .delete()
        .eq('maso', itemToDelete.maso);
      
      if (error) {
        showAlert('Xóa thất bại: ' + getErrorMessage(error));
      } else {
        fetchData();
      }
    } catch (err) {
      showAlert('Lỗi khi xóa: ' + getErrorMessage(err));
    } finally {
      setIsDeleteConfirmOpen(false);
      setItemToDelete(null);
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredList.map((item, index) => ({
      'Số TT': index + 1,
      'Mã NV': item.manv,
      'Họ lót': item.holot,
      'Tên': item.ten,
      'Đơn vị': item.donvi,
      'Chuyên ngành học tập': item.chuyennganhhoctap,
      'Cơ sở đào tạo': item.cosodaotao,
      'Năm tốt nghiệp': item.namtn,
      'Trình độ học tập nâng cao': item.trinhdohoctapnangcao,
      'Địa điểm học tập': item.diadiemhoctap,
      'Thời gian học': item.thoigianhoc
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NangCaoTrinhDo");
    XLSX.writeFile(wb, "DanhSachHocTapNangCaoTrinhDo.xlsx");
  };

  const handlePrint = () => {
    if (filteredList.length === 0) {
      showAlert("Không có dữ liệu để in.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const printTimeStr = `In vào lúc ${hours} giờ ${minutes} phút ${seconds} giây ngày ${day} tháng ${month} năm ${year}`;
    const reportDateStr = `Đà Nẵng, ngày ${day} tháng ${month} năm ${year}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In Danh sách Cán bộ giảng viên học cao học và NCS</title>
        <style>
          @media print {
            @page { size: A4 landscape; margin: 15mm 10mm 15mm 10mm; }
            .footer-print-info { position: fixed; bottom: 0; width: 100%; display: flex; justify-content: space-between; font-size: 10px; font-style: italic; border-top: 0.5pt solid #000; padding-top: 5px; }
            .page-number:after { content: "Trang " counter(page) " / " counter(pages); }
          }
          body { font-family: "Times New Roman", Times, serif; font-size: 12px; line-height: 1.4; color: black; margin: 0; padding: 0; counter-reset: page; }
          .container { padding: 10px; }
          .admin-header { display: flex; justify-content: space-between; text-align: center; margin-bottom: 20px; }
          .header-left { width: 45%; font-weight: bold; }
          .header-right { width: 50%; font-weight: bold; }
          .line { border-bottom: 1.5pt solid #000; width: 120px; margin: 5px auto; }
          .report-title { text-align: center; margin: 30px 0 20px 0; }
          .report-title h1 { font-size: 18px; text-transform: uppercase; margin: 0; }
          .report-title h2 { font-size: 16px; text-transform: uppercase; margin: 5px 0 0 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid black; padding: 6px 4px; text-align: center; word-wrap: break-word; }
          th { background-color: #f2f2f2; text-transform: uppercase; font-size: 11px; }
          .text-left { text-align: left; padding-left: 8px; }
          .report-footer { margin-top: 40px; display: flex; justify-content: flex-end; }
          .footer-sign { width: 300px; text-align: center; }
          .footer-date { font-style: italic; margin-bottom: 5px; }
          .footer-dept { font-weight: bold; text-transform: uppercase; }
          .footer-print-info { display: flex; justify-content: space-between; padding-top: 5px; font-size: 10px; font-style: italic; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="admin-header">
            <div class="header-left">
              BỘ GIÁO DỤC VÀ ĐÀO TẠO<br>
              TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG
              <div class="line"></div>
            </div>
            <div class="header-right">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br>
              Độc lập - Tự do - Hạnh phúc
              <div class="line"></div>
            </div>
          </div>

          <div class="report-title">
            <h1>DANH SÁCH CÁN BỘ GIẢNG VIÊN</h1>
            <h2>HỌC CAO HỌC VÀ NGHIÊN CỨU SINH</h2>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">STT</th>
                <th style="width: 150px;">Họ và Tên CBGV</th>
                <th style="width: 130px;">Đơn vị</th>
                <th style="width: 80px;">Trình độ</th>
                <th>Chuyên ngành học</th>
                <th style="width: 180px;">Cơ sở đào tạo</th>
                <th style="width: 100px;">Thời gian học</th>
                <th style="width: 80px;">Năm TN</th>
              </tr>
            </thead>
            <tbody>
              ${filteredList.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td class="text-left">${item.holot} ${item.ten}</td>
                  <td class="text-left">${item.donvi}</td>
                  <td>${item.trinhdohoctapnangcao}</td>
                  <td class="text-left">${item.chuyennganhhoctap}</td>
                  <td class="text-left">${item.cosodaotao}</td>
                  <td>${item.thoigianhoc}</td>
                  <td>${item.namtn}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="report-footer">
            <div class="footer-sign">
              <div class="footer-date">${reportDateStr}</div>
              <div class="footer-dept">PHÒNG TỔ CHỨC - HÀNH CHÍNH</div>
            </div>
          </div>

          <div class="footer-print-info">
            <div>${printTimeStr}</div>
            <div class="page-number"></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintStats = () => {
    if (list.length === 0) {
      showAlert("Không có dữ liệu để thống kê.");
      return;
    }

    // Aggregate data
    const stats: { [key: string]: any } = {};
    list.forEach(item => {
      const unit = item.donvi || 'Khác';
      if (!stats[unit]) {
        stats[unit] = {
          unit: unit,
          thacsi: 0,
          tiensi: 0,
          sautiensi: 0,
          trongnuoc: 0,
          ngoainuoc: 0,
          total: 0
        };
      }
      
      const s = stats[unit];
      s.total += 1;
      
      if (item.trinhdohoctapnangcao === 'Thạc sĩ') s.thacsi += 1;
      else if (item.trinhdohoctapnangcao === 'Tiến sĩ') s.tiensi += 1;
      else if (item.trinhdohoctapnangcao === 'Nghiên cứu sau Tiến sĩ') s.sautiensi += 1;
      
      if (item.diadiemhoctap === 'Trong nước') s.trongnuoc += 1;
      else if (item.diadiemhoctap === 'Ngoài nước') s.ngoainuoc += 1;
    });

    const statsList = Object.values(stats).sort((a, b) => a.unit.localeCompare(b.unit));
    
    // Totals
    const grandTotal = {
      thacsi: statsList.reduce((sum, s) => sum + s.thacsi, 0),
      tiensi: statsList.reduce((sum, s) => sum + s.tiensi, 0),
      sautiensi: statsList.reduce((sum, s) => sum + s.sautiensi, 0),
      trongnuoc: statsList.reduce((sum, s) => sum + s.trongnuoc, 0),
      ngoainuoc: statsList.reduce((sum, s) => sum + s.ngoainuoc, 0),
      total: statsList.reduce((sum, s) => sum + s.total, 0)
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const printTimeStr = `In vào lúc ${hours} giờ ${minutes} phút ${seconds} giây ngày ${day} tháng ${month} năm ${year}`;
    const reportDateStr = `Đà Nẵng, ngày ${day} tháng ${month} năm ${year}`;

    const formatVal = (val: number) => val === 0 ? '' : val;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Thống kê số lượng giảng viên học tập nâng cao trình độ</title>
        <style>
          @media print {
            @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
            .footer-print-info { position: fixed; bottom: 0; width: 100%; display: flex; justify-content: space-between; font-size: 10px; font-style: italic; border-top: 0.5pt solid #000; padding-top: 5px; }
            .page-number:after { content: "Trang " counter(page) " / " counter(pages); }
          }
          body { font-family: "Times New Roman", Times, serif; font-size: 12px; line-height: 1.4; color: black; margin: 0; padding: 0; counter-reset: page; }
          .container { padding: 10px; }
          .admin-header { display: flex; justify-content: space-between; text-align: center; margin-bottom: 20px; }
          .header-left { width: 45%; font-weight: bold; }
          .header-right { width: 50%; font-weight: bold; }
          .line { border-bottom: 1.5pt solid #000; width: 120px; margin: 5px auto; }
          .report-title { text-align: center; margin: 30px 0 20px 0; }
          .report-title h1 { font-size: 16px; text-transform: uppercase; margin: 0; }
          .report-title h2 { font-size: 16px; text-transform: uppercase; margin: 5px 0 0 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid black; padding: 6px 4px; text-align: center; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .text-left { text-align: left; padding-left: 8px; }
          .report-footer { margin-top: 40px; display: flex; justify-content: flex-end; }
          .footer-sign { width: 300px; text-align: center; }
          .footer-date { font-style: italic; margin-bottom: 5px; }
          .footer-dept { font-weight: bold; text-transform: uppercase; }
          .footer-print-info { display: flex; justify-content: space-between; padding-top: 5px; font-size: 10px; font-style: italic; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="admin-header">
            <div class="header-left">
              BỘ GIÁO DỤC VÀ ĐÀO TẠO<br>
              TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG
              <div class="line"></div>
            </div>
            <div class="header-right">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br>
              Độc lập - Tự do - Hạnh phúc
              <div class="line"></div>
            </div>
          </div>

          <div class="report-title">
            <h1>THỐNG KÊ SỐ LƯỢNG GIẢNG VIÊN</h1>
            <h2>HỌC TẬP NÂNG CAO TRÌNH ĐỘ</h2>
          </div>

          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 40px;">STT</th>
                <th rowspan="2">Tên Đơn vị</th>
                <th colspan="3">Trình độ Đào tạo</th>
                <th colspan="2">Địa điểm học tập</th>
                <th rowspan="2" style="width: 80px;">Tổng cộng</th>
              </tr>
              <tr>
                <th style="width: 60px;">Thạc sĩ</th>
                <th style="width: 60px;">Tiến sĩ</th>
                <th style="width: 80px;">Nghiên cứu sau Tiến sĩ</th>
                <th style="width: 80px;">Trong nước</th>
                <th style="width: 80px;">Ngoài nước</th>
              </tr>
            </thead>
            <tbody>
              ${statsList.map((s, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td class="text-left">${s.unit}</td>
                  <td>${formatVal(s.thacsi)}</td>
                  <td>${formatVal(s.tiensi)}</td>
                  <td>${formatVal(s.sautiensi)}</td>
                  <td>${formatVal(s.trongnuoc)}</td>
                  <td>${formatVal(s.ngoainuoc)}</td>
                  <td style="font-weight: bold;">${s.total}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; background-color: #f9f9f9;">
                <td colspan="2">Tổng cộng</td>
                <td>${grandTotal.thacsi}</td>
                <td>${grandTotal.tiensi}</td>
                <td>${grandTotal.sautiensi}</td>
                <td>${grandTotal.trongnuoc}</td>
                <td>${grandTotal.ngoainuoc}</td>
                <td>${grandTotal.total}</td>
              </tr>
            </tbody>
          </table>

          <div class="report-footer">
            <div class="footer-sign">
              <div class="footer-date">${reportDateStr}</div>
              <div class="footer-dept">PHÒNG TỔ CHỨC - HÀNH CHÍNH</div>
            </div>
          </div>

          <div class="footer-print-info">
            <div>${printTimeStr}</div>
            <div class="page-number"></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const filteredList = list.filter(item => {
    const searchFields = [
      item.manv,
      item.holot,
      item.ten,
      item.chuyennganhhoctap,
      item.cosodaotao,
      item.donvi
    ].map(f => String(f || '').toLowerCase());
    
    return searchFields.some(f => f.includes(searchTerm.toLowerCase()));
  });

  // ===== Form "Theo dõi tiến trình Học tập Nâng cao Trình độ" =====
  const TRINHDO_RANK: Record<string, number> = {
    'Nghiên cứu sau Tiến sĩ': 0,
    'Tiến sĩ': 1,
    'Thạc sĩ': 2
  };

  // Chuyển đổi tháng/năm sang chỉ số tháng liên tục để so sánh và tính tỉ lệ hiển thị
  const monthIndex = (month: number, year: number) => year * 12 + (month - 1);

  const parseThoiGianHoc = (value?: string) => {
    if (!value) return null;
    const parts = value.split(/[-–]/).map(p => p.trim());
    if (parts.length < 2) return null;
    const parseMonthYear = (s: string) => {
      const m = s.match(/(\d{1,2})\s*\/\s*(\d{4})/);
      if (!m) return null;
      return { month: parseInt(m[1], 10), year: parseInt(m[2], 10) };
    };
    const start = parseMonthYear(parts[0]);
    const end = parseMonthYear(parts[1]);
    if (!start || !end) return null;
    return { start, end };
  };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentIdx = monthIndex(currentMonth, currentYear);

  const progressList = useMemo(() => {
    return list
      .filter(item => TRINHDO_RANK[item.trinhdohoctapnangcao] !== undefined)
      .sort((a, b) => TRINHDO_RANK[a.trinhdohoctapnangcao] - TRINHDO_RANK[b.trinhdohoctapnangcao]);
  }, [list]);

  const progressScale = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    progressList.forEach(item => {
      const parsed = parseThoiGianHoc(item.thoigianhoc);
      if (parsed) {
        min = Math.min(min, monthIndex(parsed.start.month, parsed.start.year));
        max = Math.max(max, monthIndex(parsed.end.month, parsed.end.year));
      }
    });
    max = Math.max(max, currentIdx);
    if (!isFinite(min)) min = currentIdx;
    if (!isFinite(max) || max === min) max = min + 1;
    return { min, max };
  }, [progressList, currentIdx]);

  const isOverdue = (item: NangCaoTrinhDo) => {
    const parsed = parseThoiGianHoc(item.thoigianhoc);
    if (!parsed) return false;
    return monthIndex(parsed.end.month, parsed.end.year) < currentIdx;
  };

  const renderProgressChart = (item: NangCaoTrinhDo) => {
    const parsed = parseThoiGianHoc(item.thoigianhoc);
    if (!parsed) {
      return <span className="text-xs text-gray-400 italic">Không xác định thời gian học</span>;
    }
    const { start, end } = parsed;
    const startIdx = monthIndex(start.month, start.year);
    const endIdx = monthIndex(end.month, end.year);
    const { min, max } = progressScale;
    const range = max - min || 1;
    const toPct = (idx: number) => Math.min(100, Math.max(4, ((idx - min) / range) * 100));

    const bars = [
      { label: 'Bắt đầu học', value: `${String(start.month).padStart(2, '0')}/${start.year}`, pct: toPct(startIdx), color: 'bg-gray-800', textColor: 'text-black' },
      { label: 'Hiện tại', value: `${String(currentMonth).padStart(2, '0')}/${currentYear}`, pct: toPct(currentIdx), color: 'bg-blue-500', textColor: 'text-blue-600' },
      { label: 'Kết thúc', value: `${String(end.month).padStart(2, '0')}/${end.year}`, pct: toPct(endIdx), color: 'bg-red-500', textColor: 'text-red-600' },
    ];

    return (
      <div className="flex flex-col gap-1.5 w-80">
        {bars.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 w-20 shrink-0">{b.label}</span>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${b.pct}%` }} />
            </div>
            <span className={`text-sm font-black w-16 shrink-0 text-right ${b.textColor}`}>{b.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-100">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-black text-blue-900 tracking-tight ">Danh sách CBGV Học tập Nâng cao Trình độ</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center px-5 py-2.5 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-all border border-indigo-200"
            >
              <Printer className="h-4 w-4 mr-2" /> In danh sách
            </button>
            <button
              onClick={handlePrintStats}
              className="flex items-center justify-center px-5 py-2.5 bg-amber-50 text-amber-700 font-bold rounded-xl hover:bg-amber-100 transition-all border border-amber-200"
            >
              <Printer className="h-4 w-4 mr-2" /> Thống kê
            </button>
            <button
              onClick={() => setIsProgressModalOpen(true)}
              className="flex items-center justify-center px-5 py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-xl hover:bg-emerald-100 transition-all border border-emerald-200"
            >
              <Activity className="h-4 w-4 mr-2" /> Tiến trình học tập
            </button>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto self-center">
          <button
            onClick={handleExportExcel}
            className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-blue-100 text-blue-700 font-bold rounded-xl hover:bg-blue-200 transition-all border border-blue-200"
          >
            <FileDown className="h-4 w-4 mr-2" /> Xuất Excel
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex-1 md:flex-none flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4 mr-2" /> Thêm mới
          </button>
        </div>
      </div>

      {/* List Table Section */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm mã NV, Họ tên, Chuyên ngành..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-black bg-white font-medium"
              value={searchTerm}
              onChange={(e: { target: { value: any; }; }) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="text-xs font-bold text-gray-400 tracking-widest">
            Tổng cộng: <span className="text-indigo-600 font-black">{filteredList.length}</span> hồ sơ
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-24">Số TT</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Nhân sự</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Đơn vị</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Chuyên ngành học</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Cơ sở đào tạo</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Năm TN</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Trình độ nâng cao</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Địa điểm</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Thời gian</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-indigo-600" />
                    <p className="mt-2 text-gray-400 font-bold text-[10px] tracking-widest">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center text-gray-400 italic">Không tìm thấy dữ liệu phù hợp.</td>
                </tr>
              ) : (
                filteredList.map((item, index) => (
                  <tr key={item.maso} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="px-6 py-4 text-sm text-center">
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg border border-gray-200 font-bold">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-blue-800 ">{item.holot} {item.ten}</span>
                        <span className="text-[10px] font-sm text-red-500 tracking-tighter">Mã NV: {item.manv}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-sm">{item.donvi}</td>
                    <td className="px-6 py-4 text-sm text-gray-800 font-sm">{item.chuyennganhhoctap}</td>
                    <td className="px-6 py-4 text-sm text-indigo-700 font-bold">{item.cosodaotao || '---'}</td>
                    <td className="px-6 py-4 text-sm text-gray-800 font-sm text-center">{item.namtn}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                        {item.trinhdohoctapnangcao}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-800 font-sm text-center">{item.diadiemhoctap}</td>
                    <td className="px-6 py-4 text-sm text-center font-sm text-blue-600">{item.thoigianhoc}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button onClick={() => handleOpenEdit(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors mr-2">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteClick(item)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Section */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <form onSubmit={handleSave} className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 my-8">
            <div className="bg-indigo-800 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-wider flex items-center gap-3">
                {isEditing ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {isEditing ? 'Hiệu chỉnh hồ sơ' : 'Thêm mới hồ sơ'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="h-7 w-7" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              {!isEditing ? (
                <div className="space-y-4">
                  {/* Searchable Dropdown Nhân sự */}
                  <div className="relative" ref={dropdownRef}>
                    <label className="text-[10px] font-black text-indigo-600 tracking-widest mb-1.5 block">Tìm kiếm nhân sự *</label>
                    
                    <div className="flex shadow-sm rounded-xl overflow-hidden border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 bg-white transition-all">
                      <input 
                        className="block w-full border-none px-4 py-3 text-sm font-bold text-black focus:ring-0 bg-white cursor-pointer" 
                        placeholder={formData.manv ? `${formData.holot} ${formData.ten}` : "Click để chọn nhân sự..."}
                        type="text" 
                        readOnly
                        value={formData.manv ? `${formData.holot} ${formData.ten}` : ""}
                        onClick={handleOpenDropdown}
                      />
                      <button 
                        type="button"
                        onClick={handleOpenDropdown}
                        className="inline-flex items-center px-4 bg-gray-50 border-l border-gray-200 text-gray-500 hover:bg-gray-100"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Dropdown Container */}
                    {isDropdownOpen && (
                      <div className="absolute z-[120] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl divide-y divide-gray-100 overflow-hidden flex flex-col max-h-[350px] animate-in fade-in zoom-in duration-100">
                        {/* Dropdown Internal Search */}
                        <div className="p-3 bg-gray-50/50 sticky top-0">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input 
                              ref={dropSearchInputRef}
                              type="text"
                              placeholder="Gõ Mã NV hoặc Tên để tìm nhanh..."
                              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-black font-bold focus:ring-1 focus:ring-indigo-500 outline-none"
                              value={dropdownSearch}
                              onChange={(e) => setDropdownSearch(e.target.value)}
                              autoComplete="off"
                            />
                          </div>
                        </div>

                        {/* List Items */}
                        <div className="overflow-y-auto flex-1">
                          {loadingStaff ? (
                            <div className="p-10 text-center">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500" />
                              <p className="text-[10px] font-bold text-gray-400 mt-2">Đang tải danh sách...</p>
                            </div>
                          ) : filteredDropdownStaff.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                              {filteredDropdownStaff.map(nv => (
                                <div 
                                  key={nv.manv} 
                                  onClick={() => handleSelectStaff(nv)}
                                  className="p-4 hover:bg-indigo-50 cursor-pointer transition-colors group flex items-start gap-3"
                                >
                                  <div className="bg-gray-100 p-2 rounded-lg group-hover:bg-indigo-100 flex-shrink-0">
                                    <User className="h-5 w-5 text-gray-400 group-hover:text-indigo-600" />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-black text-gray-900 group-hover:text-indigo-900 truncate">
                                      {nv.holot} {nv.ten}
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[11px] font-bold text-gray-500">Mã NV: {nv.manv}</span>
                                      <span className="text-gray-300">|</span>
                                      <span className="text-[11px] font-bold text-gray-500 truncate">Email: {nv.email || '---'}</span>
                                    </div>
                                    <p className="text-[10px] text-indigo-500 font-bold mt-0.5">{nv.ten_phongban}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-10 text-center text-gray-400 italic text-sm">
                              Không tìm thấy nhân sự phù hợp hoặc nhân sự đã có trong danh sách.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {formData.manv && (
                    <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 grid grid-cols-2 gap-4 animate-in fade-in duration-300 shadow-inner">
                        <div>
                            <p className="text-[9px] font-black text-indigo-400 tracking-widest mb-0.5">Nhân sự đã chọn</p>
                            <p className="text-sm font-black text-blue-900 ">{formData.holot} {formData.ten}</p>
                            <p className="text-xs font-bold text-blue-600 tracking-tighter">Mã số: {formData.manv}</p>
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-indigo-400 tracking-widest mb-0.5">Đơn vị đang công tác</p>
                            <p className="text-sm font-black text-gray-700">{formData.donvi}</p>
                        </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 grid grid-cols-2 gap-4 shadow-inner">
                    <div>
                        <p className="text-[9px] font-black text-gray-400 tracking-widest mb-0.5">Nhân sự</p>
                        <p className="text-sm font-black text-blue-900 ">{formData.holot} {formData.ten}</p>
                        <p className="text-xs font-bold text-indigo-500">Mã NV: {formData.manv}</p>
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-gray-400 tracking-widest mb-0.5">Hồ sơ số</p>
                        <p className="text-sm font-black text-gray-700 ">#{formData.maso}</p>
                        <p className="text-[10px] font-bold text-gray-400">{formData.donvi}</p>
                    </div>
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <label className="text-[10px] font-black text-indigo-600 tracking-widest block mb-2">2. Chi tiết hồ sơ</label>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {!isEditing && (
                    <div>
                      <label className="text-xs font-bold text-red-500 mb-1.5 block">Đơn vị công tác *</label>
                      <select
                        value={formData.donvi || ''}
                        onChange={e => setFormData({ ...formData, donvi: e.target.value })}
                        className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-all shadow-sm text-black"
                      >
                        <option value="">-- Chọn đơn vị --</option>
                        {phongBans.map(pb => (
                          <option key={pb.id} value={pb.giatri}>{pb.giatri}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className={isEditing ? "md:col-span-2" : ""}>
                    <label className="text-xs font-bold text-red-500 mb-1.5 block">Chuyên ngành học tập *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nhập chuyên ngành..."
                      value={formData.chuyennganhhoctap || ''}
                      onChange={e => setFormData({ ...formData, chuyennganhhoctap: e.target.value })}
                      className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-red-500 mb-1.5 block">Trình độ học tập nâng cao</label>
                    <select
                      value={formData.trinhdohoctapnangcao || 'Thạc sĩ'}
                      onChange={e => setFormData({ ...formData, trinhdohoctapnangcao: e.target.value })}
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-all shadow-sm text-black"
                    >
                      <option value="Thạc sĩ">Thạc sĩ</option>
                      <option value="Tiến sĩ">Tiến sĩ</option>
                      <option value="Nghiên cứu sau Tiến sĩ">Nghiên cứu sau Tiến sĩ</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-red-500 mb-1.5 block">Địa điểm học tập</label>
                    <select
                      value={formData.diadiemhoctap || 'Trong nước'}
                      onChange={e => setFormData({ ...formData, diadiemhoctap: e.target.value })}
                      className="w-full p-2.5 border border-gray-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none bg-white transition-all shadow-sm text-black"
                    >
                      <option value="Trong nước">Trong nước</option>
                      <option value="Ngoài nước">Ngoài nước</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-red-500 mb-1.5 block">Cơ sở đào tạo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nhập tên cơ sở đào tạo, trường học..."
                      value={formData.cosodaotao || ''}
                      onChange={e => setFormData({ ...formData, cosodaotao: e.target.value })}
                      className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-red-500 mb-1.5 block">Năm tốt nghiệp *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: 2026"
                      value={formData.namtn || ''}
                      onChange={e => setFormData({ ...formData, namtn: e.target.value })}
                      className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-red-500 mb-1.5 block">Thời gian học *</label>
                    <input
                      type="text"
                      required
                      placeholder="VD: 3 năm, 2023-2026..."
                      value={formData.thoigianhoc || ''}
                      onChange={e => setFormData({ ...formData, thoigianhoc: e.target.value })}
                      className="w-full text-sm font-bold text-black bg-white border border-gray-300 rounded px-3 py-2 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {modalError && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-xs text-red-800 font-bold">{modalError}</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-6 py-2 text-gray-500 font-black text-xs hover:text-gray-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                type="submit" 
                disabled={saving} 
                className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 text-xs"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu hồ sơ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmOpen && itemToDelete && (
        <div className="fixed inset-0 z-[150] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="bg-red-600 p-6 text-white flex items-center gap-3">
              <AlertCircle className="h-6 w-6" />
              <h3 className="text-lg font-black tracking-wider">Xác nhận xóa</h3>
            </div>
            <div className="p-8">
              <p className="text-sm font-bold text-gray-700 leading-relaxed">
                Bạn đồng ý xóa GVTG <span className="text-red-600 font-black">{itemToDelete.holot} {itemToDelete.ten}</span> ra khỏi danh sách học tập nâng cao trình độ?
              </p>
            </div>
            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button 
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setItemToDelete(null);
                }}
                className="px-6 py-2 text-gray-500 font-black text-xs hover:text-gray-700 transition-colors"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={confirmDelete}
                className="px-8 py-2.5 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95 text-xs"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal "Theo dõi tiến trình Học tập Nâng cao Trình độ" */}
      {isProgressModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-[95vw] max-w-[1800px] overflow-hidden animate-in zoom-in duration-200 my-8">
            <div className="bg-indigo-800 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-black tracking-wider flex items-center gap-3">
                <Activity className="h-5 w-5" />
                Theo dõi tiến trình Học tập Nâng cao Trình độ
              </h3>
              <button
                onClick={() => setIsProgressModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-x-auto max-h-[75vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left">
                <thead className="bg-gray-50/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-sm font-black text-red-800 tracking-widest text-center w-16">Số TT</th>
                    <th className="px-4 py-3 text-sm font-black text-red-800 tracking-widest">Họ và tên</th>
                    <th className="px-4 py-3 text-sm font-black text-red-800 tracking-widest">Đơn vị</th>
                    <th className="px-4 py-3 text-sm font-black text-red-800 tracking-widest">Chuyên ngành học</th>
                    <th className="px-4 py-3 text-sm font-black text-red-800 tracking-widest text-center">Trình độ nâng cao</th>
                    <th className="px-4 py-3 text-sm font-black text-red-800 tracking-widest">Tiến trình học tập</th>
                    <th className="px-4 py-3 text-sm font-black text-red-800 tracking-widest text-center">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <Loader2 className="h-10 w-10 animate-spin mx-auto text-indigo-600" />
                        <p className="mt-2 text-gray-400 font-bold text-[10px] tracking-widest">Đang tải dữ liệu...</p>
                      </td>
                    </tr>
                  ) : progressList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center text-gray-400 italic">Không có dữ liệu phù hợp.</td>
                    </tr>
                  ) : (
                    progressList.map((item, index) => {
                      const overdue = isOverdue(item);
                      const isTienSi = item.trinhdohoctapnangcao === 'Tiến sĩ';
                      // Ưu tiên định dạng "Quá hạn" (đỏ, in nghiêng), nếu không quá hạn thì áp dụng màu xanh cho "Tiến sĩ"
                      const rowTextClass = overdue ? 'text-red-600 italic' : (isTienSi ? 'text-blue-600' : 'text-gray-800');
                      return (
                        <tr key={item.maso} className="hover:bg-indigo-50/40 transition-colors">
                          <td className={`px-4 py-3 text-sm text-center font-bold ${rowTextClass}`}>{index + 1}</td>
                          <td className={`px-4 py-3 text-sm ${rowTextClass}`}>{item.holot} {item.ten}</td>
                          <td className={`px-4 py-3 text-sm ${rowTextClass}`}>{item.donvi}</td>
                          <td className={`px-4 py-3 text-sm ${rowTextClass}`}>{item.chuyennganhhoctap}</td>
                          <td className={`px-4 py-3 text-sm text-center ${rowTextClass}`}>{item.trinhdohoctapnangcao}</td>
                          <td className="px-4 py-3">{renderProgressChart(item)}</td>
                          <td className={`px-4 py-3 text-sm text-center font-bold ${rowTextClass}`}>{overdue ? 'Quá hạn' : ''}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
              <button
                onClick={() => setIsProgressModalOpen(false)}
                className="px-10 py-2.5 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
             <div className="bg-red-600 p-5 text-white flex items-center gap-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold uppercase tracking-tighter">Thông báo hệ thống</h3>
             </div>
             <div className="p-8 text-center">
                <p className="text-gray-700 font-bold leading-relaxed whitespace-pre-line">{alertMessage}</p>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                <button 
                  onClick={() => setIsAlertModalOpen(false)}
                  className="px-10 py-3 bg-red-600 text-white font-black rounded-2xl shadow-lg hover:bg-red-700 transition-all active:scale-95 text-sm uppercase tracking-widest"
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
