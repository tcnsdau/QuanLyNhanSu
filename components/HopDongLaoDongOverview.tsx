
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { DanhSachKyHDLD, NhanVien, DanhMucHDLD, TrinhDo, PhongBan } from '../types';
import { FileText, Users, Loader2, Calendar, BadgeCheck, TrendingUp, ArrowRight, ShieldCheck, Clock, AlertCircle, X } from 'lucide-react';

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

// Kiểm tra trạng thái nghỉ việc chính xác
const isActiveEmployee = (flag: any) => {
    if (flag === true || flag === 'true' || flag === 1 || flag === '1') return false; // Là đang nghỉ
    return true; // Là đang làm việc
};

// Chuyển đổi mã loại hợp đồng sang số để so sánh chính xác
const getLoaiHdNumber = (value: any) => {
  if (value === null || value === undefined) return NaN;
  const num = Number(value);
  if (Number.isFinite(num)) return num;
  const str = String(value).trim();
  const match = str.match(/^\d+/);
  return match ? parseInt(match[0], 10) : NaN;
};

/**
 * Hàm hỗ trợ lấy TẤT CẢ dữ liệu từ một bảng sử dụng range (vượt giới hạn 1000 của Supabase)
 */
const fetchAllRecords = async (tableName: string) => {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      const errorMessage = `Lỗi khi truy vấn bảng ${tableName}: ${error.message || JSON.stringify(error)}`;
      // Chúng ta không thể gọi showAlert ở đây vì fetchAllRecords nằm ngoài component
      // Nhưng trong file này fetchAllRecords được gọi bên trong useEffect -> fetchHDLDStats
      // Tuy nhiên, fetchAllRecords là một hàm độc lập. 
      // Tôi sẽ chuyển fetchAllRecords vào bên trong component hoặc truyền showAlert vào.
      // Cách tốt nhất là ném lỗi ra để fetchHDLDStats bắt được.
      throw new Error(errorMessage);
      hasMore = false;
    } else if (data && data.length > 0) {
      allData = allData.concat(data);
      from += PAGE_SIZE;
      // Nếu số lượng bản ghi trả về ít hơn PAGE_SIZE tức là đã hết dữ liệu
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return allData;
};

