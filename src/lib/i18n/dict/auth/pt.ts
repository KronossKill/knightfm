import type { Dict } from "../../index";

// Knight FM — auth namespace (Portuguese).
export const dict: Dict = {
  // Panel chrome
  "auth.panelTitle": "Acesse o mundo persistente",
  "auth.panelSubtitle": "Um mundo que nunca para. Escolha o seu caminho.",
  "auth.langLabel": "Idioma",
  "auth.themeLabel": "Tema",
  "auth.theme.knight-emerald": "Esmeralda",
  "auth.theme.obsidian": "Obsidiana",
  "auth.theme.royal": "Real",
  "auth.theme.aurora": "Aurora",
  "auth.theme.classic": "Clássico",

  // Tabs
  "auth.tab.login": "Entrar",
  "auth.tab.register": "Criar conta",

  // Login
  "auth.login.title": "Bem-vindo de volta",
  "auth.login.desc": "Entre com seu e-mail e senha para continuar a sua história.",
  "auth.action.login": "Entrar",

  // Register
  "auth.register.title": "Junte-se ao Knight FM",
  "auth.register.desc": "Crie sua conta para escolher seu caminho: treinador ou proprietário.",
  "auth.action.register": "Criar conta",

  // Fields
  "auth.field.email": "Endereço de e-mail",
  "auth.field.username": "Nome de usuário",
  "auth.field.password": "Senha",
  "auth.field.referral": "Código de convite",
  "auth.field.code": "Código de verificação",
  "auth.field.token": "Token de recuperação",
  "auth.field.newPassword": "Nova senha",
  "auth.placeholder.email": "voce@email.com",
  "auth.placeholder.username": "SeuApelido",
  "auth.placeholder.password": "Mínimo 12 caracteres",
  "auth.placeholder.referral": "Usuário que convidou você (opcional)",
  "auth.placeholder.code": "6 dígitos",
  "auth.placeholder.token": "Cole o token recebido",

  // Password policy checklist
  "auth.policy.title": "Sua senha deve conter:",
  "auth.policy.length": "Pelo menos 12 caracteres",
  "auth.policy.upper": "Uma letra maiúscula",
  "auth.policy.lower": "Uma letra minúscula",
  "auth.policy.digit": "Um número",
  "auth.policy.symbol": "Um símbolo (por ex. ! ? #)",

  // Verify email
  "auth.verify.title": "Verifique seu e-mail",
  "auth.verify.desc": "Enviamos um código de 6 dígitos para {email}. Digite-o para ativar sua conta.",
  "auth.verify.hint": "Ambiente de testes: o código é gravado apenas nos registros do servidor (dev.log). Ninguém vai pedi-lo no chat.",
  "auth.verify.codeSent": "Código enviado",
  "auth.verify.devBanner": "O envio de e-mail não está configurado neste ambiente (modo console). Seu código de verificação é: {code}",
  "auth.action.verify": "Verificar conta",
  "auth.action.resend": "Reenviar código",
  "auth.action.resending": "Reenviando…",

  // Forgot / reset
  "auth.forgot.title": "Recuperar senha",
  "auth.forgot.desc": "Introduza o e-mail da sua conta para gerar um token de recuperação.",
  "auth.action.forgot": "Enviar token",
  "auth.forgot.hint": "Ambiente de testes: nenhum provedor de e-mail está configurado, nada é enviado por e-mail. Se o e-mail pertencer a uma conta, o token aparecerá automaticamente na tela seguinte.",
  "auth.reset.noTokenConsole": "Modo teste: nenhum provedor de e-mail está configurado. Se o e-mail pertencer a uma conta registrada, o token apareceria acima; se nenhum token aparecer, verifique se digitou exatamente o e-mail do seu registro.",
  "auth.reset.title": "Nova senha",
  "auth.reset.desc": "Cole o token recebido e escolha uma nova senha forte.",
  "auth.reset.devBanner": "O envio de e-mail não está configurado neste ambiente (modo console). Seu token de recuperação é: {token}",
  "auth.action.reset": "Salvar senha",
  "auth.ok.resetDone": "Senha atualizada. Você já pode entrar.",

  // Referral
  "auth.referral.note": "Se o seu código for válido, você e quem convidou receberão um bônus quando você verificar seu e-mail.",

  // Actions / feedback
  "auth.action.backToLogin": "Voltar ao login",
  "auth.action.working": "Um momento…",
  "auth.ok.registered": "Conta criada. Verifique seu e-mail para ativá-la.",
  "auth.ok.verified": "E-mail verificado. Entrando…",
  "auth.ok.codeSent": "Se o e-mail estiver registrado, um novo código foi enviado.",
  "auth.ok.resetSent": "Se o e-mail estiver registrado, um token de recuperação foi enviado.",
  "auth.ok.resetSentConsole": "Solicitação processada. Modo teste (sem envio de e-mail): se o e-mail pertencer a uma conta, o token aparecerá na tela seguinte.",
  "auth.ok.loggedIn": "Sessão iniciada",
  "auth.ok.loggedOut": "Sessão encerrada",
  "auth.welcome.back": "De volta, {name}",

  // Errors (mapped by error.code from the API)
  "auth.err.captcha": "Falha na verificação anti-bot. Recarregue e tente novamente.",
  "auth.err.captchaUnavailable": "O captcha não pôde ser carregado. Verifique sua conexão, desative bloqueadores de anúncios para este site e tente novamente.",
  "auth.err.conflict": "Credenciais inválidas ou conta já registrada.",
  "auth.err.invalidCredentials": "Credenciais inválidas.",
  "auth.err.emailNotVerified": "Seu e-mail ainda não foi verificado. Confira sua caixa de entrada.",
  "auth.err.locked": "Muitas tentativas. Aguarde {secs} segundos.",
  "auth.err.rateLimited": "Muitas requisições. Aguarde {secs} segundos.",
  "auth.err.policy": "A senha não cumpre os requisitos.",
  "auth.err.tokenInvalid": "Token inválido, expirado ou já utilizado.",
  "auth.err.usernameShort": "O nome de usuário deve ter entre 3 e 24 caracteres.",
  "auth.err.usernameChars": "Use letras, números, hífens ou sublinhados.",
  "auth.err.emailInvalid": "Digite um e-mail válido.",
  "auth.err.passwordShort": "A senha deve ter pelo menos 12 caracteres.",
  "auth.err.passwordUpper": "Adicione pelo menos uma letra maiúscula.",
  "auth.err.passwordLower": "Adicione pelo menos uma letra minúscula.",
  "auth.err.passwordDigit": "Adicione pelo menos um número.",
  "auth.err.passwordSymbol": "Adicione pelo menos um símbolo.",
  "auth.err.generic": "Não foi possível concluir a operação. Tente novamente.",
  // Task 39 — antimulticontas: apenas uma conta por IP.
  "auth.err.multiAccount": "É permitida apenas uma conta por IP: não são admitidas multicontas.",

  // Task 41 — conta bloqueada (multicontas no mesmo IP em 30 dias / administrativo).
  "auth.err.accountBlocked": "A sua conta está bloqueada. Apenas um administrador a pode desbloquear.",
  "auth.err.multiAccountIp": "Foram detetadas várias contas a partir da sua ligação nos últimos 30 dias. As contas envolvidas foram bloqueadas; apenas um administrador as pode desbloquear.",
};
