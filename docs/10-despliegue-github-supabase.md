# 10 — Despliegue: GitHub + Supabase desde Windows

> Guía exacta y completa para subir **Knight FM** a un repositorio de GitHub y migrar
> su base de datos de SQLite a **Supabase (PostgreSQL)**, trabajando desde Windows.
> Escrita para PowerShell; cada paso dice **qué** se hace, **por qué** y **cómo verificarlo**.

---

## Parte 0 · Requisitos previos (una sola vez)

### 0.1 Instala las herramientas en Windows

| Herramienta | Para qué | Descarga | Verificación (PowerShell) |
|---|---|---|---|
| **Node.js 22 LTS** | Ejecutar Next.js, Prisma y npm | https://nodejs.org → instalador Windows `.msi` (x64) — acepta todo por defecto | `node -v` → `v22.x.x` |
| **Git for Windows** | Versionar y subir a GitHub | https://git-scm.com/download/win — acepta los defaults (incluye **Git Credential Manager**) | `git --version` → `git version 2.x` |
| **Bun** (recomendado) | Correr `scripts/seed.ts` y los scripts del proyecto | PowerShell (administrador): `powershell -c "irm bun.sh/install.ps1 | iex"` y reabre la terminal | `bun -v` → `1.x.x` |

> **Por qué Bun:** el proyecto se desarrolla con Bun; `bun` carga automáticamente el `.env`
> al ejecutar scripts (Node + `tsx` no lo hace), y `@node-rs/argon2` tiene binarios
> precompilados para Windows. Si no quieres instalarlo, alternativa en la Parte 5.4.

### 0.2 Crea las cuentas

1. **GitHub** → https://github.com/signup (activa la verificación en 2 pasos: *Settings → Password and authentication → Two-factor authentication*).
2. **Supabase** → https://supabase.com → *Start your project* (puedes entrar con la cuenta de GitHub).

### 0.3 Ten a mano los datos del proyecto

- Tu copia local de Knight FM (la carpeta que descargaste del ZIP).
- Las credenciales admin **NO están en el código** (se movieron a variables de entorno por seguridad — ver Parte 1.2).

---

## Parte 1 · Preparar el proyecto para ser público (ya aplicado)

### 1.1 Qué se blindó en el código (hecho automáticamente)

Antes de tocar GitHub se aplicó un **hardening de secretos** para que el repositorio pueda ser público sin filtrar nada:

| Archivo | Cambio | Motivo |
|---|---|---|
| `src/lib/genesis.ts` | El admin ya no está escrito en el código; se lee de `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` | La contraseña bootstrap estaba hardcodeada → cualquier persona que viera el repo la vería |
| `src/lib/config.ts` | El default de `admin.bootstrapEmail` ahora sale de la env var | Elimina el correo personal del código fuente |
| `docs/*` + `scripts/docx-content*.js` + `gen-docx.js` | Correos y contraseña reemplazados por referencias a las env vars | La documentación y el DOCX se sirven públicamente desde la web |
| `.gitignore` | + `tool-results/`, `agent-ctx/`, `download/`, `Thumbs.db`, `desktop.ini`, `*.db-wal`, `*.db-shm` | Esas carpetas contienen sesiones de admin, capturas y artefactos internos de desarrollo |
| `.env.example` | NUEVO — plantilla de variables | Quien clone el repo sabe exactamente qué variables necesita |
| `.gitattributes` | NUEVO — normaliza saltos de línea | Evita que Windows (CRLF) rompa los `.sh` y el diff del repo |
| `package.json` | + script `postinstall: prisma generate` | Al hacer `npm install` (o desplegar en Vercel) el cliente Prisma se genera solo |
| Git | `tool-results/` y `agent-ctx/` sacadas del índice (`git rm --cached`) | Dejan de viajar a GitHub aunque sigan en tu disco |

### 1.2 Crea tu `.env` local (NUNCA se sube a GitHub)

En la carpeta del proyecto, con PowerShell:

```powershell
cd "C:\ruta\a\tu\proyecto"          # ← ajústala a tu carpeta real
Copy-Item .env.example .env
notepad .env
```

Déjalo así para desarrollo local con SQLite (Fase 1, sin Supabase todavía):

```ini
DATABASE_URL="file:../db/custom.db"
AUTH_SECRET="PEGA_AQUI_UN_HEX_DE_64"
ADMIN_BOOTSTRAP_EMAIL="tu-correo-real@ejemplo.com"
ADMIN_BOOTSTRAP_PASSWORD="una-contraseña-muy-fuerte"
```

