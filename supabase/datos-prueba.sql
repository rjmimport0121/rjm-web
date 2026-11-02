-- ============================================================
-- RJM — DATOS DE PRUEBA (productos de ejemplo + usuario mayorista de prueba)
--
-- Requisito: haber ejecutado antes supabase/schema.sql.
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede ejecutar varias veces: no duplica nada (usa el SKU "DEMO-...").
--
-- • Todos los precios son DE PRUEBA y con IGV incluido. Edítalos en admin.html.
-- • Productos sin foto. Puedes agregar la foto después desde el panel.
-- • Los productos del CATÁLOGO WEB quedan OCULTOS (publicado = false) para que
--   ningún cliente vea precios de prueba. Para mostrarlos, usa "Publicar" en el
--   panel, o el bloque opcional del final.
-- • La LISTA MAYORISTA queda activa: sólo la ven usuarios mayoristas con sesión.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CATÁLOGO WEB (12 productos, ocultos)
-- ------------------------------------------------------------
insert into public.productos
  (sku, nombre, grupo, categoria, descripcion, caracteristicas, precio, moneda, precio_incluye_igv, publicado, destacado, orden)
values
  ('DEMO-W01','Cuerdas para guitarra acústica 012-053','Accesorios para Guitarra','Cuerdas para Guitarra','Juego de 6 cuerdas de bronce fosforado para guitarra acústica.',array['Calibre 012-053','Bronce fosforado','Juego de 6 cuerdas'],25.00,'PEN',true,false,true,1),
  ('DEMO-W02','Cuerdas para guitarra clásica tensión normal','Accesorios para Guitarra','Cuerdas para Guitarra','Juego de nylon para guitarra clásica.',array['Tensión normal','Nylon','Juego de 6 cuerdas'],18.00,'PEN',true,false,false,2),
  ('DEMO-W03','Clavijero 3+3 cromado','Accesorios para Guitarra','Clavijeros','Juego de 6 clavijas para guitarra acústica.',array['Configuración 3+3','Acabado cromado'],45.00,'PEN',true,false,false,3),
  ('DEMO-W04','Afinador digital clip-on cromático','Accesorios para Guitarra','Afinadores Digitales','Afinador de pinza con pantalla a color.',array['Modo cromático','Guitarra, bajo, violín y ukulele','Incluye batería'],30.00,'PEN',true,false,false,4),
  ('DEMO-W05','Correa de nylon ajustable','Accesorios para Guitarra','Correas para Guitarra','Correa de nylon con extremos de cuero sintético.',array['Ancho 5 cm','Largo ajustable'],22.00,'PEN',true,false,false,5),
  ('DEMO-W06','Cable para instrumento 3 m','Accesorios para Guitarra','Cables de Audio','Cable con jack 6.3 mm mono en ambos extremos.',array['Largo 3 m','Jack 6.3 mm TS'],28.00,'PEN',true,false,false,6),
  ('DEMO-W07','Capo de palanca para acústica y eléctrica','Accesorios para Guitarra','Capos / Cejillas','Cejilla de palanca de aleación de aluminio.',array['Cambio rápido con una mano','Almohadilla de silicona'],20.00,'PEN',true,false,false,7),
  ('DEMO-W08','Preamplificador con EQ de 4 bandas y afinador','Componentes Electrónicos','Preamplificadores','Preamplificador para guitarra acústica con afinador incorporado.',array['EQ de 4 bandas','Afinador con pantalla','Funciona con batería 9 V'],95.00,'PEN',true,false,true,8),
  ('DEMO-W09','Pastilla piezoeléctrica de contacto','Componentes Electrónicos','Pastillas Piezoeléctricas','Pastilla de contacto para guitarra, charango o ukulele.',array['Adhesivo removible','Salida jack 6.3 mm'],35.00,'PEN',true,false,false,9),
  ('DEMO-W10','Potenciómetro 500K logarítmico','Componentes Electrónicos','Potenciómetros','Potenciómetro para volumen o tono de guitarra eléctrica.',array['500K','Curva logarítmica (A)','Eje estriado'],12.00,'PEN',true,false,false,10),
  ('DEMO-W11','Trastes de alpaca 2 mm (tira de 60 cm)','Materiales de Luthiería','Trastes','Tira de traste de alpaca para mástiles de guitarra.',array['Ancho de corona 2 mm','Tira de 60 cm'],15.00,'PEN',true,false,false,11),
  ('DEMO-W12','Cejuela de hueso en blanco','Materiales de Luthiería','Cejuelas & Huesos','Bloque de hueso para tallar cejuela o selleta.',array['Medida 52 x 6 x 9 mm','Para tallar'],10.00,'PEN',true,false,false,12)
on conflict (sku) do nothing;

-- ------------------------------------------------------------
-- 2. LISTA MAYORISTA (12 productos activos, con precios por cantidad)
-- ------------------------------------------------------------
insert into public.productos_mayoristas
  (sku, nombre, grupo, categoria, unidad, stock, mostrar_stock, moneda, precio_incluye_igv, activo, orden)
