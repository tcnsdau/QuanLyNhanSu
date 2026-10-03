
export interface AdminAccount {
  taikhoan: string;
  matkhau: string;
}

export interface UserAccount {
  id: number;
  manv: string;
  username: string;
  email: string;
  enable: boolean;
  passwordhash: string;
  
  // Trường join hiển thị
  holot?: string;
  ten?: string;
  ten_phongban?: string;
}

export interface EmployeeAccount {
  id?: number; 
  taikhoan: string;
  matkhau: string;
  holot: string;
  ten: string;
  ngaysinh: string; 
  trinhdo: string;
  chucvu: string;
  donvicongtac: string;
  sodienthoai: string;
  email: string;
  duongdan: string; 
  thoihan: string; 
}

export interface NhanVien {
  id: number;
  manv: string;
  holot: string;
  ten: string;
  gioitinh: boolean;
  ngaysinh: string;
  noisinh: string;
  nguyenquan: string;
  noiohiennay: string;
  sodtdd: string;
  trinhdo: string; 
  chucdanh: string; 
  ngaychinhthuc: string;
  phongban: string; 
  chucvu: string; 
  socccd: string;
  ngaycap: string;
  noicap: string;
  danghiviec: boolean;
  email: string;
  giangvien: boolean;
  vithu: number;
  ngaythuviec: string;
  ngayqdtrogiang: string;
  ngayqdgiangvien: string;
  thoigiannghiviec: string;
  hinhanh: string;
  matkhau: string;
  hieuluc: string;
  
  ten_trinhdo?: string;
  ten_phongban?: string;
  ten_chucvu?: string;
  ten_chucdanh?: string;
}

export interface DanhMucNganhDaoTao {
  id: number;
  manganh: string;
  tennganh: string;
  khoinganh: string;
  linhvuc: string;
}

export interface DanhSachGVNganhDaoTao {
  id: number;
  manv: string;
  chucdanh: string;
  trinhdo: string;
  nganhdaotao: string;
  phongban: string;
  
  // Join fields
  holot?: string;
  ten?: string;
  ngaysinh?: string;
  ten_chucdanh?: string;
  ten_trinhdo?: string;
  ten_nganh?: string;
  ten_phongban?: string;
}

export interface Role {
  id: number;
  rolecode: string;
  rolename: string;
}

export interface UserRole {
  id: number;
  userid: number;
  roleid: number;
  
  // Join fields
  username?: string;
  email?: string;
  manv?: string;
  holot?: string;
  ten?: string;
  ten_phongban?: string;
  rolecode?: string;
  rolename?: string;
}

export interface NgayNghiLe {
  maso: number;
  ngaynghi: string;
  lydonghi: string;
}

export interface BenhVien {
  maso: number;
  tenbenhvien: string;
  diachi: string;
}

export interface TiLeDongBH {
  maso: number;
  thangnam: string;
  mdttquydinh: number;
  mdtttruong: number;
  bhxhtruong: number;
  bhxhnguoild: number;
  bhyttruong: number;
  bhytnguoild: number;
  bhtntruong: number;
  bhtnnguoild: number;
  bhatldtruong: number;
  dacosolieu: boolean;
}

export interface ThongTinBaoHiemCaNhan {
  id?: number;
  manv: string;
  sosobaohiem: string;
  noidangkykcb: number;
  thaisan: boolean;
  hetthamgia: boolean;

  // Trường bổ sung hiển thị
  holot?: string;
  ten?: string;
  gioitinh?: boolean;
  ngaysinh?: string;
  // fixed: added hinhanh property
  hinhanh?: string;
  ten_trinhdo?: string;
  ten_chucvu?: string;
  ten_phongban?: string;
  hsl?: number;
  hschucvu?: number;
  tongheso?: number;
  tenbenhvien?: string;
}

export interface QuaTrinhDongBaoHiem {
  maso: number;
  thangnam: string;
  manv: string;
  hsl: number;
  hschucvu: number;
  tongheso: number;
  tienluongphucap: number;
  bhxh: number;
  bhyt: number;
  bhtn: number;
  bhatld: number;
  thaisan: boolean;

  // Trường join
  holot?: string;
  ten?: string;
  ten_phongban?: string;
}

export interface DanhSachCaNhanHTNV {
  id: number;
  manv: string;
  namhoc: string;
  mucdohtnv: string;
  trinhdo: string;
  chucvu: string;
  donvi: string;
  holot?: string;
  ten?: string;
  danghiviec?: boolean;
}

export interface DanhSachTapTheHTNV {
  id: number;
  tendonvi: string;
  namhoc: string;
  mucdohtnv: string;
}

export interface DanhSachCaNhanDHTD {
  id: number;
  manv: string;
  trinhdo: string;
  chucvu: string;
  donvi: string;
  namhoc: string;
  danhhieuthidua: string;
  holot?: string;
  ten?: string;
}

export interface DanhSachTapTheDHTD {
  id: number;
  tendonvi: string;
  namhoc: string;
  danhhieuthidua: string;
}

export interface DanhSachCaNhanKhenThuong {
  id: number;
  manv: string;
  trinhdo: string;
  chucvu: string;
  donvi: string;
  namhoc: string;
  hinhthuckhenthuong: string;
  holot?: string;
  ten?: string;
}

