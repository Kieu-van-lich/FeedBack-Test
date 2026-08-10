/**
 * ==========================================================================
 * KHO FEEDBACK - ADMIN DASHBOARD & DATABASE MANAGEMENT LOGIC
 * ==========================================================================
 */

const STORAGE_KEY = "custom_feedback_data";

// Application State
let adminItems = [];
let editingId = null;
let currentPreviewBase64 = "";
let selectedRawFile = null;
let adminCurrentPage = 1;
const ADMIN_ITEMS_PER_PAGE = 10;

let CATEGORIES = [];

function loadDynamicCategoriesAdmin() {
  let customCats = [];
  try {
    const raw = localStorage.getItem("custom_categories_data");
    if (raw) customCats = JSON.parse(raw);
  } catch (e) {}

  if (customCats.length > 0) {
    CATEGORIES = customCats.map(c => c.name === "Đao Bướm" ? { ...c, name: "Dao Bướm" } : c);
  } else if (typeof CATEGORY_DATA !== "undefined" && Array.isArray(CATEGORY_DATA)) {
    CATEGORIES = CATEGORY_DATA;
  } else {
    CATEGORIES = [
      { id: "m4a1", name: "M4A1 Battle of Faith", count: 0, accent: "#ff3366", glow: "rgba(255, 51, 102, 0.4)", dim: "rgba(255, 51, 102, 0.12)", image: "pictures/thẻ/M4A1.jpg" },
      { id: "ak", name: "Ak Riu Thiêng", count: 0, accent: "#f59e0b", glow: "rgba(245, 158, 11, 0.4)", dim: "rgba(245, 158, 11, 0.12)", image: "pictures/thẻ/AK Rìu Thiêng.jpg" },
      { id: "dao", name: "Dao Bướm", count: 0, accent: "#a855f7", glow: "rgba(168, 85, 247, 0.4)", dim: "rgba(168, 85, 247, 0.12)", image: "pictures/thẻ/dao bướm.jpg" },
      { id: "du", name: "Dù Saitama", count: 0, accent: "#00f0ff", glow: "rgba(0, 240, 255, 0.4)", dim: "rgba(0, 240, 255, 0.12)", image: "pictures/thẻ/Dù Saitama.jpg" },
      { id: "m700", name: "M700 ELIZABETH", count: 0, accent: "#10b981", glow: "rgba(16, 185, 129, 0.4)", dim: "rgba(16, 185, 129, 0.12)", image: "pictures/thẻ/M700.jpg" }
    ];
  }
}

function saveDynamicCategoriesAdmin() {
  localStorage.setItem("custom_categories_data", JSON.stringify(CATEGORIES));
}

function normalizeText(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .trim();
}

function matchCategory(itemCategory) {
  if (!itemCategory) return null;
  const normItem = normalizeText(itemCategory);
  return CATEGORIES.find(c => {
    const normName = normalizeText(c.name);
    const normId = normalizeText(c.id);
    return normItem === normName || normItem === normId || normItem.includes(normName) || normName.includes(normItem) || normItem.includes(normId);
  });
}
// Helper Selectors
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// 1. Initialize Admin Panel
document.addEventListener("DOMContentLoaded", async () => {
  loadDynamicCategoriesAdmin();
  setupAdminSecurity();
  setupSupabaseUI();
  try {
    await loadAdminItems();
  } catch (e) {
    console.error("Lỗi nạp dữ liệu ban đầu:", e);
  }
  setupFormListeners();
  setupSearchAndFilter();
  setupDatabaseSync();
  renderAllAdmin();
});

// Admin Security PIN Lock Management
function getAdminPin() {
  return localStorage.getItem("admin_pin_code") || "090800";
}

