
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { 
  Trophy, UserCheck, Building2, BarChart3, 
  Loader2, BadgeCheck, TrendingUp, Info, Award, Star, AlertCircle, X
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

export const ThiDuaOverview: React.FC = () => {
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
    chienSiThiDua: 0,
    laoDongTienTien: 0,
    khac: 0
  });
  const [tapTheStats, setTapTheStats] = useState({
    total: 0,
    laoDongXuatSac: 0,
    laoDongTienTien: 0,
    khac: 0
  });

  useEffect(() => {
    const getStats = async () => {
      setLoading(true);
      try {
        const [rawCaNhan, rawTapThe] = await Promise.all([
          fetchAllRecords('DanhSachCaNhanDHTD'),
          fetchAllRecords('DanhSachTapTheDHTD')
        ]);

        // Thống kê Cá nhân
        let cnCS = 0, cnTT = 0, cnKhac = 0;
        rawCaNhan.forEach(item => {
          const it = normalizeKeys(item);
          const dh = String(it.danhhieuthidua || '').toLowerCase().trim();
          if (dh.includes('chiến sĩ thi đua cơ sở')) cnCS++;
          else if (dh.includes('lao động tiên tiến')) cnTT++;
          else cnKhac++;
        });

        setCaNhanStats({
          total: rawCaNhan.length,
          chienSiThiDua: cnCS,
          laoDongTienTien: cnTT,
          khac: cnKhac
        });

        // Thống kê Tập thể
        let ttXS = 0, ttTT = 0, ttKhac = 0;
        rawTapThe.forEach(item => {
          const it = normalizeKeys(item);
          const dh = String(it.danhhieuthidua || '').toLowerCase().trim();
          if (dh.includes('lao động xuất sắc')) ttXS++;
          else if (dh.includes('lao động tiên tiến')) ttTT++;
          else ttKhac++;
        });

        setTapTheStats({
          total: rawTapThe.length,
          laoDongXuatSac: ttXS,
          laoDongTienTien: ttTT,
          khac: ttKhac
        });

      } catch (err: any) {
        showAlert("Lỗi tổng hợp số liệu thi đua: " + (err.message || err));
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
        <p className="font-bold text-sm tracking-widest">Đang phân tích dữ liệu thi đua...</p>
      </div>
    );
  }

  const StatCard = ({ label, value, colorClass, icon: Icon }: any) => (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all">
      <div className="flex flex-col">
        <span className="text-[11px] font-bold text-gray-400 mb-1">{label}</span>
        <span className={`text-3xl font-black ${colorClass}`}>{value}</span>
      </div>
      <div className={`p-3 rounded-2xl bg-gray-50 group-hover:scale-110 transition-transform ${colorClass}`}>
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
      <div className="flex items-center justify-between border-b-4 border-amber-500 pb-4">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500 p-3 rounded-2xl shadow-lg">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-blue-900 tracking-tighter">Thống kê danh hiệu thi đua</h2>
            <div className="flex items-center gap-2 mt-1">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <span className="text-xs font-bold text-blue-700 tracking-widest">Tổng hợp kết quả bình bầu thi đua các cấp</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
        {/* Phần Cá nhân */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4 border-l-4 border-amber-600 pl-3">
            <UserCheck className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-bold text-blue-900">Thống kê danh hiệu cá nhân</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <StatCard label="Tổng lượt cá nhân đạt danh hiệu" value={caNhanStats.total} colorClass="text-amber-600" icon={Award} />
            </div>
            <StatCard label="Chiến sĩ thi đua cơ sở" value={caNhanStats.chienSiThiDua} colorClass="text-red-600" icon={Star} />
            <StatCard label="Lao động tiên tiến" value={caNhanStats.laoDongTienTien} colorClass="text-blue-600" icon={BadgeCheck} />
            {caNhanStats.khac > 0 && (
               <div className="col-span-1 sm:col-span-2">
                  <StatCard label="Các danh hiệu cá nhân khác" value={caNhanStats.khac} colorClass="text-emerald-600" icon={TrendingUp} />
               </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <h4 className="text-xs font-bold text-gray-400 tracking-widest border-b pb-2 mb-4 italic">Phân bổ tỷ lệ danh hiệu cá nhân</h4>
            <ProgressBar label="Chiến sĩ thi đua cơ sở" count={caNhanStats.chienSiThiDua} total={caNhanStats.total} color="bg-red-500" />
            <ProgressBar label="Lao động tiên tiến" count={caNhanStats.laoDongTienTien} total={caNhanStats.total} color="bg-blue-500" />
            {caNhanStats.khac > 0 && <ProgressBar label="Các danh hiệu khác" count={caNhanStats.khac} total={caNhanStats.total} color="bg-emerald-500" />}
          </div>
        </div>

        {/* Phần Tập thể */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4 border-l-4 border-blue-600 pl-3">
            <Building2 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-bold text-blue-900">Thống kê danh hiệu tập thể</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <StatCard label="Tổng lượt tập thể đạt danh hiệu" value={tapTheStats.total} colorClass="text-blue-600" icon={Building2} />
            </div>
            <StatCard label="Lao động xuất sắc" value={tapTheStats.laoDongXuatSac} colorClass="text-red-600" icon={Trophy} />
            <StatCard label="Lao động tiên tiến" value={tapTheStats.laoDongTienTien} colorClass="text-blue-600" icon={BadgeCheck} />
            {tapTheStats.khac > 0 && (
               <div className="col-span-1 sm:col-span-2">
                  <StatCard label="Các danh hiệu tập thể khác" value={tapTheStats.khac} colorClass="text-emerald-600" icon={TrendingUp} />
               </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <h4 className="text-xs font-bold text-gray-400 tracking-widest border-b pb-2 mb-4 italic">Phân bổ tỷ lệ danh hiệu tập thể</h4>
            <ProgressBar label="Lao động xuất sắc" count={tapTheStats.laoDongXuatSac} total={tapTheStats.total} color="bg-red-500" />
            <ProgressBar label="Lao động tiên tiến" count={tapTheStats.laoDongTienTien} total={tapTheStats.total} color="bg-blue-500" />
            {tapTheStats.khac > 0 && <ProgressBar label="Các danh hiệu khác" count={tapTheStats.khac} total={tapTheStats.total} color="bg-emerald-500" />}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <p className="text-[10px] text-red-400 font-bold tracking-widest italic flex items-center gap-2">
           <Info className="w-3 h-3" />
           Dữ liệu thống kê dựa trên toàn bộ lịch sử thi đua được ghi nhận trong hệ thống quản lý DAU HRM.
        </p>
      </div>

      {/* Alert Modal */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
            <div className="bg-red-600 p-5 text-white flex items-center gap-3">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold">Thông báo lỗi</h3>
            </div>
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4 shadow-inner text-red-500">
                <X size={32} />
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
