/**
 * ==========================================================================
 * KHO FEEDBACK - ADMIN DASHBOARD & DATABASE MANAGEMENT LOGIC
 * ==========================================================================
 */

const Shared = window.KhoFeedbackShared;
const STORAGE_KEY = Shared ? Shared.CUSTOM_FEEDBACK_KEY : "custom_feedback_data";

// Application State
let adminItems = [];
let editingId = null;
let selectedBatchFiles = [];
let adminCurrentPage = 1;
const ADMIN_ITEMS_PER_PAGE = 10;
let categoriesTableSupported = false;
let currentAdminSession = null;
let adminDashboardLoaded = false;
let adminDataLoadPromise = null;

let CATEGORIES = Shared ? Shared.loadLocalCategories() : [];

// Helper Selectors
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function normalizeText(str) {
  return Shared ? Shared.normalizeText(str) : String(str || "").toLowerCase().trim();
}

function matchCategory(itemCategory) {
  return Shared ? Shared.matchCategory(CATEGORIES, itemCategory) : null;
}

function saveDynamicCategoriesAdmin() {
  if (Shared) Shared.saveLocalCategories(CATEGORIES);
  else localStorage.setItem("custom_categories_data", JSON.stringify(CATEGORIES));
}

function clearProtectedAdminUI() {
  adminItems = [];
  adminDashboardLoaded = false;
  resetForm();
  resetCategoryForm();
  const tbody = $("#adminTableBody");
  if (tbody) tbody.innerHTML = "";
  const catTbody = $("#categoryTableBody");
  if (catTbody) catTbody.innerHTML = "";
  const statsGrid = $("#adminStatsGrid");
  if (statsGrid) statsGrid.innerHTML = "";
  const pag = $("#adminPagination");
  if (pag) pag.innerHTML = "";
  const tableCount = $("#tableItemCount");
  if (tableCount) tableCount.textContent = "0";
}

async function loadAdminDashboardData() {
  if (adminDataLoadPromise) return adminDataLoadPromise;
  adminDataLoadPromise = (async () => {
    try {
      await loadCategoriesAdmin();
      await loadAdminItems();
      adminDashboardLoaded = true;
    } catch (e) {
      console.error("Lỗi nạp dữ liệu ban đầu:", e);
      showToast("⚠️ Có lỗi khi nạp dữ liệu từ Supabase, đang dùng dữ liệu cục bộ.");
    } finally {
      adminDataLoadPromise = null;
    }
    renderAllAdmin();
  })();
  return adminDataLoadPromise;
}

function applyAuthSessionUI(session) {
  currentAdminSession = session || null;
  const overlay = $("#adminLockOverlay");
  const emailInput = $("#authEmailInput");
  const pwInput = $("#authPasswordInput");
  const errEl = $("#authErrorMessage");
  const badgeEl = $("#adminUserBadge");
  const sessionEmailEl = $("#adminSessionEmail");
  const sessionStatusEl = $("#adminSessionStatus");

  const userEmail = session && session.user && session.user.email ? session.user.email : null;

  if (userEmail) {
    if (overlay) overlay.style.setProperty("display", "none", "important");
    if (errEl) errEl.style.display = "none";
    if (pwInput) pwInput.value = "";
    if (badgeEl) {
      badgeEl.innerHTML = `<span class="pulse-dot"></span> ${Shared ? Shared.escapeHtml(userEmail) : userEmail}`;
    }
    if (sessionEmailEl) sessionEmailEl.textContent = userEmail;
    if (sessionStatusEl) sessionStatusEl.textContent = "Đã xác thực qua Supabase Auth";
  } else {
    if (overlay) overlay.style.setProperty("display", "flex", "important");
    if (badgeEl) {
      badgeEl.innerHTML = `<span class="pulse-dot"></span> CHƯA ĐĂNG NHẬP`;
    }
    if (sessionEmailEl) sessionEmailEl.textContent = "Chưa đăng nhập";
    if (sessionStatusEl) sessionStatusEl.textContent = "Yêu cầu đăng nhập";
    clearProtectedAdminUI();
    if (emailInput) setTimeout(() => emailInput.focus(), 100);
  }
}

// 1. Initialize Admin Panel
document.addEventListener("DOMContentLoaded", async () => {
  setupAdminAuth();
  setupSupabaseUI();
  setupFormListeners();
  setupCategoryListeners();
  setupSearchAndFilter();
  setupDatabaseSync();

  const { session } = typeof getSupabaseSession === "function"
    ? await getSupabaseSession()
    : { session: null };

  applyAuthSessionUI(session);
  if (session && session.user) {
    await loadAdminDashboardData();
  }
});

