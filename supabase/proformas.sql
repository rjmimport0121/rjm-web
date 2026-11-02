-- ============================================================
-- RJM — Almacenamiento de proformas en PDF (portal mayorista)
--
-- Permite que el botón "Enviar a RJM por WhatsApp" adjunte un ENLACE al PDF
-- de la proforma. Mientras no se ejecute este script, el botón igual funciona,
-- pero envía la proforma solo como texto.
--
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede ejecutar varias veces sin problema.
-- ============================================================

-- Bucket PRIVADO: los PDF no son públicos; solo se abren con el enlace firmado
-- (válido 90 días) que el portal genera y envía a RJM por WhatsApp.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proformas', 'proformas', false, 2097152, array['application/pdf'])
on conflict (id) do nothing;

-- Cada cliente mayorista activo puede subir PDF solo dentro de su propia carpeta (su id).
drop policy if exists proformas_subir on storage.objects;
create policy proformas_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proformas'
              and (storage.foldername(name))[1] = auth.uid()::text
              and public.es_mayorista_activo());

-- Cada cliente lee solo sus PDF (necesario para crear el enlace); el admin ve todos.
drop policy if exists proformas_leer on storage.objects;
create policy proformas_leer on storage.objects
  for select to authenticated
  using (bucket_id = 'proformas'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()));

-- Verificación: debe mostrar 1 bucket y 2 reglas
select (select count(*) from storage.buckets where id = 'proformas') as bucket_proformas,
       (select count(*) from pg_policies where tablename = 'objects' and policyname like 'proformas_%') as reglas;
