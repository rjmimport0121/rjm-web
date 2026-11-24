-- ============================================================
-- Galería de producto: hasta 4 fotos y un enlace de video.
-- La foto principal sigue en foto_url / foto_path (la usan la tienda, el
-- carrito, la app y las páginas para Google). Las otras 3 van en fotos_extra
-- como [{ "url": "...", "path": "catalogo/..." }].
-- El video es solo un enlace (YouTube, TikTok o Facebook): no ocupa espacio.
-- Las columnas heredan las reglas RLS de la tabla (público: solo publicados).
-- ============================================================
alter table public.productos add column if not exists fotos_extra jsonb not null default '[]'::jsonb;
alter table public.productos add column if not exists video_url text;

alter table public.productos drop constraint if exists productos_fotos_extra_ok;
alter table public.productos add constraint productos_fotos_extra_ok
  check (jsonb_typeof(fotos_extra) = 'array' and jsonb_array_length(fotos_extra) <= 3);

alter table public.productos drop constraint if exists productos_video_url_ok;
alter table public.productos add constraint productos_video_url_ok
  check (video_url is null or (video_url ~ '^https://' and length(video_url) <= 300));
