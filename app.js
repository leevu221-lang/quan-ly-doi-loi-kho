/**
 * QUẢN LÝ HÀNG HOÁ NHẬP ĐỔI LỖI & XÁC NHẬN KHO - THỢ ĐIỆN MÁY XANH
 * Business Logic, Authentication, Excel Importer & Cloud Firestore Realtime Sync
 */

// ==============================================================================
// 1. DỮ LIỆU CỐ ĐỊNH & GLOBAL STATE
// ==============================================================================

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
  activeOrderToConfirm: null
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
  initUserSession();
  setupEventListeners();
  renderStaffFilterOptions();
  renderStaffChipsInModal();
  updateKPIs();
  renderOrdersTable();

  // Khởi động kết nối đồng bộ Firebase
  initFirebaseService(
    handleFirebaseStatusChange,
    handleFirebaseOrdersUpdated,
    handleFirebaseProductsUpdated
  );
});

function cacheDOMElements() {
  DOM.btnThemeToggle = document.getElementById("btnThemeToggle");
  DOM.firebaseStatusBadge = document.getElementById("firebaseStatusBadge");
  DOM.firebaseStatusText = document.getElementById("firebaseStatusText");
  
  // User Auth
  DOM.btnUserBadge = document.getElementById("btnUserBadge");
  DOM.userBadgeIcon = document.getElementById("userBadgeIcon");
  DOM.userBadgeRole = document.getElementById("userBadgeRole");
  DOM.userBadgeName = document.getElementById("userBadgeName");
  DOM.userDropdownMenu = document.getElementById("userDropdownMenu");
  DOM.btnMenuLoginStaff = document.getElementById("btnMenuLoginStaff");
  DOM.btnMenuLoginAdmin = document.getElementById("btnMenuLoginAdmin");
  DOM.btnMenuLogout = document.getElementById("btnMenuLogout");
  DOM.dropdownDividerLogout = document.getElementById("dropdownDividerLogout");

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

  // Modal Login Staff
  DOM.modalLoginStaff = document.getElementById("modalLoginStaff");
  DOM.btnCloseStaffLogin = document.getElementById("btnCloseStaffLogin");
  DOM.staffSearchInput = document.getElementById("staffSearchInput");
  DOM.staffSuggestionsDropdown = document.getElementById("staffSuggestionsDropdown");
  DOM.staffChipsList = document.getElementById("staffChipsList");

  // Modal Login Admin
  DOM.modalLoginAdmin = document.getElementById("modalLoginAdmin");
  DOM.btnCloseAdminLogin = document.getElementById("btnCloseAdminLogin");
  DOM.btnCancelAdminLogin = document.getElementById("btnCancelAdminLogin");
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
  DOM.inputSerial = document.getElementById("inputSerial");
  DOM.selectResolution = document.getElementById("selectResolution");
  DOM.inputDefectReason = document.getElementById("inputDefectReason");
  DOM.quickDefectChips = document.getElementById("quickDefectChips");
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
  // Load products
  const storedProducts = localStorage.getItem("dmx_doi_loi_products");
  if (storedProducts) {
    try {
      State.products = JSON.parse(storedProducts);
    } catch(e) {
      State.products = [...DEFAULT_PRODUCTS];
    }
  } else {
    State.products = [...DEFAULT_PRODUCTS];
    localStorage.setItem("dmx_doi_loi_products", JSON.stringify(State.products));
  }

  // Load orders
  const storedOrders = localStorage.getItem("dmx_doi_loi_orders");
  if (storedOrders) {
    try {
      State.orders = JSON.parse(storedOrders);
    } catch(e) {
      State.orders = [];
    }
  }
}

function initUserSession() {
  const savedSession = localStorage.getItem("dmx_doi_loi_auth");
  if (savedSession) {
    try {
      State.currentUser = JSON.parse(savedSession);
    } catch(e) {
      State.currentUser = { role: "guest", code: "", name: "" };
    }
  }
  updateUserBadgeUI();
}