// Admin Authentication & Session Lifecycle (Supabase Auth)
function setupAdminAuth() {
  const authForm = $("#authLoginForm");
  const emailInput = $("#authEmailInput");
  const pwInput = $("#authPasswordInput");
  const submitBtn = $("#authSubmitBtn");
  const errorMsg = $("#authErrorMessage");
  const logoutBtn = $("#logoutAdminBtn");
  const securityLogoutBtn = $("#securityLogoutBtn");
  const changePasswordForm = $("#changePasswordForm");

  if (authForm) {
    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!emailInput || !pwInput) return;

      const email = emailInput.value.trim();
      const password = pwInput.value;

      if (errorMsg) errorMsg.style.display = "none";
      if (submitBtn) submitBtn.disabled = true;

      try {
        if (typeof signInSupabaseAdmin !== "function") {
          throw new Error("Thiếu cấu hình Supabase Auth.");
        }
        const { session } = await signInSupabaseAdmin(email, password);
        applyAuthSessionUI(session);
        await loadAdminDashboardData();
        showToast("⚡ Đăng nhập quyền Admin thành công!");
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = `❌ ${err.message || "Đăng nhập thất bại."}`;
          errorMsg.style.display = "block";
        }
        pwInput.value = "";
        pwInput.focus();
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  async function handleLogoutClick() {
    try {
      if (typeof signOutSupabaseAdmin === "function") {
        await signOutSupabaseAdmin();
      }
    } catch (err) {
      console.warn("Lỗi đăng xuất:", err.message);
    }
    applyAuthSessionUI(null);
    showToast("🔒 Đã đăng xuất khỏi phiên Admin!");
  }

  if (logoutBtn) logoutBtn.addEventListener("click", handleLogoutClick);
  if (securityLogoutBtn) securityLogoutBtn.addEventListener("click", handleLogoutClick);

  if (changePasswordForm) {
    changePasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newPwEl = $("#newPasswordInput");
      const confirmPwEl = $("#confirmPasswordInput");
      const btn = $("#changePasswordBtn");
      const newPw = newPwEl ? newPwEl.value : "";
      const confirmPw = confirmPwEl ? confirmPwEl.value : "";

      if (newPw.length < 8) {
        showToast("❌ Mật khẩu mới phải có ít nhất 8 ký tự!");
        return;
      }
      if (newPw !== confirmPw) {
        showToast("❌ Mật khẩu xác nhận không khớp!");
        return;
      }

      if (btn) btn.disabled = true;
      try {
        if (typeof updateSupabaseAdminPassword !== "function") {
          throw new Error("Thiếu hàm cập nhật mật khẩu Supabase Auth.");
        }
        await updateSupabaseAdminPassword(newPw);
        if (newPwEl) newPwEl.value = "";
        if (confirmPwEl) confirmPwEl.value = "";
        showToast("🔑 Đã cập nhật mật khẩu Admin trên Supabase Auth!");
      } catch (err) {
        showToast(`❌ Không đổi được mật khẩu: ${err.message}`);
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }

  if (typeof onSupabaseAuthStateChange === "function") {
    onSupabaseAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        if (currentAdminSession) {
          applyAuthSessionUI(null);
        }
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        applyAuthSessionUI(session);
        if (!adminDashboardLoaded) {
          await loadAdminDashboardData();
        }
      }
    });
  }
}

// 2. Load Categories from Supabase (or fallback local/data.js)
async function loadCategoriesAdmin() {
  const localCats = Shared ? Shared.loadLocalCategories() : [];
  CATEGORIES = localCats;

  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured() && typeof fetchSupabaseCategories === "function") {
    const res = await fetchSupabaseCategories();
    if (res && res.supported) {
      categoriesTableSupported = true;
      if (Array.isArray(res.data) && res.data.length > 0) {
        CATEGORIES = res.data;
        saveDynamicCategoriesAdmin();
        updateCategorySyncBadge("synced");
      } else {
        updateCategorySyncBadge("empty");
      }
    } else {
      categoriesTableSupported = false;
      updateCategorySyncBadge("missing_table");
    }
  } else {
    categoriesTableSupported = false;
    updateCategorySyncBadge("offline");
  }
}

function updateCategorySyncBadge(status) {
  const badge = $("#categorySyncBadge");
  if (!badge) return;

  if (status === "synced") {
    badge.textContent = "⚡ ĐÃ ĐỒNG BỘ SUPABASE";
    badge.style.background = "rgba(185, 243, 75, 0.18)";
    badge.style.color = "var(--accent-primary)";
    badge.style.borderColor = "rgba(185, 243, 75, 0.4)";
  } else if (status === "empty") {
    badge.textContent = "⚠️ BẢNG CATEGORIES TRỐNG (BẤM ĐỒNG BỘ)";
    badge.style.background = "rgba(245, 158, 11, 0.16)";
    badge.style.color = "#f59e0b";
    badge.style.borderColor = "rgba(245, 158, 11, 0.4)";
  } else if (status === "missing_table") {
    badge.textContent = "💾 LOCALSTORAGE (CHƯA TẠO BẢNG CATEGORIES)";
    badge.style.background = "rgba(0, 240, 255, 0.12)";
    badge.style.color = "var(--accent-cyan)";
    badge.style.borderColor = "rgba(0, 240, 255, 0.3)";
  } else {
    badge.textContent = "💾 LOCALSTORAGE";
    badge.style.background = "rgba(255, 255, 255, 0.08)";
    badge.style.color = "var(--text-muted)";
    badge.style.borderColor = "var(--border-medium)";
  }
}