function setupAdminSecurity() {
  const overlay = $("#adminLockOverlay");
  const authForm = $("#pinAuthForm");
  const pinInput = $("#pinAuthInput");
  const errorMsg = $("#pinErrorMessage");
  const lockBtn = $("#lockAdminBtn");
  const changePinForm = $("#changePinForm");

  // Check Session Authentication Status
  const isAuthenticated = sessionStorage.getItem("admin_auth_session") === "true";

  if (!isAuthenticated && overlay) {
    overlay.style.setProperty("display", "flex", "important");
    if (pinInput) setTimeout(() => pinInput.focus(), 100);
  } else if (overlay) {
    overlay.style.setProperty("display", "none", "important");
  }

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    if (!pinInput) return;

    const entered = pinInput.value.trim();
    const correctPin = getAdminPin();

    // Accept both configured PIN and default master PIN '090800'
    if (entered === correctPin || entered === "090800") {
      sessionStorage.setItem("admin_auth_session", "true");
      if (overlay) overlay.style.setProperty("display", "none", "important");
      if (errorMsg) errorMsg.style.display = "none";
      pinInput.value = "";
      showToast("⚡ Đăng nhập quyền Admin thành công!");
    } else {
      if (errorMsg) errorMsg.style.display = "block";
      pinInput.value = "";
      pinInput.focus();
    }
  };

  // PIN Login Form & Button Event Listeners
  if (authForm) {
    authForm.addEventListener("submit", handleLogin);
  }

  // Lock Admin Button
  if (lockBtn) {
    lockBtn.addEventListener("click", () => {
      sessionStorage.removeItem("admin_auth_session");
      if (overlay) {
        overlay.style.setProperty("display", "flex", "important");
        if (pinInput) pinInput.focus();
      }
      showToast("🔒 Đã khóa trang Admin!");
    });
  }

  // Change PIN Form Submission
  if (changePinForm) {
    changePinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const currentPin = $("#currentPinInput").value.trim();
      const newPin = $("#newPinInput").value.trim();
      const activePin = getAdminPin();

      if (currentPin !== activePin) {
        showToast("❌ Mã PIN hiện tại không đúng!");
        return;
      }

      if (newPin.length < 4) {
        showToast("❌ Mã PIN mới phải có ít nhất 4 ký tự!");
        return;
      }

      localStorage.setItem("admin_pin_code", newPin);
      $("#currentPinInput").value = "";
      $("#newPinInput").value = "";
      showToast("🔑 Đã đổi mã PIN Admin thành công!");
    });
  }
}

// 2. Load Combined Items (Supabase OR data.js + custom localStorage)
async function loadAdminItems() {
  let supaItems = [];
  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
    const supaData = await fetchSupabaseFeedbacks();
    if (supaData && Array.isArray(supaData) && supaData.length > 0) {
      supaItems = supaData.map(item => ({
        id: item.id,
        path: item.path,
        category: item.category,
        title: item.title,
        filename: item.filename || (item.path ? item.path.split("/").pop() : "image.jpg"),
        isSupabase: true
      }));
      updateSupabaseBadge(true);
    }
  }

  updateSupabaseBadge(typeof isSupabaseConfigured === "function" && isSupabaseConfigured());

  let baseData = [];
  if (typeof feedbackData !== "undefined" && Array.isArray(feedbackData)) {
    baseData = feedbackData.map((item, idx) => ({
      id: `base-${idx}`,
      path: item.path,
      category: item.category,
      filename: item.filename || item.path.split("/").pop(),
      isBase: true
    }));
  }

  let customData = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) customData = parsed;
    }
  } catch (e) {
    console.error("Error reading custom feedback items:", e);
  }

  if (!Array.isArray(supaItems)) supaItems = [];
  if (!Array.isArray(customData)) customData = [];
  if (!Array.isArray(baseData)) baseData = [];

  const combined = [...supaItems, ...customData, ...baseData];
  
  adminItems = [];
  const seenPaths = new Set();
  for (const item of combined) {
    const p = item.path || "";
    if (p && !seenPaths.has(p)) {
      seenPaths.add(p);
      adminItems.push(item);
    } else if (!p) {
      adminItems.push(item);
    }
  }
}

// Save Custom Items to LocalStorage
function saveCustomItems() {
  try {
    const customOnly = adminItems.filter(item => (!item.isBase && !item.isSupabase) || item.isEdited);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
  } catch (e) {
    console.warn("LocalStorage save error (quota limit), items preserved in memory:", e);
  }
}

// 3. Render All Dashboard Components
function renderAllAdmin() {
  renderCategoriesAdmin();
  renderStats();
  renderTable();
}

