import type { Dict } from "../../index";

// Knight FM — auth namespace (English).
export const dict: Dict = {
  // Panel chrome
  "auth.panelTitle": "Access the persistent world",
  "auth.panelSubtitle": "A world that never stops. Choose your path.",
  "auth.langLabel": "Language",
  "auth.themeLabel": "Theme",
  "auth.theme.onyx": "Onyx",
  "auth.theme.knight-emerald": "Knight Emerald",
  "auth.theme.obsidian": "Obsidian",
  "auth.theme.royal": "Royal",
  "auth.theme.aurora": "Aurora",
  "auth.theme.classic": "Classic",

  // Tabs
  "auth.tab.login": "Sign in",
  "auth.tab.register": "Create account",

  // Login
  "auth.login.title": "Welcome back",
  "auth.login.desc": "Sign in with your email and password to continue your story.",
  "auth.action.login": "Sign in",

  // Register
  "auth.register.title": "Join Knight FM",
  "auth.register.desc": "Create your account to choose your path: manager or owner.",
  "auth.action.register": "Create account",

  // Fields
  "auth.field.email": "Email address",
  "auth.field.username": "Username",
  "auth.field.password": "Password",
  "auth.field.referral": "Referral code",
  "auth.field.code": "Verification code",
  "auth.field.token": "Recovery token",
  "auth.field.newPassword": "New password",
  "auth.placeholder.email": "you@email.com",
  "auth.placeholder.username": "YourHandle",
  "auth.placeholder.password": "At least 12 characters",
  "auth.placeholder.referral": "User who invited you (optional)",
  "auth.placeholder.code": "6 digits",
  "auth.placeholder.token": "Paste the received token",

  // Password policy checklist
  "auth.policy.title": "Your password must contain:",
  "auth.policy.length": "At least 12 characters",
  "auth.policy.upper": "One uppercase letter",
  "auth.policy.lower": "One lowercase letter",
  "auth.policy.digit": "One number",
  "auth.policy.symbol": "One symbol (e.g. ! ? #)",

  // Verify email
  "auth.verify.title": "Verify your email",
  "auth.verify.desc": "We sent a 6-digit code to {email}. Enter it to activate your account.",
  "auth.verify.hint": "Test environment: the code is only written to the server logs (dev.log). Nobody will ask for it in chat.",
  "auth.verify.codeSent": "Code sent",
  "auth.verify.devBanner": "Email delivery is not configured in this environment (console mode). Your verification code is: {code}",
  "auth.action.verify": "Verify account",
  "auth.action.resend": "Resend code",
  "auth.action.resending": "Resending…",

  // Forgot / reset
  "auth.forgot.title": "Recover your password",
  "auth.forgot.desc": "Enter your account's email to generate a recovery token.",
  "auth.action.forgot": "Send token",
  "auth.forgot.hint": "Test environment: no email provider is configured, nothing is emailed. If the email belongs to an account, the token will appear automatically on the next screen.",
  "auth.reset.noTokenConsole": "Test mode: no email provider is configured. If the email belongs to a registered account, the token would be shown above; if no token appears, double-check you entered the exact email you registered with.",
  "auth.reset.title": "New password",
  "auth.reset.desc": "Paste the received token and choose a new strong password.",
  "auth.reset.devBanner": "Email delivery is not configured in this environment (console mode). Your recovery token is: {token}",
  "auth.action.reset": "Save password",
  "auth.ok.resetDone": "Password updated. You can now sign in.",

  // Referral
  "auth.referral.note": "If your code is valid, you and the inviter will receive a bonus once you verify your email.",

  // Actions / feedback
  "auth.action.backToLogin": "Back to sign in",
  "auth.action.working": "One moment…",
  "auth.ok.registered": "Account created. Check your email to verify it.",
  "auth.ok.verified": "Email verified. Signing you in…",
  "auth.ok.codeSent": "If the email is registered, a new code has been sent.",
  "auth.ok.resetSent": "If the email is registered, a recovery token has been sent.",
  "auth.ok.resetSentConsole": "Request processed. Test mode (no email delivery): if the email belongs to an account, the token will appear on the next screen.",
  "auth.ok.loggedIn": "Signed in",
  "auth.ok.loggedOut": "Signed out",
  "auth.welcome.back": "Back inside, {name}",

  // Errors (mapped by error.code from the API)
  "auth.err.captcha": "Anti-bot verification failed. Reload and try again.",
  "auth.err.conflict": "Invalid credentials or account already registered.",
  "auth.err.invalidCredentials": "Invalid credentials.",
  "auth.err.emailNotVerified": "Your email is not verified yet. Check your inbox.",
  "auth.err.locked": "Too many attempts. Wait {secs} seconds.",
  "auth.err.rateLimited": "Too many requests. Wait {secs} seconds.",
  "auth.err.policy": "The password does not meet the requirements.",
  "auth.err.tokenInvalid": "Invalid, expired or already-used token.",
  "auth.err.usernameShort": "The username must be between 3 and 24 characters.",
  "auth.err.usernameChars": "Use letters, numbers, hyphens or underscores.",
  "auth.err.emailInvalid": "Enter a valid email.",
  "auth.err.passwordShort": "The password must be at least 12 characters long.",
  "auth.err.passwordUpper": "Add at least one uppercase letter.",
  "auth.err.passwordLower": "Add at least one lowercase letter.",
  "auth.err.passwordDigit": "Add at least one number.",
  "auth.err.passwordSymbol": "Add at least one symbol.",
  "auth.err.generic": "The operation could not be completed. Please try again.",
  // Task 39 — anti-multi-account: exactly one account per IP.
  "auth.err.multiAccount": "Only one account per IP is allowed: multi-accounting is not permitted.",

  // Task 41 — blocked account (30-day same-IP multi-account / administrative).
  "auth.err.accountBlocked": "Your account is blocked. Only an administrator can unblock it.",
  "auth.err.multiAccountIp": "Multiple accounts were detected from your connection within the last 30 days. The accounts involved have been blocked; only an administrator can unblock them.",
};