// ==============================================================================
// 3. AUTHENTICATION (NHÂN VIÊN: AUTOCOMPLETE KHÔNG PASS | ADMIN: PASS 43751)
// ==============================================================================
function updateUserBadgeUI() {
  const u = State.currentUser;
  DOM.btnUserBadge.className = "btn-user-badge";

  if (u.role === "admin") {
    DOM.btnUserBadge.classList.add("role-admin");
    DOM.userBadgeIcon.textContent = "🛡️";
    DOM.userBadgeRole.textContent = "Quản trị viên";
    DOM.userBadgeName.textContent = "Admin (43751)";
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
    DOM.userBadgeRole.textContent = "Chưa đăng nhập";
    DOM.userBadgeName.textContent = "Bấm để chọn nhân viên";
    DOM.btnMenuLogout.style.display = "none";
    DOM.dropdownDividerLogout.style.display = "none";
    document.body.classList.remove("is-admin");
  }
}

function loginAsStaff(staff) {
  State.currentUser = {
    role: "staff",
    code: staff.code,
    name: staff.name
  };
  localStorage.setItem("dmx_doi_loi_auth", JSON.stringify(State.currentUser));
  updateUserBadgeUI();
  closeModal(DOM.modalLoginStaff);
  DOM.userDropdownMenu.style.display = "none";
  showToast(`Chào bạn, ${staff.name} (${staff.code})! Đăng nhập thành công.`, "success");
}

function loginAsAdmin() {
  State.currentUser = {
    role: "admin",
    code: "ADMIN",
    name: "Quản Trị Viên (Admin)"
  };
  localStorage.setItem("dmx_doi_loi_auth", JSON.stringify(State.currentUser));
  updateUserBadgeUI();
  closeModal(DOM.modalLoginAdmin);
  DOM.userDropdownMenu.style.display = "none";
  showToast("Đăng nhập quyền Admin thành công!", "success");
}

function logout() {
  State.currentUser = { role: "guest", code: "", name: "" };
  localStorage.removeItem("dmx_doi_loi_auth");
  updateUserBadgeUI();
  DOM.userDropdownMenu.style.display = "none";
  showToast("Đã đăng xuất tài khoản", "info");
}

// Render 10 chip nhân viên để chọn 1-chạm trong modal đăng nhập
function renderStaffChipsInModal() {
  DOM.staffChipsList.innerHTML = State.staffList.map(st => `
    <button type="button" class="staff-chip-btn" data-code="${st.code}">
      <span class="staff-chip-avatar">${st.name.charAt(0)}</span>
      <div>
        <span class="staff-chip-user">${st.code}</span>
        <span class="staff-chip-name">${st.name}</span>
      </div>
    </button>
  `).join("");

  DOM.staffChipsList.querySelectorAll(".staff-chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.getAttribute("data-code");
      const found = State.staffList.find(s => s.code === code);
      if (found) loginAsStaff(found);
    });
  });
}

