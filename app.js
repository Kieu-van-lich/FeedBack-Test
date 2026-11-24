/**
 * ==========================================================================
 * KHO FEEDBACK - CORE LOGIC & INTERACTIVE CONTROLS
 * ==========================================================================
 */

const Shared = window.KhoFeedbackShared;

// 1. Core Category Definitions & Weapon Metadata
let CATEGORIES = Shared ? Shared.loadLocalCategories() : [];

function normalizeText(str) {
  return Shared ? Shared.normalizeText(str) : String(str || "").toLowerCase().trim();
}

function matchCategory(itemCategory) {
  return Shared ? Shared.matchCategory(CATEGORIES, itemCategory) : null;
}

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
let panX = 0;
let panY = 0;
let isDraggingLightbox = false;
let dragStartX = 0;
let dragStartY = 0;

// DOM Helper
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

let supabaseFeedbacksData = null;

// Helper to get combined feedback data from Supabase, localStorage and data.js
function getRawFeedbackData() {
  const baseData =
    typeof feedbackData !== "undefined" && Array.isArray(feedbackData)
      ? [...feedbackData]
      : [];

  const supaData =
    supabaseFeedbacksData && Array.isArray(supabaseFeedbacksData)
      ? [...supabaseFeedbacksData]
      : [];

  let customData = [];
  try {
    const customStr = localStorage.getItem(Shared ? Shared.CUSTOM_FEEDBACK_KEY : "custom_feedback_data");
    if (customStr) {
      const parsed = JSON.parse(customStr);
      if (Array.isArray(parsed)) customData = parsed;
    }
  } catch (e) {
    console.error("Error reading custom_feedback_data:", e);
  }

  if (Shared) {
    return Shared.combineFeedbackSources({
      supaItems: supaData,
      customItems: customData,
      baseItems: baseData
    });
  }

  return supaData.length > 0 ? [...supaData, ...customData, ...baseData] : [...customData, ...baseData];
}

// Async loader if Supabase is connected
async function loadSupabaseDataIfAvailable() {
  if (typeof isSupabaseConfigured !== "function" || !isSupabaseConfigured()) return;

  const [catRes, feedbacks] = await Promise.all([
    typeof fetchSupabaseCategories === "function" ? fetchSupabaseCategories() : Promise.resolve(null),
    typeof fetchSupabaseFeedbacks === "function" ? fetchSupabaseFeedbacks() : Promise.resolve(null)
  ]);

  let changed = false;

  if (catRes && catRes.supported && Array.isArray(catRes.data) && catRes.data.length > 0) {
    CATEGORIES = catRes.data;
    if (Shared) Shared.saveLocalCategories(CATEGORIES);
    changed = true;
  }

  if (feedbacks && Array.isArray(feedbacks)) {
    supabaseFeedbacksData = feedbacks;
    changed = true;
  }

  if (changed) {
    initCategories();
    renderAll();
  }
}

