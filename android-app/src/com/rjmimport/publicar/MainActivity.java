package com.rjmimport.publicar;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.OutputStream;

/**
 * App de Android "RJM Publicar".
 *
 * Abre la app web https://www.rjmimport.com/publicar/ a pantalla completa y le
 * agrega lo que un navegador incrustado no trae solo:
 *  - "Tomar foto" abre la cámara del teléfono y "Galería" el selector de fotos.
 *  - window.RJMAndroid.compartir(texto, fotoBase64) comparte foto + texto con el
 *    menú del sistema (Facebook, WhatsApp...) y copia el texto.
 *  - Los enlaces fuera de /publicar/ se abren en el navegador del teléfono.
 *
 * Como el contenido vive en la web, cualquier mejora de la app se ve al
 * instante sin reinstalar el APK.
 */
public class MainActivity extends Activity {

    private static final String INICIO = "https://www.rjmimport.com/publicar/";
    private static final int PEDIR_FOTO = 1;
    private static final String CARPETA = "Pictures/RJM Publicar";

    private WebView web;
    private ValueCallback<Uri[]> respuestaFoto;
    private Uri fotoCamara;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        web = new WebView(this);
        setContentView(web);

        WebSettings ajustes = web.getSettings();
        ajustes.setJavaScriptEnabled(true);
        ajustes.setDomStorageEnabled(true);          // la sesión y el borrador se guardan aquí
        ajustes.setAllowFileAccess(false);
        ajustes.setAllowContentAccess(true);
        ajustes.setMediaPlaybackRequiresUserGesture(true);
        ajustes.setUserAgentString(ajustes.getUserAgentString() + " RJMPublicarAndroid/1.0");

        web.addJavascriptInterface(new Puente(), "RJMAndroid");
        web.setWebViewClient(new Navegacion());
        web.setWebChromeClient(new Selector());

        if (estado != null) web.restoreState(estado);
        else web.loadUrl(INICIO);
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    // ---------- Navegación: solo /publicar/ dentro de la app ----------
    private class Navegacion extends WebViewClient {
        @Override
        @SuppressWarnings("deprecation") // la versión con WebResourceRequest es del API 24; Android sigue llamando a esta
        public boolean shouldOverrideUrlLoading(WebView vista, String url) {
            Uri u = Uri.parse(url);
            String host = u.getHost() == null ? "" : u.getHost();
            String ruta = u.getPath() == null ? "" : u.getPath();
            boolean propio = "https".equals(u.getScheme())
                    && (host.equals("www.rjmimport.com") || host.equals("rjmimport.com"))
                    && ruta.startsWith("/publicar");
            if (propio) return false;
            abrirFuera(u);
            return true;
        }

        @Override
        public void onReceivedError(WebView vista, WebResourceRequest pedido, WebResourceError error) {
            if (pedido.isForMainFrame()) vista.loadDataWithBaseURL(null, PAGINA_SIN_CONEXION, "text/html", "utf-8", null);
        }
    }

    private void abrirFuera(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (Exception ignorada) {
            // No hay app para abrir el enlace: no se hace nada.
        }
    }

