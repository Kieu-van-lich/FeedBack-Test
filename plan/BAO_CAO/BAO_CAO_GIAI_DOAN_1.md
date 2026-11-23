# Báo Cáo Nghiệm Thu Giai Đoạn 1 — Kho Feedback

> **Workspace:** `d:\Documents\feedback - Copy`  
> **Cập nhật lần cuối:** 23/11/2026  
> **Tài liệu tham chiếu:** [`Phuong_An_Trien_Khai_Kho_Feedback.md`](../PHUONG_AN/Phuong_An_Trien_Khai_Kho_Feedback.md)  
> **Trạng thái tổng thể:** Đã hoàn thành **100% mã nguồn Giai đoạn 1**, **đồng bộ đủ 7 danh mục** (`Spear Blossom` & `Dao Bướm - Sunnet Vice`) lên Supabase + `data.js` + `shared.js`, **thực thi xong migration & cleanup trên Supabase live** (backup JSON cục bộ → dry-run → `COMMIT;` → REST `HTTP 200` → dọn sạch 39 file mồ côi ban đầu), và **đã tạo xong tài khoản Admin `lichchoilienquan@gmail.com` với mật khẩu người dùng cung cấp (đã test đăng nhập Auth REST `HTTP 200`) + tắt đăng ký tự do** để sẵn sàng bước ngay sang **Giai đoạn 2**. Chưa đụng code Giai đoạn 2 và chưa xóa file Giai đoạn 4.

> **Trạng thái đối chiếu 9 dòng bị thiếu trước đó:** Sự cố mất 9 dòng `Dao Bướm - Sunnet Vice — Feedback #01`..`#09` (làm live tạm giảm `60` → `51`) đã được truy vết qua Supabase `edge_logs`: xảy ra từ `14:25:48`–`14:25:57 GMT+7` (23/11/2026) qua 9 request `DELETE /rest/v1/feedbacks?id=eq.<uuid>` riêng lẻ từ `Chrome/157.0.0.0` trên giao diện production cũ (chỉ xóa DB, giữ nguyên `960.284` bytes trên Storage), trong khi smoke-test của phiên chạy kết thúc lúc `14:15:42` vẫn giữ nguyên `60/60`. Hiện đã khôi phục đủ `60/60` và khóa RLS ở [`BAO_CAO_GIAI_DOAN_2.md`](./BAO_CAO_GIAI_DOAN_2.md).

---

## 1. Tóm Tắt Các Hạng Mục Đã Triển Khai

