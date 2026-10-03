
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { EmployeeAccount, NhanVien, TrinhDo, PhongBan, ChucVu, ChucDanh, UserSession, UserAccount } from '../types';
import { 
  Users, Plus, Pencil, Trash2, Search, X, Save, LogOut, FileDown,
  FolderCog, Building2, BookMarked, FileText, Wallet, HeartPulse,
  GraduationCap, Briefcase, Award, Trophy, BarChart2, ListTodo, KeyRound, AlertCircle,
  TrendingUp, Gem, UserCheck, Calendar, ChevronDown, LayoutGrid, PieChart,
  Settings, Image as ImageIcon, Shield, School, BookmarkCheck, Loader, Eye, Mail, Phone, Info, User as UserIcon, Calendar as CalendarIcon, Briefcase as BriefcaseIcon, CreditCard, CheckSquare, Gift, Ban, UserPlus, Venus, Mars, Percent, Smartphone, MapPin, Heart, Clock, Home, Calculator,
  Wrench, DatabaseBackup, ArrowRightFromLine, Database, ScanText, CalendarDays, ClipboardList, CheckCircle2, AlertTriangle, ChevronRight, RefreshCw,
  Baby
} from 'lucide-react';
import { DanhMucChucVuManagement } from './DanhMucChucVuManagement'; 
import { DanhMucTrinhDoManagement } from './DanhMucTrinhDoManagement';
import { DanhMucPhongBanManagement } from './DanhMucPhongBanManagement';
import { DanhMucChucDanhManagement } from './DanhMucChucDanhManagement';
import { DanhMucNamHocManagement } from './DanhMucNamHocManagement';
import { HoSoNhanSuManagement } from './HoSoNhanSuManagement';
import { HinhAnhNhanSuSettings } from './HinhAnhNhanSuSettings';
import { UserManagement } from './UserManagement';
import { ToBoMonStatistics } from './ToBoMonStatistics';
import { DanhMucToBoMonManagement } from './DanhMucToBoMonManagement';
import { GiangVienToBoMonManagement } from './GiangVienToBoMonManagement';
import { DanhMucHDLDManagement } from './DanhMucHDLDManagement';
import { DanhSachKyHDLDManagement } from './DanhSachKyHDLDManagement';
import { HopDongLaoDongOverview } from './HopDongLaoDongOverview';
import { DanhMucMucDoHTNVManagement } from './DanhMucMucDoHTNVManagement';
import { DanhMucDanhHieuThiDuaManagement } from './DanhMucDanhHieuThiDuaManagement';
import { DanhMucHinhThucKhenThuongManagement } from './DanhMucHinhThucKhenThuongManagement';
import { NangCaoTrinhDoManagement } from './NangCaoTrinhDoManagement';
import { DanhMucHSLManagement } from './DanhMucHSLManagement';
import { NghiKhongLuongManagement } from './NghiKhongLuongManagement';
import { DanhSachHSLManagement } from './DanhSachHSLManagement';
import { DuKienNangLuongList } from './DuKienNangLuongList';
import { ExtractDataFromFiles } from './ExtractDataFromFiles';
import { SplitPDFManagement } from './SplitPDFManagement';
import { DanhSachDenHanKyHDLD } from './DanhSachDenHanKyHDLD';
import { DanhSachNhanVienNghiViec } from './DanhSachNhanVienNghiViec';
import { DanhSachCaNhanHTNVManagement } from './DanhSachCaNhanHTNVManagement';
import { DanhSachTapTheHTNVManagement } from './DanhSachTapTheHTNVManagement';
import { DanhSachCaNhanDHTDManagement } from './DanhSachCaNhanDHTDManagement';
import { DanhSachTapTheDHTDManagement } from './DanhSachTapTheDHTDManagement';
import { DanhSachCaNhanKhenThuongManagement } from './DanhSachCaNhanKhenThuongManagement';
import { DanhSachTapTheKhenThuongManagement } from './DanhSachTapTheKhenThuongManagement';
import { DanhMucBenhVienManagement } from './DanhMucBenhVienManagement';
import { BaoHiemTiLeDongManagement } from './BaoHiemTiLeDongManagement';
import { BaoHiemDanhSachThamGiaManagement } from './BaoHiemDanhSachThamGiaManagement';
import { BaoHiemSoLieuBatBuoc } from './BaoHiemSoLieuBatBuoc';
import { DanhSachThaiSanManagement } from './DanhSachThaiSanManagement';
import { QuaTrinhCongTacOverview } from './QuaTrinhCongTacOverview';
import { ThiDuaOverview } from './ThiDuaOverview';
import { NgayNghiLeManagement } from './NgayNghiLeManagement';
import { NghiPhepNamManagement } from './NghiPhepNamManagement';
import { UserRoleManagement } from './UserRoleManagement';
import { UserProfile } from './UserProfile';
import { BGH } from './BGH';
import { DanhSachNhanSuKhoaPhong } from './DanhSachNhanSuKhoaPhong';
import { ToBoMon } from './ToBoMon';
import { DanhMucChucNangManagement } from './DanhMucChucNangManagement';
import { ThongKeNghiPhepManagement } from './ThongKeNghiPhepManagement';
import { DSTableManagement } from './DSTableManagement';
import { RolePermissionManagement } from './RolePermissionManagement';
import { ThongKeTrinhDoChucDanh } from './ThongKeTrinhDoChucDanh';
import { DanhMucNganhDaoTaoManagement } from './DanhMucNganhDaoTaoManagement';
import { DanhSachGVNganhDaoTaoManagement } from './DanhSachGVNganhDaoTaoManagement';
import { NganhDaoTaoStatistics } from './NganhDaoTaoStatistics';
import { ChuanCSGDStatistics } from './ChuanCSGDStatistics';

// Hàm băm mật khẩu Argon2 sử dụng crypto subtle API (SHA-256)
const hashPasswordArgon2 = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `$argon2id$v=19$m=65536,t=3,p=4$${hashHex}`;
};

interface AdminDashboardProps {
  onLogout: () => void;
  session: UserSession;
}

const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

const getGoogleDriveImageUrl = (url: string) => {
  if (!url) return '';
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    const idMatch = url.match(/[-\w]{25,}/);
    if (idMatch) return `https://lh3.googleusercontent.com/d/${idMatch[0]}`;
  }
  return url;
};

