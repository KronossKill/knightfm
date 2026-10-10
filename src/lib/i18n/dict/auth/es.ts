import type { Dict } from "../../index";

// Knight FM — auth namespace (Spanish, primary language; spec §33).
export const dict: Dict = {
  // Panel chrome
  "auth.panelTitle": "Acceso al mundo persistente",
  "auth.panelSubtitle": "Un mundo que nunca se detiene. Elige tu camino.",
  "auth.langLabel": "Idioma",
  "auth.themeLabel": "Tema",
  "auth.theme.knight-emerald": "Esmeralda",
  "auth.theme.obsidian": "Obsidiana",
  "auth.theme.royal": "Real",
  "auth.theme.aurora": "Aurora",
  "auth.theme.classic": "Clásico",

  // Tabs
  "auth.tab.login": "Iniciar sesión",
  "auth.tab.register": "Crear cuenta",

  // Login
  "auth.login.title": "Bienvenido de nuevo",
  "auth.login.desc": "Entra con tu correo y contraseña para continuar tu historia.",
  "auth.action.login": "Entrar",

  // Register
  "auth.register.title": "Únete a Knight FM",
  "auth.register.desc": "Crea tu cuenta para elegir tu camino: mánager o propietario.",
  "auth.action.register": "Crear cuenta",

  // Fields
  "auth.field.email": "Correo electrónico",
  "auth.field.username": "Nombre de usuario",
  "auth.field.password": "Contraseña",
  "auth.field.referral": "Código de referido",
  "auth.field.code": "Código de verificación",
  "auth.field.token": "Token de recuperación",
  "auth.field.newPassword": "Nueva contraseña",
  "auth.placeholder.email": "tu@correo.com",
  "auth.placeholder.username": "TuSeudonimo",
  "auth.placeholder.password": "Mínimo 12 caracteres",
  "auth.placeholder.referral": "Usuario que te invitó (opcional)",
  "auth.placeholder.code": "6 dígitos",
  "auth.placeholder.token": "Pega el token recibido",

  // Password policy checklist
  "auth.policy.title": "Tu contraseña debe contener:",
  "auth.policy.length": "Al menos 12 caracteres",
  "auth.policy.upper": "Una letra mayúscula",
  "auth.policy.lower": "Una letra minúscula",
  "auth.policy.digit": "Un número",
  "auth.policy.symbol": "Un símbolo (por ejemplo ! ? #)",

  // Verify email
  "auth.verify.title": "Verifica tu correo",
  "auth.verify.desc": "Enviamos un código de 6 dígitos a {email}. Introdúcelo para activar tu cuenta.",
  "auth.verify.hint": "Entorno de pruebas: el código solo se escribe en los registros del servidor (dev.log). Nadie te lo pedirá por chat.",
  "auth.verify.codeSent": "Código enviado",
  "auth.verify.devBanner": "El envío de correo no está configurado en este entorno (modo consola). Tu código de verificación es: {code}",
  "auth.action.verify": "Verificar cuenta",
  "auth.action.resend": "Reenviar código",
  "auth.action.resending": "Reenviando…",

  // Forgot / reset
  "auth.forgot.title": "Recuperar contraseña",
  "auth.forgot.desc": "Introduce el correo de tu cuenta para generar un token de recuperación.",
  "auth.action.forgot": "Enviar token",
  "auth.forgot.hint": "Entorno de pruebas: no hay proveedor de correo configurado, no se envía ningún email. Si el correo pertenece a una cuenta, el token aparecerá automáticamente en la pantalla siguiente.",
  "auth.reset.noTokenConsole": "Modo prueba: no hay proveedor de correo configurado. Si el correo pertenece a una cuenta registrada, el token se mostraría arriba; si no aparece ningún token, revisa que hayas escrito exactamente el correo de tu registro.",
  "auth.reset.title": "Nueva contraseña",
  "auth.reset.desc": "Pega el token recibido y elige una nueva contraseña segura.",
  "auth.reset.devBanner": "El envío de correo no está configurado en este entorno (modo consola). Tu token de recuperación es: {token}",
  "auth.action.reset": "Guardar contraseña",
  "auth.ok.resetDone": "Contraseña actualizada. Ya puedes iniciar sesión.",

  // Referral
  "auth.referral.note": "Si tu código es válido, tú y quien te invitó recibiréis un bono al verificar tu correo.",

  // Actions / feedback
  "auth.action.backToLogin": "Volver a iniciar sesión",
  "auth.action.working": "Un momento…",
  "auth.ok.registered": "Cuenta creada. Revisa tu correo para verificarla.",
  "auth.ok.verified": "Correo verificado. Accediendo…",
  "auth.ok.codeSent": "Si el correo está registrado, se ha enviado un código nuevo.",
  "auth.ok.resetSent": "Si el correo está registrado, se ha enviado un token de recuperación.",
  "auth.ok.resetSentConsole": "Solicitud procesada. Modo prueba (sin envío de correo): si el correo pertenece a una cuenta, el token aparecerá en la pantalla siguiente.",
  "auth.ok.loggedIn": "Sesión iniciada",
  "auth.ok.loggedOut": "Sesión cerrada",
  "auth.welcome.back": "De nuevo dentro, {name}",

  // Errors (mapped by error.code from the API)
  "auth.err.captcha": "Verificación anti-bot fallida. Recarga e inténtalo de nuevo.",
  "auth.err.captchaUnavailable": "El captcha no se pudo cargar. Comprueba tu conexión, desactiva bloqueadores de anuncios para esta web y reintenta.",
  "auth.err.conflict": "Credenciales no válidas o cuenta ya registrada.",
  "auth.err.invalidCredentials": "Credenciales no válidas.",
  "auth.err.emailNotVerified": "Tu correo aún no está verificado. Revisa tu bandeja.",
  "auth.err.locked": "Demasiados intentos. Espera {secs} segundos.",
  "auth.err.rateLimited": "Demasiadas peticiones. Espera {secs} segundos.",
  "auth.err.policy": "La contraseña no cumple los requisitos.",
  "auth.err.tokenInvalid": "Token no válido, caducado o ya utilizado.",
  "auth.err.usernameShort": "El nombre de usuario debe tener entre 3 y 24 caracteres.",
  "auth.err.usernameChars": "Usa letras, números, guiones o guiones bajos.",
  "auth.err.emailInvalid": "Introduce un correo válido.",
  "auth.err.passwordShort": "La contraseña debe tener al menos 12 caracteres.",
  "auth.err.passwordUpper": "Añade al menos una letra mayúscula.",
  "auth.err.passwordLower": "Añade al menos una letra minúscula.",
  "auth.err.passwordDigit": "Añade al menos un número.",
  "auth.err.passwordSymbol": "Añade al menos un símbolo.",
  "auth.err.generic": "No se pudo completar la operación. Inténtalo de nuevo.",
  // Task 39 — anti-multicuentas: una sola cuenta por IP.
  "auth.err.multiAccount": "Solo se permite una cuenta por IP: no se admiten multicuentas.",

  // Task 41 — cuenta bloqueada (multicuenta por IP en 30 días / administración).
  "auth.err.accountBlocked": "Tu cuenta está bloqueada. Solo un administrador puede desbloquearla.",
  "auth.err.multiAccountIp": "Hemos detectado varias cuentas desde tu conexión en los últimos 30 días. Las cuentas implicadas han sido bloqueadas y solo un administrador puede desbloquearlas.",
};
