/**
 * ==========================================================================
 * KHO FEEDBACK - SUPABASE DATABASE & STORAGE CONFIGURATION
 * ==========================================================================
 */

const DEFAULT_SUPABASE_URL = "https://frnepaasslsbbmxvvhsb.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_V5IaeVV24R1GmZrh09TcsQ_cD95KDn2";
const STORAGE_BUCKET = "feedback-images";

let currentSupabaseUrl = localStorage.getItem("SUPABASE_URL") || DEFAULT_SUPABASE_URL;
let currentSupabaseKey = localStorage.getItem("SUPABASE_ANON_KEY") || DEFAULT_SUPABASE_ANON_KEY;
let supabaseClient = null;

function initSupabaseClient(url = currentSupabaseUrl, key = currentSupabaseKey) {
  currentSupabaseUrl = (url || "").trim();
  currentSupabaseKey = (key || "").trim();
  supabaseClient = null;

  if (typeof supabase !== "undefined" && currentSupabaseUrl && currentSupabaseKey) {
    try {
      supabaseClient = supabase.createClient(currentSupabaseUrl, currentSupabaseKey);
    } catch (e) {
      console.error("Lỗi kết nối Supabase:", e);
      supabaseClient = null;
    }
  }
  return supabaseClient;
}

initSupabaseClient();

function isSupabaseConfigured() {
  return !!(supabaseClient && currentSupabaseUrl && currentSupabaseKey);
}

function isMissingRelationError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "");
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    error.status === 404 ||
    msg.includes("Could not find the table") ||
    msg.includes("does not exist")
  );
}

function isRlsOrAuthError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    error.status === 401 ||
    error.status === 403 ||
    code === "42501" ||
    msg.includes("row-level security") ||
    msg.includes("jwt") ||
    msg.includes("not authenticated") ||
    msg.includes("permission denied")
  );
}

function formatSupabaseWriteError(error, fallback = "Thao tác Supabase thất bại.") {
  if (!error) return fallback;
  if (isRlsOrAuthError(error)) {
    return "Từ chối quyền ghi (RLS/Auth) — vui lòng đăng nhập lại tài khoản Admin hợp lệ.";
  }
  return error.message || fallback;
}

async function getSupabaseSession() {
  if (!isSupabaseConfigured() || !supabaseClient.auth) {
    return { session: null, user: null, error: null };
  }
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) return { session: null, user: null, error };
    const session = data && data.session ? data.session : null;
    return { session, user: session ? session.user : null, error: null };
  } catch (err) {
    return { session: null, user: null, error: err };
  }
}

async function requireSupabaseAdminSession() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase chưa được cấu hình.");
  }
  const { session, error } = await getSupabaseSession();
  if (error) {
    throw new Error(`Không kiểm tra được phiên đăng nhập Admin: ${error.message}`);
  }
  if (!session || !session.user) {
    throw new Error("Phiên đăng nhập Admin chưa mở hoặc đã hết hạn. Vui lòng đăng nhập lại!");
  }
  return session;
}

async function signInSupabaseAdmin(email, password) {
  if (!isSupabaseConfigured() || !supabaseClient.auth) {
    throw new Error("Supabase chưa được cấu hình để xác thực.");
  }
  const cleanEmail = String(email || "").trim();
  const cleanPassword = String(password || "");
  if (!cleanEmail || !cleanPassword) {
    throw new Error("Vui lòng nhập đầy đủ Email và Mật khẩu.");
  }
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword
  });
  if (error) {
    throw new Error(error.message || "Email hoặc mật khẩu không chính xác.");
  }
  if (!data || !data.session || !data.user) {
    throw new Error("Không nhận được phiên đăng nhập từ Supabase Auth.");
  }
  return { session: data.session, user: data.user };
}

async function signOutSupabaseAdmin() {
  if (!isSupabaseConfigured() || !supabaseClient.auth) return { error: null };
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  return { error: null };
}

async function updateSupabaseAdminPassword(newPassword) {
  await requireSupabaseAdminSession();
  const pw = String(newPassword || "");
  if (pw.length < 8) {
    throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự.");
  }
  const { data, error } = await supabaseClient.auth.updateUser({ password: pw });
  if (error) {
    throw new Error(error.message || "Không thể cập nhật mật khẩu trên Supabase Auth.");
  }
  return data && data.user ? data.user : null;
}

function onSupabaseAuthStateChange(callback) {
  if (!isSupabaseConfigured() || !supabaseClient.auth || typeof callback !== "function") {
    return null;
  }
  const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
    callback(event, session || null);
  });
  return data && data.subscription ? data.subscription : null;
}

