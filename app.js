/**
 * QUẢN LÝ HÀNG HOÁ NHẬP ĐỔI LỖI & XÁC NHẬN KHO - THỢ ĐIỆN MÁY XANH
 * Business Logic, Authentication, Excel Importer & Cloud Firestore Realtime Sync
 */

// ==============================================================================
// 1. DỮ LIỆU CỐ ĐỊNH & GLOBAL STATE
// ==============================================================================

// Cấu hình lưu trữ LocalStorage tương thích với từng Kho (Branch)
const LOCAL_KEYS = (typeof STORAGE_KEYS !== "undefined") ? STORAGE_KEYS : {
  ORDERS: "dmx_doi_loi_orders",
  STAFF: "dmx_doi_loi_staff",
  CURRENT_STAFF: "dmx_current_staff",
  LAST_STAFF_CODE: "dmx_last_staff_code",
  PRODUCTS: "dmx_doi_loi_products"
};

// Danh sách 10 nhân viên siêu thị được cấu hình sẵn theo yêu cầu
const INITIAL_STAFF = [
  { code: "38834", name: "NGÔ THỊ BÉ THẮM" },
  { code: "38847", name: "NGUYỄN HÙNG MẠNH" },
  { code: "12803", name: "NGUYỄN THỊ NHẠN" },
  { code: "58638", name: "PHẠM NGỌC ANH" },
  { code: "266798", name: "GIANG NHƯ Ý" },
  { code: "59442", name: "LÊ KIM MỸ" },
  { code: "46944", name: "NGUYỄN DIỄM MY" },
  { code: "97734", name: "HUỲNH HOÀNG PHÚC" },
  { code: "21964", name: "LÂM THỊ NHƯ Ý" },
  { code: "157597", name: "NGUYỄN TUẤN MI" }
];

// Danh mục sản phẩm mẫu ban đầu (phổ biến tại siêu thị ĐMX)
const DEFAULT_PRODUCTS = [
  { code: "CAM-IMOU-A22", name: "Camera IP 360 Độ 1080P Imou Ranger 2 A22EP-L", category: "Camera" },
  { code: "CAM-EZVIZ-H6C", name: "Camera IP 360 Độ 2K Ezviz H6c Pro 4MP", category: "Camera" },
  { code: "CAM-EZVIZ-C3TN", name: "Camera Ngoài Trời Ezviz C3TN 2MP 1080P", category: "Camera" },
  { code: "CAM-KBONE-H21", name: "Camera IP 360 Độ Kbone KN-H21PW 2MP", category: "Camera" },
  { code: "1114171000172", name: "Máy lọc nước RO nóng nguội lạnh Kangaroo KG10A3 10 lõi", category: "Máy lọc nước" },
  { code: "1114171000181", name: "Máy lọc nước RO nóng lạnh Karofi KAE-S65 11 lõi", category: "Máy lọc nước" },
  { code: "1114171000199", name: "Máy lọc nước RO Mutosi MP-P89K 9 lõi", category: "Máy lọc nước" },
  { code: "1114171000203", name: "Máy lọc nước RO Hòa Phát HPA885 10 lõi", category: "Máy lọc nước" },
  { code: "1114171000185", name: "Máy lọc nước RO Sunhouse SHA76213CK 10 lõi", category: "Máy lọc nước" },
  { code: "TV-SN-55X75K", name: "Smart Tivi Sony 4K 55 inch KD-55X75K", category: "Tivi" },
  { code: "TV-SS-65DU7000", name: "Smart Tivi Samsung 4K 65 inch Crystal UHD UA65DU7000", category: "Tivi" },
  { code: "TV-LG-50UT8050", name: "Smart Tivi LG 4K 50 inch 50UT8050PSB", category: "Tivi" },
  { code: "IPHONE-15PM-256", name: "Điện thoại iPhone 15 Pro Max 256GB", category: "Điện thoại" },
  { code: "SS-S24U-256", name: "Điện thoại Samsung Galaxy S24 Ultra 256GB", category: "Điện thoại" },
  { code: "OPPO-RENO12-5G", name: "Điện thoại OPPO Reno12 5G 12GB/256GB", category: "Điện thoại" },
  { code: "XIAOMI-NOTE13", name: "Điện thoại Xiaomi Redmi Note 13 (6GB/128GB)", category: "Điện thoại" },
  { code: "NOI-SHD4026", name: "Nồi chiên không dầu Sunhouse SHD4026 6 lít", category: "Gia dụng" },
  { code: "QUAT-KG50F79N", name: "Quạt điều hòa Kangaroo KG50F79N 45W", category: "Gia dụng" }
];

// Mật khẩu quản trị viên (Admin)
const ADMIN_PASSWORD = "43751";

// Global App State
const State = {
  // Authentication
  currentUser: {
    role: "guest", // 'guest' | 'staff' | 'admin'
    code: "",
    name: ""
  },
  currentStaff: null,
  staffList: [...INITIAL_STAFF],
  products: [],
  orders: [],
  
  // Filters
  filterStatus: "ALL", // 'ALL' | 'CHUA_VE_KHO' | 'DA_VE_KHO'
  filterStaff: "ALL",
  filterDate: "",
  searchQuery: "",

  // Temporary selected product in modal
  selectedProduct: null,
  activeOrderToConfirm: null,

  // Zalo notice & Receipt image export state
  currentReceiptOrder: null,
  currentPreviewImageBlob: null,
  currentPreviewText: "",
  currentPreviewFilename: "thong-bao-chua-ve-kho.png"
};

// DOM References Cache
const DOM = {};

// ==============================================================================
// 2. KHỞI TẠO ỨNG DỤNG & EVENT LISTENERS
// ==============================================================================
document.addEventListener("DOMContentLoaded", () => {
  cacheDOMElements();
  initTheme();
  initStoredData();
  setupEventListeners();
  renderStaffFilterOptions();
  renderStaffChipsInModal();
  updateKPIs();
  renderOrdersTable();
  initBranchSwitcher();

  // Bắt buộc hiển thị màn hình chọn nhân viên mỗi lần mở link web trước khi vào ứng dụng
  showStaffSelectionGate();

  // Khởi động kết nối đồng bộ Firebase
  initFirebaseService(
    handleFirebaseStatusChange,
    handleFirebaseOrdersUpdated,
    handleFirebaseProductsUpdated,
    handleFirebaseStaffUpdated
  );
});

function cacheDOMElements() {
  DOM.btnThemeToggle = document.getElementById("btnThemeToggle");
  DOM.firebaseStatusBadge = document.getElementById("firebaseStatusBadge");
  DOM.firebaseStatusText = document.getElementById("firebaseStatusText");

  // Branch Switcher
  DOM.btnBranchSwitcher = document.getElementById("btnBranchSwitcher");
  DOM.currentBranchLabel = document.getElementById("currentBranchLabel");
  DOM.modalBranchSwitcher = document.getElementById("modalBranchSwitcher");
  DOM.btnCloseBranchModal = document.getElementById("btnCloseBranchModal");
  DOM.btnCloseBranchModalFooter = document.getElementById("btnCloseBranchModalFooter");
  DOM.modalCurrentBranchName = document.getElementById("modalCurrentBranchName");
  DOM.inputShareBranchUrl = document.getElementById("inputShareBranchUrl");
  DOM.btnCopyShareBranchUrl = document.getElementById("btnCopyShareBranchUrl");
  DOM.inputNewBranchCode = document.getElementById("inputNewBranchCode");
  DOM.btnGoToBranch = document.getElementById("btnGoToBranch");
  DOM.linkKhoDefault = document.getElementById("linkKhoDefault");
  DOM.linkKho10528 = document.getElementById("linkKho10528");
  DOM.linkKho2 = document.getElementById("linkKho2");
  DOM.linkKho3 = document.getElementById("linkKho3");
  DOM.linkKhoShopB = document.getElementById("linkKhoShopB");
  DOM.btnOpenBranchModalToolbar = document.getElementById("btnOpenBranchModalToolbar");
  DOM.btnMenuBranchSwitcher = document.getElementById("btnMenuBranchSwitcher");
  
  // User Auth & Header
  DOM.userAuthWrap = document.querySelector(".user-auth-wrap");
  DOM.btnUserBadge = document.getElementById("btnUserBadge");
  DOM.userBadgeIcon = document.getElementById("userBadgeIcon");
  DOM.userBadgeRole = document.getElementById("userBadgeRole");
  DOM.userBadgeName = document.getElementById("userBadgeName");
  DOM.userDropdownMenu = document.getElementById("userDropdownMenu");
  DOM.btnMenuLoginStaff = document.getElementById("btnMenuLoginStaff");
  DOM.btnMenuLoginAdmin = document.getElementById("btnMenuLoginAdmin");
  DOM.btnMenuManageStaff = document.getElementById("btnMenuManageStaff");
  DOM.btnMenuLogout = document.getElementById("btnMenuLogout");
  DOM.dropdownDividerLogout = document.getElementById("dropdownDividerLogout");
  DOM.btnOpenManageStaffModal = document.getElementById("btnOpenManageStaffModal");
  DOM.btnOpenStaffManageFromLogin = document.getElementById("btnOpenStaffManageFromLogin");

  // KPI
  DOM.statTotalOrders = document.getElementById("statTotalOrders");
  DOM.statPendingOrders = document.getElementById("statPendingOrders");
  DOM.statReceivedOrders = document.getElementById("statReceivedOrders");
  DOM.statTotalProducts = document.getElementById("statTotalProducts");
  DOM.statProductDesc = document.getElementById("statProductDesc");

  // Filter toolbar
  DOM.searchInput = document.getElementById("searchInput");
  DOM.btnClearSearch = document.getElementById("btnClearSearch");
  DOM.filterStatusPills = document.getElementById("filterStatusPills");
  DOM.countAll = document.getElementById("countAll");
  DOM.countPending = document.getElementById("countPending");
  DOM.countReceived = document.getElementById("countReceived");
  DOM.filterStaffSelect = document.getElementById("filterStaffSelect");
  DOM.filterDateInput = document.getElementById("filterDateInput");
  DOM.btnResetDateFilter = document.getElementById("btnResetDateFilter");

  // Table
  DOM.ordersTableBody = document.getElementById("ordersTableBody");
  DOM.emptyState = document.getElementById("emptyState");
  DOM.btnEmptyCreate = document.getElementById("btnEmptyCreate");
  DOM.tableLoading = document.getElementById("tableLoading");

  // Buttons
  DOM.btnOpenNewOrderModal = document.getElementById("btnOpenNewOrderModal");
  DOM.btnOpenExcelModal = document.getElementById("btnOpenExcelModal");
  DOM.btnExportOrdersExcel = document.getElementById("btnExportOrdersExcel");
  DOM.btnClearAllOrders = document.getElementById("btnClearAllOrders");

  // Modal Login Staff (Gate)
  DOM.modalLoginStaff = document.getElementById("modalLoginStaff");
  DOM.btnCloseStaffLogin = document.getElementById("btnCloseStaffLogin");
  DOM.staffSearchInput = document.getElementById("staffSearchInput");
  DOM.staffSuggestionsDropdown = document.getElementById("staffSuggestionsDropdown");
  DOM.staffChipsList = document.getElementById("staffChipsList");
  DOM.btnSwitchToAdminLogin = document.getElementById("btnSwitchToAdminLogin");
  DOM.gateWelcomeBanner = document.getElementById("gateWelcomeBanner");

  // Modal Login Admin
  DOM.modalLoginAdmin = document.getElementById("modalLoginAdmin");
  DOM.btnCloseAdminLogin = document.getElementById("btnCloseAdminLogin");
  DOM.btnCancelAdminLogin = document.getElementById("btnCancelAdminLogin");
  DOM.btnSwitchToStaffLogin = document.getElementById("btnSwitchToStaffLogin");
  DOM.adminLoginForm = document.getElementById("adminLoginForm");
  DOM.adminPasswordInput = document.getElementById("adminPasswordInput");

  // Modal New Order
  DOM.modalNewOrder = document.getElementById("modalNewOrder");
  DOM.btnCloseNewOrder = document.getElementById("btnCloseNewOrder");
  DOM.btnCancelNewOrder = document.getElementById("btnCancelNewOrder");
  DOM.newOrderForm = document.getElementById("newOrderForm");
  DOM.fieldOrderCode = document.getElementById("fieldOrderCode");
  DOM.fieldOrderTime = document.getElementById("fieldOrderTime");
  DOM.fieldOrderStaff = document.getElementById("fieldOrderStaff");
  DOM.inputCustomerPhone = document.getElementById("inputCustomerPhone");
  DOM.inputCustomerName = document.getElementById("inputCustomerName");
  DOM.inputProductSearch = document.getElementById("inputProductSearch");
  DOM.productDropdown = document.getElementById("productDropdown");
  DOM.selectedProductCard = document.getElementById("selectedProductCard");
  DOM.selProdCode = document.getElementById("selProdCode");
  DOM.selProdName = document.getElementById("selProdName");
  DOM.btnClearSelectedProd = document.getElementById("btnClearSelectedProd");
  DOM.inputNotes = document.getElementById("inputNotes");

  // Modal Excel
  DOM.modalExcelProducts = document.getElementById("modalExcelProducts");
  DOM.btnCloseExcelModal = document.getElementById("btnCloseExcelModal");
  DOM.excelDropzone = document.getElementById("excelDropzone");
  DOM.excelFileInput = document.getElementById("excelFileInput");
  DOM.btnSelectExcelFile = document.getElementById("btnSelectExcelFile");
  DOM.btnDownloadSampleExcel = document.getElementById("btnDownloadSampleExcel");
  DOM.excelPreviewSection = document.getElementById("excelPreviewSection");
  DOM.excelPreviewCount = document.getElementById("excelPreviewCount");
  DOM.excelPreviewTableBody = document.getElementById("excelPreviewTableBody");
  DOM.btnConfirmImportExcel = document.getElementById("btnConfirmImportExcel");
  DOM.currentProductsCount = document.getElementById("currentProductsCount");
  DOM.currentProductsTableBody = document.getElementById("currentProductsTableBody");
  DOM.btnClearAllProducts = document.getElementById("btnClearAllProducts");

  // Modal Confirm Warehouse
  DOM.modalConfirmWarehouse = document.getElementById("modalConfirmWarehouse");
  DOM.btnCloseWarehouseModal = document.getElementById("btnCloseWarehouseModal");
  DOM.btnCancelWarehouseConfirm = document.getElementById("btnCancelWarehouseConfirm");
  DOM.warehouseConfirmForm = document.getElementById("warehouseConfirmForm");
  DOM.confirmOrderSummary = document.getElementById("confirmOrderSummary");
  DOM.inputWarehouseLocation = document.getElementById("inputWarehouseLocation");
  DOM.inputWarehouseNotes = document.getElementById("inputWarehouseNotes");

  // Modal Receipt Print
  DOM.modalReceipt = document.getElementById("modalReceipt");
  DOM.btnCloseReceipt = document.getElementById("btnCloseReceipt");
  DOM.btnPrintReceipt = document.getElementById("btnPrintReceipt");
  DOM.btnReceiptCopyZalo = document.getElementById("btnReceiptCopyZalo");
  DOM.btnReceiptExportImage = document.getElementById("btnReceiptExportImage");

  // Modal Preview & Xuất Ảnh Zalo
  DOM.modalImagePreview = document.getElementById("modalImagePreview");
  DOM.btnCloseImagePreview = document.getElementById("btnCloseImagePreview");
  DOM.btnCloseImagePreviewFooter = document.getElementById("btnCloseImagePreviewFooter");
  DOM.previewImgElement = document.getElementById("previewImgElement");
  DOM.btnDownloadPreviewImage = document.getElementById("btnDownloadPreviewImage");
  DOM.btnCopyPreviewImage = document.getElementById("btnCopyPreviewImage");
  DOM.btnCopyPreviewText = document.getElementById("btnCopyPreviewText");

  // Modal Quản Lý Nhân Viên (Thêm / Sửa / Xóa)
  DOM.modalManageStaff = document.getElementById("modalManageStaff");
  DOM.btnCloseManageStaff = document.getElementById("btnCloseManageStaff");
  DOM.btnCloseManageStaffFooter = document.getElementById("btnCloseManageStaffFooter");
  DOM.staffFormTitle = document.getElementById("staffFormTitle");
  DOM.staffCrudForm = document.getElementById("staffCrudForm");
  DOM.editStaffOriginalCode = document.getElementById("editStaffOriginalCode");
  DOM.inputCrudStaffCode = document.getElementById("inputCrudStaffCode");
  DOM.inputCrudStaffName = document.getElementById("inputCrudStaffName");
  DOM.btnCancelStaffEdit = document.getElementById("btnCancelStaffEdit");
  DOM.btnSubmitStaffForm = document.getElementById("btnSubmitStaffForm");
  DOM.staffCountDisplay = document.getElementById("staffCountDisplay");
  DOM.btnResetDefaultStaff = document.getElementById("btnResetDefaultStaff");
  DOM.staffManageTableBody = document.getElementById("staffManageTableBody");

  // Toast
  DOM.toastBox = document.getElementById("toastBox");
  DOM.toastIcon = document.getElementById("toastIcon");
  DOM.toastMessage = document.getElementById("toastMessage");
}