// 2. Initialize Category Counts and Total
function initCategories() {
  const combined = getRawFeedbackData();
  CATEGORIES.forEach((cat) => {
    cat.count = 0;
  });

  combined.forEach((item) => {
    const foundCat = matchCategory(item.category);
    if (foundCat) {
      foundCat.count++;
    }
  });

  const totalCount = combined.length;
  const totalEl = $("#totalFeedback");
  if (totalEl) {
    totalEl.dataset.target = totalCount;
    totalEl.textContent = `${totalCount}+`;
  }

  const servicesEl = $("#totalServices");
  if (servicesEl) {
    servicesEl.dataset.target = CATEGORIES.length;
    servicesEl.textContent = String(CATEGORIES.length);
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
    const rawCatName = item.category || "Khác";
    const foundCat = matchCategory(rawCatName);
    const catName = foundCat ? foundCat.name : rawCatName;

    if (foundCat) {
      catId = foundCat.id;
    } else if (item.categoryId) {
      catId = item.categoryId;
    }

    const rawSrc = item.path || item.src || "";
    const safeSrc = Shared ? Shared.sanitizeImageUrl(rawSrc) : rawSrc;

    return {
      id: item.id || `fb-${index}`,
      src: safeSrc,
      category: catId,
      categoryName: catName,
      title: item.title || `${catName} — Feedback #${String(combined.length - index).padStart(2, "0")}`,
      date: item.date || item.created_at || null,
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
    items = items.filter((item) => item.category === selectedCategory);
  }

  const searchInput = $("#searchInput");
  const rawKeyword = searchInput ? searchInput.value.trim() : "";
  const normKeyword = normalizeText(rawKeyword);

  if (normKeyword) {
    items = items.filter(
      (item) =>
        normalizeText(item.title).includes(normKeyword) ||
        normalizeText(item.categoryName).includes(normKeyword) ||
        normalizeText(item.note).includes(normKeyword)
    );
  }

  return items;
}

// 5. Render Category Cards in Browse Section
function renderCategories() {
  const grid = $("#categoryGrid");
  if (!grid) return;

  const esc = Shared ? Shared.escapeHtml : (s) => String(s || "");

  grid.innerHTML = CATEGORIES.map((cat, index) => {
    const safeImage = Shared ? Shared.sanitizeImageUrl(cat.image) : cat.image;
    const safeAccent = /^#[0-9a-fA-F]{6}$/.test(cat.accent || "") ? cat.accent : "#b9f34b";
    const safeGlow = Shared && Shared.isSafeCssRgbaOrHex
      ? Shared.isSafeCssRgbaOrHex(cat.glow, "rgba(185, 243, 75, 0.4)")
      : "rgba(185, 243, 75, 0.4)";
    return `
      <article
        class="category-card ${selectedCategory === cat.id ? "active" : ""}"
        data-id="${esc(cat.id)}"
        style="--accent:${safeAccent}; --accent-glow:${safeGlow};"
      >
        <div class="category-image-wrap">
          <img src="${esc(safeImage)}" alt="${esc(cat.name)}" loading="lazy" />
        </div>
        <div class="category-meta">
          <span class="category-service-no">0${index + 1} / SERVICE</span>
        </div>
        <h3 class="category-title">${esc(cat.name)}</h3>
        <p class="category-count">${cat.count} FEEDBACK</p>
      </article>
    `;
  }).join("");

  $$(".category-card").forEach((card) => {
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
  const otherCount = realItems.filter((item) => item.category === "other").length;
  const esc = Shared ? Shared.escapeHtml : (s) => String(s || "");

  if (tabsContainer) {
    let tabsHTML = `
      <button class="tab-btn ${selectedCategory === "all" ? "active" : ""}" data-id="all">
        <span>Tất cả</span>
        <span class="tab-count">${totalCount}</span>
      </button>
    `;

    tabsHTML += CATEGORIES.map(
      (cat) => `
      <button class="tab-btn ${selectedCategory === cat.id ? "active" : ""}" data-id="${esc(cat.id)}">
        <span>${esc(cat.name)}</span>
        <span class="tab-count">${cat.count}</span>
      </button>
    `
    ).join("");

    if (otherCount > 0) {
      tabsHTML += `
        <button class="tab-btn ${selectedCategory === "other" ? "active" : ""}" data-id="other">
          <span>Khác</span>
          <span class="tab-count">${otherCount}</span>
        </button>
      `;
    }

    tabsContainer.innerHTML = tabsHTML;

    $$(".tab-btn").forEach((btn) => {
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
      ${CATEGORIES.map((cat) => `<option value="${esc(cat.id)}">${esc(cat.name)} (${cat.count})</option>`).join("")}
      ${otherCount > 0 ? `<option value="other">Khác (${otherCount})</option>` : ""}
    `;
    const hasSelected = Array.from(select.options).some((opt) => opt.value === selectedCategory);
    select.value = hasSelected ? selectedCategory : "all";
  }
}

// 7. Render Feedback Gallery Grid
function renderGallery() {
  currentItems = getItems();

  const titleEl = $("#galleryTitle");
  if (titleEl) {
    if (selectedCategory === "all") {
      titleEl.textContent = "Tất cả Feedback Giao Dịch";
    } else if (selectedCategory === "other") {
      titleEl.textContent = "Feedback Khác";
    } else {
      const activeCat = CATEGORIES.find((c) => c.id === selectedCategory);
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
  const esc = Shared ? Shared.escapeHtml : (s) => String(s || "");

  galleryEl.innerHTML = paginatedItems
    .map((item, index) => {
      const globalIndex = startIndex + index;
      return `
      <article class="feedback-card" data-index="${globalIndex}">
        <div class="feedback-thumb-box">
          <img src="${esc(item.src)}" alt="${esc(item.title)}" loading="lazy" />
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
    })
    .join("");

  $$(".feedback-card").forEach((card) => {
    const img = card.querySelector("img");
    if (img) {
      img.addEventListener("error", () => {
        if (!img.dataset.fallbackApplied) {
          img.dataset.fallbackApplied = "1";
          img.src = "assets/demo/feedback-01.png";
        }
      });
    }
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

  html += `
    <button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} aria-label="Trang trước">
      ‹ Trước
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `
        <button class="page-btn ${i === currentPage ? "active" : ""}" data-page="${i}">
          ${i}
        </button>
      `;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span class="page-ellipsis">...</span>`;
    }
  }

  html += `
    <button class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} aria-label="Trang sau">
      Sau ›
    </button>
  `;

  paginationEl.innerHTML = html;

  paginationEl.querySelectorAll(".page-btn[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetPage = Number(btn.dataset.page);
      window.changePage(targetPage);
    });
  });
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
function applyLightboxTransform() {
  const lightboxImg = $("#lightboxImage");
  const viewport = $("#lightboxViewport");
  if (lightboxImg) {
    lightboxImg.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${currentZoom})`;
  }
  if (viewport) {
    viewport.classList.toggle("is-zoomed", currentZoom > 1);
  }
}

function openLightbox(index) {
  if (index < 0 || index >= currentItems.length) return;
  lightboxIndex = index;
  currentZoom = 1;
  panX = 0;
  panY = 0;
  isDraggingLightbox = false;

  const lightbox = $("#lightbox");
  const lightboxImg = $("#lightboxImage");
  const lightboxCaption = $("#lightboxCaption");
  const lightboxCounter = $("#lightboxCounter");
  const viewport = $("#lightboxViewport");

  if (!lightbox || !lightboxImg) return;

  const item = currentItems[lightboxIndex];
  delete lightboxImg.dataset.fallbackApplied;
  lightboxImg.src = item.src;
  if (viewport) viewport.classList.remove("is-dragging");
  applyLightboxTransform();

  if (lightboxCaption) lightboxCaption.textContent = item.title;
  if (lightboxCounter) {
    lightboxCounter.textContent = `Ảnh ${String(lightboxIndex + 1).padStart(2, "0")} / ${String(currentItems.length).padStart(2, "0")}`;
  }

  lightbox.hidden = false;
  document.body.classList.add("no-scroll");
}

function closeLightbox() {
  const lightbox = $("#lightbox");
  const viewport = $("#lightboxViewport");
  if (lightbox) lightbox.hidden = true;
  if (viewport) viewport.classList.remove("is-dragging", "is-zoomed");
  document.body.classList.remove("no-scroll");
  currentZoom = 1;
  panX = 0;
  panY = 0;
  isDraggingLightbox = false;
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
  if (currentZoom <= 1) {
    panX = 0;
    panY = 0;
  }
  applyLightboxTransform();
}

async function downloadCurrentImage() {
  if (currentItems.length === 0) return;
  const item = currentItems[lightboxIndex];
  const fileName = `feedback-${lightboxIndex + 1}.jpg`;

  try {
    const response = await fetch(item.src, { mode: "cors" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    const a = document.createElement("a");
    a.href = item.src;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

// 10. Live Number Counter Animation
function animateCounters() {
  const counters = $$(".counter");
  counters.forEach((counter) => {
    const target = Number(counter.dataset.target) || 0;
    const duration = 1200;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
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

function setupMobileMenu() {
  const header = $("#header");
  const menuBtn = $("#mobileMenuBtn");
  const mainNav = $("#mainNav");
  if (!header || !menuBtn || !mainNav) return;

  const closeMenu = () => {
    header.classList.remove("menu-open");
    menuBtn.setAttribute("aria-expanded", "false");
  };

  menuBtn.addEventListener("click", () => {
    const nextOpen = !header.classList.contains("menu-open");
    header.classList.toggle("menu-open", nextOpen);
    menuBtn.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.classList.contains("menu-open")) {
      closeMenu();
    }
  });
}

function renderFloatingCta() {
  const container = $("#floatingCtaGroup");
  if (!container) return;

  const channels = Shared && Array.isArray(Shared.CONTACT_CHANNELS) ? Shared.CONTACT_CHANNELS : [];
  const activeChannels = channels.filter(
    (ch) => ch && typeof ch.url === "string" && ch.url.trim().length > 0 && (!Shared || Shared.isSafeImageUrl(ch.url))
  );

  if (activeChannels.length === 0) {
    container.innerHTML = "";
    container.hidden = true;
    return;
  }

  const esc = Shared ? Shared.escapeHtml : (s) => String(s || "");
  const getCtaIcon = (id) => {
    if (id === "facebook") {
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12.07C22 6.51 17.52 2 12 2S2 6.51 2 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.77l-.44 2.9h-2.33V22c4.78-.75 8.43-4.91 8.43-9.93z"/></svg>`;
    }
    return `<span class="floating-cta-dot" aria-hidden="true"></span>`;
  };

  container.innerHTML = activeChannels
    .map((ch) => {
      const safeColor = /^#[0-9a-fA-F]{6}$/.test(ch.accent || "") ? ch.accent : "#b9f34b";
      return `
        <a
          href="${esc(ch.url.trim())}"
          target="_blank"
          rel="noopener noreferrer"
          class="floating-cta-btn"
          style="--cta-accent: ${safeColor};"
          aria-label="Liên hệ qua ${esc(ch.label)}"
        >
          ${getCtaIcon(ch.id)}
          <span>${esc(ch.label)}</span>
        </a>
      `;
    })
    .join("");
  container.hidden = false;
}

