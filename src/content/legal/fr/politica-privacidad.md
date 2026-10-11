# Politique de Confidentialité — Knight FM

> **Avis :** modèle juridique professionnel adapté à Knight FM (Next.js + base de données gérée + Web3/Solana), aligné sur le **RGPD (UE) 2016/679**, la **LOPDGDD 3/2018**, la **CCPA/CPRA** de Californie et des principes équivalents (LGPD, PDPA). **Il doit être révisé par un avocat** et les données du responsable complétées avant publication.

**Dernière mise à jour :** [FECHA] · **Version :** 1.0

## 1. Responsable du traitement

- **Responsable :** [RAZÓN SOCIAL O NOMBRE COMPLETO]
- **NIF/NIE/CIF :** [NÚMERO]
- **Domicile :** [DIRECCIÓN FÍSICA COMPLETA]
- **E-mail de confidentialité :** [EMAIL PRIVACIDAD]
- **Délégué à la Protection des Données (le cas échéant) :** [CONTACTO DPD]
- Sous-traitants : fournisseur d'hébergement/base de données (p. ex. **Supabase/PostgreSQL** ou autre équivalent contracté), fournisseur d'e-mails transactionnels et fournisseur de captcha, conformément à des contrats de sous-traitance (art. 28 RGPD).

## 2. Quelles données traitons-nous

| Catégorie | Données concrètes | Quand |
|---|---|---|
| **Compte** | adresse e-mail, nom d'utilisateur, mot de passe (hash Argon2), langue et thème choisis, date d'inscription | inscription et utilisation |
| **Vérification** | code de vérification d'e-mail (stocké sous forme de hash), jetons de récupération de mot de passe | inscription, support |
| **Identité Web3** | adresse publique Solana liée (optionnelle), signatures/identifiants des transactions de dépôt ou de retrait | si vous connectez un wallet |
| **Économie du jeu** | soldes internes de $Knight, mouvements comptables, transferts, enchères, billetterie | utilisation du jeu |
| **Sécurité et antifraude** | adresse IP d'inscription et dernier accès, résultats d'évaluation VPN/proxy, événements d'audit (tentatives de login, blocages), liens entre comptes par IP | toujours (intérêt légitime) |
| **Communications** | messages entre Utilisateurs au sein du jeu, notifications de la plateforme | utilisation du jeu |
| **Analytique propre** | événements anonymes d'utilisation de l'interface (sections vues, clics), avec pseudonymisation ; les e-mails et données identifiantes sont supprimés avant stockage | **uniquement si vous acceptez l'analytique** |
| **Support** | contenu de vos communications avec le support | si vous nous contactez |

**Nous ne traitons pas** de données particulièrement protégées, ne réalisons pas d'élaborations de profilage à des fins publicitaires et ne vendons pas de données personnelles à des tiers.

## 3. Finalités et bases juridiques (RGPD)

| Finalité | Base juridique |
|---|---|
| Créer et gérer le Compte, fournir le jeu (contrat) | **exécution du contrat** (art. 6.1.b) |
| Vérifier l'adresse e-mail, éviter les faux comptes | exécution du contrat / **intérêt légitime** |
| Sécurité, contrôle anti-multicomptes, prévention de la fraude et des abus (IP, VPN, audit) | **intérêt légitime** (art. 6.1.f) et obligation légale de sécurité |
| Fonctionnalités de paiement en $Knight via Solana | exécution du contrat ; respect des obligations comptables (**obligation légale**) |
| Analytique propre de l'interface | **consentement** (art. 6.1.a) — révocable à tout moment |
| Communications opérationnelles du service (pas de marketing) | exécution du contrat / intérêt légitime |
| Traiter les droits et réclamations | obligation légale / intérêt légitime |

**CCPA/CPRA (Californie) :** nous traitons les données aux fins commerciales décrites ci-dessus ; nous **ne vendons** ni ne partageons d'informations personnelles « contre une contrepartie » (sale/share) telles que définies dans la CPRA, et nous ne discriminons pas les utilisateurs qui exercent leurs droits.

## 4. Adresses de wallet et données on-chain

