// ============================================================
// Edge Function: libro-reclamaciones
// Registra la Hoja de Reclamación del Libro de Reclamaciones virtual y envía
// la copia automática al correo del consumidor, con la fecha y hora de
// presentación (Reglamento del Libro de Reclamaciones, art. 4-B).
//
// - Es pública: la usa cualquier visitante desde libro-reclamaciones.html.
//   Por eso valida todo aquí y limita los envíos repetidos desde una conexión.
// - Guarda con la clave service_role, que solo existe en el servidor.
// - El correo sale por Resend (https://resend.com). Si falta la clave, la hoja
//   se registra igual y el panel la muestra con "copia pendiente".
//
// Secretos (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY      clave de Resend (necesaria para el envío automático)
//   RECLAMOS_REMITENTE  remitente verificado en Resend,
//                       p. ej. "RJM Import-Export <reclamaciones@rjmimport.com>"
//   RECLAMOS_COPIA_RJM  correo que recibe copia de cada hoja
//                       (por defecto rjm.import.export@gmail.com)
// Desplegar con verify_jwt = false (es un formulario público).
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { armarCorreo, EMPRESA, validarHoja } from "./hoja.ts";

const ORIGENES = [
  /^https:\/\/(www\.)?rjmimport\.com$/,
  /^https:\/\/([a-z0-9-]+-)?rjm-web\.rjm-import-export\.workers\.dev$/,
  /^http:\/\/localhost(:\d+)?$/,
];
const MAX_POR_HORA = 5;

function cabeceras(origen: string | null): Record<string, string> {
  const permitido = origen && ORIGENES.some((r) => r.test(origen)) ? origen : "https://www.rjmimport.com";
  return {
    "Access-Control-Allow-Origin": permitido,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Huella anónima de la conexión (HMAC de la IP): sirve para frenar abusos sin guardar la IP.
async function huella(req: Request, secreto: string): Promise<string | null> {
  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  if (!ip) return null;
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(ip)));
  return [...firma.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const cors = cabeceras(req.headers.get("Origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let entrada: Record<string, unknown>;
  try { entrada = await req.json(); } catch { return json({ error: "Datos no válidos" }, 400); }
  const revisado = validarHoja(entrada, Number(entrada.ms_llenado));
  if (!revisado.ok) return json({ error: revisado.error }, 400);
  const hoja = revisado.hoja;

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, service, { auth: { persistSession: false } });

  const ipHash = await huella(req, service);
  if (ipHash) {
    const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await db.from("reclamaciones").select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).gte("creado_en", desde);
    if ((count ?? 0) >= MAX_POR_HORA) {
      return json({ error: `Recibimos varias hojas desde tu conexión en la última hora. Espera un momento o escríbenos a ${EMPRESA.correo}.` }, 429);
    }
  }

  const { data: fila, error } = await db.from("reclamaciones").insert({ ...hoja, ip_hash: ipHash })
    .select("id, codigo, creado_en").single();
  if (error || !fila) {
    console.error("registro", error);
    return json({ error: `No pudimos registrar la hoja. Inténtalo otra vez en unos minutos o escríbenos a ${EMPRESA.correo}.` }, 500);
  }

  // Copia automática: al consumidor (si dio correo), con copia oculta a RJM.
  // Si el consumidor no dio correo, el aviso llega solo a RJM.
  const claveResend = Deno.env.get("RESEND_API_KEY");
  const copiaRjm = Deno.env.get("RECLAMOS_COPIA_RJM") ?? EMPRESA.correo;
  const remitente = Deno.env.get("RECLAMOS_REMITENTE") ?? "RJM Import-Export <reclamaciones@rjmimport.com>";
  let correoEnviado = false;
  let errorCorreo: string | null = null;
  if (claveResend) {
    const correo = armarCorreo(hoja, fila.codigo, fila.creado_en);
    try {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${claveResend}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: remitente,
          to: hoja.correo ? [hoja.correo] : [copiaRjm],
          bcc: hoja.correo ? [copiaRjm] : undefined,
          reply_to: copiaRjm,
          subject: correo.asunto,
          html: correo.html,
          text: correo.texto,
        }),
      });
      if (resp.ok) correoEnviado = !!hoja.correo;
      else errorCorreo = `Resend ${resp.status}: ${(await resp.text()).slice(0, 300)}`;
    } catch (e) {
      errorCorreo = String(e).slice(0, 300);
    }
  } else {
    errorCorreo = "Falta configurar RESEND_API_KEY";
  }
  await db.from("reclamaciones").update({ correo_enviado: correoEnviado, correo_error: errorCorreo }).eq("id", fila.id);

  return json({ codigo: fila.codigo, creado_en: fila.creado_en, correo_enviado: correoEnviado, con_correo: !!hoja.correo });
});