| Hạng mục (Mục 3, 9, 11) | Trạng thái | Chi tiết triển khai |
| --- | --- | --- |
| Sửa cấu trúc DOM `admin.html` & tách CSS/JS | Đã xong | Đóng đúng cặp thẻ `<div>` bị thiếu quanh cụm đồng bộ/cấu hình (`59` thẻ mở / `59` thẻ đóng); tách style nội tuyến sang [`admin.css`](../../admin.css) (thêm responsive mobile cho form 3 cột và giữ thanh nút Admin); đưa logic dùng chung sang [`shared.js`](../../shared.js); gom JS nội tuyến về [`admin.js`](../../admin.js) và loại bỏ toàn bộ inline `on*` trong [`admin.html`](../../admin.html). |
| Hoàn thiện Edit feedback (`UPDATE` Supabase + đồng nhất danh mục) | Đã xong | Gọi `updateSupabaseFeedback()` cập nhật thật lên Supabase (hỗ trợ thay ảnh mới + xóa ảnh cũ trên Storage), bắt lỗi rõ ràng nếu thiếu policy `UPDATE` (`data.length === 0`); giữ `isEdited = true` cho item cục bộ; sửa lỗi `renderMultiPreviewGrid()` ghi đè `#imagePathInput`; dùng `matchCategory()` để chọn đúng `<option>` bất kể lệch hoa/thường (`ak riu thiêng` → `Ak Riu Thiêng`). |
| Hoàn thiện Add bằng URL thủ công | Đã xong | Nhánh nhập URL/đường dẫn thủ công trong `handleAdminFormSubmit()` gọi `addSupabaseFeedback()` lên Supabase và không nhân bản sang `localStorage` khi lưu cloud thành công. |
| Nén ảnh client & xóa Storage khi xóa feedback | Đã xong | `compressImageFile()` trong [`admin.js`](../../admin.js) nén ảnh qua canvas (`maxWidth = 1400`, ưu tiên `image/webp` quality `0.82`, fallback JPEG) trước khi đẩy lên bucket `feedback-images`; bổ sung rollback xóa file Storage nếu insert DB lỗi; `deleteSupabaseFeedback()` trích xuất Storage path qua `extractSupabaseStoragePath()` và gọi `storage.from('feedback-images').remove(...)`; item chưa seed từ `data.js` khi xóa được lưu vào `deleted_base_feedback_paths`. |
| Đồng bộ bảng `categories` & chặn xóa danh mục còn tham chiếu (Mục 11.4) | Đã xong | Thêm CRUD `fetchSupabaseCategories`, `upsertSupabaseCategory`, `upsertMultipleSupabaseCategories`, `deleteSupabaseCategory` trong [`supabase-config.js`](../../supabase-config.js); tích hợp đọc bảng `categories` ở [`app.js`](../../app.js) và nút **"⬆️ Đồng bộ Danh mục lên Supabase"** ở Admin; `deleteCategoryAdmin()` gọi `countFeedbacksUsingCategory()` kiểm tra cả bộ nhớ cục bộ lẫn Supabase, chặn xóa nếu `refCount > 0`. |
| Seed chống trùng & sửa async Reset | Đã xong | `seedSupabaseFeedbacks()` và [`seed-supabase.js`](../../seed-supabase.js) kiểm tra trùng `path` trước khi đẩy + dùng `upsert(..., { onConflict: 'path', ignoreDuplicates: true })`; nút `#clearAllBtn` chuyển thành `async` và `await loadAdminItems()` trước khi `renderAllAdmin()`. |
| Migration SQL & dry-run (Mục 11.3) | Đã soạn file | Tạo [`supabase/phase1_sync.sql`](../../supabase/phase1_sync.sql) (idempotent) kèm hướng dẫn chạy dry-run `BEGIN; ... ROLLBACK;` trước khi `COMMIT;` trên SQL Editor. |
| Script dọn 39 file Storage mồ côi (Mục 9.1) | Đã soạn & dry-run | Tạo [`scripts/cleanup-orphan-storage.js`](../../scripts/cleanup-orphan-storage.js) chạy mặc định ở chế độ `--dry-run` (an toàn, chỉ đọc) và chỉ xóa khi truyền `--execute`. |

---

## 2. Danh Sách Tệp Tin Tạo Mới & Chỉnh Sửa

### Tạo mới trong workspace
- [`shared.js`](../../shared.js) — Tiện ích dùng chung (`escapeHtml`, `isSafeImageUrl`, `sanitizeImageUrl`, `normalizeText`, `hexToCategoryColors`, `matchCategory`, `resolveCategoryDisplayName`, `combineFeedbackSources`, quản lý `deleted_base_feedback_paths`).
- [`admin.css`](../../admin.css) — Stylesheet tách riêng cho trang Admin + responsive mobile dưới `768px`.
- [`supabase/phase1_sync.sql`](../../supabase/phase1_sync.sql) — Migration SQL Giai đoạn 1 (bảng `categories`, cột `note`, `UNIQUE(path)` trên `feedbacks`, policy tạm `UPDATE` cho `feedbacks` và `UPDATE`/`DELETE` cho `storage.objects`).
- [`scripts/cleanup-orphan-storage.js`](../../scripts/cleanup-orphan-storage.js) — CLI Node.js thuần rà soát và dọn file mồ côi trong bucket `feedback-images`.
- [`plan/BAO_CAO/BAO_CAO_GIAI_DOAN_1.md`](./BAO_CAO_GIAI_DOAN_1.md) — Báo cáo nghiệm thu này.

