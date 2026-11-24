# Báo Cáo Nghiệm Thu Giai Đoạn 4 — Tối Ưu WebP, Vệ Sinh Repo, Đối Chiếu M4A1 & Backup Định Kỳ

> **Workspace:** `d:\Documents\feedback - Copy`  
> **Ngày hoàn thành:** 24/11/2026  
> **Tài liệu tham chiếu:** [`Phuong_An_Trien_Khai_Kho_Feedback.md`](../PHUONG_AN/Phuong_An_Trien_Khai_Kho_Feedback.md)  
> **Trạng thái tổng thể:** Đã hoàn thành **100% Mốc 1 của Giai đoạn 4** và **đẩy lên production qua commit `8a7b69e` trên `origin/main`** (rà mắt 8 ảnh `M4A1 Battle of Faith`, thiết lập script + chụp backup định kỳ mới nhất, chuyển toàn bộ `128` ảnh trong `pictures/` sang `.webp` giảm **79,1%** dung lượng, kiểm tra chất lượng `128/128` ảnh với `git HEAD` và rà mắt ghép cặp `1:1`, đồng bộ `data.js` / `shared.js` / `seed-supabase.js` / `index.html` / `admin.html`, xóa `server.js`, `package.json`, `netlify.toml`, `_redirects`, `test.js`, `New folder/`, `New folder.zip`, giữ `vercel.json` là config deploy duy nhất) và đã xác minh chỉ-đọc `HTTP 200` (`image/webp`, `?v=7`) + `HTTP 404` file thừa trên `https://feedback-hiroki.vercel.app/`. **Đang giữ riêng Mốc 2 (Seed 121 metadata + cập nhật `categories.image` trên Supabase) chờ xác nhận.**

---

## 1. Kết Quả Rà Mắt 8 Ảnh M4A1 (`1.jpg`–`8.jpg`) Trước Khi Seed

Đối chiếu cả `17` bản ghi `M4A1 Battle of Faith` đang có trên Supabase (`public.feedbacks`) với toàn bộ `128` ảnh cục bộ trong `pictures/` (bao gồm cả nửa trái/phải của các ảnh ghép `merged-image (24..30).jpg` trong `pictures/m4a1 Battle of Faith/`) và kiểm tra trực quan ghép cặp trên ảnh tổng hợp:

- **Kết luận:** **`0/8` ảnh `1.jpg`–`8.jpg` (và `0/17` toàn nhóm M4A1 trên Supabase) trùng nội dung với `28` ảnh M4A1 trong `data.js`** (`RMSE` thấp nhất `33,61`, khoảng cách `dHash` `13/64`–`25/64`). Toàn bộ `121` ảnh trong `data.js` đều an toàn để Seed khi sẵn sàng.

| Filename trên Supabase | Kích thước Storage | Khách hàng trong ảnh (rà mắt) | Ảnh cục bộ gần nhất (chỉ số tham chiếu) | Kết quả |
| --- | --- | --- | --- | --- |
| `1.jpg` | `576×1280` · `76.698` B | Quyết Hào | `photo_6321248062583542583_y.jpg` (`RMSE=59,19`) | Không trùng |
| `2.jpg` | `576×1280` · `84.615` B | Anh Huỳnh Quốc | `Screenshot_2026-08-08-17-48-10-551...jpg` (`RMSE=49,69`) | Không trùng |
| `3.jpg` | `576×1280` · `72.549` B | Phan Nguyễn | `Screenshot_2026-08-08-17-42-36-390...jpg` (`RMSE=37,67`) | Không trùng |
| `4.jpg` | `576×1280` · `74.284` B | Việt Đức | `Screenshot_2026-08-08-17-50-07-615...jpg` (`RMSE=50,19`) | Không trùng |
| `5.jpg` | `576×1280` · `85.043` B | Lucas Garrison | `Screenshot_2026-08-08-17-47-56-007...jpg` (`RMSE=42,83`) | Không trùng |
| `6.jpg` | `576×1280` · `88.240` B | Hà Văn Huấn | `Screenshot_2026-08-08-17-45-10-238...jpg` (`RMSE=48,98`) | Không trùng |
| `7.jpg` | `576×1280` · `65.637` B | Huỳnh Tuấn Kiệt | `Screenshot_2026-08-08-17-49-26-348...jpg` (`RMSE=43,29`) | Không trùng |
| `8.jpg` | `576×1280` · `107.204` B | Dũng Lê | `ed2f5b58-8c48-4be5-bc90-92a53df5d9c6.jpg` (`RMSE=33,61`) | Không trùng |