function extractSupabaseStoragePath(publicUrl, bucketName = STORAGE_BUCKET) {
  if (!publicUrl || typeof publicUrl !== "string") return null;
  const markerPublic = `/storage/v1/object/public/${bucketName}/`;
  const markerSign = `/storage/v1/object/sign/${bucketName}/`;
  let rawPath = null;

  if (publicUrl.includes(markerPublic)) {
    rawPath = publicUrl.split(markerPublic)[1];
  } else if (publicUrl.includes(markerSign)) {
    rawPath = publicUrl.split(markerSign)[1];
  }

  if (!rawPath) return null;
  const cleanPart = rawPath.split("?")[0].split("#")[0];
  try {
    return decodeURIComponent(cleanPart);
  } catch (e) {
    return cleanPart;
  }
}

async function deleteStorageImageByUrl(publicUrl) {
  if (!isSupabaseConfigured()) return { skipped: true, ok: false };
  const storagePath = extractSupabaseStoragePath(publicUrl);
  if (!storagePath) return { skipped: true, ok: true };

  try {
    await requireSupabaseAdminSession();
    const { data, error } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.warn("Không thể xóa ảnh trên Storage:", error.message);
      return { skipped: false, ok: false, error: formatSupabaseWriteError(error), path: storagePath };
    }

    const removedCount = Array.isArray(data) ? data.length : 0;
    if (removedCount === 0) {
      return {
        skipped: false,
        ok: false,
        error: "Storage không phản hồi xóa file (kiểm tra quyền Admin RLS trên storage.objects).",
        path: storagePath
      };
    }

    return { skipped: false, ok: true, path: storagePath };
  } catch (err) {
    console.warn("Lỗi xóa ảnh Storage:", err.message);
    return { skipped: false, ok: false, error: formatSupabaseWriteError(err), path: storagePath };
  }
}

// 1. Lấy danh sách Feedback từ Supabase (trả về mảng hoặc null nếu lỗi)
async function fetchSupabaseFeedbacks() {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabaseClient
      .from("feedbacks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Lỗi lấy dữ liệu Supabase:", err.message);
    return null;
  }
}

// 2. Upload file ảnh lên Supabase Storage (Bucket: 'feedback-images')
async function uploadImageToSupabase(file) {
  await requireSupabaseAdminSession();
  if (!file) {
    throw new Error("Thiếu tệp ảnh để tải lên.");
  }

  const mime = file.type || "";
  let fileExt = "jpg";
  if (mime === "image/webp") fileExt = "webp";
  else if (mime === "image/png") fileExt = "png";
  else if (mime === "image/jpeg" || mime === "image/jpg") fileExt = "jpg";
  else if (file.name && file.name.includes(".")) {
    fileExt = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  }

  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "31536000",
      contentType: mime || "image/jpeg",
      upsert: false
    });

  if (error) {
    throw new Error(`Upload Storage thất bại (${file.name || fileName}): ${formatSupabaseWriteError(error)}`);
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  if (!publicUrlData || !publicUrlData.publicUrl) {
    throw new Error("Không lấy được Public URL sau khi upload.");
  }

  return publicUrlData.publicUrl;
}

// 3. Thêm 1 Feedback mới vào Supabase (hỗ trợ cả file lẫn URL thủ công)
async function addSupabaseFeedback(itemData, imageFile = null) {
  await requireSupabaseAdminSession();

  let imageUrl = itemData.path || "";
  let uploadedUrl = null;

  if (imageFile) {
    uploadedUrl = await uploadImageToSupabase(imageFile);
    imageUrl = uploadedUrl;
  }

  if (!imageUrl || imageUrl.startsWith("data:")) {
    throw new Error("Đường dẫn ảnh không hợp lệ để lưu lên Supabase.");
  }

  const payload = {
    title: itemData.title || `${itemData.category} — Feedback`,
    category: itemData.category,
    path: imageUrl,
    filename: itemData.filename || imageUrl.split("/").pop() || "image.jpg"
  };

  const { data, error } = await supabaseClient
    .from("feedbacks")
    .insert([payload])
    .select();

  if (error) {
    if (uploadedUrl) {
      await deleteStorageImageByUrl(uploadedUrl);
    }
    throw new Error(formatSupabaseWriteError(error));
  }

  return data && data[0] ? data[0] : null;
}

