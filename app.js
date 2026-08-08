const CATEGORIES = [
  {
    id: "ak",
    name: "Ak Riu Thiêng",
    short: "AR",
    tier: "Huyền thoại",
    count: 0,
    accent: "#e8a93c",
    dim: "#4a3a1e",
    image: "pictures/thẻ/AK Rìu Thiêng.jpg"
  },
  {
    id: "dao",
    name: "Đao Bướm",
    short: "DB",
    tier: "Cực hiếm",
    count: 0,
    accent: "#a374ff",
    dim: "#332a52",
    image: "pictures/thẻ/dao bướm.jpg"
  },
  {
    id: "du",
    name: "Dù Saitama",
    short: "DS",
    tier: "Hiếm",
    count: 0,
    accent: "#35c9e1",
    dim: "#1e3a40",
    image: "pictures/thẻ/Dù Saitama.jpg"
  },
  {
    id: "m4a1",
    name: "M4A1 Battle of Faith",
    short: "M4",
    tier: "Thần thoại",
    count: 0,
    accent: "#e4485c",
    dim: "#4a2530",
    image: "pictures/thẻ/M4A1.jpg"
  },
  {
    id: "m700",
    name: "M700 ELIZABETH",
    short: "M7",
    tier: "Độc quyền",
    count: 0,
    accent: "#2fbf9f",
    dim: "#1a3d35",
    image: "pictures/thẻ/M700.jpg"
  }
];

const DEMO_IMAGES = [
  { src: "assets/demo/feedback-01.png", title: "Feedback demo #01", category: "demo" },
  { src: "assets/demo/feedback-02.png", title: "Feedback demo #02", category: "demo" },
  { src: "assets/demo/feedback-03.png", title: "Feedback demo #03", category: "demo" }
];

let selectedCategory = "all";
let currentItems = [];
let lightboxIndex = 0;
let currentPage = 1;
const ITEMS_PER_PAGE = 15;

const $ = (selector) => document.querySelector(selector);

// Calculate counts based on real feedbackData
function initCategories() {
  if (typeof feedbackData !== 'undefined') {
    CATEGORIES.forEach(cat => {
      let matchName = cat.name.toLowerCase();
      // Adjust match string based on real data category names
      if (cat.id === 'ak') matchName = 'ak';
      if (cat.id === 'dao') matchName = 'dao';
      if (cat.id === 'du') matchName = 'dù';
      if (cat.id === 'm4a1') matchName = 'm4a1';
      if (cat.id === 'm700') matchName = 'm700';
      
      cat.count = feedbackData.filter(item => item.category.toLowerCase().includes(matchName)).length;
    });
  }
}

function getRealItems() {
  if (typeof feedbackData === 'undefined') return [];
  
  return feedbackData.map((item, index) => {
    let catId = "demo";
    let catName = item.category;
    let lcCat = item.category.toLowerCase();
    
    if (lcCat.includes('ak')) catId = 'ak';
    else if (lcCat.includes('dao')) catId = 'dao';
    else if (lcCat.includes('dù')) catId = 'du';
    else if (lcCat.includes('m4a1')) catId = 'm4a1';
    else if (lcCat.includes('m700')) catId = 'm700';

    return {
      src: item.path,
      category: catId,
      title: `${catName} — Feedback #${String(index + 1).padStart(2, "0")}`
    };
  });
}

function getItems() {
  let items = getRealItems();

  if (selectedCategory === "all") {
    items = [...DEMO_IMAGES, ...items];
  } else {
    items = items.filter(item => item.category === selectedCategory);
  }

  const keyword = $("#searchInput").value.trim().toLowerCase();

  if (keyword) {
    items = items.filter(item =>
      item.title.toLowerCase().includes(keyword)
    );
  }

  return items;
}

