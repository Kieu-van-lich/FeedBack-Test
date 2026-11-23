# Phương Án Triển Khai — Kho Feedback

**Workspace:** `d:\Documents\feedback - Copy` · **Cập nhật:** 22/11/2026 · **Trạng thái:** Đã chốt phạm vi, chưa bắt đầu code

---

## 1. Quyết định đã chốt

| Hạng mục | Quyết định |
| --- | --- |
| Phạm vi | Cả 4 giai đoạn, triển khai tuần tự |
| Đăng nhập Admin | Chuyển hẳn sang Supabase Auth (email + mật khẩu), bỏ hoàn toàn PIN `"090800"` |
| Hạ tầng deploy | Vercel là nền tảng chính thức duy nhất |
| `server.js` | Loại bỏ, không giữ lại Express local |

Còn 2 mục chưa chốt, để quyết định khi vào Giai đoạn 3: kênh liên hệ CTA (Zalo/FB/Messenger/Telegram) và có nén ảnh sang WebP + bật lại `#filterTabs` hay không.

---

## 2. Nguyên tắc xuyên suốt khi triển khai

- Nếu site đang public với key Supabase thật, lỗ hổng RLS (A2) và PIN backdoor (A1) nên được vá sớm nhất có thể — có thể tách ra làm trước, song song với việc refactor cấu trúc code ở Giai đoạn 1, thay vì chờ xong toàn bộ Phase 1 rồi mới sang Phase 2.
- Mỗi giai đoạn chốt xong, kiểm tra chạy ổn định, rồi mới chuyển giai đoạn kế tiếp — tránh vừa đổi cấu trúc file vừa đổi cơ chế Auth trong cùng một đợt sửa, vì khi lỗi phát sinh sẽ khó xác định nguồn.
- Giai đoạn 2 (đổi Auth, siết RLS) cần tạo tài khoản Admin thật trên Supabase **trước khi** khoá quyền ghi của `anon`, để tránh tự khoá quyền truy cập của chính mình giữa chừng.

---

## 3. Giai đoạn 1 — Sửa bug cốt lõi & đồng bộ dữ liệu

**Mục tiêu:** đưa toàn bộ thao tác Add/Edit/Delete về đồng bộ thật với Supabase, dọn cấu trúc file admin.

**Đầu việc:**

- Sửa lỗi đóng thiếu thẻ HTML trong `admin.html`; tách CSS inline ra `admin.css`, tách JS inline gom về `admin.js`; tạo `shared.js` cho logic dùng chung giữa trang công khai và trang quản trị.
- Hoàn thiện Edit: hiện đang thiếu thao tác `UPDATE` thật lên Supabase, và lệch chữ hoa/thường khi mở lại form Sửa danh mục — cần đồng nhất định dạng danh mục giữa `data.js`, `localStorage` và Supabase trước khi load vào form.
- Hoàn thiện Add bằng URL thủ công (hiện chỉ có batch upload file, chưa có đường dẫn Add-by-URL đồng bộ Supabase).
- Nén ảnh phía client trước khi upload lên Storage; khi xoá feedback, xoá luôn file tương ứng trên Storage (hiện Delete chỉ xoá bản ghi DB, không xoá Storage).
- Tạo bảng `categories` trên Supabase (SQL đã có sẵn trong bản phân tích gốc) và chuyển quản lý danh mục từ `localStorage` sang bảng này.
- Seed chống trùng: thêm `UNIQUE` constraint trên cột `path`, dùng upsert thay vì insert thẳng khi chạy lại Seed từ `data.js`.
- Sửa nút Reset đang thiếu `await`, khiến thao tác reset không chờ Supabase phản hồi xong.

**Tiêu chí hoàn thành:** Add (nhiều ảnh / URL), Sửa, Xoá feedback và danh mục đều phản ánh ngay trên Supabase, và giữ nguyên sau khi F5 hoặc mở lại ở trình duyệt khác.

**Phụ thuộc:** cần file nguồn thật (không chỉ bản phân tích) để sửa đúng theo cấu trúc và số dòng đã khảo sát, tránh đè nhầm logic đang chạy được.

---

## 4. Giai đoạn 2 — Bảo mật & chống XSS

**Mục tiêu:** loại bỏ hoàn toàn cơ chế khoá giả (PIN) và lỗ hổng ghi/xoá công khai.

**Đầu việc:**

