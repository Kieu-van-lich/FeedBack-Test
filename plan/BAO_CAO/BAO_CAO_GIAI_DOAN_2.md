# Báo Cáo Nghiệm Thu Giai Đoạn 2 — Kho Feedback (Khôi Phục Dữ Liệu + Supabase Auth & RLS + Chống XSS)

> **Workspace:** `d:\Documents\feedback - Copy`  
> **Ngày hoàn thành:** 23/11/2026  
> **Tài liệu tham chiếu:** [`Phuong_An_Trien_Khai_Kho_Feedback.md`](../PHUONG_AN/Phuong_An_Trien_Khai_Kho_Feedback.md)  
> **Trạng thái tổng thể:** Đã **khôi phục đủ 9 bản ghi `Dao Bướm - Sunnet Vice`**, hoàn tất **100% mã nguồn Giai đoạn 2** (loại bỏ hoàn toàn PIN `"090800"`, chuyển sang Supabase Auth thật, xóa sạch inline event handlers, vá chống XSS/CSS-injection/SVG-URL), **áp dụng thành công RLS chặt chẽ lên Supabase live (`frnepaasslsbbmxvvhsb`)**, và **xác minh thực tế** cả chiều chặn ghi ẩn danh (`anon` → `401`/`403`) lẫn luồng CRUD + Auth trên Chrome thật. Chưa đụng code Giai đoạn 3 (UI/UX & SEO) và chưa xóa file Giai đoạn 4.

---

## 1. Khôi Phục Dữ Liệu Danh Mục `Dao Bướm - Sunnet Vice`

- **Đối chiếu trước khôi phục:** Bảng `public.feedbacks` còn **51** dòng (thiếu **9** dòng `Dao Bướm - Sunnet Vice — Feedback #01`..`#09` từng lưu trong [`backups/supabase_backup_20261123.json`](../../backups/supabase_backup_20261123.json)), trong khi cả **9 file ảnh trên Storage** (`960.284` bytes) vẫn còn nguyên (`HTTP 200`).
- **Kết quả khôi phục:** Upsert lại đủ **9** bản ghi từ bản backup với quyền Admin JWT (`on_conflict=path`) → **`RESTORED_COUNT=9`**, nâng tổng `public.feedbacks` live về đúng **60** dòng (`M4A1 Battle of Faith`: **17**, `Spear Blossom`: **34**, `Dao Bướm - Sunnet Vice`: **9**).
- **Xác minh hiển thị trên `index.html` cục bộ:** Tổng **181** feedback (`60` Supabase + `121` trong `data.js`), cả 7 danh mục khớp chính xác (`M4A1 Battle of Faith`: **45**, `Ak Riu Thiêng`: **30**, `Dao Bướm`: **24**, `Dù Saitama`: **12**, `M700 ELIZABETH`: **27**, `Spear Blossom`: **34**, `Dao Bướm - Sunnet Vice`: **9**); bấm thẻ `Dao Bướm - Sunnet Vice` tải đủ **9/9** ảnh thật (`naturalWidth = 576`).

### 1.1. Truy vết nguyên nhân gốc từ `transcript.jsonl` & Supabase API Gateway (`edge_logs`)

- **Xác nhận smoke-test không xóa nhầm bản ghi thật:**
  - **Smoke-test Giai đoạn 1 (`14:15:18`–`14:15:35 GMT+7` / `07:15:18`–`07:15:35 UTC`, 23/11/2026):** Tạo riêng bản ghi PNG tạm `id = ea0427aa-ef71-4a38-9e91-713592f58868` (`uploads/1795418117398_20wics.png`), sửa tiêu đề thành `"SMOKE_TEST_EDITED"`, rồi chỉ xóa đúng UUID và file Storage đó (`DELETE /rest/v1/feedbacks?id=eq.ea0427aa-ef71-4a38-9e91-713592f58868` → `204`). Truy vấn SQL lúc `14:15:42 GMT+7` xác nhận nguyên vẹn `{"feedbacks_count":60,"storage_objects_count":60,"orphan_count":0}`, và các tab test cục bộ đã được đóng ngay sau đó.
  - **Smoke-test Giai đoạn 2 (`15:36:13`–`15:36:15 GMT+7` / `08:36:13`–`08:36:15 UTC`):** Tạo và xóa riêng bản ghi `id = 9aacd760-9c01-4671-8df1-b3ea66112a29` (`title: "PHASE2_SMOKE"`, `uploads/phase2_rls_smoke.png`).
