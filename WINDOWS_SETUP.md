# Knight FM — GUÍA DE INSTALACIÓN EN WINDOWS

**Versión de esta guía:** v9 · **Última actualización:** 2026-10-11 (UTC)
**Sistemas soportados:** Windows 10 (1809+) y Windows 11 · PowerShell 5.1 (incluido en Windows) o PowerShell 7+
**Guía de errores:** ver `TROUBLESHOOTING_WINDOWS.md` (misma carpeta)

---

## 1. Requisitos previos (solo la primera vez)

| Herramienta | Para qué | Instalación (copiar y pegar en PowerShell) |
|---|---|---|
| **Node.js 20 LTS o superior** | Motor de la aplicación | `winget install OpenJS.NodeJS.LTS` |
| **Git para Windows** | Subir el proyecto a GitHub/Vercel | `winget install Git.Git` |
| PostgreSQL *(opcional)* | Base de datos local (alternativa: neon.tech gratis en la nube) | `winget install PostgreSQL.PostgreSQL.16` |

Después de instalar Node.js **cierra y vuelve a abrir** la ventana de PowerShell (para que lo detecte).

Comprueba que quedó bien:

```powershell
node --version    # DEBES VER: v20.x.x, v22.x.x o superior
git --version     # DEBES VER: git version 2.x.x
```

---

## 2. Arranque rápido (forma recomendada)

```powershell
# 1) Extrae el zip (clic derecho → "Extraer todo...") y copia su contenido
#    encima de tu carpeta del proyecto, p. ej.  D:\Programacion\knightfm

# 2) Entra en la carpeta del proyecto
cd D:\Programacion\knightfm

# 3) Haz doble clic en:   DEPLOY_WINDOWS.bat
#    (o ejecuta en PowerShell:)
powershell -NoProfile -ExecutionPolicy Bypass -File .\DEPLOY_WINDOWS.ps1
```

**DEBES VER:** el script comprueba Node.js, instala dependencias, genera el
cliente Prisma, prepara tu `.env` y arranca el servidor. Al final:

```
✓ Ready - Local: http://localhost:3000
```

y tu navegador se abre solo en `http://localhost:3000`.
Para detener el servidor: **Ctrl+C** en esa ventana.

---

## 3. Instalación manual (paso a paso, equivalente al .bat)

```powershell
cd D:\Programacion\knightfm
npm install              # DEBES VER: "added N packages" y CERO líneas "ERR!"
npx prisma generate      # DEBES VER: ✔ Generated Prisma Client (v...)
npm run dev              # DEBES VER: Ready - Local: http://localhost:3000
```

Si PowerShell no permite ejecutar scripts (error "habilitado la ejecución de scripts"):

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## 4. Base de datos

El proyecto **arranca sin base de datos**: la web se ve completa y las pantallas
que piden datos avisan. Para jugar de verdad necesitas PostgreSQL:

### Opción A — neon.tech (gratis, nube, 2 minutos — recomendada)
1. Crea cuenta en https://neon.tech → **New Project** → copia la **cadena de conexión** (empieza por `postgresql://...`).
2. En PowerShell, dentro del proyecto:
   ```powershell
   $env:DATABASE_URL="postgresql://usuario:clave@host.neon.tech/neondb?sslmode=require"
   npx prisma db push     # DEBES VER: "Your database is now in sync"
   ```
3. Pega la misma cadena en tu archivo `.env` (campo `DATABASE_URL="..."`) y también en **Vercel → Settings → Environment Variables** si despliegas en la nube.

### Opción B — PostgreSQL local
```powershell
winget install PostgreSQL.PostgreSQL.16
# Durante la instalación define la contraseña del usuario "postgres".
$env:DATABASE_URL="postgresql://postgres:TU-CONTRASEÑA@localhost:5432/knightfm"
npx prisma db push
```
(Ojo: `DEPLOY_WINDOWS.bat` detecta PostgreSQL local automáticamente en el puerto 5432 y crea las tablas por ti.)

---

## 5. Variables de entorno (PowerShell)

```powershell
# Solo para esta sesión (se pierden al cerrar la ventana):
$env:DATABASE_URL = "postgresql://..."
$env:AUTH_SECRET  = "una-cadena-larga-y-aleatoria"

# Permanentes para tu usuario:
[System.Environment]::SetEnvironmentVariable("DATABASE_URL", "postgresql://...", "User")
[System.Environment]::SetEnvironmentVariable("AUTH_SECRET", "una-cadena-larga-y-aleatoria", "User")
```

La plantilla completa con explicación está en `.env.example`.
**NUNCA subas tu `.env` real a GitHub** — el `.gitignore` del proyecto ya lo
excluye, no lo quites de ahí.

---

## 6. Subir el proyecto a GitHub + Vercel (resumen)

Los pasos click a click están en el **LEEME-SINCRONIZACION-COMPLETA.txt**
(sección "LISTO PARA GITHUB Y VERCEL", incluido en cada entrega). Resumen:

```powershell
git init
git add .
git commit -m "Sincronizacion completa v9"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/knightfm.git
git push -u origin main      # la 1ª vez Git abre el navegador para iniciar sesión
```

En **vercel.com** → Sign up con GitHub → Add New → Project → Import "knightfm"
→ añade las variables de entorno (mínimo `DATABASE_URL`, `AUTH_SECRET`,
`NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`) → **Deploy**.

---

## 7. Notas para Windows

- **Rutas largas (>260 caracteres):** usa una raíz corta y sin espacios como `D:\Programacion\knightfm` (la recomendada). Evita carpetas sincronizadas con OneDrive.
- **Fin de línea:** el proyecto fuerza LF en código y **CRLF en `.ps1`/`.bat`** vía `.gitattributes` — no cambies estos ajustes.
- **Antivirus:** si bloquea scripts o instala lento, añade la carpeta del proyecto a exclusiones.
- **Verificación de la entrega:** tras copiar un zip nuevo, doble clic en `VERIFICAR-INSTALACION.bat` y espera `RESULTADO: TU PROYECTO ESTA COMPLETO`.
- **Backups automáticos del proyecto:** ver `BACKUP_LOG.md` y `CHANGELOG.md`
  (raíz del proyecto) y los informes en `docs/reports/`.

---

## 8. ¿Tu `.env` antiguo apunta a SQLite (`DATABASE_URL=file:`)?

Es normal si venías de una copia anterior a v5. Esta versión usa PostgreSQL:

1. Tu base de datos vieja **no se borra**: sigue en `db/custom.db`.
2. Renombra tu `.env` a `.env.sqlite-backup` (lo conservas todo).
3. Doble clic en `DEPLOY_WINDOWS.bat`: te crea un `.env` nuevo desde
   `.env.example` y te avisa de los siguientes pasos.
4. Cuando quieras jugar con datos: crea tu PostgreSQL gratis en
   [neon.tech](https://neon.tech) (sección 4, Opción A) y pega su cadena en
   tu `.env`.
