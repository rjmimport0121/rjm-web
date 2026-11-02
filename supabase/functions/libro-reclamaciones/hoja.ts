// Funciones puras del Libro de Reclamaciones: validan la hoja y arman el correo.
// No usan nada propio de Deno, así se pueden probar fuera de Supabase.

export const EMPRESA = {
  razonSocial: "RJM Import-Export E.I.R.L.",
  ruc: "20610045171",
  domicilio: "Mz. G Lt. 06 Asc. Basilio Auqui, Huamanga - Ayacucho",
  web: "www.rjmimport.com",
  correo: "rjm.import.export@gmail.com",
  whatsapp: "+51 956 543 522",
};

export type Hoja = {
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  domicilio: string | null;
  telefono: string | null;
  correo: string | null;
  menor_de_edad: boolean;
  apoderado: string | null;
  bien_tipo: "producto" | "servicio";
  monto_reclamado: number | null;
  moneda: "PEN" | "USD";
  bien_descripcion: string;
  pedido_referencia: string | null;
  tipo: "reclamo" | "queja";
  detalle: string;
  pedido: string;
  respuesta_por: "correo" | "carta";
};

export type Resultado = { ok: true; hoja: Hoja } | { ok: false; error: string };

const CORREO_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DOCUMENTOS = ["DNI", "CE", "Pasaporte", "RUC", "Otro"];

function texto(valor: unknown, max: number): string | null {
  if (valor === null || valor === undefined) return null;
  const limpio = String(valor).replace(/\s+/g, " ").trim();
  return limpio ? limpio.slice(0, max) : null;
}
function parrafo(valor: unknown, max: number): string | null {
  if (valor === null || valor === undefined) return null;
  const limpio = String(valor).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return limpio ? limpio.slice(0, max) : null;
}

// Valida los datos que llegan del formulario. Solo pide lo que exige el
// formato oficial: no exige domicilio y correo a la vez, ni declaraciones juradas.
export function validarHoja(entrada: Record<string, unknown>, msLlenado: number): Resultado {
  if (texto(entrada.sitio_web, 200)) return { ok: false, error: "No se pudo registrar la hoja." }; // trampa para robots
  if (!(msLlenado >= 2500)) return { ok: false, error: "Revisa los datos y vuelve a enviar la hoja." };

  const nombre = texto(entrada.nombre, 150);
  if (!nombre || nombre.length < 3) return { ok: false, error: "Escribe tu nombre completo." };

  const tipoDoc = texto(entrada.tipo_documento, 20) ?? "";
  if (!DOCUMENTOS.includes(tipoDoc)) return { ok: false, error: "Elige el tipo de documento." };
  const numeroDoc = (texto(entrada.numero_documento, 20) ?? "").replace(/\s/g, "");
  if (tipoDoc === "DNI" && !/^\d{8}$/.test(numeroDoc)) return { ok: false, error: "El DNI debe tener 8 dígitos." };
  if (tipoDoc === "RUC" && !/^\d{11}$/.test(numeroDoc)) return { ok: false, error: "El RUC debe tener 11 dígitos." };
  if (!/^[A-Za-z0-9-]{4,20}$/.test(numeroDoc)) return { ok: false, error: "Revisa el número de documento." };

  const correo = texto(entrada.correo, 120)?.toLowerCase() ?? null;
  if (correo && !CORREO_RE.test(correo)) return { ok: false, error: "Revisa tu correo electrónico." };
  const domicilio = texto(entrada.domicilio, 250);
  if (!correo && !domicilio) return { ok: false, error: "Escribe tu correo electrónico o tu domicilio para poder responderte." };
  const telefono = texto(entrada.telefono, 30);
  if (telefono && !/^[0-9 +()-]{6,30}$/.test(telefono)) return { ok: false, error: "Revisa tu teléfono." };

  const menor = entrada.menor_de_edad === true || entrada.menor_de_edad === "true";
  const apoderado = menor ? texto(entrada.apoderado, 150) : null;
  if (menor && (!apoderado || apoderado.length < 3)) return { ok: false, error: "Escribe el nombre del padre o la madre." };

  const bienTipo = entrada.bien_tipo === "servicio" ? "servicio" : entrada.bien_tipo === "producto" ? "producto" : null;
  if (!bienTipo) return { ok: false, error: "Indica si es un producto o un servicio." };
  let monto: number | null = null;
  if (entrada.monto_reclamado !== null && entrada.monto_reclamado !== undefined && String(entrada.monto_reclamado).trim() !== "") {
    monto = Math.round(Number(String(entrada.monto_reclamado).replace(",", ".")) * 100) / 100;
    if (!Number.isFinite(monto) || monto < 0 || monto > 99999999) return { ok: false, error: "Revisa el monto reclamado." };
  }
  const moneda = entrada.moneda === "USD" ? "USD" : "PEN";
  const bienDescripcion = texto(entrada.bien_descripcion, 500);
  if (!bienDescripcion || bienDescripcion.length < 3) return { ok: false, error: "Describe el producto o servicio." };
  const referencia = texto(entrada.pedido_referencia, 60);

  const tipo = entrada.tipo === "queja" ? "queja" : entrada.tipo === "reclamo" ? "reclamo" : null;
  if (!tipo) return { ok: false, error: "Elige si es un reclamo o una queja." };
  const detalle = parrafo(entrada.detalle, 3000);
  if (!detalle || detalle.length < 10) return { ok: false, error: "Cuéntanos con más detalle qué pasó (mínimo 10 caracteres)." };
  const pedido = parrafo(entrada.pedido, 2000);
  if (!pedido || pedido.length < 3) return { ok: false, error: "Escribe qué solicitas." };

  let respuestaPor = entrada.respuesta_por === "carta" ? "carta" : "correo";
  if (respuestaPor === "correo" && !correo) respuestaPor = "carta";
  if (respuestaPor === "carta" && !domicilio) respuestaPor = "correo";

  return {
    ok: true,
    hoja: {
      nombre, tipo_documento: tipoDoc, numero_documento: numeroDoc, domicilio, telefono, correo,
      menor_de_edad: menor, apoderado, bien_tipo: bienTipo, monto_reclamado: monto, moneda,
      bien_descripcion: bienDescripcion, pedido_referencia: referencia, tipo, detalle, pedido,
      respuesta_por: respuestaPor as "correo" | "carta",
    },
  };
}