### Chỉnh sửa trong workspace (bổ sung đồng bộ 7 danh mục)
- [`data.js`](../../data.js) — Cập nhật `CATEGORY_DATA` lên **7** danh mục, bổ sung `spear-blossom` (`#f43f5e`, `pictures/thẻ/Spear Blossom.png`) và `dao-sunnet-vice` (`#6366f1`, `pictures/thẻ/Dao Bướm - Hoàng Hôn Tội Lỗi.jpg`).
- [`shared.js`](../../shared.js) — Cập nhật `FALLBACK_CATEGORIES` khớp **7** danh mục của `data.js`.
- [`pictures/thẻ/Spear Blossom.png`](../../pictures/thẻ/Spear%20Blossom.png) & [`pictures/thẻ/Dao Bướm - Hoàng Hôn Tội Lỗi.jpg`](../../pictures/thẻ/Dao%20B%C6%B0%E1%BB%9Bm%20-%20Ho%C3%A0ng%20H%C3%B4n%20T%E1%BB%99i%20L%E1%BB%97i.jpg) — Đồng bộ 2 ảnh đại diện thẻ từ `origin/main` về thư mục cục bộ.
- [`admin.html`](../../admin.html) — Sửa lỗi đóng thiếu `<div>`, gỡ CSS/JS nội tuyến, gắn nút **"⬆️ Đồng bộ Danh mục lên Supabase"**, cập nhật xem trước SQL Giai đoạn 1.
- [`admin.js`](../../admin.js) — Hợp nhất logic form/upload/PIN/bảng quản lý, nén ảnh client, Edit/Add URL/Delete đồng bộ Supabase, chặn xóa danh mục đang có feedback (Mục 11.4), Seed chống trùng, Reset `await`.
- [`supabase-config.js`](../../supabase-config.js) — Hoàn thiện CRUD `feedbacks` + Storage cleanup + rollback + CRUD `categories` + `seedSupabaseFeedbacks`.
- [`app.js`](../../app.js) — Dùng `shared.js`, tải đồng bộ `categories` + `feedbacks` từ Supabase, đếm danh mục đồng nhất bằng `matchCategory()`, bổ sung lọc `"Khác"`, fallback ảnh lỗi, chuyển phân trang sang `data-page` listener.
- [`index.html`](../../index.html) — Nạp thêm `shared.js?v=4` trước `supabase-config.js?v=4` và `app.js?v=4`.
- [`seed-supabase.js`](../../seed-supabase.js) — Nâng cấp kiểm tra `path` tồn tại + `on_conflict=path` (fallback an toàn nếu chưa tạo constraint `UNIQUE`).

> **Lưu ý phạm vi:** Theo đúng kế hoạch tuần tự, các tệp thuộc Giai đoạn 4 (`server.js`, `netlify.toml`, `_redirects`, `New folder/`, `New folder.zip`, `test.js`) **chưa bị xóa**, và các thay đổi bảo mật Auth/RLS của Giai đoạn 2 **chưa bật** cho tới khi có tài khoản Admin thật trên Supabase.

---

## 3. Kết Quả Đối Chiếu Dữ Liệu Thực Tế (Supabase Live — Chỉ Đọc)

### 3.1. Hiện trạng Database & Storage (`frnepaasslsbbmxvvhsb`)

