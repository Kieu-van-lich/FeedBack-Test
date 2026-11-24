/**
 * ==========================================================================
 * KHO FEEDBACK - SHARED UTILITIES, NORMALIZATION & CATEGORY RESOLVER
 * ==========================================================================
 */
(function (global) {
  "use strict";

  const CUSTOM_CATEGORIES_KEY = "custom_categories_data";
  const CUSTOM_FEEDBACK_KEY = "custom_feedback_data";
  const DELETED_BASE_PATHS_KEY = "deleted_base_feedback_paths";

  const CONTACT_CHANNELS = [
    { id: "zalo", label: "Zalo", url: "", accent: "#0068ff" },
    { id: "messenger", label: "Messenger", url: "", accent: "#0084ff" },
    { id: "facebook", label: "Facebook", url: "https://www.facebook.com/lich.kieuvan.56", accent: "#1877f2" },
    { id: "telegram", label: "Telegram", url: "", accent: "#229ed9" }
  ];

  const FALLBACK_CATEGORIES = [
    {
      id: "m4a1",
      name: "M4A1 Battle of Faith",
      count: 0,
      accent: "#ff3366",
      glow: "rgba(255, 51, 102, 0.4)",
      dim: "rgba(255, 51, 102, 0.12)",
      image: "pictures/thẻ/M4A1.jpg"
    },
    {
      id: "ak",
      name: "AK Rìu Thiêng",
      count: 0,
      accent: "#f59e0b",
      glow: "rgba(245, 158, 11, 0.4)",
      dim: "rgba(245, 158, 11, 0.12)",
      image: "pictures/thẻ/AK Rìu Thiêng.jpg"
    },
    {
      id: "dao",
      name: "Dao Bướm",
      count: 0,
      accent: "#a855f7",
      glow: "rgba(168, 85, 247, 0.4)",
      dim: "rgba(168, 85, 247, 0.12)",
      image: "pictures/thẻ/dao bướm.jpg"
    },
    {
      id: "du",
      name: "Dù Saitama",
      count: 0,
      accent: "#00f0ff",
      glow: "rgba(0, 240, 255, 0.4)",
      dim: "rgba(0, 240, 255, 0.12)",
      image: "pictures/thẻ/Dù Saitama.jpg"
    },
    {
      id: "m700",
      name: "M700 ELIZABETH",
      count: 0,
      accent: "#10b981",
      glow: "rgba(16, 185, 129, 0.4)",
      dim: "rgba(16, 185, 129, 0.12)",
      image: "pictures/thẻ/M700.jpg"
    },
    {
      id: "spear-blossom",
      name: "Spear Blossom",
      count: 0,
      accent: "#f43f5e",
      glow: "rgba(244, 63, 94, 0.4)",
      dim: "rgba(244, 63, 94, 0.12)",
      image: "pictures/thẻ/Spear Blossom.png"
    },
    {
      id: "dao-sunnet-vice",
      name: "Dao Bướm - Sunnet Vice",
      count: 0,
      accent: "#6366f1",
      glow: "rgba(99, 102, 241, 0.4)",
      dim: "rgba(99, 102, 241, 0.12)",
      image: "pictures/thẻ/Dao Bướm - Hoàng Hôn Tội Lỗi.jpg"
    }
  ];

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isSafeImageUrl(url) {
    if (!url || typeof url !== "string") return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("javascript:") || lower.startsWith("vbscript:")) return false;
    if (lower.startsWith("data:")) {
      return /^data:image\/(png|jpe?g|webp|gif);/i.test(lower);
    }
    return true;
  }

  function isSafeCssRgbaOrHex(color, fallback = "rgba(185, 243, 75, 0.4)") {
    if (!color || typeof color !== "string") return fallback;
    const trimmed = color.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
    if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(trimmed)) {
      return trimmed;
    }
    return fallback;
  }

  function sanitizeImageUrl(url, fallback = "assets/demo/feedback-01.png") {
    return isSafeImageUrl(url) ? url.trim() : fallback;
  }

  function normalizeText(str) {
    if (!str) return "";
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "d")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hexToCategoryColors(hex) {
    const clean = typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex.trim())
      ? hex.trim()
      : "#b9f34b";
    const r = parseInt(clean.slice(1, 3), 16);
    const g = parseInt(clean.slice(3, 5), 16);
    const b = parseInt(clean.slice(5, 7), 16);
    return {
      accent: clean,
      glow: `rgba(${r}, ${g}, ${b}, 0.4)`,
      dim: `rgba(${r}, ${g}, ${b}, 0.12)`
    };
  }

  function normalizeCategoryRecord(cat, index = 0) {
    const colors = hexToCategoryColors(cat && cat.accent);
    const rawName = (cat && cat.name ? String(cat.name) : "Danh mục").trim();
    let fixedName = rawName;
    if (rawName === "Đao Bướm") fixedName = "Dao Bướm";
    else if (/^ak riu thiêng$/i.test(rawName)) fixedName = "AK Rìu Thiêng";
    return {
      id: (cat && cat.id ? String(cat.id) : `cat_${index}`).trim(),
      name: fixedName,
      count: typeof cat?.count === "number" ? cat.count : 0,
      accent: colors.accent,
      glow: (cat && cat.glow) || colors.glow,
      dim: (cat && cat.dim) || colors.dim,
      image: sanitizeImageUrl(cat && cat.image, "assets/demo/feedback-01.png"),
      sort_order: typeof cat?.sort_order === "number" ? cat.sort_order : index
    };
  }

  function getDefaultCategories() {
    if (typeof CATEGORY_DATA !== "undefined" && Array.isArray(CATEGORY_DATA) && CATEGORY_DATA.length > 0) {
      return CATEGORY_DATA.map((c, idx) => normalizeCategoryRecord(c, idx));
    }
    return FALLBACK_CATEGORIES.map((c, idx) => normalizeCategoryRecord(c, idx));
  }

  function loadLocalCategories() {
    try {
      const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c, idx) => normalizeCategoryRecord(c, idx));
        }
      }
    } catch (e) {
      console.warn("Error reading local categories:", e);
    }
    return getDefaultCategories();
  }

  function saveLocalCategories(categories) {
    try {
      localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(categories));
    } catch (e) {
      console.warn("Error saving local categories:", e);
    }
  }

  /**
   * Matches an item category string against a list of category objects.
   * Priority:
   * 1. Exact normalized match against category.name or category.id
   * 2. Partial match against category.name
   * 3. Token/prefix match against category.id (for short IDs like "ak", "du", "dao")
   */
  function matchCategory(categories, itemCategory) {
    if (!itemCategory || !Array.isArray(categories) || categories.length === 0) return null;
    const normItem = normalizeText(itemCategory);
    if (!normItem) return null;

    // 1. Exact match first
    const exactMatch = categories.find((c) => {
      const normName = normalizeText(c.name);
      const normId = normalizeText(c.id);
      return normItem === normName || (normId && normItem === normId);
    });
    if (exactMatch) return exactMatch;

    // 2. Name containment match (prefer longest matching category name)
    let bestNameMatch = null;
    let bestLen = -1;
    for (const c of categories) {
      const normName = normalizeText(c.name);
      if (!normName) continue;
      if (normItem.includes(normName) || normName.includes(normItem)) {
        if (normName.length > bestLen) {
          bestLen = normName.length;
          bestNameMatch = c;
        }
      }
    }
    if (bestNameMatch) return bestNameMatch;

    // 3. Fallback ID exact-token match (avoid false positives like "du" matching inside unrelated words)
    const itemTokens = normItem.split(/[^a-z0-9]+/).filter(Boolean);
    return (
      categories.find((c) => {
        const normId = normalizeText(c.id);
        return normId && itemTokens.includes(normId);
      }) || null
    );
  }

  function resolveCategoryDisplayName(categories, rawCategory) {
    const matched = matchCategory(categories, rawCategory);
    if (matched) return matched.name;
    return rawCategory || "Giao dịch chung";
  }

  function getDeletedBasePaths() {
    try {
      const raw = localStorage.getItem(DELETED_BASE_PATHS_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      return new Set();
    }
  }

  function addDeletedBasePath(path) {
    if (!path) return;
    const set = getDeletedBasePaths();
    set.add(path);
    try {
      localStorage.setItem(DELETED_BASE_PATHS_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      console.warn("Error saving deleted base paths:", e);
    }
  }

  function clearDeletedBasePaths() {
    try {
      localStorage.removeItem(DELETED_BASE_PATHS_KEY);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Checks whether Supabase already holds seeded static paths (pictures/...).
   * When unseeded (only newly uploaded URLs exist on Supabase), baseData is merged
   * minus locally deleted base paths so existing static images remain visible.
   */
  function hasSeededPathsInSupabase(supaItems) {
    if (!Array.isArray(supaItems) || supaItems.length === 0) return false;
    return supaItems.some((item) => typeof item?.path === "string" && item.path.startsWith("pictures/"));
  }

  function combineFeedbackSources({ supaItems = [], customItems = [], baseItems = [] }) {
    const deletedBasePaths = getDeletedBasePaths();
    const seeded = hasSeededPathsInSupabase(supaItems);

    const effectiveBase = seeded
      ? []
      : baseItems.filter((item) => !item?.path || !deletedBasePaths.has(item.path));

    const combined =
      supaItems.length > 0
        ? [...supaItems, ...customItems, ...effectiveBase]
        : [...customItems, ...effectiveBase];

    const uniqueItems = [];
    const seenPaths = new Set();

    for (const item of combined) {
      const p = item?.path || item?.src || "";
      if (p) {
        if (!seenPaths.has(p)) {
          seenPaths.add(p);
          uniqueItems.push(item);
        }
      } else {
        uniqueItems.push(item);
      }
    }

    return uniqueItems;
  }

  global.KhoFeedbackShared = {
    CUSTOM_CATEGORIES_KEY,
    CUSTOM_FEEDBACK_KEY,
    DELETED_BASE_PATHS_KEY,
    CONTACT_CHANNELS,
    FALLBACK_CATEGORIES,
    escapeHtml,
    isSafeImageUrl,
    isSafeCssRgbaOrHex,
    sanitizeImageUrl,
    normalizeText,
    hexToCategoryColors,
    normalizeCategoryRecord,
    getDefaultCategories,
    loadLocalCategories,
    saveLocalCategories,
    matchCategory,
    resolveCategoryDisplayName,
    getDeletedBasePaths,
    addDeletedBasePath,
    clearDeletedBasePaths,
    hasSeededPathsInSupabase,
    combineFeedbackSources
  };
})(window);