function renderCategories() {
  $("#categoryGrid").innerHTML = CATEGORIES.map((category, index) => `
    <article
      class="category ${selectedCategory === category.id ? "active" : ""}"
      data-id="${category.id}"
      style="--accent:${category.accent};--dim:${category.dim}"
    >
      <div class="category-icon" style="padding: 0; overflow: hidden;">
        <img src="${category.image}" alt="${category.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" />
      </div>
      <div class="category-number">0${index + 1} / SERVICE</div>
      <h3>${category.name}</h3>
      <p>${category.count} FEEDBACK</p>
    </article>
  `).join("");

  document.querySelectorAll(".category").forEach(card => {
    card.addEventListener("click", () => {
      selectedCategory = card.dataset.id;
      currentPage = 1;
      renderAll();
      $("#feedback").scrollIntoView({ behavior: "smooth" });
    });
  });
}

function renderFilter() {
  $("#categoryFilter").innerHTML =
    `<option value="all">Tất cả dịch vụ</option>` +
    CATEGORIES.map(category =>
      `<option value="${category.id}">${category.name}</option>`
    ).join("");

  $("#categoryFilter").value = selectedCategory;
}

function renderGallery() {
  currentItems = getItems();

  const title =
    selectedCategory === "all"
      ? "Tất cả feedback"
      : CATEGORIES.find(category => category.id === selectedCategory)?.name;

  $("#galleryTitle").textContent = title || "Feedback";

  // Pagination logic
  const totalPages = Math.ceil(currentItems.length / ITEMS_PER_PAGE);
  if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = currentItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  $("#gallery").innerHTML = paginatedItems.map((item, index) => {
    const globalIndex = startIndex + index;
    return `
    <article class="feedback-card" data-index="${globalIndex}">
      <div class="feedback-image">
        <img src="${item.src}" alt="${item.title}" loading="lazy">
      </div>
      <div class="feedback-info">
        <span>#${String(globalIndex + 1).padStart(3, "0")}</span>
        <b>✓ VERIFIED</b>
      </div>
    </article>
  `}).join("");

  $("#empty").hidden = currentItems.length !== 0;

  document.querySelectorAll(".feedback-card").forEach(card => {
    card.addEventListener("click", () => openLightbox(Number(card.dataset.index)));
  });
  
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const container = $("#pagination");
  if (!container) return;
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  let html = `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">Trước</button>`;
  
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="page-btn ${currentPage === i ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
  }
  
  html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Sau</button>`;
  
  container.innerHTML = html;
}

window.changePage = function(page) {
  currentPage = page;
  renderGallery();
  $("#feedback").scrollIntoView({ behavior: "smooth" });
}

function renderAll() {
  initCategories();
  renderCategories();
  renderFilter();
  renderGallery();
  
  // Update total count
  const total = CATEGORIES.reduce((sum, category) => sum + category.count, 0);
  $("#totalFeedback").textContent = `${total}+`;
}

function openLightbox(index) {
  lightboxIndex = index;
  updateLightbox();
  $("#lightbox").hidden = false;
  document.body.classList.add("no-scroll");
}

function updateLightbox() {
  const item = currentItems[lightboxIndex];
  if (!item) return;

  $("#lightboxImage").src = item.src;
  $("#lightboxImage").alt = item.title;
  $("#lightboxCaption").textContent =
    `${item.title} • ${lightboxIndex + 1}/${currentItems.length}`;
}

function closeLightbox() {
  $("#lightbox").hidden = true;
  document.body.classList.remove("no-scroll");
}

function moveLightbox(step) {
  if (!currentItems.length) return;

  lightboxIndex =
    (lightboxIndex + step + currentItems.length) % currentItems.length;

  updateLightbox();
}

$("#categoryFilter").addEventListener("change", (event) => {
  selectedCategory = event.target.value;
  renderAll();
});

$("#searchInput").addEventListener("input", () => {
  currentPage = 1;
  renderGallery();
});

$(".lightbox-close").addEventListener("click", closeLightbox);
$(".lightbox-prev").addEventListener("click", () => moveLightbox(-1));
$(".lightbox-next").addEventListener("click", () => moveLightbox(1));

$("#lightbox").addEventListener("click", (event) => {
  if (event.target.id === "lightbox") closeLightbox();
});

document.addEventListener("keydown", (event) => {
  if ($("#lightbox").hidden) return;

  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") moveLightbox(-1);
  if (event.key === "ArrowRight") moveLightbox(1);
});

// Initialize
renderAll();
