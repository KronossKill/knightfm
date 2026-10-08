// Knight FM — VPN policy / exceptions labels (ES primary, Task 25-d).

export const dict: Record<string, string> = {
  "vpnpol.card.title": "Excepciones VPN / proxy",
  "vpnpol.card.desc":
    "Lista de permitidos sobre la política VPN: las IPs exactas o los rangos CIDR que añadas aquí nunca se bloquean, aunque el detector los marque. También se aplican a registro e inicio de sesión.",

  "vpnpol.ipLabel": "IP o rango (CIDR)",
  "vpnpol.ipPlaceholder": "203.0.113.7 · 198.51.100.0/24 · 2001:db8::10",
  "vpnpol.noteLabel": "Nota (opcional)",
  "vpnpol.notePlaceholder": "Motivo o ticket (máx. 140)",
  "vpnpol.add": "Añadir excepción",
  "vpnpol.adding": "Guardando…",
  "vpnpol.remove": "Quitar",

  "vpnpol.empty": "Sin excepciones registradas. Con la política en bloqueo, cualquier IP marcada por el detector será rechazada.",
  "vpnpol.count": "{n} excepción/es",

  "vpnpol.policy": "Política actual",
  "vpnpol.policyLogOnly": "Solo registrar (log_only)",
  "vpnpol.policyBlock": "Bloquear (block)",
  "vpnpol.detectUrl": "Detector",
  "vpnpol.detectNone": "Sin detector configurado (nunca se bloquea sin evidencia)",

  "vpnpol.blockedHint":
    "Las excepciones solo eximen de la política VPN. Cualquier valor nuevo sustituye la nota de la fila existente (mismo valor = misma fila).",

  "vpnpol.errorInvalidIp": "Introduce una IPv4/IPv6 exacta o un CIDR IPv4 válido (a.b.c.d/0-32).",
  "vpnpol.errorForbidden": "Solo un administrador puede gestionar las excepciones VPN.",
  "vpnpol.errorGeneric": "No se pudo completar la operación.",

  "vpnpol.loadError": "No se pudo cargar la lista de excepciones.",
  "vpnpol.added": "Excepción guardada: {value}",
  "vpnpol.removed": "Excepción eliminada: {value}",

  "vpnpol.confirmRemove": "¿Quitar la excepción {value}?",
  "vpnpol.confirmRemoveDesc":
    "Las direcciones de esta IP o rango volverán a estar sujetas a la política VPN inmediatamente.",
  "vpnpol.confirmRemoveAction": "Quitar excepción",
};