> **Cập nhật [`seed-supabase.js`](../../seed-supabase.js):** Bổ sung hỗ trợ `SUPABASE_ACCESS_TOKEN` / `SUPABASE_SERVICE_ROLE_KEY`, chuẩn hóa tên danh mục khi seed (`"ak riu thiêng"` → `"AK Rìu Thiêng"`, `"dao bướm"` → `"Dao Bướm"`, `"dù saitama"` → `"Dù Saitama"`, `"m4a1 Battle of Faith"` → `"M4A1 Battle of Faith"`), và báo hướng dẫn rõ ràng nếu gặp lỗi RLS `401`/`403`.

---

## 2. Backup Định Kỳ & Nén Ảnh `pictures/` Sang WebP

### 2.1. Script backup định kỳ ([`scripts/backup-supabase.js`](../../scripts/backup-supabase.js))
- Script Node.js không phụ thuộc ngoài, chỉ đọc từ Supabase (`public.categories`, `public.feedbacks`, và danh sách object trong bucket `feedback-images`), hỗ trợ `--out=`, `--prune --keep=4`.
- Đã chạy tạo snapshot mới tại `backups/supabase_backup_20261124.json` (`45.457` bytes; nằm ngoài Git theo `.gitignore`): **`7`** `categories`, **`60`** `feedbacks`, **`60`** `storage_objects`.

### 2.2. Kết quả nén `128` ảnh trong `pictures/` sang `.webp` (`quality=80`, `method=4`, giới hạn `maxWidth=1600px`)

| Thư mục trong `pictures/` | Số tệp | Trước (MB) | Sau WebP (MB) | Mức giảm |
| --- | --- | --- | --- | --- |
| `M700 ELIZABETH` | `27` | `10,92 MB` (`11.446.321` B) | `2,01 MB` (`2.105.392` B) | **-81,6%** |
| `ak riu thiêng` | `30` | `9,55 MB` (`10.013.296` B) | `2,07 MB` (`2.166.716` B) | **-78,4%** |
| `dao bướm` | `24` | `7,84 MB` (`8.220.023` B) | `1,69 MB` (`1.772.222` B) | **-78,4%** |
| `dù saitama` | `12` | `4,77 MB` (`5.006.260` B) | `0,97 MB` (`1.015.716` B) | **-79,7%** |
| `m4a1 Battle of Faith` | `28` | `9,89 MB` (`10.368.674` B) | `2,11 MB` (`2.207.764` B) | **-78,7%** |
| `thẻ` | `7` | `0,59 MB` (`616.046` B) | `0,25 MB` (`265.572` B) | **-56,9%** |
| **Tổng cộng** | **`128`** | **`43,55 MB` (`45.670.620` B)** | **`9,09 MB` (`9.533.382` B)** | **-79,1%** |

> Không phát sinh trùng tên khi đổi đuôi, không còn ảnh `.jpg`/`.jpeg`/`.png` nào sót lại trong `pictures/`.

