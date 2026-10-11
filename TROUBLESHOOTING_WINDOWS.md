# Knight FM — RESOLUCIÓN DE PROBLEMAS EN WINDOWS

Índice rápido: busca tu error con Ctrl+F en esta página.
Si nada de esto lo arregla: captura de pantalla del error exacto y del
`VERIFICAR-INSTALACION.bat` → se corrige a la primera con esas dos imágenes.

---

## 1. "no se carga el archivo ... porque la ejecución de scripts está deshabilitada"

PowerShell bloquea scripts por política por defecto.

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Responde `S` (Sí). Alternativa sin cambiar políticas: usa siempre
`DEPLOY_WINDOWS.bat` (doble clic), que ejecuta PowerShell con
`-ExecutionPolicy Bypass` solo para esa ejecución.

---

## 2. "node no se reconoce como un comando..."

Node.js no está instalado o la ventana es anterior a la instalación.

1. `winget install OpenJS.NodeJS.LTS`
2. **Cierra y reabre** la ventana de PowerShell.
3. `node --version` → DEBES VER `v20.x` o superior.

Si persiste, cierra sesión en Windows y vuelve a entrar (actualiza el PATH).

---

## 3. El puerto 3000 está ocupado ("EADDRINUSE", "port 3000 is in use")

```powershell
netstat -ano | findstr :3000
Stop-Process -Id <PID-DE-LA-ÚLTIMA-COLUMNA> -Force
```

O simplemente reinicia el equipo. Después `npm run dev` de nuevo.

---

## 4. npm install falla o se queda colgado

```powershell
npm cache clean --force
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue   # SOLO si insistes; se regenera
npm install
```

Si tu antivirus ralentiza la instalación: añade la carpeta del proyecto a
exclusiones. Si la red corporativa/proxy bloquea: prueba desde otra red.

---

## 5. Error con rutas largas ("path too long", "la ruta especificada es demasiado larga")

Windows limita las rutas a 260 caracteres.

- **Solución simple (recomendada):** mueve el proyecto a una raíz corta,
  p. ej. `D:\Programacion\knightfm` (sin espacios, sin OneDrive).
- Solución permanente (Windows Pro): `gpedit.msc` → Configuración del equipo →
  Plantillas administrativas → Sistema → Sistema de archivos →
  **Habilitar rutas largas de Win32**.
- Solución por registro (todas las ediciones):
  ```powershell
  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
  ```
  (reiniciar Windows después).

---

## 6. VERIFICAR-INSTALACION.bat muestra "FALTAN: n" o "TAMANO DISTINTO: n"

Falta o sobrescribe algo de la entrega:

1. Vuelve a descargar el zip `knightfm-sincronizacion-completa.zip` (el "MÁS RECIENTE" del panel de descargas).
2. Extrae TODO, `Ctrl+A`, copiar, pegar sobre `D:\Programacion\knightfm` y pulsa **"Reemplazar los archivos en destino"**.
3. Doble clic en `VERIFICAR-INSTALACION.bat` otra vez.
4. Los amarillos **EXTRA** son archivos tuyos anteriores: **no molestan, ignóralos**.

Si sale un error rojo de PowerShell (fallo v5/v6 ya corregido en v7): envíame
captura — con el verificador 100% ASCII no debería ocurrir.

---

## 7. "npm ERR! ... gyp" o errores de compilación nativa

Knight FM no necesita compilar módulos nativos en Windows: usa los binarios
preconstruidos. Si ves errores `node-gyp`:

1. `npm cache clean --force` + borrar `node_modules` + `npm install` otra vez.
2. Asegura Node 20 LTS (no versiones de pruebas/next).

---

## 8. El sitio arranca pero las páginas del juego dan error

Normal si no hay base de datos configurada (la web se ve, el juego pide DB):

- Opción rápida y gratis: **neon.tech** (ver WINDOWS_SETUP.md §4, Opción A).
- O PostgreSQL local (`winget install PostgreSQL.PostgreSQL.16`) + `npx prisma db push`.
- Recuerda pegar la cadena en `.env` → `DATABASE_URL="postgresql://..."` y
  **reiniciar** `npm run dev` después de editar `.env`.
- Si tu `.env` ANTIGUO apunta a SQLite (`DATABASE_URL=file:`): renómbralo a
  `.env.sqlite-backup` y usa una cadena `postgresql://` (WINDOWS_SETUP.md §8).
  Tu `db/custom.db` **no se borra** nunca.

---

## 9. Docker Desktop (opcional)

- Instalar: `winget install Docker.DockerDesktop` (usa backend WSL2).
- Si no arranca: `wsl --update` y reiniciar Docker Desktop.
- Alternativa sin Docker en Knight FM: no necesitas Docker para nada —
  `npm run dev` (local) o Vercel (nube) cubren los dos escenarios.

---

## 10. Git: autenticación o push rechazado

- La 1ª vez, `git push` abre el navegador para iniciar sesión en GitHub — complétalo.
- "remote origin already exists": `git remote set-url origin https://github.com/TU-USUARIO/knightfm.git`
- Antes de subir, comprueba que NO sube tu `.env`:
  ```powershell
  git status
  ```
  `.env` **no debe aparecer** en la lista (el `.gitignore` lo excluye).
- Si apareciera: NO hagas push; escribe `git rm --cached .env` y avísame.

---

## 11. "npm start" / build de producción en local

No lo uses en local (el flujo del proyecto es `npm run dev` en local y
Vercel para producción). El `package.json` entregado trae `build: next build`
pensado para Vercel. Si quieres self-hosting, pídemelo y lo documentamos.