export function fechaHoraLima(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(iso));
}

const escapar = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const dinero = (n: number, m: string) => (m === "USD" ? "US$ " : "S/ ") + n.toFixed(2);

export const NOTAS_LEGALES = [
  "RECLAMO: disconformidad relacionada a los productos o servicios.",
  "QUEJA: disconformidad no relacionada a los productos o servicios; o, malestar o descontento respecto a la atención al público.",
  "La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.",
  "El proveedor debe dar respuesta al reclamo o queja en un plazo no mayor a quince (15) días hábiles, el cual es improrrogable.",
];

// Filas de la hoja en el orden del formato oficial (Anexo I).
export function filasHoja(h: Hoja, codigo: string, creadoEn: string): [string, [string, string][]][] {
  return [
    ["Hoja de Reclamación", [
      ["N.° de hoja", codigo],
      ["Fecha y hora de presentación", fechaHoraLima(creadoEn)],
      ["Proveedor", `${EMPRESA.razonSocial} · RUC ${EMPRESA.ruc}`],
      ["Domicilio del proveedor", `${EMPRESA.domicilio} · Tienda virtual ${EMPRESA.web}`],
    ]],
    ["1. Identificación del consumidor reclamante", [
      ["Nombre", h.nombre],
      ["Documento", `${h.tipo_documento} ${h.numero_documento}`],
      ["Domicilio", h.domicilio ?? "—"],
      ["Teléfono", h.telefono ?? "—"],
      ["Correo electrónico", h.correo ?? "—"],
      ...(h.menor_de_edad ? [["Padre o madre (menor de edad)", h.apoderado ?? "—"] as [string, string]] : []),
    ]],
    ["2. Identificación del bien contratado", [
      ["Tipo", h.bien_tipo === "producto" ? "Producto" : "Servicio"],
      ["Monto reclamado", h.monto_reclamado != null ? dinero(h.monto_reclamado, h.moneda) : "—"],
      ["Descripción", h.bien_descripcion],
      ...(h.pedido_referencia ? [["N.° de pedido, boleta o proforma", h.pedido_referencia] as [string, string]] : []),
    ]],
    ["3. Detalle de la reclamación y pedido del consumidor", [
      ["Tipo", h.tipo === "reclamo" ? "Reclamo" : "Queja"],
      ["Detalle", h.detalle],
      ["Pedido", h.pedido],
      ["Respuesta solicitada por", h.respuesta_por === "correo" ? "Correo electrónico" : "Carta al domicilio"],
    ]],
  ];
}

