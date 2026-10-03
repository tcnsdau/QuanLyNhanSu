
import React, { useState } from 'react';
import { supabase, normalizeKeys } from '../services/supabase';
import { checkPermission, normalizePermissions } from '../services/permissionService';
import { UserSession, UserAccount } from '../types';
import { 
  User as UserIcon, 
  LogIn, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  HelpCircle, 
  Globe, 
  LayoutGrid, 
  GraduationCap,
  Loader,
  X,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

// Hàm băm mật khẩu tương tự trang UserManagement.tsx
const hashPasswordArgon2 = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `$argon2id$v=19$m=65536,t=3,p=4$${hashHex}`;
};

// Helper function to ensure keys are lowercase
// (Moved to services/supabase.ts)

interface LoginFormProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // State cho thông báo dạng Form (Modal)
  const [notifyModal, setNotifyModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error';
    message: string;
    buttonText?: string;
  }>({
    isOpen: false,
    type: 'error',
    message: '',
    buttonText: 'Đóng'
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginInput = username.trim();
    if (!loginInput || !password.trim()) return;
    
    setLoading(true);

    try {
      // Xây dựng filter string cho .or()
      // Mặc định kiểm tra username và email (kiểu chuỗi)
      let orFilter = `username.eq.${loginInput},email.eq.${loginInput}`;
      
      // KIỂM TRA ĐỊNH DẠNG: Chỉ thêm điều kiện kiểm tra cột manv nếu input là số
      // Điều này giúp tránh lỗi "invalid input syntax for type smallint" khi nhập email/chuỗi
      const isNumeric = /^\d+$/.test(loginInput);
      if (isNumeric) {
        orFilter += `,manv.eq.${loginInput}`;
      }

      // BƯỚC 1: Kiểm tra Tài khoản Đăng nhập
      const { data: userData, error: userError } = await supabase
        .from('Users')
        .select('*')
        .or(orFilter)
        .maybeSingle();

      if (userError) throw userError;

      if (!userData) {
        setNotifyModal({
          isOpen: true,
          type: 'error',
          message: 'Tài khoản Đăng nhập không tồn tại, kiểm tra lại nhé!'
        });
        setLoading(false);
        return;
      }

      const user = userData as UserAccount;

      // BƯỚC 2: Kiểm tra passwordhash
      const hashedInput = await hashPasswordArgon2(password);
      if (hashedInput !== user.passwordhash) {
        setNotifyModal({
          isOpen: true,
          type: 'error',
          message: 'Mật khẩu đăng nhập không đúng, kiểm tra lại nhé'
        });
        setLoading(false);
        return;
      }

      // BƯỚC 3: Kiểm tra tính hiệu lực (Bỏ qua nếu là Admin ID=1)
      if (Number(user.id) !== 1 && (user.enable === false || String(user.enable) === 'false')) {
        setNotifyModal({
          isOpen: true,
          type: 'error',
          message: 'Tài khoản này đã bị vô hiệu hóa! Hãy liên hệ Admin để trợ giúp!',
          buttonText: 'Đóng'
        });
        setLoading(false);
        return;
      }

      // BƯỚC 4: Kiểm tra Phân quyền (Role, Permission, Module)
      const isAdmin = String(user.manv) === '1' || user.username === 'Admin';
      let userPermissions: any[] = [];

      if (!isAdmin) {
        // Kiểm tra Table UserRoles để xem có Userid chưa
        const { data: userRoleData, error: userRoleError } = await supabase
          .from('UserRoles')
          .select('*')
          .eq('userid', user.id)
          .maybeSingle();

        if (userRoleError) throw userRoleError;

        if (!userRoleData) {
          setNotifyModal({
            isOpen: true,
            type: 'error',
            message: 'Tài khoản này chưa được phân quyền sử dụng trên Hệ thống, vui lòng liên hệ với Admintrator để được trợ giúp !',
            buttonText: 'Đã hiểu'
          });
          setLoading(false);
          return;
        }

        // Lấy danh sách quyền từ Table RolePermissions
        const { data: rolePermData, error: rolePermError } = await supabase
          .from('RolePermissions')
          .select('*')
          .eq('userid', user.id);

        if (rolePermError) throw rolePermError;

        // Lấy danh sách Modules để map moduleid sang modulecode
        const [moduleRes, permRes] = await Promise.all([
          supabase.from('Modules').select('*'),
          supabase.from('Permissions').select('*')
        ]);

        if (moduleRes.error) throw moduleRes.error;
        if (permRes.error) throw permRes.error;

        userPermissions = normalizePermissions(rolePermData || [], moduleRes.data || [], permRes.data || []);
      }

      // Đăng nhập thành công
      onLoginSuccess({ 
        type: 'admin', 
        adminData: { taikhoan: user.username, matkhau: password },
        permissions: userPermissions,
        isAdmin: isAdmin,
        manv: user.manv
      });

    } catch (err: any) {
      setNotifyModal({
        isOpen: true,
        type: 'error',
        message: 'Có lỗi xảy ra: ' + err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full font-sans bg-white dark:bg-[#111621] transition-colors duration-200">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#195de6]/5 overflow-hidden border-r border-gray-100 dark:border-gray-800">
        <div className="absolute inset-0 z-0">
          <div 
            className="h-full w-full bg-cover bg-center object-cover" 
            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuApmlFsDWJ_qEhLJh-Jdw9q8kziaJDHB9ESpkhuY_v-o0v_Dw11m3r2uGLsbg4u1PWvtCirLrxvU8yhcGWUkfVhHKQS9cZH33vIuTwmvNLdVI0m-bV9I9BU2DmlsjPl9uQdudwBHor92AAWcmbxcDvNzEb8PaAjfo2ZbiyNAraafuwEnyVEuGKU6VEFRD8iYZ1DVW9pAlzlT3Fjp47ixwL-AhXOKG9QPPZmKEVErAgHixqwmhGaEB3-6a4xaT6AlI5pgSwb-svKuCrC")' }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#195de6]/90 to-[#195de6]/20 mix-blend-multiply"></div>
        </div>
        <div className="relative z-10 flex flex-col justify-end p-12 w-full text-white">
          <div className="mb-4">
            <GraduationCap className="h-12 w-12 mb-3" />
          </div>
          <h2 className="text-3xl font-bold mb-3 leading-tight">
            Quản lý nhân sự<br />Hiệu quả & Chuyên nghiệp
          </h2>
          <p className="text-sm opacity-90 max-w-sm">
            Hệ thống HRM tích hợp dành cho cán bộ, giảng viên và nhân viên nhà trường.
          </p>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col relative bg-white dark:bg-[#111621]">
        <div className="absolute top-0 right-0 p-4 flex items-center gap-3">
          <button 
            onClick={() => setShowSupportModal(true)}
            className="flex items-center gap-2 text-xs font-medium text-blue-500 dark:text-gray-400 hover:text-[#195de6] transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Hỗ trợ</span>
          </button>
          <div className="h-3 w-px bg-gray-200 dark:bg-gray-700"></div>
          <button className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-[11px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            <Globe className="h-3.5 w-3.5" />
            VN
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
          <div className="w-full max-w-[380px] flex flex-col gap-6">
            <div className="flex flex-row items-center gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex-shrink-0">
                <img 
                  alt="DAU Logo" 
                  className="h-14 w-auto object-contain" 
                  src="https://lh3.googleusercontent.com/d/1OD0yKOMSr4sY3dnYcxsCNHypDna9BfT3" 
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-blue-400 dark:text-gray-500 uppercase tracking-widest leading-none mb-1">BỘ GIÁO DỤC VÀ ĐÀO TẠO</span>
                <span className="text-base font-bold text-red-500 uppercase leading-tight">
                  Trường Đại học<br />Kiến trúc Đà Nẵng
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5 mb-1 text-[#195de6]">
                <div className="size-8 bg-[#195de6]/10 rounded-lg flex items-center justify-center">
                  <LayoutGrid className="h-4.5 w-4.5" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Hệ thống Quản lý Nhân sự</h1>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Đăng nhập</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                Vui lòng nhập thông tin tài khoản để tiếp tục.
              </p>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-red-700 dark:text-gray-200" htmlFor="username">
                  Username / Email / Mã NV 
                </label>
                <div className="relative group">
                  <input 
                    className="w-full h-11 pl-4 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#195de6]/10 focus:border-[#195de6] transition-all text-sm font-bold" 
                    id="username" 
                    placeholder="Nhập Username, Email hoặc Mã NV" 
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <div className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-gray-400 pointer-events-none group-focus-within:text-[#195de6] transition-colors">
                    <UserIcon className="h-4 w-4" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-red-700 dark:text-gray-200" htmlFor="password">
                  Mật khẩu
                </label>
                <div className="relative group">
                  <input 
                    className="w-full h-11 pl-4 pr-10 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#195de6]/10 focus:border-[#195de6] transition-all text-sm font-bold" 
                    id="password" 
                    placeholder="Nhập mật khẩu" 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input className="w-3.5 h-3.5 rounded border-gray-300 text-[#195de6] focus:ring-[#195de6]/10 cursor-pointer" type="checkbox" />
                  <span className="text-[11px] text-red-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">Ghi nhớ đăng nhập</span>
                </label>
                <button 
                  type="button"
                  onClick={() => setShowSupportModal(true)}
                  className="text-[11px] font-bold text-[#195de6] hover:text-[#144ac0] hover:underline underline-offset-4"
                >
                  Quên mật khẩu?
                </button>
                </div>


              <button 
                className="mt-1 h-11 w-full bg-[#195de6] hover:bg-[#144ac0] text-white font-bold rounded-xl shadow-md shadow-[#195de6]/15 hover:shadow-lg hover:shadow-[#195de6]/25 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 text-sm" 
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <Loader className="animate-spin h-4 w-4" />
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <LogIn className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="px-3 bg-white dark:bg-[#111621] text-gray-400 font-bold uppercase tracking-tighter">Hệ thống Quản lý Nhân sự</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 text-center lg:text-left border-t border-gray-50 dark:border-gray-800">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
            © 2024 Trường Đại học Kiến trúc Đà Nẵng. <br className="lg:hidden" /> Version 2.4.0
          </p>
        </div>
      </div>

      {/* Support Contact Info Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-gray-900 bg-opacity-60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1f2e] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-gray-100 dark:border-gray-800">
            <div className="bg-[#195de6] p-5 text-white flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Thông tin Liên hệ
              </h3>
              <button 
                onClick={() => setShowSupportModal(false)}
                className="hover:bg-white/20 p-1 rounded-full transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-4 group">
                <div className="size-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-[#195de6] group-hover:scale-110 transition-transform">
                  <UserIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-red-400 tracking-widest mb-0.5">User</p>
                  <p className="text-base font-bold text-blue-900 dark:text-white">Admin</p>
                </div>
              </div>

              <div className="flex items-center gap-4 group">
                <div className="size-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-red-400 tracking-widest mb-0.5">Email</p>
                  <p className="text-base font-bold text-[#195de6] dark:text-blue-400 break-all">tuanha@dau.edu.vn</p>
                </div>
              </div>

              <div className="flex items-center gap-4 group">
                <div className="size-12 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-red-400 tracking-widest mb-0.5">Tel</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">0903586563</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-[#141824] px-6 py-4 flex justify-center border-t border-gray-100 dark:border-gray-800">
              <button 
                onClick={() => setShowSupportModal(false)}
                className="w-full bg-[#195de6] hover:bg-[#144ac0] text-white font-bold py-2 rounded-xl transition-colors shadow-md shadow-[#195de6]/10"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal (Form Thông báo) */}
      {notifyModal.isOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
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
                {notifyModal.buttonText || 'Đóng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
