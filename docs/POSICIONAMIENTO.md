# Cómo aparecer en Google (pasos gratuitos)

Esta guía es para Rafa. La parte técnica de la web ya está hecha. Lo que queda
necesita tu cuenta de Google, porque Google solo se lo permite al dueño del
negocio.

## Lo que ya tiene la web

- **Una página propia por producto:** `rjmimport.com/producto/<nombre>/<código>`.
  - Lleva título, precio, foto y descripción en el formato que entiende Google
    (schema.org/Product).
  - Lleva la vista previa con foto para WhatsApp y Facebook.
  - La genera `worker.js` al momento, con lo que publicas desde el panel o la
    app, así que no tienes que hacer nada extra.
- **`sitemap.xml`:** la lista de todas las páginas para Google, siempre al día.
- **`robots.txt`:** indica a los buscadores que no entren al panel, al portal
  de mayoristas ni a la app.
- **Enlaces que se comparten bien:** los botones de la tienda y los mensajes de
  WhatsApp llevan el enlace a la página del producto, que muestra foto y precio.
- **Datos de la empresa para Google:** razón social, RUC, dirección, teléfono y
  horario.

> **Importante:** las fichas de Google y los anuncios en Google Shopping no
> salen solos. Primero hay que hacer los pasos 1 y 2.

---

## Paso 1 — Google Search Console (15 minutos)

Search Console te dice si Google ya encontró tu web, por qué palabras te
buscan y si hay algún error.

1. Entra a <https://search.google.com/search-console> con tu cuenta de Gmail
   del negocio.
2. Elige **Dominio** (no "Prefijo de URL") y escribe `rjmimport.com`.
3. Google te pide crear un registro DNS de tipo **TXT**.
   - Si aparece un botón para hacerlo automáticamente con **Cloudflare**,
     úsalo.
   - Si no aparece, copia el texto que empieza con `google-site-verification=`.
     En Cloudflare entra a `rjmimport.com` → **DNS** → **Records** → **Add
     record** y llena: Type `TXT`, Name `@`, Content el texto copiado. Guarda.
4. Vuelve a Search Console y pulsa **Verificar**. A veces tarda unos minutos;
   si falla, espera media hora y repite.
5. En el menú, entra a **Sitemaps**, escribe `sitemap.xml` y pulsa **Enviar**.
6. Opcional, para que Google lo vea antes: en **Inspección de URLs**, pega la
   dirección de un producto y pulsa **Solicitar indexación**. Hay un límite
   diario.

Google puede tardar desde días hasta varias semanas en mostrar las páginas
nuevas.

## Paso 2 — Perfil de Empresa en Google (Google Maps)

Es lo que aparece a la derecha o en el mapa cuando alguien busca "tienda de
guitarras Ayacucho".

1. Entra a <https://www.google.com/business/> y pulsa **Gestionar ahora**.
2. Llena el perfil:
   - **Nombre:** RJM Import-Export (el nombre real, sin palabras de relleno;
     Google sanciona los nombres con palabras clave agregadas).
   - **Categoría principal:** la que más se parezca, por ejemplo "Tienda de
     instrumentos musicales". Puedes agregar categorías secundarias.
   - **Ubicación:**
     - Si los clientes pueden ir a tu dirección, ponla.
     - Si solo vendes y envías, elige que **no** atiendes en un local y marca
       **zonas de servicio** (Ayacucho, Lima y las ciudades a las que envías).
   - **Teléfono:** el WhatsApp. **Sitio web:** `https://www.rjmimport.com`.
   - **Horario:** el mismo de la web (lunes a sábado, 9:00 a 19:00), o el real
     si cambió.
3. Google te pedirá **verificar** que el negocio es tuyo. Sigue el método que
   te ofrezca; suele ser un video corto del negocio o un código.
4. Sube **fotos reales**: logo, productos, el empaque de un envío. Agrega fotos
   nuevas cada cierto tiempo.
5. En **Productos** del perfil puedes cargar tus productos principales con
   foto, precio y el enlace a su página en la web.

## Paso 3 — Reseñas

Las reseñas pesan mucho en Google Maps.

- Cuando entregues un pedido y el cliente esté contento, pídele una reseña.
  Mándale el enlace que da el perfil: **Pedir reseñas** → copiar enlace.
- Responde todas las reseñas, también las malas, con calma y ofreciendo
  solución.
- **No** compres reseñas ni las escribas tú. Google las borra y puede
  suspender el perfil.

## Paso 4 — Redes sociales

- Publica seguido; dos o tres veces por semana es una buena meta.
  - Los videos cortos funcionan bien: probar un preamplificador, instalar una
    pastilla, abrir un pedido.
- En cada publicación, pon el enlace a la página del producto. En la tienda,
  abre el producto y usa **Compartir este producto**.
- En la biografía de Facebook, Instagram y TikTok pon `https://www.rjmimport.com`.
- Mándame los enlaces de tus perfiles para mostrarlos en la web: Google los
  usa para relacionar tus redes con tu tienda.

## Paso 5 — Más productos, mejor descritos

Google solo puede mostrar lo que está publicado. Por cada producto:

- **Nombre claro, como lo buscaría el cliente:** "Preamplificador para guitarra
  acústica RMC Pentapre" es mejor que "Pentapre".
- **Descripción propia** de 2 a 4 frases: para qué sirve y para qué instrumento.
  No copies la del fabricante palabra por palabra.
- **Marca, código y foto nítida** con fondo claro.

---

## Qué esperar

- **Nadie puede garantizar el primer lugar en Google.** Desconfía de quien lo
  prometa.
  - Fuente: <https://developers.google.com/search/docs/fundamentals/do-i-need-seo>
- Los pasos gratuitos suben las visitas poco a poco, en semanas o meses.
- Para aparecer arriba desde el primer día existe Google Ads, que es pagado.
  Se puede evaluar cuando lo gratuito esté funcionando.