function initTheme() {
  const saved = localStorage.getItem("dmx_theme") || "light";
  document.body.className = `theme-${saved}`;
}

function toggleTheme() {
  const isLight = document.body.classList.contains("theme-light");
  const next = isLight ? "dark" : "light";
  document.body.className = `theme-${next}`;
  localStorage.setItem("dmx_theme", next);
}

function initStoredData() {
  // Load staff (Tách riêng biệt theo từng kho)
  const isDefaultBranch = (typeof IS_DEFAULT_BRANCH !== "undefined") ? IS_DEFAULT_BRANCH : true;
  const storedStaff = localStorage.getItem(LOCAL_KEYS.STAFF);
  if (storedStaff) {
    try {
      const parsed = JSON.parse(storedStaff);
      if (Array.isArray(parsed)) {
        State.staffList = parsed;
      } else {
        State.staffList = isDefaultBranch ? [...INITIAL_STAFF] : [];
      }
    } catch(e) {
      State.staffList = isDefaultBranch ? [...INITIAL_STAFF] : [];
    }
  } else {
    State.staffList = isDefaultBranch ? [...INITIAL_STAFF] : [];
    localStorage.setItem(LOCAL_KEYS.STAFF, JSON.stringify(State.staffList));
  }

  // Load products (dùng chung danh mục cho mọi kho)
  const storedProducts = localStorage.getItem(LOCAL_KEYS.PRODUCTS);
  if (storedProducts) {
    try {
      State.products = JSON.parse(storedProducts);
    } catch(e) {
      State.products = [...DEFAULT_PRODUCTS];
    }
  } else {
    State.products = [...DEFAULT_PRODUCTS];
    localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(State.products));
  }

  // Load orders (riêng theo kho)
  const storedOrders = localStorage.getItem(LOCAL_KEYS.ORDERS);
  if (storedOrders) {
    try {
      State.orders = JSON.parse(storedOrders);
      if (Array.isArray(State.orders)) {
        State.orders.sort((a, b) => {
          const timeA = getOrderTimestamp(a);
          const timeB = getOrderTimestamp(b);
          if (timeB !== timeA) return timeB - timeA;
          return (b.orderCode || "").localeCompare(a.orderCode || "");
        });
      }
    } catch(e) {
      State.orders = [];
    }
  }

  // Load nhân viên đăng nhập hiện tại (theo kho)
  const savedStaff = localStorage.getItem(LOCAL_KEYS.CURRENT_STAFF);
  if (savedStaff) {
    try {
      State.currentStaff = JSON.parse(savedStaff);
    } catch(e) {}
  }
  if (!State.currentStaff || !State.currentStaff.code) {
    const lastCode = localStorage.getItem(LOCAL_KEYS.LAST_STAFF_CODE);
    const found = State.staffList.find(s => s.code === lastCode);
    if (found) State.currentStaff = found;
  }

  // Tự động kiểm tra và chuyển các đơn bị gán nhầm là Admin về nhân viên hiện tại
  fixAdminStaffInOrders();
}

// Bắt buộc hiển thị màn hình chọn nhân viên mỗi khi mở web
function showStaffSelectionGate() {
  State.currentUser = { role: "guest", code: "", name: "" };
  updateUserBadgeUI();
  if (DOM.modalLoginStaff) {
    DOM.modalLoginStaff.classList.add("is-gate");
    openModal(DOM.modalLoginStaff);
    if (DOM.staffSearchInput) {
      DOM.staffSearchInput.value = "";
      setTimeout(() => {
        DOM.staffSearchInput.focus();
        handleStaffSearchAutocomplete("");
      }, 200);
    }
  }
}

// ==============================================================================
// 3. AUTHENTICATION (NHÂN VIÊN: CHỌN / AUTOCOMPLETE KHÔNG PASS | ADMIN: PASS 43751)
// ==============================================================================
function updateUserBadgeUI() {
  const u = State.currentUser;
  DOM.btnUserBadge.className = "btn-user-badge";

  if (u.role === "admin") {
    DOM.btnUserBadge.classList.add("role-admin");
    DOM.userBadgeIcon.textContent = "🛡️";
    DOM.userBadgeRole.textContent = "Quản trị viên";
    DOM.userBadgeName.textContent = "Quản trị viên (Admin)";
    DOM.btnMenuLogout.style.display = "flex";
    DOM.dropdownDividerLogout.style.display = "block";
    document.body.classList.add("is-admin");
  } else if (u.role === "staff") {
    DOM.btnUserBadge.classList.add("role-staff");
    DOM.userBadgeIcon.textContent = "👤";
    DOM.userBadgeRole.textContent = `NV: ${u.code}`;
    DOM.userBadgeName.textContent = u.name;
    DOM.btnMenuLogout.style.display = "flex";
    DOM.dropdownDividerLogout.style.display = "block";
    document.body.classList.remove("is-admin");
  } else {
    DOM.btnUserBadge.classList.add("role-guest");
    DOM.userBadgeIcon.textContent = "👤";
    DOM.userBadgeRole.textContent = "Chưa chọn NV";
    DOM.userBadgeName.textContent = "Bấm để chọn nhân viên";
    DOM.btnMenuLogout.style.display = "none";
    DOM.dropdownDividerLogout.style.display = "none";
    document.body.classList.remove("is-admin");
  }

  if (DOM.btnBranchSwitcher) {
    if (u.role === "admin") {
      DOM.btnBranchSwitcher.setAttribute("title", "Quản trị viên: Bấm để quản lý, nhân bản hoặc chuyển đổi kho");
    } else {
      DOM.btnBranchSwitcher.setAttribute("title", "Kho dữ liệu đang hoạt động");
    }
  }
}

// Lấy thông tin nhân viên đăng nhập thực tế (không lấy tài khoản Admin)
function getActiveStaff() {
  if (State.currentUser && State.currentUser.role === "staff" && State.currentUser.code && State.currentUser.code !== "ADMIN") {
    return {
      code: State.currentUser.code,
      name: State.currentUser.name
    };
  }
  if (State.currentStaff && State.currentStaff.code && State.currentStaff.code !== "ADMIN") {
    return State.currentStaff;
  }
  const savedStaff = localStorage.getItem(LOCAL_KEYS.CURRENT_STAFF);
  if (savedStaff) {
    try {
      const parsed = JSON.parse(savedStaff);
      if (parsed && parsed.code && parsed.code !== "ADMIN") return parsed;
    } catch(e) {}
  }
  const lastCode = localStorage.getItem(LOCAL_KEYS.LAST_STAFF_CODE);
  const found = State.staffList.find(s => s.code === lastCode && s.code !== "ADMIN");
  if (found) return found;

  return State.staffList[0] || { code: "38834", name: "NGÔ THỊ BÉ THẮM" };
}

// Tự động sửa lại những đơn cũ bị gán nhầm là Admin về nhân viên tiếp nhận thực tế
function fixAdminStaffInOrders() {
  const activeStaff = getActiveStaff();
  if (!activeStaff) return;
  let changed = false;
  State.orders.forEach(o => {
    if (o.staffCode === "ADMIN" || !o.staffName || o.staffName.includes("Admin") || o.staffName.includes("Quản Trị")) {
      o.staffCode = activeStaff.code;
      o.staffName = activeStaff.name;
      changed = true;
      saveOrderToFirebase(o);
    }
  });
  if (changed) {
    renderOrdersTable();
    updateKPIs();
  }
}

function loginAsStaff(staff) {
  State.currentUser = {
    role: "staff",
    code: staff.code,
    name: staff.name
  };
  State.currentStaff = {
    code: staff.code,
    name: staff.name
  };
  localStorage.setItem(LOCAL_KEYS.CURRENT_STAFF, JSON.stringify(State.currentStaff));
  localStorage.setItem(LOCAL_KEYS.LAST_STAFF_CODE, staff.code);
  updateUserBadgeUI();
  if (DOM.modalLoginStaff) {
    DOM.modalLoginStaff.classList.remove("is-gate");
    closeModal(DOM.modalLoginStaff);
  }
  if (DOM.modalBranchSwitcher) {
    closeModal(DOM.modalBranchSwitcher);
  }
  DOM.userDropdownMenu.style.display = "none";
  playSuccessSound();
  showToast(`👋 Chào bạn, ${staff.name} (${staff.code})! Đăng nhập thành công.`, "success");

  // Đồng bộ lại đơn hàng nếu có đơn bị lưu nhầm Admin
  fixAdminStaffInOrders();
}

function loginAsAdmin() {
  State.currentUser = {
    role: "admin",
    code: "ADMIN",
    name: "Quản Trị Viên (Admin)"
  };
  updateUserBadgeUI();
  if (DOM.modalLoginAdmin) closeModal(DOM.modalLoginAdmin);
  if (DOM.modalLoginStaff) DOM.modalLoginStaff.classList.remove("is-gate");
  DOM.userDropdownMenu.style.display = "none";
  playSuccessSound();
  showToast("🛡️ Đăng nhập quyền Quản trị viên (Admin) thành công!", "success");

  // Tự động mở chức năng tiếp theo:
  // Mặc định hoặc khi kích hoạt từ kho -> TỰ ĐỘNG HIỆN POPUP NHÂN BẢN & CHIA SẺ KHO (Hình 1)
  const pending = window.pendingAdminAction || "openBranchSwitcher";
  window.pendingAdminAction = null;

  setTimeout(() => {
    if (pending === "openManageStaff") {
      if (typeof openManageStaffModal === "function") openManageStaffModal();
    } else if (pending === "openExcelProducts") {
      if (typeof openExcelProductsModal === "function") openExcelProductsModal();
    } else {
      // Mở modal Nhân bản & Chia sẻ kho hàng (Hình 1)
      if (DOM.modalBranchSwitcher) {
        openModal(DOM.modalBranchSwitcher);
      }
    }
  }, 180);
}

function logout() {
  State.currentUser = { role: "guest", code: "", name: "" };
  updateUserBadgeUI();
  DOM.userDropdownMenu.style.display = "none";
  if (DOM.modalBranchSwitcher) {
    closeModal(DOM.modalBranchSwitcher);
  }
  showToast("Đã đăng xuất tài khoản", "info");
  showStaffSelectionGate();
}

// Render chip nhân viên để chọn 1-chạm trong modal đăng nhập (Tách biệt theo từng kho)
function renderStaffChipsInModal() {
  const branchName = (typeof getBranchDisplayName === "function") ? getBranchDisplayName(CURRENT_BRANCH) : "Mặc định";
  const lastCode = localStorage.getItem(LOCAL_KEYS.LAST_STAFF_CODE) || "";

  if (!State.staffList || State.staffList.length === 0) {
    DOM.staffChipsList.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 22px; text-align: center; background: var(--bg-surface-subtle); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <div style="font-size: 26px; margin-bottom: 6px;">🏪</div>
        <div style="font-weight: 700; color: var(--text-main); font-size: 14.5px;">Kho ${escapeHtml(branchName)} chưa có nhân viên riêng</div>
        <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 5px; line-height: 1.5;">
          Mỗi kho có danh sách nhân viên tách biệt độc lập.<br/>Vui lòng đăng nhập Quản trị viên (Admin) để tạo danh sách nhân viên riêng cho Kho ${escapeHtml(branchName)}.
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btnGateGoAdmin" style="margin-top: 12px;">
          🛡️ Đăng nhập Admin thêm nhân viên
        </button>
      </div>
    `;
    const btnGo = DOM.staffChipsList.querySelector("#btnGateGoAdmin");
    if (btnGo) {
      btnGo.addEventListener("click", () => {
        closeModal(DOM.modalLoginStaff);
        openModal(DOM.modalLoginAdmin);
        if (DOM.adminPasswordInput) {
          DOM.adminPasswordInput.value = "";
          DOM.adminPasswordInput.focus();
        }
      });
    }
    return;
  }

  DOM.staffChipsList.innerHTML = State.staffList.map(st => {
    const isRecent = st.code === lastCode ? " is-recent" : "";
    return `
      <button type="button" class="staff-chip-btn${isRecent}" data-code="${st.code}" title="Bấm để đăng nhập ngay">
        <span class="staff-chip-avatar">${st.name.charAt(0)}</span>
        <div>
          <span class="staff-chip-user">${st.code}</span>
          <span class="staff-chip-name">${st.name}</span>
        </div>
      </button>
    `;
  }).join("");

  DOM.staffChipsList.querySelectorAll(".staff-chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      const found = State.staffList.find(s => s.code === code);
      if (found) loginAsStaff(found);
    });
  });
}

// Tìm kiếm autocomplete nhân viên theo danh sách của kho hiện tại
function handleStaffSearchAutocomplete(query) {
  const cleanQ = removeVietnameseTones((query || "").trim().toLowerCase());
  const lastCode = localStorage.getItem(LOCAL_KEYS.LAST_STAFF_CODE) || "";

  const matches = cleanQ 
    ? State.staffList.filter(s => {
        const codeMatch = s.code.toLowerCase().includes(cleanQ);
        const nameMatch = removeVietnameseTones(s.name.toLowerCase()).includes(cleanQ);
        return codeMatch || nameMatch;
      })
    : State.staffList;

  if (!matches.length) {
    const branchName = (typeof getBranchDisplayName === "function") ? getBranchDisplayName(CURRENT_BRANCH) : "Mặc định";
    DOM.staffSuggestionsDropdown.innerHTML = `<div class="dropdown-option" style="color: var(--text-muted); cursor: default; padding: 12px 14px;">Kho ${escapeHtml(branchName)} chưa có nhân viên "${escapeHtml(query)}"</div>`;
    DOM.staffSuggestionsDropdown.style.display = "block";
    return;
  }

  DOM.staffSuggestionsDropdown.innerHTML = matches.map(st => {
    const isRecent = st.code === lastCode ? ` <span style="font-size: 10px; font-weight: 700; color: #fff; background: var(--primary); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Gần nhất</span>` : "";
    return `
      <div class="dropdown-option" data-code="${st.code}">
        <div>
          <div class="opt-title">${st.name}${isRecent}</div>
          <div class="opt-sub">Mã nhân viên: <strong style="color: var(--primary);">${st.code}</strong></div>
        </div>
        <span class="opt-badge">Vào web ➔</span>
      </div>
    `;
  }).join("");

  DOM.staffSuggestionsDropdown.style.display = "block";

  DOM.staffSuggestionsDropdown.querySelectorAll(".dropdown-option").forEach(opt => {
    opt.addEventListener("click", () => {
      const code = opt.getAttribute("data-code");
      const found = State.staffList.find(s => s.code === code);
      if (found) {
        loginAsStaff(found);
      }
    });
  });
}

