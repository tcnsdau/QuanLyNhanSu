
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { NhanVien, DanhSachKyHDLD, DanhMucHDLD, TrinhDo, PhongBan } from '../types';
import { Search, FileText, Loader2, Calendar, User, ShieldAlert, FileDown, Clock, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

const isActiveEmployee = (flag: any) => {
    if (flag === true || flag === 'true' || flag === 1 || flag === '1') return false; 
    return true; 
};

/**
 * Hàm lấy TẤT CẢ dữ liệu vượt giới hạn 1000 dòng của Supabase
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
      throw new Error(`Lỗi truy vấn bảng ${tableName}: ${error.message}`);
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

export const DanhSachDenHanKyHDLD: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [expiredList, setExpiredList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (message: string) => {
    setAlertMessage(message);
    setIsAlertModalOpen(true);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rawEmps, rawContracts, rawHdTypes, rawTrinhDos, rawPhongBans] = await Promise.all([
        fetchAllRecords('DanhSachNhanVien'),
        fetchAllRecords('DanhSachKyHDLD'),
        fetchAllRecords('DanhMucHDLD'),
        fetchAllRecords('DanhMucTrinhDo'),
        fetchAllRecords('DanhMucPhongBan')
      ]);

      const emps = rawEmps.map(e => normalizeKeys(e)) as NhanVien[];
      const contracts = rawContracts.map(c => normalizeKeys(c)) as DanhSachKyHDLD[];
      const hdTypes = rawHdTypes.map(d => normalizeKeys(d)) as DanhMucHDLD[];
      const trinhDos = rawTrinhDos.map(t => normalizeKeys(t)) as TrinhDo[];
      const phongBans = rawPhongBans.map(p => normalizeKeys(p)) as PhongBan[];

      const activeEmployeeMap = new Map();
      emps.forEach(e => {
        if (isActiveEmployee(e.danghiviec)) {
          activeEmployeeMap.set(String(e.manv), {
            ...e,
            ten_trinhdo: trinhDos.find(t => t.matrinhdo === e.trinhdo)?.giatri || e.trinhdo,
            ten_phongban: phongBans.find(p => p.maphongban === e.phongban)?.giatri || e.phongban
          });
        }
      });

      // BƯỚC 1: Xác định tập hợp nhân sự đã ký loại HĐ không thời hạn (loaihd = 7)
      const permanentEmpIds = new Set<string>();
      contracts.forEach(c => {
        if (String(c.loaihd) === '7') {
          permanentEmpIds.add(String(c.manv));
        }
      });

      // BƯỚC 2: Duyệt hợp đồng để tìm bản mới nhất, LOẠI BỎ nhân sự đã có HĐ loại 7
      const latestContractMap = new Map<string, DanhSachKyHDLD>();
      contracts.forEach(c => {
        const currentManv = String(c.manv);
        
        // Chỉ xử lý cho nhân sự đang làm việc
        if (!activeEmployeeMap.has(currentManv)) return;
        
        // QUAN TRỌNG: Nếu nhân sự này đã ký HĐ loại 7 (Không thời hạn) thì KHÔNG XÉT
        if (permanentEmpIds.has(currentManv)) return;

        const existing = latestContractMap.get(currentManv);
        // Tìm hợp đồng có denngay lớn nhất
        if (!existing || (c.denngay && (!existing.denngay || new Date(c.denngay) > new Date(existing.denngay)))) {
          latestContractMap.set(currentManv, c);
        }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const processed = Array.from(latestContractMap.values()).map(c => {
        const emp = activeEmployeeMap.get(String(c.manv));
        const type = hdTypes.find(t => String(t.maso) === String(c.loaihd));
        
        const denNgayDate = c.denngay ? new Date(c.denngay) : null;
        let ghiChu = '';
        let statusColor = '';

        if (denNgayDate) {
            denNgayDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((denNgayDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            if (today >= denNgayDate) {
                ghiChu = 'Quá hạn';
                statusColor = 'text-red-600 bg-red-50 border-red-200';
            } else if (diffDays < 30) {
                ghiChu = 'Đến hạn';
                statusColor = 'text-amber-600 bg-amber-50 border-amber-200';
            }
        }

        return {
          ...c,
          ho_ten: `${emp?.holot} ${emp?.ten}`,
          ngay_sinh: emp?.ngaysinh,
          trinh_do: emp?.ten_trinhdo,
          don_vi: emp?.ten_phongban,
          ten_loaihd: type?.tenhdld || `Loại ${c.loaihd}`,
          ghiChu,
          statusColor
        };
      }).filter(item => item.ghiChu !== ''); // Chỉ giữ lại những người "Đến hạn" hoặc "Quá hạn"

      setExpiredList(processed.sort((a, b) => {
          if (!a.denngay) return 1;
          if (!b.denngay) return -1;
          return new Date(a.denngay).getTime() - new Date(b.denngay).getTime();
      }));

    } catch (err: any) {
      showAlert("Lỗi xử lý dữ liệu: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return expiredList.filter(item => 
      item.ho_ten.toLowerCase().includes(s) || 
      item.manv.toLowerCase().includes(s) ||
      item.sohd.toLowerCase().includes(s)
    );
  }, [expiredList, searchTerm]);

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      'ID Hợp đồng': item.idhopdong,
      'Mã NV': item.manv,
      'Họ và Tên': item.ho_ten,
      'Ngày sinh': formatDate(item.ngay_sinh),
      'Trình độ': item.trinh_do,
      'Đơn vị': item.don_vi,
      'Số HĐ': item.sohd,
      'Loại HĐ': item.ten_loaihd,
      'Từ ngày': formatDate(item.tungay),
      'Đến ngày': formatDate(item.denngay),
      'Ghi chú': item.ghiChu
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DenHanKyHDLD");
    XLSX.writeFile(wb, `DanhSach_DenHan_QuaHan_HDLD_${new Date().getFullYear()}.xlsx`);
  };

  const formatDate = (d: string) => {
    if (!d) return '---';
    const parts = d.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-blue-600 gap-4">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="font-bold tracking-widest text-sm">Đang phân tích thời hạn hợp đồng...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-red-600 p-3 rounded-2xl shadow-lg shadow-red-200">
            <ShieldAlert className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-blue-900 tracking-tight">Danh sách nhân sự Đến hạn & Quá hạn HĐLĐ</h2>
            <p className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full border border-red-100 tracking-widest mt-1 inline-block">
                Thông báo nhân sự đến hạn ký kết lại hợp đồng
            </p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Tìm theo Mã NV, Họ tên..."
              className="pl-9 w-full p-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all text-black bg-white font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={handleExportExcel}
            className="px-6 py-2.5 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all flex items-center gap-2 text-sm whitespace-nowrap"
          >
            <FileDown className="h-5 w-5" /> Xuất Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="bg-blue-900 p-5 flex justify-between items-center">
            <h3 className="text-lg font-black text-white tracking-wider flex items-center gap-3">
                <Clock className="h-6 w-6 text-red-400" /> Danh sách nhân sự
            </h3>
            <span className="text-white text-xs font-black bg-white/10 px-4 py-1.5 rounded-full border border-white/20 ">
                Tổng số: {filteredData.length} nhân sự
            </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-32">Mã ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest">Nhân sự</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Chi tiết ký kết (Mới nhất)</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Thời gian hiệu lực</th>
                <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.map((item) => (
                <tr key={item.idhopdong} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">HĐ: {item.idhopdong}</span>
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-100">NV: {item.manv}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-blue-900">{item.ho_ten}</span>
                        <div className="flex items-center gap-2 mt-1">
                             <span className="text-[10px] font-bold text-gray-400 italic">NS: {formatDate(item.ngay_sinh)}</span>
                             <span className="text-[9px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">{item.trinh_do}</span>
                        </div>
                        <span className="text-[10px] font-bold text-blue-600 mt-1">{item.don_vi}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="inline-flex flex-col items-center">
                        <span className="text-sm font-black text-gray-800">{item.sohd}</span>
                        <span className="text-[10px] font-bold text-teal-600 mt-0.5 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100">{item.ten_loaihd}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400">Từ:</span>
                            <span className="text-xs font-black text-gray-700">{formatDate(item.tungay)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold text-gray-400">Đến:</span>
                            <span className="text-xs font-black text-red-600 underline decoration-red-200 decoration-2 underline-offset-4">{formatDate(item.denngay)}</span>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`px-4 py-1.5 rounded-xl text-[11px] font-black border uppercase tracking-widest shadow-sm ${item.statusColor}`}>
                        {item.ghiChu}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                   <td colSpan={5} className="py-24 text-center text-gray-400 italic font-bold bg-gray-50/50">
                       Không có nhân sự nào đến hạn hoặc quá hạn ký hợp đồng.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-left">
         <p className="text-[10px] text-red-400 font-bold tracking-widest italic flex items-center gap-2">
            <AlertCircle className="h-3 w-3" /> Hệ thống DAU HR Management | Dữ liệu cảnh báo tự động
        </p>
      </div>

      {/* Alert Modal */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200 border border-red-100">
             <div className="bg-red-600 p-5 text-white flex items-center gap-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="text-lg font-bold">Thông báo hệ thống</h3>
             </div>
             <div className="p-8 text-center">
                <p className="text-gray-700 font-medium leading-relaxed">
                  {alertMessage}
                </p>
             </div>
             <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-center">
                <button 
                  onClick={() => setIsAlertModalOpen(false)} 
                  className="px-8 py-2 bg-red-600 text-white font-bold rounded-xl shadow-md hover:bg-red-700 transition-all active:scale-95 text-sm"
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