// --- Sub-component: Staff Detail Modal ---
const StaffDetailModal: React.FC<{ staff: NhanVien; onClose: () => void }> = ({ staff, onClose }) => {
  const formatDate = (d: string) => {
    if (!d) return '---';
    const parts = d.split('-');
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : d;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200">
        <div className="border-b border-gray-100 p-4 flex justify-between items-center bg-white">
          <h3 className="text-xl font-bold text-blue-900 flex items-center gap-3">
            <div className="bg-blue-50 p-1.5 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            Hồ sơ chi tiết nhân sự
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-7 w-7" />
          </button>
        </div>

        <div className="p-8 flex flex-col md:flex-row gap-10">
          <div className="flex-shrink-0">
             <div className="w-[180px] h-[240px] rounded-lg border border-gray-200 overflow-hidden shadow-lg bg-gray-50">
               {staff.hinhanh ? (
                 <img src={getGoogleDriveImageUrl(staff.hinhanh)} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <UserIcon className="h-16 w-16" />
                 </div>
               )}
             </div>
          </div>

          <div className="flex-1 space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-4 border-l-4 border-red-400 pl-3">
                 <UserIcon className="h-4 w-4 text-red-400" />
                 <h4 className="text-sm font-bold text-red-700 uppercase tracking-wider">Thông tin cá nhân</h4>
              </div>
              <div className="grid grid-cols-3 gap-6 bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Họ lót</p><p className="text-sm font-bold text-blue-800">{staff.holot}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Tên</p><p className="text-sm font-bold text-blue-800">{staff.ten}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Giới tính</p><p className="text-sm font-bold text-blue-800">{staff.gioitinh ? 'Nam' : 'Nữ'}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Ngày sinh</p><p className="text-sm font-bold text-blue-800">{formatDate(staff.ngaysinh)}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Nơi sinh</p><p className="text-sm font-bold text-blue-800">{staff.noisinh || '---'}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Nguyên quán</p><p className="text-sm font-bold text-blue-800">{staff.nguyenquan || '---'}</p></div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4 border-l-4 border-green-400 pl-3">
                 <Building2 className="h-4 w-4 text-green-500" />
                 <h4 className="text-sm font-bold text-green-700 uppercase tracking-wider">Công tác & Tổ chức</h4>
              </div>
              <div className="grid grid-cols-3 gap-6 bg-blue-50/30 p-5 rounded-xl border border-blue-50">
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Khoa/Phòng</p><p className="text-sm font-bold text-blue-800">{staff.ten_phongban}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Chức vụ</p><p className="text-sm font-bold text-blue-800">{staff.ten_chucvu}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Chức danh</p><p className="text-sm font-bold text-blue-800">{staff.ten_chucdanh}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Trình độ</p><p className="text-sm font-bold text-blue-800">{staff.ten_trinhdo}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Ngày vào trường</p><p className="text-sm font-bold text-blue-800">{formatDate(staff.ngaychinhthuc)}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Giảng viên</p><p className="text-sm font-bold text-blue-800">{staff.giangvien ? 'Có' : 'Không'}</p></div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-4 border-l-4 border-orange-400 pl-3">
                 <CreditCard className="h-4 w-4 text-orange-400" />
                 <h4 className="text-sm font-bold text-orange-700 uppercase tracking-wider">Thông tin liên hệ</h4>
              </div>
              <div className="grid grid-cols-3 gap-6 bg-yellow-50/20 p-5 rounded-xl border border-yellow-100">
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Số CCCD</p><p className="text-sm font-bold text-blue-800">{staff.socccd || '---'}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Số điện thoại</p><p className="text-sm font-bold text-blue-800">{staff.sodtdd || '---'}</p></div>
                <div><p className="text-[10px] text-gray-400 font-bold mb-0.5">Email</p><p className="text-sm font-bold text-blue-800">{staff.email || '---'}</p></div>
                <div className="col-span-3"><p className="text-[10px] text-gray-400 font-bold mb-0.5">Địa chỉ hiện nay</p><p className="text-sm font-bold text-blue-800">{staff.noiohiennay || '---'}</p></div>
              </div>
            </section>
          </div>
        </div>

        <div className="bg-gray-50 px-8 py-4 flex justify-between items-center border-t border-gray-100">
           <span className="text-[11px] text-blue-400 italic">Mã NV: {staff.manv} | Hệ thống Quản lý DAU HRM</span>
           <button onClick={onClose} className="px-10 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition-all active:scale-95">Đóng hồ sơ</button>
        </div>
      </div>
    </div>
  );
};

 
// --- Main Dashboard Overview Component ---
const DashboardOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0, male: 0, female: 0, gs: 0, pgs: 0, ts: 0, ths: 0, dh: 0, cd: 0, khac: 0, lecturers: 0, units: 0
  });
  const [latestStaff, setLatestStaff] = useState<NhanVien[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<NhanVien | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [nvRes, tdRes, cdRes, pbRes] = await Promise.all([
          supabase.from('DanhSachNhanVien').select('*').eq('danghiviec', false),
          supabase.from('DanhMucTrinhDo').select('*'),
          supabase.from('DanhMucChucDanh').select('*'),
          supabase.from('DanhMucPhongBan').select('*')
        ]);
        if (nvRes.error) throw nvRes.error;

        const allNV = (nvRes.data || []).map(normalizeKeys) as NhanVien[];
        const allTD = (tdRes.data || []).map(normalizeKeys) as TrinhDo[];
        const allCD = (cdRes.data || []).map(normalizeKeys) as ChucDanh[];
        const allPB = (pbRes.data || []).map(normalizeKeys) as PhongBan[];

        let male = 0, female = 0, gs = 0, pgs = 0, lecturers = 0;
        let ts = 0, ths = 0, dh = 0, cd = 0, khac = 0;

        allNV.forEach(nv => {
          if (nv.gioitinh) male++; else female++;
          if (nv.giangvien) lecturers++;
          const titleLabel = allCD.find(c => String(c.machucdanh) === String(nv.chucdanh))?.giatri?.toLowerCase() || '';
          if (titleLabel.includes('giáo sư') && !titleLabel.includes('phó')) gs++;
          if (titleLabel.includes('phó giáo sư')) pgs++;
          const degreeLabel = allTD.find(t => String(t.matrinhdo) === String(nv.trinhdo))?.giatri?.toLowerCase() || '';
          if (degreeLabel.includes('tiến sĩ')) ts++;
          else if (degreeLabel.includes('thạc sĩ')) ths++;
          else if (degreeLabel.includes('đại học') || degreeLabel.includes('cử nhân') || degreeLabel.includes('kỹ sư')) dh++;
          else if (degreeLabel.includes('cao đẳng')) cd++;
          else khac++;
        });

        setStats({ total: allNV.length, male, female, gs, pgs, ts, ths, dh, cd, khac, lecturers, units: allPB.length });

        const sorted = [...allNV].sort((a, b) => parseInt(b.manv) - parseInt(a.manv));
        const latestWithLabels = sorted.slice(0, 3).map(nv => ({
          ...nv,
          ten_trinhdo: allTD.find(t => String(t.matrinhdo) === String(nv.trinhdo))?.giatri || nv.trinhdo,
          ten_phongban: allPB.find(p => String(p.maphongban) === String(nv.phongban))?.giatri || nv.phongban,
          ten_chucvu: (normalizeKeys(allNV.find(x => x.manv === nv.manv)) as any)?.ten_chucvu || '---',
          ten_chucdanh: allCD.find(c => String(c.machucdanh) === String(nv.chucdanh))?.giatri || '---'
        }));
        setLatestStaff(latestWithLabels);
      } catch (err: any) {
        // Silent error for dashboard background fetch, or use notifyModal if critical
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-blue-600 gap-4">
        <Loader className="h-12 w-12 animate-spin" />
        <p className="font-black text-sm uppercase tracking-widest">Đang tải dữ liệu tổng quan...</p>
      </div>
    );
  }

  const lecturerRate = stats.total > 0 ? ((stats.lecturers / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <h1 className="text-2xl font-black text-blue-900 uppercase tracking-tighter mb-4">Thông tin đội ngũ nhân sự</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
        <div className="bg-white p-5 rounded-xl shadow-lg border border-blue-100 flex items-center justify-between group">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-2">Tổng số lượng nhân sự</span>
            <span className="text-4xl font-black text-blue-900 leading-none">{stats.total}</span>
          </div>
          <div className="bg-blue-50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
             <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-lg border border-emerald-100 flex items-center justify-between group">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-emerald-600 tracking-wider mb-2">Số lượng đơn vị</span>
            <span className="text-4xl font-black text-emerald-800 leading-none">{stats.units}</span>
          </div>
          <div className="bg-emerald-50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
             <Home className="h-8 w-8 text-emerald-600" />
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-lg border border-teal-100 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-teal-600 tracking-wider">Thống kê Giới tính</span>
                <Users className="h-4 w-4 text-gray-300" />
            </div>
            <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-blue-900">{stats.male}</span>
                    <span className="text-[9px] font-black text-red-500 tracking-tighter">Nam</span>
                </div>
                <div className="w-px h-10 bg-gray-100"></div>
                <div className="flex flex-col items-center">
                    <span className="text-2xl font-black text-blue-900">{stats.female}</span>
                    <span className="text-[9px] font-black text-emerald-600 tracking-tighter">Nữ</span>
                </div>
            </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-lg border border-orange-100 flex flex-col justify-between">
           <div className="flex justify-between items-start">
             <div>
                <p className="text-[9px] font-black text-orange-600 tracking-widest ">Tỉ lệ giảng viên</p>
                <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-blue-800">{lecturerRate}%</span>
                    <span className="text-[9px] font-bold text-gray-400">({stats.lecturers})</span>
                </div>
             </div>
             <Clock className="h-5 w-5 text-blue-500" />
           </div>
           <div className="w-full bg-gray-100 h-2 rounded-full mt-4 overflow-hidden shadow-inner">
                <div className="bg-orange-500 h-full rounded-full transition-all duration-1000" style={{ width: `${lecturerRate}%` }}></div>
           </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-lg border border-purple-100 flex items-center justify-between group">
           <div className="flex flex-col">
              <span className="text-[10px] font-black text-purple-600 tracking-wider mb-2">Trạng thái</span>
              <span className="text-base font-black text-emerald-600 tracking-tighter">Hoạt động tốt</span>
           </div>
           <div className="bg-purple-50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <Heart className="h-8 w-8 text-purple-600" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex flex-col">
            <div className="flex items-center gap-2 mb-8 border-b border-gray-100 pb-3">
               <BookmarkCheck className="h-5 w-5 text-blue-600" />
               <h3 className="text-base font-black text-red-700 tracking-wider">Thống kê Chức danh</h3>
            </div>
            <div className="space-y-6 flex-1">
                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 flex justify-between items-center group hover:shadow-md transition-all">
                    <div>
                        <p className="text-[10px] font-black text-blue-400 tracking-widest ">Giáo sư</p>
                        <p className="text-4xl font-black text-blue-900 mt-1">{stats.gs}</p>
                        <p className="text-[9px] font-bold text-gray-400 mt-1 tracking-tight">Chức danh GS</p>
                    </div>
                    <div className="bg-blue-600 p-3.5 rounded-xl shadow-lg shadow-blue-200">
                        <Gem className="h-8 w-8 text-white" />
                    </div>
                </div>
                <div className="bg-purple-50/50 p-5 rounded-2xl border border-purple-100 flex justify-between items-center group hover:shadow-md transition-all">
                    <div>
                        <p className="text-[10px] font-black text-purple-400 tracking-widest ">Phó Giáo sư</p>
                        <p className="text-4xl font-black text-blue-900 mt-1">{stats.pgs}</p>
                        <p className="text-[9px] font-bold text-gray-400 mt-1 tracking-tight">Chức danh PGS</p>
                    </div>
                    <div className="bg-indigo-600 p-3.5 rounded-xl shadow-lg shadow-indigo-200">
                        <Award className="h-8 w-8 text-white" />
                    </div>
                </div>
            </div>
            <p className="mt-8 text-[10px] text-gray-400 italic text-center leading-relaxed">Dữ liệu được thống kê từ phân hệ chức danh GS/PGS của nhà trường.</p>
        </div>

        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
            <div className="flex items-center gap-2 mb-8 border-b border-gray-100 pb-3">
               <GraduationCap className="h-6 w-6 text-blue-600" />
               <h3 className="text-base font-black text-blue-900 tracking-wider">Thống kê Trình độ</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                <div className="bg-blue-50/30 p-6 rounded-2xl border-b-4 border-blue-400 text-center shadow-sm">
                    <span className="text-4xl font-black text-blue-900">{stats.ts}</span>
                    <p className="text-[10px] font-black text-blue-600 tracking-widest mt-2">Tiến sĩ</p>
                </div>
                <div className="bg-indigo-50/30 p-6 rounded-2xl border-b-4 border-indigo-400 text-center shadow-sm">
                    <span className="text-4xl font-black text-indigo-900">{stats.ths}</span>
                    <p className="text-[10px] font-black text-indigo-600 tracking-widest mt-2">Thạc sĩ</p>
                </div>
                <div className="bg-emerald-50/30 p-6 rounded-2xl border-b-4 border-emerald-400 text-center shadow-sm">
                    <span className="text-4xl font-black text-emerald-900">{stats.dh}</span>
                    <p className="text-[10px] font-black text-emerald-600 tracking-widest mt-2">Đại học</p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
                <div className="bg-yellow-50/30 p-6 rounded-2xl border-b-4 border-yellow-400 text-center shadow-sm">
                    <span className="text-4xl font-black text-yellow-900">{stats.cd}</span>
                    <p className="text-[10px] font-black text-yellow-600 tracking-widest mt-2">Cao đẳng</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl border-b-4 border-gray-400 text-center shadow-sm">
                    <span className="text-4xl font-black text-gray-900">{stats.khac}</span>
                    <p className="text-[10px] font-black text-red-600 tracking-widest mt-2">Khác (TC, PT...)</p>
                </div>
            </div>
            <div className="space-y-4">
               <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter">
                  <span className="text-gray-400">Tỉ lệ phân bỏ trình độ</span>
                  <span className="text-gray-300">Phần trăm tổng thể</span>
               </div>
               <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                  <div className="bg-blue-500 h-full border-r border-white/20" style={{ width: `${(stats.ts/stats.total)*100}%` }}></div>
                  <div className="bg-indigo-500 h-full border-r border-white/20" style={{ width: `${(stats.ths/stats.total)*100}%` }}></div>
                  <div className="bg-emerald-500 h-full border-r border-white/20" style={{ width: `${(stats.dh/stats.total)*100}%` }}></div>
                  <div className="bg-yellow-500 h-full border-r border-white/20" style={{ width: `${(stats.cd/stats.total)*100}%` }}></div>
                  <div className="bg-gray-400 h-full" style={{ width: `${(stats.khac/stats.total)*100}%` }}></div>
               </div>
               <div className="flex flex-wrap justify-center gap-4 pt-2">
                  {[
                    { label: 'TIẾN SĨ', color: 'bg-blue-500' }, { label: 'THẠC SĨ', color: 'bg-indigo-500' }, { label: 'ĐẠI HỌC', color: 'bg-emerald-500' }, { label: 'CAO ĐẲNG', color: 'bg-yellow-500' }, { label: 'KHÁC', color: 'bg-gray-400' }
                  ].map(leg => (
                    <div key={leg.label} className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${leg.color}`}></div>
                        <span className="text-[9px] font-black text-blue-900 tracking-widest uppercase">{leg.label}</span>
                    </div>
                  ))}
               </div>
            </div>
        </div>
      </div>
      {/* Footer Info */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
        <p className="text-[10px] text-red-400 font-bold tracking-widest italic flex items-center gap-2">
          <Clock className="h-3 w-3" /> Hệ thống DAU HR Management | Hệ thống Quản lý nhân sự
        </p>
      </div>

     


      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
          <div className="bg-gray-50/50 p-6 flex justify-between items-center border-b border-gray-100">
             <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-blue-700" />
                <h3 className="text-base font-black text-blue-900 tracking-wider">Danh sách nhân sự mới nhất</h3>
             </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100">
                   <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center w-32">Mã NV</th>
                   <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest ">Họ và Tên</th>
                   <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Ngày sinh</th>
                   <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Trình độ</th>
                   <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest ">Email</th>
                   <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Số ĐTDD</th>
                   <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest ">Đơn vị công tác</th>
                   <th className="px-6 py-4 text-[10px] font-black text-red-600 tracking-widest text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {latestStaff.map((nv) => (
                  <tr key={nv.manv} className="hover:bg-blue-50/30 transition-colors">
                     <td className="px-6 py-4 text-sm font-bold text-gray-500 text-center">{nv.manv}</td>
                     <td className="px-6 py-4 text-sm font-bold text-blue-700">{nv.holot} {nv.ten}</td>
                     <td className="px-6 py-4 text-sm text-gray-600 text-center">{nv.ngaysinh ? new Date(nv.ngaysinh).toLocaleDateString('vi-VN') : '---'}</td>
                     <td className="px-6 py-4 text-sm text-gray-600 text-center">{nv.ten_trinhdo}</td>
                     <td className="px-6 py-4 text-sm text-blue-500 italic font-medium">{nv.email}</td>
                     <td className="px-6 py-4 text-sm text-gray-600 text-center font-bold">{nv.sodtdd}</td>
                     <td className="px-6 py-4 text-sm text-blue-900 font-bold">{nv.ten_phongban}</td>
                     <td className="px-6 py-4 text-center">
                        <button onClick={() => setSelectedStaff(nv)} className="inline-flex items-center gap-1.5 text-[11px] font-black text-blue-600 hover:text-indigo-800 tracking-tighter group">
                           <Eye className="h-4 w-4 group-hover:scale-110 transition-transform" /> Xem chi tiết
                        </button>
                     </td>
                </tr>
                ))}
              </tbody>
            </table>
          </div>
      </div>
      {selectedStaff && ( <StaffDetailModal staff={selectedStaff} onClose={() => setSelectedStaff(null)} /> )}
    </div>
  );
};

// --- Main Sidebar Layout Component ---
const ChangePasswordModal: React.FC<{ 
  user: UserAccount; 
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}> = ({ user, onClose, onSuccess, onError }) => {
  const [form, setForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Kiểm tra mật khẩu cũ
      const hashedOldInput = await hashPasswordArgon2(form.oldPassword);
      if (hashedOldInput !== user.passwordhash) {
        onError("Mật khẩu cũ không đúng hoặc mật khẩu mới không hợp lệ. Kiểm tra lại nhé !");
        setSaving(false);
        return;
      }

      // 2. Kiểm tra mật khẩu mới
      if (!form.newPassword || form.newPassword !== form.confirmPassword) {
        onError("Mật khẩu cũ không đúng hoặc mật khẩu mới không hợp lệ. Kiểm tra lại nhé !");
        setSaving(false);
        return;
      }

      // 3. Thực hiện lưu
      const newHash = await hashPasswordArgon2(form.newPassword);
      const { error } = await supabase
        .from('Users')
        .update({ passwordhash: newHash })
        .eq('id', user.id);

      if (error) throw error;

      onSuccess("Thay đổi mật khẩu thành công!");
    } catch (err: any) {
      onError("Lỗi: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#f0f0f0] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border-t-4 border-blue-600">
        <div className="bg-white px-4 py-2 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="size-5 flex items-center justify-center">
              <img src="https://lh3.googleusercontent.com/d/1OD0yKOMSr4sY3dnYcxsCNHypDna9BfT3" className="w-full" alt="Icon" />
            </div>
            <h3 className="text-sm font-medium text-gray-600">Thay đổi Password</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="border border-gray-300 rounded-md p-6 relative bg-white/50 mt-2">
            <span className="absolute -top-3 left-4 bg-[#f0f0f0] px-2 text-sm font-bold text-red-500">Thông tin</span>
            
            <div className="space-y-5">
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <label className="text-sm font-bold text-blue-800">Mật khẩu cũ</label>
                <input 
                  type="password"
                  className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm focus:border-blue-500 outline-none"
                  value={form.oldPassword}
                  onChange={e => setForm({...form, oldPassword: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <label className="text-sm font-bold text-blue-800">Mật khẩu mới</label>
                <input 
                  type="password"
                  className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm focus:border-blue-500 outline-none"
                  value={form.newPassword}
                  onChange={e => setForm({...form, newPassword: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-[140px_1fr] items-center gap-4">
                <label className="text-sm font-bold text-blue-800">Xác nhận mật khẩu mới</label>
                <input 
                  type="password"
                  className="w-full h-8 px-2 border border-gray-300 bg-white text-black text-sm focus:border-blue-500 outline-none"
                  value={form.confirmPassword}
                  onChange={e => setForm({...form, confirmPassword: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-4 mt-6">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-white border border-gray-300 px-6 py-1.5 text-sm font-medium text-black hover:bg-gray-100 shadow-sm transition-all disabled:opacity-50"
            >
              <FileDown className="size-5 text-blue-500" />
              <span>Lưu thay đổi</span>
            </button>
            <button 
              onClick={onClose}
              className="flex items-center gap-2 bg-white border border-gray-300 px-6 py-1.5 text-sm font-medium text-black hover:bg-gray-100 shadow-sm transition-all"
            >
              <X className="size-5 text-red-500" />
              <span>Hủy bỏ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, session }) => {
  const [activeMenuItem, setActiveMenuItem] = useState('dashboard'); 
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({ 'heThong': true }); 
  const [currentPermissions, setCurrentPermissions] = useState<any[]>(session.permissions || []);
  const [isRefreshingPermissions, setIsRefreshingPermissions] = useState(false);

  // Fetch latest permissions on mount to ensure session is "clean" and up to date
  const refreshPermissions = async (isManual = false) => {
    if (session.isAdmin || !session.manv) return;
    
    setIsRefreshingPermissions(true);
    try {
      // 1. Get user account to get the ID
      const { data: userData, error: userError } = await supabase
        .from('Users')
        .select('id')
        .eq('manv', session.manv)
        .maybeSingle();
      
      if (userError || !userData) throw userError || new Error('User not found');

      // 2. Get RolePermissions
      const { data: rolePermData, error: rolePermError } = await supabase
        .from('RolePermissions')
        .select('*')
        .eq('userid', userData.id);

      if (rolePermError) throw rolePermError;

      // 3. Get Modules and Permissions for mapping
      const [moduleRes, permRes] = await Promise.all([
        supabase.from('Modules').select('*'),
        supabase.from('Permissions').select('*')
      ]);

      if (moduleRes.error) throw moduleRes.error;
      if (permRes.error) throw permRes.error;

      const modulesList = (moduleRes.data || []);
      const permissionsList = (permRes.data || []);

      const mappedPermissions = normalizePermissions(rolePermData || [], modulesList, permissionsList);

      setCurrentPermissions(mappedPermissions);
      
      if (isManual) {
        setNotifyModal({ isOpen: true, type: 'success', message: 'Đã làm mới quyền hạn từ hệ thống!' });
      }
    } catch (err) {
      setNotifyModal({ isOpen: true, type: 'error', message: 'Lỗi khi làm mới quyền hạn: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setIsRefreshingPermissions(false);
    }
  };

  useEffect(() => {
    refreshPermissions();
  }, [session.manv, session.isAdmin]);
  
  // Current user info state
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [userFullName, setUserFullName] = useState<string>('');
  const [units, setUnits] = useState<PhongBan[]>([]);
  const [unitStaffCounts, setUnitStaffCounts] = useState<Record<string, number>>({});

  // Notification state
  const [notifyModal, setNotifyModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    message: string;
  }>({
    isOpen: false,
    type: 'success',
    message: ''
  });

  const fetchCurrentUserInfo = async () => {
    try {
      // Fetch units and staff counts for the menu
      const [pbRes, nvRes] = await Promise.all([
        supabase.from('DanhMucPhongBan').select('*').order('sapxep', { ascending: true }),
        supabase.from('DanhSachNhanVien').select('phongban').eq('danghiviec', false)
      ]);

      if (pbRes.data) {
        const normalizedUnits = pbRes.data.map(normalizeKeys) as PhongBan[];
        setUnits(normalizedUnits);
        
        if (nvRes.data) {
          const counts: Record<string, number> = {};
          nvRes.data.forEach((nv: any) => {
            const pb = nv.phongban;
            counts[pb] = (counts[pb] || 0) + 1;
          });
          setUnitStaffCounts(counts);
        }
      }

      // 1. Lấy thông tin từ table Users dựa trên username (taikhoan trong session)
      const { data: userData, error: userError } = await supabase
        .from('Users')
        .select('*')
        .eq('username', session.adminData?.taikhoan)
        .maybeSingle();

      if (userError) throw userError;
      if (userData) {
        const normalizedUser = normalizeKeys(userData) as UserAccount;
        setCurrentUser(normalizedUser);

        // 2. Lấy Họ tên từ DanhSachNhanVien qua manv
        const { data: nvData, error: nvError } = await supabase
          .from('DanhSachNhanVien')
          .select('holot, ten')
          .eq('manv', normalizedUser.manv)
          .maybeSingle();

        if (!nvError && nvData) {
          setUserFullName(`${nvData.holot} ${nvData.ten}`);
        } else {
          setUserFullName(normalizedUser.username); // Fallback
        }
      }
    } catch (err: any) {
      // Silent error or handle appropriately
    }
  };

  useEffect(() => {
    fetchCurrentUserInfo();
  }, [session]);

  const menuStructure = useMemo(() => [
    {
      id: 'heThong',
      label: 'Hệ thống',
      icon: LayoutGrid,
      children: [
        { id: 'traCuu-hoSo', label: 'Hồ sơ Cá nhân', icon: UserIcon },
        { id: 'hoSoNhanSu', label: 'Danh sách Nhân sự', icon: FolderCog },
        { 
          id: 'traCuu-khoaPhong', 
          label: 'Danh sách Nhân sự Khoa, Phòng', 
          icon: Building2,
          children: units
            .filter(u => (unitStaffCounts[u.maphongban] || 0) > 0)
            .map(u => ({
              id: `traCuu-khoaPhong-${u.maphongban}`,
              label: u.giatri,
              icon: ChevronRight
            }))
        },
        { 
          id: 'toBoMon', 
          label: 'Tổ Bộ môn', 
          icon: BookMarked,
          children: [
            { id: 'toBoMon-danhMuc', label: 'Danh mục Tổ Bộ môn', icon: ListTodo },
            { id: 'toBoMon-thongKe', label: 'Thống kê Tổ Bộ môn', icon: BarChart2 },
            { id: 'toBoMon-giangVien', label: 'Giảng viên Tổ Bộ môn', icon: Users },
          ]
        },
        { 
          id: 'nganhHoc', 
          label: 'Ngành Đào tạo', 
          icon: School,
          children: [
            { id: 'nganhHoc-danhMuc', label: 'Danh mục Ngành Đào tạo', icon: ListTodo },
            { id: 'nganhHoc-giangVien', label: 'Danh sách GV theo ngành', icon: Users },
            { id: 'nganhHoc-thongKe', label: 'Thống kê theo ngành', icon: BarChart2 },
          ]
        },
        { 
          id: 'hopDongLaoDong', 
          label: 'Hợp đồng Lao động', 
          icon: FileText,
          children: [
            { id: 'hdld-overview', label: 'Thống kê HĐLĐ', icon: PieChart },
            { id: 'hdld-danhMuc', label: 'Danh mục HĐLĐ', icon: ListTodo },
            { id: 'hdld-danhSachKy', label: 'Danh sách ký HĐLĐ', icon: Pencil },
            { id: 'hdld-denHanKy', label: 'Danh sách đến hạn ký HĐLĐ', icon: Calendar },
            { id: 'hdld-ketThuc', label: 'Danh sách Kết thúc HĐLĐ', icon: ArrowRightFromLine },
          ]
        },
        { 
          id: 'luong', 
          label: 'Lương và HSL', 
          icon: Wallet,
          children: [
            { id: 'luong-danhMucHSL', label: 'Danh mục HSL', icon: ListTodo },
            { id: 'luong-danhSachHSL', label: 'Danh sách HSL', icon: FileText },
            { id: 'luong-nghiKhongLuong', label: 'Danh sách nghỉ không lương', icon: Ban },
            { id: 'luong-duKienNangLuong', label: 'Danh sách dự kiến nâng lương', icon: Calculator },
          ]
        },
        { 
          id: 'baoHiem', 
          label: 'Bảo hiểm và Thai sản', 
          icon: HeartPulse,
          children: [
            { id: 'baoHiem-danhMucBenhVien', label: 'Danh mục Bệnh viện', icon: Building2 },
            { id: 'baoHiem-tiLeDong', label: 'Mức đóng và Tỉ lệ đóng', icon: Percent },
            { id: 'baoHiem-danhSachThamGia', label: 'Danh sách GVNV tham gia', icon: Users },
            { id: 'baoHiem-soLieuBatBuoc', label: 'Số liệu BH bắt buộc', icon: Calculator },
            { id: 'baoHiem-danhSachThaiSan', label: 'Danh sách thai sản', icon: Baby },
          ]
        },
        { id: 'daoTao', label: 'Nâng cao Trình độ', icon: GraduationCap },
        { 
          id: 'quaTrinhCongTac', 
          label: 'Quá trình công tác', 
          icon: Briefcase,
          children: [
            { id: 'htnv-ca-nhan', label: 'Mức độ HTNV Cá nhân', icon: UserCheck },
            { id: 'htnv-tap-the', label: 'Mức độ HTNV Tập thể', icon: Users },
          ]
        },
        { 
          id: 'thiDua', 
          label: 'Thi đua', 
          icon: Award,
          children: [
            { id: 'thiDua-caNhan', label: 'Danh hiệu thi đua Cá nhân', icon: UserCheck },
            { id: 'thiDua-tapThe', label: 'Danh hiệu thi đua Tập thể', icon: Trophy },
          ]
        },
        { 
          id: 'khenThuong', 
          label: 'Khen thưởng', 
          icon: Trophy,
          children: [
            { id: 'khenThuong-caNhan', label: 'Danh sách khen thưởng Cá nhân', icon: UserCheck },
            { id: 'khenThuong-tapThe', label: 'Danh sách khen thưởng Tập thể', icon: Users },
          ]
        },
        { 
          id: 'giangVienMoi', 
          label: 'Giảng viên mời', 
          icon: UserPlus,
          children: [
            { id: 'giangVienMoi-thinhGiang', label: 'Giảng viên Thỉnh giảng', icon: UserPlus },
            { id: 'giangVienMoi-dongCoHuu', label: 'Giảng viên đồng Cơ hữu', icon: Users },
          ]
        },
        { 
          id: 'thongKe', 
          label: 'Thống kê số liệu', 
          icon: BarChart2,
          children: [
            { id: 'thongKe-trinhDoChucDanh', label: 'Theo Chức danh và Trình độ', icon: PieChart },
            { id: 'thongKe-chuanCSGD', label: 'Theo chuẩn CSGD', icon: School },
          ]
        },
        { 
          id: 'danhMuc', 
          label: 'Danh mục', 
          icon: ListTodo,
          children: [
            { id: 'danhMuc-trinhDo', label: 'Trình độ', icon: TrendingUp },
            { id: 'danhMuc-chucDanh', label: 'Chức danh', icon: Gem },
            { id: 'danhMuc-chucVu', label: 'Chức vụ', icon: UserCheck },
            { id: 'danhMuc-khoaPhong', label: 'Khoa, Phòng', icon: Building2 },
            { id: 'danhMuc-namHoc', label: 'Năm học', icon: Calendar },
            { id: 'danhMuc-mucDoHTNV', label: 'Mức độ HTNV', icon: CheckSquare },
            { id: 'danhMuc-danhHieuThiDua', label: 'Danh hiệu Thi đua', icon: Trophy },
            { id: 'danhMuc-hinhThucKhenThuong', label: 'Hình thức Khen thưởng', icon: Gift },
          ]
        },
        { 
          id: 'congCu',
          label: 'Công cụ',
          icon: Wrench,
          children: [
            { id: 'congCu-saoLuu', label: 'Sao lưu dữ liệu', icon: DatabaseBackup },
            {
              id: 'congCu-quanLyCongPhep',
              label: 'Quản lý công phép',
              icon: CalendarDays,
              children: [
                { id: 'congCu-quanLyCongPhep-thietLap', label: 'Thiết lập ngày nghỉ trong năm', icon: Settings },
                { id: 'congCu-quanLyCongPhep-danhSach', label: 'Danh sách nghỉ phép năm', icon: ClipboardList },
                { id: 'congCu-quanLyCongPhep-thongKe', label: 'Thống kê số liệu nghỉ phép', icon: BarChart2 },
              ]
            }
          ]
        },
        { id: 'caiDat', 
          label: 'Cài đặt', 
          icon: Settings,
          children: [
            { id: 'hinhAnhNhanSu', label: 'Hình ảnh Nhân sự', icon: ImageIcon },
            { id: 'quanLyNguoiDung', label: 'Quản lý người dùng', icon: Users },
            { id: 'phanQuyen', label: 'Phân quyền sử dụng', icon: Shield },
            { id: 'danhMucChucNang', label: 'Danh mục chức năng', icon: ListTodo },
            { id: 'phanQuyenChucNang', label: 'Phân quyền chức năng', icon: KeyRound },
          ]
        },
      ]
    }
  ], [units, unitStaffCounts]);

  const toggleSubMenu = (id: string) => { setOpenSubMenus(prev => ({ ...prev, [id]: !prev[id] })); };

  const hasPermission = (moduleCode: string, permissionCode: string) => {
    return checkPermission(currentPermissions, session.isAdmin, moduleCode, permissionCode);
  };

  const processedMenu = useMemo(() => {
    if (session.isAdmin) return menuStructure.map(item => ({ ...item, isDisabled: false }));

    const allowedModuleCodes = (currentPermissions?.map(p => String(p.modulecode || '').toLowerCase()) || []).filter(Boolean);
    // Always allow dashboard, personal profile, and the root system container
    allowedModuleCodes.push('dashboard');
    allowedModuleCodes.push('tracuu-hoso');
    allowedModuleCodes.push('hethong');

    const processRecursive = (items: any[]): any[] => {
      return items.map(item => {
        const itemIdLower = String(item.id || '').toLowerCase();
        let isDisabled = !allowedModuleCodes.includes(itemIdLower);
        
        // Special case for units in traCuu-khoaPhong
        if (item.id && item.id.startsWith('traCuu-khoaPhong-')) {
           if (allowedModuleCodes.includes('traCuu-khoaPhong'.toLowerCase())) isDisabled = false;
        }

        // If it's a parent, it's disabled if all its children are disabled
        if (item.children && item.children.length > 0) {
          const processedChildren = processRecursive(item.children);
          const hasEnabledChild = processedChildren.some(child => !child.isDisabled);
          // A parent is enabled if it's explicitly allowed OR has an enabled child
          return { ...item, children: processedChildren, isDisabled: !hasEnabledChild && isDisabled };
        }

        return { ...item, isDisabled };
      });
    };

    return processRecursive(menuStructure);
  }, [menuStructure, session, currentPermissions]);

  const renderMenuItem = (item: any, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openSubMenus[item.id];
    const isActive = activeMenuItem === item.id;
    const isDisabled = item.isDisabled;
    const paddingLeft = `${(depth + 1) * 1}rem`; 

    return (
      <div key={item.id}>
        <button
          onClick={() => {
            if (isDisabled) return;
            if (item.id === 'heThong') {
              setActiveMenuItem('dashboard');
              if (!isOpen) toggleSubMenu(item.id);
            } else if (item.id === 'hopDongLaoDong') {
                setActiveMenuItem('hdld-overview');
                if (!isOpen) toggleSubMenu(item.id);
            } else if (item.id === 'quaTrinhCongTac') {
                setActiveMenuItem('quaTrinhCongTac-overview');
                if (!isOpen) toggleSubMenu(item.id);
            } else if (item.id === 'thiDua') {
                setActiveMenuItem('thiDua-overview');
                if (!isOpen) toggleSubMenu(item.id);
            } else if (hasChildren) {
              toggleSubMenu(item.id);
            } else {
              setActiveMenuItem(item.id);
            }
          }}
          disabled={isDisabled}
          className={`flex items-center justify-between w-full py-2 pr-4 rounded-lg text-sm font-medium transition-all duration-200 mb-1 text-left
            ${isDisabled ? 'opacity-50 cursor-not-allowed text-blue-400' : 
              isActive && !hasChildren ? 'bg-blue-700 text-white shadow-md' : 'text-blue-200 hover:bg-blue-800 hover:text-white'}
          `}
          style={{ paddingLeft: depth === 0 ? '1rem' : paddingLeft }}
        >
          <div className="flex items-center overflow-hidden">
            <div className="flex-shrink-0 w-8 flex justify-start">
               {item.icon && <item.icon className={`${depth > 0 ? 'h-4 w-4' : 'h-5 w-5'}`} />}
            </div>
            <span className="whitespace-nowrap truncate">{item.label}</span>
          </div>
          {hasChildren && (
            <ChevronDown className={`h-4 w-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>

        {hasChildren && isOpen && (
          <div className="space-y-1">
            {item.children.map((child: any) => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <aside className="w-80 bg-blue-900 text-white flex flex-col shadow-lg overflow-y-auto flex-shrink-0 scrollbar-hide">
        <div className="p-6 text-center border-b border-blue-800 flex-shrink-0 cursor-pointer group" onClick={() => setActiveMenuItem('dashboard')}>
          <h1 className="text-xl font-bold uppercase tracking-wider text-blue-200 mb-1 group-hover:text-white transition-colors">Quản lý</h1>
          <h2 className="text-2xl font-extrabold text-white tracking-widest">NHÂN SỰ</h2>
        </div>
        <nav className="flex-1 px-2 py-6">
          {processedMenu.map(item => renderMenuItem(item))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white shadow-md z-10 flex-shrink-0">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 truncate leading-none mb-1">BỘ GIÁO DỤC VÀ ĐÀO TẠO</span>
              <span className="text-lg font-bold text-red-600 whitespace-nowrap truncate leading-tight uppercase">Trường Đại học Kiến trúc Đà Nẵng</span>
            </div>
            <div className="flex items-center space-x-4 flex-shrink-0">
              {userFullName && (
                <div className="hidden sm:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                  <UserIcon className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-bold text-gray-700">Tài khoản: <span className="text-blue-700">{userFullName}</span></span>
                </div>
              )}
              {!session.isAdmin && (
                <button 
                  onClick={() => refreshPermissions(true)} 
                  disabled={isRefreshingPermissions}
                  className="flex items-center px-4 py-2 text-sm font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-xl transition-all whitespace-nowrap border border-emerald-100 disabled:opacity-50"
                  title="Làm mới quyền hạn từ hệ thống"
                >
                  {isRefreshingPermissions ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />} 
                  Làm mới quyền
                </button>
              )}
              <button onClick={() => setIsChangePasswordModalOpen(true)} className="flex items-center px-4 py-2 text-sm font-bold bg-blue-50 text-blue-800 hover:bg-blue-100 rounded-xl transition-all whitespace-nowrap border border-blue-100">
                <KeyRound className="h-4 w-4 mr-2" /> Đổi Password
              </button>
              <button onClick={onLogout} className="flex items-center px-4 py-2 text-sm font-bold bg-red-50 text-red-800 hover:bg-red-100 rounded-xl transition-all whitespace-nowrap border border-red-100">
                <LogOut className="h-4 w-4 mr-2" /> Thoát
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 p-6">
          {activeMenuItem === 'dashboard' ? ( <DashboardOverview />
          ) : activeMenuItem === 'hoSoNhanSu' ? ( <HoSoNhanSuManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'toBoMon-thongKe' ? ( <ToBoMonStatistics permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'toBoMon-danhMuc' ? ( <DanhMucToBoMonManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'toBoMon-giangVien' ? ( <GiangVienToBoMonManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'hdld-overview' ? ( <HopDongLaoDongOverview />
          ) : activeMenuItem === 'hdld-danhMuc' ? ( <DanhMucHDLDManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'hdld-danhSachKy' ? ( <DanhSachKyHDLDManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'hdld-denHanKy' ? ( <DanhSachDenHanKyHDLD />
          ) : activeMenuItem === 'hdld-ketThuc' ? ( <DanhSachNhanVienNghiViec permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'luong-danhMucHSL' ? ( <DanhMucHSLManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'luong-danhSachHSL' ? ( <DanhSachHSLManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'luong-nghiKhongLuong' ? ( <NghiKhongLuongManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'luong-duKienNangLuong' ? ( <DuKienNangLuongList />
          ) : activeMenuItem === 'baoHiem-danhMucBenhVien' ? ( <DanhMucBenhVienManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'baoHiem-tiLeDong' ? ( <BaoHiemTiLeDongManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'baoHiem-danhSachThamGia' ? ( <BaoHiemDanhSachThamGiaManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'baoHiem-soLieuBatBuoc' ? ( <BaoHiemSoLieuBatBuoc onCancel={() => setActiveMenuItem('dashboard')} />
          ) : activeMenuItem === 'baoHiem-danhSachThaiSan' ? ( <DanhSachThaiSanManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} onCancel={() => setActiveMenuItem('dashboard')} />
          ) : activeMenuItem === 'nganhHoc-danhMuc' ? ( <DanhMucNganhDaoTaoManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'nganhHoc-giangVien' ? ( <DanhSachGVNganhDaoTaoManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'nganhHoc-thongKe' ? ( <NganhDaoTaoStatistics permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'danhMuc-chucVu' ? ( <DanhMucChucVuManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'danhMuc-trinhDo' ? ( <DanhMucTrinhDoManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'danhMuc-khoaPhong' ? ( <DanhMucPhongBanManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'danhMuc-chucDanh' ? ( <DanhMucChucDanhManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'danhMuc-namHoc' ? ( <DanhMucNamHocManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'danhMuc-mucDoHTNV' ? ( <DanhMucMucDoHTNVManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'danhMuc-danhHieuThiDua' ? ( <DanhMucDanhHieuThiDuaManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'danhMuc-hinhThucKhenThuong' ? ( <DanhMucHinhThucKhenThuongManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'daoTao' ? ( <NangCaoTrinhDoManagement />
          ) : activeMenuItem === 'hinhAnhNhanSu' ? ( <HinhAnhNhanSuSettings />
          ) : activeMenuItem === 'quanLyNguoiDung' ? ( <UserManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'phanQuyen' ? ( <UserRoleManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'phanQuyenChucNang' ? ( <RolePermissionManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'danhMucChucNang' ? ( <DanhMucChucNangManagement permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'congCu-saoLuu' ? ( <DSTableManagement onCancel={() => setActiveMenuItem('dashboard')} permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'congCu-trichXuat-pdf' ? ( <ExtractDataFromFiles />
          ) : activeMenuItem === 'congCu-tachPdf' ? ( <SplitPDFManagement />
          ) : activeMenuItem === 'congCu-quanLyCongPhep-thietLap' ? ( <NgayNghiLeManagement />
          ) : activeMenuItem === 'congCu-quanLyCongPhep-danhSach' ? ( <NghiPhepNamManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'congCu-quanLyCongPhep-thongKe' ? ( <ThongKeNghiPhepManagement />
          ) : activeMenuItem === 'quaTrinhCongTac-overview' ? ( <QuaTrinhCongTacOverview />
          ) : activeMenuItem === 'thiDua-overview' ? ( <ThiDuaOverview />
          ) : activeMenuItem === 'htnv-ca-nhan' ? ( <DanhSachCaNhanHTNVManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'htnv-tap-the' ? ( <DanhSachTapTheHTNVManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'thiDua-caNhan' ? ( <DanhSachCaNhanDHTDManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'thiDua-tapThe' ? ( <DanhSachTapTheDHTDManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'khenThuong-caNhan' ? ( <DanhSachCaNhanKhenThuongManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'khenThuong-tapThe' ? ( <DanhSachTapTheKhenThuongManagement permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'traCuu-hoSo' ? ( <UserProfile session={session} permissions={currentPermissions} isAdmin={session.isAdmin} />
          ) : activeMenuItem === 'traCuu-bgh' ? ( <BGH />
          ) : activeMenuItem.startsWith('traCuu-khoaPhong-') ? ( 
            <DanhSachNhanSuKhoaPhong unitCode={activeMenuItem.replace('traCuu-khoaPhong-', '')} permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'traCuu-khoaPhong' ? ( <DanhSachNhanSuKhoaPhong permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'traCuu-toBoMon' ? ( <ToBoMon />
          ) : activeMenuItem === 'thongKe-trinhDoChucDanh' ? ( <ThongKeTrinhDoChucDanh permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : activeMenuItem === 'thongKe-chuanCSGD' ? ( <ChuanCSGDStatistics permissions={currentPermissions} isAdmin={session.isAdmin} currentUser={currentUser} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-10">
               <div className="bg-white p-12 rounded-3xl shadow-xl text-center border border-gray-100 max-w-md animate-in zoom-in duration-300">
                 <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <LayoutGrid className="h-10 w-10 text-gray-300" />
                 </div>
                 <h3 className="text-xl font-black text-gray-700 mb-2 uppercase tracking-tight">Tính năng đang cập nhật</h3>
                 <p className="text-sm font-medium">Hệ thống đang được nâng cấp thêm dữ liệu cho phân hệ <strong>{activeMenuItem}</strong>.</p>
                 <button onClick={() => setActiveMenuItem('dashboard')} className="mt-8 px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">Quay về Trang chủ</button>
               </div>
            </div>
          )}
        </main>
      </div>

      {/* Change Password Modal */}
      {isChangePasswordModalOpen && currentUser && ( 
        <ChangePasswordModal 
          user={currentUser} 
          onClose={() => setIsChangePasswordModalOpen(false)} 
          onSuccess={(m) => {
            setNotifyModal({ isOpen: true, type: 'success', message: m });
            setIsChangePasswordModalOpen(false);
            fetchCurrentUserInfo();
          }}
          onError={(m) => {
            setNotifyModal({ isOpen: true, type: 'error', message: m });
          }}
        /> 
      )}
      


      {/* General Notification Modal */}
      {notifyModal.isOpen && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-gray-100">
            <div className={`${notifyModal.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} p-4 text-white flex items-center gap-3`}>
              {notifyModal.type === 'success' ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
              <h3 className="text-lg font-bold">Thông báo</h3>
            </div>
            <div className="p-8 text-center space-y-4">
              <p className={`font-bold text-sm leading-relaxed ${notifyModal.type === 'error' ? 'text-red-700' : 'text-gray-800'}`}>
                {notifyModal.message}
              </p>
            </div>
            <div className="bg-gray-50 p-4 flex justify-center border-t">
              <button 
                onClick={() => setNotifyModal({ ...notifyModal, isOpen: false })} 
                className={`px-12 py-2 ${notifyModal.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white font-black rounded-xl hover:opacity-90 shadow-md transition-all active:scale-95 text-xs uppercase tracking-widest`}
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