Genera tu `AUTH_SECRET` nuevo (no reutilices el de nadie):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Por qué:** `AUTH_SECRET` firma las sesiones JWT; si es público, cualquiera puede
> falsificar sesiones. El `.env` está en `.gitignore`, así que `git` lo ignora siempre.

### 1.3 Verifica que git no va a subir nada sensible

```powershell
git check-ignore .env db/custom.db          # debe imprimir ambas rutas
git status --short                          # no debe listar .env ni *.db
```

---

## Parte 2 · Crear el repositorio en GitHub

1. Entra a https://github.com/new
2. **Repository name**: `knight-fm` (o el que prefieras).
3. **Visibility**: `Private` (recomendado; puedes hacerlo público cuando quieras — con el hardening de la Parte 1 ya no hay secretos en el código).
4. **NO** marques «Add a README» ni «.gitignore» ni «license» (el proyecto ya los tiene / evita conflictos).
5. Pulsa **Create repository**. GitHub te muestra una URL tipo `https://github.com/TU_USUARIO/knight-fm.git` — cópiala.

---

## Parte 3 · Subir el proyecto a GitHub (PowerShell)

### 3.0 ¿Partes desde el ZIP descargado? (sin historial git)

El ZIP contiene los archivos pero **no** el historial (`.git`). Conviértelo en repositorio
nuevo y limpio con 4 comandos y continúa en el paso 3.1:

```powershell
cd "C:\ruta\a\knight-fm"                # carpeta extraída del ZIP
git init -b main
git add -A
git commit -m "Knight FM v1.0"
git remote add origin https://github.com/TU_USUARIO/knight-fm.git
git push -u origin main                 # continúa en 3.1 para la autenticación
```

### 3.1 Identidad de git (una sola vez por PC)

```powershell
git config --global user.name  "Tu Nombre"
git config --global user.email "tu-correo@ejemplo.com"
```

### 3.2 Conectar y subir

Dentro de la carpeta del proyecto:

```powershell
# 1) Comprueba que el repo local está sano (rama main, sin cambios pendientes)
git status

# 2) Conecta tu repositorio remoto (pega TU url de la Parte 2)
git remote add origin https://github.com/TU_USUARIO/knight-fm.git

# 3) Verifica la conexión
git remote -v

# 4) Sube la rama main y fija el upstream
git push -u origin main
```

**La primera vez que hagas `git push`** se abrirá una ventana de **Git Credential Manager**
→ elige *Sign in with your browser* → autoriza en GitHub. Windows guarda el token y no
te lo pedirá más. Si no aparece la ventana o prefieres un token:

- GitHub → *Settings → Developer settings → Personal access tokens → Tokens (classic)* → *Generate new token (classic)*, marca el scope **`repo`**, copia el token y úsalo como contraseña cuando git pregunte (usuario: tu usuario de GitHub).

### 3.3 Verificación final

```powershell
git log --oneline -3        # tus commits
git ls-remote origin main   # debe devolver el hash del commit subido
```

Refresca https://github.com/TU_USUARIO/knight-fm — verás el código, `docs/` (con esta guía),
el `README.md` y **ni rastro** de `.env`, `db/`, `tool-results/` o `agent-ctx/`.

### 3.4 Flujo de trabajo diario (a partir de ahora)

```powershell
git add -A
git commit -m "Describe tu cambio"
git push
```

> **Nota sobre el ZIP**: `public/downloads/knight-fm-project.zip` (~32 MB) viaja en el repo
> porque la propia web lo sirve para descargar. GitHub lo acepta (el límite duro es 100 MB).
> Si algún día lo quieres fuera del repo, añade esa ruta a `.gitignore` y publícalo como
> *Release* de GitHub.

---

## Parte 4 · Crear el proyecto en Supabase

1. https://supabase.com/dashboard → **New project**.
2. **Name**: `knight-fm` · **Database Password**: pulsa *Generate a password* y **guárdala** en un lugar seguro (la necesitarás en las URLs; si la pierdes: *Project Settings → Database → Reset database password*).
3. **Region**: `East US (North Virginia)` — la más cercana a Cuba/Caribe → menor latencia.
4. Espera ~2 min a que el proyecto quede *Active*.

> Plan Free: 500 MB de base de datos — suficiente para arrancar. El mundo completo
> (1.600 clubes × 20 jugadores) cabe con holgura. Ojo: Supabase **pausa** los proyectos
> free tras ~7 días de inactividad; un botón *Restore* los reactiva.