// ==============================================================================
// 3.1. QUẢN LÝ NHÂN VIÊN (THÊM / SỬA / XÓA & ĐỒNG BỘ CLOUD)
// ==============================================================================
function openManageStaffModal() {
  if (State.currentUser.role !== "admin") {
    window.pendingAdminAction = "openManageStaff";
    showToast("Chức năng Quản lý Nhân viên chỉ dành cho Quản trị viên (Admin)!", "warning");
    openModal(DOM.modalLoginAdmin);
    return;
  }
  const modal = DOM.modalManageStaff || document.getElementById("modalManageStaff");
  if (!modal) {
    console.error("modalManageStaff element not found");
    return;
  }
  const branchName = (typeof getBranchDisplayName === "function") ? getBranchDisplayName(CURRENT_BRANCH) : "Mặc định";
  const headingEl = modal.querySelector(".modal-heading");
  if (headingEl) {
    headingEl.textContent = `Quản Lý Nhân Viên - Kho ${branchName}`;
  }
  resetStaffCrudForm();
  renderStaffManageTable();
  modal.style.display = "flex";
}

function renderStaffManageTable() {
  const tbody = DOM.staffManageTableBody || document.getElementById("staffManageTableBody");
  const countDisplay = DOM.staffCountDisplay || document.getElementById("staffCountDisplay");
  
  if (!Array.isArray(State.staffList)) {
    State.staffList = [];
  }

  if (countDisplay) {
    countDisplay.textContent = State.staffList.length;
  }

  if (!tbody) return;

  if (State.staffList.length === 0) {
    const branchName = (typeof getBranchDisplayName === "function") ? getBranchDisplayName(CURRENT_BRANCH) : "Mặc định";
    DOM.staffManageTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">
          Kho ${escapeHtml(branchName)} chưa có nhân viên nào. Hãy thêm nhân viên mới ở form bên trên!
        </td>
      </tr>
    `;
    return;
  }

  DOM.staffManageTableBody.innerHTML = State.staffList.map((st, idx) => {
    return `
      <tr>
        <td style="color: var(--text-muted); font-size: 12px; font-weight: 600;">${idx + 1}</td>
        <td>
          <span class="badge badge-pending font-mono" style="font-weight: 700;">${escapeHtml(st.code)}</span>
        </td>
        <td>
          <strong style="color: var(--text-main); font-size: 13.5px;">${escapeHtml(st.name)}</strong>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn-staff-action btn-edit-staff" data-code="${escapeHtml(st.code)}" title="Chỉnh sửa nhân viên">
            ✏️ Sửa
          </button>
          <button type="button" class="btn-staff-action btn-delete-staff" data-code="${escapeHtml(st.code)}" title="Xóa nhân viên khỏi danh sách">
            🗑️ Xóa
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Gắn sự kiện sửa / xóa
  DOM.staffManageTableBody.querySelectorAll(".btn-edit-staff").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      startEditStaff(code);
    });
  });

  DOM.staffManageTableBody.querySelectorAll(".btn-delete-staff").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      deleteStaff(code);
    });
  });
}

function startEditStaff(code) {
  const staff = State.staffList.find(s => s.code === code);
  if (!staff) return;

  DOM.editStaffOriginalCode.value = staff.code;
  DOM.inputCrudStaffCode.value = staff.code;
  DOM.inputCrudStaffName.value = staff.name;

  DOM.staffFormTitle.innerHTML = `✏️ Sửa Thông Tin: <span style="color: var(--primary);">${escapeHtml(staff.name)}</span>`;
  DOM.btnSubmitStaffForm.innerHTML = `<span>💾 Cập Nhật Thay Đổi</span>`;
  DOM.btnCancelStaffEdit.style.display = "inline-flex";

  DOM.inputCrudStaffName.focus();
  DOM.inputCrudStaffName.select();
}

function resetStaffCrudForm() {
  if (DOM.staffCrudForm) DOM.staffCrudForm.reset();
  if (DOM.editStaffOriginalCode) DOM.editStaffOriginalCode.value = "";
  if (DOM.staffFormTitle) DOM.staffFormTitle.innerHTML = `➕ Thêm Nhân Viên Mới`;
  if (DOM.btnSubmitStaffForm) DOM.btnSubmitStaffForm.innerHTML = `<span>💾 Lưu Nhân Viên</span>`;
  if (DOM.btnCancelStaffEdit) DOM.btnCancelStaffEdit.style.display = "none";
}

async function handleStaffCrudSubmit(e) {
  e.preventDefault();
  const code = (DOM.inputCrudStaffCode.value || "").trim();
  const name = (DOM.inputCrudStaffName.value || "").trim().toUpperCase();
  const origCode = (DOM.editStaffOriginalCode.value || "").trim();

  if (!code || !name) {
    showToast("Vui lòng nhập đầy đủ Mã nhân viên và Họ tên!", "warning");
    return;
  }

  if (origCode) {
    // Chế độ chỉnh sửa (Edit)
    if (code !== origCode && State.staffList.some(s => s.code.toLowerCase() === code.toLowerCase())) {
      showToast(`Mã nhân viên "${code}" đã được sử dụng bởi nhân viên khác!`, "error");
      DOM.inputCrudStaffCode.focus();
      return;
    }

    const idx = State.staffList.findIndex(s => s.code === origCode);
    if (idx !== -1) {
      State.staffList[idx] = { code, name };
      localStorage.setItem(LOCAL_KEYS.STAFF, JSON.stringify(State.staffList));
      if (typeof syncStaffToFirebase === "function") {
        await syncStaffToFirebase(State.staffList);
      }
      renderStaffManageTable();
      renderStaffFilterOptions();
      renderStaffChipsInModal();
      resetStaffCrudForm();
      playSuccessSound();
      showToast(`Đã cập nhật thông tin nhân viên "${name}" (${code}) thành công!`, "success");
    }
  } else {
    // Chế độ thêm mới (Add)
    if (State.staffList.some(s => s.code.toLowerCase() === code.toLowerCase())) {
      showToast(`Mã nhân viên "${code}" đã tồn tại! Vui lòng chọn mã khác.`, "error");
      DOM.inputCrudStaffCode.focus();
      return;
    }

    State.staffList.push({ code, name });
    localStorage.setItem(LOCAL_KEYS.STAFF, JSON.stringify(State.staffList));
    if (typeof syncStaffToFirebase === "function") {
      await syncStaffToFirebase(State.staffList);
    }
    renderStaffManageTable();
    renderStaffFilterOptions();
    renderStaffChipsInModal();
    resetStaffCrudForm();
    playSuccessSound();
    showToast(`Đã thêm nhân viên mới "${name}" (${code}) thành công!`, "success");
  }
}

async function deleteStaff(code) {
  const staff = State.staffList.find(s => s.code === code);
  if (!staff) return;

  const confirmed = confirm(`Bạn có chắc chắn muốn xóa nhân viên:\n\n• Họ tên: ${staff.name}\n• Mã NV: ${staff.code}\n\nSau khi xóa, nhân viên này sẽ không còn trong danh sách đăng nhập.`);
  if (!confirmed) return;

  State.staffList = State.staffList.filter(s => s.code !== code);
  localStorage.setItem(LOCAL_KEYS.STAFF, JSON.stringify(State.staffList));
  if (typeof syncStaffToFirebase === "function") {
    await syncStaffToFirebase(State.staffList);
  }

  if (DOM.editStaffOriginalCode && DOM.editStaffOriginalCode.value === code) {
    resetStaffCrudForm();
  }

  renderStaffManageTable();
  renderStaffFilterOptions();
  renderStaffChipsInModal();
  showToast(`Đã xóa nhân viên "${staff.name}" khỏi danh sách`, "info");
}

async function handleResetDefaultStaff() {
  const branchName = (typeof getBranchDisplayName === "function") ? getBranchDisplayName(CURRENT_BRANCH) : "Mặc định";
  const confirmed = confirm(`Nạp lại 10 nhân viên mẫu cho Kho ${branchName}?\n\nLưu ý: Thao tác này chỉ áp dụng riêng cho Kho ${branchName}, không làm thay đổi danh sách nhân viên của kho khác.`);
  if (!confirmed) return;

  State.staffList = [...INITIAL_STAFF];
  localStorage.setItem(LOCAL_KEYS.STAFF, JSON.stringify(State.staffList));
  if (typeof syncStaffToFirebase === "function") {
    await syncStaffToFirebase(State.staffList);
  }

  resetStaffCrudForm();
  renderStaffManageTable();
  renderStaffFilterOptions();
  renderStaffChipsInModal();
  playSuccessSound();
  showToast(`Đã nạp 10 nhân viên mẫu cho Kho ${branchName}!`, "success");
}

// ==============================================================================
// 4. QUẢN LÝ ĐƠN HÀNG NHẬP ĐỔI LỖI (CREATE & MANAGE)
// ==============================================================================
function generateOrderCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const countToday = State.orders.filter(o => {
    return o.orderCode && o.orderCode.startsWith(`DL-${yy}${mm}${dd}`);
  }).length + 1;
  const seq = String(countToday).padStart(4, '0');
  return `DL-${yy}${mm}${dd}-${seq}`;
}

