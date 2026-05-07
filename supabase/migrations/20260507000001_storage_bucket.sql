-- Create the damage-photos storage bucket.
-- Public read allows dashboard <img> tags to load without signed URLs.
-- Server-mediated upload uses the service key, so no anon-write RLS needed.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'damage-photos',
  'damage-photos',
  true,
  524288,  -- 512 KB hard cap (compressed WebP target is ≤200 KB)
  ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public (anon) reads on all objects in this bucket.
CREATE POLICY "Public read damage photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'damage-photos');