| Thành phần | Giá trị đo thực tế | Ghi chú |
| --- | --- | --- |
| `public.feedbacks` | **60** dòng (`unique_paths`: **60**, `local_paths`: **0**, `storage_urls`: **60**) | `Spear Blossom`: **34** · `M4A1 Battle of Faith`: **17** · `Dao Bướm - Sunnet Vice`: **9** |
| `public.categories` | **Chưa tồn tại** (`false`) | `Spear Blossom` hiện chỉ có trong `localStorage` của trình duyệt Admin |
| `storage.objects` (`feedback-images`) | **99** object (**39** file mồ côi) | Tổng dung lượng 39 file mồ côi: **10.816.676 bytes** (~**10,32 MB**), tạo từ `2026-08-09` tới `2026-11-20` |
| `auth.users` | **0** tài khoản | Cần tạo tài khoản Admin trước khi triển khai Giai đoạn 2 |
| `pg_policies` (`public` + `storage`) | **5** policy | Chưa có policy `UPDATE` cho `feedbacks`, chưa có policy `DELETE` cho `storage.objects` |

### 3.2. Kết quả đối chiếu trùng tên file trước khi Seed 121 ảnh (Mục 11.2)

- **`ak riu thiêng` (30 ảnh), `dù saitama` (12 ảnh), `M700 ELIZABETH` (27 ảnh):** Chưa có bản ghi nào trên `public.feedbacks` → **an toàn seed thẳng (69 ảnh)**.
- **`Dao Bướm - Sunnet Vice` (9 bản ghi Supabase) vs `pictures/dao bướm/` (24 ảnh `data.js`):**
  - 9 bản ghi Supabase được upload ngày `2026-11-21T13:35:05Z` với tên file dạng timestamp Messenger `1795202864050...jpg` → `1795202864243...jpg`.
  - 24 ảnh trong `data.js` là ảnh cũ (`merged-image (...).jpg`, `photo-collage.png.png`, `Screenshot_2026-08-08...jpg`).
  - **Không trùng tên file** (0/9).
- **`M4A1 Battle of Faith` (17 bản ghi Supabase) vs `pictures/m4a1 Battle of Faith/` (28 ảnh `data.js`):**
  - 17 bản ghi Supabase gồm: `1.jpg`–`8.jpg` (`2026-08-10`), `photo_6336838068018548980_y.jpg`–`8984_y.jpg` (`2026-08-13`), `photo_6057380046604801016_y.jpg`, `1018_y.jpg`, `d18be643-6239-401a-bffe-0562276951e4.jfif`, `bb857cea-1e79-4519-bd12-5125bb45f66b.jfif` (`2026-08-16`).
  - 28 ảnh `data.js` gồm: `Screenshot_2026-08-08...jpg` (19 file), `merged-image (24)`–`(30).jpg` (7 file), `photo_6321248062583542582_y.jpg`, `583_y.jpg`, `55c79e7d-...jpg`, `ed2f5b58-...jpg`.
  - **Không trùng tên file** (0/17). Riêng nhóm `1.jpg`–`8.jpg` (tên file đã được đổi ngắn) cần mở xem đối chiếu nhanh bằng mắt trước khi seed 28 ảnh `M4A1` từ `data.js` nếu muốn loại trừ tuyệt đối trường hợp trùng nội dung khác tên file.

---

## 4. Kết Quả Kiểm Tra Kỹ Thuật