function formatDateTime(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "--:-- --/--/----";
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${hh}:${min}:${ss} ${dd}/${mm}/${yyyy}`;
}

function getOrderTimestamp(order) {
  if (!order) return 0;

  // 1. Kiểm tra order.createdAt (ISO String, Timestamp, Number)
  if (order.createdAt) {
    if (typeof order.createdAt === "number") return order.createdAt;
    if (typeof order.createdAt === "object" && typeof order.createdAt.toMillis === "function") {
      return order.createdAt.toMillis();
    }
    if (typeof order.createdAt === "object" && order.createdAt.seconds) {
      return order.createdAt.seconds * 1000;
    }
    const t = new Date(order.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }

  // 2. Phân tích displayTime (hh:mm:ss dd/mm/yyyy)
  if (order.displayTime) {
    const parts = order.displayTime.trim().split(" ");
    if (parts.length >= 2) {
      const timeParts = parts[0].split(":");
      const dateParts = parts[1].split("/");
      if (dateParts.length === 3 && timeParts.length >= 2) {
        const d = parseInt(dateParts[0], 10);
        const m = parseInt(dateParts[1], 10) - 1;
        const y = parseInt(dateParts[2], 10);
        const hh = parseInt(timeParts[0], 10) || 0;
        const mm = parseInt(timeParts[1], 10) || 0;
        const ss = parseInt(timeParts[2], 10) || 0;
        const parsedDate = new Date(y, m, d, hh, mm, ss);
        if (!isNaN(parsedDate.getTime())) return parsedDate.getTime();
      }
    }
  }

  // 3. Fallback theo mã phiếu DL-YYMMDD-XXXX
  if (order.orderCode && typeof order.orderCode === "string" && order.orderCode.startsWith("DL-")) {
    const segs = order.orderCode.split("-");
    if (segs.length >= 3) {
      const datePart = segs[1]; // YYMMDD
      const seqPart = parseInt(segs[2], 10) || 0;
      if (datePart.length === 6) {
        const y = 2000 + parseInt(datePart.slice(0, 2), 10);
        const m = parseInt(datePart.slice(2, 4), 10) - 1;
        const d = parseInt(datePart.slice(4, 6), 10);
        return new Date(y, m, d).getTime() + seqPart * 1000;
      }
    }
  }

  return 0;
}

function openNewOrderModal() {
  // Bắt buộc đăng nhập trước khi tạo đơn
  if (State.currentUser.role === "guest") {
    showToast("Vui lòng chọn tài khoản nhân viên trước khi nhập đơn!", "warning");
    openModal(DOM.modalLoginStaff);
    return;
  }

  // Khởi tạo thông tin hệ thống tự động
  const now = new Date();
  const code = generateOrderCode();
  DOM.fieldOrderCode.textContent = code;
  DOM.fieldOrderTime.textContent = formatDateTime(now);
  
  // Nhân viên tiếp nhận luôn là nhân viên đăng nhập hiện tại
  const activeStaff = getActiveStaff();
  DOM.fieldOrderStaff.textContent = `${activeStaff.code} - ${activeStaff.name}`;

  // Reset form
  DOM.newOrderForm.reset();
  State.selectedProduct = null;
  DOM.selectedProductCard.style.display = "none";
  DOM.inputProductSearch.style.display = "block";
  DOM.productDropdown.style.display = "none";

  openModal(DOM.modalNewOrder);
}

// Xử lý autocomplete tìm sản phẩm trong danh mục do Admin thêm
function handleProductSearchAutocomplete(query) {
  const cleanQ = removeVietnameseTones((query || "").trim().toLowerCase());
  if (!cleanQ) {
    DOM.productDropdown.style.display = "none";
    return;
  }

  const matches = State.products.filter(p => {
    const codeMatch = (p.code || "").toLowerCase().includes(cleanQ);
    const nameMatch = removeVietnameseTones((p.name || "").toLowerCase()).includes(cleanQ);
    const catMatch = removeVietnameseTones((p.category || "").toLowerCase()).includes(cleanQ);
    return codeMatch || nameMatch || catMatch;
  }).slice(0, 15);

  let html = "";
  if (matches.length > 0) {
    html = matches.map(p => `
      <div class="dropdown-option" data-code="${escapeHtml(p.code)}" data-name="${escapeHtml(p.name)}">
        <div>
          <div class="opt-title">${escapeHtml(p.name)}</div>
          <div class="opt-sub">Mã SP: <strong>${escapeHtml(p.code)}</strong> ${p.category ? `• ${escapeHtml(p.category)}` : ''}</div>
        </div>
        <span class="opt-badge">Chọn</span>
      </div>
    `).join("");
  } else {
    html = `
      <div class="dropdown-option" data-code="" data-name="${escapeHtml(query)}">
        <div>
          <div class="opt-title">Sản phẩm mới: "${escapeHtml(query)}"</div>
          <div class="opt-sub">Bấm vào đây để dùng tên sản phẩm này</div>
        </div>
        <span class="opt-badge">Thêm mới</span>
      </div>
    `;
  }

  DOM.productDropdown.innerHTML = html;
  DOM.productDropdown.style.display = "block";

  DOM.productDropdown.querySelectorAll(".dropdown-option").forEach(opt => {
    opt.addEventListener("click", () => {
      const code = opt.getAttribute("data-code");
      const name = opt.getAttribute("data-name");
      selectProductForOrder(code, name);
    });
  });
}

function selectProductForOrder(code, name) {
  State.selectedProduct = { code: code || "KHAC", name };
  DOM.selProdCode.textContent = code ? `Mã SP: ${code}` : "Mã SP: Khác";
  DOM.selProdName.textContent = name;
  DOM.selectedProductCard.style.display = "flex";
  DOM.inputProductSearch.style.display = "none";
  DOM.productDropdown.style.display = "none";
}

function clearSelectedProduct() {
  State.selectedProduct = null;
  DOM.selectedProductCard.style.display = "none";
  DOM.inputProductSearch.style.display = "block";
  DOM.inputProductSearch.value = "";
  DOM.inputProductSearch.focus();
}

// Lưu đơn hàng đổi lỗi mới
async function handleNewOrderSubmit(e) {
  e.preventDefault();

  const phone = DOM.inputCustomerPhone.value.trim();
  const customerName = cleanAndFormatTitleCase(DOM.inputCustomerName.value);
  const productName = State.selectedProduct 
    ? State.selectedProduct.name 
    : DOM.inputProductSearch.value.trim();
  const productCode = State.selectedProduct 
    ? State.selectedProduct.code 
    : "KHAC";
  const notes = DOM.inputNotes ? DOM.inputNotes.value.trim() : "";

  if (!phone || !customerName || !productName) {
    showToast("Vui lòng điền đầy đủ: SĐT, Họ tên và Tên sản phẩm đổi lỗi!", "error");
    return;
  }

  const orderCode = DOM.fieldOrderCode.textContent;
  const now = new Date();

  // Nhân viên tiếp nhận luôn là nhân viên đăng nhập hiện tại
  const activeStaff = getActiveStaff();
  const staffCode = activeStaff.code;
  const staffName = activeStaff.name;

  const newOrder = {
    orderCode: orderCode,
    createdAt: now.toISOString(),
    displayTime: formatDateTime(now),
    customerPhone: phone,
    customerName: customerName,
    productCode: productCode,
    productName: productName,
    notes: notes,
    staffCode: staffCode,
    staffName: staffName,
    // Trạng thái kho mặc định: CHƯA VỀ KHO (chờ chuyển về kho)
    warehouseStatus: "CHUA_VE_KHO",
    warehouseTime: null,
    warehouseConfirmedBy: null,
    warehouseLocation: null,
    warehouseNotes: null
  };

  closeModal(DOM.modalNewOrder);

  // Hiển thị toast & lưu vào Firebase + Local
  showToast(`Đang lưu đơn ${orderCode}...`, "info");
  playSuccessSound();

  await saveOrderToFirebase(newOrder);

  // Thêm vào đầu danh sách nếu chưa có
  if (!State.orders.find(o => o.orderCode === orderCode)) {
    State.orders.unshift(newOrder);
  }

  updateKPIs();
  renderOrdersTable();
  showToast(`✅ Đã lưu phiếu tiếp nhận ${orderCode} thành công!`, "success");
}

// Tra cứu tên khách hàng cũ khi gõ SĐT
function handleCustomerPhoneInput(e) {
  const phone = e.target.value.trim();
  if (phone.length >= 10) {
    const prevOrder = State.orders.find(o => o.customerPhone === phone);
    if (prevOrder && !DOM.inputCustomerName.value.trim()) {
      DOM.inputCustomerName.value = cleanAndFormatTitleCase(prevOrder.customerName);
      showToast(`Tìm thấy khách quen: ${cleanAndFormatTitleCase(prevOrder.customerName)}`, "info");
    }
  }
}

// ==============================================================================
// 5. XÁC NHẬN HÀNG LỖI VỀ KHO (DÀNH CHO ADMIN / THỦ KHO)
// ==============================================================================
function openWarehouseConfirmModal(orderCode) {
  // Chỉ Admin hoặc nhân viên mới có thể thao tác
  if (State.currentUser.role === "guest") {
    showToast("Vui lòng đăng nhập để xác nhận hàng về kho!", "warning");
    openModal(DOM.modalLoginStaff);
    return;
  }

  const order = State.orders.find(o => o.orderCode === orderCode);
  if (!order) return;

  State.activeOrderToConfirm = order;

  // Nếu đơn hàng bị ghi nhận nhầm là Admin, tự động chuyển về nhân viên đăng nhập hiện tại
  if (order.staffCode === "ADMIN" || !order.staffName || order.staffName.includes("Admin") || order.staffName.includes("Quản Trị")) {
    const activeStaff = getActiveStaff();
    order.staffCode = activeStaff.code;
    order.staffName = activeStaff.name;
    saveOrderToFirebase(order);
  }

  const activeStaff = getActiveStaff();
  const currentConfirmedBy = State.currentUser.role === "admin" 
    ? "Quản trị viên (Admin)" 
    : `${activeStaff.name} (${activeStaff.code})`;

  DOM.confirmOrderSummary.innerHTML = `
    <div class="confirm-summary-row">
      <span class="label">Mã phiếu đổi lỗi:</span>
      <span class="val text-primary font-mono">${escapeHtml(order.orderCode)}</span>
    </div>
    <div class="confirm-summary-row">
      <span class="label">Sản phẩm:</span>
      <span class="val">${escapeHtml(order.productName)}</span>
    </div>
    <div class="confirm-summary-row">
      <span class="label">Khách hàng:</span>
      <span class="val">${escapeHtml(formatTitleCase(order.customerName))} (${escapeHtml(order.customerPhone)})</span>
    </div>
    <div class="confirm-summary-row" style="align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
      <span class="label">1. Nhân viên tiếp nhận (quầy):</span>
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span class="val font-semibold text-secondary" id="confirmSummaryStaff">👤 ${escapeHtml(order.staffName)} ${order.staffCode ? `(${escapeHtml(order.staffCode)})` : ''}</span>
        ${(order.staffCode !== activeStaff.code && State.currentUser.role !== "guest") ? `
          <button type="button" class="btn btn-outline btn-xs" id="btnReassignToActiveStaff" title="Gán nhân viên tiếp nhận cho người đang đăng nhập" style="padding: 2px 8px; font-size: 11px; border-color: var(--primary); color: var(--primary);">
            🔄 Gán cho: ${escapeHtml(activeStaff.name)}
          </button>
        ` : ''}
      </div>
    </div>
    <div class="confirm-summary-row" style="background: rgba(16, 185, 129, 0.08); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px dashed rgba(16, 185, 129, 0.4);">
      <span class="label" style="color: var(--text-main); font-weight: 600;">2. Người xác nhận nhập kho:</span>
      <span class="val font-semibold text-success">🏢 ${escapeHtml(currentConfirmedBy)} (Đang đăng nhập)</span>
    </div>
    <div class="confirm-summary-row">
      <span class="label">Hiện tại:</span>
      <span class="val text-rose font-mono font-bold">🔴 CHƯA VỀ KHO (Tại quầy)</span>
    </div>
  `;

  const btnReassign = document.getElementById("btnReassignToActiveStaff");
  if (btnReassign) {
    btnReassign.addEventListener("click", async () => {
      order.staffCode = activeStaff.code;
      order.staffName = activeStaff.name;
      await saveOrderToFirebase(order);
      renderOrdersTable();
      updateKPIs();
      const elStaff = document.getElementById("confirmSummaryStaff");
      if (elStaff) elStaff.textContent = `👤 ${order.staffName} (${order.staffCode})`;
      btnReassign.style.display = "none";
      showToast(`✅ Đã chuyển nhân viên tiếp nhận sang ${activeStaff.name}!`, "success");
    });
  }

  DOM.inputWarehouseLocation.value = "Kệ hàng lỗi đổi trả";
  DOM.inputWarehouseNotes.value = "";

  openModal(DOM.modalConfirmWarehouse);
}

async function handleWarehouseConfirmSubmit(e) {
  e.preventDefault();
  if (!State.activeOrderToConfirm) return;

  const order = State.activeOrderToConfirm;
  const now = new Date();
  const confirmedBy = State.currentUser.role === "admin" 
    ? "Quản trị viên (Admin)" 
    : `${State.currentUser.code} - ${State.currentUser.name}`;

  const warehouseUpdate = {
    warehouseStatus: "DA_VE_KHO",
    warehouseTime: now.toISOString(),
    warehouseDisplayTime: formatDateTime(now),
    warehouseConfirmedBy: confirmedBy,
    warehouseLocation: DOM.inputWarehouseLocation.value.trim() || "Kho hàng lỗi siêu thị",
    warehouseNotes: DOM.inputWarehouseNotes.value.trim() || "Thủ kho đã nhận đủ hàng"
  };

  closeModal(DOM.modalConfirmWarehouse);

  showToast(`Đang cập nhật kho cho đơn ${order.orderCode}...`, "info");
  await updateWarehouseStatusInFirebase(order.orderCode, warehouseUpdate);

  // Update in memory
  Object.assign(order, warehouseUpdate);
  updateKPIs();
  renderOrdersTable();

  playSuccessSound();
  showToast(`✅ Đã xác nhận hàng lỗi ${order.orderCode} VỀ KHO thành công!`, "success");
}

// Xóa đơn (Chỉ quyền Admin)
async function handleDeleteOrder(orderCode) {
  if (State.currentUser.role !== "admin") {
    showToast("Chỉ tài khoản Quản trị viên (Admin) mới có quyền xóa đơn!", "error");
    openModal(DOM.modalLoginAdmin);
    return;
  }

  if (!confirm(`Bạn có chắc chắn muốn xóa đơn ${orderCode} khỏi hệ thống?`)) {
    return;
  }

  showToast(`Đang xóa đơn ${orderCode}...`, "info");
  await deleteOrderFromFirebase(orderCode);

  State.orders = State.orders.filter(o => o.orderCode !== orderCode);
  updateKPIs();
  renderOrdersTable();
  showToast(`Đã xóa đơn ${orderCode}`, "success");
}

// Xóa toàn bộ danh sách đơn trong "Danh Sách Hàng Hoá Nhập Đổi Lỗi" (Chỉ quyền Admin)
async function handleClearAllOrders() {
  if (State.currentUser.role !== "admin") {
    showToast("Chỉ tài khoản Quản trị viên (Admin) mới có quyền xóa danh sách đơn!", "error");
    openModal(DOM.modalLoginAdmin);
    return;
  }

  if (!Array.isArray(State.orders) || State.orders.length === 0) {
    showToast("Danh Sách Hàng Hoá Nhập Đổi Lỗi hiện tại đang trống, không có đơn nào để xóa!", "info");
    return;
  }

  const count = State.orders.length;
  const promptVal = prompt(
    `⚠️ CẢNH BÁO QUẢN TRỊ VIÊN:\n\nBạn đang thực hiện XÓA TOÀN BỘ ${count} đơn hàng trong "Danh Sách Hàng Hoá Nhập Đổi Lỗi" của kho này!\n\nSau khi xóa, dữ liệu sẽ bị xóa vĩnh viễn trên Cloud Firebase và không thể khôi phục.\n\nNhập "XOA" hoặc mật khẩu Admin (43751) để xác nhận xóa:`
  );

  if (!promptVal) return;

  const clean = promptVal.trim();
  if (clean.toUpperCase() !== "XOA" && clean !== ADMIN_PASSWORD) {
    showToast("Mã xác nhận không đúng! Đã hủy thao tác xóa danh sách.", "warning");
    return;
  }

  showToast(`Đang xóa ${count} đơn trong danh sách...`, "info");
  if (typeof deleteAllOrdersFromFirebase === "function") {
    await deleteAllOrdersFromFirebase();
  } else {
    localStorage.setItem(LOCAL_KEYS.ORDERS, JSON.stringify([]));
  }

  State.orders = [];
  updateKPIs();
  renderOrdersTable();
  playSuccessSound();
  showToast(`✅ Đã xóa sạch toàn bộ ${count} đơn trong "Danh Sách Hàng Hoá Nhập Đổi Lỗi"!`, "success");
}

// ==============================================================================
// 6. QUẢN LÝ DANH MỤC SẢN PHẨM BẰNG EXCEL (SHEETJS)
// ==============================================================================
let tempParsedExcelProducts = [];

function openExcelProductsModal() {
  if (State.currentUser.role !== "admin") {
    window.pendingAdminAction = "openExcelProducts";
    showToast("Tính năng nạp Excel sản phẩm chỉ dành cho Quản trị viên (Admin)!", "warning");
    openModal(DOM.modalLoginAdmin);
    return;
  }

  tempParsedExcelProducts = [];
  DOM.excelPreviewSection.style.display = "none";
  renderCurrentProductsTable();
  openModal(DOM.modalExcelProducts);
}

function handleExcelFileSelect(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (!jsonRows || jsonRows.length < 2) {
        showToast("File Excel trống hoặc không có dòng dữ liệu hợp lệ!", "error");
        return;
      }

      // Cấu hình cố định cột theo chuẩn file siêu thị:
      // CỘT H (index 7): MÃ SẢN PHẨM
      // CỘT I (index 8): TÊN SẢN PHẨM
      // CỘT D (index 3): NGÀNH HÀNG
      let colCode = 7; // Cột H
      let colName = 8; // Cột I
      let colCat = 3;  // Cột D

      // Kiểm tra số lượng cột trong file: nếu file ít hơn 9 cột (file mẫu ngắn), tự động tìm theo tên cột
      const maxCols = Math.max(...jsonRows.slice(0, 10).map(r => Array.isArray(r) ? r.length : 0));
      if (maxCols < 9) {
        const headerRow = jsonRows[0].map(h => String(h || '').trim().toLowerCase());
        const foundCode = headerRow.findIndex(h => h.includes('mã sp') || h.includes('mã sản phẩm') || h.includes('sku') || h.includes('mã'));
        const foundName = headerRow.findIndex(h => h.includes('tên sp') || h.includes('tên sản phẩm') || h.includes('sản phẩm') || h.includes('tên'));
        const foundCat = headerRow.findIndex(h => h.includes('ngành') || h.includes('nhóm') || h.includes('loại') || h.includes('category'));
        if (foundCode !== -1) colCode = foundCode; else colCode = 0;
        if (foundName !== -1) colName = foundName; else colName = 1;
        if (foundCat !== -1) colCat = foundCat; else colCat = 2;
      }

      const parsed = [];
      const seenCodes = new Set();

      // Bắt đầu đọc dữ liệu từ dòng 2 (index 1), bỏ qua dòng tiêu đề
      for (let i = 1; i < jsonRows.length; i++) {
        const row = jsonRows[i];
        if (!row || !row.length) continue;

        let code = colCode < row.length ? String(row[colCode] != null ? row[colCode] : '').trim() : '';
        let name = colName < row.length ? String(row[colName] != null ? row[colName] : '').trim() : '';
        let cat = colCat < row.length ? String(row[colCat] != null ? row[colCat] : '').trim() : 'Tổng hợp';

        // Bỏ phần thập phân nếu mã bị Excel chuyển thành số dạng .0
        code = code.replace(/\.0$/, '');

        // Bỏ qua dòng trống hoặc dòng tiêu đề lặp lại
        if (!code && !name) continue;
        const lowerCode = code.toLowerCase();
        const lowerName = name.toLowerCase();
        if (lowerCode.includes('mã sản phẩm') || lowerCode === 'mã sp' || lowerName.includes('tên sản phẩm') || lowerName === 'tên sp') {
          continue;
        }

        if (!name && code) name = code;
        if (!code && name) code = `SP-${i}`;

        // Tránh trùng lặp mã sản phẩm trong cùng file Excel
        if (seenCodes.has(code)) continue;
        seenCodes.add(code);

        parsed.push({
          code: code,
          name: name,
          category: cat || 'Tổng hợp'
        });
      }

      if (!parsed.length) {
        showToast("Không tìm thấy sản phẩm hợp lệ trong file Excel!", "error");
        return;
      }

      tempParsedExcelProducts = parsed;
      DOM.excelPreviewCount.textContent = parsed.length;
      DOM.excelPreviewTableBody.innerHTML = parsed.slice(0, 50).map((p, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td class="font-mono"><strong>${escapeHtml(p.code)}</strong></td>
          <td>${escapeHtml(p.name)}</td>
          <td><span class="opt-badge">${escapeHtml(p.category)}</span></td>
        </tr>
      `).join("");

      if (parsed.length > 50) {
        DOM.excelPreviewTableBody.innerHTML += `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); font-style:italic;">...và ${parsed.length - 50} sản phẩm khác</td></tr>`;
      }

      DOM.excelPreviewSection.style.display = "block";
      showToast(`Đã đọc thành công ${parsed.length} sản phẩm từ file Excel! Bấm "Xác nhận nạp" để lưu.`, "success");
    } catch(err) {
      console.error(err);
      showToast("Lỗi khi đọc file Excel: " + err.message, "error");
    }
  };
  reader.readAsArrayBuffer(file);
}