// 3. Load Combined Items (Supabase + localStorage + unseeded data.js fallback)
async function loadAdminItems() {
  let supaItems = [];
  const supaConnected = typeof isSupabaseConfigured === "function" && isSupabaseConfigured();

  if (supaConnected) {
    const supaData = await fetchSupabaseFeedbacks();
    if (Array.isArray(supaData)) {
      supaItems = supaData.map((item) => ({
        id: item.id,
        path: item.path,
        category: item.category,
        title: item.title,
        filename: item.filename || (item.path ? item.path.split("/").pop() : "image.jpg"),
        created_at: item.created_at || null,
        isSupabase: true
      }));
    }
  }

  updateSupabaseBadge(supaConnected);

  let baseData = [];
  if (typeof feedbackData !== "undefined" && Array.isArray(feedbackData)) {
    baseData = feedbackData.map((item, idx) => ({
      id: `base-${idx}`,
      path: item.path,
      category: item.category,
      title: item.title || "",
      filename: item.filename || (item.path ? item.path.split("/").pop() : "image.jpg"),
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

  if (Shared) {
    adminItems = Shared.combineFeedbackSources({
      supaItems,
      customItems: customData,
      baseItems: baseData
    });
  } else {
    adminItems = [...supaItems, ...customData, ...baseData];
  }
}

// Save local-only or edited-base items to LocalStorage (avoid duplicating Supabase rows)
function saveCustomItems() {
  try {
    const localOnly = adminItems.filter(
      (item) => (!item.isBase && !item.isSupabase) || (item.isBase && item.isEdited)
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localOnly));
  } catch (e) {
    console.warn("LocalStorage save error (quota limit), items preserved in memory:", e);
  }
}

// 4. Render All Dashboard Components
function renderAllAdmin() {
  renderCategoriesAdmin();
  renderStats();
  renderTable();
}

function renderStats() {
  const grid = $("#adminStatsGrid");
  if (!grid) return;

  const esc = Shared ? Shared.escapeHtml : (s) => String(s || "");
  const total = adminItems.length;

  CATEGORIES.forEach((cat) => {
    cat.count = 0;
  });
  let otherCount = 0;

  adminItems.forEach((item) => {
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

  CATEGORIES.forEach((cat) => {
    const safeAccent = /^#[0-9a-fA-F]{6}$/.test(cat.accent || "") ? cat.accent : "#b9f34b";
    html += `
      <div class="stat-card">
        <div class="stat-card-title">${esc(cat.name)}</div>
        <div class="stat-card-value" style="color: ${safeAccent};">${cat.count}</div>
        <div class="stat-card-badge" style="color: ${safeAccent};">★</div>
      </div>
    `;
  });

  if (otherCount > 0) {
    html += `
      <div class="stat-card">
        <div class="stat-card-title">Khác / Chưa khớp danh mục</div>
        <div class="stat-card-value" style="color: #94a3b8;">${otherCount}</div>
        <div class="stat-card-badge" style="color: #94a3b8;">#</div>
      </div>
    `;
  }

  grid.innerHTML = html;

  const catSelect = $("#categorySelect");
  if (catSelect) {
    const prevVal = catSelect.value;
    catSelect.innerHTML =
      CATEGORIES.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join("") +
      `<option value="Giao dịch chung">Khác / Giao Dịch Chung</option>`;
    if (prevVal && Array.from(catSelect.options).some((o) => o.value === prevVal)) {
      catSelect.value = prevVal;
    }
  }

  const adminCatFilter = $("#adminCatFilter");
  if (adminCatFilter) {
    const currentVal = adminCatFilter.value || "all";
    adminCatFilter.innerHTML =
      `<option value="all">Tất cả danh mục</option>` +
      CATEGORIES.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("") +
      (otherCount > 0 ? `<option value="other">Khác (${otherCount})</option>` : "");
    const hasVal = Array.from(adminCatFilter.options).some((o) => o.value === currentVal);
    adminCatFilter.value = hasVal ? currentVal : "all";
  }

  const tableItemCount = $("#tableItemCount");
  if (tableItemCount) tableItemCount.textContent = total;
}

function renderCategoriesAdmin() {
  const tbody = $("#categoryTableBody");
  if (!tbody) return;

  const esc = Shared ? Shared.escapeHtml : (s) => String(s || "");

  tbody.innerHTML = CATEGORIES.map((cat) => {
    const safeImg = Shared ? Shared.sanitizeImageUrl(cat.image) : cat.image;
    const safeAccent = /^#[0-9a-fA-F]{6}$/.test(cat.accent || "") ? cat.accent : "#b9f34b";
    const safeGlow = Shared && Shared.isSafeCssRgbaOrHex
      ? Shared.isSafeCssRgbaOrHex(cat.glow, "rgba(185, 243, 75, 0.4)")
      : "rgba(185, 243, 75, 0.4)";
    return `
      <tr>
        <td style="font-weight: 600;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${esc(safeImg)}" class="cat-thumb-img" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;" alt="${esc(cat.name)}" />
            <span>${esc(cat.name)}</span>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 16px; height: 16px; border-radius: 50%; background: ${safeAccent}; box-shadow: 0 0 8px ${safeGlow};"></div>
            <span style="font-family: monospace; font-size: 0.85rem;">${esc(safeAccent)}</span>
          </div>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group">
            <button type="button" class="btn-icon edit" data-action="edit-cat" data-id="${esc(cat.id)}" title="Sửa">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="btn-icon danger" data-action="delete-cat" data-id="${esc(cat.id)}" title="Xóa">
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

  tbody.querySelectorAll(".cat-thumb-img").forEach((img) => {
    img.addEventListener("error", () => {
      if (!img.dataset.fallbackApplied) {
        img.dataset.fallbackApplied = "1";
        img.src = "assets/demo/feedback-01.png";
      }
    });
  });
}

function setupCategoryListeners() {
  const form = $("#categoryManageForm");
  const cancelBtn = $("#cancelCatEditBtn");
  const tbody = $("#categoryTableBody");
  const syncBtn = $("#syncCategoriesBtn");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const idInput = $("#editCatId").value.trim();
      const name = $("#catNameInput").value.trim();
      const accent = $("#catColorInput").value;
      const image = $("#catImageInput").value.trim();

      if (!name || !accent || !image) {
        showToast("Vui lòng điền đủ các trường bắt buộc!");
        return;
      }

      if (Shared && !Shared.isSafeImageUrl(image)) {
        showToast("❌ Đường dẫn ảnh danh mục không hợp lệ!");
        return;
      }

      const colors = Shared ? Shared.hexToCategoryColors(accent) : { accent, glow: accent, dim: accent };
      let targetCat = null;
      let targetOrder = CATEGORIES.length;

      if (idInput) {
        const idx = CATEGORIES.findIndex((c) => c.id === idInput);
        if (idx !== -1) {
          CATEGORIES[idx] = {
            ...CATEGORIES[idx],
            name,
            accent: colors.accent,
            glow: colors.glow,
            dim: colors.dim,
            image
          };
          targetCat = CATEGORIES[idx];
          targetOrder = idx;
        }
      } else {
        const newId = "cat_" + Date.now().toString(36);
        targetCat = {
          id: newId,
          name,
          count: 0,
          accent: colors.accent,
          glow: colors.glow,
          dim: colors.dim,
          image,
          sort_order: CATEGORIES.length
        };
        CATEGORIES.push(targetCat);
      }

      saveDynamicCategoriesAdmin();

      if (targetCat && typeof isSupabaseConfigured === "function" && isSupabaseConfigured() && typeof upsertSupabaseCategory === "function") {
        const res = await upsertSupabaseCategory(targetCat, targetOrder);
        if (res && res.supported && res.ok) {
          updateCategorySyncBadge("synced");
          showToast(idInput ? "⚡ Đã cập nhật danh mục lên Supabase!" : "⚡ Đã thêm danh mục mới lên Supabase!");
        } else if (res && !res.supported) {
          updateCategorySyncBadge("missing_table");
          showToast("Đã lưu danh mục cục bộ (cần chạy phase1_sync.sql để đồng bộ bảng categories).");
        } else {
          showToast(`⚠️ Đã lưu cục bộ, lỗi Supabase: ${res?.error || "không rõ"}`);
        }
      } else {
        showToast(idInput ? "Đã cập nhật danh mục!" : "Đã thêm danh mục mới!");
      }

      resetCategoryForm();
      renderAllAdmin();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", resetCategoryForm);
  }

  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "edit-cat") editCategoryAdmin(id);
      else if (action === "delete-cat") deleteCategoryAdmin(id);
    });
  }

  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) {
        showToast("❌ Vui lòng cấu hình Supabase trước!");
        return;
      }

      showToast("⏳ Đang đồng bộ danh mục lên Supabase...");
      const res = await upsertMultipleSupabaseCategories(CATEGORIES);
      if (res && res.supported && res.ok) {
        categoriesTableSupported = true;
        updateCategorySyncBadge("synced");
        showToast(`⚡ Đã đồng bộ ${CATEGORIES.length} danh mục lên Supabase!`);
      } else if (res && !res.supported) {
        updateCategorySyncBadge("missing_table");
        showToast("❌ Bảng categories chưa tồn tại trên Supabase. Hãy chạy supabase/phase1_sync.sql trước!");
      } else {
        showToast(`❌ Lỗi đồng bộ danh mục: ${res?.error || "không rõ"}`);
      }
    });
  }
}

function resetCategoryForm() {
  const form = $("#categoryManageForm");
  if (form) form.reset();
  if ($("#editCatId")) $("#editCatId").value = "";
  if ($("#saveCatBtn")) $("#saveCatBtn").textContent = "Thêm Danh Mục Mới";
  if ($("#cancelCatEditBtn")) $("#cancelCatEditBtn").style.display = "none";
}

function editCategoryAdmin(id) {
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat) return;
  $("#editCatId").value = cat.id;
  $("#catNameInput").value = cat.name;
  $("#catColorInput").value = cat.accent;
  $("#catImageInput").value = cat.image;

  $("#saveCatBtn").textContent = "Lưu Thay Đổi";
  $("#cancelCatEditBtn").style.display = "inline-flex";
  $("#catNameInput").focus();
  window.scrollTo({ top: $("#categoryManageForm").offsetTop - 100, behavior: "smooth" });
}

async function countFeedbacksUsingCategory(cat) {
  if (!cat) return 0;
  let count = adminItems.filter((item) => {
    const matched = matchCategory(item.category);
    return matched && matched.id === cat.id;
  }).length;

  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured() && typeof fetchSupabaseFeedbacks === "function") {
    const remoteRows = await fetchSupabaseFeedbacks();
    if (Array.isArray(remoteRows)) {
      const remoteCount = remoteRows.filter((row) => {
        const matched = matchCategory(row.category);
        return matched && matched.id === cat.id;
      }).length;
      count = Math.max(count, remoteCount);
    }
  }

  return count;
}

async function deleteCategoryAdmin(id) {
  if (CATEGORIES.length <= 1) {
    showToast("Phải có ít nhất 1 danh mục!");
    return;
  }

  const targetCat = CATEGORIES.find((c) => c.id === id);
  if (!targetCat) return;

  const refCount = await countFeedbacksUsingCategory(targetCat);
  if (refCount > 0) {
    showToast(
      `❌ Danh mục "${targetCat.name}" đang có ${refCount} feedback dùng — chuyển sang danh mục khác trước khi xóa!`
    );
    return;
  }

  if (!confirm("Bạn có chắc chắn muốn xóa danh mục này?")) return;

  CATEGORIES = CATEGORIES.filter((c) => c.id !== id);
  saveDynamicCategoriesAdmin();

  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured() && typeof deleteSupabaseCategory === "function") {
    const res = await deleteSupabaseCategory(id);
    if (res && res.supported && res.ok) {
      showToast("⚡ Đã xóa danh mục khỏi Supabase!");
    } else {
      showToast("Đã xóa danh mục cục bộ!");
    }
  } else {
    showToast("Đã xóa danh mục!");
  }

  renderAllAdmin();
}

// 5. Render Admin Table List
function renderTable() {
  const tbody = $("#adminTableBody");
  if (!tbody) return;

  const esc = Shared ? Shared.escapeHtml : (s) => String(s || "");
  const keyword = $("#adminSearchInput") ? $("#adminSearchInput").value.trim() : "";
  const catFilter = $("#adminCatFilter") ? $("#adminCatFilter").value : "all";

  const filtered = adminItems.filter((item) => {
    const catNameStr = item.category || "";
    const fname = item.filename || item.path || "";
    const title = item.title || "";

    if (catFilter !== "all") {
      const foundCat = matchCategory(catNameStr);
      if (catFilter === "other") {
        if (foundCat) return false;
      } else if (!foundCat || foundCat.id !== catFilter) {
        return false;
      }
    }

    if (keyword) {
      const normKw = normalizeText(keyword);
      return (
        normalizeText(catNameStr).includes(normKw) ||
        normalizeText(fname).includes(normKw) ||
        normalizeText(title).includes(normKw)
      );
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

  tbody.innerHTML = paginated
    .map((item) => {
      const imgSrc = Shared ? Shared.sanitizeImageUrl(item.path || item.src) : item.path || item.src || "assets/demo/feedback-01.png";
      const matched = matchCategory(item.category);
      const catName = matched ? matched.name : item.category || "Giao dịch chung";
      const filename = item.filename || (item.path ? item.path.split("/").pop() : "File ảnh");
      const displayTitle = item.title || catName;

      let sourceBadge = "";
      if (item.isSupabase) {
        sourceBadge = `<span style="font-size: 0.7rem; background: rgba(0,240,255,0.16); color: var(--accent-cyan); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Supabase</span>`;
      } else if (!item.isBase) {
        sourceBadge = `<span style="font-size: 0.7rem; background: rgba(185,243,75,0.2); color: var(--accent-primary); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Local</span>`;
      }

      return `
      <tr>
        <td>
          <img src="${esc(imgSrc)}" class="thumb-preview" data-action="preview" data-src="${esc(imgSrc)}" alt="Thumb" />
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
            ${esc(displayTitle)} ${sourceBadge}
          </div>
          <div style="font-size: 0.8rem; color: var(--accent-cyan); margin-top: 2px;">
            ${esc(catName)}
          </div>
        </td>
        <td>
          <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${esc(item.path || filename)}">
            ${esc(filename)}
          </div>
        </td>
        <td style="text-align: right;">
          <div class="action-btn-group">
            <button type="button" class="btn-icon edit" data-action="edit" data-id="${esc(item.id)}" title="Sửa">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="btn-icon danger" data-action="delete" data-id="${esc(item.id)}" title="Xóa">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  tbody.querySelectorAll(".thumb-preview").forEach((img) => {
    img.addEventListener("error", () => {
      if (!img.dataset.fallbackApplied) {
        img.dataset.fallbackApplied = "1";
        img.src = "assets/demo/feedback-01.png";
      }
    });
  });

  renderAdminPagination(totalPages);
}

function renderAdminPagination(totalPages) {
  const paginationEl = $("#adminPagination");
  if (!paginationEl) return;

  if (totalPages <= 1) {
    paginationEl.innerHTML = "";
    return;
  }

  let html = `
    <button type="button" class="page-btn" data-page="${adminCurrentPage - 1}" ${adminCurrentPage === 1 ? "disabled" : ""} aria-label="Trang trước">
      ‹ Trước
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= adminCurrentPage - 2 && i <= adminCurrentPage + 2)) {
      html += `
        <button type="button" class="page-btn ${i === adminCurrentPage ? "active" : ""}" data-page="${i}">
          ${i}
        </button>
      `;
    } else if (i === adminCurrentPage - 3 || i === adminCurrentPage + 3) {
      html += `<span class="page-ellipsis">...</span>`;
    }
  }

  html += `
    <button type="button" class="page-btn" data-page="${adminCurrentPage + 1}" ${adminCurrentPage === totalPages ? "disabled" : ""} aria-label="Trang sau">
      Sau ›
    </button>
  `;

  paginationEl.innerHTML = html;
}

function changeAdminPage(page) {
  adminCurrentPage = page;
  renderTable();
  const tableWrapper = $(".feedback-table-wrapper");
  if (tableWrapper) {
    tableWrapper.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// 6. Client-side Image Compression (WebP/JPEG Blob + Preview DataURL)
function readFileAsDataURL(blobOrFile) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result || "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blobOrFile);
  });
}

function canvasToBlobPromise(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    if (!canvas.toBlob) {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function compressImageFile(file, maxWidth = 1400, quality = 0.82) {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    return { file, base64: "" };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width > maxWidth || height > maxWidth) {
      if (width > height) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      } else {
        width = Math.round((width * maxWidth) / height);
        height = maxWidth;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    let compressedBlob = await canvasToBlobPromise(canvas, "image/webp", quality);
    let targetExt = "webp";

    if (!compressedBlob || compressedBlob.type !== "image/webp") {
      compressedBlob = await canvasToBlobPromise(canvas, "image/jpeg", quality);
      targetExt = "jpg";
    }

    // Keep original file if already tiny and not resized
    const wasResized = width !== (img.naturalWidth || img.width) || height !== (img.naturalHeight || img.height);
    if (!compressedBlob || (!wasResized && compressedBlob.size >= file.size)) {
      const fallbackDataUrl = await readFileAsDataURL(file);
      return { file, base64: fallbackDataUrl };
    }

    const baseName = (file.name || "feedback").replace(/\.[^.]+$/, "");
    const compressedFile = new File([compressedBlob], `${baseName}.${targetExt}`, {
      type: compressedBlob.type,
      lastModified: Date.now()
    });

    const dataUrl = await readFileAsDataURL(compressedFile);
    return { file: compressedFile, base64: dataUrl };
  } catch (err) {
    console.warn("Bỏ qua nén ảnh, dùng file gốc:", err);
    const fallbackDataUrl = await readFileAsDataURL(file);
    return { file, base64: fallbackDataUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function handleBatchFileSelection(fileList) {
  if (!fileList || fileList.length === 0) return;

  const files = Array.from(fileList).filter((f) => f && f.type && f.type.startsWith("image/"));
  if (files.length === 0) {
    showToast("Vui lòng chọn các file định dạng hình ảnh!");
    return;
  }

  // In edit mode, selecting a new file replaces the old edit preview item
  if (editingId) {
    selectedBatchFiles = [];
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isDup = selectedBatchFiles.some(
      (existing) => existing.file && existing.name === file.name && existing.size === file.size
    );
    if (isDup) continue;

    const { file: compressedFile, base64 } = await compressImageFile(file, 1400, 0.82);

    selectedBatchFiles.push({
      id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`,
      file: compressedFile,
      size: file.size,
      compressedSize: compressedFile.size,
      base64,
      name: compressedFile.name || file.name
    });

    if (editingId) break; // Only 1 replacement image when editing a single feedback
  }

  renderMultiPreviewGrid();
}

function renderMultiPreviewGrid() {
  const container = $("#imagePreviewContainer");
  const grid = $("#multiPreviewGrid");
  const countBadge = $("#previewCountBadge");
  const submitBtn = $("#submitBtn");

  if (!container || !grid) return;

  const esc = Shared ? Shared.escapeHtml : (s) => String(s || "");
  const count = selectedBatchFiles.length;

  if (count === 0) {
    container.style.display = "none";
    grid.innerHTML = "";
    if (submitBtn) {
      submitBtn.innerHTML = editingId ? "<span>⚡ Cập Nhật Feedback</span>" : "<span>⚡ Lưu Feedback</span>";
    }
    return;
  }

  container.style.display = "block";
  if (countBadge) {
    countBadge.textContent = editingId ? "Ảnh đang gắn cho mục sửa" : `Đã chọn: ${count} ảnh`;
  }
  if (submitBtn) {
    submitBtn.innerHTML = editingId
      ? "<span>⚡ Cập Nhật Feedback</span>"
      : `<span>⚡ Lưu ${count} Feedback Mới</span>`;
  }

  grid.innerHTML = selectedBatchFiles
    .map((item, idx) => {
      const src = item.base64 || item.previewUrl || "assets/demo/feedback-01.png";
      return `
        <div class="preview-thumb-card">
          <img src="${esc(src)}" alt="Preview" />
          <button type="button" class="preview-thumb-remove" data-preview-id="${esc(item.id)}" title="Xóa ảnh này">✕</button>
          <span class="preview-thumb-label">#${idx + 1} ${esc(item.name)}</span>
        </div>
      `;
    })
    .join("");
}

function removeSinglePreview(id) {
  selectedBatchFiles = selectedBatchFiles.filter((f) => f.id !== id);
  renderMultiPreviewGrid();
}

function removeAllPreviewImages() {
  selectedBatchFiles = [];
  const pathInp = $("#imagePathInput");
  if (pathInp && !editingId) pathInp.value = "";
  const fileInp = $("#imageFileInput");
  if (fileInp) fileInp.value = "";
  renderMultiPreviewGrid();
}

// 7. Form, Drag & Drop, and Table Event Listeners
function setupFormListeners() {
  const form = $("#addFeedbackForm");
  const dropzone = $("#dropzone");
  const fileInput = $("#imageFileInput");
  const previewGrid = $("#multiPreviewGrid");
  const removeAllBtn = $("#removeAllPreviewBtn");
  const cancelBtn = $("#cancelEditBtn");
  const tbody = $("#adminTableBody");
  const paginationEl = $("#adminPagination");

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleBatchFileSelection(e.dataTransfer.files);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleBatchFileSelection(e.target.files);
      }
    });
  }

  if (previewGrid) {
    previewGrid.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-preview-id]");
      if (btn) removeSinglePreview(btn.dataset.previewId);
    });
  }

  if (removeAllBtn) {
    removeAllBtn.addEventListener("click", removeAllPreviewImages);
  }

  if (form) {
    form.addEventListener("submit", handleAdminFormSubmit);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", resetForm);
  }

  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const actionEl = e.target.closest("[data-action]");
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      if (action === "preview") {
        const src = actionEl.dataset.src;
        if (src && (!Shared || Shared.isSafeImageUrl(src))) {
          window.open(src, "_blank", "noopener");
        }
      } else if (action === "edit") {
        editFeedbackItem(actionEl.dataset.id);
      } else if (action === "delete") {
        deleteFeedbackItem(actionEl.dataset.id);
      }
    });
  }

  if (paginationEl) {
    paginationEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button.page-btn[data-page]");
      if (!btn || btn.disabled) return;
      changeAdminPage(Number(btn.dataset.page));
    });
  }
}

async function handleAdminFormSubmit(e) {
  e.preventDefault();

  const catSelect = $("#categorySelect");
  const titleInp = $("#titleInput");
  const pathInp = $("#imagePathInput");
  const editIdInp = $("#editItemId");
  const submitBtn = $("#submitBtn");

  const rawCategory = catSelect ? catSelect.value : "M4A1 Battle of Faith";
  const category = Shared ? Shared.resolveCategoryDisplayName(CATEGORIES, rawCategory) : rawCategory;
  const title = titleInp ? titleInp.value.trim() : "";
  const pathVal = pathInp ? pathInp.value.trim() : "";
  const editId = editIdInp ? editIdInp.value : "";

  const supaReady = typeof isSupabaseConfigured === "function" && isSupabaseConfigured();

  // 1. Edit existing feedback item
  if (editId) {
    const idx = adminItems.findIndex((i) => String(i.id) === String(editId));
    if (idx === -1) {
      showToast("❌ Không tìm thấy feedback cần sửa!");
      return;
    }

    const existing = adminItems[idx];
    const replacementEntry = selectedBatchFiles.find((f) => f.file instanceof File) || null;
    const newTitle = title || `${category} — Feedback`;

    if (!replacementEntry && !pathVal && !existing.path) {
      showToast("❌ Vui lòng cung cấp đường dẫn ảnh hoặc chọn ảnh mới!");
      return;
    }

    const targetPath = pathVal || existing.path;
    if (!replacementEntry && Shared && !Shared.isSafeImageUrl(targetPath)) {
      showToast("❌ Đường dẫn ảnh không hợp lệ!");
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      if (existing.isSupabase && supaReady && typeof updateSupabaseFeedback === "function") {
        showToast("⏳ Đang cập nhật feedback lên Supabase...");
        const updated = await updateSupabaseFeedback(
          existing.id,
          {
            title: newTitle,
            category,
            path: targetPath,
            filename: replacementEntry
              ? replacementEntry.name
              : targetPath.split("/").pop() || existing.filename
          },
          replacementEntry ? replacementEntry.file : null,
          existing.path
        );

        adminItems[idx] = {
          ...existing,
          ...updated,
          isSupabase: true
        };
        showToast("⚡ Đã cập nhật feedback lên Supabase!");
      } else {
        // Local custom item or unseeded base item
        const updatedPath = replacementEntry ? replacementEntry.base64 : targetPath;
        const updatedFilename = replacementEntry
          ? replacementEntry.name
          : targetPath.split("/").pop() || existing.filename;

        if (existing.isBase && existing.path && existing.path !== updatedPath && Shared) {
          Shared.addDeletedBasePath(existing.path);
        }

        adminItems[idx] = {
          ...existing,
          category,
          title: newTitle,
          path: updatedPath,
          filename: updatedFilename,
          isEdited: true
        };
        saveCustomItems();
        showToast("Đã cập nhật feedback (lưu cục bộ)!");
      }

      resetForm();
      renderAllAdmin();
    } catch (err) {
      showToast(`❌ Lỗi cập nhật: ${err.message}`);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
    return;
  }

  // 2. Batch Upload (1 or more image files)
  const uploadEntries = selectedBatchFiles.filter((f) => f.file instanceof File);
  if (uploadEntries.length > 0) {
    const total = uploadEntries.length;
    const newItems = uploadEntries.map((item, index) => {
      const displayTitle =
        total > 1
          ? title
            ? `${title} #${String(index + 1).padStart(2, "0")}`
            : `${category} — Feedback #${String(index + 1).padStart(2, "0")}`
          : title || `${category} — Feedback`;

      return {
        id: `custom-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        path: supaReady ? "" : item.base64,
        category,
        title: displayTitle,
        filename: item.name || `upload-${Date.now()}-${index}.webp`,
        date: new Date().toISOString(),
        isBase: false,
        isSupabase: false
      };
    });

    const filesToUpload = uploadEntries.map((item) => item.file);

    if (submitBtn) submitBtn.disabled = true;

    try {
      if (supaReady && typeof addMultipleSupabaseFeedbacks === "function") {
        showToast(`⏳ Đang nén và tải ${total} ảnh lên Supabase...`);
        await addMultipleSupabaseFeedbacks(newItems, filesToUpload);
        adminItems.unshift(...newItems);
        showToast(`⚡ Đã lưu thành công ${total} feedback lên Supabase!`);
      } else {
        adminItems.unshift(...newItems);
        saveCustomItems();
        showToast(`⚡ Đã lưu ${total} feedback vào LocalStorage!`);
      }

      resetForm();
      renderAllAdmin();
    } catch (err) {
      showToast(`❌ Upload Supabase thất bại: ${err.message}`);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
    return;
  }

  // 3. Add by Manual URL / Path
  if (pathVal) {
    if (Shared && !Shared.isSafeImageUrl(pathVal)) {
      showToast("❌ Đường dẫn ảnh không hợp lệ!");
      return;
    }

    const manualItem = {
      id: `custom-${Date.now()}`,
      path: pathVal,
      category,
      title: title || `${category} — Feedback`,
      filename: pathVal.split("/").pop() || "image.jpg",
      date: new Date().toISOString(),
      isBase: false,
      isSupabase: false
    };

    if (submitBtn) submitBtn.disabled = true;

    try {
      if (supaReady && typeof addSupabaseFeedback === "function") {
        showToast("⏳ Đang lưu URL feedback lên Supabase...");
        const inserted = await addSupabaseFeedback(manualItem, null);
        if (inserted) {
          adminItems.unshift({
            ...inserted,
            filename: inserted.filename || manualItem.filename,
            isSupabase: true
          });
          showToast("⚡ Đã lưu feedback URL lên Supabase!");
        }
      } else {
        adminItems.unshift(manualItem);
        saveCustomItems();
        showToast("⚡ Đã lưu feedback vào LocalStorage!");
      }

      resetForm();
      renderAllAdmin();
    } catch (err) {
      showToast(`❌ Không thể lưu URL lên Supabase: ${err.message}`);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
    return;
  }

  showToast("Vui lòng chọn/kéo thả ít nhất 1 ảnh hoặc nhập đường dẫn!");
}

function resetForm() {
  editingId = null;
  selectedBatchFiles = [];
  const form = $("#addFeedbackForm");
  if (form) form.reset();
  const editIdInp = $("#editItemId");
  if (editIdInp) editIdInp.value = "";
  const fileInp = $("#imageFileInput");
  if (fileInp) fileInp.value = "";
  renderMultiPreviewGrid();
  $("#formTitle").textContent = "Thêm Feedback Mới";
  $("#submitBtn").innerHTML = "<span>⚡ Lưu Feedback</span>";
  $("#cancelEditBtn").style.display = "none";
}

// Supabase UI Settings Form Listener
function setupSupabaseUI() {
  const supaForm = $("#supabaseConfigForm");
  const supaUrlInput = $("#supaUrlInput");
  const supaKeyInput = $("#supaKeyInput");

  if (supaUrlInput) {
    supaUrlInput.value = localStorage.getItem("SUPABASE_URL") || (typeof DEFAULT_SUPABASE_URL !== "undefined" ? DEFAULT_SUPABASE_URL : "");
  }
  if (supaKeyInput) {
    supaKeyInput.value = localStorage.getItem("SUPABASE_ANON_KEY") || (typeof DEFAULT_SUPABASE_ANON_KEY !== "undefined" ? DEFAULT_SUPABASE_ANON_KEY : "");
  }

  if (supaForm) {
    supaForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const url = supaUrlInput.value.trim();
      const key = supaKeyInput.value.trim();

      if (url && key) {
        localStorage.setItem("SUPABASE_URL", url);
        localStorage.setItem("SUPABASE_ANON_KEY", key);
        if (typeof initSupabaseClient === "function") initSupabaseClient(url, key);
        showToast("Đã lưu cấu hình Supabase!");
      } else {
        localStorage.removeItem("SUPABASE_URL");
        localStorage.removeItem("SUPABASE_ANON_KEY");
        if (typeof initSupabaseClient === "function") initSupabaseClient("", "");
        showToast("Đã ngắt kết nối Supabase!");
      }

      await loadCategoriesAdmin();
      await loadAdminItems();
      renderAllAdmin();
    });
  }

  // Seed existing feedbackData items into Supabase (with duplicate protection)
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

      if (!confirm(`Bạn có muốn nhập ${feedbackData.length} feedback từ data.js vào Supabase (tự động bỏ qua ảnh đã tồn tại) không?`)) {
        return;
      }

      seedBtn.disabled = true;
      showToast(`⏳ Đang kiểm tra & đẩy dữ liệu từ data.js lên Supabase...`);

      try {
        const rows = feedbackData.map((item, idx) => ({
          title: `${item.category} — Feedback #${String(idx + 1).padStart(2, "0")}`,
          category: item.category,
          path: item.path,
          filename: item.filename || item.path.split("/").pop()
        }));

        const result = await seedSupabaseFeedbacks(rows);
        showToast(
          `⚡ Đã nhập ${result.inserted} feedback mới vào Supabase (bỏ qua ${result.skipped} ảnh đã tồn tại)!`
        );
        await loadAdminItems();
        renderAllAdmin();
      } catch (err) {
        console.error("Error seeding data:", err);
        showToast(`❌ Lỗi nhập Supabase: ${err.message}`);
      } finally {
        seedBtn.disabled = false;
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

// 8. Edit & Delete Actions
function editFeedbackItem(id) {
  const item = adminItems.find((i) => String(i.id) === String(id));
  if (!item) return;

  editingId = item.id;
  const editIdInp = $("#editItemId");
  if (editIdInp) editIdInp.value = item.id;

  const catSelect = $("#categorySelect");
  if (catSelect) {
    const matched = matchCategory(item.category);
    const desiredVal = matched ? matched.name : item.category || "Giao dịch chung";
    const hasOption = Array.from(catSelect.options).some((opt) => opt.value === desiredVal);
    if (!hasOption && desiredVal) {
      const tempOpt = document.createElement("option");
      tempOpt.value = desiredVal;
      tempOpt.textContent = desiredVal;
      catSelect.appendChild(tempOpt);
    }
    catSelect.value = desiredVal;
  }

  $("#titleInput").value = item.title || "";
  $("#imagePathInput").value = item.path || "";

  selectedBatchFiles = [
    {
      id: "edit_preview",
      file: null,
      base64: item.path || "",
      previewUrl: item.path || "",
      name: item.filename || "image.jpg"
    }
  ];
  renderMultiPreviewGrid();

  $("#formTitle").textContent = "Chỉnh Sửa Feedback";
  $("#submitBtn").innerHTML = "<span>⚡ Cập Nhật Feedback</span>";
  $("#cancelEditBtn").style.display = "inline-flex";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteFeedbackItem(id) {
  if (!confirm("Bạn có chắc chắn muốn xóa feedback này khỏi CSDL?")) return;

  const itemToDelete = adminItems.find((i) => String(i.id) === String(id));
  if (!itemToDelete) return;

  const targetPath = itemToDelete.path || null;
  let supaDeleted = false;
  let storageWarning = null;

  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured() && itemToDelete.isSupabase) {
    const res = await deleteSupabaseFeedback(itemToDelete.id, targetPath);
    if (!res || !res.ok) {
      showToast(`❌ Lỗi xóa trên Supabase: ${res?.error || "không rõ"}`);
      return;
    }
    supaDeleted = true;
    if (res.storageError) {
      storageWarning = res.storageError;
    }
  }

  if (itemToDelete.isBase && targetPath && Shared) {
    Shared.addDeletedBasePath(targetPath);
  }

  if (targetPath) {
    adminItems = adminItems.filter((i) => String(i.id) !== String(id) && i.path !== targetPath);
  } else {
    adminItems = adminItems.filter((i) => String(i.id) !== String(id));
  }

  saveCustomItems();

  if (supaDeleted) {
    await loadAdminItems();
  }

  if (storageWarning) {
    showToast(`⚠️ Đã xóa bản ghi DB nhưng chưa xóa được file Storage: ${storageWarning}`);
  } else {
    showToast("⚡ Đã xóa feedback và dọn ảnh liên quan thành công!");
  }

  renderAllAdmin();
}

// 9. Search & Filter Controls
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

// 10. Database Sync & Backup Controls
function setupDatabaseSync() {
  $("#exportJsBtn")?.addEventListener("click", () => {
    const exportArray = adminItems.map((item) => ({
      path: item.path,
      category: item.category,
      filename: item.filename || (item.path ? item.path.split("/").pop() : "image.jpg")
    }));

    let jsContent = `const feedbackData = ${JSON.stringify(exportArray, null, 2)};\n\n`;
    jsContent += `const CATEGORY_DATA = ${JSON.stringify(CATEGORIES, null, 2)};\n`;
    downloadFile(jsContent, "data.js", "text/javascript");
    showToast("Đã tải xuống file data.js thành công!");
  });

  $("#downloadJsonBtn")?.addEventListener("click", () => {
    const jsonStr = JSON.stringify(adminItems, null, 2);
    downloadFile(jsonStr, `feedback_database_backup_${Date.now()}.json`, "application/json");
    showToast("Đã xuất file Backup JSON CSDL!");
  });

  $("#importJsonInput")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (Array.isArray(imported)) {
          adminItems = imported.map((item) => ({ ...item, isSupabase: false }));
          saveCustomItems();
          renderAllAdmin();
          showToast("Đã nhập dữ liệu CSDL từ file JSON thành công!");
        }
      } catch (err) {
        showToast("❌ Lỗi file JSON không hợp lệ!");
      }
    };
    reader.readAsText(file);
  });

  $("#clearAllBtn")?.addEventListener("click", async () => {
    if (
      !confirm(
        "Reset bộ nhớ đệm LocalStorage về mặc định? Thao tác này xóa các chỉnh sửa/thêm mới chỉ lưu ở trình duyệt (dữ liệu đã lưu trên Supabase vẫn được giữ nguyên)."
      )
    ) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    if (Shared) Shared.clearDeletedBasePaths();
    await loadAdminItems();
    renderAllAdmin();
    showToast("⚡ Đã reset bộ nhớ đệm trình duyệt và tải lại dữ liệu!");
  });
}

function downloadFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

let toastTimer = null;
function showToast(message) {
  const toast = $("#adminToast");
  const msgEl = $("#toastMessage");
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.add("show");

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}
