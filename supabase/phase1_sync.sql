-- ============================================================================
-- KHO FEEDBACK - GIAI ĐOẠN 1: ĐỒNG BỘ DATABASE & STORAGE (CHẠY IDEMPOTENT)
--
-- HƯỚNG DẪN CHẠY AN TOÀN TRÊN SUPABASE SQL EDITOR (MỤC 11.3 & 9.1):
--   Bước 1: Backup project trên Supabase Dashboard (Database -> Backups) trước khi chạy.
--   Bước 2 (Dry-run): Bọc toàn bộ nội dung file này giữa `BEGIN;` và `ROLLBACK;`
--           để chạy thử trong SQL Editor. ROLLBACK sẽ hủy mọi thay đổi nhưng vẫn
--           báo lỗi thật (vd: UNIQUE(path) bị vướng trùng) nếu có.
--   Bước 3 (Áp dụng thật): Khi dry-run sạch lỗi, đổi `ROLLBACK;` thành `COMMIT;`
--           (hoặc chạy thẳng nội dung bên dưới).
--
-- Lưu ý: Giai đoạn 1 vẫn giữ policy public tạm thời cho tới khi bật Supabase Auth
-- ở Giai đoạn 2 (để tránh tự khóa Admin trước khi tạo tài khoản Auth).
-- ============================================================================

-- 1. Tạo bảng categories để đồng bộ Danh mục động giữa Admin & Trang chủ
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  accent TEXT NOT NULL DEFAULT '#b9f34b',
  glow TEXT,
  dim TEXT,
  image TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'Public Read Categories'
  ) THEN
    CREATE POLICY "Public Read Categories" ON public.categories FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'Temp Public Insert Categories'
  ) THEN
    CREATE POLICY "Temp Public Insert Categories" ON public.categories FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'Temp Public Update Categories'
  ) THEN
    CREATE POLICY "Temp Public Update Categories" ON public.categories FOR UPDATE USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'categories' AND policyname = 'Temp Public Delete Categories'
  ) THEN
    CREATE POLICY "Temp Public Delete Categories" ON public.categories FOR DELETE USING (true);
  END IF;
END $$;

-- 2. Mở rộng bảng feedbacks: thêm cột note + UNIQUE constraint cho path để Seed upsert không trùng
ALTER TABLE public.feedbacks ADD COLUMN IF NOT EXISTS note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.feedbacks'::regclass
      AND contype = 'u'
      AND conname = 'feedbacks_path_unique'
  ) THEN
    ALTER TABLE public.feedbacks ADD CONSTRAINT feedbacks_path_unique UNIQUE (path);
  END IF;
END $$;

-- 3. Bổ sung policy UPDATE cho feedbacks (trước đây bị thiếu nên Edit không lưu được)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feedbacks' AND policyname = 'Temp Public Update Feedbacks'
  ) THEN
    CREATE POLICY "Temp Public Update Feedbacks" ON public.feedbacks FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Bổ sung policy DELETE & UPDATE cho Storage bucket 'feedback-images'
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-images', 'feedback-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Temp Public Storage Update'
  ) THEN
    CREATE POLICY "Temp Public Storage Update" ON storage.objects
      FOR UPDATE USING (bucket_id = 'feedback-images') WITH CHECK (bucket_id = 'feedback-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Temp Public Storage Delete'
  ) THEN
    CREATE POLICY "Temp Public Storage Delete" ON storage.objects
      FOR DELETE USING (bucket_id = 'feedback-images');
  END IF;
END $$;