async function confirmImportExcelProducts() {
  if (!tempParsedExcelProducts.length) return;

  // Hợp nhất danh mục, tránh trùng lặp mã sản phẩm
  const existingMap = new Map();
  State.products.forEach(p => existingMap.set(p.code, p));

  tempParsedExcelProducts.forEach(p => {
    existingMap.set(p.code, p);
  });

  State.products = Array.from(existingMap.values());
  await syncProductsToFirebase(State.products);

  DOM.excelPreviewSection.style.display = "none";
  renderCurrentProductsTable();
  updateKPIs();
  showToast(`🎉 Nạp thành công! Tổng danh mục hiện có: ${State.products.length} sản phẩm.`, "success");
}

function renderCurrentProductsTable() {
  DOM.currentProductsCount.textContent = State.products.length;
  DOM.currentProductsTableBody.innerHTML = State.products.map((p, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td class="font-mono"><strong>${escapeHtml(p.code)}</strong></td>
      <td>${escapeHtml(p.name)}</td>
      <td><span class="opt-badge">${escapeHtml(p.category || 'Tổng hợp')}</span></td>
      <td style="text-align: right;">
        <button type="button" class="btn-action btn-delete" data-code="${escapeHtml(p.code)}" title="Xóa sản phẩm này">✕</button>
      </td>
    </tr>
  `).join("");

  DOM.currentProductsTableBody.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const code = btn.getAttribute("data-code");
      State.products = State.products.filter(p => p.code !== code);
      await syncProductsToFirebase(State.products);
      renderCurrentProductsTable();
      updateKPIs();
      showToast("Đã xóa sản phẩm", "info");
    });
  });
}

function downloadSampleExcel() {
  const sampleData = [
    ["Mã sản phẩm", "Tên sản phẩm", "Ngành hàng"],
    ["CAM-IMOU-A22", "Camera IP 360 Độ 1080P Imou Ranger 2 A22EP", "Camera"],
    ["CAM-EZVIZ-H6C", "Camera IP 360 Độ 2K Ezviz H6c Pro 4MP", "Camera"],
    ["1114171000172", "Máy lọc nước RO Kangaroo KG10A3 10 lõi", "Máy lọc nước"],
    ["1114171000181", "Máy lọc nước RO Karofi KAE-S65 11 lõi", "Máy lọc nước"],
    ["TV-SN-55X75K", "Smart Tivi Sony 4K 55 inch KD-55X75K", "Tivi"],
    ["IPHONE-15PM", "Điện thoại iPhone 15 Pro Max 256GB", "Điện thoại"],
    ["NOI-SHD4026", "Nồi chiên không dầu Sunhouse SHD4026", "Gia dụng"]
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, ws, "Danh_Muc_San_Pham");
  XLSX.writeFile(wb, "Template_Mau_SanPham_DoiLoi_DMX.xlsx");
  showToast("Đã tải xuống file Excel mẫu: Template_Mau_SanPham_DoiLoi_DMX.xlsx", "success");
}

// ==============================================================================
// 7. IN PHIẾU TIẾP NHẬN ĐỔI LỖI (PRINT RECEIPT & BARCODE)
// ==============================================================================
function openReceiptModal(order) {
  if (!order) return;
  State.currentReceiptOrder = order;

  document.getElementById("printOrderCode").textContent = order.orderCode;
  document.getElementById("printOrderTime").textContent = order.displayTime || formatDateTime(order.createdAt);
  document.getElementById("printStaffName").textContent = `${order.staffName} (${order.staffCode})`;
  document.getElementById("printCustomerName").textContent = formatTitleCase(order.customerName);
  document.getElementById("printCustomerPhone").textContent = order.customerPhone;
  document.getElementById("printProductName").textContent = order.productName;
  const elPrintNotes = document.getElementById("printNotes");
  if (elPrintNotes) elPrintNotes.textContent = order.notes || "(Không có ghi chú)";

  const whStatusTxt = order.warehouseStatus === "DA_VE_KHO" 
    ? `✅ ĐÃ VỀ KHO (${order.warehouseDisplayTime || formatDateTime(order.warehouseTime)})` 
    : "🔴 CHƯA VỀ KHO (Đang giữ tại quầy)";
  document.getElementById("printWarehouseStatus").textContent = whStatusTxt;

  document.getElementById("printSigCustomer").textContent = formatTitleCase(order.customerName);
  document.getElementById("printSigStaff").textContent = order.staffName;
  document.getElementById("printSigWarehouse").textContent = order.warehouseConfirmedBy || "";

  // Tạo mã vạch
  try {
    if (typeof JsBarcode === "function") {
      JsBarcode("#receiptBarcode", order.orderCode, {
        format: "CODE128",
        lineColor: "#000",
        width: 1.8,
        height: 42,
        displayValue: false
      });
    }
  } catch(e) {
    console.warn("Barcode render warning:", e);
  }

  openModal(DOM.modalReceipt);
}

// ==============================================================================
// 7.1. XUẤT ẢNH & SAO CHÉP THÔNG TIN GỬI ZALO (CHƯA VỀ KHO)
// ==============================================================================

// Định dạng tin nhắn Zalo chuẩn gồm SĐT, Tên khách hàng & Tên sản phẩm
function formatZaloNoticeText(order) {
  if (!order) return "";
  const custName = formatTitleCase(order.customerName) || "Khách lẻ";
  const phone = order.customerPhone || "Chưa có";
  const prodName = order.productName || "Sản phẩm đổi lỗi";
  const isReceived = (order.warehouseStatus === "DA_VE_KHO");

  const headerTitle = isReceived 
    ? "✅ THÔNG BÁO: HÀNG ĐỔI LỖI ĐÃ VỀ KHO (SIÊU THỊ)" 
    : "⚠️ THÔNG BÁO: HÀNG ĐỔI LỖI CHƯA VỀ KHO (SIÊU THỊ)";

  return [
    headerTitle,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `📞 SĐT KHÁCH: ${phone}`,
    `👤 Tên khách hàng: ${custName}`,
    `📦 Sản phẩm: ${prodName}`
  ].join("\n");
}

// Sao chép chuỗi văn bản vào Clipboard (tương thích mọi trình duyệt và fallback)
async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("navigator.clipboard.writeText failed:", err);
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    el.style.top = "0";
    document.body.appendChild(el);
    el.select();
    const success = document.execCommand("copy");
    document.body.removeChild(el);
    return success;
  } catch (e) {
    console.warn("document.execCommand fallback copy failed:", e);
    return false;
  }
}

// Sao chép hình ảnh trực tiếp vào Clipboard (hỗ trợ dán Ctrl+V ngay vào Zalo chat)
async function copyImageBlobToClipboard(blob) {
  if (!blob) return false;
  try {
    if (navigator.clipboard && typeof window.ClipboardItem !== "undefined") {
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err) {
    console.warn("copyImageBlobToClipboard error:", err);
  }
  return false;
}

// Thao tác sao chép nhanh thông báo gửi Zalo từ bảng hoặc modal
async function copyZaloNotice(orderCode) {
  const order = State.orders.find(o => o.orderCode === orderCode);
  if (!order) {
    showToast("Không tìm thấy thông tin đơn hàng!", "error");
    return;
  }
  const text = formatZaloNoticeText(order);
  const ok = await copyToClipboard(text);
  if (ok) {
    showToast(`Đã sao chép SĐT & SP (${order.customerPhone}) gửi Zalo!`, "success");
  } else {
    prompt("Sao chép nội dung gửi Zalo:", text);
  }
}

// Helper ngắt dòng chữ tự động cho Canvas HTML5
function calculateWrappedLines(ctx, text, maxWidth) {
  if (!text) return [""];
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.length ? lines : [""];
}

// Helper vẽ góc bo tròn cho Canvas
function drawRoundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// Tạo Canvas đồ họa thẻ thông báo Zalo chuẩn nét cao (Retina 2x)
function createZaloNoticeCanvas(order) {
  if (!order) return null;
  const scale = 2; // Độ phân giải 2x cực nét
  const width = 720;
  
  // Đoạn đo đạc kích thước động
  const measureCanvas = document.createElement("canvas");
  const mCtx = measureCanvas.getContext("2d");
  
  const custName = formatTitleCase(order.customerName) || "Khách lẻ";
  const phone = order.customerPhone || "Chưa có";
  const prodName = order.productName || "Sản phẩm đổi lỗi";
  const prodCode = (order.productCode && order.productCode !== "KHAC") ? order.productCode : "";
  const notes = order.notes || "(Không có ghi chú)";
  const createTime = order.displayTime || formatDateTime(order.createdAt);
  const staff = `${order.staffName || "Nhân viên"}${order.staffCode ? ` (${order.staffCode})` : ""}`;
  const branchName = State.currentBranch ? `Kho ${State.currentBranch}` : "Siêu thị";
  const isReceived = (order.warehouseStatus === "DA_VE_KHO");

  mCtx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const prodLines = calculateWrappedLines(mCtx, prodName, 460);
  
  mCtx.font = "15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const noteLines = calculateWrappedLines(mCtx, notes, 460);

  // Tính chiều cao tổng thể linh hoạt
  const baseDetailsHeight = 150 + (prodLines.length * 26) + (noteLines.length * 24);
  const totalHeight = 100 + 52 + 50 + baseDetailsHeight + 120 + 44;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = totalHeight * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  // Nền trắng tổng thể
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, totalHeight);

  // 1. Header Thương Hiệu Xanh Điện Máy Xanh
  const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
  headerGrad.addColorStop(0, "#0071ba");
  headerGrad.addColorStop(1, "#0284c7");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, width, 100);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("HỆ THỐNG QUẢN LÝ ĐỔI LỖI", 36, 42);

  ctx.font = "700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillText(`🏢 ${branchName.toUpperCase()} • ĐIỆN MÁY XANH`, 36, 72);

  // Thời gian xuất ảnh góc phải
  const nowStr = formatDateTime(new Date().toISOString());
  ctx.font = "500 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillText(`Xuất ảnh: ${nowStr}`, width - 36, 42);
  ctx.textAlign = "left";

  // 2. Banner Cảnh Báo Chưa Về Kho (Màu đỏ nổi bật)
  let curY = 100;
  if (!isReceived) {
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(0, curY, width, 52);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚠️ CẢNH BÁO: SẢN PHẨM CHƯA ĐƯỢC MANG HÀNG LỖI VỀ SIÊU THỊ ⚠️", width / 2, curY + 33);
    ctx.textAlign = "left";
  } else {
    ctx.fillStyle = "#059669";
    ctx.fillRect(0, curY, width, 52);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✅ HÀNG ĐỔI LỖI ĐÃ ĐƯỢC NHẬN VỀ KHO SIÊU THỊ", width / 2, curY + 33);
    ctx.textAlign = "left";
  }
  curY += 52;

  // 3. Thanh Mã Phiếu & Ngày Tạo
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, curY, width, 50);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, curY, width, 50);

  ctx.font = "700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("MÃ PHIẾU:", 36, curY + 31);

  ctx.font = "900 18px monospace, Courier, sans-serif";
  ctx.fillStyle = "#0284c7";
  ctx.fillText(order.orderCode, 130, curY + 31);

  ctx.font = "600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "right";
  ctx.fillText(`Ngày tạo: ${createTime}`, width - 36, curY + 31);
  ctx.textAlign = "left";

  curY += 50;

  // 4. Chi Tiết Khách Hàng & Sản Phẩm
  const drawRow = (label, value, fontStyle = "600 15px", textColor = "#1e293b", isHighlight = false) => {
    ctx.font = "700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(label, 36, curY);

    if (isHighlight) {
      ctx.font = fontStyle;
      const textWidth = ctx.measureText(value).width;
      ctx.fillStyle = "rgba(2, 132, 199, 0.1)";
      drawRoundedRect(ctx, 215, curY - 22, textWidth + 20, 30, 4, true, false);
      ctx.fillStyle = textColor;
      ctx.fillText(value, 225, curY);
    } else {
      ctx.font = fontStyle;
      ctx.fillStyle = textColor;
      ctx.fillText(value, 225, curY);
    }
    curY += 34;
  };

  curY += 30;
  // SĐT Khách Hàng Nổi Bật To Rõ
  drawRow("📞 SỐ ĐIỆN THOẠI:", phone, "900 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", "#0284c7", true);
  
  // Tên Khách Hàng
  drawRow("👤 Khách hàng:", custName, "700 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", "#0f172a");

  // Tên Sản Phẩm Đổi Lỗi
  ctx.font = "700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("📦 Sản phẩm lỗi:", 36, curY);

  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#0f172a";
  prodLines.forEach((line, i) => {
    ctx.fillText(line, 225, curY + (i * 24));
  });
  curY += (prodLines.length * 24) + 8;

  // Mã sản phẩm
  if (prodCode) {
    drawRow("🏷️ Mã sản phẩm:", prodCode, "700 14px monospace, Courier, sans-serif", "#475569");
  }

  // Ghi chú lỗi
  ctx.font = "700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("📝 Ghi chú lỗi:", 36, curY);

  ctx.font = "500 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#334155";
  noteLines.forEach((line, i) => {
    ctx.fillText(line, 225, curY + (i * 22));
  });
  curY += (noteLines.length * 22) + 10;

  // Nhân viên tiếp nhận
  drawRow("👨‍💼 NV tiếp nhận:", staff, "600 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", "#334155");

  curY += 8;

  // 5. Hộp Nhắc Nhở Gửi Zalo Lớn (Alert Callout Box)
  const boxX = 36;
  const boxWidth = width - 72;
  const boxHeight = 100;
  
  if (!isReceived) {
    ctx.fillStyle = "#fef2f2";
    drawRoundedRect(ctx, boxX, curY, boxWidth, boxHeight, 8, true, false);
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, boxX, curY, boxWidth, boxHeight, 8, false, true);

    ctx.fillStyle = "#991b1b";
    ctx.font = "900 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("🚨 LƯU Ý QUAN TRỌNG GỬI ZALO:", boxX + 20, curY + 28);

    ctx.fillStyle = "#dc2626";
    ctx.font = "700 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("SẢN PHẨM NÀY CHƯA ĐƯỢC MANG HÀNG LỖI VỀ SIÊU THỊ!", boxX + 20, curY + 56);

    ctx.fillStyle = "#4b5563";
    ctx.font = "500 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("👉 Vui lòng liên hệ khách hoặc kiểm tra quầy để chuyển hàng lỗi về kho gấp.", boxX + 20, curY + 82);
  } else {
    ctx.fillStyle = "#f0fdf4";
    drawRoundedRect(ctx, boxX, curY, boxWidth, boxHeight, 8, true, false);
    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, boxX, curY, boxWidth, boxHeight, 8, false, true);

    ctx.fillStyle = "#166534";
    ctx.font = "900 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("✅ TRẠNG THÁI: ĐÃ VỀ KHO SIÊU THỊ", boxX + 20, curY + 30);

    ctx.fillStyle = "#15803d";
    ctx.font = "600 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`Thủ kho đã nhận: ${order.warehouseConfirmedBy || 'Đã nhận'}`, boxX + 20, curY + 58);
    ctx.fillText(`Thời gian nhận: ${order.warehouseDisplayTime || formatDateTime(order.warehouseTime)}`, boxX + 20, curY + 82);
  }

  // 6. Chân Thẻ Watermark
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, totalHeight - 44, width, 44);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HỆ THỐNG ĐỔI LỖI SIÊU THỊ • TỰ ĐỘNG XUẤT ẢNH GỬI ZALO", width / 2, totalHeight - 17);
  ctx.textAlign = "left";

  return canvas;
}

// Xuất ảnh thông báo Zalo dạng Card đồ họa
async function exportZaloNoticeImage(orderCode) {
  const order = State.orders.find(o => o.orderCode === orderCode);
  if (!order) {
    showToast("Không tìm thấy thông tin đơn hàng!", "error");
    return;
  }
  showToast("Đang tạo ảnh thông báo gửi Zalo...", "info");
  
  const canvas = createZaloNoticeCanvas(order);
  if (!canvas) {
    showToast("Không thể tạo ảnh thông báo!", "error");
    return;
  }

  canvas.toBlob(async blob => {
    if (!blob) {
      showToast("Lỗi xử lý hình ảnh!", "error");
      return;
    }
    State.currentPreviewImageBlob = blob;
    State.currentPreviewFilename = `Thong-bao-chua-ve-kho-${order.orderCode}-${order.customerPhone || 'khach'}.png`;
    State.currentPreviewText = formatZaloNoticeText(order);

    const dataUrl = canvas.toDataURL("image/png");
    DOM.previewImgElement.src = dataUrl;
    openModal(DOM.modalImagePreview);

    // Tự động sao chép ảnh vào Clipboard để người dùng dán (Ctrl+V) ngay vào Zalo
    const copiedImage = await copyImageBlobToClipboard(blob);
    if (copiedImage) {
      showToast("Đã sao chép ảnh! Bạn có thể dán (Ctrl+V) ngay vào Zalo.", "success");
    } else {
      showToast("Đã tạo ảnh thành công! Bấm 'Tải Ảnh' hoặc 'Sao chép' bên dưới.", "success");
    }
  }, "image/png");
}

// Xuất ảnh chụp trực tiếp từ Phiếu Tiếp Nhận (In Phiếu)
async function exportReceiptSlipImage() {
  if (!State.currentReceiptOrder) {
    showToast("Không tìm thấy phiếu để xuất ảnh!", "error");
    return;
  }
  const printArea = document.getElementById("receiptPrintArea");
  if (!printArea) return;

  showToast("Đang kết xuất ảnh phiếu tiếp nhận...", "info");
  try {
    if (typeof html2canvas === "function") {
      const canvas = await html2canvas(printArea, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true
      });
      canvas.toBlob(async blob => {
        if (!blob) {
          showToast("Không thể xuất ảnh từ phiếu in!", "error");
          return;
        }
        State.currentPreviewImageBlob = blob;
        State.currentPreviewFilename = `Phieu-tiep-nhan-${State.currentReceiptOrder.orderCode}.png`;
        State.currentPreviewText = formatZaloNoticeText(State.currentReceiptOrder);
        const url = URL.createObjectURL(blob);
        DOM.previewImgElement.src = url;
        openModal(DOM.modalImagePreview);

        const copied = await copyImageBlobToClipboard(blob);
        if (copied) {
          showToast("Đã sao chép ảnh phiếu! Bạn có thể dán (Ctrl+V) vào Zalo.", "success");
        } else {
          showToast("Đã tạo ảnh phiếu thành công!", "success");
        }
      }, "image/png");
    } else {
      exportZaloNoticeImage(State.currentReceiptOrder.orderCode);
    }
  } catch (err) {
    console.error("html2canvas error:", err);
    exportZaloNoticeImage(State.currentReceiptOrder.orderCode);
  }
}

// Tải ảnh xem trước về máy
function downloadPreviewImage() {
  if (!State.currentPreviewImageBlob && !DOM.previewImgElement.src) {
    showToast("Không có ảnh để tải về!", "error");
    return;
  }
  const filename = State.currentPreviewFilename || "thong-bao-chua-ve-kho.png";
  if (State.currentPreviewImageBlob) {
    const url = URL.createObjectURL(State.currentPreviewImageBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const link = document.createElement("a");
    link.href = DOM.previewImgElement.src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  showToast("Đang tải ảnh về máy...", "success");
}

// Sao chép ảnh xem trước vào clipboard
async function copyPreviewImageToClipboard() {
  if (!State.currentPreviewImageBlob) {
    showToast("Không có dữ liệu ảnh để sao chép!", "error");
    return;
  }
  const ok = await copyImageBlobToClipboard(State.currentPreviewImageBlob);
  if (ok) {
    showToast("Đã sao chép ảnh! Bạn có thể dán (Ctrl+V) trực tiếp vào Zalo.", "success");
  } else {
    showToast("Trình duyệt không hỗ trợ sao chép ảnh trực tiếp, vui lòng bấm 'Tải Ảnh Về Máy'!", "warning");
  }
}

// Sao chép nội dung văn bản xem trước vào clipboard
async function copyPreviewTextToClipboard() {
  if (!State.currentPreviewText) {
    showToast("Không có nội dung văn bản!", "error");
    return;
  }
  const ok = await copyToClipboard(State.currentPreviewText);
  if (ok) {
    showToast("Đã sao chép nội dung văn bản gửi Zalo!", "success");
  } else {
    prompt("Sao chép nội dung gửi Zalo:", State.currentPreviewText);
  }
}

// ==============================================================================
// 8. XUẤT TOÀN BỘ ĐƠN RA FILE EXCEL
// ==============================================================================
function exportOrdersToExcel() {
  if (State.currentUser.role !== "admin") {
    showToast("Chức năng Xuất Excel đơn chỉ dành cho Quản trị viên (Admin)!", "warning");
    openModal(DOM.modalLoginAdmin);
    return;
  }
  if (!State.orders.length) {
    showToast("Chưa có đơn đổi lỗi nào để xuất Excel!", "warning");
    return;
  }

  const exportRows = [
    [
      "MÃ PHIẾU",
      "NGÀY GIỜ TIẾP NHẬN",
      "SỐ ĐIỆN THOẠI KHÁCH",
      "HỌ TÊN KHÁCH HÀNG",
      "MÃ SẢN PHẨM",
      "TÊN SẢN PHẨM ĐỔI LỖI",
      "GHI CHÚ",
      "NHÂN VIÊN TẠO PHIẾU",
      "MÃ NV TẠO",
      "NHÂN VIÊN NHẬN HÀNG LỖI",
      "THỜI GIAN NHẬN KHO",
      "TRẠNG THÁI VỀ KHO",
      "VỊ TRÍ LƯU KHO",
      "GHI CHÚ KHO"
    ]
  ];

  const sortedOrders = [...State.orders].sort((a, b) => {
    const timeA = getOrderTimestamp(a);
    const timeB = getOrderTimestamp(b);
    if (timeB !== timeA) return timeB - timeA;
    return (b.orderCode || "").localeCompare(a.orderCode || "");
  });

  sortedOrders.forEach(o => {
    const rawWhTime = o.warehouseDisplayTime || (o.warehouseTime ? formatDateTime(o.warehouseTime) : "");
    exportRows.push([
      o.orderCode,
      o.displayTime || formatDateTime(o.createdAt),
      o.customerPhone,
      formatTitleCase(o.customerName),
      o.productCode,
      o.productName,
      o.notes || "",
      o.staffName,
      o.staffCode,
      o.warehouseConfirmedBy || (o.warehouseStatus === "DA_VE_KHO" ? "Đã nhận kho" : "Chưa nhận kho"),
      rawWhTime,
      o.warehouseStatus === "DA_VE_KHO" ? "ĐÃ VỀ KHO" : "CHƯA VỀ KHO",
      o.warehouseLocation || "",
      o.warehouseNotes || ""
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(wb, ws, "Don_Doi_Loi");
  
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  XLSX.writeFile(wb, `Danh_Sach_Don_Doi_Loi_DMX_${todayStr}.xlsx`);
  showToast("✅ Đã xuất thành công file Excel đơn đổi lỗi!", "success");
}

// ==============================================================================
// 9. RENDER BẢNG & BỘ LỌC TÌM KIẾM
// ==============================================================================
function updateKPIs() {
  const total = State.orders.length;
  const pending = State.orders.filter(o => o.warehouseStatus !== "DA_VE_KHO").length;
  const received = State.orders.filter(o => o.warehouseStatus === "DA_VE_KHO").length;

  DOM.statTotalOrders.textContent = total;
  DOM.statPendingOrders.textContent = pending;
  DOM.statReceivedOrders.textContent = received;
  DOM.statTotalProducts.textContent = State.products.length;

  DOM.countAll.textContent = total;
  DOM.countPending.textContent = pending;
  DOM.countReceived.textContent = received;
}

function renderStaffFilterOptions() {
  DOM.filterStaffSelect.innerHTML = `<option value="ALL">-- Tất cả nhân viên --</option>` +
    State.staffList.map(st => `<option value="${st.code}">${st.code} - ${st.name}</option>`).join("");
}

function getFilteredOrders() {
  const filtered = State.orders.filter(o => {
    // 1. Status Filter
    if (State.filterStatus === "CHUA_VE_KHO" && o.warehouseStatus === "DA_VE_KHO") return false;
    if (State.filterStatus === "DA_VE_KHO" && o.warehouseStatus !== "DA_VE_KHO") return false;

    // 2. Staff Filter
    if (State.filterStaff !== "ALL" && o.staffCode !== State.filterStaff) return false;

    // 3. Date Filter (YYYY-MM-DD)
    if (State.filterDate) {
      const orderDateStr = new Date(o.createdAt).toISOString().slice(0, 10);
      if (orderDateStr !== State.filterDate) return false;
    }

    // 4. Search Query
    if (State.searchQuery) {
      const q = removeVietnameseTones(State.searchQuery.toLowerCase());
      const matchCode = (o.orderCode || "").toLowerCase().includes(q);
      const matchPhone = (o.customerPhone || "").includes(q);
      const matchName = removeVietnameseTones((o.customerName || "").toLowerCase()).includes(q);
      const matchProd = removeVietnameseTones((o.productName || "").toLowerCase()).includes(q);
      const matchSerial = (o.serial || "").toLowerCase().includes(q);
      const matchStaff = removeVietnameseTones((o.staffName || "").toLowerCase()).includes(q);
      const matchWhStaff = removeVietnameseTones((o.warehouseConfirmedBy || "").toLowerCase()).includes(q);

      if (!matchCode && !matchPhone && !matchName && !matchProd && !matchSerial && !matchStaff && !matchWhStaff) {
        return false;
      }
    }

    return true;
  });

  // Luôn sắp xếp theo Ngày tạo gần nhất (mới nhất) lên trên cùng
  filtered.sort((a, b) => {
    const timeA = getOrderTimestamp(a);
    const timeB = getOrderTimestamp(b);
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return (b.orderCode || "").localeCompare(a.orderCode || "");
  });

  return filtered;
}

function renderOrdersTable() {
  DOM.tableLoading.style.display = "none";
  const filtered = getFilteredOrders();

  if (!filtered.length) {
    DOM.ordersTableBody.innerHTML = "";
    DOM.emptyState.style.display = "block";
    return;
  }

  DOM.emptyState.style.display = "none";

  DOM.ordersTableBody.innerHTML = filtered.map((o, idx) => {
    const isReceived = (o.warehouseStatus === "DA_VE_KHO");
    const rawCreateTime = o.displayTime || formatDateTime(o.createdAt);
    let createTimeTxt = "";
    let createDateTxt = "";
    if (rawCreateTime) {
      const parts = rawCreateTime.trim().split(" ");
      if (parts.length >= 2) {
        createTimeTxt = parts[0];
        createDateTxt = parts.slice(1).join(" ");
      } else {
        createTimeTxt = rawCreateTime;
        createDateTxt = "";
      }
    }

    const rawWhTime = o.warehouseDisplayTime || (o.warehouseTime ? formatDateTime(o.warehouseTime) : "");
    let whTimeTxt = "";
    let whDateTxt = "";
    if (rawWhTime) {
      const parts = rawWhTime.trim().split(" ");
      if (parts.length >= 2) {
        whTimeTxt = parts[0];
        whDateTxt = parts.slice(1).join(" ");
      } else {
        whTimeTxt = rawWhTime;
        whDateTxt = "";
      }
    }
    
    return `
      <tr class="${isReceived ? 'row-received' : 'row-pending'}">
        <td style="color: var(--text-muted);">${idx + 1}</td>
        
        <!-- Ngày tạo -->
        <td>
          <div class="created-time-box" title="Mã phiếu: ${escapeHtml(o.orderCode)} - Tạo lúc: ${escapeHtml(rawCreateTime)}">
            <span class="created-time-val">${escapeHtml(createTimeTxt)}</span>
            ${createDateTxt ? `<span class="created-date-val">${escapeHtml(createDateTxt)}</span>` : ''}
          </div>
        </td>

        <!-- Khách hàng -->
        <td>
          <div class="customer-info-box">
            <strong>${escapeHtml(formatTitleCase(o.customerName))}</strong>
            <a href="tel:${escapeHtml(o.customerPhone)}" class="customer-phone-link">
              📞 ${escapeHtml(o.customerPhone)}
            </a>
          </div>
        </td>

        <!-- Sản phẩm đổi lỗi -->
        <td>
          <div class="product-cell-box">
            <span class="product-name-txt">${escapeHtml(o.productName)}</span>
            ${o.productCode && o.productCode !== 'KHAC' ? `<span class="product-meta-sub">Mã SP: <code class="font-mono">${escapeHtml(o.productCode)}</code></span>` : ''}
          </div>
        </td>

        <!-- Ghi chú -->
        <td>
          <div class="defect-summary-box">
            ${o.notes ? `<div class="defect-desc-txt" style="color: var(--text-main); font-weight: 500;">${escapeHtml(o.notes)}</div>` : '<span style="color: var(--text-muted); font-size: 12px; font-style: italic;">(Không có)</span>'}
          </div>
        </td>

        <!-- Nhân viên tạo phiếu -->
        <td>
          <div class="staff-tag-badge" title="Nhân viên lập phiếu tiếp nhận tại quầy">
            <span>👤</span>
            <span>${escapeHtml(o.staffName)} ${o.staffCode ? `(${escapeHtml(o.staffCode)})` : ''}</span>
          </div>
        </td>

        <!-- Nhân viên nhận hàng lỗi -->
        <td>
          ${o.warehouseConfirmedBy 
            ? `<div class="staff-tag-badge staff-wh-badge" title="Thủ kho đã nhận hàng: ${escapeHtml(o.warehouseDisplayTime || '')}">
                <span>🏢</span>
                <span>${escapeHtml(o.warehouseConfirmedBy)}</span>
               </div>`
            : `<span class="staff-wh-pending-tag" title="Chưa nhập kho">
                ⏳ Chưa nhận
               </span>`
          }
        </td>

        <!-- Thời gian nhận -->
        <td>
          ${rawWhTime 
            ? `<div class="wh-time-box" title="Thời gian xác nhận hàng về kho: ${escapeHtml(rawWhTime)}">
                <span class="wh-time-val">${escapeHtml(whTimeTxt)}</span>
                ${whDateTxt ? `<span class="wh-date-val">${escapeHtml(whDateTxt)}</span>` : ''}
               </div>`
            : `<span class="wh-time-pending" title="Chưa nhận về kho">Chưa nhận</span>`
          }
        </td>

        <!-- Trạng thái kho -->
        <td style="text-align: center;">
          ${isReceived 
            ? `<span class="status-badge badge-received" title="Đã nhập kho: ${escapeHtml(o.warehouseDisplayTime || '')}">
                ✅ Đã về kho
               </span>`
            : `<span class="status-badge badge-pending" title="Hàng đang để tại quầy siêu thị, chưa chuyển về kho">
                🔴 Chưa về kho
               </span>`
          }
        </td>

        <!-- Thao tác -->
        <td style="text-align: right;">
          <div class="row-actions">
            <!-- Nút xem & in phiếu -->
            <button type="button" class="btn-action btn-view-receipt" data-code="${escapeHtml(o.orderCode)}" title="Xem & In phiếu tiếp nhận đổi lỗi">
              🖨️ In
            </button>

            <!-- Nút sao chép thông tin gửi Zalo -->
            <button type="button" class="btn-action btn-copy-zalo" data-code="${escapeHtml(o.orderCode)}" title="Sao chép SĐT + Tên sản phẩm gửi Zalo (chưa về kho)">
              📋 Sao chép
            </button>

            <!-- Nút xuất ảnh gửi Zalo -->
            <button type="button" class="btn-action btn-export-image" data-code="${escapeHtml(o.orderCode)}" title="Xuất ảnh thông báo chưa về kho gửi Zalo">
              🖼️ Xuất ảnh
            </button>

            <!-- Nút xác nhận về kho nếu chưa về kho -->
            ${!isReceived 
              ? `<button type="button" class="btn-action btn-wh-confirm" data-code="${escapeHtml(o.orderCode)}" title="Xác nhận hàng đã về kho">
                  🏢 Nhận kho
                 </button>`
              : ''
            }

            <!-- Nút xóa (chỉ Admin) -->
            <button type="button" class="btn-action btn-delete admin-only-btn" data-code="${escapeHtml(o.orderCode)}" title="Xóa đơn (Chỉ Admin)">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Attach row event listeners
  DOM.ordersTableBody.querySelectorAll(".btn-view-receipt").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      const order = State.orders.find(o => o.orderCode === code);
      if (order) openReceiptModal(order);
    });
  });

  DOM.ordersTableBody.querySelectorAll(".btn-copy-zalo").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      copyZaloNotice(code);
    });
  });

  DOM.ordersTableBody.querySelectorAll(".btn-export-image").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      exportZaloNoticeImage(code);
    });
  });

  DOM.ordersTableBody.querySelectorAll(".btn-wh-confirm").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      openWarehouseConfirmModal(code);
    });
  });

  DOM.ordersTableBody.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      handleDeleteOrder(code);
    });
  });
}