// 3b. Thêm nhiều Feedback cùng lúc (Batch Upload với rollback Storage nếu insert DB lỗi)
async function addMultipleSupabaseFeedbacks(itemsArray, filesArray = []) {
  await requireSupabaseAdminSession();
  if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
    return null;
  }

  const uploadedUrls = [];
  const rows = [];

  try {
    for (let i = 0; i < itemsArray.length; i++) {
      const item = itemsArray[i];
      const file = filesArray[i] || null;
      let imageUrl = item.path || "";

      if (file) {
        const publicUrl = await uploadImageToSupabase(file);
        uploadedUrls.push(publicUrl);
        imageUrl = publicUrl;
        item.path = publicUrl;
      }

      if (!imageUrl || imageUrl.startsWith("data:")) {
        throw new Error(`Ảnh thứ #${i + 1} chưa tải lên được Storage.`);
      }

      rows.push({
        title: item.title || `${item.category} — Feedback`,
        category: item.category,
        path: imageUrl,
        filename: item.filename || imageUrl.split("/").pop() || "image.jpg"
      });
    }

    const { data, error } = await supabaseClient
      .from("feedbacks")
      .insert(rows)
      .select();

    if (error) throw error;

    if (Array.isArray(data)) {
      for (let i = 0; i < Math.min(data.length, itemsArray.length); i++) {
        itemsArray[i].id = data[i].id;
        itemsArray[i].path = data[i].path;
        itemsArray[i].filename = data[i].filename;
        itemsArray[i].created_at = data[i].created_at;
        itemsArray[i].isSupabase = true;
      }
    }

    return data;
  } catch (err) {
    // Cleanup any files already uploaded to Storage during this failed batch
    for (const url of uploadedUrls) {
      await deleteStorageImageByUrl(url);
    }
    console.error("Lỗi thêm feedback hàng loạt Supabase:", err.message);
    throw err;
  }
}

// 4. Xóa Feedback khỏi Supabase + xóa luôn file tương ứng trên Storage
async function deleteSupabaseFeedback(id, imageUrl = null) {
  if (!isSupabaseConfigured()) return { ok: false, error: "Chưa cấu hình Supabase" };

  try {
    await requireSupabaseAdminSession();
    let targetUrl = imageUrl;
    if (!targetUrl) {
      const { data: existing } = await supabaseClient
        .from("feedbacks")
        .select("path")
        .eq("id", id)
        .maybeSingle();
      if (existing && existing.path) targetUrl = existing.path;
    }

    const { error } = await supabaseClient
      .from("feedbacks")
      .delete()
      .eq("id", id);

    if (error) throw error;

    let storageResult = { skipped: true, ok: true };
    if (targetUrl) {
      storageResult = await deleteStorageImageByUrl(targetUrl);
    }

    return {
      ok: true,
      storageDeleted: storageResult.ok && !storageResult.skipped,
      storageSkipped: storageResult.skipped,
      storageError: storageResult.error || null
    };
  } catch (err) {
    console.error("Lỗi xóa feedback Supabase:", err.message);
    return { ok: false, error: formatSupabaseWriteError(err) };
  }
}

// 5. Cập nhật Feedback (hỗ trợ thay ảnh mới + dọn ảnh cũ trên Storage)
async function updateSupabaseFeedback(id, updates, newImageFile = null, oldImageUrl = null) {
  await requireSupabaseAdminSession();

  const payload = {
    title: updates.title,
    category: updates.category
  };
  if (updates.path) payload.path = updates.path;
  if (updates.filename) payload.filename = updates.filename;

  let newlyUploadedUrl = null;

  try {
    if (newImageFile) {
      newlyUploadedUrl = await uploadImageToSupabase(newImageFile);
      payload.path = newlyUploadedUrl;
      payload.filename = updates.filename || newlyUploadedUrl.split("/").pop() || "image.jpg";
    }

    const { data, error } = await supabaseClient
      .from("feedbacks")
      .update(payload)
      .eq("id", id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      throw new Error(
        "Không cập nhật được bản ghi trên Supabase (kiểm tra quyền Admin RLS cho bảng feedbacks)."
      );
    }

    if (newlyUploadedUrl && oldImageUrl && oldImageUrl !== newlyUploadedUrl) {
      await deleteStorageImageByUrl(oldImageUrl);
    }

    return data[0];
  } catch (err) {
    if (newlyUploadedUrl) {
      await deleteStorageImageByUrl(newlyUploadedUrl);
    }
    console.error("Lỗi cập nhật feedback Supabase:", err.message);
    throw new Error(formatSupabaseWriteError(err));
  }
}