// Render Stats Cards
function renderStats() {
  const grid = $("#adminStatsGrid");
  if (!grid) return;
  
  const total = adminItems.length;
  
  // Calculate counts per dynamic category
  CATEGORIES.forEach(cat => { cat.count = 0; });
  let otherCount = 0;
  
  adminItems.forEach(item => {
    const foundCat = matchCategory(item.category);
    if (foundCat) {
      foundCat.count++;
    } else {
      otherCount++;
    }
  });

  let html = `
    <div class="stat-card">
      <div class="stat-card-title">Tổng Feedback</div>
      <div class="stat-card-value">${total}</div>
      <div class="stat-card-badge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
      </div>
    </div>
  `;
  
  CATEGORIES.forEach(cat => {
    html += `
      <div class="stat-card">
        <div class="stat-card-title">${cat.name}</div>
        <div class="stat-card-value" style="color: ${cat.accent};">${cat.count}</div>
        <div class="stat-card-badge" style="color: ${cat.accent};">★</div>
      </div>
    `;
  });
  
  if (otherCount > 0) {
    html += `
      <div class="stat-card">
        <div class="stat-card-title">Khác</div>
        <div class="stat-card-value" style="color: #94a3b8;">${otherCount}</div>
        <div class="stat-card-badge" style="color: #94a3b8;">#</div>
      </div>
    `;
  }
  
  grid.innerHTML = html;
  
  // Also populate dropdowns
  const catSelect = $("#categorySelect");
  if (catSelect) {
    catSelect.innerHTML = CATEGORIES.map(c => `<option value="${c.name}">${c.name}</option>`).join("") + `<option value="Giao dịch chung">Khác / Giao Dịch Chung</option>`;
  }
  
  const adminCatFilter = $("#adminCatFilter");
  if (adminCatFilter) {
    const currentVal = adminCatFilter.value;
    adminCatFilter.innerHTML = `<option value="all">Tất cả danh mục</option>` + CATEGORIES.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    adminCatFilter.value = currentVal || "all";
  }

  const tableItemCount = $("#tableItemCount");
  if (tableItemCount) tableItemCount.textContent = total;
}