// ==============================================================================
// 10. SETUP EVENT LISTENERS & MODAL MANAGEMENT
// ==============================================================================
function setupEventListeners() {
  // Theme toggle
  DOM.btnThemeToggle.addEventListener("click", toggleTheme);

  // User badge dropdown
  DOM.btnUserBadge.addEventListener("click", (e) => {
    e.stopPropagation();
    const isShown = (DOM.userDropdownMenu.style.display === "block");
    DOM.userDropdownMenu.style.display = isShown ? "none" : "block";
  });

  document.addEventListener("click", (e) => {
    if (!DOM.userAuthWrap.contains(e.target)) {
      DOM.userDropdownMenu.style.display = "none";
    }
    if (DOM.staffSuggestionsDropdown && !DOM.staffSuggestionsDropdown.contains(e.target)) {
      DOM.staffSuggestionsDropdown.style.display = "none";
    }
    if (DOM.productDropdown && !DOM.productDropdown.contains(e.target)) {
      DOM.productDropdown.style.display = "none";
    }
  });

  DOM.btnMenuLoginStaff.addEventListener("click", () => {
    DOM.userDropdownMenu.style.display = "none";
    DOM.modalLoginStaff.classList.remove("is-gate");
    openModal(DOM.modalLoginStaff);
    DOM.staffSearchInput.value = "";
    handleStaffSearchAutocomplete("");
    DOM.staffSearchInput.focus();
  });

  DOM.btnMenuLoginAdmin.addEventListener("click", () => {
    DOM.userDropdownMenu.style.display = "none";
    DOM.adminPasswordInput.value = "";
    openModal(DOM.modalLoginAdmin);
    DOM.adminPasswordInput.focus();
  });

  DOM.btnMenuLogout.addEventListener("click", logout);

  // Staff search autocomplete & Enter to submit
  DOM.staffSearchInput.addEventListener("input", (e) => {
    handleStaffSearchAutocomplete(e.target.value);
  });
  DOM.staffSearchInput.addEventListener("focus", () => {
    handleStaffSearchAutocomplete(DOM.staffSearchInput.value);
  });
  DOM.staffSearchInput.addEventListener("click", () => {
    handleStaffSearchAutocomplete(DOM.staffSearchInput.value);
  });
  DOM.staffSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cleanQ = removeVietnameseTones((DOM.staffSearchInput.value || "").trim().toLowerCase());
      if (!cleanQ) return;
      const match = State.staffList.find(s => 
        s.code.toLowerCase().includes(cleanQ) || 
        removeVietnameseTones(s.name.toLowerCase()).includes(cleanQ)
      );
      if (match) {
        loginAsStaff(match);
      }
    }
  });

  // Admin login form submit
  DOM.adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pass = DOM.adminPasswordInput.value.trim();
    if (pass === ADMIN_PASSWORD) {
      loginAsAdmin();
    } else {
      showToast("Sai mật khẩu Admin! Vui lòng kiểm tra lại.", "error");
      DOM.adminPasswordInput.value = "";
      DOM.adminPasswordInput.focus();
    }
  });

  // Filter Status Pills
  DOM.filterStatusPills.querySelectorAll(".pill").forEach(pill => {
    pill.addEventListener("click", () => {
      DOM.filterStatusPills.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      State.filterStatus = pill.getAttribute("data-status");
      renderOrdersTable();
    });
  });

  // KPI cards click to filter
  document.getElementById("kpiCardAll").addEventListener("click", () => {
    activatePillByStatus("ALL");
  });
  document.getElementById("kpiCardPending").addEventListener("click", () => {
    activatePillByStatus("CHUA_VE_KHO");
  });
  document.getElementById("kpiCardReceived").addEventListener("click", () => {
    activatePillByStatus("DA_VE_KHO");
  });
  document.getElementById("kpiCardProducts").addEventListener("click", openExcelProductsModal);

  function activatePillByStatus(st) {
    const pill = DOM.filterStatusPills.querySelector(`.pill[data-status="${st}"]`);
    if (pill) pill.click();
  }

  // Search input
  DOM.searchInput.addEventListener("input", (e) => {
    State.searchQuery = e.target.value.trim();
    DOM.btnClearSearch.style.display = State.searchQuery ? "flex" : "none";
    renderOrdersTable();
  });
  DOM.btnClearSearch.addEventListener("click", () => {
    DOM.searchInput.value = "";
    State.searchQuery = "";
    DOM.btnClearSearch.style.display = "none";
    renderOrdersTable();
  });

  // Staff filter dropdown
  DOM.filterStaffSelect.addEventListener("change", (e) => {
    State.filterStaff = e.target.value;
    renderOrdersTable();
  });

  // Date filter
  DOM.filterDateInput.addEventListener("change", (e) => {
    State.filterDate = e.target.value;
    renderOrdersTable();
  });
  DOM.btnResetDateFilter.addEventListener("click", () => {
    const today = new Date().toISOString().slice(0, 10);
    DOM.filterDateInput.value = today;
    State.filterDate = today;
    renderOrdersTable();
  });

  // Modal New Order triggers
  DOM.btnOpenNewOrderModal.addEventListener("click", openNewOrderModal);
  DOM.btnEmptyCreate.addEventListener("click", openNewOrderModal);
  DOM.btnCloseNewOrder.addEventListener("click", () => closeModal(DOM.modalNewOrder));
  DOM.btnCancelNewOrder.addEventListener("click", () => closeModal(DOM.modalNewOrder));
  DOM.newOrderForm.addEventListener("submit", handleNewOrderSubmit);

  DOM.inputCustomerPhone.addEventListener("input", handleCustomerPhoneInput);

  // Tự động viết hoa chữ cái đầu khi nhập Họ tên khách hàng (Title Case)
  if (DOM.inputCustomerName) {
    DOM.inputCustomerName.addEventListener("blur", (e) => {
      e.target.value = cleanAndFormatTitleCase(e.target.value);
    });
    DOM.inputCustomerName.addEventListener("change", (e) => {
      e.target.value = cleanAndFormatTitleCase(e.target.value);
    });
    DOM.inputCustomerName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.target.value = cleanAndFormatTitleCase(e.target.value);
      }
    });
    DOM.inputCustomerName.addEventListener("paste", () => {
      setTimeout(() => {
        DOM.inputCustomerName.value = cleanAndFormatTitleCase(DOM.inputCustomerName.value);
      }, 10);
    });
  }
  DOM.inputProductSearch.addEventListener("input", (e) => {
    handleProductSearchAutocomplete(e.target.value);
  });
  DOM.btnClearSelectedProd.addEventListener("click", clearSelectedProduct);

  // Modal Excel triggers
  DOM.btnOpenExcelModal.addEventListener("click", openExcelProductsModal);
  DOM.btnCloseExcelModal.addEventListener("click", () => closeModal(DOM.modalExcelProducts));
  DOM.btnSelectExcelFile.addEventListener("click", () => DOM.excelFileInput.click());
  DOM.excelFileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleExcelFileSelect(e.target.files[0]);
    }
  });

  // Excel drag and drop
  DOM.excelDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    DOM.excelDropzone.classList.add("dragover");
  });
  DOM.excelDropzone.addEventListener("dragleave", () => {
    DOM.excelDropzone.classList.remove("dragover");
  });
  DOM.excelDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    DOM.excelDropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleExcelFileSelect(e.dataTransfer.files[0]);
    }
  });

  DOM.btnConfirmImportExcel.addEventListener("click", confirmImportExcelProducts);
  DOM.btnDownloadSampleExcel.addEventListener("click", downloadSampleExcel);
  DOM.btnClearAllProducts.addEventListener("click", async () => {
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ danh mục sản phẩm?")) {
      State.products = [];
      await syncProductsToFirebase([]);
      renderCurrentProductsTable();
      updateKPIs();
      showToast("Đã làm trống danh mục sản phẩm", "info");
    }
  });

  // Modal Confirm Warehouse triggers
  DOM.btnCloseWarehouseModal.addEventListener("click", () => closeModal(DOM.modalConfirmWarehouse));
  DOM.btnCancelWarehouseConfirm.addEventListener("click", () => closeModal(DOM.modalConfirmWarehouse));
  DOM.warehouseConfirmForm.addEventListener("submit", handleWarehouseConfirmSubmit);

  // Modal Receipt Print triggers
  DOM.btnCloseReceipt.addEventListener("click", () => closeModal(DOM.modalReceipt));
  DOM.btnPrintReceipt.addEventListener("click", () => {
    window.print();
  });
  if (DOM.btnReceiptCopyZalo) {
    DOM.btnReceiptCopyZalo.addEventListener("click", () => {
      if (State.currentReceiptOrder) {
        copyZaloNotice(State.currentReceiptOrder.orderCode);
      } else {
        showToast("Không tìm thấy thông tin phiếu tiếp nhận!", "warning");
      }
    });
  }
  if (DOM.btnReceiptExportImage) {
    DOM.btnReceiptExportImage.addEventListener("click", () => {
      exportReceiptSlipImage();
    });
  }

  // Modal Image Preview triggers
  if (DOM.btnCloseImagePreview) {
    DOM.btnCloseImagePreview.addEventListener("click", () => closeModal(DOM.modalImagePreview));
  }
  if (DOM.btnCloseImagePreviewFooter) {
    DOM.btnCloseImagePreviewFooter.addEventListener("click", () => closeModal(DOM.modalImagePreview));
  }
  if (DOM.btnDownloadPreviewImage) {
    DOM.btnDownloadPreviewImage.addEventListener("click", downloadPreviewImage);
  }
  if (DOM.btnCopyPreviewImage) {
    DOM.btnCopyPreviewImage.addEventListener("click", copyPreviewImageToClipboard);
  }
  if (DOM.btnCopyPreviewText) {
    DOM.btnCopyPreviewText.addEventListener("click", copyPreviewTextToClipboard);
  }

  // Export orders to Excel
  DOM.btnExportOrdersExcel.addEventListener("click", exportOrdersToExcel);
  if (DOM.btnClearAllOrders) {
    DOM.btnClearAllOrders.addEventListener("click", handleClearAllOrders);
  }

  // Switch giữa Nhân viên và Admin
  if (DOM.btnSwitchToAdminLogin) {
    DOM.btnSwitchToAdminLogin.addEventListener("click", () => {
      closeModal(DOM.modalLoginStaff);
      openModal(DOM.modalLoginAdmin);
      DOM.adminPasswordInput.value = "";
      DOM.adminPasswordInput.focus();
    });
  }
  if (DOM.btnSwitchToStaffLogin) {
    DOM.btnSwitchToStaffLogin.addEventListener("click", () => {
      closeModal(DOM.modalLoginAdmin);
      openModal(DOM.modalLoginStaff);
      DOM.staffSearchInput.focus();
    });
  }

  // Quản lý nhân viên (CRUD Modal triggers)
  if (DOM.btnOpenManageStaffModal) {
    DOM.btnOpenManageStaffModal.addEventListener("click", openManageStaffModal);
  }
  if (DOM.btnMenuManageStaff) {
    DOM.btnMenuManageStaff.addEventListener("click", () => {
      DOM.userDropdownMenu.style.display = "none";
      openManageStaffModal();
    });
  }
  if (DOM.btnOpenStaffManageFromLogin) {
    DOM.btnOpenStaffManageFromLogin.addEventListener("click", () => {
      openManageStaffModal();
    });
  }
  if (DOM.btnCloseManageStaff) {
    DOM.btnCloseManageStaff.addEventListener("click", () => closeModal(DOM.modalManageStaff));
  }
  if (DOM.btnCloseManageStaffFooter) {
    DOM.btnCloseManageStaffFooter.addEventListener("click", () => closeModal(DOM.modalManageStaff));
  }
  if (DOM.btnCancelStaffEdit) {
    DOM.btnCancelStaffEdit.addEventListener("click", resetStaffCrudForm);
  }
  if (DOM.staffCrudForm) {
    DOM.staffCrudForm.addEventListener("submit", handleStaffCrudSubmit);
  }
  if (DOM.btnResetDefaultStaff) {
    DOM.btnResetDefaultStaff.addEventListener("click", handleResetDefaultStaff);
  }
  if (DOM.modalManageStaff) {
    DOM.modalManageStaff.addEventListener("click", (e) => {
      if (e.target === DOM.modalManageStaff) {
        closeModal(DOM.modalManageStaff);
      }
    });
  }

  // Modal Close buttons
  DOM.btnCloseStaffLogin.addEventListener("click", () => {
    if (DOM.modalLoginStaff.classList.contains("is-gate") || State.currentUser.role === "guest") {
      shakeModal(DOM.modalLoginStaff);
      showToast("Vui lòng chọn tài khoản nhân viên của bạn trước khi vào web!", "warning");
      return;
    }
    closeModal(DOM.modalLoginStaff);
  });

  DOM.btnCloseAdminLogin.addEventListener("click", () => {
    window.pendingAdminAction = null;
    closeModal(DOM.modalLoginAdmin);
    if (State.currentUser.role === "guest") {
      openModal(DOM.modalLoginStaff);
    }
  });

  DOM.btnCancelAdminLogin.addEventListener("click", () => {
    window.pendingAdminAction = null;
    closeModal(DOM.modalLoginAdmin);
    if (State.currentUser.role === "guest") {
      openModal(DOM.modalLoginStaff);
    }
  });

  // Chặn click ngoài vùng modal khi chưa chọn nhân viên
  [DOM.modalLoginStaff, DOM.modalLoginAdmin].forEach(modal => {
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal && State.currentUser.role === "guest") {
          shakeModal(modal);
          showToast("Vui lòng chọn nhân viên hoặc đăng nhập Admin để vào web!", "warning");
        }
      });
    }
  });
}

