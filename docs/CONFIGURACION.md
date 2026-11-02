# Configuración del panel admin y del portal mayorista

La web sigue siendo estática (HTML + JS). Los usuarios, contraseñas, productos y fotos viven en **Supabase** (plan gratuito):

| Pieza | Qué hace |
|---|---|
| `admin.html` + `js/admin.js` | Login del administrador. Permite crear y editar productos con foto, descripción, características y precio, la lista mayorista con precios por cantidad y los accesos de los mayoristas. |
| `index.html` + `js/catalogo.js` | Muestra los productos publicados con su precio y el botón **Consultar por WhatsApp**. Si Supabase no está configurado, la web se ve igual que antes. |
| `mayoristas.html` + `js/mayoristas.js` | Portal con usuario y contraseña. Lista sin fotos, solo productos activos con stock, precio según cantidad y pedido por WhatsApp. |
| `supabase/schema.sql` | Tablas, reglas de seguridad por fila (RLS) y bucket de fotos. |
| `supabase/functions/gestionar-mayoristas` | Función de servidor que crea usuarios, cambia contraseñas y activa o desactiva accesos. Usa la clave secreta, que nunca llega al navegador. |

## Pasos (una sola vez, unos 20 minutos)

### 1. Crear el proyecto en Supabase
1. Entra a <https://supabase.com>, inicia sesión con GitHub y elige **New project**.
2. Nombre: `rjm`. Región: la más cercana a Perú que esté disponible (por ejemplo *South America (São Paulo)*). Guarda la contraseña de la base de datos en un lugar seguro.

### 2. Crear las tablas
1. En el menú, abre **SQL Editor**, elige **New query**, pega todo el contenido de `supabase/schema.sql` y pulsa **Run**.
2. Deberías ver el mensaje *Success*. Puedes volver a ejecutarlo sin perder datos.

### 3. Cerrar el registro público (importante)
**Authentication → Sign In / Providers → Email**: desactiva **Allow new users to sign up**.
Así nadie puede crearse una cuenta por su cuenta. Solo tú creas los accesos. Aunque alguien lo lograra, su perfil nace *inactivo* y no ve nada.

### 4. Crear tu usuario de administrador
1. **Authentication → Users → Add user → Create new user**. Pon tu correo y una contraseña fuerte, y marca **Auto Confirm User**.
2. En el **SQL Editor**, ejecuta esto con tu correo:
   ```sql
   update public.perfiles set rol = 'admin', activo = true, usuario = 'rafa'
   where id = (select id from auth.users where email = 'TU-CORREO@ejemplo.com');
   ```

### 5. Publicar la función que crea a los mayoristas
1. **Edge Functions → Deploy a new function → Via Editor**.
2. Nombre: `gestionar-mayoristas` (exacto).
3. Borra el código de ejemplo, pega el contenido de `supabase/functions/gestionar-mayoristas/index.ts` y pulsa **Deploy**.
   Deja activada la opción *Verify JWT*, que viene así por defecto.
   (Alternativa por terminal: `supabase functions deploy gestionar-mayoristas`.)

### 6. Conectar la web
1. **Project Settings → API**: copia el **Project URL** y la clave **anon public**.
2. Pégalos en `js/config.js`:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJ...',
   ```
   La clave `anon` es pública por diseño, porque la protección la dan las reglas RLS. **Nunca** pongas la clave `service_role` en la web.
3. Sube el cambio a GitHub. Cloudflare (proyecto `rjm-web`) lo publicará.

## Uso diario
- **Administración:** `https://www.rjmimport.com/admin.html` (también hay un enlace discreto en el pie de página).
- **Mayoristas:** `https://www.rjmimport.com/mayoristas.html` (enlace "Mayoristas" en el menú).
- Para crear un mayorista, ve a *Usuarios mayoristas*, escribe el usuario (por ejemplo `musicalcentro`) y una contraseña (o pulsa *Generar contraseña*), y luego *Crear acceso*. El panel te muestra los datos para enviárselos al cliente.
- Si un cliente deja de serlo, pulsa **Desactivar**. No se borra nada y puedes reactivarlo.
- Los productos no se borran: se **ocultan**. La lista mayorista tiene el campo **Activo**. Con stock 0, el producto deja de aparecer para los mayoristas.

## Seguridad: qué está protegido y cómo
- Las contraseñas las guarda Supabase Auth (cifradas con bcrypt). Nunca están en el código ni en GitHub.
- Un visitante anónimo solo puede leer los productos publicados. La base de datos le niega la lista mayorista y los perfiles (esto se probó con PostgreSQL 16).
- Un mayorista activo puede leer la lista mayorista (solo activos con stock y sus precios) y su propio perfil. No puede modificar nada ni cambiar su rol.
- Solo el admin puede escribir productos, precios y fotos.
- Las páginas `admin.html` y `mayoristas.html` tienen `noindex` para que Google no las indexe.

## Límites y costos a vigilar
- El plan gratuito de Supabase alcanza de sobra para un catálogo y decenas de mayoristas. Los límites exactos están en <https://supabase.com/pricing>.
- **Pausa por inactividad:** Supabase pausa los proyectos gratuitos que pasan cierto tiempo sin actividad (según su documentación, alrededor de una semana). Si la web tiene visitas, normalmente se mantiene activa. Si se pausa, se reactiva desde el panel de Supabase. Si el portal se vuelve crítico, conviene evaluar el plan Pro.
- **Copias de seguridad:** el plan gratuito no incluye respaldos descargables automáticos. Sugerencia: exportar las tablas en CSV cada mes desde *Table Editor*, o automatizarlo en una etapa posterior.

## Próximas etapas sugeridas
Estas tablas son el comienzo de la base central del ERP. Más adelante, `productos` y `productos_mayoristas` pueden unificarse con el módulo de inventario (SKU único, stock por almacén, movimientos), para que el stock se descuente solo con cada venta.