4.1. L'adresse publique Solana que vous liez est un identifiant **pseudonyme** : elle ne contient pas votre nom, mais elle est considérée comme une **donnée personnelle** au sens du RGPD lorsqu'elle peut être associée à vous (et c'est ainsi que nous la traitons).

4.2. Avertissements à connaître :

- La blockchain est **publique et immuable** : toute donnée écrite dans une transaction on-chain échappe au contrôle du responsable des traitements et **ne peut être effacée** (limitation matérielle de l'art. 17 RGPD, reconnue par l'EDPB).
- Le responsable des traitements ne vous demandera jamais votre clé privée ni votre phrase semence. Vous ne devez jamais les partager.

4.3. Les dépôts et retraits sont vérifiés en comparant les adresses des transactions avec le wallet du système de la plateforme ; les enregistrements de vérification sont traités comme des données de sécurité et de comptabilité.

## 5. Conservation

- **Compte actif :** tant que le compte existe.
- **Compte inactif :** après 40 jours sans accès, le compte est marqué INACTIF et peut être purgé selon les règles du jeu ; la suppression définitive intervient avec la suppression du compte.
- **Registres de sécurité et d'audit :** jusqu'à 12 mois (ou le délai légal applicable), pour se défendre contre les abus.
- **Mouvements comptables (grand livre de $Knight) :** 10 ans, ou le délai de prescription fiscale applicable, avec pseudonymisation lorsque c'est possible.
- **Analytique :** jusqu'à 24 mois.
- Lorsque plusieurs délais coïncident, le plus long s'applique par obligation légale.

## 6. Destinataires et transferts

6.1. **Nous ne vendons pas vos données.** Elles ne sont communiquées qu'à :

- Fournisseurs d'infrastructure nécessaires au service (hébergement, base de données gérée, e-mails transactionnels, captcha), dans le cadre d'un contrat de sous-traitance et avec des clauses appropriées.
- Autorités publiques lorsqu'il existe une obligation légale ou une réquisition valide.
- Tiers en cas de fusion ou de réorganisation sociétaire, avec notification et conformément à la loi.

6.2. Si des transferts internationaux hors EEE se produisent (p. ex. vers des fournisseurs d'hébergement aux États-Unis), ils s'appuient sur des décisions d'adéquation, l'**EU-US Data Privacy Framework** lorsqu'il est applicable, ou des **clauses contractuelles types** assorties de mesures complémentaires.

## 7. Vos droits

Vous pouvez les exercer gratuitement en vous adressant à [EMAIL PRIVACIDAD] (en vous identifiant suffisamment) :

- **Accès :** savoir quelles données vous concernant nous traitons et en recevoir une copie.
- **Rectification :** corriger les données inexactes.
- **Effacement (« droit à l'oubli ») :** supprimer votre compte et vos données personnelles (voir 7.1).
- **Portabilité :** recevoir vos données dans un format structuré (JSON/CSV).
- **Opposition et limitation :** vous opposer aux traitements fondés sur l'intérêt légitime ou demander la limitation pendant la vérification d'une réclamation.
- **Retrait du consentement** (p. ex. analytique) à tout moment, sans affecter la licéité antérieure.
- **Réclamation** auprès de l'Agence espagnole de protection des données (AEPD, `www.aepd.es`) ou de votre autorité locale. Californie : demandes de savoir/supprimer/corriger via [EMAIL PRIVACIDAD] ; nous vérifierons votre identité ; réponse ≤ 45 jours.

### 7.1. Droit à l'effacement (« droit à l'oubli ») : fonctionnement dans Knight FM

- Lors de la confirmation de la suppression du compte sont supprimées ou anonymisées : l'e-mail, le nom d'utilisateur, l'IP d'inscription, les sessions, les messages, les soldes internes et les liens avec le wallet.
- **Ne peuvent pas être effacés :** (a) ce que la loi impose de conserver (comptabilité des mouvements, pseudonymisée) ; (b) les **données déjà écrites on-chain** (irréversibles par conception de la blockchain) ; (c) les registres de sécurité partiellement agrégés qui ne vous identifient plus.
- Vous pouvez délier l'adresse du wallet avant la suppression afin de minimiser les liens persistants.

## 8. Mineurs

Le service s'adresse aux personnes de 18 ans ou plus et **nous ne traitons pas sciemment de données de mineurs**. Si nous détectons le compte d'un mineur, il sera suspendu et ses données supprimées. Si vous pensez qu'un mineur nous a communiqué des données, contactez [EMAIL PRIVACIDAD].

## 9. Sécurité

Mesures techniques et organisationnelles appropriées : mots de passe chiffrés avec **Argon2**, jetons de session avec rotation et révocation, protection CSRF/XSS, limitation de requêtes, capture des événements de sécurité, chiffrement en transit (TLS) et contrôle d'accès par rôles (ADMIN/USER), principe du moindre privilège et journal d'audit des actions administratives. La sécurité est proportionnée au risque et révisée périodiquement.

## 10. Cookies et stockage local

Consultez la **Politique de Cookies**, qui détaille le stockage technique et l'analytique optionnelle, ainsi que la bannière de consentement de la plateforme où vous pouvez accepter ou refuser.

## 11. Décisions automatisées

Le système applique des décisions automatisées de **sécurité** (blocage pour multicomptes détectés par IP, blocage pour VPN selon une politique stricte) par intérêt légitime. Elles font l'objet d'une supervision humaine (un administrateur peut examiner et débloquer) et vous pouvez demander une révision humaine en écrivant à [EMAIL PRIVACIDAD]. **Il n'existe pas** de décisions automatisées à effets juridiques sur des personnes en dehors du contexte de sécurité de la plateforme.

## 12. Changements de cette politique

Nous publierons ici la version en vigueur avec sa date. Les modifications substantielles seront annoncées au sein de la Plateforme avec un préavis raisonnable.

## 13. Contact

Confidentialité : [EMAIL PRIVACIDAD] · Adresse postale : [DIRECCIÓN FÍSICA COMPLETA].
