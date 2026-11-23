-- ============================================================================
-- KHO FEEDBACK - GIAI ĐOẠN 2: SUPABASE AUTH & SIẾT CHẶT RLS (ĐÓNG CỬA SỔ A2)
--
-- Điều kiện tiên quyết:
--   1. Đã tạo tài khoản Admin thật trong Supabase Authentication (lichchoilienquan@gmail.com).
--   2. Đã tắt "Allow new users to sign up" trong Authentication -> Sign In / Providers.
--
-- Tác dụng:
--   - Giữ SELECT công khai cho khách xem trang chủ (categories, feedbacks, storage bucket).
--   - Xóa toàn bộ policy ghi/sửa/xóa công khai hoặc tạm thời từ Giai đoạn 0 & 1.
--   - Chỉ cho phép INSERT / UPDATE / DELETE khi role = authenticated VÀ email JWT
--     khớp đúng tài khoản Admin duy nhất: 'lichchoilienquan@gmail.com'.
-- ============================================================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- 1. Dọn sạch toàn bộ policy ghi (INSERT / UPDATE / DELETE) cũ trên categories & feedbacks
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('categories', 'feedbacks')
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- 2. Bảo đảm SELECT vẫn mở công khai cho cả anon & authenticated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'Public Read Categories'
  ) THEN
    CREATE POLICY "Public Read Categories" ON public.categories
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedbacks' AND policyname = 'Public Read Feedbacks'
  ) THEN
    CREATE POLICY "Public Read Feedbacks" ON public.feedbacks
      FOR SELECT USING (true);
  END IF;
END $$;

-- 3. Tạo policy ghi/sửa/xóa chặt chẽ cho bảng public.categories (Admin duy nhất)
CREATE POLICY "Admin Insert Categories" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com');

CREATE POLICY "Admin Update Categories" ON public.categories
  FOR UPDATE TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com');

CREATE POLICY "Admin Delete Categories" ON public.categories
  FOR DELETE TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com');

-- 4. Tạo policy ghi/sửa/xóa chặt chẽ cho bảng public.feedbacks (Admin duy nhất)
CREATE POLICY "Admin Insert Feedbacks" ON public.feedbacks
  FOR INSERT TO authenticated
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com');

CREATE POLICY "Admin Update Feedbacks" ON public.feedbacks
  FOR UPDATE TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com');

CREATE POLICY "Admin Delete Feedbacks" ON public.feedbacks
  FOR DELETE TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com');

-- 5. Siết lại Storage bucket 'feedback-images' (chỉ Admin được tải lên / cập nhật / xóa)
DROP POLICY IF EXISTS "Public Storage Insert" ON storage.objects;
DROP POLICY IF EXISTS "Temp Public Storage Update" ON storage.objects;
DROP POLICY IF EXISTS "Temp Public Storage Delete" ON storage.objects;
DROP POLICY IF EXISTS "Admin Storage Insert" ON storage.objects;
DROP POLICY IF EXISTS "Admin Storage Update" ON storage.objects;
DROP POLICY IF EXISTS "Admin Storage Delete" ON storage.objects;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Storage Select'
  ) THEN
    CREATE POLICY "Public Storage Select" ON storage.objects
      FOR SELECT USING (bucket_id = 'feedback-images');
  END IF;
END $$;

CREATE POLICY "Admin Storage Insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-images'
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com'
  );

CREATE POLICY "Admin Storage Update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'feedback-images'
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com'
  )
  WITH CHECK (
    bucket_id = 'feedback-images'
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com'
  );

CREATE POLICY "Admin Storage Delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'feedback-images'
    AND lower(coalesce(auth.jwt() ->> 'email', '')) = 'lichchoilienquan@gmail.com'
  );