// Modal Helper functions
function openModal(modalEl) {
  if (modalEl) modalEl.style.display = "flex";
}
function closeModal(modalEl) {
  if (modalEl) modalEl.style.display = "none";
}

function shakeModal(modalEl) {
  if (!modalEl) return;
  const card = modalEl.querySelector(".modal-card");
  if (card) {
    card.classList.remove("shake");
    void card.offsetWidth; // trigger reflow
    card.classList.add("shake");
    setTimeout(() => card.classList.remove("shake"), 400);
  }
}

// ==============================================================================
// 11. FIREBASE REALTIME CALLBACKS
// ==============================================================================
function handleFirebaseStatusChange(isOnline, message) {
  if (DOM.firebaseStatusBadge) {
    if (isOnline) {
      DOM.firebaseStatusBadge.classList.add("online");
    } else {
      DOM.firebaseStatusBadge.classList.remove("online");
    }
  }
  if (DOM.firebaseStatusText) {
    DOM.firebaseStatusText.textContent = message;
  }
}

function handleFirebaseOrdersUpdated(ordersList) {
  if (Array.isArray(ordersList)) {
    ordersList.sort((a, b) => {
      const timeA = getOrderTimestamp(a);
      const timeB = getOrderTimestamp(b);
      if (timeB !== timeA) return timeB - timeA;
      return (b.orderCode || "").localeCompare(a.orderCode || "");
    });
  }
  State.orders = ordersList;
  localStorage.setItem(LOCAL_KEYS.ORDERS, JSON.stringify(ordersList));
  fixAdminStaffInOrders();
  updateKPIs();
  renderOrdersTable();
}