export function armarCorreo(h: Hoja, codigo: string, creadoEn: string): { asunto: string; html: string; texto: string } {
  const filas = filasHoja(h, codigo, creadoEn);
  const asunto = `Hoja de Reclamación N.° ${codigo} — ${EMPRESA.razonSocial}`;
  const intro = `Hola ${h.nombre}: registramos tu ${h.tipo} en el Libro de Reclamaciones virtual de ${EMPRESA.razonSocial}. ` +
    `Esta es la copia de tu Hoja de Reclamación. Te responderemos en un plazo no mayor a quince (15) días hábiles` +
    `${h.respuesta_por === "correo" ? " por correo electrónico" : " por carta a tu domicilio"}.`;

  const textoPlano = [intro, ""].concat(
    filas.flatMap(([titulo, datos]) => [titulo.toUpperCase(), ...datos.map(([k, v]) => `${k}: ${v}`), ""]),
    ["4. Observaciones y acciones adoptadas por el proveedor: se completarán en la respuesta.", ""],
    NOTAS_LEGALES.map((n) => `* ${n}`),
    ["", `${EMPRESA.razonSocial} · ${EMPRESA.correo} · WhatsApp ${EMPRESA.whatsapp} · ${EMPRESA.web}`],
  ).join("\n");

  const bloque = (titulo: string, datos: [string, string][]) => `
    <tr><td colspan="2" style="padding:18px 0 6px;font:700 15px Arial,sans-serif;color:#0b2545;border-bottom:2px solid #f59e0b">${escapar(titulo)}</td></tr>
    ${datos.map(([k, v]) => `<tr>
      <td style="padding:7px 12px 7px 0;width:38%;vertical-align:top;font:600 13px Arial,sans-serif;color:#566173">${escapar(k)}</td>
      <td style="padding:7px 0;vertical-align:top;font:14px/1.5 Arial,sans-serif;color:#0f172a;white-space:pre-wrap">${escapar(v)}</td></tr>`).join("")}`;

  const html = `<!DOCTYPE html><html lang="es"><body style="margin:0;background:#f4f5f7;padding:24px 12px">
  <table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;border-collapse:separate;padding:24px">
    <tr><td colspan="2" style="font:800 20px Arial,sans-serif;color:#0b2545">Libro de Reclamaciones</td></tr>
    <tr><td colspan="2" style="padding:8px 0 4px;font:14px/1.6 Arial,sans-serif;color:#334155">${escapar(intro)}</td></tr>
    ${filas.map(([t, d]) => bloque(t, d)).join("")}
    <tr><td colspan="2" style="padding:18px 0 6px;font:700 15px Arial,sans-serif;color:#0b2545;border-bottom:2px solid #f59e0b">4. Observaciones y acciones adoptadas por el proveedor</td></tr>
    <tr><td colspan="2" style="padding:8px 0;font:14px Arial,sans-serif;color:#566173">Se completarán en nuestra respuesta.</td></tr>
    <tr><td colspan="2" style="padding:18px 0 0;font:12px/1.6 Arial,sans-serif;color:#566173">${NOTAS_LEGALES.map((n) => `• ${escapar(n)}`).join("<br>")}</td></tr>
    <tr><td colspan="2" style="padding:18px 0 0;font:12px/1.6 Arial,sans-serif;color:#566173">${escapar(EMPRESA.razonSocial)} · RUC ${EMPRESA.ruc}<br>${escapar(EMPRESA.correo)} · WhatsApp ${escapar(EMPRESA.whatsapp)} · ${escapar(EMPRESA.web)}</td></tr>
  </table></body></html>`;

  return { asunto, html, texto: textoPlano };
}