- **Thời điểm & tác nhân xóa thật theo `edge_logs`:** Trong khoảng agent hoàn toàn rảnh chờ phản hồi người dùng (`14:16:18`–`14:27:00 GMT+7`, 0 tool call), Supabase API Gateway `edge_logs` ghi nhận **9 request `DELETE /rest/v1/feedbacks?id=eq.<uuid>` riêng lẻ (`HTTP 204`)** gửi cách nhau ~1 giây trong cửa sổ 9 giây từ **`14:25:48.244` đến `14:25:57.038 GMT+7`** (`07:25:48`–`07:25:57 UTC`) từ trình duyệt `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/157.0.0.0` (1 phút trước tin nhắn lúc `14:27:00` yêu cầu thêm danh mục `Dao Bướm - Sunnet Vice`):
  1. `14:25:48.244 GMT+7`: `id=eq.ceca1a39-b334-41ae-8be8-c1c992e8ddf1` (`Feedback #02`)
  2. `14:25:50.175 GMT+7`: `id=eq.0e51c54a-4723-49be-9a7c-13d0ea192b2e` (`Feedback #03`)
  3. `14:25:51.188 GMT+7`: `id=eq.b7c068e2-68c5-4ff6-994d-ec70abddb2e2` (`Feedback #04`)
  4. `14:25:52.205 GMT+7`: `id=eq.132735f7-27d7-4fb1-aff0-9b64400ecfae` (`Feedback #05`)
  5. `14:25:53.274 GMT+7`: `id=eq.378ae1a5-2093-42f6-b223-7bf20c2682ef` (`Feedback #06`)
  6. `14:25:54.265 GMT+7`: `id=eq.b3b3ad59-7e0b-4cab-aa0e-986082d13464` (`Feedback #07`)
  7. `14:25:55.xxx GMT+7`: `id=eq.d7ab4b7c-425d-4861-9513-724ac870a318` (`Feedback #08`)
  8. `14:25:56.111 GMT+7`: `id=eq.9b859ed3-ac36-4f0d-af34-9b727a85b956` (`Feedback #09`)
  9. `14:25:57.038 GMT+7`: `id=eq.ea4bde1a-d8ff-496b-9248-f84ae64979af` (`Feedback #01`)
- **Lý do Storage không bị xóa kèm & xác minh logic code:** Trong cùng cửa sổ `14:25:48`–`14:25:57 GMT+7` có **0 request `DELETE /storage/v1/object/...`** — khớp chính xác hành vi code `origin/main` đang chạy trên tab `https://feedback-hiroki.vercel.app/admin` mở sẵn trên Chrome lúc đó (code cũ chỉ xóa dòng DB mà không xóa file Storage). Đồng thời đã kiểm tra `deleteSupabaseFeedback(id)` trong [`supabase-config.js`](../../supabase-config.js): hàm luôn lọc đơn lẻ theo `.eq("id", id)`, hoàn toàn không có đường code xóa hàng loạt theo danh mục.
- **Quy tắc chống tái diễn cho Giai đoạn 3 & 4:** Mọi bài smoke-test thao tác xóa về sau bắt buộc phải tạo riêng một bản ghi test mới mang nhãn tiêu đề **`"TEST_DELETE_ME"`** và chỉ xóa đúng UUID vừa tạo, tuyệt đối không thao tác thử trên bản ghi dữ liệu thật.

---

## 2. Tóm Tắt Các Thay Đổi Bảo Mật Giai Đoạn 2

| Hạng mục (Mục 4 & 11.5) | Trạng thái | Chi tiết triển khai |
| --- | --- | --- |
| Loại bỏ hoàn toàn PIN backdoor (`"090800"`) | Đã xong | Xóa bỏ `getAdminPin()`, `admin_pin_code`, `admin_auth_session`, `#pinAuthForm`, `#changePinForm` và đoạn inline `<script>` mở khóa sớm trong [`admin.html`](../../admin.html) & [`admin.js`](../../admin.js). |
| Chuyển đăng nhập sang **Supabase Auth** | Đã xong | Bổ sung `getSupabaseSession`, `requireSupabaseAdminSession`, `signInSupabaseAdmin`, `signOutSupabaseAdmin`, `updateSupabaseAdminPassword`, `onSupabaseAuthStateChange` và bộ nhận diện lỗi `401`/`403`/`42501` trong [`supabase-config.js`](../../supabase-config.js). Mọi thao tác ghi DB/Storage đều kiểm tra session trước khi gửi request. |
| Giao diện đăng nhập & quản lý phiên Admin | Đã xong | Thay modal PIN trong [`admin.html`](../../admin.html) + [`admin.css`](../../admin.css) bằng `#authLoginForm` (`#authEmailInput`, `#authPasswordInput`), thay nút `#lockAdminBtn` bằng `#logoutAdminBtn`, thêm badge phiên `#adminUserBadge` và khung đổi mật khẩu `#changePasswordForm` gọi `auth.updateUser`. Khi chưa đăng nhập hoặc sau khi đăng xuất, `#adminTableBody`, `#categoryTableBody` và `#adminStatsGrid` bị xóa trắng khỏi DOM (`clearProtectedAdminUI()`). |
| Siết chặt **RLS trên Supabase live** | Đã xong | Tạo [`supabase/phase2_auth_rls.sql`](../../supabase/phase2_auth_rls.sql) và chạy commit trực tiếp trên Supabase live: dọn toàn bộ policy ghi public/tạm cũ; giữ `SELECT` công khai cho khách; chỉ cho `INSERT`/`UPDATE`/`DELETE` trên `public.categories`, `public.feedbacks`, `storage.objects` (`feedback-images`) khi `role = authenticated` và `lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com'`. |
| Gỡ inline `onclick` còn sót & vá XSS/URL | Đã xong | Chuyển 5 link footer `onclick="filterByWeapon(...)"` trong [`index.html`](../../index.html) sang `data-weapon="..."` + listener trong [`app.js`](../../app.js) (toàn bộ HTML không còn inline `on*`). Bổ sung `isSafeCssRgbaOrHex()` trong [`shared.js`](../../shared.js) kiểm tra giá trị `--accent-glow` trước khi đưa vào `style=""`, siết `isSafeImageUrl()` chỉ nhận `data:image/(png\|jpe?g\|webp\|gif);` (chặn `data:image/svg+xml`), kiểm tra URL trước `window.open()` ở [`admin.js`](../../admin.js), và nâng cache-busting `?v=5`. |

