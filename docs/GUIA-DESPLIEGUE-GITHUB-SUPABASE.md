# GUIA — Subir Knight FM a GitHub y Supabase (desde cero, Windows)

> Basada en los archivos REALES del zip v9.0.0: `prisma/schema.prisma`
> (provider postgresql), `.env.example`, `.gitignore`, `package.json`
> (`db:push`, `postinstall: prisma generate`, `dev` Windows-safe),
> `scripts/seed.ts` (génesis idempotente) y `src/instrumentation.ts`
> (auto-génesis DESACTIVADA cuando DATABASE_URL no es `file:` — en la
> nube el mundo se crea SOLO con `npx tsx scripts/seed.ts`).

## Mapa mental (qué es cada pieza)

| Pieza | Qué hace | Gratis |
|---|---|---|
| **GitHub** | Custodia el CÓDIGO (historial, copia de seguridad, puente a Vercel) | Sí |
| **Supabase** | Es la BASE DE DATOS PostgreSQL en la nube (clubes, jugadores, usuarios) | Sí |
| **Tu PC** (npm run dev) | Ejecuta la app conectada a la BD de Supabase | Sí |
| **Vercel** (opcional) | Pone la web online 24/7 + cron de salarios | Sí |

REGLA DE ORO: el archivo `.env` contiene TUS CLAVES y NUNCA se sube a
GitHub. El `.gitignore` del zip ya lo bloquea (`.env*`, `db/`,
`node_modules`, `.next/`, `server.log`). Solo sube `.env.example`
(la plantilla sin secretos).

## PARTE 1 — Preparar tu PC (una sola vez)

1. Node.js LTS: `winget install OpenJS.NodeJS.LTS`
2. Git: `winget install Git.Git`
3. **Cierra y vuelve a abrir** PowerShell.
4. Comprueba:

```powershell
node --version    # DEBES VER: v20.x.x, v22.x.x o superior
git --version     # DEBES VER: git version 2.x.x
```

## PARTE 2 — Preparar la carpeta del proyecto

1. Extrae `knightfm_updated_20261011_145930_UTC_v9.0.0.zip` en
   `D:\Programacion\knightfm` (clic derecho → Extraer todo).
2. Doble clic en `VERIFICAR-INSTALACION.bat`.
   **DEBES VER:** `ESTA COMPLETO` con `CORRECTOS: 448`.
3. Abre PowerShell EN esa carpeta:
   clic en la barra de direcciones del Explorador → escribe `powershell` → Enter.
   **DEBES VER:** el prompt apuntando a `D:\Programacion\knightfm`.

## PARTE 3 — Subir a GitHub (primera vez)

1. Crea cuenta en <https://github.com> (signup).
2. Botón **+** (arriba derecha) → **New repository**:
   - Repository name: `knightfm`
   - Visibilidad: **Private**
   - **NO** marques "Add a README", ni ".gitignore", ni "license"
     (el repositorio debe quedar VACÍO).
   - **Create repository**.
   **DEBES VER:** una página "Quick setup" con una URL
   `https://github.com/TU-USUARIO/knightfm.git`.
3. En PowerShell (en la carpeta del proyecto), uno por uno:

```powershell
git init
git add .
git status --short | Select-String "\.env$"
```

   **DEBES VER:** NADA (si apareciera `.env`, DETENTE — avisa antes de seguir).
   `node_modules` y `db/` tampoco deben salir.

```powershell
git commit -m "Sincronizacion completa v9"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/knightfm.git
git push -u origin main
```

4. La primera vez Git abre una **ventana del navegador** para iniciar
   sesión en GitHub → autoriza.
   **DEBES VER:** `Branch 'main' set up to track 'origin/main'.`
5. Refresca la pestaña del repositorio en GitHub.
   **DEBES VER:** tus carpetas `src`, `prisma`, `docs`… y **ningún**
   `.env` (solo `.env.example`).

