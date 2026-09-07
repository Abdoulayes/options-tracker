# TODO List — Préparation avant implémentation

## Wheel Strategy Watchlist Tool — Intégration IBKR

**Version** : 1.0
**Date** : Septembre 2026
**Usage** : Liste des actions manuelles à réaliser en dehors de l'agent IA, avant et pendant les différents lots d'implémentation

---

## Principe

Ce document liste uniquement les actions qui **ne peuvent pas être déléguées à l'agent IA** : installations locales, création de comptes externes, tests manuels de connexion. Le code (schéma Prisma, endpoints, UI, tests) reste entièrement à la charge de l'agent IA, lot par lot, selon le découpage défini dans `3-decoupage-par-lots.md`.

---

## 🔴 Bloquant — à faire avant le Lot 0

- [ ] Créer le repo Git (local + éventuellement distant sur GitHub/GitLab)
- [ ] Installer Node.js (version compatible Next.js 14, ex. 18.x ou 20.x LTS)
- [ ] Installer Docker Desktop (pour PostgreSQL local)
- [ ] Installer Java JRE/JDK (nécessaire pour le Client Portal Gateway IBKR)

---

## 🔴 Bloquant — à faire avant le Lot 1

- [ ] Créer un compte Gmail dédié aux alertes (recommandé, distinct du compte personnel)
- [ ] Générer un mot de passe d'application Gmail (Paramètres Google → Sécurité → Validation en 2 étapes → Mots de passe des applications)
  - ⚠️ À noter précieusement, non récupérable après génération

_(Usage réel uniquement en Phase 3/Module Alertes, mais à préparer maintenant pendant la configuration des autres accès.)_

---

## 🔴 Bloquant — à faire avant le Lot 2 (le plus important)

- [ ] Créer un compte IBKR Paper Trading _(en cours — pris en charge)_
- [ ] Télécharger et installer le Client Portal Gateway manuellement :
  - [ ] Télécharger depuis le site IBKR (Client Portal API / CPAPI)
  - [ ] Décompresser et lancer le script de démarrage (`bin/run.bat` sous Windows)
- [ ] Tester une connexion manuelle complète :
  - [ ] Lancer le Gateway
  - [ ] Ouvrir `https://localhost:5000` dans un navigateur
  - [ ] Accepter le certificat auto-signé
  - [ ] Se connecter avec les identifiants paper (login + 2FA IBKR natif)
  - [ ] Vérifier que le statut de session affiche "authenticated"
- [ ] Noter la fréquence d'expiration de session observée manuellement (IBKR annonce ~24h max)
- [ ] Identifier l'`accountId` paper (via l'interface ou l'endpoint `/portfolio/accounts` une fois connecté)

---

## 🟡 Important — à faire avant le Lot 9 (Phase 3)

- [ ] Créer un compte OVH et choisir l'offre VPS (Ubuntu LTS)
- [ ] Créer un compte Neon (PostgreSQL managé)
- [ ] Créer/vérifier un compte Vercel relié au repo Git

_(Pas urgent immédiatement, uniquement avant le Lot 9.)_

---

## 🟢 Optionnel mais utile — à tout moment

- [ ] Installer une extension REST client (Thunder Client, Postman, ou REST Client VS Code) pour tester manuellement les endpoints du Gateway avant le développement de l'app
- [ ] Explorer la documentation officielle IBKR CPAPI (https://interactivebrokers.github.io/cpwebapi/) pour repérer les endpoints utilisés (statut, positions, market data, options chain)

---

## Hors périmètre — géré par l'agent IA

- Écriture du code (schéma Prisma, endpoints, UI) → lot par lot
- Rédaction des tests unitaires/intégration → selon critères d'acceptation définis dans `3-decoupage-par-lots.md`
- Configuration Nginx/pare-feu détaillée → au moment du Lot 9 uniquement

---

## Ordre de priorité recommandé

1. Installer Node.js, Docker Desktop, Java JRE sur la machine
2. Créer le repo Git
3. En parallèle : télécharger le Gateway et valider la connexion manuelle paper (le plus long/risqué à valider — démarrer tôt)

Le Lot 0 peut être lancé dès les points 1 et 2 réalisés, sans attendre la validation complète du Gateway.

---

_Fin du document — TODO List Préparation v1.0_


**Prochaine étape concrète**
Vous pouvez maintenant :

1. Ouvrir une nouvelle conversation (ou continuer ici) en fournissant à l'agent IA : la spec fonctionnelle, la spec technique, le découpage par lots, le schéma Prisma et les conventions
2. Demander explicitement l'implémentation du Lot 0 uniquement, en citant son périmètre exact