### 4.1 Copiar las dos cadenas de conexión exactas

En el Dashboard: botón **Connect** (barra superior) → sección *Connection pooling*:

1. **Transaction pooler** (puerto **6543**) → *Node.js / Prisma* → cópiala. Es tu `DATABASE_URL`.
2. **Session pooler** (puerto **5432**, mismo host `pooler.supabase.com`) → cópiala. Es tu `DIRECT_URL`.

Se ven así (los `<>` los sustituyes tú):

```
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
```

- `<PROJECT_REF>`: el identificador del proyecto (en *Project Settings → General → Reference ID*, también aparece dentro del propio host).
- **¿Por qué dos URLs?** Prisma necesita una conexión «directa» para crear el esquema
  (`DIRECT_URL`) y la aplicación usa un pool de transacciones para no agotar las
  conexiones del plan free (`DATABASE_URL` con `?pgbouncer=true&connection_limit=1`).
- **¿Por qué el host `pooler` y no `db.<ref>.supabase.co`?** El host directo es IPv6-only;
  muchas redes domésticas (y Windows sin IPv6) no lo alcanzan. El pooler funciona con IPv4 siempre.

---

## Parte 5 · Migrar Prisma de SQLite a PostgreSQL (Supabase)

### 5.1 Edita `prisma/schema.prisma` (cambio exacto)

```prisma
// ANTES
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// DESPUÉS
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

> El resto del schema **no se toca**: todos los modelos usan tipos primitivos y
> `String` para los «enums», así que son 100 % compatibles con PostgreSQL.
> `directUrl` le dice a la CLI de Prisma por dónde crear el esquema; el cliente
> generado sigue usando `DATABASE_URL`.

### 5.2 Actualiza tu `.env` local con las URLs de Supabase

Comenta la línea de SQLite y pega las dos de la Parte 4.1. Tu `.env` queda:

```ini
# Desarrollo local (SQLite) — descomenta para volver a modo offline
# DATABASE_URL="file:../db/custom.db"

DATABASE_URL="postgresql://postgres.xxxxxxxxxxxx:TU_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.xxxxxxxxxxxx:TU_PASSWORD@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
AUTH_SECRET="tu-hex-de-64"
ADMIN_BOOTSTRAP_EMAIL="tu-correo-real@ejemplo.com"
ADMIN_BOOTSTRAP_PASSWORD="una-contraseña-muy-fuerte"
```

### 5.3 Crea el esquema y regenera el cliente

```powershell
bun run db:push        # = npx prisma db push — crea TODAS las tablas en Supabase
bun run db:generate    # = npx prisma generate — regenera el cliente PostgreSQL
```

Verificación: https://supabase.com/dashboard → *Table Editor* → deben aparecer
`User`, `Club`, `Player`, `AuditEvent`… (los 50+ modelos).

### 5.4 Genera el mundo (genesis) en Supabase

La base está vacía; el genesis crea las 10 regiones, 1.600 clubes, 32.000 jugadores,
el calendario y tu cuenta admin:

```powershell
bun scripts/seed.ts
# Genesis complete: { ... }
```

> **Sin Bun:** `npm i -D tsx` y luego `npx tsx --env-file=.env scripts/seed.ts`
> (el `--env-file` es imprescindible con Node, porque el script necesita las env vars;
> Bun las carga solo).
> Si el mundo ya existiera y quisieras reconstruirlo: `bun scripts/seed.ts --force`.

### 5.5 Arranca el juego contra Supabase

```powershell
bun run dev        # o: npm run dev
```

Entra, inicia sesión con `ADMIN_BOOTSTRAP_EMAIL` + su contraseña y comprueba el
Centro de Control. **Tu SQLite local sigue intacta** en `db/custom.db` (puedes volver
a ella comentando las URLs de Supabase en `.env`).

> **Migración de datos existentes:** este procedimiento crea un mundo NUEVO en Supabase.
> Copiar los datos de tu `custom.db` (usuarios, fondos, subastas en curso) requiere un
> script ETL a medida — consúltame y lo preparamos. Para lanzar a producción, el genesis
> limpio es el camino recomendado.

### 5.6 Sube el cambio de schema a GitHub

```powershell
git add prisma/schema.prisma .env.example docs/
git commit -m "DB: migración de SQLite a PostgreSQL (Supabase)"
git push
```

---

## Parte 6 · Desplegar en producción (Vercel + GitHub)

GitHub y Supabase ya están conectados entre sí por tu código; el paso final es un host.
Con Vercel es 1 clic porque el repo ya está en GitHub:

1. https://vercel.com/new → **Import** tu repo `knight-fm`.
2. **Build Command**: escribe `npx next build` (ignora el script `build` local, que copia
   carpetas con `cp -r` pensado para el modo standalone del sandbox).
3. **Environment Variables** — añade las 5 (mismos valores que tu `.env`):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La del pool **6543** con `?pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | La del pool **5432** |
   | `AUTH_SECRET` | **Otro hex de 64 NUEVO** (no reutilices el de tu PC) |
   | `ADMIN_BOOTSTRAP_EMAIL` | Tu correo admin |
   | `ADMIN_BOOTSTRAP_PASSWORD` | Contraseña admin fuerte |