### 2.3. Kiểm tra chất lượng & rà mắt `128/128` ảnh WebP với bản gốc `git HEAD`
- **Tỉ lệ khung hình (`aspect ratio`):** **`0`** file sai lệch tỉ lệ (`> 0.01`).
- **Kích thước pixel:** Chỉ có **`6`** banner trong `pictures/thẻ/` (`width > 1600`) được co về bề ngang `1600px` (`AK Rìu Thiêng.webp` `2048×1152→1600×900`, `Dao Bướm - Hoàng Hôn Tội Lỗi.webp` `2670×1200→1600×719`, `Dù Saitama.webp` `2048×942→1600×736`, `M4A1.webp` `2048×921→1600×720`, `Spear Blossom.webp` `1913×1027→1600×859`, `dao bướm.webp` `2048×921→1600×720`, `PSNR = 40,7–43,2 dB`); toàn bộ **`121`** ảnh feedback giữ nguyên kích thước pixel gốc.
- **Độ trung thực (`PSNR`):** Trung bình **`41,39 dB`**, thấp nhất **`36,92 dB`** (`pictures/M700 ELIZABETH/merged-image (4).webp`, `722×800`).
- **Rà mắt ghép cặp `ORIG` vs `WEBP` vs crop `1:1` (`webp_spotcheck_1.png`, `webp_spotcheck_2.png`):** Kiểm tra 8 mẫu đại diện đủ 6 thư mục (gồm `merged-image`, `Screenshot_...`, `photo-collage.png.webp`, `Spear Blossom.webp` và file PSNR thấp nhất `merged-image (4).webp`) — chữ chat tiếng Việt, số tiền bill chuyển khoản, màu sắc và bố cục sắc nét, không bệt hay lệch màu.

---

## 3. Đồng Bộ Mã Nguồn & Vệ Sinh Repository

### 3.1. Cập nhật đường dẫn `.webp` & cache-busting `?v=7`
- [`data.js`](../../data.js): Cập nhật toàn bộ `121` mục `feedbackData` (`path`, `filename`) và `7` mục `CATEGORY_DATA` (`image`) sang `.webp`.
- [`shared.js`](../../shared.js): Cập nhật `7` mục `FALLBACK_CATEGORIES` sang `.webp`; thêm hàm `normalizeLocalPicturePath()` để tự quy đổi các đường dẫn `pictures/.../*.{jpg,jpeg,png}` → `.webp` bên trong `normalizeCategoryRecord()`, `getDeletedBasePaths()`, `addDeletedBasePath()` và `combineFeedbackSources()` — giúp tương thích ngay với `public.categories` trên Supabase và `localStorage` cũ trong trình duyệt khách.
- [`index.html`](../../index.html) & [`admin.html`](../../admin.html): Nâng query cache-busting CSS/JS từ `?v=6` lên `?v=7`, cập nhật placeholder ví dụ trong Admin sang `.webp`.

### 3.2. Dọn file thừa & cấu hình deploy duy nhất
- **Đã xóa theo đúng phạm vi:** `server.js`, `package.json`, `netlify.toml`, `_redirects`, `test.js`, `New folder/` (gồm cả bản copy cũ và `Kho_Feedback_Website_UI.jsx`), `New folder.zip`.
- **Cấu hình deploy:** [`vercel.json`](../../vercel.json) (`{"cleanUrls": true, "trailingSlash": false}`) là cấu hình deploy duy nhất còn lại cho site static thuần (không còn `package.json` hay bước cài Express).

---

## 4. Kết Quả Kiểm Tra Thực Tế Sau Chỉnh Sửa Cuối

| Hạng mục kiểm tra | Phạm vi / Điều kiện | Kết quả |
| --- | --- | --- |
| `node --check` | 8 tệp JS: `shared.js`, `data.js`, `app.js`, `admin.js`, `supabase-config.js`, `seed-supabase.js`, `scripts/cleanup-orphan-storage.js`, `scripts/backup-supabase.js` | **Đạt** (`exit code 0`, `NODE_CHECK_ALL_8_OK`) |
| Kiểm tra Giai đoạn 4 (`check_phase4.js`) | `128` file `.webp` (`0` `.jpg`/`.png`), `121` path + `7` category trong `data.js` tồn tại thật, `normalizeLocalPicturePath()`, `deleted_base_feedback_paths` `.jpg` cũ lọc đúng `.webp`, `7` item thừa gồm `package.json` đã mất, `vercel.json` hợp lệ, `?v=7`, snapshot backup `7/60/60` | **Đạt** (`exit code 0`, `PHASE 4 CHECKS PASSED!`) |
| Kiểm định chất lượng WebP vs `git HEAD` | `128/128` ảnh: `0` lỗi tỉ lệ khung hình, `6` thẻ resize về `1600px`, PSNR TB `41,39 dB` (min `36,92 dB`), rà mắt 8 mẫu ghép cặp `1:1` đủ 6 thư mục | **Đạt** (`exit code 0`) |
| Hồi quy Giai đoạn 1–3 (`check_phase1.js`, `check_phase2_dom.js`, `check_phase3.js`) | Chạy lại nguyên bộ kiểm định DOM + Auth/RLS/XSS + Search/Lightbox/Quick-Lock trên mock DOM | **Đạt** (`EXIT_P1=0`, `EXIT_P2=0`, `EXIT_P3=0`) |
| `git status -sb` | Xác nhận thư mục `backups/` bị `.gitignore` bỏ qua, chỉ có thay đổi của Giai đoạn 4 | **Đạt** |

