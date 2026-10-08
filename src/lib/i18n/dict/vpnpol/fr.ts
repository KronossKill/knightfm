// Knight FM — VPN policy / exceptions labels (FR, Task 25-d).

export const dict: Record<string, string> = {
  "vpnpol.card.title": "Exceptions VPN / proxy",
  "vpnpol.card.desc":
    "Liste d'autorisation au-dessus de la politique VPN : les IP exactes ou plages CIDR ajoutées ici ne sont jamais bloquées, même si le détecteur les signale. La règle s'applique aussi à l'inscription et à la connexion.",

  "vpnpol.ipLabel": "IP ou plage (CIDR)",
  "vpnpol.ipPlaceholder": "203.0.113.7 · 198.51.100.0/24 · 2001:db8::10",
  "vpnpol.noteLabel": "Note (facultatif)",
  "vpnpol.notePlaceholder": "Motif ou ticket (max 140)",
  "vpnpol.add": "Ajouter une exception",
  "vpnpol.adding": "Enregistrement…",
  "vpnpol.remove": "Retirer",

  "vpnpol.empty": "Aucune exception enregistrée. Avec la politique de blocage, toute IP signalée par le détecteur sera refusée.",
  "vpnpol.count": "{n} exception(s)",

  "vpnpol.policy": "Politique actuelle",
  "vpnpol.policyLogOnly": "Journalisation seule (log_only)",
  "vpnpol.policyBlock": "Bloquer (block)",
  "vpnpol.detectUrl": "Détecteur",
  "vpnpol.detectNone": "Aucun détecteur configuré (jamais de blocage sans preuve)",

  "vpnpol.blockedHint":
    "Les exceptions exonèrent uniquement de la politique VPN. Enregistrer une valeur existante remplace simplement sa note (même valeur = même ligne).",

  "vpnpol.errorInvalidIp": "Saisissez une IPv4/IPv6 exacte ou un CIDR IPv4 valide (a.b.c.d/0-32).",
  "vpnpol.errorForbidden": "Seul un administrateur peut gérer les exceptions VPN.",
  "vpnpol.errorGeneric": "L'opération n'a pas pu être effectuée.",

  "vpnpol.loadError": "Impossible de charger la liste des exceptions.",
  "vpnpol.added": "Exception enregistrée : {value}",
  "vpnpol.removed": "Exception supprimée : {value}",

  "vpnpol.confirmRemove": "Retirer l'exception {value} ?",
  "vpnpol.confirmRemoveDesc":
    "Les adresses de cette IP ou plage seront à nouveau soumises à la politique VPN immédiatement.",
  "vpnpol.confirmRemoveAction": "Retirer l'exception",
};