export interface DanhSachTapTheKhenThuong {
  id: number;
  tendonvi: string;
  namhoc: string;
  hinhthuckhenthuong: string;
}

export interface DanhSachHSL {
  manv: string;
  manangluong: string;
  hsl: number;
  hschucvu: number;
  tongheso: number;
  dienxet: boolean;
  lydokhongxet: string;
  hetthamgia: boolean;
  thoigianbatdau: string;
  holot?: string;
  ten?: string;
  ngaychinhthuc?: string;
  ten_trinhdo?: string;
  ten_phongban?: string;
  ten_chucvu?: string;
  hinhanh?: string;
}

export interface DanhSachKyHDLD {
  idhopdong: string;
  sohd: string;
  manv: string;
  loaihd: string; 
  solan: number;
  tungay: string;
  denngay: string;
  ten_loaihd?: string; 
}

export interface ToBoMon {
  id: number;
  mabomon: string;
  giatri: string;
  tructhuoc: string; 
  sapxep: number;
}

export interface NhanSuBoMon {
  id: number;
  manv: string;
  holot: string;
  ten: string;
  ngaysinh: string;
  trinhdo: string;
  chuyennganhdaotaodaihoc: string;
  masobomon: string;
  bomon: string;
  vithubomon: number;
  tructhuoc: string;
  ngaychinhthuc: string;
  ngayqdtrogiang: string;
  ngayqdgiangvien: string;
  totnghiepdaihoc: string;
  totnghiepthacsy: string;
  totnghieptiensy: string;
  vithunhansu: number;
  chucvuquanly: string;
  danghiviec: boolean;
}

export interface ChucVu {
  id: number;
  machucvu: string;
  giatri: string;
}

export interface TrinhDo {
  id: number;
  matrinhdo: string;
  giatri: string;
  ghichu: string;
}

export interface PhongBan {
  id: number;
  maphongban: string;
  giatri: string;
  sapxep: number;
}

export interface ChucDanh {
  id: number;
  machucdanh: string;
  giatri: string;
  ghichu: string;
}

export interface NamHoc {
  id: number;
  manamhoc: string; 
  giatri: string;    
  macdinh: boolean;  
}

export interface DanhMucHDLD {
  id: number;
  maso: string;
  tenhdld: string;
  thoihan: string;
}

export interface MucDoHTNV {
  mamucdohtnv: number;
  mucdohtnv: string;
}

export interface DanhHieuThiDua {
  madanhhieu: number;
  danhhieuthidua: string;
  capxetduyet: string;
  doituongapdung: string;
}

export interface HinhThucKhenThuong {
  makhenthuong: number;
  hinhthuckhenthuong: string;
  capxetduyet: string;
  doituongapdung: string;
}

export interface NangCaoTrinhDo {
  maso: number;
  manv: string;
  holot: string;
  ten: string;
  donvi: string;
  chuyennganhhoctap: string;
  namtn: string;
  trinhdohoctapnangcao: string;
  diadiemhoctap: string;
  cosodaotao: string;
  thoigianhoc: string;
}

export interface QuanHeGiaDinh {
  id: number;
  manv: string;
  holot: string; 
  ten: string;   
  moiquanhe: string;
  namsinh: string;
  nghenghiep: string;
  noicongtac: string;
}

export interface QuaTrinhDaoTao {
  id: number;
  manv: string;
  trinhdodaotao: string;
  chuyennganh: string;
  cosodaotao: string;
  namtnxeploai: string;
}

export interface DanhMucHSL {
  maso: number;
  loaingachbac: string;
  chucdanhtrinhdo: string;
  sonamnangbac: number;
  sobac: number;
  mucnangheso: number;
  hesotoida: number;
}

export interface NghiKhongLuong {
  id: number;
  manv: string;
  tungay: string;
  denngay: string;
  sothangnghi: number;
  ghichu: string;
  khonghienthi: boolean;
  holot?: string;
  ten?: string;
  ten_trinhdo?: string;
  ten_phongban?: string;
  ten_chucvu?: string;
}

export interface RolePermission {
  id: number;
  userid: number;
  roleid?: number;
  permissionid: number;
  moduleid: number;
  modulecode: string;
  permissioncode: string;
  
  // Join fields for display
  manv?: string;
  hoten?: string;
  donvi?: string;
  chucvu?: string;
  modulename?: string;
  rolename?: string;
  permissionname?: string;
}

export interface Module {
  id: number;
  modulename: string;
  modulecode: string;
  enable: boolean;
}

export interface Permission {
  id: number;
  permissionname: string;
  permissioncode: string;
}

export interface DanhSachThaiSan {
  id?: number;
  maso?: number;
  manv: string;
  thoigianthaisan: number;
  batdau: string;
  ketthuc: string;
  chedosinh: string;
  ghichu?: string;

  // Trường join
  holot?: string;
  ten?: string;
  trinhdo?: string;
  chucvu?: string;
  phongban?: string;
  ten_trinhdo?: string;
  ten_chucvu?: string;
  ten_phongban?: string;
  ngaysinh?: string;
  gioitinh?: boolean;
  danghiviec?: boolean;
}

export type UserType = 'admin' | 'employee' | null;

export interface UserSession {
  type: UserType;
  adminData?: AdminAccount;
  employeeData?: EmployeeAccount;
}