> Si en lugar del navegador la terminal pide "Password": NO es la de
> GitHub. Usa un token: GitHub → Settings → Developer settings →
> Personal access tokens → Tokens (classic) → Generate new token,
> marca `repo`, copia el token y pégalo como contraseña.

## PARTE 4 — Crear la base de datos en Supabase

1. <https://supabase.com> → **Start your project** → Sign in **with GitHub**.
2. **New project**: Name `knightfm-db`, Database Password:
   inventa una LARGA solo con letras+números (evita símbolos: los
   símbolos rompen la URL), Region `East US (North Virginia)`.
   **APUNTA LA CONTRASEÑA.**
   **DEBES VER:** "Setting up your project" ~2 minutos.
3. Copia la cadena de conexión: icono **⚙ (Project Settings)** →
   **Database** → sección *Connection string* → pestaña
   **Session pooler** (puerto 5432, host `pooler.supabase.com`).
   Usa SIEMPRE el pooler, no la "Direct": muchas redes domésticas no
   tienen IPv6 y la conexión directa falla con timeout.
   Sustituye `[YOUR-PASSWORD]` por tu contraseña real (sin corchetes,
   sin espacios).
4. Crea tu `.env`: copia `.env.example` a `.env` y rellena:

```ini
DATABASE_URL="postgresql://postgres.xxxxxxxx:TU-PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
AUTH_SECRET="una-cadena-larga-aleatoria-de-32-o-mas-caracteres"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
CRON_SECRET="otra-cadena-larga-aleatoria"
EMAIL_PROVIDER="console"
TURNSTILE_DISABLED="1"
```

5. Instala y crea las tablas:

```powershell
npm install        # DEBES VER: "added XXX packages"
npm run db:push    # DEBES VER: "Your database is now in sync with your schema"
```

6. **Crea el mundo** (en la nube NO se auto-crea; es una protección
   para que un reinicio jamás borre tu producción):

```powershell
npx tsx scripts/seed.ts
```

   **DEBES VER:** `Genesis complete: {"regions":10,"divisions":100,`
   `"clubs":1600,...}` (puede tardar 3–10 min vía internet; NO cierres
   la ventana). Es idempotente: si ya existe el mundo, avisa y no toca nada.

7. Arranca y comprueba:

```powershell
npm run dev        # DEBES VER: ✓ Ready → http://localhost:3000
```

   En Supabase → **Table Editor** → tabla `Club`:
   **DEBES VER:** 1.600 filas. Tu mundo vive ahora en la nube.

## PARTE 5 — (Recomendado) Web 24/7 con Vercel

1. <https://vercel.com> → Sign up **with GitHub**.
2. **Add New… → Project** → Import `knightfm`.
3. Environment Variables (mínimo): `DATABASE_URL` (el URI pooler de
   Supabase), `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL` (la URL pública
   que te dé Vercel), `CRON_SECRET`.
4. **Deploy** → espera 1–3 min.
   **DEBES VER:** punto VERDE "Ready" en Deployments.
   Cada `git push` futuro publica solo (LEEME PASO 8–9).

## Errores comunes

| Síntoma | Causa | Solución |
|---|---|---|
| `git no se reconoce` | Git sin PATH | Instala Git, CIERRA y reabre PowerShell |
| Push pide Password | GitHub ya no acepta contraseñas | Personal Access Token (scope `repo`) |
| `remote origin already exists` | Remote repetido | `git remote set-url origin <URL>` |
| Prisma `P1001 can't reach` | Usaste la URI "Direct" (IPv6) | Usa la URI **Session pooler** |
| `Authentication failed` en Supabase | Contraseña mal copiada o con símbolos | Corrige el URI o regenera la password (letras+números) |
| `src refspec main` | No hiciste commit aún | Repite `git commit -m "..."` antes del push |
| `.env` subido por accidente | Se forzó el add | `git rm --cached .env` + commit + RENUEVA tus claves |
| `tsx` no encontrado | Sin red para npx | `npm install -D tsx` y repite con `npm exec tsx scripts/seed.ts` |
