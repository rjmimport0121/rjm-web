// ============================================================
// Edge Function: gestionar-mayoristas
// Crea usuarios mayoristas, cambia contraseñas y activa/desactiva accesos.
// Usa la clave service_role, que SÓLO existe en el servidor de Supabase
// (nunca se envía al navegador). Sólo responde a un administrador activo.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DOMINIO_USUARIOS = "mayoristas.rjmimport.com"; // correo interno: usuario@dominio
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const USUARIO_RE = /^[a-z0-9._-]{3,30}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Verificar que quien llama es un admin activo
  const authHeader = req.headers.get("Authorization") ?? "";
  const comoUsuario = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await comoUsuario.auth.getUser();
  if (!u?.user) return json({ error: "Sesión no válida" }, 401);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: perfil } = await admin.from("perfiles").select("rol, activo").eq("id", u.user.id).single();
  if (!perfil || perfil.rol !== "admin" || !perfil.activo) return json({ error: "Sólo el administrador" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const accion = String(body.accion ?? "");

  try {
    if (accion === "crear") {
      const usuario = String(body.usuario ?? "").trim().toLowerCase();
      const clave = String(body.clave ?? "");
      if (!USUARIO_RE.test(usuario)) return json({ error: "Usuario: 3–30 caracteres (a-z, 0-9, punto, guion)" }, 400);
      if (clave.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);

      const { data, error } = await admin.auth.admin.createUser({
        email: `${usuario}@${DOMINIO_USUARIOS}`,
        password: clave,
        email_confirm: true,
        user_metadata: { usuario, nombre: body.nombre ?? null },
      });
      if (error) return json({ error: error.message.includes("already") ? "Ese usuario ya existe" : error.message }, 400);

      const { error: e2 } = await admin.from("perfiles").upsert({
        id: data.user.id, usuario, rol: "mayorista", activo: true,
        nombre: body.nombre ?? null, ruc: body.ruc ?? null, telefono: body.telefono ?? null,
      });
      if (e2) return json({ error: e2.message }, 400);
      return json({ ok: true, id: data.user.id });
    }

    const id = String(body.id ?? "");
    if (!id) return json({ error: "Falta el id del usuario" }, 400);
    if (id === u.user.id && accion !== "cambiar_clave") return json({ error: "No puedes desactivarte a ti mismo" }, 400);
    const { data: objetivo } = await admin.from("perfiles").select("rol").eq("id", id).single();
    if (!objetivo) return json({ error: "Usuario no encontrado" }, 404);
    if (objetivo.rol === "admin" && id !== u.user.id) return json({ error: "No se puede modificar a otro admin aquí" }, 403);

    if (accion === "cambiar_clave") {
      const clave = String(body.clave ?? "");
      if (clave.length < 8) return json({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { password: clave });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (accion === "activar" || accion === "desactivar") {
      const activo = accion === "activar";
      // Se bloquea el acceso (no se borra el usuario: queda el historial).
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: activo ? "none" : "876000h" });
      if (error) return json({ error: error.message }, 400);
      await admin.from("perfiles").update({ activo }).eq("id", id);
      return json({ ok: true });
    }

    return json({ error: "Acción desconocida" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
