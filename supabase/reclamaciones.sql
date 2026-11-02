-- ============================================================
-- LIBRO DE RECLAMACIONES VIRTUAL — RJM IMPORT-EXPORT E.I.R.L.
--
-- Base legal (Perú):
--   - Ley 29571, Código de Protección y Defensa del Consumidor (arts. 150-152).
--   - Reglamento del Libro de Reclamaciones, D.S. 011-2011-PCM, modificado por
--     D.S. 006-2014-PCM (libro virtual, art. 4-B) y D.S. 101-2022-PCM
--     (respuesta en máximo 15 días hábiles y formato del Anexo I).
--   - Art. 12: las hojas se conservan al menos 2 años desde su registro.
--
-- Cómo funciona:
--   - El consumidor llena la hoja en libro-reclamaciones.html.
--   - La Edge Function "libro-reclamaciones" la registra con la clave
--     service_role (solo existe en el servidor) y envía la copia automática
--     al correo del consumidor (art. 4-B).
--   - Desde el navegador, solo el administrador puede leer las hojas y
--     escribir la respuesta (sección 4). Nadie puede cambiar lo que escribió
--     el consumidor ni borrar hojas.
--
-- Cómo usarlo: Supabase → SQL Editor → pegar todo → Run. Es idempotente.
-- ============================================================

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
