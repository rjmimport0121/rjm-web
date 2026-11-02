-- ============================================================
-- RJM IMPORT EXPORT E.I.R.L. — Esquema web (Supabase / PostgreSQL)
-- Panel de administración, catálogo público y portal mayorista.
--
-- Cómo usarlo: Supabase → SQL Editor → pegar todo → Run.
-- Es idempotente: se puede volver a ejecutar sin perder datos.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PERFILES (rol de cada usuario de Supabase Auth)
-- ------------------------------------------------------------
create table if not exists public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  usuario     text unique,                       -- nombre de usuario visible (mayoristas)
  nombre      text,                              -- razón social o nombre del cliente
  ruc         text,                              -- opcional
  telefono    text,
  rol         text not null default 'mayorista' check (rol in ('admin','mayorista')),
  activo      boolean not null default true,     -- desactivar en lugar de borrar
  creado_en   timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Cada usuario nuevo de Auth recibe un perfil "mayorista" INACTIVO.
-- Así, aunque alguien lograra registrarse por su cuenta, no ve nada hasta que
-- el admin lo active. La Edge Function activa a los mayoristas que crea el admin.
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, usuario, nombre, rol, activo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'usuario', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'nombre',
    'mayorista',
    false
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- Funciones de ayuda para las reglas de seguridad (RLS)
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles
                 where id = auth.uid() and rol = 'admin' and activo);
$$;

create or replace function public.es_mayorista_activo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles
                 where id = auth.uid() and rol in ('mayorista','admin') and activo);
$$;