4. **Deploy**. Al terminar, Vercel te da la URL pública (`https://knight-fm.vercel.app`).
5. Cada `git push` a `main` hará un despliegue nuevo automáticamente.

> La base de datos de producción es la MISMA de Supabase que ya poblaste en la Parte 5.4 —
> el mundo no se vuelve a generar.

---

## Parte 7 · Checklist de seguridad post-despliegue

- [ ] `AUTH_SECRET` de producción ≠ `AUTH_SECRET` local (ambos secretos, nunca en git).
- [ ] Cambia la contraseña admin tras el primer login (Centro de Control → cuenta).
- [ ] 2FA activada en GitHub y en Supabase (*Account → Two-factor auth*).
- [ ] `git check-ignore .env db/custom.db` sigue devolviendo ambas rutas antes de cada push.
- [ ] Si algún secreto llegara a filtrarse: **rotarlo inmediatamente** (`AUTH_SECRET` nuevo
      invalida todas las sesiones; contraseña DB → *Reset database password* + actualizar
      las URLs en Vercel) y, si ya se había subido, bórralo del historial o haz el repositorio
      privado y empieza con un historial limpio.
- [ ] Backups: Supabase free no incluye backups automáticos → exporta desde
      *Database → Backups* o programa `pg_dump` (mejora pendiente KFM-OPS-003).

---

## Parte 8 · Errores comunes y solución exacta

| Síntoma | Causa | Solución |
|---|---|---|
| `P1001: Can't reach database server` | URL mal copiada / proyecto pausado | Revisa host y puerto (6543 app / 5432 CLI); en Supabase pulsa *Restore* si está paused |
| `Timed out` contra `db.<ref>.supabase.co:5432` | Ese host es IPv6-only | Usa SIEMPRE los hosts `*.pooler.supabase.com` de esta guía |
| `Prepared statement "s0" already exists` | Falta `?pgbouncer=true` en la URL 6543 | Añádelo (y `&connection_limit=1`) |
| `P3006/P3015` al migrar | Estás usando `migrate dev` con el pooler | Este proyecto usa `db push` (Parte 5.3); no necesitas `migrations/` |
| `git push` pide usuario/contraseña en bucle | Credencial vieja en Windows | *Panel de control → Administrador de credenciales → Credenciales de Windows* → borra la entrada de github.com y reintenta |
| `! [rejected] main … non-fast-forward` | El remoto tiene algo que tu copia no | `git pull --rebase origin main` y repite `git push` |
| `warning: LF will be replaced by CRLF` | Aviso de saltos de línea | Inofensivo; `.gitattributes` ya lo normaliza |
| `error: src refspec main` | Commiteaste en otra rama | `git branch -M main` y reintenta |
| El build falla en Vercel por `cp -r` | Script `build` local no portable | Usa Build Command `npx next build` (Parte 6.2) |
| Supabase «pausado» | Plan free tras ~7 días sin tráfico | Dashboard → *Restore project* |

---

## Resumen visual del flujo

```
[Windows]                                   [GitHub]                 [Supabase]
 código + .env (secreto, ignorado)  ──push──▶  repo privado            ▲
        │                                       ▲   │      db push     │
        │                       Vercel importa ─┘   └── deploy auto      │
        └── bun scripts/seed.ts ──────────────── genesis (mundo) ───────┘
```

**Orden recomendado en una frase:** preparar `.env` → subir a GitHub (Parte 2-3) →
crear Supabase (Parte 4) → migrar schema + genesis (Parte 5) → desplegar en Vercel (Parte 6).