| Hạng mục kiểm tra | Phạm vi / Điều kiện | Kết quả thực tế |
| --- | --- | --- |
| `node --check` trên toàn bộ JS | `shared.js`, `supabase-config.js`, `app.js`, `admin.js`, `seed-supabase.js`, `data.js`, `scripts/cleanup-orphan-storage.js` | **Đạt** (exit code `0`, `SYNTAX OK` cả 7 file) |
| Kiểm tra tĩnh & logic thuần (`check_phase1.js`) | Cân bằng thẻ `<div>`, kiểm tra không còn inline `on*` ở `admin.html`, unit test `escapeHtml`, `isSafeImageUrl`, `matchCategory`, `combineFeedbackSources`, `extractSupabaseStoragePath` | **Đạt** (`admin.html`: 59 cặp div, `index.html`: 84 cặp div, `ADMIN.HTML NO INLINE HANDLERS OK`, `ISOLATED UNIT CHECKS PASSED!`) |
| Kiểm tra tích hợp DOM & CRUD (`check_phase1_dom.js`) | Chạy bằng **mock DOM + mock Supabase client** (không tác động DB thật): khớp toàn bộ `#id` HTML↔JS, test Edit base item (`ak riu thiêng` → `Ak Riu Thiêng`), Edit Supabase item, Add URL thủ công, Delete + dọn Storage path, Sync categories, Seed 2 lần chống trùng (`121` → `0`), **chặn xóa category còn feedback & cho phép xóa category rỗng (Mục 11.4)**, Reset `await`, đếm danh mục `app.js` | **Đạt** (`INDEX.HTML SELECTORS OK`, `ADMIN.HTML SELECTORS OK`, `FULL ADMIN & APP INTEGRATION CHECKS PASSED!`) |
| `node scripts/cleanup-orphan-storage.js` (`--dry-run`) | Kết nối **đọc trực tiếp** Supabase live (`frnepaasslsbbmxvvhsb`), không xóa file | **Đạt** (`DRY_RUN_EXIT=0`, phát hiện đúng **99** object, **60** đang tham chiếu, **39** file mồ côi ≈ **10.32 MB** / `10816676 bytes`) |
| Kiểm thử trên trình duyệt thật & Supabase live sau migration | Mở `index.html` và `admin.html` trên Chrome thật kết nối trực tiếp Supabase live: kiểm tra gallery (`181+`), lightbox + zoom, Edit base item (`ak riu thiêng` → `Ak Riu Thiêng`), chặn xóa `m4a1` (Mục 11.4), Upload file PNG thật → Edit tiêu đề → F5 reload → Delete kiểm tra dọn DB & Storage | **Đạt** (tiêu đề `SMOKE_TEST_EDITED` giữ nguyên sau F5; xóa sạch về `60` DB / `60` Storage / `0` mồ côi; `custom_feedback_data` = `null`) |

---

## 5. Checklist Bước Tiếp Theo Để Chốt Giai Đoạn 1 & Mở Giai Đoạn 2

### Đã hoàn thành trên Supabase Live & Chrome thật (23/11/2026)
- [x] **Backup Supabase project** ra [`backups/supabase_backup_20261123.json`](../../backups/supabase_backup_20261123.json) (`60` feedbacks, `99` storage objects, `5` policies, `83.696` bytes).
- [x] Chạy **dry-run** [`supabase/phase1_sync.sql`](../../supabase/phase1_sync.sql) trong `BEGIN; ... ROLLBACK;` (không lỗi; kiểm tra `to_regclass('public.categories')` trả về `null` sau rollback).
- [x] Chạy **`COMMIT;` thật** [`supabase/phase1_sync.sql`](../../supabase/phase1_sync.sql) lên Supabase live và xác minh sau migration (bảng `public.categories` tạo mới rỗng để không đè `Spear Blossom` trong trình duyệt).
- [x] Dọn sạch **39 file mồ côi** trên bucket `feedback-images` bằng `node scripts/cleanup-orphan-storage.js --execute` (`60` object còn lại khớp `60` dòng DB, `0` mồ côi).
- [x] **Smoke-test trên Chrome thật + Supabase live:** Xác nhận `index.html` (`181+`, Lightbox/Zoom, lọc `"Khác (34)"`), `admin.html` (chặn xóa `m4a1` báo `45 feedback`, Edit `ak riu thiêng` giữ nguyên `#imagePathInput`, Add ảnh thật → Edit `SMOKE_TEST_EDITED` → F5 giữ nguyên → Delete xóa cả DB lẫn Storage về `60/60`).
- [x] **Tạo tài khoản Admin & khóa đăng ký tự do (chuẩn bị Giai đoạn 2):** Đã tắt `Allow new users to sign up` trong Authentication → Sign In / Providers, tái tạo user Admin xác nhận sẵn `lichchoilienquan@gmail.com` (`id: f16581f7-2068-49fa-a4e2-411b02779906`, `Auto confirm user = true`) với mật khẩu người dùng yêu cầu và xác minh đăng nhập qua `POST /auth/v1/token?grant_type=password` trả về `HTTP 200` (`HAS_TOKEN=true`).
- [x] **Đồng bộ đủ 7 danh mục lên Supabase & mã nguồn cục bộ:** Đã thêm `Spear Blossom` (`#f43f5e`, `pictures/thẻ/Spear Blossom.png`) và `Dao Bướm - Sunnet Vice` (`#6366f1`, `pictures/thẻ/Dao Bướm - Hoàng Hôn Tội Lỗi.jpg`) vào `public.categories` (`GET /rest/v1/categories` trả `HTTP 200`, `7` dòng), `data.js`, `shared.js` và tải 2 ảnh thẻ về `pictures/thẻ/`; kiểm tra trên Chrome cục bộ hiển thị đủ **7/7** thẻ danh mục (`naturalWidth > 0`, tổng **172** item hiện tại = `121` cục bộ + `51` trên Supabase).

