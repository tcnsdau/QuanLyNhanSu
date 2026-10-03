
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { NhanSuBoMon, ToBoMon, PhongBan, NhanVien, TrinhDo, QuaTrinhDaoTao, RolePermission } from '../types';
import { BarChart3, Building, Info, Loader2, Users, X, List, GraduationCap, Search, FileDown, Printer, ChevronDown, RefreshCw, Code, AlertCircle, CheckCircle2, Save, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

// Helper function to ensure keys are lowercase
const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

// Doughnut Chart Component
const SimpleDoughnutChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <div className="text-gray-400 italic text-sm py-10">Không có dữ liệu trình độ</div>;

  let currentAngle = 0;
  const outerRadius = 80;
  const innerRadius = 45; 
  const centerX = 100;
  const centerY = 90;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 180" className="w-48 h-48 md:w-56 md:h-56 drop-shadow-lg">
        {data.map((item, i) => {
          const sliceAngle = (item.value / total) * 360;
          if (sliceAngle === 0) return null;

          const startAngle = currentAngle;
          const endAngle = currentAngle + sliceAngle;
          
          const rad = Math.PI / 180;
          const x1_out = centerX + outerRadius * Math.cos(startAngle * rad);
          const y1_out = centerY + outerRadius * Math.sin(startAngle * rad);
          const x2_out = centerX + outerRadius * Math.cos(endAngle * rad);
          const y2_out = centerY + outerRadius * Math.sin(endAngle * rad);
          
          const x1_in = centerX + innerRadius * Math.cos(endAngle * rad);
          const y1_in = centerY + innerRadius * Math.sin(endAngle * rad);
          const x2_in = centerX + innerRadius * Math.cos(startAngle * rad);
          const y2_in = centerY + innerRadius * Math.sin(startAngle * rad);

          const largeArcFlag = sliceAngle > 180 ? 1 : 0;
          
          const pathData = [
            `M ${x1_out} ${y1_out}`,
            `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2_out} ${y2_out}`,
            `L ${x1_in} ${y1_in}`,
            `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x2_in} ${y2_in}`,
            "Z"
          ].join(" ");

          const midAngle = startAngle + sliceAngle / 2;
          const textRadius = (outerRadius + innerRadius) / 2;
          const labelX = centerX + textRadius * Math.cos(midAngle * rad);
          const labelY = centerY + textRadius * Math.sin(midAngle * rad);

          const element = (
            <g key={i} className="hover:opacity-80 transition-opacity cursor-default">
              <path d={pathData} fill={item.color} stroke="#fff" strokeWidth="1" />
              {item.value > 0 && (
                <text 
                  x={labelX} 
                  y={labelY} 
                  fontSize="10" 
                  fontWeight="900" 
                  fill="white" 
                  textAnchor="middle" 
                  dominantBaseline="middle"
                >
                  {item.value}
                </text>
              )}
            </g>
          );
          currentAngle += sliceAngle;
          return element;
        })}
        <text x={centerX} y={centerY - 2} fontSize="7" fontWeight="bold" fill="#9ca3af" textAnchor="middle">TỔNG</text>
        <text x={centerX} y={centerY + 10} fontSize="14" fontWeight="900" fill="#1e40af" textAnchor="middle">{total}</text>
      </svg>
      
      <div className="flex flex-row flex-wrap justify-center gap-4 mt-1">
        {data.map((item, i) => (
          <div key={i} className="flex items-center text-[10px] font-bold text-gray-600">
            <div className="w-2.5 h-2.5 rounded-full mr-1.5 shadow-sm" style={{ backgroundColor: item.color }}></div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ToBoMonStatistics: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statsData, setStatsData] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);

  // Sync with prop changes from parent
  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  // Permission checks
  const canRead = useMemo(() => checkPermission(permissions, isAdmin, 'toBoMon-thongKe', 'READ'), [permissions, isAdmin]);
  const canUpdate = useMemo(() => checkPermission(permissions, isAdmin, 'toBoMon-thongKe', 'UPDATE'), [permissions, isAdmin]);

  // Fetch latest permissions if currentUser is provided
  useEffect(() => {
    const fetchLatestPermissions = async () => {
      // Use either id or userid from currentUser
      const userId = currentUser?.id || currentUser?.userid;
      if (!userId) {
        console.log('ToBoMonStatistics - No userId found in currentUser:', currentUser);
        return;
      }
      
      try {
        console.log('ToBoMonStatistics - Fetching fresh permissions for userId:', userId);
        
        // Fetch RolePermissions with related Module and Permission info
        const { data: rolePermData, error: rolePermError } = await supabase
          .from('RolePermissions')
          .select(`
            *,
            Modules:moduleid(*),
            Permissions:permissionid(*)
          `)
          .eq('userid', userId);

        if (rolePermError) throw rolePermError;

        if (rolePermData) {
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
        setAlertModal({
          isOpen: true,
          type: 'error',
          title: 'Lỗi phân quyền',
          message: "ToBoMonStatistics - Lỗi tải phân quyền mới nhất: " + (err.message || err)
        });
      }
    };

    fetchLatestPermissions();
  }, [currentUser]);

  const [viewingDepartment, setViewingDepartment] = useState<{
    mabomon: string;
    giatri: string;
    unitName: string;
    staffList: NhanSuBoMon[];
  } | null>(null);

  // Modal filters
  const [modalSearch, setModalSearch] = useState('');
  const [modalDegreeFilter, setModalDegreeFilter] = useState('');

  // UI Notification Modals
  const [confirmSyncModal, setConfirmSyncModal] = useState(false);
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const [pbRes, bmRes, nsRes] = await Promise.all([
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('DanhMucToBoMon').select('*').order('sapxep', { ascending: true }),
        supabase.from('DanhSachNhanSuBoMon')
          .select('*')
          .eq('danghiviec', false)
          .order('vithunhansu', { ascending: true })
      ]);

      if (bmRes.data && nsRes.data) {
        const departments = (bmRes.data as any[]).map(d => normalizeKeys(d)) as ToBoMon[];
        const staff = (nsRes.data as any[]).map(s => normalizeKeys(s)) as NhanSuBoMon[];
        const units = (pbRes.data || []).map(u => normalizeKeys(u)) as PhongBan[];

        const processed = departments.map(bm => {
          const bmStaff = staff.filter(s => s.masobomon === bm.mabomon);
          const unit = units.find(u => u.maphongban === bm.tructhuoc);

          const degrees: Record<string, number> = {
            'Tiến sĩ': 0,
            'Thạc sĩ': 0,
            'Đại học': 0
          };

          bmStaff.forEach(s => {
            const td = (s.trinhdo || '').toLowerCase();
            if (td.includes('tiến sĩ') || td.includes('ts')) degrees['Tiến sĩ']++;
            else if (td.includes('thạc sĩ') || td.includes('ths')) degrees['Thạc sĩ']++;
            else if (td.includes('đại học') || td.includes('đh') || td.includes('cử nhân') || td.includes('kỹ sư') || td.includes('kiến trúc sư')) degrees['Đại học']++;
          });

          const chartData = [
            { label: 'Tiến sĩ', value: degrees['Tiến sĩ'], color: '#ef4444' }, // Red
            { label: 'Thạc sĩ', value: degrees['Thạc sĩ'], color: '#3b82f6' }, // Blue
            { label: 'Đại học', value: degrees['Đại học'], color: '#22c55e' }  // Green
          ];

          return {
            ...bm,
            unitName: unit?.giatri || 'Không xác định',
            total: bmStaff.length,
            degrees,
            chartData,
            staffList: bmStaff
          };
        });

        setStatsData(processed);
        
        // Refresh the viewing modal data if it's open
        if (viewingDepartment) {
          const updated = processed.find(p => p.mabomon === viewingDepartment.mabomon);
          if (updated) setViewingDepartment(updated);
        }
      }
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Lỗi tải dữ liệu',
        message: "Lỗi lấy thống kê: " + (error.message || error)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncData = () => {
    if (!viewingDepartment) return;
    setConfirmSyncModal(true);
  };

  const performSync = async () => {
    if (!viewingDepartment) return;
    setConfirmSyncModal(false);
    setIsSyncing(true);

    try {
      const maNVList = viewingDepartment.staffList.map(s => s.manv);
      
      const [nvRes, tdRes, trainingRes] = await Promise.all([
        supabase.from('DanhSachNhanVien').select('*').in('manv', maNVList),
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhSachQuaTrinhDaoTao').select('*').in('manv', maNVList)
      ]);

      if (nvRes.error) throw nvRes.error;
      
      const sourceEmployees = (nvRes.data || []).map(nv => normalizeKeys(nv)) as NhanVien[];
      const catalogDegrees = (tdRes.data || []).map(td => normalizeKeys(td)) as TrinhDo[];
      const sourceTraining = (trainingRes.data || []).map(tr => normalizeKeys(tr)) as QuaTrinhDaoTao[];

      let updateCount = 0;

      for (const currentStaff of viewingDepartment.staffList) {
        const sourceEmp = sourceEmployees.find(e => e.manv === currentStaff.manv);
        if (!sourceEmp) continue;

        const staffTraining = sourceTraining.filter(t => t.manv === currentStaff.manv);
        const degreeLabel = catalogDegrees.find(d => d.matrinhdo === sourceEmp.trinhdo)?.giatri || sourceEmp.trinhdo || '';
        
        const trainDH = staffTraining.find(t => t.trinhdodaotao === 'Đại học');
        const trainThS = staffTraining.find(t => t.trinhdodaotao === 'Thạc sĩ');
        const trainTS = staffTraining.find(t => t.trinhdodaotao === 'Tiến sĩ');

        const updates: any = {};

        if (currentStaff.holot !== sourceEmp.holot) updates.holot = sourceEmp.holot;
        if (currentStaff.ten !== sourceEmp.ten) updates.ten = sourceEmp.ten;
        if (currentStaff.ngaysinh !== sourceEmp.ngaysinh) updates.ngaysinh = sourceEmp.ngaysinh;
        if (currentStaff.vithunhansu !== sourceEmp.vithu) updates.vithunhansu = sourceEmp.vithu;
        if (currentStaff.ngaychinhthuc !== sourceEmp.ngaychinhthuc) updates.ngaychinhthuc = sourceEmp.ngaychinhthuc;
        if (currentStaff.ngayqdtrogiang !== sourceEmp.ngayqdtrogiang) updates.ngayqdtrogiang = sourceEmp.ngayqdtrogiang;
        if (currentStaff.ngayqdgiangvien !== sourceEmp.ngayqdgiangvien) updates.ngayqdgiangvien = sourceEmp.ngayqdgiangvien;
        if (currentStaff.danghiviec !== sourceEmp.danghiviec) updates.danghiviec = sourceEmp.danghiviec;
        if (currentStaff.trinhdo !== degreeLabel) updates.trinhdo = degreeLabel;

        const sourceCN = trainDH?.chuyennganh || '';
        if (currentStaff.chuyennganhdaotaodaihoc !== sourceCN) updates.chuyennganhdaotaodaihoc = sourceCN;

        const sourceNamDH = trainDH?.namtnxeploai || '';
        if (currentStaff.totnghiepdaihoc !== sourceNamDH) updates.totnghiepdaihoc = sourceNamDH;

        const sourceNamThS = trainThS?.namtnxeploai || '';
        if (currentStaff.totnghiepthacsy !== sourceNamThS) updates.totnghiepthacsy = sourceNamThS;

        const sourceNamTS = trainTS?.namtnxeploai || '';
        if (currentStaff.totnghieptiensy !== sourceNamTS) updates.totnghieptiensy = sourceNamTS;

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from('DanhSachNhanSuBoMon')
            .update(updates)
            .eq('id', currentStaff.id);
          
          if (!error) updateCount++;
        }
      }

      await fetchStatistics();
      setAlertModal({
        isOpen: true,
        type: 'success',
        title: 'Cập nhật thành công',
        message: `Đã hoàn tất cập nhật dữ liệu mới nhất từ hồ sơ gốc!\nTổng số hồ sơ có sự thay đổi được ghi nhận: ${updateCount}`
      });

    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Lỗi hệ thống',
        message: "Có lỗi xảy ra trong quá trình cập nhật dữ liệu: " + err.message
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr;
    }
  };

  const filteredStaffInModal = useMemo(() => {
    if (!viewingDepartment) return [];
    return viewingDepartment.staffList.filter(ns => {
      const fullName = (ns.holot + ' ' + ns.ten).toLowerCase();
      const maNVStr = String(ns.manv || '').toLowerCase();
      const searchStr = modalSearch.toLowerCase();
      
      const matchesSearch = fullName.includes(searchStr) || maNVStr.includes(searchStr);
      const matchesDegree = modalDegreeFilter === '' || ns.trinhdo === modalDegreeFilter;
      
      return matchesSearch && matchesDegree;
    });
  }, [viewingDepartment, modalSearch, modalDegreeFilter]);

  const uniqueDegreesInModal = useMemo(() => {
    if (!viewingDepartment) return [];
    return Array.from(new Set(viewingDepartment.staffList.map(s => s.trinhdo))).filter(Boolean).sort();
  }, [viewingDepartment]);

  const handleExportExcel = () => {
    if (!viewingDepartment || filteredStaffInModal.length === 0) return;

    const exportData = filteredStaffInModal.map(ns => ({
      'ID': ns.id,
      'Mã NV': ns.manv,
      'Họ và Tên': `${ns.holot} ${ns.ten}`,
      'Ngày sinh': formatDate(ns.ngaysinh),
      'Trình độ': ns.trinhdo,
      'Chuyên ngành ĐT ĐH': ns.chuyennganhdaotaodaihoc,
      'Ngày chính thức': formatDate(ns.ngaychinhthuc),
      'Ngày QĐ Trợ giảng': formatDate(ns.ngayqdtrogiang),
      'Ngày QĐ Giảng viên': formatDate(ns.ngayqdgiangvien),
      'Tốt nghiệp Đại học': ns.totnghiepdaihoc,
      'Tốt nghiệp Thạc sỹ': ns.totnghiepthacsy,
      'Tốt nghiệp Tiến sỹ': ns.totnghieptiensy,
      'Chức vụ quản lý': ns.chucvuquanly
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachNhanSu");
    XLSX.writeFile(wb, `DanhSachNhanSu_${viewingDepartment.giatri.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleExportAPI = () => {
    if (!viewingDepartment || filteredStaffInModal.length === 0) return;

    // Chuẩn bị dữ liệu JSON sạch để kế thừa
    const apiPayload = {
      department: viewingDepartment.giatri,
      parentUnit: viewingDepartment.unitName,
      exportDate: new Date().toISOString(),
      staffCount: filteredStaffInModal.length,
      staffList: filteredStaffInModal.map(ns => ({
        id: ns.id,
        employeeCode: ns.manv,
        firstName: ns.holot,
        lastName: ns.ten,
        fullName: `${ns.holot} ${ns.ten}`,
        birthDate: ns.ngaysinh,
        degree: ns.trinhdo,
        major: ns.chuyennganhdaotaodaihoc,
        joinDate: ns.ngaychinhthuc,
        appointedAssistantDate: ns.ngayqdtrogiang,
        appointedLecturerDate: ns.ngayqdgiangvien,
        educationHistory: {
          bachelor: ns.totnghiepdaihoc,
          master: ns.totnghiepthacsy,
          doctorate: ns.totnghieptiensy
        },
        managementPosition: ns.chucvuquanly
      }))
    };

    const jsonString = JSON.stringify(apiPayload, null, 2);
    
    // Tạo file blob để tải về
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `API_NhanSu_${viewingDepartment.giatri.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setAlertModal({
      isOpen: true,
      type: 'info',
      title: 'Dữ liệu đã sẵn sàng',
      message: "Đã khởi tạo file JSON (API Data). Bạn có thể sử dụng dữ liệu này để kế thừa vào các ứng dụng khác."
    });
  };

  const handlePrint = () => {
    if (!viewingDepartment || filteredStaffInModal.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMin = String(now.getMinutes()).padStart(2, '0');
    const currentSec = String(now.getSeconds()).padStart(2, '0');
    const currentDay = String(now.getDate()).padStart(2, '0');
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentYear = now.getFullYear();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In Danh sách Giảng viên - ${viewingDepartment.giatri}</title>
        <style>
          @media print {
            @page { size: A4 landscape; margin: 15mm 10mm 15mm 10mm; }
            .page-footer { position: fixed; bottom: 0; width: 100%; border-top: 0.5px solid #ccc; padding-top: 5px; display: flex; justify-content: space-between; font-size: 10px; font-style: italic; color: #444; }
            .page-number:after { content: "Trang " counter(page); }
          }
          body { font-family: "Times New Roman", Times, serif; font-size: 12px; line-height: 1.3; color: black; padding: 0; counter-reset: page; }
          .report-header { display: flex; justify-content: space-between; margin-bottom: 30px; text-align: center; }
          .header-left { width: 45%; }
          .header-right { width: 50%; }
          .header-bold { font-weight: bold; text-transform: uppercase; font-size: 13px; }
          .header-sub { font-weight: bold; font-size: 12px; }
          .line-decor { border-bottom: 1px solid black; display: inline-block; width: 150px; margin-top: 2px; }
          .title-container { text-align: center; margin: 10px 0 30px 0; }
          .title-main { font-weight: bold; font-size: 18px; text-transform: uppercase; }
          .title-sub { font-weight: bold; font-size: 16px; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
          th, td { border: 1px solid black; padding: 4px 2px; text-align: center; font-size: 10px; word-wrap: break-word; }
          th { font-weight: bold; background-color: #f3f4f6; }
          .text-left { text-align: left; padding-left: 5px; }
          .report-footer { margin-top: 40px; float: right; width: 300px; text-align: center; }
          .footer-location { font-style: italic; font-size: 12px; margin-bottom: 5px; }
          .footer-unit { font-weight: bold; font-size: 13px; text-transform: uppercase; }
          .page-footer { display: none; }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="header-left">
            <div class="header-bold">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
            <div class="header-bold">TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG</div>
            <div class="line-decor"></div>
          </div>
          <div class="header-right">
            <div class="header-bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div class="header-sub">Độc lập - Tự do - Hạnh phúc</div>
            <div class="line-decor"></div>
          </div>
        </div>
        <div class="title-container">
          <div class="title-main">Danh sách Giảng viên Bộ môn</div>
          <div class="title-sub">${viewingDepartment.giatri} - ${viewingDepartment.unitName}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 30px;">STT</th>
              <th rowspan="2" style="width: 120px;">Họ và Tên Giảng viên</th>
              <th rowspan="2" style="width: 70px;">Ngày sinh</th>
              <th rowspan="2" style="width: 60px;">Trình độ</th>
              <th rowspan="2">Chuyên ngành Đào tạo</th>
              <th colspan="3">Quá trình Đào tạo - Năm tốt nghiệp</th>
              <th colspan="3">Quá trình Công tác</th>
              <th rowspan="2" style="width: 80px;">Chức vụ</th>
            </tr>
            <tr>
              <th style="width: 50px;">Đại học</th>
              <th style="width: 50px;">Thạc sĩ</th>
              <th style="width: 50px;">Tiến sĩ</th>
              <th style="width: 75px;">Ngày vào Trường</th>
              <th style="width: 75px;">Ngày QĐ Trợ giảng</th>
              <th style="width: 75px;">Ngày QĐ Giảng viên</th>
            </tr>
          </thead>
          <tbody>
            ${filteredStaffInModal.map((ns, index) => `
              <tr>
                <td>${index + 1}</td>
                <td class="text-left">${ns.holot} ${ns.ten}</td>
                <td>${formatDate(ns.ngaysinh)}</td>
                <td>${ns.trinhdo}</td>
                <td class="text-left">${ns.chuyennganhdaotaodaihoc || ''}</td>
                <td>${ns.totnghiepdaihoc || ''}</td>
                <td>${ns.totnghiepthacsy || ''}</td>
                <td>${ns.totnghieptiensy || ''}</td>
                <td>${formatDate(ns.ngaychinhthuc)}</td>
                <td>${formatDate(ns.ngayqdtrogiang)}</td>
                <td>${formatDate(ns.ngayqdgiangvien)}</td>
                <td>${ns.chucvuquanly || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="report-footer">
          <div class="footer-location">Đà Nẵng, ngày ${currentDay} tháng ${currentMonth} năm ${currentYear}</div>
          <div class="footer-unit">Phòng Tổ chức - Hành chính</div>
        </div>
        <div class="page-footer">
          <div class="print-time">
            In vào lúc ${currentHour} giờ ${currentMin} phút ${currentSec} giây ngày ${currentDay} tháng ${currentMonth} năm ${currentYear}
          </div>
          <div class="page-number"></div>
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-blue-600">
        <Loader2 className="h-10 w-10 animate-spin mb-4" />
        <p className="font-bold">Đang tổng hợp dữ liệu Tổ bộ môn...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex items-center justify-between border-b-2 border-red-600 pb-2">
        <h2 className="text-2xl font-black text-red-700 flex items-center gap-2">
          <BarChart3 className="h-7 w-7" />
          THỐNG KÊ
        </h2>
        <div className="text-xs text-gray-500 font-bold bg-gray-100 px-3 py-1 rounded-full border border-gray-300">
          Cập nhật: {new Date().toLocaleDateString('vi-VN')}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {statsData.map((bm, index) => {
          const nonZeroDegrees = bm.chartData.filter((d: any) => d.value > 0);
          const isSingleDegree = nonZeroDegrees.length === 1;
          const singleDegreeData = isSingleDegree ? nonZeroDegrees[0] : null;

          return (
            <div key={index} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-2xl transition-all flex flex-col group">
              <div className="bg-white p-5 border-b border-black">
                <h3 className="text-xl font-black text-red-600 flex items-center gap-2 truncate tracking-tight">
                  <Building className="h-6 w-6 text-gray-700" />
                  {bm.giatri}
                </h3>
                <div className="flex flex-col mt-2">
                  <span className="text-xs font-bold text-blue-500 tracking-widest border-l-2 border-red-500 pl-2">
                    Bộ môn trực thuộc {bm.unitName}
                  </span>
                  <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 bg-gray-100 px-4 py-1.5 rounded border border-gray-300">
                          <Users className="h-4 w-4 text-gray-600" />
                          <span className="text-sm font-black text-gray-800">Tổng số: {bm.total} nhân sự</span>
                      </div>
                      {(canRead || canUpdate) && (
                        <button 
                            onClick={() => {
                              setViewingDepartment(bm);
                              setModalSearch('');
                              setModalDegreeFilter('');
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 hover:underline underline-offset-4 transition-all"
                        >
                            <List className="h-4 w-4" />
                            Xem danh sách...
                        </button>
                      )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50/30 flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                 <div className="flex flex-col items-center justify-center border-r border-gray-100 h-full min-h-[220px]">
                    {isSingleDegree ? (
                      <div className="flex flex-col items-center justify-center animate-in zoom-in duration-500">
                        <span className="text-[100px] font-black leading-none drop-shadow-md" style={{ color: singleDegreeData.color }}>
                          {singleDegreeData.value}
                        </span>
                        <div className="px-4 py-1 rounded-full text-white text-xs font-black tracking-widest mt-2" style={{ backgroundColor: singleDegreeData.color }}>
                          {singleDegreeData.label}
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold mt-2">Nhân sự Bộ môn</p>
                      </div>
                    ) : (
                      <SimpleDoughnutChart data={bm.chartData} />
                    )}
                 </div>

                 <div className="flex flex-col space-y-3 px-2">
                    <h4 className="text-[10px] font-black text-red-400 border-b border-gray-200 pb-1 mb-2 tracking-widest text-center ">Thống kê Trình độ Giảng viên</h4>
                    {bm.chartData.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:border-blue-200 transition-colors group">
                         <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: `${item.color}10` }}>
                               <GraduationCap className="h-5 w-5" style={{ color: item.color }} />
                            </div>
                            <div>
                               <p className="text-xs font-bold text-gray-700">{item.label}</p>
                               <p className="text-[10px] text-gray-400 font-medium">Số lượng</p>
                            </div>
                         </div>
                         <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black" style={{ color: item.color }}>{item.value}</span>
                            <span className="text-[10px] text-gray-400 font-bold">người</span>
                         </div>
                      </div>
                    ))}
                    <div className="pt-4 flex items-center gap-2 text-red-400 italic text-[9px] w-full justify-center">
                      <Info className="h-3 w-3" />
                      Dữ liệu hệ thống quản lý DAU HRM
                    </div>
                 </div>
              </div>
            </div>
          );
        })}
      </div>

      {viewingDepartment && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-gray-900 bg-opacity-70 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[98vw] overflow-hidden relative border border-gray-300 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95vh]">
                <div className="bg-white border-b-2 border-gray-100 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-50 p-2 rounded-lg border border-red-100 shadow-sm">
                             <Users className="h-8 w-8 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-xl md:text-2xl font-black text-blue-400 tracking-tight leading-none">
                                Danh sách Giảng viên {viewingDepartment.giatri}
                            </h3>
                            <p className="text-xs font-bold text-red-600 mt-1 tracking-widest">Bộ môn trực thuộc: {viewingDepartment.unitName}</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                             <input 
                                type="text" 
                                placeholder="Tìm kiếm Họ lót, Tên..." 
                                className="pl-9 w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white text-black font-normal focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm"
                                value={modalSearch}
                                onChange={(e) => setModalSearch(e.target.value)}
                             />
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {canUpdate && (
                            <button 
                                onClick={handleSyncData}
                                disabled={isSyncing}
                                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 focus:outline-none transition-all disabled:opacity-50"
                            >
                                {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Cập nhật dữ liệu
                            </button>
                          )}
                          
                          <button 
                              onClick={handleExportAPI}
                              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 transition-all"
                              title="Xuất dữ liệu định dạng JSON để kế thừa hệ thống"
                          >
                              <Code className="h-4 w-4 mr-2 text-indigo-600" />
                              Xuất API (JSON)
                          </button>

                          <button 
                              onClick={handleExportExcel}
                              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-bold text-blue-800 bg-blue-100 hover:bg-blue-200 transition-all"
                          >
                              <FileDown className="h-4 w-4 mr-2" />
                              Xuất Excel
                          </button>
                          
                          <button 
                              onClick={handlePrint}
                              className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all"
                          >
                              <Printer className="h-4 w-4 mr-2" />
                              In danh sách
                          </button>
                        </div>
                        
                        <button onClick={() => setViewingDepartment(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-600 border border-transparent hover:border-gray-200 transition-all self-start">
                            <X className="h-8 w-8" />
                        </button>
                    </div>
                </div>

                <div className="p-4 overflow-x-auto bg-white flex-1 custom-scrollbar">
                    <div className="overflow-hidden min-w-max">
                        <table className="min-w-max w-full divide-y divide-gray-200 border-collapse">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="w-[50px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">ID</th>
                                    <th className="w-[50px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">Mã NV</th>
                                    <th className="w-[170px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">Họ và Tên GV</th>
                                    <th className="w-[100px] px-4 py-4 text-center bg-gray-50/50">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-sm font-bold text-red-600">Trình độ</span>
                                            <div className="relative">
                                                {/* Corrected JSX syntax: replaced key(d) and value(d) with key={d} and value={d} */}
                                                <select className="w-full text-[10px] border border-gray-300 rounded px-2 py-1 font-bold text-blue-600 bg-white outline-none focus:ring-1 focus:ring-blue-400 appearance-none cursor-pointer" value={modalDegreeFilter} onChange={(e) => setModalDegreeFilter(e.target.value)}>
                                                    <option value="">Tất cả</option>
                                                    {uniqueDegreesInModal.map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>
                                                <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><ChevronDown className="h-3 w-3" /></div>
                                            </div>
                                        </div>
                                    </th>
                                    <th className="w-[120px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">Ngày sinh</th>
                                    <th className="w-[150px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">Chuyên ngành đào tạo</th>
                                    <th className="w-[150px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">Ngày chính thức</th>
                                    <th className="w-[100px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">Ngày QĐ Trợ giảng</th>
                                    <th className="w-[100px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">Ngày QĐ Giảng viên</th>
                                    <th className="w-[100px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">Tốt nghiệp ĐH</th>
                                    <th className="w-[100px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">Tốt nghiệp ThS</th>
                                    <th className="w-[100px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">Tốt nghiệp TS</th>
                                    <th className="w-[100px] px-4 py-4 text-center text-sm font-bold text-red-600 bg-white">Chức vụ</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredStaffInModal.length === 0 ? (
                                    <tr><td colSpan={13} className="px-6 py-20 text-center text-gray-500 font-bold italic text-lg ">Không tìm thấy nhân sự phù hợp</td></tr>
                                ) : (
                                    filteredStaffInModal.map((ns) => (
                                        <tr key={ns.id} className="hover:bg-blue-50/30 transition-colors border-b border-gray-50">
                                            <td className="px-4 py-5 text-center text-sm font-medium text-gray-500">{ns.id}</td>
                                            <td className="px-4 py-5 text-center text-sm font-medium text-gray-500">{ns.manv}</td>
                                            <td className="px-4 py-5 text-left text-sm font-medium text-gray-500">{ns.holot} {ns.ten}</td>
                                            <td className="px-4 py-5 text-center text-sm font-medium text-gray-500">{ns.trinhdo}</td>
                                            <td className="px-4 py-5 text-center text-sm font-medium text-gray-500">{formatDate(ns.ngaysinh)}</td>
                                            <td className="px-4 py-5 text-left text-sm font-medium text-gray-500">{ns.chuyennganhdaotaodaihoc || '-'}</td>
                                            <td className="px-4 py-5 text-center text-sm font-medium text-gray-500">{formatDate(ns.ngaychinhthuc)}</td>
                                            <td className="px-4 py-5 text-center text-sm font-medium text-gray-500">{formatDate(ns.ngayqdtrogiang)}</td>
                                            <td className="px-4 py-5 text-center text-sm font-medium text-gray-500">{formatDate(ns.ngayqdgiangvien)}</td>
                                            <td className="px-4 py-5 text-center text-sm font-medium text-gray-500">{ns.totnghiepdaihoc || '-'}</td>
                                            <td className="px-4 py-5 text-center text-sm font-medium text-gray-500">{ns.totnghiepthacsy || '-'}</td>
                                            <td className="px-4 py-5 text-center text-sm font-medium text-gray-500">{ns.totnghieptiensy || '-'}</td>
                                            <td className="px-4 py-5 text-center text-sm font-medium text-red-500">{ns.chucvuquanly || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-gray-50 px-8 py-5 flex justify-between items-center border-t border-gray-200">
                    <div className="flex items-center gap-6">
                        <p className="text-xs font-black text-gray-500 tracking-widest flex items-center gap-2">
                             Trạng thái: <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200 text-[10px]">Đang làm việc</span>
                        </p>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <p className="text-xs font-black text-gray-500 tracking-widest">
                            Hiện có: <span className="text-red-600 text-sm font-black">{filteredStaffInModal.length} / {viewingDepartment.staffList.length}</span> Nhân sự
                        </p>
                    </div>
                    <button 
                        onClick={() => setViewingDepartment(null)}
                        className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none transition-all active:scale-95"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Confirmation Modal for Sync */}
      {confirmSyncModal && viewingDepartment && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-amber-100">
             <div className="bg-amber-600 p-5 text-white flex items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin-slow" />
                <h3 className="text-lg font-bold">Xác nhận cập nhật dữ liệu</h3>
             </div>
             <div className="p-8 text-center space-y-4">
                <p className="text-gray-700 font-medium leading-relaxed">
                  Bạn có chắc chắn muốn cập nhật số liệu mới nhất cho Giảng viên thuộc bộ môn <span className="text-blue-600 font-bold">"{viewingDepartment.giatri}"</span> từ hồ sơ nhân sự gốc không?
                </p>
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex items-start gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-800 font-medium">Hành động này sẽ ghi đè các thông tin Trình độ, Chuyên ngành và Năm tốt nghiệp hiện tại của nhân sự trong bộ môn này bằng dữ liệu mới nhất từ Hồ sơ nhân sự chính.</p>
                </div>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center gap-3">
                <button 
                  onClick={() => setConfirmSyncModal(false)}
                  className="px-6 py-2 bg-white text-gray-700 font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-all active:scale-95 text-sm"
                >
                  Hủy bỏ
                </button>
                <button 
                  disabled={isSyncing}
                  onClick={performSync}
                  className="px-8 py-2 bg-amber-600 text-white font-bold rounded-xl shadow-md hover:bg-amber-700 transition-all active:scale-95 text-sm flex items-center gap-2"
                >
                  {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Đồng ý cập nhật
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Alert/Notification Modal */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border ${alertModal.type === 'error' ? 'border-red-100' : 'border-blue-100'}`}>
             <div className={`${alertModal.type === 'error' ? 'bg-red-600' : 'bg-blue-800'} p-5 text-white flex items-center gap-3`}>
                {alertModal.type === 'error' ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="h-6 w-6" />}
                <h3 className="text-lg font-bold">{alertModal.title}</h3>
             </div>
             <div className="p-8 text-center space-y-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-inner ${alertModal.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                  {alertModal.type === 'error' ? <X size={32} /> : <Save size={32} />}
                </div>
                <p className="text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">{alertModal.message}</p>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                <button 
                  onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                  className={`px-10 py-2.5 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-xs tracking-widest ${alertModal.type === 'error' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  ĐÃ RÕ
                </button>
             </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ef4444; border-radius: 10px; border: 3px solid #f8fafc; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .animate-spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
