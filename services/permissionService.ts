import { RolePermission } from '../types';

/**
 * Checks if a user has a specific permission on a module.
 * 
 * @param permissions - The list of user permissions
 * @param isAdmin - Whether the user is an administrator
 * @param mCode - The module code to check
 * @param pCode - The permission code to check (CREATE, UPDATE, DELETE, READ)
 * @returns boolean
 */
export const checkPermission = (
  permissions: RolePermission[] | undefined,
  isAdmin: boolean | undefined,
  mCode: string,
  pCode: string
): boolean => {
  if (isAdmin) return true;
  if (!permissions) return false;

  const targetMCode = String(mCode || '').toLowerCase();
  const targetPCode = String(pCode || '').toUpperCase();

  return permissions.some(p => {
    const currentMCode = String(p.modulecode || '').toLowerCase();
    const currentPCode = String(p.permissioncode || '').toUpperCase();

    if (currentMCode !== targetMCode) return false;

    // ALL permission grants everything
    if (currentPCode === 'ALL') return true;

    // Direct match
    if (currentPCode === targetPCode) return true;

    // Special case: PARTIAL_UPDATE counts as UPDATE
    if (targetPCode === 'UPDATE' && currentPCode === 'PARTIAL_UPDATE') return true;

    // Every permission (CREATE, UPDATE, DELETE, PARTIAL_UPDATE) implies READ
    if (targetPCode === 'READ' && ['CREATE', 'UPDATE', 'DELETE', 'PARTIAL_UPDATE'].includes(currentPCode)) return true;

    return false;
  });
};

/**
 * Normalizes raw permission data from the database into a standard format.
 */
