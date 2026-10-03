
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { 
  Users, Building2, UserCheck, ShieldAlert, 
  Loader2, BadgeCheck, TrendingUp, BarChart3, Clock, Info
} from 'lucide-react';

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

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
      hasMore = false;
    } else if (data && data.length > 0) {
      allData = allData.concat(data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  return allData;
};

export const QuaTrinhCongTacOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean, message: string }>({
    isOpen: false,
    message: ''
  });

  const showAlert = (message: string) => {
    setAlertModal({ isOpen: true, message });
  };

  const [caNhanStats, setCaNhanStats] = useState({
    total: 0,
    xuatSac: 0,
    tot: 0,
    hoanThanh: 0,
    khongHoanThanh: 0,
    khac: 0
  });
  const [tapTheStats, setTapTheStats] = useState({
    total: 0,
    xuatSac: 0,
    tot: 0,
    hoanThanh: 0,
    khac: 0
  });

  useEffect(() => {
    const getStats = async () => {
      setLoading(true);
      try {
        // Tải dữ liệu từ các bảng đánh giá
        const [rawCaNhan, rawTapThe] = await Promise.all([
          fetchAllRecords('DanhSachCaNhanHTNV'),
          fetchAllRecords('DanhSachTapTheHTNV')
        ]);

        // 1. Tính toán thống kê cá nhân trên TOÀN BỘ table (không lọc theo trạng thái nghỉ việc)
        const cnList = rawCaNhan.map(item => normalizeKeys(item));
        let cnXuatSac = 0, cnTot = 0, cnHoanThanh = 0, cnKhongHoanThanh = 0, cnKhac = 0;

        cnList.forEach(item => {
          const mucdo = String(item.mucdohtnv || '').toLowerCase().trim();
          if (mucdo.includes('xuất sắc')) cnXuatSac++;
          else if (mucdo.includes('tốt')) cnTot++;
          else if (mucdo.includes('không hoàn thành')) cnKhongHoanThanh++;
          else if (mucdo.includes('hoàn thành')) cnHoanThanh++;
          else cnKhac++;
        });

        setCaNhanStats({
          total: cnList.length,
          xuatSac: cnXuatSac,
          tot: cnTot,
          hoanThanh: cnHoanThanh,
          khongHoanThanh: cnKhongHoanThanh,
          khac: cnKhac
        });

        // 2. Tính toán thống kê tập thể
        const ttList = rawTapThe.map(item => normalizeKeys(item));
        let ttXuatSac = 0, ttTot = 0, ttHoanThanh = 0, ttKhac = 0;

        ttList.forEach(item => {
          const mucdo = String(item.mucdohtnv || '').toLowerCase().trim();
          if (mucdo.includes('xuất sắc')) ttXuatSac++;
          else if (mucdo.includes('tốt')) ttTot++;
          else if (mucdo.includes('hoàn thành')) ttHoanThanh++;
          else ttKhac++;
        });

        setTapTheStats({
          total: ttList.length,
          xuatSac: ttXuatSac,
          tot: ttTot,
          hoanThanh: ttHoanThanh,
          khac: ttKhac
        });

      } catch (err: any) {
        showAlert("Lỗi tổng hợp số liệu: " + (err.message || err));
      } finally {
        setLoading(false);
      }
    };
    getStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-blue-600 gap-4">
        <Loader2 className="h-12 w-12 animate-spin" />
        <p className="font-bold text-sm tracking-widest">Đang phân tích toàn bộ dữ liệu đánh giá...</p>
      </div>
    );
  }

  const StatCard = ({ label, value, colorClass, icon: Icon }: any) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-gray-400 mb-1">{label}</span>
        <span className={`text-3xl font-black ${colorClass}`}>{value}</span>
      </div>
      <div className={`p-2.5 rounded-xl bg-gray-50 group-hover:scale-110 transition-transform ${colorClass}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  );

  const ProgressBar = ({ label, count, total, color }: any) => {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] font-bold">
          <span className="text-gray-600">{label}</span>
          <span className="text-gray-400">{count} ({percent}%)</span>
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full ${color} transition-all duration-1000`} 
            style={{ width: `${percent}%` }}
          ></div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-blue-600 pb-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg">
            <BarChart3 className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-blue-900 tracking-tighter">Thống kê Mức độ HTNV của Cá nhân và Tập thể</h2>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-bold text-blue-700 tracking-widest">Đánh giá mức độ HTNV</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
        {/* Phần Cá nhân */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4 border-l-4 border-blue-600 pl-3">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-bold text-blue-900">Thống kê cá nhân</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <StatCard label="Tổng số lượt cá nhân được đánh giá" value={caNhanStats.total} colorClass="text-blue-600" icon={UserCheck} />
            </div>
            <StatCard label="Hoàn thành xuất sắc nhiệm vụ" value={caNhanStats.xuatSac} colorClass="text-blue-600" icon={BadgeCheck} />
            <StatCard label="Hoàn thành tốt nhiệm vụ" value={caNhanStats.tot} colorClass="text-red-600" icon={TrendingUp} />
            <StatCard label="Hoàn thành nhiệm vụ" value={caNhanStats.hoanThanh} colorClass="text-green-600" icon={UserCheck} />
            <StatCard label="Không hoàn thành nhiệm vụ" value={caNhanStats.khongHoanThanh} colorClass="text-gray-600" icon={ShieldAlert} />
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <h4 className="text-xs font-bold text-gray-400 tracking-widest border-b pb-2 mb-4 italic">Phân bổ tỷ lệ đánh giá cá nhân (Tổng thể)</h4>
            <ProgressBar label="Hoàn thành xuất sắc nhiệm vụ" count={caNhanStats.xuatSac} total={caNhanStats.total} color="bg-blue-600" />
            <ProgressBar label="Hoàn thành tốt nhiệm vụ" count={caNhanStats.tot} total={caNhanStats.total} color="bg-red-600" />
            <ProgressBar label="Hoàn thành nhiệm vụ" count={caNhanStats.hoanThanh} total={caNhanStats.total} color="bg-green-600" />
            <ProgressBar label="Không hoàn thành nhiệm vụ" count={caNhanStats.khongHoanThanh} total={caNhanStats.total} color="bg-gray-400" />
            {caNhanStats.khac > 0 && <ProgressBar label="Khác (Dữ liệu chưa phân loại)" count={caNhanStats.khac} total={caNhanStats.total} color="bg-amber-400" />}
          </div>
        </div>

        {/* Phần Tập thể */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4 border-l-4 border-red-600 pl-3">
            <Building2 className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-bold text-red-900">Thống kê tập thể</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <StatCard label="Tổng số lượt tập thể được đánh giá" value={tapTheStats.total} colorClass="text-red-600" icon={Building2} />
            </div>
            <StatCard label="Hoàn thành xuất sắc nhiệm vụ" value={tapTheStats.xuatSac} colorClass="text-blue-600" icon={BadgeCheck} />
            <StatCard label="Hoàn thành tốt nhiệm vụ" value={tapTheStats.tot} colorClass="text-red-600" icon={TrendingUp} />
            <div className="col-span-1 sm:col-span-2">
               <StatCard label="Hoàn thành nhiệm vụ" value={tapTheStats.hoanThanh} colorClass="text-green-600" icon={Building2} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <h4 className="text-xs font-bold text-gray-400 tracking-widest border-b pb-2 mb-4 italic">Phân bổ tỷ lệ đánh giá tập thể (Tổng thể)</h4>
            <ProgressBar label="Hoàn thành xuất sắc nhiệm vụ" count={tapTheStats.xuatSac} total={tapTheStats.total} color="bg-blue-600" />
            <ProgressBar label="Hoàn thành tốt nhiệm vụ" count={tapTheStats.tot} total={tapTheStats.total} color="bg-red-600" />
            <ProgressBar label="Hoàn thành nhiệm vụ" count={tapTheStats.hoanThanh} total={tapTheStats.total} color="bg-green-600" />
            {tapTheStats.khac > 0 && <ProgressBar label="Khác (Dữ liệu chưa phân loại)" count={tapTheStats.khac} total={tapTheStats.total} color="bg-amber-400" />}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <p className="text-[10px] text-red-400 font-bold tracking-widest italic flex items-center gap-2">
           <Info className="w-3 h-3" />
           Dữ liệu thống kê dựa trên toàn bộ lịch sử đánh giá được lưu trữ trong hệ thống DAU HRM.
        </p>
      </div>

      {/* Alert Modal */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
            <div className="bg-red-600 p-5 text-white flex items-center gap-3">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-lg font-bold">Thông báo lỗi</h3>
            </div>
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 shadow-inner text-red-500">
                <ShieldAlert size={32} />
              </div>
              <p className="text-gray-700 font-bold leading-relaxed whitespace-pre-line">{alertModal.message}</p>
            </div>
            <div className="p-6 bg-gray-50 flex justify-center">
              <button
                onClick={() => setAlertModal({ ...alertModal, isOpen: false })}
                className="px-8 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
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
