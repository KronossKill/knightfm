import type { Dict } from "../../index";

// Knight FM — landing dictionary (Français). Full parity with es.ts.
export const dict: Dict = {
  // Accessibilité / navigation
  "landing.a11y.skip": "Aller au contenu principal",
  "landing.nav.how": "Comment ça marche",
  "landing.nav.kmie": "Matchs en direct",
  "landing.nav.world": "Le monde",
  "landing.nav.themes": "Thèmes",
  "landing.nav.economy": "Économie",
  "landing.nav.security": "Sécurité",

  // Barre supérieure
  "landing.topbar.language": "Langue",
  "landing.topbar.theme": "Thème",

  // Hero
  "landing.hero.kicker": "Monde persistant · Horloge UTC · Une saison en cours",
  "landing.hero.headline": "Dirigez votre club dans le monde du football en ligne le plus profond jamais créé.",
  "landing.hero.subtitle":
    "Un monde persistant en temps réel où vos décisions construisent des saisons uniques. Pas de raccourcis. Pas de pay-to-win. Pas de pause.",
  "landing.hero.ctaPrimary": "Créer mon compte gratuitement",
  "landing.hero.ctaSecondary": "Voir le monde en action",
  "landing.hero.live.label": "Managers actifs en ce moment",
  "landing.hero.trust.wcag": "Accessible (WCAG AA)",
  "landing.hero.trust.turnstile": "Protégé par Turnstile",
  "landing.hero.trust.audit": "Piste d’audit immuable",
  "landing.hero.board.title": "Tableau tactique Knight",
  "landing.hero.board.subtitle": "Votre 4-3-3, prêt pour le coup d’envoi",
  "landing.hero.board.badge": "4-3-3",

  // Proposition de valeur
  "landing.value.kicker": "Pourquoi Knight FM",
  "landing.value.title": "Un monde qui n’attend personne",
  "landing.value.subtitle": "Trois piliers qui rendent chaque saison unique.",
  "landing.value.pillar1.title": "Un monde persistant 24h/24 et 7j/7",
  "landing.value.pillar1.body":
    "Un jour de jeu dure 24 heures réelles à l’horloge UTC. Le monde continue pendant votre sommeil : marchés, matchs et rivaux ne s’arrêtent jamais.",
  "landing.value.pillar1.more":
    "Chaque journée se clôt à 00:00:00 UTC et la suivante démarre seule, sans bouton « passer au jour suivant ». Ce que vous ne gérez pas aujourd’hui appartient demain à l’histoire.",
  "landing.value.pillar2.title": "Simulation causale KMIE",
  "landing.value.pillar2.body":
    "Les meilleures équipes obtiennent de meilleures probabilités. Aucun scénario : le moteur est causal, semé et reproductible.",
  "landing.value.pillar2.more":
    "La force de votre effectif et votre adéquation tactique alimentent les probabilités de chaque action. Pas de rubber-banding, pas de résultats préécrits.",
  "landing.value.pillar3.title": "Pas de pay-to-win",
  "landing.value.pillar3.body":
    "Aucun achat n’affecte le résultat d’un match. Pas un seul. L’avantage s’entraîne, se planifie et se gagne.",
  "landing.value.pillar3.more":
    "L’économie est transparente et auditée : le talent décide, pas la carte bancaire. On achète du confort, jamais des victoires.",
  "landing.value.expand": "Plus de détails",
  "landing.value.collapse": "Moins de détails",

  // Comment ça marche
  "landing.how.kicker": "Comment ça marche",
  "landing.how.title": "De zéro à légende en quatre étapes",
  "landing.how.subtitle": "Commencer est gratuit ; laisser une trace est une affaire de décisions.",
  "landing.how.stepLabel": "Étape {n}",
  "landing.how.step1.title": "Créez votre compte",
  "landing.how.step1.desc": "Inscription gratuite avec vérification par e-mail et protection Turnstile.",
  "landing.how.step2.title": "Choisissez votre voie",
  "landing.how.step2.desc":
    "Manager aux commandes du vestiaire, ou propriétaire bâtissant un empire de 10 clubs au maximum.",
  "landing.how.step3.title": "Gérez et rivalisez",
  "landing.how.step3.desc":
    "Compositions, tactiques, marché, formation et finances dans un monde qui ne s’arrête jamais.",
  "landing.how.step4.title": "Bâtissez un héritage",
  "landing.how.step4.desc": "Montées, coupes et un palmarès dont on se souvient saison après saison.",

  // Différenciation
  "landing.compare.kicker": "Différenciation",
  "landing.compare.title": "Knight FM face aux managers traditionnels",
  "landing.compare.subtitle": "Pas une énième édition annuelle : un autre sport.",
  "landing.compare.colFeature": "Caractéristique",
  "landing.compare.colKnight": "Knight FM",
  "landing.compare.colTrad": "Managers traditionnels",
  "landing.compare.row.time.label": "Temps persistant",
  "landing.compare.row.time.knight": "24 heures réelles par jour de jeu, horloge UTC",
  "landing.compare.row.time.trad": "Sessions pausables ou par tours",
  "landing.compare.row.sim.label": "Simulation",
  "landing.compare.row.sim.knight": "Causale, semée, reproductible",
  "landing.compare.row.sim.trad": "Scripts cachés ou rubber-banding",
  "landing.compare.row.pay.label": "Pay-to-win",
  "landing.compare.row.pay.knight": "Zéro : aucun achat ne change les résultats",
  "landing.compare.row.pay.trad": "Bonus et loots payants fréquents",
  "landing.compare.row.themes.label": "Thèmes visuels",
  "landing.compare.row.themes.knight": "5 thèmes avec aperçu en direct",
  "landing.compare.row.themes.trad": "Un thème fixe, ou presque",
  "landing.compare.row.assistant.label": "Assistant IA",
  "landing.compare.row.assistant.knight": "Contextuel, en mode explicatif uniquement",
  "landing.compare.row.assistant.trad": "Absent, ou autorisé à agir",
  "landing.compare.row.lang.label": "Langues",
  "landing.compare.row.lang.knight": "4 langues en parité totale",
  "landing.compare.row.lang.trad": "1–2 langues, traductions partielles",

  // KMIE
  "landing.kmie.kicker": "Matchs en direct",
  "landing.kmie.title": "10 minutes qui sentent la finale",
  "landing.kmie.subtitle":
    "Le moteur KMIE raconte chaque match en temps réel : deux mi-temps de 4 minutes et une pause de 2 minutes.",
  "landing.kmie.stage1": "Première mi-temps",
  "landing.kmie.stageHT": "Mi-temps",
  "landing.kmie.stage2": "Seconde mi-temps",
  "landing.kmie.min": "{n} min",
  "landing.kmie.total": "10 minutes en direct par match · coup d’envoi à 19:00 UTC",
  "landing.kmie.chip.possession": "Possession",
  "landing.kmie.chip.shots": "Tirs",
  "landing.kmie.chip.chance": "Qualité d’occasion (xG)",
  "landing.kmie.illustrative": "Vue illustrative du moteur · données d’exemple",
  "landing.kmie.replay": "Voir un replay",
  "landing.kmie.fact1": "Semé et reproductible : même match, mêmes probabilités.",
  "landing.kmie.fact2": "Aucun résultat scénarisé : la cause précède le but.",
  "landing.kmie.fact3": "Métriques en direct type xG pendant que le ballon roule.",

  // Monde et compétitions
  "landing.world.kicker": "Le monde",
  "landing.world.title": "10 régions. 1 600 clubs. Un seul trône.",
  "landing.world.subtitle":
    "Une géographie complète de montées, de coupes et un Championnat du Monde des Clubs à la fin de chaque saison.",
  "landing.world.regions": "Régions",
  "landing.world.divisions": "Divisions par région",
  "landing.world.clubs": "Clubs",
  "landing.world.leagueFixtures": "Journées de championnat par club",
  "landing.world.cups": "Coupes régionales · finale le jour 29",
  "landing.world.worldCup": "Championnat du Monde des Clubs · 40 clubs · finale le jour 30",
  "landing.world.season": "Saison de 32 jours + 5 jours de pré-saison",

  // Thèmes
  "landing.themes.kicker": "Personnalisation",
  "landing.themes.title": "Six thèmes, votre maillot visuel",
  "landing.themes.subtitle": "Essayez-les : ils s’appliquent instantanément. Votre choix ne modifie jamais l’état du jeu.",
  "landing.themes.cta": "Essayer le thème",
  "landing.themes.active": "Actif",
  "landing.themes.hint": "Les cinq thèmes respectent WCAG AA.",
  "themes.knightEmerald": "Émeraude Knight",
  "themes.obsidian": "Obsidienne",
  "themes.royal": "Royal",
  "themes.aurora": "Aurore",
  "themes.classic": "Classique",
  "themes.onyx": "Onyx Élite",

  // Assistant
  "landing.assistant.kicker": "Knight Assistant",
  "landing.assistant.title": "Un assistant qui explique, n’agit jamais",
  "landing.assistant.subtitle":
    "Une IA contextuelle premium qui maîtrise le règlement et l’état du monde. Avec une limite stricte.",
  "landing.assistant.guaranteeTitle": "Garantie absolue",
  "landing.assistant.guarantee":
    "L’assistant ne peut exécuter aucune opération de marché, mouvement financier ni changement de propriété. Il lit, explique et analyse, rien de plus.",
  "landing.assistant.chatLabel": "Exemple de conversation",
  "landing.assistant.illustrative": "Dialogue illustratif avec des faits réels du règlement",
  "landing.assistant.u1": "Comment se déroule la mi-temps en direct ?",
  "landing.assistant.a1":
    "Il y a 2 minutes réelles entre les deux mi-temps. Vous pouvez ajuster la tactique depuis le tableau avant la reprise.",
  "landing.assistant.u2": "Enchérir 250 pour l’attaquant de l’Atlético Norte.",
  "landing.assistant.a2":
    "Je ne peux pas : exécuter des enchères ou toute opération de marché dépasse mes capacités. Je peux vous expliquer sa clause et sa forme actuelle si vous voulez.",
  "landing.assistant.u3": "Combien de clubs un propriétaire peut-il avoir ?",
  "landing.assistant.a3":
    "Jusqu’à 10, jamais deux dans la même région. Le serveur le vérifie en base de données ; ce n’est pas qu’une règle d’interface.",

  // Économie
  "landing.economy.kicker": "Économie et $Knight",
  "landing.economy.title": "Transparent jusqu’au dernier centime",
  "landing.economy.subtitle":
    "Deux livres distincts, des prélèvements clairs et une seule frontière avec l’extérieur.",
  "landing.economy.ledger1Title": "Trésorerie du club",
  "landing.economy.ledger1Desc": "Transferts, salaires, installations et primes. Comptes atomiques, entiers et audités.",
  "landing.economy.ledger2Title": "Portefeuille personnel",
  "landing.economy.ledger2Desc": "Votre argent de propriétaire et de manager, indépendant de la trésorerie de chaque club.",
  "landing.economy.levy": "Prélèvement de 10 %",
  "landing.economy.levyDesc":
    "Sur les revenus de la plateforme (salaire de manager, bonus de parrainage) et les retraits. Les dépôts Solana vérifiés sont sans prélèvement : 100% est crédité.",
  "landing.economy.alloc": "Affectations 5 % + 5 %",
  "landing.economy.allocDesc": "5 % au fonds régional et 5 % au fonds du système pour les revenus éligibles.",
  "landing.economy.solana":
    "Solana n’est que la frontière de dépôt et de retrait. Elle ne pilote jamais la simulation.",
  "landing.economy.riskTitle": "Avertissement sur le risque du token",
  "landing.economy.risk":
    "$Knight est un actif interne soumis au risque de marché. Sa valeur peut monter ou descendre ; n’investissez jamais ce que vous ne pouvez pas vous permettre de perdre.",
  "landing.economy.whitepaper": "Lire le livre blanc de l’économie",

  // Preuve sociale
  "landing.proof.kicker": "Preuve sociale",
  "landing.proof.title": "Des chiffres réels, pas des promesses",
  "landing.proof.subtitle": "Sans témoignages inventés ni compteurs gonflés : voici ce qui existe déjà.",
  "landing.proof.clubs": "Clubs dans le monde",
  "landing.proof.players": "Joueurs générés",
  "landing.proof.fixtures": "Matchs par saison",
  "landing.proof.honest":
    "Politique d’honnêteté : quand de vrais utilisateurs seront en direct, vous verrez ce nombre ici, en temps réel.",
  "landing.proof.principle1": "Pas de pay-to-win. Jamais.",
  "landing.proof.principle2": "Le serveur fait autorité : le client ne décide pas.",
  "landing.proof.principle3": "Économie auditée et réconciliée entrée par entrée.",

  // Sécurité
  "landing.security.kicker": "Sécurité et confiance",
  "landing.security.title": "Blindé dès la conception",
  "landing.security.subtitle": "Votre compte, votre trésorerie et le monde entier protégés couche par couche.",
  "landing.security.argon2.title": "Mots de passe Argon2id",
  "landing.security.argon2.desc": "Hachage résistant aux GPU pour chaque identifiant.",
  "landing.security.jwt.title": "Rotation des JWT",
  "landing.security.jwt.desc": "Accès à durée courte avec refresh rotatif révocable.",
  "landing.security.turnstile.title": "Turnstile côté serveur",
  "landing.security.turnstile.desc": "CAPTCHA vérifié côté serveur, jamais côté client.",
  "landing.security.email.title": "Vérification par e-mail",
  "landing.security.email.desc": "Codes de vérification et de réinitialisation audités.",
  "landing.security.audit.title": "Piste d’audit immuable",
  "landing.security.audit.desc": "Chaque mutation financière et de propriété est enregistrée.",
  "landing.security.wcag.title": "WCAG AA",
  "landing.security.wcag.desc": "Contraste, focus visible et cibles tactiles de 44 px.",

  // Légal
  "landing.legal.privacy": "Confidentialité",
  "landing.legal.terms": "Conditions",
  "landing.legal.cookies": "Cookies",
  "landing.legal.play": "Jeu responsable",
  "landing.legal.refunds": "Remboursements",
  "landing.legal.token": "Risque du token",

  // CTA finale + pied de page
  "landing.final.title": "Le prochain coup d’envoi est à vous",
  "landing.final.subtitle": "Rejoignez le monde persistant et commencez à bâtir la saison dont on se souviendra.",
  "landing.final.cta": "Créer mon compte gratuitement",
  "landing.final.note": "Inscription gratuite · Vérification par e-mail · Aucun coût initial",
  "landing.footer.tagline": "Le manager de football en ligne persistant.",
  "landing.footer.responsible":
    "Knight FM est un jeu de gestion. $Knight comporte un risque de marché. Jouez de manière responsable.",
  "landing.footer.rights": "© {year} Knight FM. Tous droits réservés.",
  "landing.footer.docs": "Documentation complète et code source",
  "landing.footer.docsHint": "ZIP · 10 docs techniques : architecture, API, sécurité, économie, guide administrateur et analyse concurrentielle",
  "landing.footer.docsZip": "ZIP du projet — code source + documentation",
  "landing.footer.docsWord": "Document Word — documentation technique (.docx)",
  "landing.footer.navTitle": "Explorer",
  "landing.footer.legalTitle": "Juridique",
  "landing.footer.settingsTitle": "Réglages",
};