// Render Categories Management Table
function renderCategoriesAdmin() {
  const tbody = $("#categoryTableBody");
  if (!tbody) return;
  
  tbody.innerHTML = CATEGORIES.map(cat => `
    <tr>
      <td style="font-weight: 600;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${cat.image}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;" onerror="this.src='assets/demo/feedback-01.png'" />
          ${cat.name}
        </div>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 16px; height: 16px; border-radius: 50%; background: ${cat.accent}; box-shadow: 0 0 8px ${cat.glow};"></div>
          <span style="font-family: monospace; font-size: 0.85rem;">${cat.accent}</span>
        </div>
      </td>
      <td style="text-align: right;">
        <div class="action-btn-group" style="justify-content: flex-end;">
          <button class="btn-icon edit" onclick="editCategoryAdmin('${cat.id}')" title="Sửa">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon danger" onclick="deleteCategoryAdmin('${cat.id}')" title="Xóa">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

window.handleCategorySubmit = function(e) {
  if (e) e.preventDefault();
  const idInput = $("#editCatId").value;
  const name = $("#catNameInput").value.trim();
  const accent = $("#catColorInput").value;
  const image = $("#catImageInput").value.trim();
  
  if (!name || !accent || !image) {
    showToast("Vui lòng điền đủ các trường bắt buộc!");
    return;
  }
  
  // Convert hex to rgba helper
  let r = 255, g = 255, b = 255;
  if (accent.length === 7) {
    r = parseInt(accent.slice(1, 3), 16);
    g = parseInt(accent.slice(3, 5), 16);
    b = parseInt(accent.slice(5, 7), 16);
  }
  const glow = `rgba(${r}, ${g}, ${b}, 0.4)`;
  const dim = `rgba(${r}, ${g}, ${b}, 0.12)`;
  
  if (idInput) {
    // Edit existing
    const idx = CATEGORIES.findIndex(c => c.id === idInput);
    if (idx !== -1) {
      CATEGORIES[idx] = { ...CATEGORIES[idx], name, accent, glow, dim, image };
      showToast("Đã cập nhật danh mục!");
    }
  } else {
    // Add new
    const newId = "cat_" + Date.now().toString(36);
    CATEGORIES.push({
      id: newId, name, count: 0, accent, glow, dim, image
    });
    showToast("Đã thêm danh mục mới!");
  }
  
  saveDynamicCategoriesAdmin();
  $("#categoryManageForm").reset();
  $("#editCatId").value = "";
  $("#saveCatBtn").textContent = "Thêm Danh Mục Mới";
  $("#cancelCatEditBtn").style.display = "none";
  renderAllAdmin();
};

window.editCategoryAdmin = function(id) {
  const cat = CATEGORIES.find(c => c.id === id);
  if (!cat) return;
  $("#editCatId").value = cat.id;
  $("#catNameInput").value = cat.name;
  $("#catColorInput").value = cat.accent;
  $("#catImageInput").value = cat.image;
  
  $("#saveCatBtn").textContent = "Lưu Thay Đổi";
  $("#cancelCatEditBtn").style.display = "inline-flex";
  $("#catNameInput").focus();
  window.scrollTo({ top: $("#categoryManageForm").offsetTop - 100, behavior: 'smooth' });
};

window.deleteCategoryAdmin = function(id) {
  if (CATEGORIES.length <= 1) {
    showToast("Phải có ít nhất 1 danh mục!");
    return;
  }
  if (confirm("Bạn có chắc chắn muốn xóa danh mục này?")) {
    CATEGORIES = CATEGORIES.filter(c => c.id !== id);
    saveDynamicCategoriesAdmin();
    showToast("Đã xóa danh mục!");
    renderAllAdmin();
  }
};

$("#cancelCatEditBtn")?.addEventListener("click", () => {
  $("#categoryManageForm").reset();
  $("#editCatId").value = "";
  $("#saveCatBtn").textContent = "Thêm Danh Mục Mới";
  $("#cancelCatEditBtn").style.display = "none";
});

// 4. Render Admin Table List
function renderTable() {
  const tbody = $("#adminTableBody");
  if (!tbody) return;

  const keyword = $("#adminSearchInput") ? $("#adminSearchInput").value.trim().toLowerCase() : "";
  const catFilter = $("#adminCatFilter") ? $("#adminCatFilter").value : "all";

  let filtered = adminItems.filter(item => {
    const catNameStr = item.category || "";
    const fname = (item.filename || item.path || "").toLowerCase();
    const title = (item.title || "").toLowerCase();

    // Category filter
    if (catFilter !== "all") {
      const foundCat = matchCategory(catNameStr);
      if (!foundCat || foundCat.id !== catFilter) {
        return false;
      }
    }

    // Keyword filter
    if (keyword) {
      const normKw = normalizeText(keyword);
      const normCat = normalizeText(catNameStr);
      const normTitle = normalizeText(title);
      const normFname = normalizeText(fname);
      return normCat.includes(normKw) || normFname.includes(normKw) || normTitle.includes(normKw);
    }

    return true;
  });

  const tableItemCount = $("#tableItemCount");
  if (tableItemCount) tableItemCount.textContent = filtered.length;

  const totalPages = Math.ceil(filtered.length / ADMIN_ITEMS_PER_PAGE);
  if (adminCurrentPage > totalPages && totalPages > 0) adminCurrentPage = totalPages;
  if (adminCurrentPage < 1) adminCurrentPage = 1;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">
          Không tìm thấy feedback nào phù hợp.
        </td>
      </tr>
    `;
    renderAdminPagination(0);
    return;
  }

  const startIndex = (adminCurrentPage - 1) * ADMIN_ITEMS_PER_PAGE;
  const paginated = filtered.slice(startIndex, startIndex + ADMIN_ITEMS_PER_PAGE);

  tbody.innerHTML = paginated.map(item => {
    const imgSrc = item.path || item.src || "assets/demo/feedback-01.png";
    const catName = item.category || "Giao dịch chung";
    const filename = item.filename || (item.path ? item.path.split("/").pop() : "File ảnh");
    const displayTitle = item.title || `${catName}`;
    const badgeCustom = !item.isBase ? `<span style="font-size: 0.7rem; background: rgba(185,243,75,0.2); color: var(--accent-primary); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Mới</span>` : "";

    return `
      <tr>
        <td>
          <img src="${imgSrc}" class="thumb-preview" alt="Thumb" onclick="previewImageModal('${imgSrc}')" />
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
            ${displayTitle} ${badgeCustom}
          </div>
          <div style="font-size: 0.8rem; color: var(--accent-cyan); margin-top: 2px;">
            ${catName}
          </div>
        </td>
        <td>
          <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${filename}
          </div>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group" style="justify-content: flex-end;">
            <button class="btn-icon edit" onclick="editFeedbackItem('${item.id}')" title="Sửa">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn-icon danger" onclick="deleteFeedbackItem('${item.id}')" title="Xóa">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  renderAdminPagination(totalPages);
}

// Render Admin Table Pagination Controls
function renderAdminPagination(totalPages) {
  const paginationEl = $("#adminPagination");
  if (!paginationEl) return;

  if (totalPages <= 1) {
    paginationEl.innerHTML = "";
    return;
  }

  let html = "";

  // Prev Button
  html += `
    <button class="page-btn" onclick="changeAdminPage(${adminCurrentPage - 1})" ${adminCurrentPage === 1 ? "disabled" : ""} aria-label="Trang trước">
      ‹ Trước
    </button>
  `;

  // Numbered Page Buttons with Smart Ellipsis
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= adminCurrentPage - 2 && i <= adminCurrentPage + 2)) {
      html += `
        <button class="page-btn ${i === adminCurrentPage ? "active" : ""}" onclick="changeAdminPage(${i})">
          ${i}
        </button>
      `;
    } else if (i === adminCurrentPage - 3 || i === adminCurrentPage + 3) {
      html += `<span class="page-ellipsis">...</span>`;
    }
  }

  // Next Button
  html += `
    <button class="page-btn" onclick="changeAdminPage(${adminCurrentPage + 1})" ${adminCurrentPage === totalPages ? "disabled" : ""} aria-label="Trang sau">
      Sau ›
    </button>
  `;

  paginationEl.innerHTML = html;
}

window.changeAdminPage = function (page) {
  adminCurrentPage = page;
  renderTable();
  const tableWrapper = $(".feedback-table-wrapper");
  if (tableWrapper) {
    tableWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

// 5. Form & Drag Drop Image Upload
function setupFormListeners() {
  const form = $("#addFeedbackForm");
  const dropzone = $("#dropzone");
  const fileInput = $("#imageFileInput");
  const pathInput = $("#imagePathInput");
  const previewContainer = $("#imagePreviewContainer");
  const previewImg = $("#imagePreview");
  const removeBtn = $("#removePreviewBtn");

  // Dropzone click triggers file input
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });
  }

  // Manual Path Input Change
  if (pathInput) {
    pathInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      if (val && !currentPreviewBase64) {
        previewImg.src = val;
        previewContainer.style.display = "block";
      }
    });
  }

  // Remove preview
  if (removeBtn) {
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      currentPreviewBase64 = "";
      window.currentPreviewBase64 = "";
      window.selectedRawFile = null;
      selectedRawFile = null;
      pathInput.value = "";
      fileInput.value = "";
      previewImg.src = "";
      previewContainer.style.display = "none";
    });
  }

  // Form Submit is now handled by handleAdminFormSubmit inline in admin.html

  // Cancel edit button
  if ($("#cancelEditBtn")) {
    $("#cancelEditBtn").addEventListener("click", () => {
      resetForm();
    });
  }
}

function handleFileSelect(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("Vui lòng chọn file hình ảnh!");
    return;
  }

  selectedRawFile = file;
  window.selectedRawFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    currentPreviewBase64 = e.target.result;
    window.currentPreviewBase64 = e.target.result;
    $("#imagePreview").src = currentPreviewBase64;
    $("#imagePreviewContainer").style.display = "block";
    $("#imagePathInput").value = `[Ảnh tải lên: ${file.name}]`;
  };
  reader.readAsDataURL(file);
}

function resetForm() {
  editingId = null;
  currentPreviewBase64 = "";
  selectedRawFile = null;
  window.currentPreviewBase64 = "";
  window.selectedRawFile = null;
  $("#addFeedbackForm").reset();
  $("#imagePreview").src = "";
  $("#imagePreviewContainer").style.display = "none";
  $("#formTitle").textContent = "Thêm Feedback Mới";
  $("#submitBtn").innerHTML = "<span>⚡ Lưu Feedback</span>";
  $("#cancelEditBtn").style.display = "none";
}

// Supabase UI Settings Form Listener
function setupSupabaseUI() {
  const supaForm = $("#supabaseConfigForm");
  const supaUrlInput = $("#supaUrlInput");
  const supaKeyInput = $("#supaKeyInput");

  if (supaUrlInput) supaUrlInput.value = localStorage.getItem("SUPABASE_URL") || "https://frnepaasslsbbmxvvhsb.supabase.co";
  if (supaKeyInput) supaKeyInput.value = localStorage.getItem("SUPABASE_ANON_KEY") || "sb_publishable_V5IaeVV24R1GmZrh09TcsQ_cD95KDn2";

  if (supaForm) {
    supaForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const url = supaUrlInput.value.trim();
      const key = supaKeyInput.value.trim();

      if (url && key) {
        localStorage.setItem("SUPABASE_URL", url);
        localStorage.setItem("SUPABASE_ANON_KEY", key);
        
        if (typeof supabase !== "undefined") {
          supabaseClient = supabase.createClient(url, key);
        }

        showToast("Đã lưu cấu hình Supabase!");
        await loadAdminItems();
        renderAllAdmin();
      } else {
        localStorage.removeItem("SUPABASE_URL");
        localStorage.removeItem("SUPABASE_ANON_KEY");
        supabaseClient = null;
        showToast("Đã ngắt kết nối Supabase!");
        await loadAdminItems();
        renderAllAdmin();
      }
    });
  }

  // Seed existing feedbackData items into Supabase
  const seedBtn = $("#seedSupabaseBtn");
  if (seedBtn) {
    seedBtn.addEventListener("click", async () => {
      if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) {
        showToast("❌ Vui lòng kết nối Supabase trước!");
        return;
      }

      if (typeof feedbackData === "undefined" || !Array.isArray(feedbackData)) {
        showToast("❌ Không tìm thấy dữ liệu data.js!");
        return;
      }

      if (!confirm(`Bạn có muốn nhập tự động ${feedbackData.length} feedback từ data.js vào Supabase không?`)) {
        return;
      }

      showToast(`⏳ Đang đẩy ${feedbackData.length} feedback vào Supabase...`);

      try {
        const rows = feedbackData.map((item, idx) => ({
          title: `${item.category} — Feedback #${String(idx + 1).padStart(2, "0")}`,
          category: item.category,
          path: item.path,
          filename: item.filename || item.path.split("/").pop()
        }));

        const chunkSize = 50;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error } = await supabaseClient.from("feedbacks").insert(chunk);
          if (error) throw error;
        }

        showToast(`⚡ Đã nhập thành công ${rows.length} feedback vào Supabase!`);
        await loadAdminItems();
        renderAllAdmin();
      } catch (err) {
        console.error("Error seeding data:", err);
        showToast(`❌ Lỗi nhập Supabase: ${err.message}`);
      }
    });
  }
}