---

## 3. Danh Sách Tệp Tin Tạo Mới & Chỉnh Sửa

### Tạo mới trong workspace
- [`supabase/phase2_auth_rls.sql`](../../supabase/phase2_auth_rls.sql) — Script SQL idempotent khóa toàn bộ quyền ghi về riêng tài khoản Admin đã xác thực.
- [`plan/BAO_CAO/BAO_CAO_GIAI_DOAN_2.md`](./BAO_CAO_GIAI_DOAN_2.md) — Báo cáo nghiệm thu này.

### Chỉnh sửa trong workspace
- [`shared.js`](../../shared.js) — Siết `isSafeImageUrl()` (chặn `data:image/svg+xml`), thêm `isSafeCssRgbaOrHex()`.
- [`supabase-config.js`](../../supabase-config.js) — Thêm lớp Supabase Auth lifecycle, `requireSupabaseAdminSession()` cho toàn bộ hàm ghi/xóa DB & Storage, và `formatSupabaseWriteError()`.
- [`admin.html`](../../admin.html) — Thay form PIN bằng form Supabase Auth (`#authLoginForm`, `#changePasswordForm`, `#logoutAdminBtn`, `#adminUserBadge`), xóa inline `<script>`, cập nhật `?v=5`.
- [`admin.css`](../../admin.css) — Bổ sung style `.admin-auth-form`, `.admin-auth-field`, `.admin-auth-label`, `.admin-auth-input`, `.admin-session-summary`.
- [`admin.js`](../../admin.js) — Thay `setupAdminSecurity()` bằng `setupAdminAuth()` gắn `onSupabaseAuthStateChange`, xóa DOM nhạy cảm khi chưa đăng nhập/đăng xuất, áp dụng `isSafeCssRgbaOrHex()` và kiểm tra `isSafeImageUrl()` trước `window.open()`.
- [`index.html`](../../index.html) — Gỡ 5 `onclick="filterByWeapon(...)"` sang `data-weapon`, nâng `?v=5`.
- [`app.js`](../../app.js) — Gắn listener `[data-weapon]` và lọc `safeGlow` bằng `isSafeCssRgbaOrHex()`.

---

## 4. Kết Quả Kiểm Tra Thực Tế Sau Chỉnh Sửa Cuối