// 6. Seed chống trùng theo cột path
async function seedSupabaseFeedbacks(rows) {
  await requireSupabaseAdminSession();

  const existing = await fetchSupabaseFeedbacks();
  if (existing === null) {
    throw new Error("Không đọc được bảng feedbacks trên Supabase.");
  }

  const existingPaths = new Set(existing.map((r) => r.path).filter(Boolean));
  const seenBatchPaths = new Set();
  const pendingRows = [];

  for (const row of rows) {
    if (!row || !row.path) continue;
    if (existingPaths.has(row.path) || seenBatchPaths.has(row.path)) continue;
    seenBatchPaths.add(row.path);
    pendingRows.push(row);
  }

  if (pendingRows.length === 0) {
    return { inserted: 0, skipped: rows.length };
  }

  const chunkSize = 50;
  let insertedCount = 0;

  for (let i = 0; i < pendingRows.length; i += chunkSize) {
    const chunk = pendingRows.slice(i, i + chunkSize);
    const { error } = await supabaseClient
      .from("feedbacks")
      .upsert(chunk, { onConflict: "path", ignoreDuplicates: true });

    if (error) {
      // Fallback to plain insert if UNIQUE(path) constraint hasn't been added yet
      const msg = String(error.message || "");
      if (msg.includes("no unique or exclusion constraint")) {
        const { error: insertErr } = await supabaseClient.from("feedbacks").insert(chunk);
        if (insertErr) throw insertErr;
      } else {
        throw error;
      }
    }
    insertedCount += chunk.length;
  }

  return {
    inserted: insertedCount,
    skipped: rows.length - pendingRows.length
  };
}

// 7. CRUD Danh mục (Categories) trên Supabase
async function fetchSupabaseCategories() {
  if (!isSupabaseConfigured()) return { supported: false, data: null };

  try {
    const { data, error } = await supabaseClient
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      if (isMissingRelationError(error)) {
        return { supported: false, data: null };
      }
      throw error;
    }

    const shared = window.KhoFeedbackShared;
    const normalized = Array.isArray(data)
      ? data.map((c, idx) => (shared ? shared.normalizeCategoryRecord(c, idx) : c))
      : [];

    return { supported: true, data: normalized };
  } catch (err) {
    console.warn("Lỗi lấy danh mục Supabase:", err.message);
    return { supported: false, data: null, error: err.message };
  }
}

async function upsertSupabaseCategory(cat, sortOrder = 0) {
  if (!isSupabaseConfigured()) return { supported: false, ok: false };

  const shared = window.KhoFeedbackShared;
  const norm = shared ? shared.normalizeCategoryRecord(cat, sortOrder) : cat;

  const row = {
    id: norm.id,
    name: norm.name,
    accent: norm.accent,
    glow: norm.glow,
    dim: norm.dim,
    image: norm.image,
    sort_order: typeof norm.sort_order === "number" ? norm.sort_order : sortOrder
  };

  try {
    await requireSupabaseAdminSession();
    const { data, error } = await supabaseClient
      .from("categories")
      .upsert([row], { onConflict: "id" })
      .select();

    if (error) {
      if (isMissingRelationError(error)) {
        return { supported: false, ok: false, error: "Bảng categories chưa tồn tại trên Supabase." };
      }
      throw error;
    }

    return { supported: true, ok: true, data: data && data[0] ? data[0] : row };
  } catch (err) {
    console.error("Lỗi lưu danh mục Supabase:", err.message);
    return { supported: true, ok: false, error: formatSupabaseWriteError(err) };
  }
}

async function upsertMultipleSupabaseCategories(categoriesList) {
  if (!isSupabaseConfigured() || !Array.isArray(categoriesList) || categoriesList.length === 0) {
    return { supported: false, ok: false };
  }

  const shared = window.KhoFeedbackShared;
  const rows = categoriesList.map((cat, idx) => {
    const norm = shared ? shared.normalizeCategoryRecord(cat, idx) : cat;
    return {
      id: norm.id,
      name: norm.name,
      accent: norm.accent,
      glow: norm.glow,
      dim: norm.dim,
      image: norm.image,
      sort_order: idx
    };
  });

  try {
    await requireSupabaseAdminSession();
    const { data, error } = await supabaseClient
      .from("categories")
      .upsert(rows, { onConflict: "id" })
      .select();

    if (error) {
      if (isMissingRelationError(error)) {
        return { supported: false, ok: false, error: "Bảng categories chưa tồn tại trên Supabase." };
      }
      throw error;
    }

    return { supported: true, ok: true, data };
  } catch (err) {
    console.error("Lỗi đồng bộ danh mục Supabase:", err.message);
    return { supported: true, ok: false, error: formatSupabaseWriteError(err) };
  }
}

async function deleteSupabaseCategory(id) {
  if (!isSupabaseConfigured()) return { supported: false, ok: false };

  try {
    await requireSupabaseAdminSession();
    const { error } = await supabaseClient
      .from("categories")
      .delete()
      .eq("id", id);

    if (error) {
      if (isMissingRelationError(error)) {
        return { supported: false, ok: false, error: "Bảng categories chưa tồn tại trên Supabase." };
      }
      throw error;
    }

    return { supported: true, ok: true };
  } catch (err) {
    console.error("Lỗi xóa danh mục Supabase:", err.message);
    return { supported: true, ok: false, error: formatSupabaseWriteError(err) };
  }
}