// Tìm kiếm autocomplete nhân viên (không cần password)
function handleStaffSearchAutocomplete(query) {
  const cleanQ = removeVietnameseTones((query || "").trim().toLowerCase());
  if (!cleanQ) {
    DOM.staffSuggestionsDropdown.style.display = "none";
    return;
  }

  const matches = State.staffList.filter(s => {
    const codeMatch = s.code.toLowerCase().includes(cleanQ);
    const nameMatch = removeVietnameseTones(s.name.toLowerCase()).includes(cleanQ);
    return codeMatch || nameMatch;
  });

  if (!matches.length) {
    DOM.staffSuggestionsDropdown.innerHTML = `<div class="dropdown-option" style="color: var(--text-muted);">Không tìm thấy nhân viên "${query}"</div>`;
    DOM.staffSuggestionsDropdown.style.display = "block";
    return;
  }

  DOM.staffSuggestionsDropdown.innerHTML = matches.map(st => `
    <div class="dropdown-option" data-code="${st.code}">
      <div>
        <div class="opt-title">${st.name}</div>
        <div class="opt-sub">Mã nhân viên: <strong>${st.code}</strong></div>
      </div>
      <span class="opt-badge">Đăng nhập</span>
    </div>
  `).join("");

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
  
  if (State.currentUser.role === "admin") {
    DOM.fieldOrderStaff.textContent = "Admin - Quản trị viên";
  } else {
    DOM.fieldOrderStaff.textContent = `${State.currentUser.code} - ${State.currentUser.name}`;
  }

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
  const customerName = DOM.inputCustomerName.value.trim();
  const productName = State.selectedProduct 
    ? State.selectedProduct.name 
    : DOM.inputProductSearch.value.trim();
  const productCode = State.selectedProduct 
    ? State.selectedProduct.code 
    : "KHAC";
  const serial = DOM.inputSerial.value.trim();
  const resolution = DOM.selectResolution.value;
  const defectReason = DOM.inputDefectReason.value.trim();
  const notes = DOM.inputNotes.value.trim();

  if (!phone || !customerName || !productName || !defectReason) {
    showToast("Vui lòng điền đầy đủ các thông tin bắt buộc!", "error");
    return;
  }

  // Thu thập phụ kiện
  const accessories = [];
  DOM.newOrderForm.querySelectorAll('input[name="accessory"]:checked').forEach(cb => {
    accessories.push(cb.value);
  });

  const orderCode = DOM.fieldOrderCode.textContent;
  const now = new Date();

  const staffCode = State.currentUser.code || "38834";
  const staffName = State.currentUser.name || "Nhân viên";

  const newOrder = {
    orderCode: orderCode,
    createdAt: now.toISOString(),
    displayTime: formatDateTime(now),
    customerPhone: phone,
    customerName: customerName,
    productCode: productCode,
    productName: productName,
    serial: serial,
    resolution: resolution,
    defectReason: defectReason,
    accessories: accessories,
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

  // Tự động mở xem trước phiếu in tiếp nhận
  openReceiptModal(newOrder);
}

// Tra cứu tên khách hàng cũ khi gõ SĐT
function handleCustomerPhoneInput(e) {
  const phone = e.target.value.trim();
  if (phone.length >= 10) {
    const prevOrder = State.orders.find(o => o.customerPhone === phone);
    if (prevOrder && !DOM.inputCustomerName.value.trim()) {
      DOM.inputCustomerName.value = prevOrder.customerName;
      showToast(`Tìm thấy khách quen: ${prevOrder.customerName}`, "info");
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
      <span class="val">${escapeHtml(order.customerName)} (${escapeHtml(order.customerPhone)})</span>
    </div>
    <div class="confirm-summary-row">
      <span class="label">Nhân viên tiếp nhận:</span>
      <span class="val">${escapeHtml(order.staffName)}</span>
    </div>
    <div class="confirm-summary-row">
      <span class="label">Hiện tại:</span>
      <span class="val text-amber font-mono">⚠️ CHƯA VỀ KHO (Tại quầy)</span>
    </div>
  `;

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
    showToast("Chỉ tài khoản Admin (mật khẩu 43751) mới có quyền xóa đơn!", "error");
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

// ==============================================================================
// 6. QUẢN LÝ DANH MỤC SẢN PHẨM BẰNG EXCEL (SHEETJS)
// ==============================================================================
let tempParsedExcelProducts = [];

function openExcelProductsModal() {
  if (State.currentUser.role !== "admin") {
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

      // Nhận diện header cột
      const headerRow = jsonRows[0].map(h => String(h || '').trim().toLowerCase());
      let colCode = headerRow.findIndex(h => h.includes('mã') || h.includes('code') || h.includes('sku') || h.includes('id'));
      let colName = headerRow.findIndex(h => h.includes('tên') || h.includes('name') || h.includes('sản phẩm') || h.includes('san pham'));
      let colCat = headerRow.findIndex(h => h.includes('ngành') || h.includes('nhóm') || h.includes('loại') || h.includes('category'));

      // Mặc định nếu không tìm thấy tên cột
      if (colCode === -1 && jsonRows[0].length >= 1) colCode = 0;
      if (colName === -1 && jsonRows[0].length >= 2) colName = 1;
      if (colCat === -1 && jsonRows[0].length >= 3) colCat = 2;

      const parsed = [];
      for (let i = 1; i < jsonRows.length; i++) {
        const row = jsonRows[i];
        if (!row || !row.length) continue;

        let code = colCode !== -1 ? String(row[colCode] || '').trim() : '';
        let name = colName !== -1 ? String(row[colName] || '').trim() : '';
        let cat = colCat !== -1 ? String(row[colCat] || '').trim() : 'Tổng hợp';

        if (!name && code) name = code;
        if (!code && name) code = `SP${i}`;

        if (name) {
          parsed.push({
            code: code || `SP-${Date.now()}-${i}`,
            name: name,
            category: cat || 'Điện máy'
          });
        }
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

  document.getElementById("printOrderCode").textContent = order.orderCode;
  document.getElementById("printOrderTime").textContent = order.displayTime || formatDateTime(order.createdAt);
  document.getElementById("printStaffName").textContent = `${order.staffName} (${order.staffCode})`;
  document.getElementById("printCustomerName").textContent = order.customerName;
  document.getElementById("printCustomerPhone").textContent = order.customerPhone;
  document.getElementById("printProductName").textContent = order.productName;
  document.getElementById("printProductCode").textContent = `Mã SP: ${order.productCode}`;
  document.getElementById("printSerial").textContent = order.serial || "(Không có)";
  document.getElementById("printDefectReason").textContent = order.defectReason;
  document.getElementById("printAccessories").textContent = (order.accessories && order.accessories.length) ? order.accessories.join(", ") : "Chỉ thân máy";
  document.getElementById("printResolution").textContent = order.resolution || "Đổi mới sản phẩm";

  const whStatusTxt = order.warehouseStatus === "DA_VE_KHO" 
    ? `✅ ĐÃ VỀ KHO (${order.warehouseDisplayTime || formatDateTime(order.warehouseTime)})` 
    : "⚠️ CHƯA VỀ KHO (Đang giữ tại quầy)";
  document.getElementById("printWarehouseStatus").textContent = whStatusTxt;

  document.getElementById("printSigCustomer").textContent = order.customerName;
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
// 8. XUẤT TOÀN BỘ ĐƠN RA FILE EXCEL
// ==============================================================================
function exportOrdersToExcel() {
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
      "TÊN SẢN PHẨM",
      "SỐ SERIAL/IMEI",
      "TRIỆU CHỨNG LỖI",
      "PHỤ KIỆN KÈM THEO",
      "HÌNH THỨC XỬ LÝ",
      "NHÂN VIÊN TIẾP NHẬN",
      "MÃ NHÂN VIÊN",
      "TRẠNG THÁI VỀ KHO",
      "NGÀY GIỜ VỀ KHO",
      "NGƯỜI XÁC NHẬN KHO",
      "VỊ TRÍ LƯU KHO",
      "GHI CHÚ KHO"
    ]
  ];

  State.orders.forEach(o => {
    exportRows.push([
      o.orderCode,
      o.displayTime || formatDateTime(o.createdAt),
      o.customerPhone,
      o.customerName,
      o.productCode,
      o.productName,
      o.serial || "",
      o.defectReason,
      (o.accessories || []).join(", "),
      o.resolution,
      o.staffName,
      o.staffCode,
      o.warehouseStatus === "DA_VE_KHO" ? "ĐÃ VỀ KHO" : "CHƯA VỀ KHO",
      o.warehouseDisplayTime || (o.warehouseTime ? formatDateTime(o.warehouseTime) : ""),
      o.warehouseConfirmedBy || "",
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
  return State.orders.filter(o => {
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

      if (!matchCode && !matchPhone && !matchName && !matchProd && !matchSerial && !matchStaff) {
        return false;
      }
    }

    return true;
  });
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
    
    return `
      <tr class="${isReceived ? 'row-received' : 'row-pending'}">
        <td style="color: var(--text-muted);">${idx + 1}</td>
        
        <!-- Mã phiếu & Thời gian -->
        <td>
          <div class="order-code-box">
            <span class="order-code">${escapeHtml(o.orderCode)}</span>
            <span class="order-time">${escapeHtml(o.displayTime || formatDateTime(o.createdAt))}</span>
          </div>
        </td>

        <!-- Khách hàng -->
        <td>
          <div class="customer-info-box">
            <strong>${escapeHtml(o.customerName)}</strong>
            <a href="tel:${escapeHtml(o.customerPhone)}" class="customer-phone-link">
              📞 ${escapeHtml(o.customerPhone)}
            </a>
          </div>
        </td>

        <!-- Sản phẩm đổi lỗi -->
        <td>
          <div class="product-cell-box">
            <span class="product-name-txt">${escapeHtml(o.productName)}</span>
            <span class="product-meta-sub">
              ${o.productCode !== 'KHAC' ? `Mã: <code class="font-mono">${escapeHtml(o.productCode)}</code> • ` : ''}
              ${o.serial ? `Serial: <span class="font-mono">${escapeHtml(o.serial)}</span> • ` : ''}
              <span class="text-primary">${escapeHtml(o.resolution || 'Đổi mới')}</span>
            </span>
          </div>
        </td>

        <!-- Tình trạng lỗi -->
        <td>
          <div class="defect-summary-box">
            <span class="defect-reason-badge">${escapeHtml(o.defectReason)}</span>
            ${o.notes ? `<div class="defect-desc-txt">${escapeHtml(o.notes)}</div>` : ''}
          </div>
        </td>

        <!-- Nhân viên tiếp nhận -->
        <td>
          <div class="staff-tag-badge">
            <span>👤</span>
            <span>${escapeHtml(o.staffName)} (${escapeHtml(o.staffCode)})</span>
          </div>
        </td>

        <!-- Trạng thái kho -->
        <td style="text-align: center;">
          ${isReceived 
            ? `<span class="status-badge badge-received" title="Đã nhập kho: ${escapeHtml(o.warehouseDisplayTime || '')} - Người nhận: ${escapeHtml(o.warehouseConfirmedBy || '')}">
                ✅ Đã về kho
               </span>`
            : `<span class="status-badge badge-pending" title="Hàng đang để tại quầy siêu thị, chưa chuyển về kho">
                ⚠️ Chưa về kho
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
    openModal(DOM.modalLoginStaff);
    DOM.staffSearchInput.focus();
  });

  DOM.btnMenuLoginAdmin.addEventListener("click", () => {
    DOM.userDropdownMenu.style.display = "none";
    DOM.adminPasswordInput.value = "";
    openModal(DOM.modalLoginAdmin);
    DOM.adminPasswordInput.focus();
  });

  DOM.btnMenuLogout.addEventListener("click", logout);

  // Staff search autocomplete
  DOM.staffSearchInput.addEventListener("input", (e) => {
    handleStaffSearchAutocomplete(e.target.value);
  });

  // Admin login form submit
  DOM.adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pass = DOM.adminPasswordInput.value.trim();
    if (pass === ADMIN_PASSWORD) {
      loginAsAdmin();
    } else {
      showToast("Sai mật khẩu Admin! (Mật khẩu chuẩn: 43751)", "error");
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
  DOM.inputProductSearch.addEventListener("input", (e) => {
    handleProductSearchAutocomplete(e.target.value);
  });
  DOM.btnClearSelectedProd.addEventListener("click", clearSelectedProduct);

  // Quick defect chips
  DOM.quickDefectChips.querySelectorAll(".chip-sm").forEach(chip => {
    chip.addEventListener("click", () => {
      const text = chip.getAttribute("data-text");
      const cur = DOM.inputDefectReason.value.trim();
      if (!cur) {
        DOM.inputDefectReason.value = text;
      } else if (!cur.includes(text)) {
        DOM.inputDefectReason.value = cur + "; " + text;
      }
      DOM.inputDefectReason.focus();
    });
  });

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

  // Export orders to Excel
  DOM.btnExportOrdersExcel.addEventListener("click", exportOrdersToExcel);

  // Modal Close buttons
  DOM.btnCloseStaffLogin.addEventListener("click", () => closeModal(DOM.modalLoginStaff));
  DOM.btnCloseAdminLogin.addEventListener("click", () => closeModal(DOM.modalLoginAdmin));
  DOM.btnCancelAdminLogin.addEventListener("click", () => closeModal(DOM.modalLoginAdmin));
}

// Modal Helper functions
function openModal(modalEl) {
  if (modalEl) modalEl.style.display = "flex";
}
function closeModal(modalEl) {
  if (modalEl) modalEl.style.display = "none";
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
  State.orders = ordersList;
  localStorage.setItem('dmx_doi_loi_orders', JSON.stringify(ordersList));
  updateKPIs();
  renderOrdersTable();
}

function handleFirebaseProductsUpdated(productsList) {
  State.products = productsList;
  localStorage.setItem('dmx_doi_loi_products', JSON.stringify(productsList));
  updateKPIs();
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