export const HopDongLaoDongOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };

  const [stats, setStats] = useState({
    totalValidContracts: 0, // Tổng số HĐ của nhân sự còn việc
    loaihd2: 0,  // HĐLĐ không BH - 01 năm
    loaihd3: 0,  // HĐLĐ có BH - 03 năm
    loaihd4: 0,  // HĐLĐ có BH - 01 năm
    loaihd5: 0,  // HĐLĐ không BH - 03 năm
    loaihd7: 0,  // HĐLĐ có BH - Không thời hạn
    loaihd8: 0   // HĐLĐ không BH - 05 năm
  });
  const [latestContracts, setLatestContracts] = useState<any[]>([]);

  useEffect(() => {
    fetchHDLDStats();
  }, []);

  const fetchHDLDStats = async () => {
    setLoading(true);
    try {
      // 1. Tải toàn bộ dữ liệu từ các bảng (vượt giới hạn 1000 dòng)
      const [rawEmps, rawContracts, rawHdTypes, rawTrinhDos, rawPhongBans] = await Promise.all([
        fetchAllRecords('DanhSachNhanVien'),
        fetchAllRecords('DanhSachKyHDLD'),
        fetchAllRecords('DanhMucHDLD'),
        fetchAllRecords('DanhMucTrinhDo'),
        fetchAllRecords('DanhMucPhongBan')
      ]);

      // 2. Chuẩn hóa dữ liệu
      const emps = rawEmps.map(e => normalizeKeys(e)) as NhanVien[];
      const contracts = rawContracts.map(c => normalizeKeys(c)) as DanhSachKyHDLD[];
      const hdTypes = rawHdTypes.map(d => normalizeKeys(d)) as DanhMucHDLD[];
      const trinhDos = rawTrinhDos.map(t => normalizeKeys(t)) as TrinhDo[];
      const phongBans = rawPhongBans.map(p => normalizeKeys(p)) as PhongBan[];

      // 3. Tạo Map nhân viên để truy xuất nhanh và lọc nhân sự còn làm việc
      const activeEmployeeMap = new Map();
      emps.forEach(e => {
        if (isActiveEmployee(e.danghiviec)) {
          activeEmployeeMap.set(String(e.manv), e);
        }
      });

      // 4. Lọc danh sách hợp đồng thuộc về nhân sự còn làm việc
      const validContracts = contracts.filter(c => activeEmployeeMap.has(String(c.manv)));

      // 5. Thống kê 06 loại hợp đồng cụ thể theo yêu cầu
      let count2 = 0, count3 = 0, count4 = 0, count5 = 0, count7 = 0, count8 = 0;

      validContracts.forEach(c => {
        const code = getLoaiHdNumber(c.loaihd);
        if (code === 2) count2++;
        else if (code === 3) count3++;
        else if (code === 4) count4++;
        else if (code === 5) count5++;
        else if (code === 7) count7++;
        else if (code === 8) count8++;
      });

      setStats({
        totalValidContracts: validContracts.length,
        loaihd2: count2,
        loaihd3: count3,
        loaihd4: count4,
        loaihd5: count5,
        loaihd7: count7,
        loaihd8: count8
      });

      // 6. Lấy 3 hợp đồng mới nhất (Dựa trên idhopdong giảm dần) của nhân sự còn việc
      const sortedLatest = [...validContracts]
        .sort((a, b) => {
            const idA = typeof a.idhopdong === 'number' ? a.idhopdong : parseInt(String(a.idhopdong).replace(/\D/g, '')) || 0;
            const idB = typeof b.idhopdong === 'number' ? b.idhopdong : parseInt(String(b.idhopdong).replace(/\D/g, '')) || 0;
            return idB - idA;
        })
        .slice(0, 3);

      const processedLatest = sortedLatest.map(c => {
        const emp = activeEmployeeMap.get(String(c.manv));
        const type = hdTypes.find(t => getLoaiHdNumber(t.maso) === getLoaiHdNumber(c.loaihd));
        const td = trinhDos.find(t => t.matrinhdo === emp?.trinhdo);
        const pb = phongBans.find(p => p.maphongban === emp?.phongban);

        return {
          ...c,
          ho_ten: emp ? `${emp.holot} ${emp.ten}` : 'N/A',
          ngay_sinh: emp?.ngaysinh || '',
          trinh_do: td?.giatri || emp?.trinhdo || 'N/A',
          don_vi: pb?.giatri || emp?.phongban || 'N/A',
          ten_loaihd: type?.tenhdld || `Loại ${c.loaihd}`
        };
      });

      setLatestContracts(processedLatest);

      console.log(`Thống kê hoàn tất: Tổng HĐ=${contracts.length}, HĐ hợp lệ=${validContracts.length}`);
    } catch (err: any) {
      showAlert(`Lỗi xử lý thống kê: ${err.message || JSON.stringify(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '';
    const parts = d.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-blue-600 gap-4">
        <Loader2 className="h-12 w-12 animate-spin" />
        <span className="font-black text-lg animate-pulse tracking-widest text-center">
            Đang tổng hợp dữ liệu hệ thống...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-blue-600 pb-4">
        <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg">
                <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <div>
                <h2 className="text-2xl font-black text-blue-900 uppercase tracking-tighter">
                Thống kê Hợp đồng Lao động
                </h2>
                <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-bold text-blue-700 tracking-widest">Nhân sự đang làm việc</span>
                </div>
            </div>
        </div>
        <div className="bg-white px-6 py-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-end">
            <span className="text-[10px] font-black text-red-400 tracking-widest">Tổng số HĐLĐ đã kỹ</span>
            <span className="text-3xl font-black text-blue-600 leading-none mt-1">{stats.totalValidContracts}</span>
        </div>
      </div>

      {/* Grid 6 loại HĐ theo yêu cầu */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Type 2 */}
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col relative overflow-hidden group hover:border-orange-200 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-orange-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110"></div>
            <p className="text-[10px] font-black text-orange-600 tracking-widest mb-1">Mã HĐLĐ: 2</p>
            <h3 className="text-sm font-black text-gray-800 pr-10 leading-tight">HĐLĐ không BH - 01 năm</h3>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-black text-orange-900">{stats.loaihd2}</span>
                <span className="text-xs font-bold text-gray-400 ">Hợp đồng</span>
            </div>
        </div>

        {/* Type 3 */}
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col relative overflow-hidden group hover:border-blue-200 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110"></div>
            <p className="text-[10px] font-black text-blue-600 tracking-widest mb-1 ">Mã HĐLĐ: 3</p>
            <h3 className="text-sm font-black text-gray-800 pr-10 leading-tight">HĐLĐ có BH - 03 năm</h3>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-black text-blue-900">{stats.loaihd3}</span>
                <span className="text-xs font-bold text-gray-400">Hợp đồng</span>
            </div>
        </div>

        {/* Type 4 */}
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col relative overflow-hidden group hover:border-emerald-200 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110"></div>
            <p className="text-[10px] font-black text-emerald-600 tracking-widest mb-1">Mã HĐLĐ: 4</p>
            <h3 className="text-sm font-black text-gray-800 pr-10 leading-tight">HĐLĐ có BH - 01 năm</h3>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-black text-emerald-900">{stats.loaihd4}</span>
                <span className="text-xs font-bold text-gray-400">Hợp đồng</span>
            </div>
        </div>

        {/* Type 5 */}
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col relative overflow-hidden group hover:border-amber-200 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110"></div>
            <p className="text-[10px] font-black text-amber-600 tracking-widest mb-1 ">Mã HĐLĐ: 5</p>
            <h3 className="text-sm font-black text-gray-800 pr-10 leading-tight">HĐLĐ không BH - 03 năm</h3>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-black text-amber-900">{stats.loaihd5}</span>
                <span className="text-xs font-bold text-gray-400">Hợp đồng</span>
            </div>
        </div>

        {/* Type 7 */}
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col relative overflow-hidden group hover:border-purple-200 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110"></div>
            <p className="text-[10px] font-black text-purple-600 tracking-widest mb-1 ">Mã HĐLĐ: 7</p>
            <h3 className="text-sm font-black text-gray-800 pr-10 leading-tight">HĐLĐ có BH - Không thời hạn</h3>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-black text-purple-900">{stats.loaihd7}</span>
                <span className="text-xs font-bold text-gray-400">Hợp đồng</span>
            </div>
        </div>

        {/* Type 8 */}
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col relative overflow-hidden group hover:border-rose-200 transition-colors">
            <div className="absolute top-0 right-0 w-20 h-20 bg-rose-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-110"></div>
            <p className="text-[10px] font-black text-rose-600 tracking-widest mb-1">Mã HĐLĐ: 8</p>
            <h3 className="text-sm font-black text-gray-800 pr-10 leading-tight">HĐLĐ không BH - 05 năm</h3>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-black text-rose-900">{stats.loaihd8}</span>
                <span className="text-xs font-bold text-gray-400">Hợp đồng</span>
            </div>
        </div>
      </div>

      {/* Latest Contracts Table */}
      <div className="w-full">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="bg-blue-900 p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-xl">
                    <BadgeCheck className="h-6 w-6 text-blue-200" />
                  </div>
                  <h3 className="text-lg font-black text-white tracking-wider">Hợp đồng ký kết mới nhất</h3>
              </div>
              <div className="bg-blue-800 px-3 py-1 rounded-lg text-blue-200 text-[10px] font-bold tracking-widest">
                  Ba (03) HĐLĐ mới nhất
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Họ và Tên CBGVNV</th>
                        <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Chi tiết Hợp đồng</th>
                        <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-right">Hiệu lực Hợp đồng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {latestContracts.map((c, i) => (
                      <tr key={c.idhopdong} className="hover:bg-blue-50/40 transition-colors">
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black text-blue-900">{c.ho_ten}</span>
                                  <span className="text-[11px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Mã NV: {c.manv}</span>
                                </div>
                                <span className="text-[10px] font-bold text-gray-500 mt-0.5 tracking-tighter italic">Ngày sinh: {formatDate(c.ngay_sinh)}</span>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="bg-indigo-50 text-indigo-600 text-[9px] font-bold px-2 py-0.5 rounded border border-indigo-100 " title="Trình độ">{c.trinh_do}</span>
                                  <span className="bg-gray-100 text-gray-600 text-[9px] font-bold px-2 py-0.5 rounded border border-gray-200 " title="Đơn vị công tác">{c.don_vi}</span>
                                </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="inline-flex flex-col items-center">
                                <span className="text-[10px] font-bold text-red-400 tracking-widest">Số hiệu/Loại HĐLĐ</span>
                                <span className="text-sm font-black text-gray-800">{c.sohd}</span>
                                <span className="text-[10px] font-bold text-teal-600 mt-1 tracking-tight bg-teal-50 px-2 py-0.5 rounded">{c.ten_loaihd}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-black text-blue-900">Từ ngày:</span>
                                  <span className="text-xs font-black text-green-700">{formatDate(c.tungay)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-sm font-black text-blue-900">Đến ngày:</span>
                                  <span className="text-xs font-black text-red-600">{c.denngay ? formatDate(c.denngay) : '-------------'}</span>
                                </div>
                            </div>
                          </td>
                      </tr>
                    ))}
                    {latestContracts.length === 0 && (
                      <tr>
                          <td colSpan={3} className="px-6 py-20 text-center text-gray-500 italic font-medium bg-gray-50/50">Chưa có dữ liệu hợp đồng nào cho nhân sự đang làm việc.</td>
                      </tr>
                    )}
                  </tbody>
              </table>
            </div>
            <div className="p-6 bg-gray-50 border-t border-red-100 flex justify-between items-center">
              <p className="text-[10px] text-red-400 font-bold tracking-widest italic">Hệ thống DAU HR Management | © Quản lý Nhân sự</p>
              <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse delay-75"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse delay-150"></div>
              </div>
            </div>
        </div>
      </div>

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