### Việc còn lại cần бро xác nhận trước khi bước sang Giai đoạn 2
- [ ] **Xử lý 9 dòng `Dao Bướm - Sunnet Vice` bị mất trên bảng `public.feedbacks`:** Xác nhận xem việc xóa 9 dòng này có phải do бро thao tác nhầm/thử trên bản production hay không; nếu cần, chỉ cần 1 lệnh chèn lại từ [`backups/supabase_backup_20261123.json`](../../backups/supabase_backup_20261123.json) vì cả 9 file Storage vẫn còn nguyên (`HTTP 200`).
- [ ] **Rà mắt 8 ảnh `1.jpg`–`8.jpg` (`M4A1 Battle of Faith`)** ở Mục 6.4 nếu muốn Seed 121 ảnh từ `data.js` lên Supabase (Mục 11.2).
- [ ] **Chốt chuyển ngay sang Giai đoạn 2 (Supabase Auth + siết RLS đóng policy `Temp Public`)** để khóa quyền ghi công khai trên production.

---

## 6. Kết Quả Thực Thi Giai Đoạn 1 Trên Supabase Live (23/11/2026)

### 6.1. Backup trước migration
- Tệp snapshot: [`backups/supabase_backup_20261123.json`](../../backups/supabase_backup_20261123.json) (**83.696 bytes**, parse JSON hợp lệ).
- Nội dung lưu trữ: toàn bộ **60** bản ghi `public.feedbacks`, **99** metadata object trong `storage.objects` (`feedback-images`), **5** policy ban đầu và cấu hình bucket.

### 6.2. Kết quả Dry-run, COMMIT & Xác minh hậu migration
- **Dry-run (`BEGIN; ... ROLLBACK;`):** Chạy thành công không phát sinh lỗi constraint hay SQL; kiểm tra lại `to_regclass('public.categories')` trả về `null`.
- **`COMMIT;` thật:** Hoàn tất `BEGIN; ... COMMIT;` toàn bộ nội dung [`supabase/phase1_sync.sql`](../../supabase/phase1_sync.sql).
- **Trạng thái schema sau `COMMIT`:**
  - `public.categories`: đã tồn tại (`categories_exists = true`), giữ **0 dòng** (`categories_count = 0`) theo chủ đích để không ghi đè `Spear Blossom` trên trình duyệt Admin.
  - `public.feedbacks`: giữ nguyên **60** dòng, đã có cột `note` (`feedbacks_has_note = true`) và constraint `feedbacks_path_unique` (`feedbacks_path_unique = true`).
  - Tổng cộng **12 RLS policies** đang hoạt động (`categories`: 4 gồm `Public Read Categories` `SELECT USING (true)`; `feedbacks`: 4 gồm `Temp Public Update Feedbacks`; `storage.objects`: 4 gồm `Temp Public Storage Update` và `Temp Public Storage Delete`). *(Các policy `Temp Public *` sẽ bị thay bằng `TO authenticated` ở Giai đoạn 2.)*
