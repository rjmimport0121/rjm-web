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

-- ------------------------------------------------------------
-- 9. LIBRO DE RECLAMACIONES VIRTUAL (igual que supabase/reclamaciones.sql)
-- ------------------------------------------------------------
-- Contador sin saltos: si un registro falla, el número no se pierde (como las
-- hojas numeradas de un libro físico).
create table if not exists public.reclamaciones_contador (
  id      int primary key default 1 check (id = 1),
  ultimo  bigint not null default 0
);
insert into public.reclamaciones_contador (id, ultimo) values (1, 0) on conflict (id) do nothing;
alter table public.reclamaciones_contador enable row level security;
revoke all on public.reclamaciones_contador from anon, authenticated;

create table if not exists public.reclamaciones (
  id                uuid primary key default gen_random_uuid(),
  numero            bigint not null unique,                -- correlativo sin saltos
  codigo            text not null unique,                 -- N.° de hoja, p. ej. 000000001-2026
  creado_en         timestamptz not null default now(),   -- fecha y hora de presentación

  -- 1. Identificación del consumidor reclamante
  nombre            text not null check (char_length(nombre) between 3 and 150),
  tipo_documento    text not null check (tipo_documento in ('DNI','CE','Pasaporte','RUC','Otro')),
  numero_documento  text not null check (char_length(numero_documento) between 4 and 20),
  domicilio         text check (char_length(domicilio) <= 250),
  telefono          text check (char_length(telefono) <= 30),
  correo            text check (correo is null or (char_length(correo) <= 120 and correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  menor_de_edad     boolean not null default false,
  apoderado         text check (char_length(apoderado) <= 150),   -- padre o madre (menores de edad)

  -- 2. Identificación del bien contratado
  bien_tipo         text not null check (bien_tipo in ('producto','servicio')),
  monto_reclamado   numeric(12,2) check (monto_reclamado is null or monto_reclamado >= 0),
  moneda            text not null default 'PEN' check (moneda in ('PEN','USD')),
  bien_descripcion  text not null check (char_length(bien_descripcion) between 3 and 500),
  pedido_referencia text check (char_length(pedido_referencia) <= 60),  -- n.° de boleta, factura o proforma (opcional)

  -- 3. Detalle de la reclamación y pedido del consumidor
  tipo              text not null check (tipo in ('reclamo','queja')),
  detalle           text not null check (char_length(detalle) between 10 and 3000),
  pedido            text not null check (char_length(pedido) between 3 and 2000),
  respuesta_por     text not null default 'correo' check (respuesta_por in ('correo','carta')),

  -- 4. Observaciones y acciones adoptadas por el proveedor
  estado            text not null default 'pendiente' check (estado in ('pendiente','en_proceso','respondido')),
  observaciones     text check (char_length(observaciones) <= 4000),
  fecha_respuesta   date,                                 -- fecha de comunicación de la respuesta

  -- Control interno
  correo_enviado    boolean not null default false,       -- se envió la copia automática al consumidor
  correo_error      text,
  ip_hash           text,                                 -- huella anónima contra abusos (no se guarda la IP)
  actualizado_en    timestamptz not null default now(),

  constraint reclamaciones_contacto  check (correo is not null or domicilio is not null),
  constraint reclamaciones_menor     check (not menor_de_edad or apoderado is not null),
  constraint reclamaciones_via_correo check (respuesta_por <> 'correo' or correo is not null),
  constraint reclamaciones_via_carta  check (respuesta_por <> 'carta' or domicilio is not null)
);

create index if not exists reclamaciones_estado_idx on public.reclamaciones (estado, creado_en desc);
create index if not exists reclamaciones_ip_idx on public.reclamaciones (ip_hash, creado_en desc);

-- Número de hoja: correlativo de 9 dígitos + año de presentación (formato del Anexo I).
create or replace function public.reclamaciones_codigo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.reclamaciones_contador set ultimo = ultimo + 1 where id = 1 returning ultimo into new.numero;
  new.creado_en := now();
  new.codigo := lpad(new.numero::text, 9, '0') || '-' || to_char(new.creado_en at time zone 'America/Lima', 'YYYY');
  return new;
end $$;
revoke execute on function public.reclamaciones_codigo() from public, anon, authenticated;

drop trigger if exists reclamaciones_codigo on public.reclamaciones;
create trigger reclamaciones_codigo before insert on public.reclamaciones
  for each row execute function public.reclamaciones_codigo();

-- Lo que escribió el consumidor y la fecha de registro no se pueden cambiar.
create or replace function public.reclamaciones_proteger()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.numero, new.codigo, new.creado_en, new.nombre, new.tipo_documento, new.numero_documento,
      new.domicilio, new.telefono, new.correo, new.menor_de_edad, new.apoderado, new.bien_tipo,
      new.monto_reclamado, new.moneda, new.bien_descripcion, new.pedido_referencia, new.tipo,
      new.detalle, new.pedido, new.respuesta_por)
     is distinct from
     (old.numero, old.codigo, old.creado_en, old.nombre, old.tipo_documento, old.numero_documento,
      old.domicilio, old.telefono, old.correo, old.menor_de_edad, old.apoderado, old.bien_tipo,
      old.monto_reclamado, old.moneda, old.bien_descripcion, old.pedido_referencia, old.tipo,
      old.detalle, old.pedido, old.respuesta_por) then
    raise exception 'Los datos registrados por el consumidor no se pueden modificar';
  end if;
  new.actualizado_en := now();
  return new;
end $$;

drop trigger if exists reclamaciones_proteger on public.reclamaciones;
create trigger reclamaciones_proteger before update on public.reclamaciones
  for each row execute function public.reclamaciones_proteger();

-- Seguridad (RLS): solo el administrador lee y responde. El registro lo hace la
-- Edge Function con service_role. No hay política de borrado: se conservan.
alter table public.reclamaciones enable row level security;

drop policy if exists reclamaciones_admin_leer on public.reclamaciones;
create policy reclamaciones_admin_leer on public.reclamaciones
  for select to authenticated using (public.es_admin());

drop policy if exists reclamaciones_admin_responder on public.reclamaciones;
create policy reclamaciones_admin_responder on public.reclamaciones
  for update to authenticated using (public.es_admin()) with check (public.es_admin());

revoke all on public.reclamaciones from anon, authenticated;
grant select on public.reclamaciones to authenticated;
grant update (estado, observaciones, fecha_respuesta, correo_enviado, correo_error) on public.reclamaciones to authenticated;

-- Ajuste de seguridad sugerido por Supabase (Security Advisor): fija el search_path.
alter function public.tocar_actualizado_en() set search_path = public;