    // ---------- Cámara y galería para <input type="file"> ----------
    private class Selector extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView vista, ValueCallback<Uri[]> respuesta, FileChooserParams opciones) {
            if (respuestaFoto != null) respuestaFoto.onReceiveValue(null);
            respuestaFoto = respuesta;
            fotoCamara = crearFotoVacia("rjm_" + System.currentTimeMillis() + ".jpg");

            Intent camara = null;
            if (fotoCamara != null) {
                camara = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                camara.putExtra(MediaStore.EXTRA_OUTPUT, fotoCamara);
                camara.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
            Intent galeria = new Intent(Intent.ACTION_GET_CONTENT);
            galeria.addCategory(Intent.CATEGORY_OPENABLE);
            galeria.setType("image/*");

            Intent elegir;
            if (opciones.isCaptureEnabled() && camara != null) {
                elegir = camara;                                   // botón "Tomar foto"
            } else {
                elegir = Intent.createChooser(galeria, "Elegir foto");
                if (camara != null) elegir.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camara});
            }
            try {
                startActivityForResult(elegir, PEDIR_FOTO);
                return true;
            } catch (Exception e) {
                borrarFotoVacia();
                respuestaFoto = null;
                respuesta.onReceiveValue(null);
                return true;
            }
        }
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent datos) {
        if (pedido != PEDIR_FOTO || respuestaFoto == null) {
            super.onActivityResult(pedido, resultado, datos);
            return;
        }
        Uri[] elegidas = null;
        if (resultado == RESULT_OK) {
            Uri desdeGaleria = null;
            if (datos != null && datos.getData() != null) desdeGaleria = datos.getData();
            else if (datos != null && datos.getClipData() != null && datos.getClipData().getItemCount() > 0)
                desdeGaleria = datos.getClipData().getItemAt(0).getUri();

            if (desdeGaleria != null && !desdeGaleria.equals(fotoCamara)) {
                borrarFotoVacia();
                elegidas = new Uri[]{desdeGaleria};
            } else if (fotoCamara != null) {
                terminarFoto(fotoCamara);
                elegidas = new Uri[]{fotoCamara};
                fotoCamara = null;
            }
        } else {
            borrarFotoVacia();
        }
        respuestaFoto.onReceiveValue(elegidas);
        respuestaFoto = null;
    }

    /** Reserva en la galería el lugar donde la cámara guardará la foto (oculto hasta terminar). */
    private Uri crearFotoVacia(String nombre) {
        try {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, nombre);
            v.put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg");
            v.put("relative_path", CARPETA);   // MediaStore.MediaColumns.RELATIVE_PATH (Android 10+)
            v.put("is_pending", 1);            // MediaStore.MediaColumns.IS_PENDING (Android 10+)
            return getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
        } catch (Exception e) {
            return null;
        }
    }

    private void terminarFoto(Uri u) {
        try {
            ContentValues v = new ContentValues();
            v.put("is_pending", 0);
            getContentResolver().update(u, v, null, null);
        } catch (Exception ignorada) {
            // Si falla, la foto igual se usa; solo no aparecerá en la galería.
        }
    }

    private void borrarFotoVacia() {
        if (fotoCamara == null) return;
        try {
            getContentResolver().delete(fotoCamara, null, null);
        } catch (Exception ignorada) {
            // Nada que limpiar.
        }
        fotoCamara = null;
    }

    // ---------- Puente con la página: compartir foto + texto ----------
    private class Puente {
        @JavascriptInterface
        public void compartir(final String texto, final String fotoBase64) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    compartirAhora(texto, fotoBase64);
                }
            });
        }
    }

    private void compartirAhora(String texto, String fotoBase64) {
        try {
            ClipboardManager portapapeles = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            portapapeles.setPrimaryClip(ClipData.newPlainText("Publicación RJM", texto));
        } catch (Exception ignorada) {
            // Sin portapapeles: el texto igual va en el mensaje.
        }
        Intent enviar = new Intent(Intent.ACTION_SEND);
        enviar.putExtra(Intent.EXTRA_TEXT, texto);
        Uri foto = null;
        if (fotoBase64 != null && fotoBase64.length() > 0) {
            foto = crearFotoVacia("rjm_producto_" + System.currentTimeMillis() + ".jpg");
            if (foto != null) {
                try {
                    byte[] bytes = Base64.decode(fotoBase64, Base64.DEFAULT);
                    OutputStream salida = getContentResolver().openOutputStream(foto);
                    salida.write(bytes);
                    salida.close();
                    terminarFoto(foto);
                } catch (Exception e) {
                    foto = null;
                }
            }
        }
        if (foto != null) {
            enviar.setType("image/jpeg");
            enviar.putExtra(Intent.EXTRA_STREAM, foto);
            enviar.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } else {
            enviar.setType("text/plain");
        }
        try {
            startActivity(Intent.createChooser(enviar, "Compartir producto"));
        } catch (Exception ignorada) {
            // No hay apps para compartir.
        }
    }

    private static final String PAGINA_SIN_CONEXION =
            "<!DOCTYPE html><html lang='es'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>body{margin:0;min-height:100vh;display:grid;place-content:center;gap:16px;padding:24px;text-align:center;"
            + "background:#070b12;color:#b4c6da;font-family:sans-serif}h1{color:#f1f6ff;font-size:22px;margin:0}"
            + "a{display:inline-block;margin-top:8px;padding:16px 24px;border-radius:16px;font-weight:700;text-decoration:none;color:#1a0d00;"
            + "background:linear-gradient(135deg,#e2560b,#f59e0b 55%,#fbbf24)}</style></head><body>"
            + "<h1>Sin conexión</h1><p>Revisa tu internet y vuelve a intentarlo.</p>"
            + "<a href='" + INICIO + "'>Reintentar</a></body></html>";
}
