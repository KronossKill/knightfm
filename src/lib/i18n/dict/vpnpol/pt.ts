// Knight FM — VPN policy / exceptions labels (PT, Task 25-d).

export const dict: Record<string, string> = {
  "vpnpol.card.title": "Exceções VPN / proxy",
  "vpnpol.card.desc":
    "Lista de permissões sobre a política de VPN: os IPs exatos ou intervalos CIDR adicionados aqui nunca são bloqueados, mesmo que o detector os sinalize. A regra também vale para registro e login.",

  "vpnpol.ipLabel": "IP ou intervalo (CIDR)",
  "vpnpol.ipPlaceholder": "203.0.113.7 · 198.51.100.0/24 · 2001:db8::10",
  "vpnpol.noteLabel": "Nota (opcional)",
  "vpnpol.notePlaceholder": "Motivo ou ticket (máx. 140)",
  "vpnpol.add": "Adicionar exceção",
  "vpnpol.adding": "Salvando…",
  "vpnpol.remove": "Remover",

  "vpnpol.empty": "Nenhuma exceção registrada. Com a política de bloqueio, qualquer IP sinalizado pelo detector será recusado.",
  "vpnpol.count": "{n} exceção/ões",

  "vpnpol.policy": "Política atual",
  "vpnpol.policyLogOnly": "Apenas registrar (log_only)",
  "vpnpol.policyBlock": "Bloquear (block)",
  "vpnpol.detectUrl": "Detector",
  "vpnpol.detectNone": "Sem detector configurado (nunca bloqueia sem evidência)",

  "vpnpol.blockedHint":
    "As exceções apenas isentam da política de VPN. Salvar um valor existente apenas substitui a nota (mesmo valor = mesma linha).",

  "vpnpol.errorInvalidIp": "Introduza um IPv4/IPv6 exato ou um CIDR IPv4 válido (a.b.c.d/0-32).",
  "vpnpol.errorForbidden": "Apenas um administrador pode gerir as exceções de VPN.",
  "vpnpol.errorGeneric": "Não foi possível concluir a operação.",

  "vpnpol.loadError": "Não foi possível carregar a lista de exceções.",
  "vpnpol.added": "Exceção salva: {value}",
  "vpnpol.removed": "Exceção removida: {value}",

  "vpnpol.confirmRemove": "Remover a exceção {value}?",
  "vpnpol.confirmRemoveDesc":
    "Os endereços deste IP ou intervalo voltarão a ficar sujeitos à política de VPN imediatamente.",
  "vpnpol.confirmRemoveAction": "Remover exceção",
};
