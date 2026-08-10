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
let selectedRawFile = null; // Stores File object for Supabase Storage upload

// Helper Selectors
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// 1. Initialize Admin Panel
document.addEventListener("DOMContentLoaded", async () => {
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
      adminItems = supaItems;
      return;
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
      customData = JSON.parse(raw);
    }
  } catch (e) {
    console.error("Error reading custom feedback items:", e);
  }

  adminItems = [...customData, ...baseData];
}

// Save Custom Items to LocalStorage
function saveCustomItems() {
  const customOnly = adminItems.filter(item => !item.isBase || item.isEdited);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
}

// 3. Render All Dashboard Components
function renderAllAdmin() {
  renderStats();
  renderTable();
}

// Render Stats Cards
function renderStats() {
  const total = adminItems.length;
  $("#statTotal").textContent = total;

  let m4Count = 0;
  let akCount = 0;
  let daoCount = 0;
  let duCount = 0;
  let m700Count = 0;

  adminItems.forEach(item => {
    const cat = (item.category || "").toLowerCase();
    if (cat.includes("m4a1")) m4Count++;
    else if (cat.includes("ak")) akCount++;
    else if (cat.includes("dao")) daoCount++;
    else if (cat.includes("dù")) duCount++;
    else if (cat.includes("m700")) m700Count++;
  });

  $("#statM4").textContent = m4Count;
  $("#statAk").textContent = akCount;
  $("#statDao").textContent = daoCount;
  $("#statDu").textContent = duCount;
  $("#statM700").textContent = m700Count;
  $("#tableItemCount").textContent = total;
}

// 4. Render Admin Table List
function renderTable() {
  const tbody = $("#adminTableBody");
  if (!tbody) return;

  const keyword = $("#adminSearchInput") ? $("#adminSearchInput").value.trim().toLowerCase() : "";
  const catFilter = $("#adminCatFilter") ? $("#adminCatFilter").value : "all";

  let filtered = adminItems.filter(item => {
    const cat = (item.category || "").toLowerCase();
    const fname = (item.filename || item.path || "").toLowerCase();
    const title = (item.title || "").toLowerCase();

    // Category filter
    if (catFilter !== "all") {
      if (catFilter === "m4a1" && !cat.includes("m4a1")) return false;
      if (catFilter === "ak" && !cat.includes("ak")) return false;
      if (catFilter === "dao" && !cat.includes("dao")) return false;
      if (catFilter === "du" && !cat.includes("dù")) return false;
      if (catFilter === "m700" && !cat.includes("m700")) return false;
    }

    // Keyword filter
    if (keyword) {
      return cat.includes(keyword) || fname.includes(keyword) || title.includes(keyword);
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-muted);">
          Không tìm thấy feedback nào phù hợp.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
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
}

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

  // Form Submit
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const category = $("#categorySelect").value;
      const title = $("#titleInput").value.trim();
      const pathVal = $("#imagePathInput").value.trim();

      const base64 = window.currentPreviewBase64 || currentPreviewBase64 || "";
      const rawFile = window.selectedRawFile || selectedRawFile;
      const finalPath = base64 || pathVal;

      if (!finalPath && !rawFile) {
        showToast("Vui lòng tải ảnh lên hoặc nhập đường dẫn ảnh!");
        return;
      }

      // 1. Try Supabase Mode Active
      if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
        try {
          showToast("⏳ Đang tải dữ liệu lên Supabase...");
          if (editingId) {
            await updateSupabaseFeedback(editingId, {
              category: category,
              title: title || `${category} — Feedback`,
              path: finalPath
            });
            showToast("⚡ Đã cập nhật feedback trên Supabase!");
          } else {
            await addSupabaseFeedback(
              { category, title: title || `${category} — Feedback`, path: finalPath },
              rawFile
            );
            showToast("⚡ Đã thêm feedback mới vào Supabase thành công!");
          }
          await loadAdminItems();
          resetForm();
          renderAllAdmin();
          return;
        } catch (err) {
          console.warn("Supabase save error, fallback to local:", err);
          showToast(`⚠️ Supabase chưa khởi tạo bảng, đang lưu tạm vào máy...`);
        }
      }

      // 2. LocalStorage Fallback Mode
      if (editingId) {
        // Update existing
        const index = adminItems.findIndex(item => item.id === editingId);
        if (index !== -1) {
          adminItems[index] = {
            ...adminItems[index],
            category: category,
            title: title || `${category} — Feedback`,
            path: finalPath,
            filename: base64 ? "uploaded_image.png" : finalPath.split("/").pop(),
            isEdited: true
          };
          showToast("⚡ Đã cập nhật feedback thành công!");
        }
      } else {
        // Add new
        const newItem = {
          id: `custom-${Date.now()}`,
          path: finalPath,
          category: category,
          filename: base64 ? `upload-${Date.now()}.png` : finalPath.split("/").pop(),
          title: title || `${category} — Feedback mới`,
          date: new Date().toISOString(),
          isBase: false
        };

        adminItems.unshift(newItem);
        showToast("⚡ Đã lưu feedback mới thành công!");
      }

      saveCustomItems();
      resetForm();
      renderAllAdmin();
    });
  }

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
    if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
      const ok = await deleteSupabaseFeedback(id);
      if (ok) {
        showToast("Đã xóa feedback khỏi Supabase!");
        await loadAdminItems();
        renderAllAdmin();
        return;
      }
    }

    adminItems = adminItems.filter(i => i.id !== id);
    saveCustomItems();
    showToast("Đã xóa feedback khỏi danh sách!");
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

  if (searchInput) searchInput.addEventListener("input", renderTable);
  if (catFilter) catFilter.addEventListener("change", renderTable);
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

    const jsContent = `const feedbackData = ${JSON.stringify(exportArray, null, 2)};\n`;
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
