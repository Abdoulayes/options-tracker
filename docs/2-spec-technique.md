# Spécification Technique

## Wheel Strategy Watchlist Tool — Intégration IBKR

**Version** : 1.0
**Date** : Septembre 2026
**Basé sur** : Spécification Fonctionnelle v1.5
**Statut** : Draft pour implémentation

---

## Table des matières

1. [Stack technique détaillée](#1-stack-technique-détaillée)
2. [Architecture globale](#2-architecture-globale)
3. [Structure du projet](#3-structure-du-projet)
4. [Modèle de données](#4-modèle-de-données)
5. [Authentification & 2FA](#5-authentification--2fa)
6. [Intégration IBKR Client Portal Gateway](#6-intégration-ibkr-client-portal-gateway)
7. [API — Endpoints applicatifs](#7-api--endpoints-applicatifs)
8. [Health Check & Monitoring](#8-health-check--monitoring)
9. [Logique métier — Calculs financiers](#9-logique-métier--calculs-financiers)
10. [Approche Frontend](#10-approche-frontend)
11. [Configuration & Variables d'environnement](#11-configuration--variables-denvironnement)
12. [Environnement local (Phase 1)](#12-environnement-local-phase-1)
13. [Sécurité — Principes d'implémentation](#13-sécurité--principes-dimplémentation)
14. [Stratégie de tests](#14-stratégie-de-tests)
15. [Déploiement & CI/CD](#15-déploiement--cicd)
16. [Checklist de migration entre phases](#16-checklist-de-migration-entre-phases)

---

## 1. Stack technique détaillée

| Couche                  | Technologie                                                 | Version cible                      |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------- |
| Framework               | Next.js                                                     | 14.x (App Router)                  |
| Langage                 | TypeScript                                                  | 5.x                                |
| ORM                     | Prisma                                                      | 5.x                                |
| Base de données         | PostgreSQL                                                  | 16.x                               |
| Authentification        | NextAuth.js (Auth.js)                                       | 5.x                                |
| 2FA TOTP                | librairie TOTP compatible RFC 6238 (`otplib` ou équivalent) | à trancher (Q1 spec fonctionnelle) |
| UI Framework            | Tailwind CSS                                                | 3.x                                |
| Composants UI           | shadcn/ui                                                   | latest                             |
| Graphiques              | Recharts                                                    | 2.x                                |
| Validation de schéma    | Zod                                                         | 3.x                                |
| Cache/état serveur      | TanStack Query                                              | 5.x                                |
| Cron jobs (Phase 1/2)   | tâche planifiée locale (node-cron ou équivalent)            | —                                  |
| Cron jobs (Phase 3)     | Vercel Cron                                                 | —                                  |
| Conteneurisation locale | Docker + Docker Compose                                     | —                                  |

---

## 2. Architecture globale

### 2.1 Phase 1 — Environnement local

Tous les composants tournent sur la machine de développement :

```
Votre PC :
    Next.js (localhost:3000)
    Client Portal Gateway IBKR (localhost:5000)
    PostgreSQL local (Docker ou installation native)
```

Le frontend communique exclusivement avec les API Routes internes de Next.js. Ces API Routes sont seules autorisées à dialoguer avec le Gateway IBKR et avec la base de données.

### 2.2 Phase 3 — Architecture cible

```
Vercel (Next.js prod)
        ↓ HTTPS
    ┌────┴──────────────┐
    ▼                     ▼
  Neon                 VPS dédié
  (base de données)     Gateway IBKR
                         (Nginx + reverse proxy)
```

- Le frontend et les API Routes sont déployés sur Vercel
- La base de données est hébergée sur Neon
- Le Gateway IBKR tourne sur un VPS dédié, derrière un reverse proxy Nginx qui termine le TLS et applique un filtrage réseau strict
- Un backend proxy interne (sur le même VPS) fait l'intermédiaire authentifié entre Vercel et le Gateway, qui lui n'est jamais exposé directement sur Internet

### 2.3 Principe de flux de communication (valable à toutes les phases)

```
Composants React (client)
    → API Routes Next.js
        → Couche de services applicatifs
            → Prisma (base de données)
            → Client HTTP dédié au Gateway IBKR
```

**Règle d'architecture non négociable** : aucun composant côté navigateur n'effectue d'appel direct vers le Gateway IBKR ou vers la base de données. Tout transite par la couche API Routes.

---

## 3. Structure du projet

Organisation proposée par domaine fonctionnel plutôt que par type technique, afin de garder chaque module (watchlist, options chain, calculateur, DTE comparator, positions, alertes) cohérent et facile à faire évoluer indépendamment.

```
options-tracker/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docker-compose.yml
├── .env.local / .env.example
├── src/
│   ├── app/
│   │   ├── (auth)/                 # login, setup 2FA
│   │   ├── (dashboard)/             # dashboard, watchlist, positions, analytics, settings
│   │   └── api/
│   │       ├── auth/                # NextAuth + endpoints 2FA
│   │       ├── ibkr/                # status, health, tickers, market-data, options-chain, positions, account-summary
│   │       ├── watchlists/          # CRUD watchlist + tickers
│   │       ├── trades/              # TradeLog CRUD
│   │       ├── iv-history/          # historique IV Rank
│   │       └── cron/                # jobs planifiés (snapshot IV, health-check)
│   ├── components/
│   │   ├── ui/                      # composants shadcn/ui
│   │   ├── dashboard/
│   │   ├── options-chain/
│   │   ├── calculator/
│   │   ├── dte-comparator/
│   │   ├── command-palette/
│   │   └── shared/
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth-config.ts
│   │   ├── app-config.ts             # configuration centralisée (env vars)
│   │   ├── ibkr-gateway/             # client HTTP, types, gestion de session
│   │   ├── domain-services/          # logique métier (yield, dte comparator, trade log, iv history)
│   │   ├── validation-schemas/       # schémas Zod
│   │   └── helpers/
│   ├── hooks/
│   └── types/
└── tests/
```

---

## 4. Modèle de données

### 4.1 Entités principales

| Entité            | Rôle                                                                         |
| ----------------- | ---------------------------------------------------------------------------- |
| `User`            | Compte applicatif, avec configuration 2FA                                    |
| `UserSettings`    | Préférences (preset DTE par défaut, frais, delta cible, jour de rotation)    |
| `Watchlist`       | Liste nommée appartenant à un utilisateur                                    |
| `WatchlistTicker` | Ticker suivi dans une watchlist (tags, notes, prix cible, conid IBKR résolu) |
| `IVHistory`       | Snapshot quotidien de l'IV Rank par ticker suivi                             |
| `Alert`           | Configuration d'alerte (type, condition en JSON, statut actif/inactif)       |
| `TradeLog`        | Historique des trades avec issue et performance réalisée                     |

### 4.2 Relations clés

- Un `User` possède plusieurs `Watchlist`, plusieurs `Alert`, plusieurs `TradeLog`, et un unique `UserSettings`
- Une `Watchlist` contient plusieurs `WatchlistTicker`
- Un `WatchlistTicker` accumule un historique `IVHistory` (une entrée par jour)

### 4.3 Points d'attention pour le schéma Prisma

- Utiliser des `enum` Prisma pour `OptionType` (CSP/CC) et `TradeOutcome` (expiré, assigné, clôturé anticipé, roulé) plutôt que des chaînes libres, pour garantir la cohérence des données
- Index composé sur `(watchlistTickerId, date)` pour `IVHistory` afin d'accélérer les requêtes d'historique
- Contrainte d'unicité sur `(watchlistId, symbol)` pour éviter les doublons de ticker dans une même liste
- Le champ `twoFactorSecret` de `User` doit être stocké sous forme chiffrée (voir section 13.1), jamais en clair

---

## 5. Authentification & 2FA

### 5.1 Principe du flow

1. L'utilisateur soumet email + mot de passe
2. Le mot de passe est vérifié via comparaison de hash (bcrypt ou argon2)
3. Si le 2FA n'est pas encore configuré, redirection obligatoire vers l'écran de setup (génération d'un secret TOTP + QR code à scanner)
4. Si le 2FA est configuré, une session "en attente de validation" est créée, nécessitant la saisie du code à 6 chiffres avant émission de la session complète
5. Le code TOTP est vérifié côté serveur par comparaison avec le secret déchiffré, avec une fenêtre de tolérance temporelle standard (± 30 secondes)

### 5.2 Points d'implémentation — Décisions actées

- **Librairie TOTP retenue** : `otplib`
- **Librairie de hash de mot de passe retenue** : `bcrypt`
- **Rate limiting** : limiter le nombre de tentatives de vérification du code 2FA (ex. 5 tentatives par fenêtre de 15 minutes) pour se prémunir contre le brute-force

### 5.3 Séparation stricte entre les deux couches d'authentification

L'authentification applicative (NextAuth + 2FA) et l'authentification IBKR (gérée par le Gateway) sont totalement indépendantes dans le code : aucune information d'authentification IBKR ne transite ni n'est stockée dans le système NextAuth, et inversement.

---

## 6. Intégration IBKR Client Portal Gateway

### 6.1 Principe du client HTTP dédié

Toute communication avec le Gateway passe par un module unique, responsable de :

- Construire les requêtes vers l'URL du Gateway (lue depuis la configuration centralisée)
- Gérer l'acceptation du certificat auto-signé **uniquement** en environnement de développement (vérification explicite de `NODE_ENV`)
- Exposer des méthodes typées pour chaque famille d'appel : statut de session, recherche de ticker, snapshot de marché, chaîne d'options, positions, résumé de compte

### 6.2 Gestion de la session (heartbeat)

Un mécanisme de rafraîchissement périodique doit appeler l'endpoint de maintien de session du Gateway à intervalle régulier (recommandé : toutes les 40 secondes, avec une marge de sécurité sous le seuil critique des 60 secondes documenté dans la spec fonctionnelle).

En cas d'échec de deux appels consécutifs, le statut de connexion doit basculer en "déconnecté" et déclencher :

- La mise à jour visuelle immédiate du badge de statut dans l'interface
- Si le Module Alertes est actif (Phase 3), l'envoi d'une notification email

### 6.3 Configuration centralisée

Toutes les valeurs dépendantes de l'environnement (URL du Gateway, identifiant de compte IBKR) doivent être lues depuis un unique point de configuration applicatif, alimenté par les variables d'environnement, afin que la migration entre phases (section 4 de la spec fonctionnelle) ne nécessite aucune modification du code.

---

## 7. API — Endpoints applicatifs

| Domaine             | Endpoints principaux                                    | Authentification requise                      |
| ------------------- | ------------------------------------------------------- | --------------------------------------------- |
| Authentification    | setup 2FA, vérification 2FA                             | Session partielle                             |
| IBKR — Statut       | statut de connexion, health check détaillé              | Session complète                              |
| IBKR — Marché       | recherche de ticker, snapshot de prix, chaîne d'options | Session complète                              |
| IBKR — Portefeuille | positions actuelles, résumé de compte (buying power)    | Session complète                              |
| Watchlist           | CRUD watchlist, ajout/suppression de ticker             | Session complète                              |
| TradeLog            | CRUD des trades enregistrés                             | Session complète                              |
| IV History          | consultation de l'historique IV Rank                    | Session complète                              |
| Cron                | snapshot IV quotidien, health-check Gateway (Phase 3)   | Clé secrète dédiée (hors session utilisateur) |

**Principe de validation** : chaque endpoint recevant des données en entrée (création/modification) doit valider le payload via un schéma de validation strict avant tout traitement, rejetant explicitement toute donnée non conforme.

**Principe de gestion d'erreur IBKR** : toute erreur provenant du Gateway doit être interceptée et retournée au frontend sous une forme normalisée (code d'erreur applicatif), sans jamais exposer directement les détails bruts de l'erreur IBKR au client.

---

## 8. Health Check & Monitoring

### 8.1 Mécanisme conforme à la spec fonctionnelle (section 6.2)

| Aspect                  | Implémentation                                                             |
| ----------------------- | -------------------------------------------------------------------------- |
| Endpoint source         | Appel à l'endpoint de maintien de session du Gateway                       |
| Fréquence               | Toutes les 30 à 45 secondes côté vérification applicative                  |
| Détection de panne      | Deux échecs consécutifs → statut "déconnecté"                              |
| Restitution au frontend | Endpoint applicatif dédié exposant le statut courant et la latence mesurée |
| Notification            | Badge visuel immédiat ; email si Module Alertes actif (Phase 3 uniquement) |

### 8.2 Polling côté client

Le frontend interroge périodiquement l'endpoint applicatif de santé (et non directement le Gateway), via un hook dédié s'appuyant sur TanStack Query, avec un intervalle de rafraîchissement aligné sur la fréquence définie ci-dessus.

### 8.3 Cron de surveillance (Phase 3 uniquement)

Un job planifié externe (Vercel Cron) appelle un endpoint protégé par une clé secrète, qui tente un appel au Gateway et déclenche une notification email en cas d'échec. Ce mécanisme n'est activable qu'une fois le Gateway hébergé de façon continue sur le VPS (cf. contrainte documentée dans le Module 8 de la spec fonctionnelle).

---

## 9. Logique métier — Calculs financiers

### 9.1 Calculateur de rendement

La couche de calcul du rendement doit implémenter, à partir des paramètres d'une option (strike, prime, DTE, nombre de contrats, frais par contrat, type CSP/CC) :

- Prime totale perçue
- Collatéral requis (cas CSP)
- Rendement brut en pourcentage
- Rendement annualisé (rendement brut ramené sur 365 jours)
- Rendement net après déduction des frais de transaction, et son équivalent annualisé
- Prix de break-even
- Profit maximum et perte maximum théorique

Cette logique doit être isolée dans une fonction pure, testable indépendamment de toute dépendance à l'API ou à la base de données, afin de garantir la fiabilité des calculs financiers affichés à l'utilisateur.

### 9.2 Calcul du DTE et détection du seuil de gestion

Une fonction utilitaire dédiée calcule le nombre de jours restants avant expiration à partir d'une date, et une seconde fonction détermine si une position en preset Standard atteint le seuil de gestion de 21 jours (règle 45-21 documentée en section 9.2 de la spec fonctionnelle), afin d'alimenter l'indicateur visuel du Module Positions.

### 9.3 Logique de recommandation du DTE Comparator

La comparaison entre deux presets DTE doit s'appuyer sur l'écart de rendement net annualisé entre les deux options :

- Si l'écart dépasse un seuil significatif configurable, recommander le preset au rendement le plus élevé
- Si l'écart est faible, recommander par défaut le preset nécessitant le moins de gestion active (Standard), conformément à la logique métier définie dans la spec fonctionnelle

Cette recommandation doit être accompagnée d'une justification textuelle explicite affichée à l'utilisateur.

### 9.4 Synchronisation automatique du TradeLog (v1.5)

Le TradeLog est alimenté automatiquement à partir de l'historique des ordres exécutés sur le compte IBKR, via un endpoint dédié `/api/ibkr/order-history`, plutôt que par saisie manuelle.

**Logique de mapping** :

- Un ordre de vente d'option (STO) crée une entrée `TradeLog` avec statut "ouvert"
- Un ordre de rachat (BTC), une expiration ou une assignation détectée met à jour le statut de l'entrée correspondante (clôturé anticipé / expiré / assigné)
- Le rapprochement entre ordre d'ouverture et ordre de clôture se fait par correspondance sur le symbole, le strike, l'expiration et le type d'option

**Fréquence de synchronisation** : job planifié quotidien (cron), consultant l'historique des ordres du jour et mettant à jour le TradeLog en conséquence.

> ⚠️ Cette logique de rapprochement est plus complexe qu'une saisie manuelle et devra être testée avec attention (cas d'ordres partiellement remplis, roulés en plusieurs étapes) — prévoir un temps d'implémentation plus long que pour un TradeLog manuel simple.

---

## 10. Approche Frontend

### 10.1 Répartition Server / Client Components

Privilégier les Server Components pour le chargement initial des données (watchlist, positions), et réserver les Client Components aux zones nécessitant de l'interactivité (tri de tableaux, sélection de strike, panneau de calcul, polling de statut, raccourci clavier de la Command Palette).

### 10.2 Thème visuel

Le thème sombre est activé par défaut au niveau du layout racine de l'application, conformément aux recommandations UI de la spec fonctionnelle (section 8), avec une palette de couleurs sémantiques dédiée pour les notions de gain, de perte et d'information neutre.

### 10.3 Composants différenciants à implémenter

- **Command Palette** : raccourci clavier global permettant une recherche instantanée de ticker et une navigation directe vers son options chain
- **Slide-over panel** pour le calculateur de rendement, avec diagramme Profit/Loss généré dynamiquement à partir des résultats du calcul
- **Vue comparative DTE** en layout deux colonnes symétriques, avec bandeau de recommandation visuellement mis en avant

---

## 11. Configuration & Variables d'environnement

| Catégorie             | Variables concernées                                 |
| --------------------- | ---------------------------------------------------- |
| Base de données       | chaîne de connexion PostgreSQL/Neon                  |
| Gateway IBKR          | URL du Gateway, identifiant de compte                |
| Authentification      | URL de l'application, secret de session NextAuth     |
| Chiffrement 2FA       | clé de chiffrement dédiée au secret TOTP             |
| Cron (Phase 3)        | clé secrète protégeant les endpoints de job planifié |
| Email (v1.5, Phase 3) | Gmail SMTP — voir précision ci-dessous               |

**Principe directeur** : aucune valeur sensible ni dépendante de l'environnement ne doit être codée en dur dans le code source ; seule la lecture via variables d'environnement centralisées est autorisée (cf. section 6.3).

### 11.0 Précision — Email (Gmail SMTP)

Le provider email retenu pour les alertes (v1.5) est **Gmail SMTP**, nécessitant :

- Un compte Gmail dédié (recommandé, distinct du compte personnel)
- Un **mot de passe d'application** généré depuis les paramètres de sécurité Google (l'authentification par mot de passe classique n'est pas supportée par Gmail pour les connexions SMTP applicatives)
- Configuration SMTP standard : hôte `smtp.gmail.com`, port `587` (TLS)

### 11.1 Correspondance par phase de déploiement

| Variable                  | Phase 1                  | Phase 2          | Phase 3          |
| ------------------------- | ------------------------ | ---------------- | ---------------- |
| Connexion base de données | Instance locale (Docker) | Neon             | Neon (inchangé)  |
| URL Gateway IBKR          | Local                    | Local (inchangé) | URL du VPS dédié |
| URL de l'application      | Local                    | Local (inchangé) | Domaine Vercel   |

---

## 12. Environnement local (Phase 1)

Un fichier de composition Docker dédié définit un service PostgreSQL unique, utilisant la même version majeure que celle ciblée sur Neon, afin de garantir une compatibilité totale du schéma lors de la migration décrite en section 4 de la spec fonctionnelle.

**Étapes de mise en route :**

1. Démarrage du conteneur de base de données
2. Application des migrations Prisma
3. Génération du client Prisma
4. Lancement du Gateway IBKR en local (processus séparé, authentification manuelle via navigateur)
5. Démarrage de l'application Next.js en mode développement

---

## 13. Sécurité — Principes d'implémentation

### 13.1 Chiffrement du secret 2FA

Le secret TOTP de chaque utilisateur doit être chiffré symétriquement avant son écriture en base de données, et déchiffré uniquement au moment strict de la vérification d'un code, jamais conservé en clair ni en mémoire au-delà de cette opération.

### 13.2 Protection des routes

Un middleware applicatif doit intercepter toute requête vers les routes protégées et vérifier la présence d'une session complète valide (post-2FA), redirigeant vers l'écran de connexion dans le cas contraire.

### 13.3 Journalisation

Les journaux applicatifs ne doivent jamais contenir de données financières en clair (montants, positions, primes) ni de secrets (mots de passe, tokens, secret 2FA), conformément aux exigences de la section 6.4 de la spec fonctionnelle.

### 13.4 Protection réseau (Phase 3)

Le port du Gateway IBKR sur le VPS ne doit être accessible qu'en local sur la machine elle-même ; seul le reverse proxy Nginx, avec terminaison TLS, est exposé sur Internet, avec un pare-feu restreignant strictement les ports ouverts.

---

## 14. Stratégie de tests

| Type de test        | Périmètre prioritaire                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests unitaires     | Fonctions de calcul financier (rendement, DTE, recommandation de preset) — critiques car impactent directement la fiabilité des décisions de trading |
| Tests d'intégration | Endpoints API applicatifs (watchlist, trades), avec base de données de test isolée                                                                   |
| Tests manuels       | Flux d'authentification 2FA, connexion Gateway IBKR (difficilement automatisables du fait de la dépendance à un compte réel et au 2FA IBKR natif)    |

La logique de calcul financier (section 9) doit atteindre une couverture de test proche de l'exhaustivité, ces fonctions conditionnant directement la confiance de l'utilisateur dans les métriques affichées.

---

## 15. Déploiement & CI/CD

### 15.1 Phase 1 et 2

Aucun pipeline de déploiement nécessaire : exécution locale directe via les commandes de développement standard.

### 15.2 Phase 3

- Déploiement du frontend/API Routes sur Vercel, déclenché par push sur la branche principale
- Configuration des variables d'environnement de production directement dans le tableau de bord Vercel
- Configuration des jobs Vercel Cron pour le snapshot IV quotidien et le health-check du Gateway
- Mise en place manuelle initiale du VPS **OVH** (installation du Gateway, configuration Nginx, règles de pare-feu), documentée comme procédure d'exploitation plutôt qu'automatisée en v1

**Précisions VPS OVH :**

- Choisir une offre VPS avec Ubuntu LTS (compatibilité Java pour le Client Portal Gateway)
- Configuration du pare-feu OVH (niveau infrastructure) en complément du pare-feu applicatif (UFW/iptables) sur le VPS lui-même
- Prévoir l'installation de Java (JRE) sur le VPS avant le déploiement du Gateway

---

## 16. Checklist de migration entre phases

### Phase 1 → Phase 2 (migration base de données)

- Provisionner l'instance Neon
- Mettre à jour la variable de connexion à la base de données
- Exécuter les migrations Prisma contre la nouvelle instance
- Valider l'absence de régression sur l'ensemble des fonctionnalités déjà développées

### Phase 2 → Phase 3 (déploiement production)

- Provisionner le VPS et installer le Gateway IBKR
- Configurer le reverse proxy et les règles de pare-feu
- Déployer l'application sur Vercel avec les variables d'environnement de production
- Mettre à jour l'URL du Gateway dans la configuration applicative
- Activer les jobs Vercel Cron (health-check, snapshot IV)
- Activer le Module Alertes (dépendant de la disponibilité continue du Gateway, cf. Module 8 de la spec fonctionnelle)

---

_Fin du document — Spécification Technique v1.0_
