
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { BarChart2, Loader, School, Printer, FileDown } from 'lucide-react';

interface StaffDetail {
  manv: string;
  holot: string;
  ten: string;
  trinhdo: string;
  ten_trinhdo: string;
}

interface MajorStats {
  manganh: string;
  tennganh: string;
  ts: number;
  ths: number;
  dh: number;
  total: number;
  isQualified: boolean;
}

export const ChuanCSGDStatistics: React.FC<{ permissions: any[]; isAdmin: boolean; currentUser: any }> = ({ permissions, isAdmin, currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<MajorStats[]>([]);
  const [universityStats, setUniversityStats] = useState({ ts: 0, ths: 0, dh: 0, total: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch reference data
      const [majorsRes, trinhDoRes, nhanVienRes, gvNganhRes] = await Promise.all([
        supabase.from('DanhMucNganhDaoTao').select('manganh, tennganh').order('id', { ascending: true }),
        supabase.from('DanhMucTrinhDo').select('matrinhdo, giatri'),
        supabase.from('DanhSachNhanVien').select('manv, trinhdo').eq('danghiviec', false),
        supabase.from('DanhSachGVNganhDaoTao').select('manv, nganhdaotao')
      ]);

      if (majorsRes.error) throw majorsRes.error;
      if (trinhDoRes.error) throw trinhDoRes.error;
      if (nhanVienRes.error) throw nhanVienRes.error;
      if (gvNganhRes.error) throw gvNganhRes.error;

      const majors = majorsRes.data || [];
      const trinhDos = trinhDoRes.data || [];
      const nhanViens = nhanVienRes.data || [];
      const gvNganhs = gvNganhRes.data || [];

      // Degree matching helper
      const getDegreeLabel = (id: string) => {
        const td = trinhDos.find((t: any) => String(t.matrinhdo) === String(id));
        return td ? td.giatri.toLowerCase() : '';
      };

      const results: MajorStats[] = [];
      let totalTs = 0, totalThs = 0, totalDh = 0, totalOverall = 0;

      majors.forEach((major: any) => {
        const majorGVs = gvNganhs.filter((g: any) => String(g.nganhdaotao) === String(major.manganh));
        let ts = 0, ths = 0, dh = 0;

        majorGVs.forEach((gv: any) => {
          const nv = nhanViens.find((n: any) => String(n.manv) === String(gv.manv));
          if (nv) {
            const degree = getDegreeLabel(nv.trinhdo);
            if (degree.includes('tiến sĩ')) ts++;
            else if (degree.includes('thạc sĩ')) ths++;
            else if (degree.includes('đại học') || degree.includes('kỹ sư') || degree.includes('cử nhân') || degree.includes('kiến trúc sư')) dh++;
          }
        });

        const total = majorGVs.length;
        const phdRatio = total > 0 ? ts / total : 0;
        
        // Qualification logic: Ratio >= 20% AND at least 5 PhDs (Circular 01/2024)
        const isQualified = (ts >= 5) && (phdRatio >= 0.2);

        results.push({
          manganh: major.manganh,
          tennganh: major.tennganh,
          ts, ths, dh, total,
          isQualified
        });

        totalTs += ts;
        totalThs += ths;
        totalDh += dh;
        totalOverall += total;
      });

      setStatsData(results);
      setUniversityStats({ ts: totalTs, ths: totalThs, dh: totalDh, total: totalOverall });

    } catch (err: any) {
      console.error('Error fetching standards data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Thống kê chuẩn CSGD Đại học</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: "Times New Roman", Times, serif; font-size: 13px; color: black; line-height: 1.3; }
          .container { width: 100%; border-collapse: collapse; }
          h2 { text-align: center; text-transform: uppercase; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid black; padding: 8px; text-align: center; }
          th { font-weight: bold; background-color: #f9f9f9; }
          .text-left { text-align: left; }
          .footer { margin-top: 30px; display: flex; justify-content: space-between; }
          .bold { font-weight: bold; }
          .italic { font-style: italic; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: flex; justify-content: space-between;">
            <div style="text-align: center; width: 40%;">
              <div class="bold">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
              <div class="bold">TRƯỜNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG</div>
              <div style="border-bottom: 1px solid black; width: 150px; margin: 2px auto;"></div>
            </div>
            <div style="text-align: center; width: 50%;">
              <div class="bold">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div class="bold">Độc lập - Tự do - Hạnh phúc</div>
              <div style="border-bottom: 1px solid black; width: 180px; margin: 2px auto;"></div>
            </div>
          </div>
        </div>

        <h2>THỐNG KÊ GIẢNG VIÊN THEO CHUẨN CSGD ĐẠI HỌC</h2>
        <div style="text-align: center; margin-bottom: 20px;">
          (Theo Thông tư số 01/2024/TT-BGDĐT ngày 05/02/2024)
        </div>

        <table>
          <thead>
            <tr>
              <th rowspan="2" style="width: 40px;">STT</th>
              <th rowspan="2">Ngành đào tạo</th>
              <th colspan="3">Trình độ</th>
              <th rowspan="2" style="width: 80px;">Tổng cộng</th>
              <th rowspan="2">Chuẩn CSGD ĐH theo TT số 01/2024/TT-BGDĐT</th>
            </tr>
            <tr>
              <th style="width: 80px;">Tiến sĩ</th>
              <th style="width: 80px;">Thạc sĩ</th>
              <th style="width: 80px;">Đại học</th>
            </tr>
          </thead>
          <tbody>
            ${statsData.map((major, index) => `
              <tr>
                <td>${index + 1}</td>
                <td class="text-left">${major.tennganh}</td>
                <td>${major.ts || ''}</td>
                <td>${major.ths || ''}</td>
                <td>${major.dh || ''}</td>
                <td class="bold">${major.total}</td>
                <td class="bold">${major.isQualified ? 'Đạt' : ''}</td>
              </tr>
            `).join('')}
            <tr style="background-color: #f5f5f5; font-weight: bold;">
              <td colspan="2">TỔNG CỘNG</td>
              <td>${universityStats.ts}</td>
              <td>${universityStats.ths}</td>
              <td>${universityStats.dh}</td>
              <td>${universityStats.total}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <div></div>
          <div style="text-align: center;">
            <div class="italic">Đà Nẵng, ngày ${currentDay} tháng ${currentMonth} năm ${currentYear}</div>
            <div class="bold" style="margin-top: 5px;">PHÒNG TỔ CHỨC - HÀNH CHÍNH</div>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-blue-600 gap-4">
        <Loader className="h-12 w-12 animate-spin" />
        <p className="font-black text-sm uppercase tracking-widest text-gray-500">Đang tính toán số liệu chuẩn CSGD...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-2xl">
            <School className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">Thống kê chuẩn CSGD ĐẠI HỌC</h1>
            <p className="text-sm font-medium text-gray-500">Theo Thông tư số 01/2024/TT-BGDĐT của Bộ GD&ĐT</p>
          </div>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Printer className="h-5 w-5" />
          Xuất báo cáo (Print)
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th rowSpan={2} className="px-4 py-8 text-[11px] font-black text-gray-400 uppercase tracking-wider border-r border-gray-100">STT</th>
                <th rowSpan={2} className="px-6 py-4 text-[11px] font-black text-gray-900 uppercase tracking-wider text-left border-r border-gray-100">Ngành đào tạo</th>
                <th colSpan={3} className="px-6 py-4 text-[11px] font-black text-blue-600 uppercase tracking-wider border-b border-gray-100">Trình độ</th>
                <th rowSpan={2} className="px-4 py-4 text-[11px] font-black text-red-600 uppercase tracking-wider border-x border-gray-100">Tổng cộng</th>
                <th rowSpan={2} className="px-6 py-4 text-[11px] font-black text-indigo-700 uppercase tracking-wider max-w-[200px]">Chuẩn CSGD ĐH theo TT số 01/2024/TT-BGDĐT</th>
              </tr>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-4 text-[10px] font-black text-blue-500 uppercase tracking-widest border-r border-gray-100">Tiến sĩ</th>
                <th className="px-4 py-4 text-[10px] font-black text-blue-500 uppercase tracking-widest border-r border-gray-100">Thạc sĩ</th>
                <th className="px-4 py-4 text-[10px] font-black text-blue-500 uppercase tracking-widest">Đại học</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {statsData.map((major, index) => (
                <tr key={major.manganh} className="hover:bg-blue-50/10 transition-colors">
                  <td className="px-4 py-4 text-xs font-medium text-gray-900 border-r border-gray-100">{index + 1}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-left border-r border-gray-100">{major.tennganh}</td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 border-r border-gray-100">{major.ts || ''}</td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 border-r border-gray-100">{major.ths || ''}</td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 border-r border-gray-100">{major.dh || ''}</td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 border-r border-gray-100">{major.total}</td>
                  <td className="px-6 py-4 text-sm font-bold text-blue-700">
                    {major.isQualified ? 'Đạt' : ''}
                  </td>
                </tr>
              ))}
              <tr className="bg-white border-t-2 border-gray-900 font-bold text-gray-900">
                <td colSpan={2} className="px-6 py-4 text-sm uppercase text-center border-r border-gray-100">Tổng cộng</td>
                <td className="px-4 py-4 text-sm border-r border-gray-100">{universityStats.ts}</td>
                <td className="px-4 py-4 text-sm border-r border-gray-100">{universityStats.ths}</td>
                <td className="px-4 py-4 text-sm border-r border-gray-100">{universityStats.dh}</td>
                <td className="px-4 py-4 text-sm border-r border-gray-100">{universityStats.total}</td>
                <td className="px-6 py-4 text-center">
                  {universityStats.total > 0 && universityStats.ts / universityStats.total >= 0.2 ? 'Trường Đạt chuẩn' : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div> Tiêu chuẩn Ngành đào tạo
            </h3>
            <ul className="space-y-3 text-xs font-medium text-gray-600 list-disc pl-5">
                <li>Tỷ lệ giảng viên trình độ Tiến sĩ không thấp hơn <strong className="text-blue-700">20%</strong>.</li>
                <li>Số lượng Tiến sĩ tối thiểu là <strong className="text-blue-700">05 giảng viên</strong> cho mỗi ngành.</li>
                <li>Hệ thống đang áp dụng chuẩn hiện hành (năm 2026). <span className="italic text-gray-400">(Năm 2030 yêu cầu nâng lên 30%)</span>.</li>
            </ul>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
            <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-600 rounded-full"></div> Tiêu chuẩn Nhà trường
            </h3>
            <ul className="space-y-3 text-xs font-medium text-gray-600 list-disc pl-5">
                <li>Tỷ lệ giảng viên trình độ Tiến sĩ toàn trường không thấp hơn <strong className="text-emerald-700">20%</strong>.</li>
                <li>Căn cứ vào tổng số giảng viên cơ hữu của nhà trường.</li>
                <li>Hệ thống đang áp dụng chuẩn hiện hành (năm 2026).</li>
            </ul>
        </div>
      </div>
    </div>
  );
};
