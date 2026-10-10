/**
 * FIREBASE CONFIGURATION & FIRESTORE DATABASE SERVICE
 * Dự án: crm-43751-71e4b
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA_FevBrpgE6R1YVbL321BeuX5J8v0Su00",
  authDomain: "crm-43751-71e4b.firebaseapp.com",
  projectId: "crm-43751-71e4b",
  storageBucket: "crm-43751-71e4b.firebasestorage.app",
  messagingSenderId: "665213457085",
  appId: "1:665213457085:web:976cdbafbf69583d73ddd4"
};

// Chuẩn hóa mã kho/chi nhánh: chỉ lấy tên/mã kho thực sự (VD: 10528, 2, shop-b)
function cleanBranchCode(raw) {
  if (!raw) return "default";
  let s = String(raw).trim();

  // 1. Nếu dán cả đường link URL hoặc URL chứa query parameter ?kho=
  if (s.includes("?") || s.includes("/") || s.includes("http")) {
    try {
      const u = new URL(s.startsWith("http") ? s : `https://dummy.local/${s}`);
      const k = u.searchParams.get("kho") || u.searchParams.get("branch") || u.searchParams.get("store");
      if (k) s = k.trim();
    } catch(e) {}
    const m = s.match(/[?&](?:kho|branch|store)=([^&#\s]+)/i);
    if (m && m[1]) s = decodeURIComponent(m[1]).trim();
  }

  // 2. Xử lý chuỗi URL dính liền do replace trước đó (như httpsleevu221...kho10528)
  if (/quan-?ly-?doi-?loi-?kho/i.test(s) || /https/i.test(s)) {
    const trailing = s.replace(/^.*kho[-_:]*/i, "");
    if (trailing && trailing !== s) {
      s = trailing;
    }
  }

  // 3. Bỏ tiền tố "Kho", "Kho ", "Kho: ", "Kho-" nếu người dùng gõ "Kho 10528"
  s = s.replace(/^kho[\s:_ -]*/i, "");

  // 4. Lọc ký tự hợp lệ (chữ cái, chữ số, gạch ngang, gạch dưới)
  s = s.toLowerCase().replace(/[^a-z0-9_-]/g, "");

  // 5. Kiểm tra nếu là kho mặc định
  if (!s || s === "default" || s === "1" || s === "main" || s === "macdinh" || s === "mac-dinh") {
    return "default";
  }

  return s;
}

// Xác định Kho / Chi nhánh từ URL (?kho=...) hoặc bộ nhớ máy
function getActiveBranchId() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has("kho") || params.has("branch") || params.has("store")) {
      const raw = params.get("kho") || params.get("branch") || params.get("store") || "";
      const branch = cleanBranchCode(raw);
      localStorage.setItem("dmx_active_branch", branch);
      return branch;
    }
    const saved = localStorage.getItem("dmx_active_branch");
    if (saved && saved.trim()) {
      const cleaned = cleanBranchCode(saved);
      if (cleaned !== saved) {
        localStorage.setItem("dmx_active_branch", cleaned);
      }
      return cleaned;
    }
  } catch (e) {}
  return "default";
}

const CURRENT_BRANCH = getActiveBranchId();
const IS_DEFAULT_BRANCH = (CURRENT_BRANCH === "default");
const BRANCH_SUFFIX = IS_DEFAULT_BRANCH ? "" : `_${CURRENT_BRANCH}`;

// Tên hiển thị chuẩn của Kho (VD: "10528", "2", "Shop-B", "Mặc định")
function getBranchDisplayName(branchId) {
  const b = branchId || CURRENT_BRANCH;
  if (!b || b === "default") return "Mặc định";
  if (/^\d+$/.test(b)) return b; // Giữ nguyên số như 10528, 2, 3
  return b.toUpperCase();
}

// Tên các Collections trong Cloud Firestore (Tách riêng cho từng kho độc lập)
const COLLECTIONS = {
  ORDERS: `quan_ly_doi_loi_orders${BRANCH_SUFFIX}`,
  STAFF: `quan_ly_doi_loi_staff${BRANCH_SUFFIX}`,
  PRODUCTS: "quan_ly_doi_loi_products", // Dùng chung 3363 sản phẩm cho mọi kho
  SETTINGS: "quan_ly_doi_loi_settings"
};

// Khóa lưu trữ LocalStorage tương ứng với từng kho độc lập
const STORAGE_KEYS = {
  ORDERS: `dmx_doi_loi_orders${BRANCH_SUFFIX}`,
  STAFF: `dmx_doi_loi_staff${BRANCH_SUFFIX}`,
  CURRENT_STAFF: `dmx_current_staff${BRANCH_SUFFIX}`,
  LAST_STAFF_CODE: `dmx_last_staff_code${BRANCH_SUFFIX}`,
  PRODUCTS: "dmx_doi_loi_products"
};