- **Kiểm tra HTTP REST công khai (dùng publishable key):**
  - `GET /rest/v1/categories?select=*` → `[] | HTTP=200` (xác nhận bảng mới đã expose và đọc được công khai, không bị chặn im lặng).
  - `GET /rest/v1/feedbacks?select=id&limit=1` → `[{"id":"c7043b95-6df6-40f4-82ae-87e5a019d77a"}] | HTTP=200`.
- **Supabase Security Advisor (`get_advisors`):** Trả về `{"lints":[]}`.

### 6.3. Kết quả dọn 39 file Storage mồ côi (`feedback-images`)
- Lệnh thực thi: `node scripts/cleanup-orphan-storage.js --execute` (exit code `0`) → **`⚡ Đã xóa thành công 39 file mồ côi khỏi bucket 'feedback-images'!`** (~`10,32 MB` / `10.816.676 bytes`).
- Kiểm tra lại bằng cả `node scripts/cleanup-orphan-storage.js` (`--dry-run`) lẫn `execute_sql`:
  - `public.feedbacks`: **60** dòng nguyên vẹn.
  - `storage.objects` (`feedback-images`): **60** object.
  - Số file mồ côi còn lại: **0**.

### 6.4. Bảng đối chiếu 8 ảnh `1.jpg`–`8.jpg` (`M4A1 Battle of Faith`) trước khi Seed 121 ảnh
Đối chiếu kích thước 8 file trên Supabase với 28 file trong `pictures/m4a1 Battle of Faith/` cho thấy **0/8 trùng dung lượng byte** (file local nhỏ nhất 69.624 bytes đến 662.009 bytes, không trùng bất kỳ byte size nào bên dưới). Tuy nhiên do ảnh upload có thể đã bị nén lại khi lưu, бро mở nhanh 8 link sau để rà mắt trước khi Seed:

| Filename trên Supabase | Kích thước Storage (bytes) | Link xem nhanh |
| --- | --- | --- |
| `1.jpg` | 76.698 | https://frnepaasslsbbmxvvhsb.supabase.co/storage/v1/object/public/feedback-images/uploads/1786384947292_dn9u41.jpg |
| `2.jpg` | 84.615 | https://frnepaasslsbbmxvvhsb.supabase.co/storage/v1/object/public/feedback-images/uploads/1786384947819_ogjzk3.jpg |
| `3.jpg` | 72.549 | https://frnepaasslsbbmxvvhsb.supabase.co/storage/v1/object/public/feedback-images/uploads/1786384948173_a0tj4k.jpg |
| `4.jpg` | 74.284 | https://frnepaasslsbbmxvvhsb.supabase.co/storage/v1/object/public/feedback-images/uploads/1786384948507_z5f1sk.jpg |
| `5.jpg` | 85.043 | https://frnepaasslsbbmxvvhsb.supabase.co/storage/v1/object/public/feedback-images/uploads/1786384948837_8ao8lk.jpg |
| `6.jpg` | 88.240 | https://frnepaasslsbbmxvvhsb.supabase.co/storage/v1/object/public/feedback-images/uploads/1786384949210_7btagp.jpg |
| `7.jpg` | 65.637 | https://frnepaasslsbbmxvvhsb.supabase.co/storage/v1/object/public/feedback-images/uploads/1786384949639_3bovgd.jpg |
| `8.jpg` | 107.204 | https://frnepaasslsbbmxvvhsb.supabase.co/storage/v1/object/public/feedback-images/uploads/1786384949957_t3x5ch.jpg |

