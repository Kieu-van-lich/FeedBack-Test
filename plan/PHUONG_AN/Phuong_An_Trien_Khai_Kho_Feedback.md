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
- Mỗi giai đoạn chốt xong, kiểm tra chạy ổn định, ránh vá cấu trúc file và đổi cơ chế Auth trong cùng một đợt sửa, vì khi lỗi phát sinh sẽ khó xác định nguồn.
- Giai đoạn 2 (đổi Auth, siết RLS) cần tạo tài khoản Admin thật trên Supabase **trước khi** khoá quyền ghi của `anon`, để tránh tự khoá quyền truy cập của chính mình giữa chừng.

---

## 3. Giai đoạn 1 — Sửa bug cốt lõi & đồng bộ dƺ liệu

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
- Chuyển các nút đang dùng inline `onclick="..."` (preview ảnh, edit, delete) sang `data-id` + `addEventListener` (event delegation), loại bỏ nguy cơ vỡ nút bấm hoặc XSS khi dữ liệu chứa dấu nháy/ngoặc hép.

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

**Tiêu chí hoàn thành:** dung lượng tải trang giảm rõ rét, git tree sạch, quy trình deploy một cửa qua Vercel.

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

---

## 9. Cập nhật sau báo cáo Giai đoạn 1

**Trạng thái:** Phần mã nguh���n Giai đoạn 1 đã được hoàn thành (DOM/cấu trúc, CRUD Edit/Add URL/Delete/Upload, nén ảnh client, đồng bộ danh mục, seed chống trùng, async Reset) và đã qua kiểm tra cú pháp + script kiểm tra độc lập. **Chưa** chạy migration SQL lên Supabase live, chưa test trên trình duyệt thật.

**Khảo sát thực tế trên Supabase live (chỉ đọc):**

- `public.feedbacks`: 60 bản ghi thật, không path trùng.
- Bucket `feedback-images`: 99 file, trong đó ước tính 39 file mồ côi (không còn bản ghi DB tham chiếu).
- `public.categories`: chưa tồn tại; danh mục "Spear Blossom" hiện chỉ nằm trong `localStorage` của một trình duyệt cụ thể.
- `auth.users`: 0 tài khoản. Policy hiện tại chưa có `UPDATE` cho `feedbacks`, chưa có `DELETE` cho `storage.objects`.

### 9.1. Việc cần tự làm để chốt Giai đoạn 1

- [ ] **Backup Supabase project** trước khi chạy bất kỳ migration nào (Dashboard → Database → Backups, hoặc `pg_dump`) — bắt buộc vì DB đang có dữ liệu thật đang chạy.
- [ ] Review nội dung `phase1_sync.sql` trước khi chạy, đặc biệt các policy tạm `UPDATE`/`DELETE` — xác nhận chúng chỉ mở tạm thời và sẽ bị thay bằng policy siết chặt ở Giai đoạn 2, không để treo lâu ở trạng thái mở cho `anon`.
- [ ] Chạy `phase1_sync.sql` lên Supabase live sau khi đã backup.
- [ ] Trên **đúng trình duyệt** đang giữ danh mục "Spear Blossom" trong `localStorage`: mở `admin.html`, bấm nút "⬆️ Đồng bộ Danh mục lên Supabase" để đồng bộ mọi thiết bị.
- [ ] Dọn 39 file mồ côi trong bucket `feedback-images` (không chặn tiến độ, nhưng nên làm sớm, không cần đợi Giai đoạn 4).
- [ ] Test lại trên trình duyệt thật + Supabase live sau khi migration chạy xong (Edit, Add URL, Delete, Upload, Reset, đếm danh mục).

### 9.2. Chuẩn bị cho Giai đoạn 2 (Auth + siết RLS)

