/**
 * ==========================================================================
 * KHO FEEDBACK - SUPABASE DATABASE & STORAGE CONFIGURATION
 * ==========================================================================
 */

// Điền URL và Anon Key dự án Supabase của bạn tại đây:
const SUPABASE_URL = localStorage.getItem("SUPABASE_URL") || "https://frnepaasslsbbmxvvhsb.supabase.co";
const SUPABASE_ANON_KEY = localStorage.getItem("SUPABASE_ANON_KEY") || "sb_publishable_V5IaeVV24R1GmZrh09TcsQ_cD95KDn2";

// Khởi tạo Supabase Client
let supabaseClient = null;

if (typeof supabase !== "undefined" && SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("⚡ Supabase Client initialized successfully!");
  } catch (e) {
    console.error("Lỗi kết nối Supabase:", e);
  }
}

// Kiểm tra trạng thái cấu hình Supabase
function isSupabaseConfigured() {
  return !!(supabaseClient && SUPABASE_URL && SUPABASE_ANON_KEY);
}

// 1. Lấy danh sách Feedback từ Supabase
async function fetchSupabaseFeedbacks() {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabaseClient
      .from("feedbacks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Lỗi lấy dữ liệu Supabase:", err.message);
    return null;
  }
}

// 2. Upload file ảnh lên Supabase Storage (Bucket: 'feedback-images')
async function uploadImageToSupabase(file) {
  if (!isSupabaseConfigured()) return null;

  try {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { data, error } = await supabaseClient
      .storage
      .from("feedback-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false
      });

    if (error) throw error;

    // Lấy Public URL của ảnh đã upload
    const { data: publicUrlData } = supabaseClient
      .storage
      .from("feedback-images")
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("Lỗi upload ảnh Supabase Storage:", err.message);
    return null;
  }
}

// 3. Thêm Feedback mới vào Supabase
async function addSupabaseFeedback(itemData, imageFile = null) {
  if (!isSupabaseConfigured()) return null;

  try {
    let imageUrl = itemData.path;

    // Upload file nếu có
    if (imageFile) {
      const uploadedUrl = await uploadImageToSupabase(imageFile);
      if (uploadedUrl) imageUrl = uploadedUrl;
    }

    const { data, error } = await supabaseClient
      .from("feedbacks")
      .insert([
        {
          title: itemData.title || `${itemData.category} — Feedback`,
          category: itemData.category,
          path: imageUrl,
          filename: itemData.filename || (imageUrl ? imageUrl.split("/").pop() : "image.jpg")
        }
      ])
      .select();

    if (error) throw error;
    return data[0];
  } catch (err) {
    console.error("Lỗi thêm feedback Supabase:", err.message);
    throw err;
  }
}

// 4. Xóa Feedback khỏi Supabase
async function deleteSupabaseFeedback(id) {
  if (!isSupabaseConfigured()) return false;

  try {
    const { error } = await supabaseClient
      .from("feedbacks")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Lỗi xóa feedback Supabase:", err.message);
    return false;
  }
}

// 5. Cập nhật Feedback
async function updateSupabaseFeedback(id, updates) {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabaseClient
      .from("feedbacks")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) throw error;
    return data[0];
  } catch (err) {
    console.error("Lỗi cập nhật feedback Supabase:", err.message);
    return null;
  }
}
