/**
 * ==========================================================================
 * KHO FEEDBACK - CORE LOGIC & INTERACTIVE CONTROLS
 * ==========================================================================
 */

// 1. Core Category Definitions & Weapon Metadata
let CATEGORIES = [];

function loadDynamicCategories() {
  let customCats = [];
  try {
    const raw = localStorage.getItem("custom_categories_data");
    if (raw) customCats = JSON.parse(raw);
  } catch (e) {}

  if (customCats.length > 0) {
    CATEGORIES = customCats;
  } else if (typeof CATEGORY_DATA !== "undefined" && Array.isArray(CATEGORY_DATA)) {
    CATEGORIES = CATEGORY_DATA;
  } else {
    // Fallback if data.js is old
    CATEGORIES = [
      { id: "m4a1", name: "M4A1 Battle of Faith", short: "M4", tier: "Thần thoại", count: 0, accent: "#ff3366", glow: "rgba(255, 51, 102, 0.4)", dim: "rgba(255, 51, 102, 0.12)", image: "pictures/thẻ/M4A1.jpg" },
      { id: "ak", name: "Ak Riu Thiêng", short: "AR", tier: "Huyền thoại", count: 0, accent: "#f59e0b", glow: "rgba(245, 158, 11, 0.4)", dim: "rgba(245, 158, 11, 0.12)", image: "pictures/thẻ/AK Rìu Thiêng.jpg" },
      { id: "dao", name: "Đao Bướm", short: "DB", tier: "Cực hiếm", count: 0, accent: "#a855f7", glow: "rgba(168, 85, 247, 0.4)", dim: "rgba(168, 85, 247, 0.12)", image: "pictures/thẻ/dao bướm.jpg" },
      { id: "du", name: "Dù Saitama", short: "DS", tier: "Hiếm", count: 0, accent: "#00f0ff", glow: "rgba(0, 240, 255, 0.4)", dim: "rgba(0, 240, 255, 0.12)", image: "pictures/thẻ/Dù Saitama.jpg" },
      { id: "m700", name: "M700 ELIZABETH", short: "M7", tier: "Độc quyền", count: 0, accent: "#10b981", glow: "rgba(16, 185, 129, 0.4)", dim: "rgba(16, 185, 129, 0.12)", image: "pictures/thẻ/M700.jpg" }
    ];
  }
}
loadDynamicCategories();


// Fallback demo images if feedbackData is empty
const DEMO_IMAGES = [
  { src: "assets/demo/feedback-01.png", title: "Feedback demo #01", category: "demo" },
  { src: "assets/demo/feedback-02.png", title: "Feedback demo #02", category: "demo" },
  { src: "assets/demo/feedback-03.png", title: "Feedback demo #03", category: "demo" }
];

// Application State
let selectedCategory = "all";
let currentItems = [];
let lightboxIndex = 0;
let currentPage = 1;
const ITEMS_PER_PAGE = 15;
let currentZoom = 1;

// DOM Helper
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

let supabaseFeedbacksData = null;

