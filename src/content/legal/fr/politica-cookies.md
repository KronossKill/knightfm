# Politique de Cookies — Knight FM

> **Avis :** modèle juridique révisable par un avocat. Knight FM utilise **uniquement un stockage technique propre** (cookies essentiels + `localStorage`/`sessionStorage`) et une **analytique de première partie optionnelle** soumise à consentement. Aucun tracking publicitaire de tiers.

**Dernière mise à jour :** [FECHA] · **Version :** 1.0

## 1. Que sont les cookies ?

Les cookies sont de petits fichiers que le site stocke sur votre appareil. Nous utilisons également des technologies équivalentes : `localStorage` et `sessionStorage` du navigateur (stockage local). Dans cette politique, nous les appelons tous « cookies ».

## 2. Cookies et stockage que nous utilisons

| Nom / clé | Type | Durée | Finalité | Tiers |
|---|---|---|---|---|
| `knightfm.auth` (sessionStorage) | technique (essentielle) | jusqu'à la fermeture de l'onglet | maintenir votre session ouverte de manière sécurisée (jetons d'accès/renouvellement avec rotation propre) | Non |
| `knightfm.consent` (localStorage) | technique (essentielle) | persistante | mémoriser votre décision concernant l'analytique (bannière de cookies) | Non |
| `knightfm.theme` (localStorage) | préférences | persistante | mémoriser votre thème visuel | Non |
| `knightfm.locale` (localStorage) | préférences | persistante | mémoriser votre langue (ES/EN/FR/PT) | Non |
| widget captcha (Turnstile ou autre) | technique | pendant le formulaire | prévenir les bots et les abus lors de l'inscription/login/récupération | Cloudflare ou autre fournisseur, si activé |
| événements d'analytique propre (via `fetch` vers l'API) | analytique de première partie | stockés dans la base de données de la plateforme | mesurer l'utilisation de l'interface (sections vues, clics) pour l'améliorer | Non |

## 3. Analytique de première partie et consentement

3.1. L'analytique de Knight FM est **propre et anonyme** : les événements sont pseudonymisés et les e-mails et données identifiantes sont retirés du contenu avant stockage. Nous n'utilisons ni Google Analytics ni d'outils publicitaires de tiers.

3.2. **L'analytique reste désactivée tant que vous n'avez pas cliqué sur « Accepter »** dans la bannière de cookies. Si vous cliquez sur « Refuser », aucun événement analytique n'est envoyé ; le jeu fonctionne exactement pareil sans elle.

3.3. Vous pouvez modifier votre décision à tout moment depuis le lien **« Cookies »** du pied de page, qui rouvre la bannière.

## 4. Nous n'utilisons pas de cookies publicitaires de tiers

Il n'y a ni cookies de profilage, ni publicité comportementale, ni pixels de réseaux sociaux. Si à l'avenir un tiers était intégré (p. ex. analytique produit), cette politique sera mise à jour et un consentement préalable sera demandé, avec un refus aussi facile que l'acceptation.

## 5. Comment les gérer

- Depuis la **bannière de cookies** de la plateforme (accepter / refuser / rouvrir depuis le pied de page).
- Depuis votre navigateur (Chrome, Firefox, Safari, Edge : section « Confidentialité et sécurité »), vous pouvez effacer ou bloquer les cookies et le stockage local.
- **Important :** si vous bloquez le stockage technique (`knightfm.auth`), la session ne fonctionnera pas et vous ne pourrez pas vous connecter.

## 6. Base juridique

- **Techniques et essentielles :** intérêt légitime / exécution du contrat (exemption de l'art. 5.3 LSSI et disposition de l'art. 22.2 LSSI).
- **Analytique de première partie :** consentement via la bannière (art. 6.1.a RGPD).