- Tạo tài khoản Admin thật trong Supabase Auth (email + mật khẩu) trước khi đổi code.
- Thay toàn bộ luồng đăng nhập PIN bằng `supabaseClient.auth.signInWithPassword`, quản lý session qua `supabaseClient.auth` thay vì `sessionStorage`.
- Áp SQL RLS theo đúng thứ tự: tạo bảng/cột trước → bật `ENABLE ROW LEVEL SECURITY` → tạo policy sau cùng, để tránh có khoảng trống khoá nhầm quyền đọc công khai của trang chủ.
- Policy chuẩn: `SELECT` mở công khai cho `categories` và `feedbacks`; `INSERT`/`UPDATE`/`DELETE` trên cả hai bảng và trên `storage.objects` chỉ cho `authenticated`. Có thể siết thêm bằng kiểm tra đúng `auth.jwt() ->> 'email'` nếu chỉ có một tài khoản Admin duy nhất, và tắt tính năng Sign-up tự do trong Supabase Dashboard.
- Viết hàm `escapeHtml()` dùng chung, bọc mọi text (tiêu đề, tên danh mục, tên file) trước khi đưa vào DOM.
- Chuyển các nút đang dùng inline `onclick="..."` (preview ảnh, edit, delete) sang `data-id` + `addEventListener` (event delegation), loại bỏ nguy cơ vỡ nút bấm hoặc XSS khi dữ liệu chứa dấu nháy/ngoặc kép.

**Tiêu chí hoàn thành:** khách ẩn danh không thể `POST`/`PATCH`/`DELETE` qua REST API; nhập ký tự đặc biệt `' " < >` vào tiêu đề/danh mục không làm vỡ giao diện hay chạy script.

---

## 5. Giai đoạn 3 — UI/UX, Responsive & SEO

**Đầu việc:**

- Thêm Hamburger menu mobile ở trang chủ, giữ nút điều hướng mobile ở trang Admin.
- Gắn nút liên hệ giao dịch nổi (Zalo/Facebook/Messenger/Telegram) — chờ xác nhận kênh và đường dẫn cụ thể.
- Bật tìm kiếm tiếng Việt không dấu ở trang chủ.
- Nâng cấp Lightbox: tải ảnh cross-origin bằng Blob (thay vì link trực tiếp hay bị chặn CORS khi tải về), hỗ trợ kéo ảnh khi đã zoom, thêm fallback khi ảnh lỗi (`onerror`).
- Quyết định bật lại thanh pill lọc nhanh `#filterTabs` hay bỏ hẳn rule CSS chưa dùng.
- Chuẩn hoá chính tả tên danh mục (ví dụ thống nhất "AK Rìu Thiêng"), thêm Favicon và thẻ Meta SEO / Open Graph để khi chia sẻ link có card preview.

**Tiêu chí hoàn thành:** hiển thị mượt trên desktop và mobile (375px), tìm kiếm không dấu ra đúng kết quả, tải được ảnh từ Supabase về máy, chia sẻ link có preview đẹp.

---

## 6. Giai đoạn 4 — Tối ưu hiệu năng & vệ sinh repo

**Đầu việc:**

- Nén/chuyển định dạng ảnh trong `pictures/` sang WebP (hoặc JPG tối ưu), giảm từ \~43 MB xuống mức nhẹ nhất vẫn giữ rõ nội dung; cập nhật lại đường dẫn trong `data.js` nếu đổi đuôi file.
- Thêm `.gitignore`; dọn `New folder/`, `New folder.zip`, `test.js` ra khỏi repo (có thể giữ riêng file thiết kế Photoshop `Kho_Feedback_Website_UI.jsx` sang thư mục `design/` nếu còn cần tham khảo).
- Chốt `vercel.json` là config deploy duy nhất; xoá `netlify.toml`, `_redirects`, và `server.js`/`package.json` liên quan đến Express nếu không còn dùng.

**Tiêu chí hoàn thành:** dung lượng tải trang giảm rõ rệt, git tree sạch, quy trình deploy một cửa qua Vercel.

---

## 7. Rủi ro cần lưu ý khi triển khai

- **Xoá `server.js`:** xác nhận không còn quy trình thủ công nào (kể cả nội bộ, ngoài code) đang phụ thuộc endpoint `POST /api/feedbacks/upload` của nó trước khi xoá hẳn.
- **Đổi Auth giữa chừng:** nếu triển khai Giai đoạn 2 mà chưa tạo xong tài khoản Admin thật, có thể bị khoá luôn quyền truy cập trang quản trị của chính mình — cần test đăng nhập bằng tài khoản mới **trước khi** tắt PIN cũ.
- **Seed chống trùng:** phải thêm `UNIQUE` constraint trên `path` trước khi chạy lại `seed-supabase.js`, nếu không sẽ tạo bản ghi trùng thay vì cập nhật.
- **Thứ tự chạy SQL RLS:** bật `ENABLE ROW LEVEL SECURITY` mà chưa có policy `SELECT` công khai sẽ làm trang chủ không load được dữ liệu — cần tạo policy đọc trước hoặc chạy trong cùng một transaction.

---

## 8. Việc cần làm tiếp theo

Khi sẵn sàng chuyển sang code, cần các file nguồn thật để bắt tay Giai đoạn 1 theo đúng số dòng đã khảo sát trong bản phân tích gốc:

`index.html`, `app.js`, `style.css`, `admin.html`, `admin.js`, `supabase-config.js`, `data.js`, `package.json`, `vercel.json`, `seed-supabase.js` (nếu giữ cho việc seed chống trùng).

Không cần gửi `server.js`, `netlify.toml`, `_redirects`, `New folder/` — theo quyết định ở Mục 1, các file này sẽ bị loại bỏ.