| Hạng mục kiểm tra | Phạm vi / Điều kiện | Kết quả thực tế |
| --- | --- | --- |
| Cú pháp & quét tĩnh | `node --check` trên 7 tệp JS + `Select-String` tìm `090800`, `admin_pin_code`, `admin_auth_session`, inline `on*=` trên toàn bộ HTML/JS | **Đạt** (exit code `0`, `STATIC_SWEEP_DONE`, không còn dấu vết PIN hay inline handler) |
| Kiểm tra đơn vị & DOM Giai đoạn 1+2 (`check_phase1.js`, `check_phase2_dom.js`) | Mock DOM + mock Supabase Auth/RLS: trạng thái khóa trước đăng nhập, chặn ghi không session, đăng nhập sai/đúng, payload XSS `"' <img src=x onerror="alert(1)"> &`, đổi mật khẩu, đăng xuất xóa DOM | **Đạt** (exit code `0`, `ISOLATED UNIT CHECKS PASSED!`, `PHASE 2 AUTH & XSS INTEGRATION CHECKS PASSED!`) |
| Kiểm thử REST RLS trực tiếp trên Supabase live (`frnepaasslsbbmxvvhsb`) | Gọi REST thật bằng publishable/anon key vs JWT của `lichchoilienquan@gmail.com` | **Đạt:** `ANON_READ_CAT=200 (7)`, `ANON_READ_FB=200 (60)`, `ANON_INSERT_FB=401 (42501)`, `ANON_INSERT_CAT=401 (42501)`, `ANON_UPDATE_FB=200 [] (0 rows)`, `ANON_DELETE_FB=200 [] (0 rows)`, `ANON_STORAGE_UPLOAD=400/403 AccessDenied`; sau đó Admin JWT chạy `POST` Storage (`200`) → `INSERT` (`201`) → `PATCH` (`200`) → `DELETE` DB (`200`) → `DELETE` Storage (`200`), giữ nguyên **60** dòng DB |
| Kiểm thử trình duyệt Chrome thật trên server cục bộ (`http://127.0.0.1:5599`) | `index.html` & `admin.html` kết nối trực tiếp Supabase live | **Đạt:** `index.html` hiển thị đủ **7/7** danh mục (`181` item, `Dao Bướm - Sunnet Vice: 9`, 9/9 ảnh load `naturalWidth=576`, link footer `data-weapon` lọc đúng, **0** lỗi console); `admin.html` khóa mặc định (`CHƯA ĐĂNG NHẬP`, `0` dòng bảng), đăng nhập thật `lichchoilienquan@gmail.com` mở ra **181** item / **7** danh mục, bấm `Đăng xuất` khóa lại và xóa sạch bảng về `0` dòng |

---

## 5. Cảnh Báo Vận Hành Khẩn Cấp & Bước Tiếp Theo

- **Cảnh báo khẩn — Trang Admin trên Production (`https://feedback-hiroki.vercel.app/admin`) hiện đang hỏng phần ghi dữ liệu:** Vì RLS Giai đoạn 2 trên Supabase live đã khóa hoàn toàn quyền `INSERT`/`UPDATE`/`DELETE` của `anon`, trong khi Vercel production vẫn đang chạy commit `origin/main` cũ (dùng PIN `"090800"` và gửi request bằng `anon` key không có JWT Admin), **mọi thao tác Thêm / Sửa / Xóa trên `feedback-hiroki.vercel.app/admin` ngay lúc này sẽ thất bại âm thầm hoặc bị từ chối (`401`/`403`/`[]`)** cho tới khi deploy code Giai đoạn 1+2. Trang chủ công khai (`SELECT`) vẫn hoạt động bình thường. **Cần ưu tiên `git push` / deploy code Giai đoạn 1+2 lên Vercel ngay**, không đợi chốt xong Giai đoạn 3.
- **Đổi mật khẩu Admin ngay qua `#changePasswordForm`:** Khuyến nghị sử dụng ngay khung **"Tài Khoản Admin & Đổi Mật Khẩu (Supabase Auth)"** vừa tích hợp trong [`admin.html`](../../admin.html) để đổi mật khẩu từng xuất hiện trong lịch sử chat sang mật khẩu mới (tối thiểu 8 ký tự).
- **Chuẩn smoke-test Giai đoạn 3 & 4:** Không test chức năng Xóa trực tiếp trên production; mọi smoke-test (đặc biệt thao tác Delete) chạy hoàn toàn ở local/dev với bản ghi test riêng mang tiêu đề `"TEST_DELETE_ME"` và xóa đúng theo UUID đó, trên production chỉ kiểm tra đọc/hiển thị xác nhận cuối sau khi deploy.
- **Lưu ý trước khi `git push`:** Hai commit mới trên `origin/main` (`f01e664`, `0f9aca7`) chỉ chứa đúng 2 ảnh đại diện thẻ `Spear Blossom.png` (`110.510` bytes) và `Dao Bướm - Hoàng Hôn Tội Lỗi.jpg` (`95.187` bytes) — đã khớp 100% dung lượng với bản cục bộ. Cần tạo `.gitignore` cho `backups/` (hoặc chỉ stage đúng các tệp Giai đoạn 1+2) trước khi push để không đưa [`backups/supabase_backup_20261123.json`](../../backups/supabase_backup_20261123.json) lên GitHub.
- **Tùy chọn trước/trong Giai đoạn 3 & 4:**
  - Chốt 2 điểm của **Giai đoạn 3** (kênh liên hệ CTA Zalo/FB/Messenger/Telegram và bật lại `#filterTabs` hay bỏ CSS thừa).
  - Rà mắt 8 ảnh `1.jpg`–`8.jpg` (`M4A1 Battle of Faith`) nếu muốn Seed 121 ảnh từ `data.js` lên Supabase.
  - Thêm `backups/` vào `.gitignore` ở Giai đoạn 4 để không commit dữ liệu backup lên git.

