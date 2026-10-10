import type { Dict } from "../../index";

// Knight FM — auth namespace (French).
export const dict: Dict = {
  // Panel chrome
  "auth.panelTitle": "Accédez au monde persistant",
  "auth.panelSubtitle": "Un monde qui ne s'arrête jamais. Choisissez votre voie.",
  "auth.langLabel": "Langue",
  "auth.themeLabel": "Thème",
  "auth.theme.knight-emerald": "Émeraude",
  "auth.theme.obsidian": "Obsidienne",
  "auth.theme.royal": "Royal",
  "auth.theme.aurora": "Aurore",
  "auth.theme.classic": "Classique",

  // Tabs
  "auth.tab.login": "Se connecter",
  "auth.tab.register": "Créer un compte",

  // Login
  "auth.login.title": "Bon retour",
  "auth.login.desc": "Connectez-vous avec votre e-mail et votre mot de passe pour continuer votre histoire.",
  "auth.action.login": "Se connecter",

  // Register
  "auth.register.title": "Rejoignez Knight FM",
  "auth.register.desc": "Créez votre compte pour choisir votre voie : manager ou propriétaire.",
  "auth.action.register": "Créer un compte",

  // Fields
  "auth.field.email": "Adresse e-mail",
  "auth.field.username": "Nom d'utilisateur",
  "auth.field.password": "Mot de passe",
  "auth.field.referral": "Code de parrainage",
  "auth.field.code": "Code de vérification",
  "auth.field.token": "Jeton de récupération",
  "auth.field.newPassword": "Nouveau mot de passe",
  "auth.placeholder.email": "vous@email.com",
  "auth.placeholder.username": "VotrePseudo",
  "auth.placeholder.password": "12 caractères minimum",
  "auth.placeholder.referral": "Utilisateur qui vous a invité (facultatif)",
  "auth.placeholder.code": "6 chiffres",
  "auth.placeholder.token": "Collez le jeton reçu",

  // Password policy checklist
  "auth.policy.title": "Votre mot de passe doit contenir :",
  "auth.policy.length": "Au moins 12 caractères",
  "auth.policy.upper": "Une lettre majuscule",
  "auth.policy.lower": "Une lettre minuscule",
  "auth.policy.digit": "Un chiffre",
  "auth.policy.symbol": "Un symbole (par ex. ! ? #)",

  // Verify email
  "auth.verify.title": "Vérifiez votre e-mail",
  "auth.verify.desc": "Nous avons envoyé un code à 6 chiffres à {email}. Saisissez-le pour activer votre compte.",
  "auth.verify.hint": "Environnement de test : le code n'apparaît que dans les journaux du serveur (dev.log). Personne ne vous le demandera dans le tchat.",
  "auth.verify.codeSent": "Code envoyé",
  "auth.verify.devBanner": "L'envoi d'e-mails n'est pas configuré dans cet environnement (mode console). Votre code de vérification est : {code}",
  "auth.action.verify": "Vérifier le compte",
  "auth.action.resend": "Renvoyer le code",
  "auth.action.resending": "Renvoi…",

  // Forgot / reset
  "auth.forgot.title": "Récupérer votre mot de passe",
  "auth.forgot.desc": "Saisissez l'e-mail de votre compte pour générer un jeton de récupération.",
  "auth.action.forgot": "Envoyer le jeton",
  "auth.forgot.hint": "Environnement de test : aucun fournisseur d'e-mail n'est configuré, rien n'est envoyé par e-mail. Si l'e-mail appartient à un compte, le jeton apparaîtra automatiquement sur l'écran suivant.",
  "auth.reset.noTokenConsole": "Mode test : aucun fournisseur d'e-mail n'est configuré. Si l'e-mail appartient à un compte enregistré, le jeton s'afficherait ci-dessus ; si aucun jeton n'apparaît, vérifiez que vous avez saisi exactement l'e-mail de votre inscription.",
  "auth.reset.title": "Nouveau mot de passe",
  "auth.reset.desc": "Collez le jeton reçu et choisissez un nouveau mot de passe solide.",
  "auth.reset.devBanner": "L'envoi d'e-mails n'est pas configuré dans cet environnement (mode console). Votre jeton de récupération est : {token}",
  "auth.action.reset": "Enregistrer le mot de passe",
  "auth.ok.resetDone": "Mot de passe mis à jour. Vous pouvez vous connecter.",

  // Referral
  "auth.referral.note": "Si votre code est valide, vous et la personne qui vous a invité recevrez un bonus dès la vérification de votre e-mail.",

  // Actions / feedback
  "auth.action.backToLogin": "Retour à la connexion",
  "auth.action.working": "Un instant…",
  "auth.ok.registered": "Compte créé. Consultez votre e-mail pour le vérifier.",
  "auth.ok.verified": "E-mail vérifié. Connexion en cours…",
  "auth.ok.codeSent": "Si l'e-mail est enregistré, un nouveau code a été envoyé.",
  "auth.ok.resetSent": "Si l'e-mail est enregistré, un jeton de récupération a été envoyé.",
  "auth.ok.resetSentConsole": "Demande traitée. Mode test (sans envoi d'e-mail) : si l'e-mail appartient à un compte, le jeton apparaîtra sur l'écran suivant.",
  "auth.ok.loggedIn": "Connecté",
  "auth.ok.loggedOut": "Déconnecté",
  "auth.welcome.back": "De retour, {name}",

  // Errors (mapped by error.code from the API)
  "auth.err.captcha": "Échec de la vérification anti-robot. Rechargez et réessayez.",
  "auth.err.captchaUnavailable": "Le captcha n'a pas pu se charger. Vérifiez votre connexion, désactivez les bloqueurs de publicités pour ce site puis réessayez.",
  "auth.err.conflict": "Identifiants invalides ou compte déjà enregistré.",
  "auth.err.invalidCredentials": "Identifiants invalides.",
  "auth.err.emailNotVerified": "Votre e-mail n'est pas encore vérifié. Consultez votre boîte de réception.",
  "auth.err.locked": "Trop de tentatives. Attendez {secs} secondes.",
  "auth.err.rateLimited": "Trop de requêtes. Attendez {secs} secondes.",
  "auth.err.policy": "Le mot de passe ne répond pas aux exigences.",
  "auth.err.tokenInvalid": "Jeton invalide, expiré ou déjà utilisé.",
  "auth.err.usernameShort": "Le nom d'utilisateur doit comporter entre 3 et 24 caractères.",
  "auth.err.usernameChars": "Utilisez des lettres, des chiffres, des tirets ou des traits de soulignement.",
  "auth.err.emailInvalid": "Saisissez une adresse e-mail valide.",
  "auth.err.passwordShort": "Le mot de passe doit comporter au moins 12 caractères.",
  "auth.err.passwordUpper": "Ajoutez au moins une lettre majuscule.",
  "auth.err.passwordLower": "Ajoutez au moins une lettre minuscule.",
  "auth.err.passwordDigit": "Ajoutez au moins un chiffre.",
  "auth.err.passwordSymbol": "Ajoutez au moins un symbole.",
  "auth.err.generic": "Impossible de terminer l'opération. Veuillez réessayer.",
  // Task 39 — anti-multi-comptes : un seul compte par IP.
  "auth.err.multiAccount": "Un seul compte par IP est autorisé : les multi-comptes ne sont pas admis.",

  // Task 41 — compte bloqué (multi-comptes même IP sous 30 jours / administratif).
  "auth.err.accountBlocked": "Votre compte est bloqué. Seul un administrateur peut le débloquer.",
  "auth.err.multiAccountIp": "Plusieurs comptes ont été détectés depuis votre connexion au cours des 30 derniers jours. Les comptes concernés ont été bloqués ; seul un administrateur peut les débloquer.",
};