function updateSupabaseBadge(isConnected) {
  const badge = $("#supabaseStatusBadge");
  if (!badge) return;

  if (isConnected) {
    badge.textContent = "⚡ KẾT NỐI SUPABASE THÀNH CÔNG";
    badge.style.background = "rgba(185, 243, 75, 0.18)";
    badge.style.color = "var(--accent-primary)";
    badge.style.borderColor = "rgba(185, 243, 75, 0.4)";
  } else {
    badge.textContent = "⚡ CHƯA KẾT NỐI (LƯU LOCALSTORAGE)";
    badge.style.background = "rgba(0, 240, 255, 0.12)";
    badge.style.color = "var(--accent-cyan)";
    badge.style.borderColor = "rgba(0, 240, 255, 0.3)";
  }
}

// 6. Edit & Delete Actions
window.editFeedbackItem = function (id) {
  const item = adminItems.find(i => i.id === id);
  if (!item) return;

  editingId = id;
  $("#categorySelect").value = item.category || "M4A1 Battle of Faith";
  $("#titleInput").value = item.title || "";
  $("#imagePathInput").value = item.path || "";

  if (item.path && item.path.startsWith("data:image")) {
    currentPreviewBase64 = item.path;
    $("#imagePreview").src = currentPreviewBase64;
    $("#imagePreviewContainer").style.display = "block";
  } else if (item.path) {
    $("#imagePreview").src = item.path;
    $("#imagePreviewContainer").style.display = "block";
  }

  $("#formTitle").textContent = "Chỉnh Sửa Feedback";
  $("#submitBtn").innerHTML = "<span>⚡ Cập Nhật Feedback</span>";
  $("#cancelEditBtn").style.display = "inline-flex";

  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deleteFeedbackItem = async function (id) {
  if (confirm("Bạn có chắc chắn muốn xóa feedback này khỏi CSDL?")) {
    const itemToDelete = adminItems.find(i => i.id === id);
    const targetPath = itemToDelete ? itemToDelete.path : null;
    let supaDeleted = false;

    if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured() && itemToDelete && itemToDelete.isSupabase) {
      const ok = await deleteSupabaseFeedback(id);
      if (ok) {
        showToast("Đã xóa feedback khỏi Supabase!");
        supaDeleted = true;
      }
    }

    // Always aggressively clean up local duplicates regardless of Supabase success
    if (targetPath) {
      adminItems = adminItems.filter(i => i.id !== id && i.path !== targetPath);
    } else {
      adminItems = adminItems.filter(i => i.id !== id);
    }
    
    saveCustomItems();

    if (supaDeleted) {
      await loadAdminItems();
    }
    
    showToast("Đã xóa feedback thành công!");
    renderAllAdmin();
  }
};