values
  ('DEMO-M01','Cuerdas para guitarra acústica 012-053','Accesorios para Guitarra','Cuerdas para Guitarra','jgo',300,true,'PEN',true,true,1),
  ('DEMO-M02','Cuerdas para guitarra clásica tensión normal','Accesorios para Guitarra','Cuerdas para Guitarra','jgo',250,true,'PEN',true,true,2),
  ('DEMO-M03','Clavijero 3+3 cromado','Accesorios para Guitarra','Clavijeros','jgo',80,true,'PEN',true,true,3),
  ('DEMO-M04','Afinador digital clip-on cromático','Accesorios para Guitarra','Afinadores Digitales','und',120,true,'PEN',true,true,4),
  ('DEMO-M05','Correa de nylon ajustable','Accesorios para Guitarra','Correas para Guitarra','und',60,false,'PEN',true,true,5),
  ('DEMO-M06','Cable para instrumento 3 m','Accesorios para Guitarra','Cables de Audio','und',90,true,'PEN',true,true,6),
  ('DEMO-M07','Capo de palanca para acústica y eléctrica','Accesorios para Guitarra','Capos / Cejillas','und',100,true,'PEN',true,true,7),
  ('DEMO-M08','Preamplificador con EQ de 4 bandas y afinador','Componentes Electrónicos','Preamplificadores','und',40,true,'PEN',true,true,8),
  ('DEMO-M09','Pastilla piezoeléctrica de contacto','Componentes Electrónicos','Pastillas Piezoeléctricas','und',150,true,'PEN',true,true,9),
  ('DEMO-M10','Potenciómetro 500K logarítmico','Componentes Electrónicos','Potenciómetros','und',400,false,'PEN',true,true,10),
  ('DEMO-M11','Trastes de alpaca 2 mm (tira de 60 cm)','Materiales de Luthiería','Trastes','tira',200,true,'PEN',true,true,11),
  ('DEMO-M12','Cejuela de hueso en blanco','Materiales de Luthiería','Cejuelas & Huesos','und',500,true,'PEN',true,true,12)
on conflict (sku) do nothing;

-- Precios por cantidad (desde 1, desde 12 y desde 50 unidades). Precios de prueba con IGV incluido.
insert into public.precios_mayoristas (producto_id, cantidad_minima, precio)
select pm.id, t.cant, t.precio
from (values
  ('DEMO-M01',1,20.00),('DEMO-M01',12,18.00),('DEMO-M01',50,16.00),
  ('DEMO-M02',1,14.00),('DEMO-M02',12,12.50),('DEMO-M02',50,11.00),
  ('DEMO-M03',1,36.00),('DEMO-M03',12,32.00),('DEMO-M03',50,29.00),
  ('DEMO-M04',1,22.00),('DEMO-M04',12,19.00),('DEMO-M04',50,17.00),
  ('DEMO-M05',1,16.00),('DEMO-M05',12,14.00),('DEMO-M05',50,12.00),
  ('DEMO-M06',1,21.00),('DEMO-M06',12,18.50),('DEMO-M06',50,16.50),
  ('DEMO-M07',1,14.00),('DEMO-M07',12,12.00),('DEMO-M07',50,10.50),
  ('DEMO-M08',1,78.00),('DEMO-M08',12,70.00),('DEMO-M08',50,64.00),
  ('DEMO-M09',1,26.00),('DEMO-M09',12,23.00),('DEMO-M09',50,20.00),
  ('DEMO-M10',1,8.50),('DEMO-M10',12,7.50),('DEMO-M10',50,6.50),
  ('DEMO-M11',1,11.00),('DEMO-M11',12,9.50),('DEMO-M11',50,8.50),
  ('DEMO-M12',1,7.00),('DEMO-M12',12,6.00),('DEMO-M12',50,5.00)
) as t(sku, cant, precio)
join public.productos_mayoristas pm on pm.sku = t.sku
on conflict (producto_id, cantidad_minima) do nothing;

-- ------------------------------------------------------------
-- 3. USUARIO MAYORISTA DE PRUEBA
--    Antes de este paso, crea el usuario en:
--    Authentication → Users → Add user → Create new user
--      Email:    prueba@mayoristas.rjmimport.com
--      Password: (la que te dio Claude en el chat)
--      Marca "Auto Confirm User".
--    Este bloque lo activa como mayorista. Si el usuario aún no existe, no hace nada.
-- ------------------------------------------------------------
update public.perfiles
set usuario = 'prueba', nombre = 'Cliente de Prueba SAC', ruc = '20000000001',
    telefono = '999000111', rol = 'mayorista', activo = true
where id = (select id from auth.users where email = 'prueba@mayoristas.rjmimport.com');

-- Verificación: debería mostrar 12 | 12 | 36 | 1
select
  (select count(*) from public.productos            where sku like 'DEMO-%') as catalogo_web,
  (select count(*) from public.productos_mayoristas where sku like 'DEMO-%') as lista_mayorista,
  (select count(*) from public.precios_mayoristas pr join public.productos_mayoristas pm on pm.id = pr.producto_id where pm.sku like 'DEMO-%') as tramos,
  (select count(*) from public.perfiles where usuario = 'prueba' and activo) as usuario_prueba_activo;

-- ============================================================
-- OPCIONAL A — Publicar en la web los 12 productos de prueba:
--   update public.productos set publicado = true where sku like 'DEMO-%';
--
-- OPCIONAL B — Borrar TODOS los datos de prueba cuando ya no los necesites:
--   delete from public.productos            where sku like 'DEMO-%';
--   delete from public.productos_mayoristas where sku like 'DEMO-%';  -- borra también sus tramos
--   update public.perfiles set activo = false where usuario = 'prueba';
-- ============================================================