export const normalizePermissions = (
  rawPermissions: any[],
  modulesList: any[],
  permissionsList: any[]
): RolePermission[] => {
  const normalizeKeys = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      newObj[key.toLowerCase()] = obj[key];
    });
    return newObj;
  };

  const normalizedModules = modulesList.map(normalizeKeys);
  const normalizedPerms = permissionsList.map(normalizeKeys);

  return rawPermissions.map(rp => {
    const normalizedRp = normalizeKeys(rp);
    const module = normalizedModules.find(m => String(m.id) === String(normalizedRp.moduleid));
    const permission = normalizedPerms.find(p => String(p.id) === String(normalizedRp.permissionid));
    
    let mCode = String(module?.modulecode || '');
    const mName = (module?.modulename || '').toLowerCase();
    
    // Mapping logic
    if (mName.includes('khoa, phòng') || mName.includes('khoaphong')) {
      mCode = 'traCuu-khoaPhong';
    } else if (mName.includes('mức độ htnv cá nhân')) {
      mCode = 'htnv-ca-nhan';
    } else if (mName.includes('mức độ htnv tập thể')) {
      mCode = 'htnv-tap-the';
    } else if (mName.includes('danh hiệu thi đua cá nhân')) {
      mCode = 'thiDua-caNhan';
    } else if (mName.includes('danh hiệu thi đua tập thể')) {
      mCode = 'thiDua-tapThe';
    } else if (mName.includes('khen thưởng cá nhân')) {
      mCode = 'khenThuong-caNhan';
    } else if (mName.includes('khen thưởng tập thể')) {
      mCode = 'khenThuong-tapThe';
    } else if (String(normalizedRp.moduleid) === '3' || mName.includes('danh sách nhân sự')) {
      mCode = 'hoSoNhanSu';
    } else if (mName.includes('danh mục hđlđ')) {
      mCode = 'hdld-danhMuc';
    } else if (mName.includes('danh mục ngành học') || mName.includes('danh mục ngành đào tạo')) {
      mCode = 'nganhHoc-danhMuc';
    } else if (mName.includes('danh sách gv theo ngành')) {
      mCode = 'nganhHoc-giangVien';
    } else if (mName.includes('danh sách ký hđlđ')) {
      mCode = 'hdld-danhSachKy';
    } else if (mName.includes('đến hạn ký hđlđ')) {
      mCode = 'hdld-denHanKy';
    } else if (mName.includes('kết thúc hđlđ')) {
      mCode = 'hdld-ketThuc';
    } else if (mName.includes('hợp đồng')) {
      mCode = 'hopDongLaoDong';
    } else if (mName.includes('danh mục hsl')) {
      mCode = 'luong-danhMucHSL';
    } else if (mName.includes('danh sách hsl')) {
      mCode = 'luong-danhSachHSL';
    } else if (mName.includes('nghỉ không lương')) {
      mCode = 'luong-nghiKhongLuong';
    } else if (mName.includes('dự kiến nâng lương')) {
      mCode = 'luong-duKienNangLuong';
    } else if (mName.includes('lương')) {
      mCode = 'luong';
    } else if (mName.includes('mức đóng và tỉ lệ đóng')) {
      mCode = 'baoHiem-tiLeDong';
    } else if (mName.includes('danh mục bệnh viện')) {
      mCode = 'baoHiem-danhMucBenhVien';
    } else if (mName.includes('danh sách gvnv tham gia')) {
      mCode = 'baoHiem-danhSachThamGia';
    } else if (mName.includes('thai sản') || mName.includes('danh sách thai sản')) {
      mCode = 'baoHiem-danhSachThaiSan';
    } else if (mName.includes('bảo hiểm')) {
      mCode = 'baoHiem';
    } else if (mName.includes('đào tạo')) {
      mCode = 'daoTao';
    } else if (mName.includes('thi đua')) {
      mCode = 'thiDua';
    } else if (mName.includes('khen thưởng')) {
      mCode = 'khenThuong';
    } else if (mName.includes('danh mục') && mName.includes('chức vụ')) {
      mCode = 'danhMuc-chucVu';
    } else if (mName.includes('danh mục tổ bộ môn') || mCode.toLowerCase() === 'khoaphong') {
      mCode = 'toBoMon-danhMuc';
    } else if (mName.includes('thống kê tổ bộ môn')) {
      mCode = 'toBoMon-thongKe';
    } else if (mName.includes('giảng viên tổ bộ môn')) {
      mCode = 'toBoMon-giangVien';
    } else if (mName.includes('danh mục')) {
      mCode = 'danhMuc';
    } else if (mName.includes('sao lưu dữ liệu')) {
      mCode = 'congCu-saoLuu';
    } else if (mName.includes('công cụ')) {
      mCode = 'congCu';
    } else if (mName.includes('cài đặt')) {
      mCode = 'caiDat';
    } else if (mName.includes('người dùng')) {
      mCode = 'quanLyNguoiDung';
    } else if (mName.includes('phân quyền chức năng')) {
      mCode = 'phanQuyenChucNang';
    } else if (mName.includes('tra cứu hồ sơ') || mName.includes('hồ sơ cá nhân')) {
      mCode = 'traCuu-hoSo';
    }
    
    let pCode = String(permission?.permissioncode || '');
    const pName = (permission?.permissionname || '').toLowerCase();
    const pId = String(normalizedRp.permissionid);
    
    // Prioritize name-based mapping to avoid ID conflicts
    if (pName.includes('tất cả') || pName.includes('all') || pCode.toUpperCase() === 'ALL') {
       pCode = 'ALL';
    } else if (pName.includes('thêm') || pName.includes('tạo') || pName.includes('create')) {
       pCode = 'CREATE';
    } else if (pName.includes('cập nhật') || pName.includes('hiệu chỉnh') || pName.includes('sửa') || pName.includes('update')) {
       pCode = 'UPDATE';
    } else if (pName.includes('xóa') || pName.includes('delete')) {
       pCode = 'DELETE';
    } else if (pName.includes('xem') || pName.includes('đọc') || pName.includes('read')) {
       pCode = 'READ';
    } else if (pId === '1' || pCode === '1') {
       pCode = 'CREATE';
    } else if (pId === '2' || pCode === '2') {
       pCode = 'UPDATE';
    } else if (pId === '3' || pCode === '3') {
       pCode = 'DELETE';
    } else if (pId === '4' || pCode === '4') {
       pCode = 'READ';
    }
    
    return {
      ...normalizedRp,
      modulecode: mCode,
      permissioncode: pCode,
      modulename: module?.modulename || '',
      permissionname: permission?.permissionname || ''
    } as RolePermission;
  });
};