- [ ] Tạo tài khoản Admin thật trong Supabase Authentication bằng **email thật** (không dùng username suông) + mật khẩu.
- [ ] Nếu mật khẩu từng được gõ/dán ở nơi không an toàn (chat, ghi chú không mã hoá...), đổi lại mật khẩu khác sau khi xác nhận đăng nhập được lần đầu.
- [ ] Test đăng nhập bằng tài khoản mới **trước khi** tắt PIN cũ, tránh tự khoá quyền truy cập Admin của chính mình.
- [ ] Sau khi xác nhận ổn, siết lại các policy tạm ở mục 9.1 thành chỉ cho `authenticated` (theo SQL chuẩn ở Mục 4).

---

## 10. Điểm còn thiếu / cần quyết định thêm

Những điểm này chưa được phản ánh trong các mục 1–9, cần chốt trước khi coi phương án là đầy đủ:

- [ ] **Cutover Netlify → Vercel:** xác nhận site hiện đang live chính thức ở đâu (Netlify, Vercel, hay cả hai song song). Nếu đang ở Netlify, bổ sung bước: trỏ DNS sang Vercel, cấp SSL, cấu hình lại biến môi trường Supabase key trên project Vercel, test ổn định trước khi gỡ Netlify.
- [ ] **Hợp nhất nguồn dữ liệu:** quyết định có Seed toàn bộ 121 ảnh gốc từ `data.js` lên Supabase hay không, để chuyển hẳn sang Supabase làm nguồn duy nhất — tránh phụ thuộc `deleted_base_feedback_paths` trong `localStorage`, vốn không đồng bộ giữa các thiết bị.
- [ ] **Test migration trước khi chạy live:** chạy thử `phase1_sync.sql` trong transaction có thể rollback, hoặc trên project Supabase clone/staging, trước khi áp lên DB thật.
- [ ] **Hành vi khi xoá category còn feedback tham chiếu:** chốt rõ — chặn xoá nếu còn feedback dùng, tự chuyển feedback liên quan về "Khác", hay cho mồ côi.
- [ ] **Checklist smoke-test sau mỗi lần deploy:** bổ sung danh sách thao tác kiểm tra cụ thể ngay sau khi lên live cho từng giai đoạn (đặc biệt sau khi bật RLS ở Giai đoạn 2: test đọc ẩn danh trước, rÛiỳ mới test ghi bằng tài khoản Admin).
- [ ] **Backup định kỳ sau mốc migrate:** ���ng chỉ backup một lần trước `phase1_sync.sql` — nếu project đang ở gói free (không có point-in-time recovery), cần thói quen backup thủ công định kỳ về sau.
- [ ] **Tính năng khoá nhanh màn hình (tuỳ chọn):** khi bỏ hẳn PIN, cân nhắc thêm một lớp "lock screen" thuần UX (không phải security boundary) ở Giai đoạn 3, nếu tiện ích khoá nhanh khi rši máy vẫn cần thiết.

---

## 11. Phương án xử lý chi tiết cho Mục 10

### 11.1. Cutover Netlify → Vercel — đã giải quyết

Xác nhận: site đã chuyển hẳn sang Vercel từ trước, Netlify chỉ còn sót config cũ, không có cutover thật nào cần làm. `netlify.toml` và `_redirects` chỉ cần xoá trong bước dọn file thừa ở Giai đoạn 4 — không cần xử lý riêng.

### 11.2. Hợp nhất nguồn dữ liệu — kiểm tra trùng trước khi Seed 121 ảnh

So tên danh mục cho thấy rủi ro trùng nội dung thật sự ở 2 nhóm:

- `m4a1 Battle of Faith` (28 ảnh trong data.js) có khả năng trùng với `M4A1 Battle of Faith` (17 bản ghi đã có trên Supabase).
- `dao bướm` (24 ảnh trong data.js) có khả năng trùng với `Dao Bướm - Sunnet Vice` (9 bản ghi đã có trên Supabase).
- `ak riu thiêng` (30), `dù saitama` (12), `M700 ELIZABETH` (27): không có tên danh mục trùng phía Supabase — an toàn để seed thẳng.

