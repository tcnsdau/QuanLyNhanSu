
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { NhanVien, PhongBan, TrinhDo, ChucDanh } from '../types';
import { BarChart2, FileText, Printer, Search, Loader, Building2, Users } from 'lucide-react';

interface ThongKeTrinhDoChucDanhProps {
  permissions?: any[];
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

export const ThongKeTrinhDoChucDanh: React.FC<ThongKeTrinhDoChucDanhProps> = () => {
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState<PhongBan[]>([]);
  const [scope, setScope] = useState<'all' | 'unit'>('all');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [stats, setStats] = useState<any>(null);
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [detailedStats, setDetailedStats] = useState<any[]>([]);
  const [printTime, setPrintTime] = useState('');

  useEffect(() => {
    const fetchUnits = async () => {
      const { data, error } = await supabase
        .from('DanhMucPhongBan')
        .select('*')
        .order('sapxep', { ascending: true });
      if (!error && data) {
        setUnits(data.map(normalizeKeys));
      }
    };
    fetchUnits();
  }, []);

  const handleStatistics = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('DanhSachNhanVien')
        .select('phongban, trinhdo, chucdanh, danghiviec, gioitinh')
        .eq('danghiviec', false);

      if (scope === 'unit' && selectedUnitId) {
        query = query.eq('phongban', selectedUnitId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const allNV = (data || []).map(normalizeKeys) as NhanVien[];

      // Thống kê
      let gs_total = 0, gs_male = 0, gs_female = 0;
      let pgs_total = 0, pgs_male = 0, pgs_female = 0;
      let ts_total = 0, ts_male = 0, ts_female = 0;
      let ths_total = 0, ths_male = 0, ths_female = 0;
      let dh_total = 0, dh_male = 0, dh_female = 0;
      let cd_total = 0, cd_male = 0, cd_female = 0;
      let tc_total = 0, tc_male = 0, tc_female = 0;
      let khac_total = 0, khac_male = 0, khac_female = 0;

      allNV.forEach(nv => {
        const cd = String(nv.chucdanh);
        const td = String(nv.trinhdo);
        const isMale = nv.gioitinh;

        if (cd === '1') { // Giáo sư
          gs_total++;
          if (isMale) gs_male++; else gs_female++;
        } else if (cd === '2') { // Phó Giáo sư
          pgs_total++;
          if (isMale) pgs_male++; else pgs_female++;
        }
        
        // Trình độ (Tiến sĩ không tính GS/PGS)
        if (td === '1' && cd !== '1' && cd !== '2') {
          ts_total++;
          if (isMale) ts_male++; else ts_female++;
        } else if (td === '2') {
          ths_total++;
          if (isMale) ths_male++; else ths_female++;
        } else if (td === '3') {
          dh_total++;
          if (isMale) dh_male++; else dh_female++;
        } else if (td === '4') {
          cd_total++;
          if (isMale) cd_male++; else cd_female++;
        } else if (td === '5') {
          tc_total++;
          if (isMale) tc_male++; else tc_female++;
        } else if (['6', '7', '8'].includes(td)) {
          khac_total++;
          if (isMale) khac_male++; else khac_female++;
        }
      });

      const total_all = allNV.length;
      const total_male = allNV.filter(nv => nv.gioitinh).length;
      const total_female = total_all - total_male;

      setStats({
        gs: { total: gs_total, male: gs_male, female: gs_female },
        pgs: { total: pgs_total, male: pgs_male, female: pgs_female },
        ts: { total: ts_total, male: ts_male, female: ts_female },
        ths: { total: ths_total, male: ths_male, female: ths_female },
        dh: { total: dh_total, male: dh_male, female: dh_female },
        cd: { total: cd_total, male: cd_male, female: cd_female },
        tc: { total: tc_total, male: tc_male, female: tc_female },
        khac: { total: khac_total, male: khac_male, female: khac_female },
        summary: { total: total_all, male: total_male, female: total_female },
        unitName: scope === 'all' ? 'Toàn trường' : units.find(u => String(u.maphongban) === selectedUnitId)?.giatri || 'Đơn vị đã chọn'
      });

      // Calculate detailed stats if scope is 'all'
      if (scope === 'all') {
        const unitGroups: { [key: string]: NhanVien[] } = {};
        allNV.forEach(nv => {
          const pb = String(nv.phongban);
          if (!unitGroups[pb]) unitGroups[pb] = [];
          unitGroups[pb].push(nv);
        });

        const detailed = units
          .map(unit => {
            const nvInUnit = unitGroups[String(unit.maphongban)] || [];
            if (nvInUnit.length === 0) return null;

            let u_gs = 0, u_pgs = 0, u_ts = 0, u_ths = 0, u_dh = 0, u_cd = 0, u_tc = 0, u_khac = 0;
            nvInUnit.forEach(nv => {
              const cd = String(nv.chucdanh);
              const td = String(nv.trinhdo);
              if (cd === '1') u_gs++;
              else if (cd === '2') u_pgs++;
              
              if (td === '1' && cd !== '1' && cd !== '2') u_ts++;
              else if (td === '2') u_ths++;
              else if (td === '3') u_dh++;
              else if (td === '4') u_cd++;
              else if (td === '5') u_tc++;
              else if (['6', '7', '8'].includes(td)) u_khac++;
            });

            return {
              unitName: unit.giatri,
              gs: u_gs,
              pgs: u_pgs,
              ts: u_ts,
              ths: u_ths,
              dh: u_dh,
              cd: u_cd,
              tc: u_tc,
              khac: u_khac,
              total: nvInUnit.length
            };
          })
          .filter(Boolean);
        setDetailedStats(detailed);
      } else {
        setDetailedStats([]);
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi khi thống kê dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!stats) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const now = new Date();
    const dd = now.getDate().toString().padStart(2, '0');
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = now.getFullYear();
    const reportDateStr = `Đà Nẵng, ngày ${dd} tháng ${mm} năm ${yyyy}`;
    
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
    const printTimeStr = `In vào lúc ${displayHours} giờ ${minutes} phút ${seconds} giây ngày ${dd}/${mm}/${yyyy}`;

    const htmlContent = `
      <html>
      <head>
        <title>Thống kê số lượng GVNV</title>
        <style>
          @page { 
            size: A4; 
            margin: 0; 
          }
          body { 
            font-family: "Times New Roman", Times, serif; 
            font-size: 12pt; 
            line-height: 1.4; 
            color: #000; 
            margin: 0; 
            padding: 15mm 15mm 20mm 15mm; 
            counter-reset: page;
          }
          .container { width: 100%; }
          .header-official {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            font-size: 11pt;
          }
          .header-left {
            text-align: center;
            width: 45%;
          }
          .header-right {
            text-align: center;
            width: 50%;
          }
          .header-line {
            font-weight: bold;
          }
          .header-subline {
            font-weight: bold;
            text-decoration: underline;
          }
          .title { 
            text-align: center; 
            font-size: 16pt; 
            font-weight: bold; 
            text-transform: uppercase; 
            margin-bottom: 5px; 
            margin-top: 10px;
          }
          .subtitle { 
            text-align: center; 
            font-size: 11pt; 
            font-weight: bold; 
            color: #d61c1c; 
            margin-bottom: 30px; 
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px; 
          }
          th, td { 
            border: 1px solid black; 
            padding: 8px; 
            text-align: left; 
          }
          th { 
            background-color: #f2f2f2; 
            font-weight: bold; 
            text-align: center; 
            text-transform: uppercase;
            font-size: 10pt;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .section-header { 
            font-weight: bold; 
            background-color: #f9f9f9;
          }
          .report-footer { 
            margin-top: 40px; 
            text-align: right; 
            font-style: italic; 
          }
          .footer-unit { 
            font-weight: bold; 
            text-transform: uppercase; 
            margin-top: 5px; 
            margin-right: 20px;
          }
          
          .page-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            font-size: 10pt;
            font-style: italic;
            border-top: 1px solid #000;
            padding: 5px 15mm 10px 15mm;
            background: white;
            width: calc(100% - 30mm);
          }
          .page-number:after {
            content: "Trang " counter(page) " / " counter(pages);
          }
          
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-official">
            <div class="header-left">
              <div class="header-line">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
              <div class="header-subline">TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG</div>
            </div>
            <div class="header-right">
              <div class="header-line">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div class="header-subline">Độc lập - Tự do - Hạnh phúc</div>
            </div>
          </div>

          <div class="title">THỐNG KÊ SỐ LƯỢNG GIẢNG VIÊN NHÂN VIÊN</div>
          <div class="subtitle">Phạm vi: ${stats.unitName}</div>

          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 50px;">STT</th>
                <th rowspan="2">Chức danh / Trình độ</th>
                <th colspan="3">Số lượng</th>
              </tr>
              <tr>
                <th style="width: 100px;">Tổng cộng</th>
                <th style="width: 100px;">Nam</th>
                <th style="width: 100px;">Nữ</th>
              </tr>
            </thead>
            <tbody>
              <tr class="font-bold">
                <td colspan="2" class="text-right">Tổng số GVNV</td>
                <td class="text-center">${formatValue(stats.summary.total)}</td>
                <td class="text-center">${formatValue(stats.summary.male)}</td>
                <td class="text-center">${formatValue(stats.summary.female)}</td>
              </tr>
              
              <tr class="section-header">
                <td colspan="5">I. Chức danh</td>
              </tr>
              <tr>
                <td class="text-center">1</td>
                <td>Giáo sư</td>
                <td class="text-center font-bold">${formatValue(stats.gs.total)}</td>
                <td class="text-center">${formatValue(stats.gs.male)}</td>
                <td class="text-center">${formatValue(stats.gs.female)}</td>
              </tr>
              <tr>
                <td class="text-center">2</td>
                <td>Phó Giáo sư</td>
                <td class="text-center font-bold">${formatValue(stats.pgs.total)}</td>
                <td class="text-center">${formatValue(stats.pgs.male)}</td>
                <td class="text-center">${formatValue(stats.pgs.female)}</td>
              </tr>

              <tr class="section-header">
                <td colspan="5">II. Trình độ</td>
              </tr>
              <tr>
                <td class="text-center">1</td>
                <td>Tiến sĩ</td>
                <td class="text-center font-bold">${formatValue(stats.ts.total)}</td>
                <td class="text-center">${formatValue(stats.ts.male)}</td>
                <td class="text-center">${formatValue(stats.ts.female)}</td>
              </tr>
              <tr>
                <td class="text-center">2</td>
                <td>Thạc sĩ</td>
                <td class="text-center font-bold">${formatValue(stats.ths.total)}</td>
                <td class="text-center">${formatValue(stats.ths.male)}</td>
                <td class="text-center">${formatValue(stats.ths.female)}</td>
              </tr>
              <tr>
                <td class="text-center">3</td>
                <td>Đại học</td>
                <td class="text-center font-bold">${formatValue(stats.dh.total)}</td>
                <td class="text-center">${formatValue(stats.dh.male)}</td>
                <td class="text-center">${formatValue(stats.dh.female)}</td>
              </tr>
              <tr>
                <td class="text-center">4</td>
                <td>Cao đẳng</td>
                <td class="text-center font-bold">${formatValue(stats.cd.total)}</td>
                <td class="text-center">${formatValue(stats.cd.male)}</td>
                <td class="text-center">${formatValue(stats.cd.female)}</td>
              </tr>
              <tr>
                <td class="text-center">5</td>
                <td>Trung cấp</td>
                <td class="text-center font-bold">${formatValue(stats.tc.total)}</td>
                <td class="text-center">${formatValue(stats.tc.male)}</td>
                <td class="text-center">${formatValue(stats.tc.female)}</td>
              </tr>
              <tr>
                <td class="text-center">6</td>
                <td>Khác</td>
                <td class="text-center font-bold">${formatValue(stats.khac.total)}</td>
                <td class="text-center">${formatValue(stats.khac.male)}</td>
                <td class="text-center">${formatValue(stats.khac.female)}</td>
              </tr>
            </tbody>
          </table>

          <div class="report-footer">
            <div>${reportDateStr}</div>
            <div class="footer-unit">Phòng Tổ chức – Hành chính</div>
          </div>
        </div>

        <div class="page-footer">
          <div>${printTimeStr}</div>
          <div class="page-number" style="font-weight: bold;"></div>
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

  const getReportFooterDate = () => {
    const now = new Date();
    const dd = now.getDate().toString().padStart(2, '0');
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = now.getFullYear();
    return `Đà Nẵng, ngày ${dd} tháng ${mm} năm ${yyyy}`;
  };

  const handlePrintDetailed = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const now = new Date();
    const dd = now.getDate().toString().padStart(2, '0');
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = now.getFullYear();
    const reportDateStr = `Đà Nẵng, ngày ${dd} tháng ${mm} năm ${yyyy}`;
    
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = (hours % 12 || 12).toString().padStart(2, '0');
    const printTimeStr = `In vào lúc ${displayHours} giờ ${minutes} phút ${seconds} giây ngày ${dd}/${mm}/${yyyy}`;

    const htmlContent = `
      <html>
      <head>
        <title>Chi tiết thống kê theo đơn vị</title>
        <style>
          @page { size: A4 landscape; margin: 0; }
          body { 
            font-family: "Times New Roman", Times, serif; 
            font-size: 10pt; 
            line-height: 1.3; 
            color: #000; 
            margin: 0; 
            padding: 15mm; 
            counter-reset: page; 
          }
          .container { width: 100%; }
          .header-official {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-size: 10pt;
          }
          .header-left {
            text-align: center;
            width: 45%;
          }
          .header-right {
            text-align: center;
            width: 50%;
          }
          .header-line {
            font-weight: bold;
          }
          .header-subline {
            font-weight: bold;
            text-decoration: underline;
          }
          .title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
          .subtitle { text-align: center; font-size: 11pt; font-style: italic; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid black; padding: 5px; text-align: center; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .report-footer { margin-top: 20px; text-align: right; font-style: italic; }
          .footer-unit { font-weight: bold; text-transform: uppercase; margin-top: 5px; }
          .page-footer { 
            position: fixed; 
            bottom: 0; 
            left: 0; 
            right: 0; 
            display: flex; 
            justify-content: space-between; 
            font-size: 9pt; 
            font-style: italic; 
            border-top: 1px solid #000; 
            padding: 5px 15mm; 
            background: white; 
            width: calc(100% - 30mm);
          }
          .page-number:after { content: "Trang " counter(page) " / " counter(pages); }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-official">
            <div class="header-left">
              <div class="header-line">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
              <div class="header-subline">TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG</div>
            </div>
            <div class="header-right">
              <div class="header-line">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div class="header-subline">Độc lập - Tự do - Hạnh phúc</div>
            </div>
          </div>
          <div class="title">THỐNG KÊ SỐ LƯỢNG GIẢNG VIÊN NHÂN VIÊN THEO ĐƠN VỊ</div>
          <div class="subtitle">Theo Chức danh và Trình độ đào tạo</div>
          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 30px;">STT</th>
                <th rowspan="2" style="text-align: left;">Tên Đơn vị</th>
                <th colspan="2">Chức danh</th>
                <th colspan="6">Trình độ</th>
                <th rowspan="2" style="width: 60px;">Tổng cộng</th>
              </tr>
              <tr>
                <th style="width: 40px;">GS</th>
                <th style="width: 40px;">PGS</th>
                <th style="width: 40px;">TS</th>
                <th style="width: 40px;">THS</th>
                <th style="width: 40px;">ĐH</th>
                <th style="width: 40px;">CĐ</th>
                <th style="width: 40px;">TC</th>
                <th style="width: 40px;">Khác</th>
              </tr>
            </thead>
            <tbody>
              ${detailedStats.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td class="text-left font-bold">${item.unitName}</td>
                  <td>${formatValue(item.gs)}</td>
                  <td>${formatValue(item.pgs)}</td>
                  <td>${formatValue(item.ts)}</td>
                  <td>${formatValue(item.ths)}</td>
                  <td>${formatValue(item.dh)}</td>
                  <td>${formatValue(item.cd)}</td>
                  <td>${formatValue(item.tc)}</td>
                  <td>${formatValue(item.khac)}</td>
                  <td class="font-bold">${formatValue(item.total)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="font-bold" style="background-color: #f2f2f2;">
                <td colspan="2">TỔNG CỘNG</td>
                <td>${formatValue(detailedStats.reduce((acc, curr) => acc + curr.gs, 0))}</td>
                <td>${formatValue(detailedStats.reduce((acc, curr) => acc + curr.pgs, 0))}</td>
                <td>${formatValue(detailedStats.reduce((acc, curr) => acc + curr.ts, 0))}</td>
                <td>${formatValue(detailedStats.reduce((acc, curr) => acc + curr.ths, 0))}</td>
                <td>${formatValue(detailedStats.reduce((acc, curr) => acc + curr.dh, 0))}</td>
                <td>${formatValue(detailedStats.reduce((acc, curr) => acc + curr.cd, 0))}</td>
                <td>${formatValue(detailedStats.reduce((acc, curr) => acc + curr.tc, 0))}</td>
                <td>${formatValue(detailedStats.reduce((acc, curr) => acc + curr.khac, 0))}</td>
                <td style="color: red;">${formatValue(detailedStats.reduce((acc, curr) => acc + curr.total, 0))}</td>
              </tr>
            </tfoot>
          </table>
          <div class="report-footer">
            <div>${reportDateStr}</div>
            <div class="footer-unit">Phòng Tổ chức – Hành chính</div>
          </div>
        </div>
        <div class="page-footer">
          <div>${printTimeStr}</div>
          <div class="page-number" style="font-weight: bold;"></div>
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

  const formatValue = (val: number) => (val === 0 ? '' : val);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4;
            margin: 20mm 15mm 25mm 15mm;
          }
          body {
            background: white !important;
          }
          .print-serif {
            font-family: "Times New Roman", Times, serif !important;
          }
          .page-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            font-size: 10pt;
            border-top: 1px solid #eee;
            padding-top: 5px;
            padding-bottom: 10px;
            background: white;
          }
          .page-number::after {
            content: "Trang " counter(page) "/" counter(pages);
          }
          .print-no-shadow {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          /* Hide browser default headers/footers */
          header, footer { display: none !important; }
        }
      ` }} />
      {/* Form Thống kê */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
        <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <BarChart2 className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-black text-blue-900 tracking-tight">Thống kê theo Chức danh và Trình độ</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 tracking-wider">Phạm vi thống kê</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="radio" 
                  name="scope" 
                  checked={scope === 'all'} 
                  onChange={() => setScope('all')}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">Toàn trường</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="radio" 
                  name="scope" 
                  checked={scope === 'unit'} 
                  onChange={() => setScope('unit')}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">Chọn đơn vị</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-gray-500 tracking-wider">Đơn vị</label>
            <select
              disabled={scope === 'all'}
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-50"
            >
              <option value="">-- Chọn đơn vị --</option>
              {units.map(u => (
                <option key={u.maphongban} value={u.maphongban}>{u.giatri}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleStatistics}
              disabled={loading || (scope === 'unit' && !selectedUnitId)}
              className="flex-1 h-10 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              THỐNG KÊ
            </button>
          </div>
        </div>
      </div>

      {/* Kết quả Thống kê */}
      {stats && (
        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-100 print:shadow-none print:border-none print-serif print-no-shadow relative">
          <div className="text-center mb-8 space-y-2">
            <h3 className="text-2xl font-black text-blue-900 uppercase tracking-tight print:text-black">THỐNG KÊ SỐ LƯỢNG GIẢNG VIÊN NHÂN VIÊN</h3>
            <p className="text-sm font-bold text-red-600 tracking-widest print:text-black">Phạm vi: {stats.unitName}</p>
            <div className="w-24 h-1 bg-blue-600 mx-auto rounded-full print:hidden"></div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200 print:border-black">
              <thead>
                <tr className="bg-blue-900 text-white print:bg-gray-100 print:text-black">
                  <th rowSpan={2} className="border border-blue-800 px-4 py-3 text-sm font-black uppercase tracking-wider text-center w-12 print:border-black">STT</th>
                  <th rowSpan={2} className="border border-blue-800 px-4 py-3 text-sm font-black tracking-wider text-left print:border-black">Chức danh / Trình độ</th>
                  <th colSpan={3} className="border border-blue-800 px-4 py-2 text-sm font-black  tracking-wider text-center print:border-black">Số lượng</th>
                </tr>
                <tr className="bg-blue-800 text-white print:bg-gray-50 print:text-black">
                  <th className="border border-blue-700 px-4 py-2 text-xs font-black tracking-wider text-center w-24 print:border-black">Tổng cộng</th>
                  <th className="border border-blue-700 px-4 py-2 text-xs font-black tracking-wider text-center w-24 print:border-black">Nam</th>
                  <th className="border border-blue-700 px-4 py-2 text-xs font-black tracking-wider text-center w-24 print:border-black">Nữ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 print:divide-black">
                <tr className="bg-gray-50 font-black text-blue-900 print:bg-transparent print:text-black">
                  <td colSpan={2} className="border border-gray-200 px-4 py-3 text-sm text-right print:border-black">Tổng số GVNV</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center print:border-black">{formatValue(stats.summary.total)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center print:border-black">{formatValue(stats.summary.male)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center print:border-black">{formatValue(stats.summary.female)}</td>
                </tr>
                
                {/* Chức danh */}
                <tr className="bg-blue-50/50 print:bg-transparent">
                  <td colSpan={5} className="border border-gray-200 px-4 py-2 text-xs font-black text-red-800 tracking-widest print:text-black print:border-black">I. Chức danh</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-bold text-gray-500 print:text-black print:border-black">1</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 print:text-black print:border-black">Giáo sư</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-black text-blue-900 print:text-black print:border-black">{formatValue(stats.gs.total)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.gs.male)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.gs.female)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-bold text-gray-500 print:text-black print:border-black">2</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 print:text-black print:border-black">Phó Giáo sư</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-black text-blue-900 print:text-black print:border-black">{formatValue(stats.pgs.total)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.pgs.male)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.pgs.female)}</td>
                </tr>

                {/* Trình độ */}
                <tr className="bg-blue-50/50 print:bg-transparent">
                  <td colSpan={5} className="border border-gray-200 px-4 py-2 text-xs font-black text-red-800 tracking-widest print:text-black print:border-black">II. Trình độ</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-bold text-gray-500 print:text-black print:border-black">1</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 print:text-black print:border-black">Tiến sĩ</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-black text-blue-900 print:text-black print:border-black">{formatValue(stats.ts.total)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.ts.male)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.ts.female)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-bold text-gray-500 print:text-black print:border-black">2</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 print:text-black print:border-black">Thạc sĩ</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-black text-blue-900 print:text-black print:border-black">{formatValue(stats.ths.total)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.ths.male)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.ths.female)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-bold text-gray-500 print:text-black print:border-black">3</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 print:text-black print:border-black">Đại học</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-black text-blue-900 print:text-black print:border-black">{formatValue(stats.dh.total)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.dh.male)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.dh.female)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-bold text-gray-500 print:text-black print:border-black">4</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 print:text-black print:border-black">Cao đẳng</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-black text-blue-900 print:text-black print:border-black">{formatValue(stats.cd.total)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.cd.male)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.cd.female)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-bold text-gray-500 print:text-black print:border-black">5</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 print:text-black print:border-black">Trung cấp</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-black text-blue-900 print:text-black print:border-black">{formatValue(stats.tc.total)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.tc.male)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.tc.female)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-bold text-gray-500 print:text-black print:border-black">6</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 print:text-black print:border-black">Khác</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center font-black text-blue-900 print:text-black print:border-black">{formatValue(stats.khac.total)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.khac.male)}</td>
                  <td className="border border-gray-200 px-4 py-3 text-sm text-center text-gray-600 print:text-black print:border-black">{formatValue(stats.khac.female)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Report Footer for Print */}
          <div className="hidden print:block mt-10 text-right font-serif italic">
            <p className="text-sm">{getReportFooterDate()}</p>
            <p className="text-sm font-bold uppercase mt-1">Phòng Tổ chức – Hành chính</p>
          </div>

          {/* Page Footer for Print */}
          <div className="hidden print:flex fixed bottom-0 left-0 right-0 justify-between text-[10pt] font-serif italic border-t border-gray-300 pt-2 pb-4 bg-white px-2">
            <div>{printTime}</div>
            <div className="page-number font-bold"></div>
          </div>

          <div className="mt-10 flex justify-between items-center print:hidden">
            <div>
              {scope === 'all' && (
                <button
                  onClick={() => setShowDetailedStats(true)}
                  className="px-6 py-2 bg-blue-50 text-blue-700 font-black rounded-xl border border-blue-100 shadow-sm hover:bg-blue-100 transition-all flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Chi tiết đơn vị
                </button>
              )}
            </div>
            <div className="flex gap-4">
              <button
                onClick={handlePrint}
                className="px-6 py-2 bg-gray-800 text-white font-black rounded-xl shadow-lg hover:bg-black transition-all flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                In Báo cáo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Stats Modal */}
      {showDetailedStats && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-900 text-white">
              <h3 className="text-xl font-black uppercase tracking-tight">Chi tiết thống kê theo đơn vị</h3>
              <button 
                onClick={() => setShowDetailedStats(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Search className="h-6 w-6 rotate-45" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-8">
              <div className="text-center mb-10">
                <h4 className="text-2xl font-black text-blue-900 uppercase tracking-tight">THỐNG KÊ SỐ LƯỢNG GIẢNG VIÊN NHÂN VIÊN</h4>
                <p className="italic text-gray-600">Theo Chức danh và Trình độ đào tạo</p>
              </div>

              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th rowSpan={2} className="border border-gray-300 p-2 w-12">STT</th>
                    <th rowSpan={2} className="border border-gray-300 p-2 text-left min-w-[200px]">Tên Đơn vị</th>
                    <th colSpan={2} className="border border-gray-300 p-2">Chức danh</th>
                    <th colSpan={6} className="border border-gray-300 p-2">Trình độ</th>
                    <th rowSpan={2} className="border border-gray-300 p-2 w-24">Tổng cộng</th>
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 p-2 w-16">GS</th>
                    <th className="border border-gray-300 p-2 w-16">PGS</th>
                    <th className="border border-gray-300 p-2 w-16">TS</th>
                    <th className="border border-gray-300 p-2 w-16">THS</th>
                    <th className="border border-gray-300 p-2 w-16">ĐH</th>
                    <th className="border border-gray-300 p-2 w-16">CĐ</th>
                    <th className="border border-gray-300 p-2 w-16">TC</th>
                    <th className="border border-gray-300 p-2 w-16">Khác</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedStats.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="border border-gray-300 p-2 text-center">{index + 1}</td>
                      <td className="border border-gray-300 p-2 font-bold text-gray-700">{item.unitName}</td>
                      <td className="border border-gray-300 p-2 text-center">{formatValue(item.gs)}</td>
                      <td className="border border-gray-300 p-2 text-center">{formatValue(item.pgs)}</td>
                      <td className="border border-gray-300 p-2 text-center">{formatValue(item.ts)}</td>
                      <td className="border border-gray-300 p-2 text-center">{formatValue(item.ths)}</td>
                      <td className="border border-gray-300 p-2 text-center">{formatValue(item.dh)}</td>
                      <td className="border border-gray-300 p-2 text-center">{formatValue(item.cd)}</td>
                      <td className="border border-gray-300 p-2 text-center">{formatValue(item.tc)}</td>
                      <td className="border border-gray-300 p-2 text-center">{formatValue(item.khac)}</td>
                      <td className="border border-gray-300 p-2 text-center font-black text-blue-900">{formatValue(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-black text-blue-900">
                    <td colSpan={2} className="border border-gray-300 p-2 text-center uppercase">Tổng cộng</td>
                    <td className="border border-gray-300 p-2 text-center">{formatValue(detailedStats.reduce((acc, curr) => acc + curr.gs, 0))}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatValue(detailedStats.reduce((acc, curr) => acc + curr.pgs, 0))}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatValue(detailedStats.reduce((acc, curr) => acc + curr.ts, 0))}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatValue(detailedStats.reduce((acc, curr) => acc + curr.ths, 0))}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatValue(detailedStats.reduce((acc, curr) => acc + curr.dh, 0))}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatValue(detailedStats.reduce((acc, curr) => acc + curr.cd, 0))}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatValue(detailedStats.reduce((acc, curr) => acc + curr.tc, 0))}</td>
                    <td className="border border-gray-300 p-2 text-center">{formatValue(detailedStats.reduce((acc, curr) => acc + curr.khac, 0))}</td>
                    <td className="border border-gray-300 p-2 text-center text-red-600">{formatValue(detailedStats.reduce((acc, curr) => acc + curr.total, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-4 bg-gray-50">
              <button
                onClick={handlePrintDetailed}
                className="px-6 py-2 bg-blue-600 text-white font-black rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                In Chi tiết
              </button>
              <button
                onClick={() => setShowDetailedStats(false)}
                className="px-6 py-2 bg-white text-gray-700 font-black rounded-xl border border-gray-200 hover:bg-gray-50 transition-all"
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
