
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { DanhMucNganhDaoTao, DanhSachGVNganhDaoTao, RolePermission, TrinhDo } from '../types';
import { BarChart3, Building, Info, Loader2, Users, List, GraduationCap, School, BarChart2, Printer } from 'lucide-react';

// Helper function to ensure keys are lowercase
const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

// Doughnut Chart Component (Inspired by ToBoMonStatistics.tsx)
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
                  fontSize="12" 
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
        <text x={centerX} y={centerY - 2} fontSize="9" fontWeight="bold" fill="#9ca3af" textAnchor="middle">TỔNG</text>
        <text x={centerX} y={centerY + 12} fontSize="18" fontWeight="900" fill="#1e40af" textAnchor="middle">{total}</text>
      </svg>
      
      <div className="flex flex-row flex-wrap justify-center gap-4 mt-1">
        {data.map((item, i) => (
          <div key={i} className="flex items-center text-[11px] font-bold text-gray-600">
            <div className="w-3 h-3 rounded-full mr-2 shadow-sm" style={{ backgroundColor: item.color }}></div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const NganhDaoTaoStatistics: React.FC<{ permissions?: RolePermission[], isAdmin?: boolean, currentUser?: any }> = ({ permissions: initialPermissions, isAdmin, currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions || []);

  useEffect(() => {
    if (initialPermissions && initialPermissions.length > 0) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const [nganhRes, gvRes, tdRes, cdRes, pbRes, nvRes] = await Promise.all([
        supabase.from('DanhMucNganhDaoTao').select('*').order('tennganh', { ascending: true }),
        supabase.from('DanhSachGVNganhDaoTao').select('*'),
        supabase.from('DanhMucTrinhDo').select('*'),
        supabase.from('DanhMucChucDanh').select('*'),
        supabase.from('DanhMucPhongBan').select('*'),
        supabase.from('DanhSachNhanVien').select('manv, holot, ten, chucdanh, trinhdo, phongban').eq('danghiviec', false)
      ]);

      if (nganhRes.error) throw nganhRes.error;
      if (gvRes.error) throw gvRes.error;
      if (tdRes.error) throw tdRes.error;

      const nganhs = (nganhRes.data || []).map(n => normalizeKeys(n)) as DanhMucNganhDaoTao[];
      const gvAssignments = (gvRes.data || []).map(g => normalizeKeys(g)) as DanhSachGVNganhDaoTao[];
      const trinhDos = (tdRes.data || []).map(t => normalizeKeys(t)) as any[];
      const chucDanhs = (cdRes.data || []).map(c => normalizeKeys(c)) as any[];
      const phongBans = (pbRes.data || []).map(p => normalizeKeys(p)) as any[];
      const employees = (nvRes.data || []).map(n => normalizeKeys(n)) as any[];

      const processed = nganhs.map(nganh => {
        const assignedGV = gvAssignments.filter(gv => String(gv.nganhdaotao) === String(nganh.manganh));
        
        // Detailed list for printing
        const detailedStaff = assignedGV.map(gv => {
            const emp = employees.find(e => String(e.manv) === String(gv.manv));
            const tdLabel = trinhDos.find(t => String(t.matrinhdo) === String(gv.trinhdo))?.giatri || gv.trinhdo || '';
            const cdLabel = chucDanhs.find(c => String(c.machucdanh) === String(gv.chucdanh))?.giatri || gv.chucdanh || '';
            const pbLabel = phongBans.find(p => String(p.maphongban) === String(gv.phongban))?.giatri || gv.phongban || '';

            return {
                ...gv,
                holot: emp?.holot || '---',
                ten: emp?.ten || '---',
                ten_trinhdo: tdLabel,
                ten_chucdanh: cdLabel,
                ten_phongban: pbLabel
            };
        });

        const degrees: Record<string, number> = {
          'Tiến sĩ': 0,
          'Thạc sĩ': 0,
          'Đại học': 0
        };

        detailedStaff.forEach(gv => {
          const td = (gv.ten_trinhdo || '').toLowerCase();
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
          ...nganh,
          total: assignedGV.length,
          degrees,
          chartData,
          detailedStaff
        };
      });

      setStatsData(processed);
    } catch (error: any) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (nganh: any) => {
    if (!nganh || !nganh.detailedStaff || nganh.detailedStaff.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const now = new Date();
    const currentHour = String(now.getHours() % 12 || 12).padStart(2, '0');
    const currentMin = String(now.getMinutes()).padStart(2, '0');
    const currentSec = String(now.getSeconds()).padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    const currentDay = String(now.getDate()).padStart(2, '0');
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const currentYear = now.getFullYear();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>In Danh sách Giảng viên theo Ngành - ${nganh.tennganh}</title>
        <style>
          * { box-sizing: border-box; }
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; }
            .print-wrapper { padding: 15mm 15mm 20mm 15mm; min-height: 297mm; position: relative; }
            .page-footer { 
              position: fixed; 
              bottom: 10mm; 
              left: 15mm; 
              right: 15mm; 
              border-top: 0.5px dashed #666; 
              padding-top: 5px; 
              display: flex; 
              justify-content: space-between; 
              font-size: 11px; 
              font-style: italic; 
              color: #000; 
              font-family: "Times New Roman", Times, serif;
              background-color: white;
            }
            .page-number:after { content: "Trang " counter(page); }
          }
          body { font-family: "Times New Roman", Times, serif; font-size: 13px; line-height: 1.4; color: black; padding: 0; counter-reset: page; }
          .print-wrapper { width: 100%; max-width: 210mm; margin: 0 auto; }
          
          .report-header { display: flex; justify-content: space-between; margin-bottom: 20px; text-align: center; }
          .header-left { width: 45%; }
          .header-right { width: 50%; }
          .header-bold { font-weight: bold; text-transform: uppercase; font-size: 13px; }
          .header-sub { font-weight: bold; font-size: 12px; }
          .line-decor { border-bottom: 1px solid black; display: inline-block; width: 160px; margin-top: 2px; }
          
          .title-container { text-align: center; margin: 20px 0 25px 0; }
          .title-main { font-weight: bold; font-size: 18px; text-transform: uppercase; margin-bottom: 5px; }
          .title-sub { font-weight: bold; font-size: 15px; }
          
          table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
          th, td { border: 1px solid black; padding: 6px 4px; text-align: center; font-size: 12px; word-wrap: break-word; }
          th { font-weight: bold; background-color: #fff; }
          .text-left { text-align: left; padding-left: 8px; }
          
          .report-footer { margin-top: 25px; display: flex; justify-content: space-between; width: 100%; align-items: flex-start; }
          .footer-left { font-weight: bold; font-style: italic; font-size: 14px; }
          .footer-right { text-align: center; width: 320px; }
          .footer-location { font-style: italic; font-size: 13px; margin-bottom: 5px; }
          .footer-unit { font-weight: bold; font-size: 14px; text-transform: uppercase; }
          
          .page-footer { 
            position: fixed; 
            bottom: 10mm; 
            left: 15mm; 
            right: 15mm; 
            border-top: 0.5px dashed #666; 
            padding-top: 5px; 
            display: flex; 
            justify-content: space-between; 
            font-size: 11px; 
            font-style: italic; 
            color: #000; 
            font-family: "Times New Roman", Times, serif;
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
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
            <div class="title-main">DANH SÁCH GIẢNG VIÊN</div>
            <div class="title-sub">Ngành đào tạo: ${nganh.tennganh} - Mã ngành: ${nganh.manganh} - Khối ngành: ${nganh.khoinganh || '---'}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">STT</th>
                <th style="width: 180px;">Họ và tên</th>
                <th style="width: 100px;">Chức danh</th>
                <th style="width: 90px;">Trình độ</th>
                <th style="width: 180px;">Đơn vị công tác</th>
                <th style="width: 70px;">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${nganh.detailedStaff.map((gv: any, index: number) => `
                <tr>
                  <td>${index + 1}</td>
                  <td class="text-left">${gv.holot} ${gv.ten}</td>
                  <td>${gv.ten_chucdanh}</td>
                  <td>${gv.ten_trinhdo}</td>
                  <td class="text-left">${gv.ten_phongban}</td>
                  <td></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="report-footer">
            <div class="footer-left">Tổng số Giảng viên: ${nganh.total}</div>
            <div class="footer-right">
              <div class="footer-location">Đà Nẵng, ngày ${currentDay} tháng ${currentMonth} năm ${currentYear}</div>
              <div class="footer-unit">PHÒNG TỔ CHỨC - HÀNH CHÍNH</div>
            </div>
          </div>

          <div class="page-footer">
            <div class="print-time">
              In vào lúc ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} ngày ${currentDay}/${currentMonth}/${currentYear}
            </div>
            <div class="page-number"></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
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
        <p className="font-bold">Đang tổng hợp dữ liệu Ngành đào tạo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex items-center justify-between border-b-2 border-red-600 pb-2">
        <h2 className="text-2xl font-black text-blue-700 flex items-center gap-2">
          <BarChart3 className="h-7 w-7" />
          Thống kê Giảng viên theo ngành đào tạo
        </h2>
        <div className="text-xs text-gray-500 font-bold bg-gray-100 px-3 py-1 rounded-full border border-gray-300">
          Cập nhật: {new Date().toLocaleDateString('vi-VN')}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {statsData.map((nganh, index) => (
          <div key={index} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-2xl transition-all flex flex-col group">
            <div className="bg-white p-5 border-b border-black">
              <h3 className="text-xl font-black text-red-600 flex items-center gap-2 truncate tracking-tight">
                <School className="h-6 w-6 text-gray-700" />
                {nganh.tennganh}
              </h3>
              <div className="flex flex-col mt-2">
                <span className="text-xs font-bold text-blue-500 tracking-widest border-l-2 border-red-500 pl-2">
                  Mã ngành: {nganh.manganh} | Khối ngành: {nganh.khoinganh || '---'}
                </span>
                <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-gray-100 px-4 py-1.5 rounded border border-gray-300 shadow-sm transition-all">
                            <Users className="h-4 w-4 text-gray-600" />
                            <span className="text-sm font-black text-gray-800">Tổng nhân sự: {nganh.total} giảng viên</span>
                        </div>
                        <button 
                            onClick={() => handlePrint(nganh)}
                            disabled={nganh.total === 0}
                            className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-1.5 rounded border border-red-200 hover:bg-red-100 transition-all font-bold text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            <Printer className="h-4 w-4 group-hover:scale-110 transition-transform" />
                            In danh sách
                        </button>
                    </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50/30 flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
               <div className="flex flex-col items-center justify-center border-r border-gray-100 h-full min-h-[220px]">
                  <SimpleDoughnutChart data={nganh.chartData} />
               </div>

               <div className="flex flex-col space-y-3 px-2">
                  <h4 className="text-[11px] font-black text-blue-600 border-b border-gray-200 pb-1 mb-2 tracking-widest text-center ">Thống kê Trình độ Giảng viên</h4>
                  
                  {nganh.chartData.map((item: any, i: number) => (
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
        ))}
      </div>
      
      {statsData.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-200">
           <BarChart2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
           <p className="text-gray-500 font-bold">Chưa có dữ liệu thống kê nào được ghi nhận.</p>
        </div>
      )}
    </div>
  );
};