**Quy trình:** với 3 danh mục không trùng tên, seed thẳng. Với 2 danh mục nghi trùng, đối chiếu thủ công/script danh sách 60 bản ghi Supabase hiện có (category, tên file nếu Storage path còn giữ, created\_at) với các ảnh tương ứng trong `pictures/`, loại bỏ ảnh đã có bản tương ứng trước khi seed phần còn lại. `upsert on_conflict(path)` trong `seed-supabase.js` chỉ là lưới an toàn phụ cho trùng path dạng chuỗi, không bắt được trùng nội dung — bước đối chiếu thủ công ở trên vẫn là bước chính.

### 11.3. Test migration trước khi chạy live — transaction dry-run

Không cần project Supabase riêng. Chạy toàn bộ `phase1_sync.sql` trong `BEGIN; ... ROLLBACK;` trên SQL Editor trước — `ROLLBACK` huỷ mọi thay đổi nhưng vẫn lộ lỗi thật (vd. `UNIQUE(path)` fail do trùng path bị bỏ sót). Sạch lỗi thì đổi `ROLLBACK` thành `COMMIT` và chạy lại một lần thật. Thay đổi RLS (Giai đoạn 2) không cần dry-run kiểu này vì dễ sửa lại (`DROP POLICY`/tạo lại) — áp trực tiếp rồi test bằng checklist ở Mục 11.5.

### 11.4. Xoá category còn feedback tham chiếu — chặn xoá bằng đếm số lượng

Trước khi cho phép xoá 1 category: đếm số feedback đang dùng category đó (phía client hoặc 1 câu `SELECT count(*)` trước khi gọi API xoá). Nếu > 0: chặn xoá, báo "Danh mục này đang có N feedback dùng — chuyển sang danh mục khác trước khi xoá". Nếu = 0: cho xoá bình thường. Không cần foreign key + cascade ở quy mô 1 admin.

### 11.5. Checklist smoke-test sau mỗi lần deploy (áp dụng mọi giai đoạn)

- [ ] Mở trang chủ ẩn danh — gallery load đủ, đếm item đúng dự kiến.
- [ ] Tìm kiếm + lọc danh mục ra đúng kết quả.
- [ ] Mở Lightbox 1 ảnh — tải được, zoom được.
- [ ] Đăng nhập Admin bằng tài khoản thật — vào được bảng quản trị.
- [ ] Add 1 feedback test (ảnh tạm) — hiện ở cả Admin và trang công khai.
- [ ] Edit feedback test — F5 lại, thay đổi còn giữ.
- [ ] Delete feedback test — mất khỏi cả DB và Storage, không sinh file rác.
- [ ] DevTools Console/Network — không có lỗi đỏ.
- [ ] (Riêng sau khi đổi RLS) Tab ẩn danh gọi thẳng REST API `POST`/`DELETE` bằng anon key — phải bị từ chối (401/403).

### 11.6. Backup định kỳ sau mốc migrate

Project đang ở gói free (suy ra từ `keep-alive.yml`) → không có point-in-time recovery tự động. Phương án nhẹ: export thủ công hằng tuần qua Dashboard → Database → Backups, giữ 4 bản gần nhất. Nâng cấp sau (không gấp): thêm GitHub Actions workflow kiểu `keep-alive.yml`, chạy `pg_dump` theo lịch bằng connection string lưu trong GitHub Secrets, lưu dump vào kho riêng tư. Nguyên tắc cố định: luôn backup thêm 1 bản ngay trước **mọi** migration schema, không chỉ lần này.

### 11.7. "Khoá nhanh màn hình" — lớp UX tách khỏi bảo mật thật

Không phải ranh giới bảo mật — bảo mật thật nằm ở Supabase Auth + RLS. Làm ở Giai đoạn 3: thêm nút "🔒 Khoá nhanh" trong header Admin, bấm vào phủ overlay che nội dung, yêu cầu nhập lại mã ngắn do Admin tự đặt (lưu local) để mở lại. Session Supabase phía sau vẫn nguyên — chỉ là tấm màn che tạm thời, không cần timeout tự động hay đồng bộ nhiều thiết bị.

Sau khi hoàn tất, lưu file báo cáo tổng hợp chi tiết (.md) về các thay đổi đã thực hiện vào thư mục plan/BAO_CAO/ để anh nghiệm thu.