let firebaseApp = null;
let firestoreDb = null;
let isFirebaseOnline = false;

// Khởi tạo Firebase
function initFirebaseService(onStatusChange, onOrdersUpdated, onProductsUpdated, onStaffUpdated) {
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
      } else {
        firebaseApp = firebase.app();
      }
      firestoreDb = firebase.firestore();
      
      // Bật chế độ offline persistence nếu có thể
      try {
        firestoreDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});
      } catch (e) {}

      // Lắng nghe Realtime thay đổi từ Collection Orders (Giới hạn 300 đơn gần nhất để đảm bảo không vượt gói Free)
      firestoreDb.collection(COLLECTIONS.ORDERS)
        .orderBy('createdAt', 'desc')
        .limit(300)
        .onSnapshot(
          (snapshot) => {
            isFirebaseOnline = true;
            if (onStatusChange) onStatusChange(true, 'Firebase: Đồng bộ thời gian thực');
            
            const orders = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              orders.push({ id: doc.id, ...data });
            });
            if (onOrdersUpdated) onOrdersUpdated(orders);
          },
          (error) => {
            console.warn('Firestore Orders onSnapshot error (using cache/REST):', error);
            isFirebaseOnline = false;
            if (onStatusChange) onStatusChange(false, 'Firebase: Offline (Dùng bộ nhớ máy)');
            // Fallback REST/local
            loadOrdersFromRestOrLocal(onOrdersUpdated);
          }
        );

      // Lắng nghe Realtime danh mục sản phẩm từ 1 Document duy nhất (Tiết kiệm 99.9% quota đọc)
      firestoreDb.collection(COLLECTIONS.SETTINGS).doc('product_catalog')
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const data = doc.data();
              if (data && Array.isArray(data.items) && data.items.length > 0) {
                if (onProductsUpdated) onProductsUpdated(data.items);
              }
            }
          },
          (error) => {
            console.warn('Firestore Product Catalog onSnapshot error:', error);
          }
        );

      // Lắng nghe Realtime danh sách nhân viên
      firestoreDb.collection(COLLECTIONS.STAFF).doc('active_staff_list')
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const data = doc.data();
              if (data && Array.isArray(data.list)) {
                if (onStaffUpdated) onStaffUpdated(data.list);
              }
            }
          },
          (error) => {
            console.warn('Firestore Staff onSnapshot error:', error);
          }
        );

      console.log('✅ Firebase SDK initialized successfully');
      return true;
    }
  } catch (err) {
    console.error('Firebase initialization error:', err);
    if (onStatusChange) onStatusChange(false, 'Firebase: Lỗi khởi tạo (Lưu cục bộ)');
    return false;
  }
}

// REST API Fallback Helper nếu SDK gặp lỗi bảo mật mạng
async function loadOrdersFromRestOrLocal(callback) {
  const localOrders = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
  if (callback) callback(localOrders);

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${COLLECTIONS.ORDERS}?key=${FIREBASE_CONFIG.apiKey}&pageSize=300`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.documents && data.documents.length) {
        const parsed = data.documents.map(doc => {
          const id = doc.name.split('/').pop();
          const f = doc.fields || {};
          const obj = { id };
          for (const k in f) {
            const valObj = f[k];
            if ('stringValue' in valObj) obj[k] = valObj.stringValue;
            else if ('integerValue' in valObj) obj[k] = parseInt(valObj.integerValue);
            else if ('doubleValue' in valObj) obj[k] = parseFloat(valObj.doubleValue);
            else if ('booleanValue' in valObj) obj[k] = valObj.booleanValue;
            else if ('timestampValue' in valObj) obj[k] = valObj.timestampValue;
            else if ('arrayValue' in valObj) obj[k] = (valObj.arrayValue.values || []).map(v => v.stringValue || v);
            else obj[k] = valObj;
          }
          return obj;
        });
        parsed.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        if (callback) callback(parsed);
      }
    }
  } catch (e) {
    console.warn('REST fetch orders error:', e);
  }
}

// Lưu 1 đơn đổi lỗi mới vào Firebase
async function saveOrderToFirebase(orderData) {
  // 1. Lưu vào localStorage trước để phản hồi tức thì
  const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
  const existingIdx = localList.findIndex(o => o.orderCode === orderData.orderCode);
  if (existingIdx >= 0) {
    localList[existingIdx] = { ...localList[existingIdx], ...orderData };
  } else {
    localList.unshift(orderData);
  }
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(localList));

  // 2. Đồng bộ lên Cloud Firestore
  if (firestoreDb) {
    try {
      const docId = orderData.orderCode || `DL_${Date.now()}`;
      await firestoreDb.collection(COLLECTIONS.ORDERS).doc(docId).set(orderData, { merge: true });
      return { success: true };
    } catch (err) {
      console.warn('Firestore write error, using REST fallback:', err);
    }
  }

  // 3. Fallback qua Firestore REST API
  try {
    const docId = orderData.orderCode || `DL_${Date.now()}`;
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${COLLECTIONS.ORDERS}/${docId}?key=${FIREBASE_CONFIG.apiKey}`;
    
    // Convert object to Firestore REST fields
    const fields = {};
    for (const key in orderData) {
      const v = orderData[key];
      if (typeof v === 'string') fields[key] = { stringValue: v };
      else if (typeof v === 'number') fields[key] = { doubleValue: v };
      else if (typeof v === 'boolean') fields[key] = { booleanValue: v };
      else if (Array.isArray(v)) fields[key] = { arrayValue: { values: v.map(item => ({ stringValue: String(item) })) } };
      else if (v === null || v === undefined) fields[key] = { nullValue: null };
      else fields[key] = { stringValue: JSON.stringify(v) };
    }

    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    return { success: true };
  } catch (restErr) {
    console.error('REST write error:', restErr);
    return { success: true, offline: true };
  }
}