---

## 5. Kết Quả Deploy Production (Mốc 1) & Bước Tiếp Theo (Mốc 2)

### 5.1. Đẩy mã nguồn Mốc 1 lên Git & Vercel
- Kiểm tra `git status --short` ngay trước khi stage xác nhận đúng `268` thay đổi (`12` tệp ngoài `pictures/` + `128` ảnh cũ xóa + `128` `.webp` mới), không dính `backups/` hay `New folder*`.
- Commit Giai đoạn 4: `8a7b69e` (`feat(perf): complete phase 4 webp optimization, repo cleanup and backup cli`) đẩy thành công lên `origin/main` (`f3282d1..8a7b69e`).

### 5.2. Xác minh chỉ-đọc trên `https://feedback-hiroki.vercel.app/` (`READY on attempt 1`, exit code `0`)
- `https://feedback-hiroki.vercel.app/` → **`HTTP 200`**, nạp đủ `style.css?v=7`, `data.js?v=7`, `shared.js?v=7`, `app.js?v=7`.
- `https://feedback-hiroki.vercel.app/admin` → **`HTTP 200`**, nạp đủ `admin.css?v=7`, `admin.js?v=7`.
- `https://feedback-hiroki.vercel.app/data.js?v=7` → **`HTTP 200`**, parse hợp lệ `121` `feedbackData` (`100%` `.webp`) và `7` `CATEGORY_DATA` (`100%` `.webp`).
- `https://feedback-hiroki.vercel.app/shared.js?v=7` → **`HTTP 200`**, có `function normalizeLocalPicturePath` và `pictures/thẻ/Spear Blossom.webp`.
- 7 mẫu ảnh `.webp` đại diện đủ cả 6 thư mục (kể cả đường dẫn UTF-8 có dấu tiếng Việt): tất cả trả **`HTTP 200`** với `content-type: image/webp`:
  - `/pictures/th%E1%BA%BB/Spear%20Blossom.webp` (`46.346` B), `/pictures/th%E1%BA%BB/M4A1.webp` (`35.914` B)
  - `/pictures/ak%20riu%20thi%C3%AAng/merged-image%20(1).webp` (`40.454` B)
  - `/pictures/M700%20ELIZABETH/merged-image%20(4).webp` (`46.354` B)
  - `/pictures/dao%20b%C6%B0%E1%BB%9Bm/photo-collage.png.webp` (`60.322` B)
  - `/pictures/d%C3%B9%20saitama/merged-image%20(17).webp` (`37.334` B)
  - `/pictures/m4a1%20Battle%20of%20Faith/merged-image%20(24).webp` (`46.676` B)
- File thừa đã gỡ (`/server.js`, `/package.json`, `/test.js`) → tất cả trả **`HTTP 404`**.

### 5.3. Bước tiếp theo — Mốc 2 (Chờ xác nhận riêng sau khi Mốc 1 chạy ổn)
1. Chạy lại `node scripts/backup-supabase.js` lấy snapshot mới ngay trước khi ghi DB.
2. Chạy Seed `121` mục từ `data.js` vào `public.feedbacks` (chỉ chèn `121` dòng metadata trỏ đường dẫn tĩnh `pictures/.../*.webp` trên Vercel, **không** upload thêm 121 file vào Supabase Storage) và cập nhật `7` cột `image` của `public.categories` từ `.jpg`/`.png` sang `.webp`.