function handleFirebaseProductsUpdated(productsList) {
  State.products = productsList;
  localStorage.setItem(LOCAL_KEYS.PRODUCTS, JSON.stringify(productsList));
  updateKPIs();
}

function handleFirebaseStaffUpdated(staffList) {
  if (Array.isArray(staffList) && staffList.length > 0) {
    State.staffList = staffList;
    localStorage.setItem(LOCAL_KEYS.STAFF, JSON.stringify(staffList));
    renderStaffFilterOptions();
    renderStaffChipsInModal();
    if (DOM.modalManageStaff && DOM.modalManageStaff.style.display !== "none") {
      renderStaffManageTable();
    }
  }
}

// ==============================================================================
// 12. UTILITY HELPERS
// ==============================================================================
function showToast(message, type = "success") {
  DOM.toastMessage.textContent = message;
  DOM.toastIcon.textContent = type === "error" ? "❌" : (type === "warning" ? "⚠️" : (type === "info" ? "ℹ️" : "✅"));
  DOM.toastBox.className = "toast-box";
  if (type === "error") DOM.toastBox.classList.add("toast-error");
  else if (type === "success") DOM.toastBox.classList.add("toast-success");

  DOM.toastBox.classList.add("show");
  setTimeout(() => DOM.toastBox.classList.remove("show"), 3600);
}

// Chuẩn hóa và viết hoa chữ cái đầu mỗi từ (Họ tên tiếng Việt chuẩn)
function formatTitleCase(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/(?:^|[\s\/\-_])\S/gu, char => char.toUpperCase());
}

function cleanAndFormatTitleCase(str) {
  if (!str) return "";
  return formatTitleCase(String(str).trim().replace(/\s+/g, " "));
}

function removeVietnameseTones(str) {
  if (!str) return '';
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
  str = str.replace(/\u02C6|\u0306|\u031B/g, "");
  return str.trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function playSuccessSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  } catch(e) {}
}

// ==============================================================================
// 13. MULTI-BRANCH / ĐA KHO SWITCHER & SHARER
// ==============================================================================
function initBranchSwitcher() {
  if (!DOM.btnBranchSwitcher || !DOM.modalBranchSwitcher) return;

  const branchId = (typeof CURRENT_BRANCH !== "undefined") ? CURRENT_BRANCH : "default";
  const isDefault = (typeof IS_DEFAULT_BRANCH !== "undefined") ? IS_DEFAULT_BRANCH : true;
  const branchDisplayName = (typeof getBranchDisplayName === "function")
    ? getBranchDisplayName(branchId)
    : (isDefault ? "Mặc định" : branchId);

  // Cập nhật nhãn trên header badge (Đúng chuẩn yêu cầu: "Kho 10528" hoặc "Kho: Mặc định")
  if (DOM.currentBranchLabel) {
    DOM.currentBranchLabel.textContent = isDefault ? "🏪 Kho: Mặc định" : `🏪 Kho ${branchDisplayName}`;
  }

  // Cập nhật tên kho trong modal
  if (DOM.modalCurrentBranchName) {
    DOM.modalCurrentBranchName.textContent = isDefault 
      ? "Kho: Mặc định (Kho chính)" 
      : `Kho ${branchDisplayName}`;
  }

  // Tạo URL chia sẻ chuẩn
  const currentOrigin = window.location.origin;
  const currentPath = window.location.pathname;
  const cleanBranch = (typeof cleanBranchCode === "function") ? cleanBranchCode(branchId) : branchId;
  const shareUrl = isDefault 
    ? `${currentOrigin}${currentPath}`
    : `${currentOrigin}${currentPath}?kho=${encodeURIComponent(cleanBranch)}`;

  if (DOM.inputShareBranchUrl) {
    DOM.inputShareBranchUrl.value = shareUrl;
  }

  // Tự động làm sạch URL trên thanh địa chỉ nếu đang dính chuỗi domain dài hoặc URL cũ
  try {
    if (window.history && window.history.replaceState && window.location.search) {
      if (window.location.search.includes("https") || window.location.search.length > 25) {
        window.history.replaceState(null, "", shareUrl);
      }
    }
  } catch(e) {}

  // Hàm chuyển đổi kho an toàn và mượt mà
  function switchToBranch(targetId) {
    const clean = (typeof cleanBranchCode === "function") 
      ? cleanBranchCode(targetId) 
      : String(targetId).toLowerCase().replace(/[^a-z0-9_-]/g, "");

    if (!clean || clean === "default") {
      localStorage.setItem("dmx_active_branch", "default");
      window.location.href = `${currentOrigin}${currentPath}`;
    } else {
      localStorage.setItem("dmx_active_branch", clean);
      window.location.href = `${currentOrigin}${currentPath}?kho=${encodeURIComponent(clean)}`;
    }
  }

  // Highlight & Gắn sự kiện click chuyển kho cho từng pill shortcut
  const pills = [
    { el: DOM.linkKhoDefault, id: "default" },
    { el: DOM.linkKho10528, id: "10528" },
    { el: DOM.linkKho2, id: "2" },
    { el: DOM.linkKho3, id: "3" },
    { el: DOM.linkKhoShopB, id: "shop-b" }
  ];
  pills.forEach(p => {
    if (p.el) {
      if ((isDefault && p.id === "default") || (!isDefault && cleanBranch === p.id)) {
        p.el.classList.add("active");
        p.el.style.borderColor = "var(--primary)";
        p.el.style.background = "rgba(2, 132, 199, 0.12)";
        p.el.style.fontWeight = "700";
      }

      // Xử lý chuyển kho ngay lập tức khi bấm vào nút lối tắt
      p.el.addEventListener("click", (e) => {
        e.preventDefault();
        switchToBranch(p.id);
      });
    }
  });

  // Hàm mở modal chia sẻ & chuyển đổi kho - BẢO VỆ PHÂN QUYỀN CHỈ ADMIN
  function openBranchSwitcherModal() {
    if (!State.currentUser || State.currentUser.role !== "admin") {
      window.pendingAdminAction = "openBranchSwitcher";
      showToast("🔒 Vui lòng nhập mật khẩu Admin để mở Quản lý & Nhân bản kho!", "info");
      if (DOM.modalLoginAdmin) {
        if (DOM.adminPasswordInput) DOM.adminPasswordInput.value = "";
        openModal(DOM.modalLoginAdmin);
        if (DOM.adminPasswordInput) DOM.adminPasswordInput.focus();
      }
      return;
    }
    openModal(DOM.modalBranchSwitcher);
  }

  // Mở modal khi bấm badge kho ở header (chỉ cho phép khi là Admin)
  DOM.btnBranchSwitcher.addEventListener("click", () => {
    openBranchSwitcherModal();
  });

  // Mở modal từ nút thanh công cụ (Toolbar)
  if (DOM.btnOpenBranchModalToolbar) {
    DOM.btnOpenBranchModalToolbar.addEventListener("click", () => {
      openBranchSwitcherModal();
    });
  }

  // Mở modal từ menu dropdown cá nhân
  if (DOM.btnMenuBranchSwitcher) {
    DOM.btnMenuBranchSwitcher.addEventListener("click", () => {
      DOM.userDropdownMenu.style.display = "none";
      openBranchSwitcherModal();
    });
  }

  // Đóng modal
  if (DOM.btnCloseBranchModal) {
    DOM.btnCloseBranchModal.addEventListener("click", () => {
      closeModal(DOM.modalBranchSwitcher);
    });
  }
  if (DOM.btnCloseBranchModalFooter) {
    DOM.btnCloseBranchModalFooter.addEventListener("click", () => {
      closeModal(DOM.modalBranchSwitcher);
    });
  }
  DOM.modalBranchSwitcher.addEventListener("click", (e) => {
    if (e.target === DOM.modalBranchSwitcher) {
      closeModal(DOM.modalBranchSwitcher);
    }
  });

  // Sao chép link kho chia sẻ
  if (DOM.btnCopyShareBranchUrl && DOM.inputShareBranchUrl) {
    DOM.btnCopyShareBranchUrl.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(DOM.inputShareBranchUrl.value);
        } else {
          DOM.inputShareBranchUrl.select();
          document.execCommand("copy");
        }
        playSuccessSound();
        showToast("📋 Đã sao chép link kho! Gửi link này để người khác sử dụng dữ liệu kho riêng.", "success");
      } catch (err) {
        DOM.inputShareBranchUrl.select();
        showToast("Vui lòng nhấn Ctrl+C (hoặc Cmd+C) để chép link!", "info");
      }
    });
  }

  // Điều hướng sang kho mới từ ô nhập
  function navigateToNewBranch() {
    const rawInput = DOM.inputNewBranchCode ? DOM.inputNewBranchCode.value.trim() : "";
    if (!rawInput) {
      showToast("Vui lòng nhập tên hoặc mã kho muốn mở (VD: 10528)!", "warning");
      if (DOM.inputNewBranchCode) DOM.inputNewBranchCode.focus();
      return;
    }
    switchToBranch(rawInput);
  }

  if (DOM.btnGoToBranch) {
    DOM.btnGoToBranch.addEventListener("click", navigateToNewBranch);
  }
  if (DOM.inputNewBranchCode) {
    DOM.inputNewBranchCode.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        navigateToNewBranch();
      }
    });
  }
}