window.previewImageModal = function (src) {
  window.open(src, "_blank");
};

// 7. Search & Filter Controls
function setupSearchAndFilter() {
  const searchInput = $("#adminSearchInput");
  const catFilter = $("#adminCatFilter");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      adminCurrentPage = 1;
      renderTable();
    });
  }
  if (catFilter) {
    catFilter.addEventListener("change", () => {
      adminCurrentPage = 1;
      renderTable();
    });
  }
}

// 8. Database Sync & Backup Controls
function setupDatabaseSync() {
  // Export updated data.js
  $("#exportJsBtn").addEventListener("click", () => {
    const exportArray = adminItems.map(item => ({
      path: item.path,
      category: item.category,
      filename: item.filename || (item.path ? item.path.split("/").pop() : "image.jpg")
    }));

    let jsContent = `const CATEGORY_DATA = ${JSON.stringify(CATEGORIES, null, 2)};\n\n`;
    jsContent += `const feedbackData = ${JSON.stringify(exportArray, null, 2)};\n`;
    downloadFile(jsContent, "data.js", "text/javascript");
    showToast("Đã tải xuống file data.js thành công!");
  });

  // Download JSON Backup
  $("#downloadJsonBtn").addEventListener("click", () => {
    const jsonStr = JSON.stringify(adminItems, null, 2);
    downloadFile(jsonStr, `feedback_database_backup_${Date.now()}.json`, "application/json");
    showToast("Đã xuất file Backup JSON CSDL!");
  });

  // Import JSON Backup
  $("#importJsonInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (Array.isArray(imported)) {
          adminItems = imported;
          saveCustomItems();
          renderAllAdmin();
          showToast("Đã nhập dữ liệu CSDL từ file JSON thành công!");
        }
      } catch (err) {
        showToast("Lỗi file JSON không hợp lệ!");
      }
    };
    reader.readAsText(file);
  });

  // Reset to default data.js
  $("#clearAllBtn").addEventListener("click", () => {
    if (confirm("Reset CSDL về danh sách mặc định ban đầu từ data.js? Tất cả feedback thêm mới tùy chỉnh sẽ xóa khỏi trình duyệt.")) {
      localStorage.removeItem(STORAGE_KEY);
      loadAdminItems();
      renderAllAdmin();
      showToast("Đã khôi phục CSDL về mặc định!");
    }
  });
}

// Helper to trigger file download
function downloadFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Toast notification trigger
function showToast(message) {
  const toast = $("#adminToast");
  const msgEl = $("#toastMessage");
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}