-- ------------------------------------------------------------
-- 2. CATÁLOGO PÚBLICO (con foto, descripción, características, precio)
-- ------------------------------------------------------------
create table if not exists public.productos (
  id              uuid primary key default gen_random_uuid(),
  sku             text unique,
  nombre          text not null,
  categoria       text not null default 'Accesorios', -- subgrupo (p. ej. Preamplificadores)
  marca           text,
  descripcion     text,
  caracteristicas text[] not null default '{}',   -- una característica por línea
  precio          numeric(12,2) check (precio is null or precio >= 0),
  moneda          text not null default 'PEN' check (moneda in ('PEN','USD')),
  precio_incluye_igv boolean not null default true,
  foto_url        text,
  foto_path       text,                            -- ruta en Storage (para reemplazarla)
  destacado       boolean not null default false,
  publicado       boolean not null default true,   -- ocultar en lugar de borrar
  orden           integer not null default 0,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. LISTA MAYORISTA (sin fotos) + PRECIOS POR CANTIDAD
-- ------------------------------------------------------------
create table if not exists public.productos_mayoristas (
  id              uuid primary key default gen_random_uuid(),
  sku             text unique,
  nombre          text not null,
  categoria       text,
  unidad          text not null default 'und',
  stock           integer not null default 0 check (stock >= 0),
  mostrar_stock   boolean not null default true,   -- mostrar cantidad exacta o sólo "Disponible"
  moneda          text not null default 'PEN' check (moneda in ('PEN','USD')),
  precio_incluye_igv boolean not null default true,
  notas           text,
  activo          boolean not null default true,
  orden           integer not null default 0,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create table if not exists public.precios_mayoristas (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references public.productos_mayoristas(id) on delete cascade,
  cantidad_minima integer not null check (cantidad_minima >= 1),
  precio          numeric(12,2) not null check (precio >= 0),
  creado_en       timestamptz not null default now(),
  unique (producto_id, cantidad_minima)
);
create index if not exists precios_mayoristas_producto_idx on public.precios_mayoristas(producto_id);

-- Grupo del catálogo (Accesorios para Guitarra, Componentes Electrónicos, ...)
alter table public.productos            add column if not exists grupo text;
alter table public.productos_mayoristas add column if not exists grupo text;

-- ------------------------------------------------------------
-- 4. FECHA DE ACTUALIZACIÓN AUTOMÁTICA
-- ------------------------------------------------------------
create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql as $$
begin new.actualizado_en := now(); return new; end $$;

drop trigger if exists t_productos_upd on public.productos;
create trigger t_productos_upd before update on public.productos
  for each row execute function public.tocar_actualizado_en();
drop trigger if exists t_prod_may_upd on public.productos_mayoristas;
create trigger t_prod_may_upd before update on public.productos_mayoristas
  for each row execute function public.tocar_actualizado_en();
drop trigger if exists t_perfiles_upd on public.perfiles;
create trigger t_perfiles_upd before update on public.perfiles
  for each row execute function public.tocar_actualizado_en();

-- ------------------------------------------------------------
-- 5. SEGURIDAD A NIVEL DE FILA (RLS)
--    La clave "anon" es pública; estas reglas son las que protegen los datos.
-- ------------------------------------------------------------
alter table public.perfiles             enable row level security;
alter table public.productos            enable row level security;
alter table public.productos_mayoristas enable row level security;
alter table public.precios_mayoristas   enable row level security;

-- perfiles: cada uno ve el suyo; sólo el admin ve y edita todos.
drop policy if exists perfiles_ver_propio on public.perfiles;
create policy perfiles_ver_propio on public.perfiles
  for select using (id = auth.uid() or public.es_admin());
drop policy if exists perfiles_admin_editar on public.perfiles;
create policy perfiles_admin_editar on public.perfiles
  for update using (public.es_admin()) with check (public.es_admin());
-- (No hay política de insert/delete: se hace con la Edge Function o el panel de Supabase.)

-- productos: el público ve sólo los publicados; el admin hace todo.
drop policy if exists productos_publico on public.productos;
create policy productos_publico on public.productos
  for select using (publicado or public.es_admin());
drop policy if exists productos_admin on public.productos;
create policy productos_admin on public.productos
  for all using (public.es_admin()) with check (public.es_admin());

-- lista mayorista: sólo mayoristas activos (y admin) la leen; sólo admin escribe.
drop policy if exists prod_may_leer on public.productos_mayoristas;
create policy prod_may_leer on public.productos_mayoristas
  for select using (public.es_admin() or (public.es_mayorista_activo() and activo and stock > 0));
drop policy if exists prod_may_admin on public.productos_mayoristas;
create policy prod_may_admin on public.productos_mayoristas
  for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists precios_may_leer on public.precios_mayoristas;
create policy precios_may_leer on public.precios_mayoristas
  for select using (public.es_admin() or (public.es_mayorista_activo() and exists (
    select 1 from public.productos_mayoristas pm
    where pm.id = producto_id and pm.activo and pm.stock > 0)));
drop policy if exists precios_may_admin on public.precios_mayoristas;
create policy precios_may_admin on public.precios_mayoristas
  for all using (public.es_admin()) with check (public.es_admin());

-- Los visitantes anónimos nunca ven la lista mayorista ni los perfiles.
revoke all on public.productos_mayoristas from anon;
revoke all on public.precios_mayoristas   from anon;
revoke all on public.perfiles             from anon;
grant select on public.productos to anon;

-- ------------------------------------------------------------
-- 6. STORAGE: fotos de productos (lectura pública, escritura sólo admin)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists fotos_admin_subir on storage.objects;
create policy fotos_admin_subir on storage.objects
  for insert to authenticated with check (bucket_id = 'productos' and public.es_admin());
drop policy if exists fotos_admin_editar on storage.objects;
create policy fotos_admin_editar on storage.objects
  for update to authenticated using (bucket_id = 'productos' and public.es_admin());
drop policy if exists fotos_admin_borrar on storage.objects;
create policy fotos_admin_borrar on storage.objects
  for delete to authenticated using (bucket_id = 'productos' and public.es_admin());

-- ============================================================
-- 7. NOMBRAR AL ADMINISTRADOR (ejecutar UNA vez, después de crear tu usuario
--    en Authentication → Users → Add user). Cambia el correo:
--
--   update public.perfiles set rol = 'admin', activo = true, usuario = 'rafa'
--   where id = (select id from auth.users where email = 'TU-CORREO@ejemplo.com');
-- ============================================================

-- ------------------------------------------------------------
-- 8. PROFORMAS EN PDF (enlace que el portal envía por WhatsApp)
--    Mismo contenido que supabase/proformas.sql.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proformas', 'proformas', false, 2097152, array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists proformas_subir on storage.objects;
create policy proformas_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proformas' and (storage.foldername(name))[1] = auth.uid()::text and public.es_mayorista_activo());
drop policy if exists proformas_leer on storage.objects;
create policy proformas_leer on storage.objects
  for select to authenticated
  using (bucket_id = 'proformas' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()));