// Cập nhật trạng thái xác nhận về kho
async function updateWarehouseStatusInFirebase(orderCode, warehouseData) {
  // Update local
  const localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
  const item = localList.find(o => o.orderCode === orderCode);
  if (item) {
    Object.assign(item, warehouseData);
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(localList));
  }

  // Update Firestore
  if (firestoreDb) {
    try {
      await firestoreDb.collection(COLLECTIONS.ORDERS).doc(orderCode).update(warehouseData);
      return { success: true };
    } catch (e) {
      console.warn('Firestore update error:', e);
    }
  }

  // Fallback REST
  return saveOrderToFirebase({ orderCode, ...warehouseData });
}

// Xóa đơn khỏi Firebase (chỉ Admin)
async function deleteOrderFromFirebase(orderCode) {
  // Local
  let localList = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
  localList = localList.filter(o => o.orderCode !== orderCode);
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(localList));

  if (firestoreDb) {
    try {
      await firestoreDb.collection(COLLECTIONS.ORDERS).doc(orderCode).delete();
      return { success: true };
    } catch (e) {
      console.warn('Firestore delete error:', e);
    }
  }

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/${COLLECTIONS.ORDERS}/${orderCode}?key=${FIREBASE_CONFIG.apiKey}`;
    await fetch(url, { method: 'DELETE' });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Xóa toàn bộ danh sách đơn hàng khỏi Firebase (Chỉ quyền Admin)
async function deleteAllOrdersFromFirebase() {
  // Xóa sạch ở localStorage của kho hiện tại
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));

  if (firestoreDb) {
    try {
      const snapshot = await firestoreDb.collection(COLLECTIONS.ORDERS).get();
      if (!snapshot.empty) {
        const docs = snapshot.docs;
        // Firestore batch tối đa 500 documents mỗi lần commit
        for (let i = 0; i < docs.length; i += 400) {
          const chunk = docs.slice(i, i + 400);
          const batch = firestoreDb.batch();
          chunk.forEach(doc => batch.delete(doc.ref));
          await batch.commit();
        }
      }
      return { success: true };
    } catch (e) {
      console.warn('Firestore deleteAllOrders error:', e);
    }
  }

  return { success: true };
}

// Đồng bộ danh mục sản phẩm Excel lên Firebase
async function syncProductsToFirebase(productsList) {
  localStorage.setItem('dmx_doi_loi_products', JSON.stringify(productsList));

  if (firestoreDb && productsList.length > 0) {
    try {
      // Lưu dưới dạng doc tổng hợp để giảm tải read/write
      await firestoreDb.collection(COLLECTIONS.SETTINGS).doc('product_catalog').set({
        updatedAt: new Date().toISOString(),
        totalProducts: productsList.length,
        items: productsList
      });
      return { success: true };
    } catch (e) {
      console.warn('Save product catalog to Firestore error:', e);
    }
  }
  return { success: true };
}

// Đồng bộ danh sách nhân viên lên Firebase
async function syncStaffToFirebase(staffList) {
  localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staffList));

  if (firestoreDb && Array.isArray(staffList)) {
    try {
      await firestoreDb.collection(COLLECTIONS.STAFF).doc('active_staff_list').set({
        updatedAt: new Date().toISOString(),
        branch: CURRENT_BRANCH,
        totalStaff: staffList.length,
        list: staffList
      });
      return { success: true };
    } catch (e) {
      console.warn('Save staff list to Firestore error:', e);
    }
  }
  return { success: true };
}