// 12. Setup Event Listeners & Initialization
document.addEventListener("DOMContentLoaded", () => {
  setupMobileMenu();
  renderFloatingCta();
  initCategories();
  renderAll();
  animateCounters();
  loadSupabaseDataIfAvailable();

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

  // Touch Swipe & Zoom Pan for Lightbox
  let touchStartX = 0;
  let touchStartY = 0;
  let touchPanStartX = 0;
  let touchPanStartY = 0;
  const viewport = $("#lightboxViewport");
  const lightboxImg = $("#lightboxImage");

  if (lightboxImg) {
    lightboxImg.addEventListener("error", () => {
      if (!lightboxImg.dataset.fallbackApplied) {
        lightboxImg.dataset.fallbackApplied = "1";
        lightboxImg.src = "assets/demo/feedback-01.png";
      }
    });
  }

  if (viewport) {
    viewport.addEventListener("mousedown", (e) => {
      if (currentZoom <= 1) return;
      isDraggingLightbox = true;
      dragStartX = e.clientX - panX;
      dragStartY = e.clientY - panY;
      viewport.classList.add("is-dragging");
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDraggingLightbox) return;
      panX = e.clientX - dragStartX;
      panY = e.clientY - dragStartY;
      applyLightboxTransform();
    });

    window.addEventListener("mouseup", () => {
      if (!isDraggingLightbox) return;
      isDraggingLightbox = false;
      viewport.classList.remove("is-dragging");
    });

    viewport.addEventListener(
      "wheel",
      (e) => {
        const lightbox = $("#lightbox");
        if (!lightbox || lightbox.hidden) return;
        e.preventDefault();
        zoomLightbox(e.deltaY < 0 ? 0.25 : -0.25);
      },
      { passive: false }
    );

    viewport.addEventListener(
      "touchstart",
      (e) => {
        if (!e.changedTouches || e.changedTouches.length === 0) return;
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        touchPanStartX = e.changedTouches[0].clientX - panX;
        touchPanStartY = e.changedTouches[0].clientY - panY;
      },
      { passive: true }
    );

    viewport.addEventListener(
      "touchmove",
      (e) => {
        if (currentZoom <= 1 || !e.changedTouches || e.changedTouches.length === 0) return;
        panX = e.changedTouches[0].clientX - touchPanStartX;
        panY = e.changedTouches[0].clientY - touchPanStartY;
        applyLightboxTransform();
      },
      { passive: true }
    );

    viewport.addEventListener(
      "touchend",
      (e) => {
        if (currentZoom > 1 || !e.changedTouches || e.changedTouches.length === 0) return;
        const touchEndX = e.changedTouches[0].screenX;
        if (touchStartX - touchEndX > 50) {
          nextLightboxImage();
        } else if (touchEndX - touchStartX > 50) {
          prevLightboxImage();
        }
      },
      { passive: true }
    );
  }

  // Header Scroll Effect & Back-to-Top Button
  const header = $("#header");
  const btnTop = $("#btnBackToTop");

  window.addEventListener(
    "scroll",
    () => {
      const scrolled = window.scrollY > 40;
      if (header) {
        header.classList.toggle("scrolled", scrolled);
      }
      if (btnTop) {
        btnTop.classList.toggle("show", window.scrollY > 400);
      }
    },
    { passive: true }
  );

  if (btnTop) {
    btnTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  $$("[data-weapon]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (link.dataset.weapon) {
        window.filterByWeapon(link.dataset.weapon);
      }
    });
  });
});