// Helper to get combined feedback data from Supabase, localStorage and data.js
function getRawFeedbackData() {
  let baseData = [];
  if (typeof feedbackData !== "undefined" && Array.isArray(feedbackData)) {
    baseData = [...feedbackData];
  }

  let supaData = [];
  if (supabaseFeedbacksData && Array.isArray(supabaseFeedbacksData)) {
    supaData = [...supabaseFeedbacksData];
  }

  let customData = [];
  try {
    const customStr = localStorage.getItem("custom_feedback_data");
    if (customStr) {
      const parsed = JSON.parse(customStr);
      if (Array.isArray(parsed)) customData = parsed;
    }
  } catch (e) {
    console.error("Error reading custom_feedback_data:", e);
  }

  const combined = supaData.length > 0 
    ? [...supaData, ...customData, ...baseData]
    : [...customData, ...baseData];

  const uniqueItems = [];
  const seenPaths = new Set();
  
  for (const item of combined) {
    const p = item.path || item.src || "";
    if (p && !seenPaths.has(p)) {
      seenPaths.add(p);
      uniqueItems.push(item);
    } else if (!p) {
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

// Async loader if Supabase is connected
async function loadSupabaseDataIfAvailable() {
  if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
    const data = await fetchSupabaseFeedbacks();
    if (data && Array.isArray(data) && data.length > 0) {
      supabaseFeedbacksData = data;
      initCategories();
      renderAll();
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadSupabaseDataIfAvailable();
});

// 2. Initialize Category Counts and Total
function initCategories() {
  const combined = getRawFeedbackData();
  CATEGORIES.forEach(cat => {
    let matchName = cat.name.toLowerCase();
    if (cat.id === "ak") matchName = "ak";
    if (cat.id === "dao") matchName = "dao";
    if (cat.id === "du") matchName = "dù";
    if (cat.id === "m4a1") matchName = "m4a1";
    if (cat.id === "m700") matchName = "m700";

    cat.count = combined.filter(item =>
      (item.category || "").toLowerCase().includes(matchName)
    ).length;
  });

  const totalCount = combined.length;
  const totalEl = $("#totalFeedback");
  if (totalEl) {
    totalEl.dataset.target = totalCount;
    totalEl.textContent = `${totalCount}+`;
  }
}

// 3. Transform Raw Feedback Items
function getRealItems() {
  const combined = getRawFeedbackData();
  if (!Array.isArray(combined) || combined.length === 0) {
    return [];
  }

  return combined.map((item, index) => {
    let catId = "other";
    let catName = item.category || "Khác";
    let lcCat = catName.toLowerCase();
    
    const foundCat = CATEGORIES.find(c => lcCat === c.name.toLowerCase() || lcCat.includes(c.name.toLowerCase()));
    
    // For backward compatibility with old data strings
    if (!foundCat) {
      if (lcCat.includes("m4a1")) catId = "m4a1";
      else if (lcCat.includes("ak")) catId = "ak";
      else if (lcCat.includes("dao")) catId = "dao";
      else if (lcCat.includes("dù")) catId = "du";
      else if (lcCat.includes("m700")) catId = "m700";
      else if (item.categoryId) catId = item.categoryId;
    } else {
      catId = foundCat.id;
    }

    return {
      id: item.id || `fb-${index}`,
      src: item.path || item.src,
      category: catId,
      categoryName: catName,
      title: item.title || `${catName} — Feedback #${String(combined.length - index).padStart(2, "0")}`,
      date: item.date || null,
      note: item.note || ""
    };
  });
}

// 4. Get Filtered Items based on Selected Category & Search Keyword
function getItems() {
  let items = getRealItems();

  if (items.length === 0) {
    items = [...DEMO_IMAGES];
  }

  if (selectedCategory !== "all") {
    items = items.filter(item => item.category === selectedCategory);
  }

  const searchInput = $("#searchInput");
  const keyword = searchInput ? searchInput.value.trim().toLowerCase() : "";

  if (keyword) {
    items = items.filter(item =>
      item.title.toLowerCase().includes(keyword) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(keyword))
    );
  }

  return items;
}

// 5. Render Category Cards in Browse Section
function renderCategories() {
  const grid = $("#categoryGrid");
  if (!grid) return;

  grid.innerHTML = CATEGORIES.map((cat, index) => `
    <article
      class="category-card ${selectedCategory === cat.id ? "active" : ""}"
      data-id="${cat.id}"
      style="--accent:${cat.accent}; --accent-glow:${cat.glow};"
    >
      <div class="category-image-wrap">
        <img src="${cat.image}" alt="${cat.name}" loading="lazy" />
        <span class="category-tier-badge">${cat.tier}</span>
      </div>
      <div class="category-meta">
        <span class="category-service-no">0${index + 1} / SERVICE</span>
      </div>
      <h3 class="category-title">${cat.name}</h3>
      <p class="category-count">${cat.count} FEEDBACK</p>
    </article>
  `).join("");

  $$(".category-card").forEach(card => {
    card.addEventListener("click", () => {
      selectedCategory = card.dataset.id;
      currentPage = 1;
      renderAll();
      const feedbackSec = $("#feedback");
      if (feedbackSec) {
        feedbackSec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

// 6. Render Filter Tabs & Dropdown Select
function renderFilters() {
  const tabsContainer = $("#filterTabs");
  const select = $("#categoryFilter");
  const realItems = getRealItems();
  const totalCount = realItems.length > 0 ? realItems.length : DEMO_IMAGES.length;

  if (tabsContainer) {
    let tabsHTML = `
      <button class="tab-btn ${selectedCategory === "all" ? "active" : ""}" data-id="all">
        <span>Tất cả</span>
        <span class="tab-count">${totalCount}</span>
      </button>
    `;

    tabsHTML += CATEGORIES.map(cat => `
      <button class="tab-btn ${selectedCategory === cat.id ? "active" : ""}" data-id="${cat.id}">
        <span>${cat.name}</span>
        <span class="tab-count">${cat.count}</span>
      </button>
    `).join("");

    tabsContainer.innerHTML = tabsHTML;

    $$(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedCategory = btn.dataset.id;
        currentPage = 1;
        renderAll();
      });
    });
  }

  if (select) {
    select.innerHTML = `
      <option value="all">Tất cả dịch vụ (${totalCount})</option>
      ${CATEGORIES.map(cat => `<option value="${cat.id}">${cat.name} (${cat.count})</option>`).join("")}
    `;
    select.value = selectedCategory;
  }
}

// 7. Render Feedback Gallery Grid
function renderGallery() {
  currentItems = getItems();

  const titleEl = $("#galleryTitle");
  if (titleEl) {
    if (selectedCategory === "all") {
      titleEl.textContent = "Tất cả Feedback Giao Dịch";
    } else {
      const activeCat = CATEGORIES.find(c => c.id === selectedCategory);
      titleEl.textContent = activeCat ? `Feedback ${activeCat.name}` : "Feedback";
    }
  }

  const galleryEl = $("#gallery");
  const emptyEl = $("#empty");
  if (!galleryEl) return;

  const totalPages = Math.ceil(currentItems.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = currentItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  if (paginatedItems.length === 0) {
    galleryEl.innerHTML = "";
    if (emptyEl) emptyEl.hidden = false;
    renderPagination(0);
    return;
  }

  if (emptyEl) emptyEl.hidden = true;

  galleryEl.innerHTML = paginatedItems.map((item, index) => {
    const globalIndex = startIndex + index;
    return `
      <article class="feedback-card" data-index="${globalIndex}">
        <div class="feedback-thumb-box">
          <img src="${item.src}" alt="${item.title}" loading="lazy" />
          <div class="feedback-overlay">
            <span class="overlay-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              Xem chi tiết
            </span>
          </div>
        </div>
        <div class="feedback-footer">
          <span class="feedback-index">#${String(globalIndex + 1).padStart(3, "0")}</span>
          <span class="feedback-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            XÁC MINH
          </span>
        </div>
      </article>
    `;
  }).join("");

  // Attach Lightbox Triggers
  $$(".feedback-card").forEach(card => {
    card.addEventListener("click", () => {
      openLightbox(Number(card.dataset.index));
    });
  });

  renderPagination(totalPages);
}

// 8. Render Pagination Controls
function renderPagination(totalPages) {
  const paginationEl = $("#pagination");
  if (!paginationEl) return;

  if (totalPages <= 1) {
    paginationEl.innerHTML = "";
    return;
  }

  let html = "";

  // Prev Button
  html += `
    <button class="page-btn" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""} aria-label="Trang trước">
      ‹ Trước
    </button>
  `;

  // Numbered Page Buttons with Smart Ellipsis
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `
        <button class="page-btn ${i === currentPage ? "active" : ""}" onclick="changePage(${i})">
          ${i}
        </button>
      `;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="page-ellipsis">...</span>`;
    }
  }

  // Next Button
  html += `
    <button class="page-btn" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? "disabled" : ""} aria-label="Trang sau">
      Sau ›
    </button>
  `;

  paginationEl.innerHTML = html;
}

// Global page change handler
window.changePage = function (page) {
  const totalPages = Math.ceil(currentItems.length / ITEMS_PER_PAGE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderGallery();

  const feedbackSec = $("#feedback");
  if (feedbackSec) {
    feedbackSec.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

// Global weapon filter helper (for footer links)
window.filterByWeapon = function (weaponId) {
  selectedCategory = weaponId;
  currentPage = 1;
  renderAll();
  const feedbackSec = $("#feedback");
  if (feedbackSec) {
    feedbackSec.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

// 9. Lightbox Fullscreen Controls
function openLightbox(index) {
  if (index < 0 || index >= currentItems.length) return;
  lightboxIndex = index;
  currentZoom = 1;

  const lightbox = $("#lightbox");
  const lightboxImg = $("#lightboxImage");
  const lightboxCaption = $("#lightboxCaption");
  const lightboxCounter = $("#lightboxCounter");

  if (!lightbox || !lightboxImg) return;

  const item = currentItems[lightboxIndex];
  lightboxImg.src = item.src;
  lightboxImg.style.transform = `scale(${currentZoom})`;

  if (lightboxCaption) lightboxCaption.textContent = item.title;
  if (lightboxCounter) {
    lightboxCounter.textContent = `Ảnh ${String(lightboxIndex + 1).padStart(2, "0")} / ${String(currentItems.length).padStart(2, "0")}`;
  }

  lightbox.hidden = false;
  document.body.classList.add("no-scroll");
}

function closeLightbox() {
  const lightbox = $("#lightbox");
  if (lightbox) lightbox.hidden = true;
  document.body.classList.remove("no-scroll");
  currentZoom = 1;
}

function nextLightboxImage() {
  if (currentItems.length === 0) return;
  lightboxIndex = (lightboxIndex + 1) % currentItems.length;
  openLightbox(lightboxIndex);
}

function prevLightboxImage() {
  if (currentItems.length === 0) return;
  lightboxIndex = (lightboxIndex - 1 + currentItems.length) % currentItems.length;
  openLightbox(lightboxIndex);
}

function zoomLightbox(delta) {
  const lightboxImg = $("#lightboxImage");
  if (!lightboxImg) return;

  currentZoom = Math.min(Math.max(0.7, currentZoom + delta), 3.0);
  lightboxImg.style.transform = `scale(${currentZoom})`;
}

function downloadCurrentImage() {
  if (currentItems.length === 0) return;
  const item = currentItems[lightboxIndex];
  const a = document.createElement("a");
  a.href = item.src;
  a.download = `feedback-${lightboxIndex + 1}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 10. Live Number Counter Animation
function animateCounters() {
  const counters = $$(".counter");
  counters.forEach(counter => {
    const target = Number(counter.dataset.target) || 0;
    const duration = 1200;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
      const current = Math.floor(easeProgress * target);

      if (target === 100) {
        counter.textContent = `${current}%`;
      } else if (target > 50) {
        counter.textContent = `${current}+`;
      } else {
        counter.textContent = current;
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  });
}

// 11. Master Render Function
function renderAll() {
  renderCategories();
  renderFilters();
  renderGallery();
}

// 12. Setup Event Listeners & Initialization
document.addEventListener("DOMContentLoaded", () => {
  initCategories();
  renderAll();
  animateCounters();

  // Search Input Handlers
  const searchInput = $("#searchInput");
  const searchClear = $("#searchClear");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      currentPage = 1;
      renderGallery();
      if (searchClear) {
        searchClear.hidden = searchInput.value.trim().length === 0;
      }
    });
  }

  if (searchClear && searchInput) {
    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      searchClear.hidden = true;
      currentPage = 1;
      renderGallery();
      searchInput.focus();
    });
  }

  // Category Select Dropdown
  const categoryFilter = $("#categoryFilter");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", (e) => {
      selectedCategory = e.target.value;
      currentPage = 1;
      renderAll();
    });
  }

  // Reset Filter Button on Empty State
  const btnReset = $("#btnResetFilter");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      selectedCategory = "all";
      if (searchInput) searchInput.value = "";
      if (searchClear) searchClear.hidden = true;
      currentPage = 1;
      renderAll();
    });
  }

  // Lightbox Buttons
  const btnClose = $("#btnCloseLightbox");
  const btnPrev = $("#btnPrevLightbox");
  const btnNext = $("#btnNextLightbox");
  const btnZoomIn = $("#btnZoomIn");
  const btnZoomOut = $("#btnZoomOut");
  const btnDownload = $("#btnDownload");
  const backdrop = $(".lightbox-backdrop");

  if (btnClose) btnClose.addEventListener("click", closeLightbox);
  if (backdrop) backdrop.addEventListener("click", closeLightbox);
  if (btnPrev) btnPrev.addEventListener("click", prevLightboxImage);
  if (btnNext) btnNext.addEventListener("click", nextLightboxImage);
  if (btnZoomIn) btnZoomIn.addEventListener("click", () => zoomLightbox(0.25));
  if (btnZoomOut) btnZoomOut.addEventListener("click", () => zoomLightbox(-0.25));
  if (btnDownload) btnDownload.addEventListener("click", downloadCurrentImage);

  // Keyboard Navigation
  document.addEventListener("keydown", (e) => {
    const lightbox = $("#lightbox");
    if (!lightbox || lightbox.hidden) return;

    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") prevLightboxImage();
    else if (e.key === "ArrowRight") nextLightboxImage();
    else if (e.key === "+" || e.key === "=") zoomLightbox(0.25);
    else if (e.key === "-") zoomLightbox(-0.25);
  });

  // Touch Swipe for Mobile Lightbox
  let touchStartX = 0;
  let touchEndX = 0;
  const viewport = $("#lightboxViewport");

  if (viewport) {
    viewport.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    viewport.addEventListener("touchend", (e) => {
      touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 50) {
        nextLightboxImage(); // Swiped Left -> Next
      } else if (touchEndX - touchStartX > 50) {
        prevLightboxImage(); // Swiped Right -> Prev
      }
    }, { passive: true });
  }

  // Header Scroll Effect & Back-to-Top Button
  const header = $("#header");
  const btnTop = $("#btnBackToTop");

  window.addEventListener("scroll", () => {
    const scrolled = window.scrollY > 40;
    if (header) {
      header.classList.toggle("scrolled", scrolled);
    }
    if (btnTop) {
      btnTop.classList.toggle("show", window.scrollY > 400);
    }
  }, { passive: true });

  if (btnTop) {
    btnTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
});
