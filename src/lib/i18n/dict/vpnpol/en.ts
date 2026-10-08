// Knight FM — VPN policy / exceptions labels (EN, Task 25-d).

export const dict: Record<string, string> = {
  "vpnpol.card.title": "VPN / proxy exceptions",
  "vpnpol.card.desc":
    "Allow-list on top of the VPN policy: the exact IPs or CIDR ranges you add here are never blocked, even if the detector flags them. The rule also applies to sign-up and sign-in.",

  "vpnpol.ipLabel": "IP or range (CIDR)",
  "vpnpol.ipPlaceholder": "203.0.113.7 · 198.51.100.0/24 · 2001:db8::10",
  "vpnpol.noteLabel": "Note (optional)",
  "vpnpol.notePlaceholder": "Reason or ticket (max 140)",
  "vpnpol.add": "Add exception",
  "vpnpol.adding": "Saving…",
  "vpnpol.remove": "Remove",

  "vpnpol.empty": "No exceptions yet. Under the blocking policy, any IP flagged by the detector will be rejected.",
  "vpnpol.count": "{n} exception(s)",

  "vpnpol.policy": "Current policy",
  "vpnpol.policyLogOnly": "Log only (log_only)",
  "vpnpol.policyBlock": "Block (block)",
  "vpnpol.detectUrl": "Detector",
  "vpnpol.detectNone": "No detector configured (never blocks without evidence)",

  "vpnpol.blockedHint":
    "Exceptions only exempt from the VPN policy. Saving an existing value again just replaces its note (same value = same row).",

  "vpnpol.errorInvalidIp": "Enter an exact IPv4/IPv6 address or a valid IPv4 CIDR (a.b.c.d/0-32).",
  "vpnpol.errorForbidden": "Only an administrator can manage VPN exceptions.",
  "vpnpol.errorGeneric": "The operation could not be completed.",

  "vpnpol.loadError": "Could not load the exception list.",
  "vpnpol.added": "Exception saved: {value}",
  "vpnpol.removed": "Exception removed: {value}",

  "vpnpol.confirmRemove": "Remove exception {value}?",
  "vpnpol.confirmRemoveDesc":
    "Addresses in this IP or range will immediately be subject to the VPN policy again.",
  "vpnpol.confirmRemoveAction": "Remove exception",
};
