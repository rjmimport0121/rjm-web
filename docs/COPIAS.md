# Copias de seguridad de la base de datos

El plan gratis de Supabase no da copias que puedas descargar. Por eso
GitHub hace una copia gratis cada domingo a las 3:17 a. m. (hora de Lima), con
el flujo `.github/workflows/copia-seguridad.yml`.

- **Qué guarda:** productos, clientes mayoristas, precios, reclamos y cuentas
  de usuario. No guarda las fotos: esas se vuelven a subir desde la app si
  hiciera falta.
- **Dónde:** en GitHub → pestaña **Actions** → **Copia de seguridad** → cada
  ejecución tiene un archivo `rjm-copia-AAAA-MM-DD`. Se borra a los 90 días.
- **Cifrada:** el repositorio es público, así que la copia se cifra con una
  clave tuya. Sin esa clave nadie puede leerla, **ni tú**: anótala en papel o
  guárdala en un lugar seguro.

## Activarla (una sola vez, 10 minutos)

### 1. Copia la conexión de la base de datos

1. Entra a Supabase, a tu proyecto, y pulsa **Connect** (arriba).
2. Busca **Session pooler**. Debe ser esa: la conexión "Direct" no funciona
   desde GitHub.
3. Copia la cadena. Tiene esta forma:
   `postgresql://postgres.zdlurhdnsgtllgfhixic:[YOUR-PASSWORD]@aws-....pooler.supabase.com:5432/postgres`
4. Cambia `[YOUR-PASSWORD]` por la **contraseña de la base de datos**. No es
   la contraseña de tu panel.
   - Si no la recuerdas: en Supabase, **Database** → **Settings** → **Reset
     database password**.
   - Cambiarla no afecta a la web ni a la app, porque esas usan otras claves.

### 2. Crea los dos secretos en GitHub

1. En GitHub, en el repositorio `rjm-web`, entra a **Settings** → **Secrets and
   variables** → **Actions** → **New repository secret**.
2. Crea `SUPABASE_DB_URL` y pega la cadena del paso anterior.
3. Crea `CLAVE_COPIAS` con una frase larga que inventes tú (mínimo 20
   caracteres). Ejemplo de estilo: `mi-tienda-de-guitarras-ayacucho-2026!`.
   Usa una tuya, no esta.

**Nunca** pegues estos dos datos en un chat, en un correo ni en el código.

### 3. Pruébala

1. Entra a **Actions** → **Copia de seguridad** → **Run workflow**.
2. A los pocos minutos debe salir con un ✅ y un archivo para descargar.
3. Si sale ❌, abre la ejecución y lee el mensaje en rojo.

## Restaurar (si algún día se pierden datos)

Pide ayuda técnica para este paso. Necesitas la copia, tu `CLAVE_COPIAS`, una
computadora con PostgreSQL 17 y estos comandos:

```bash
gpg --decrypt rjm-copia-AAAA-MM-DD.dump.gpg > copia.dump
```

```bash
pg_restore --list copia.dump
```

```bash
pg_restore --data-only --schema=public --dbname "<cadena Session pooler>" copia.dump
```

El primer comando pide la clave. El segundo muestra qué contiene la copia. El
tercero devuelve los datos de tus tablas.

Antes de restaurar, revisa con calma qué tablas devolver: una restauración
reemplaza datos actuales.
