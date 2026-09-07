# Spécification Fonctionnelle

## Wheel Strategy Watchlist Tool — Intégration IBKR

**Version** : 1.5
**Date** : Septembre 2026
**Statut** : Validée pour passage en spec technique

---

## Table des matières

1. [Vue d'ensemble du projet](#1-vue-densemble-du-projet)
2. [Fonctionnalités — MoSCoW](#2-fonctionnalités--vue-densemble-moscow)
3. [Spécifications détaillées par module](#3-spécifications-détaillées-par-module)
4. [Stratégie de déploiement en 3 phases](#4-stratégie-de-déploiement-en-3-phases)
5. [Architecture de connexion IBKR](#5-architecture-de-connexion-ibkr)
6. [Sécurité](#6-sécurité)
7. [Base de données](#7-base-de-données)
8. [UI/UX](#8-uiux)
9. [Modèle de données — Entités fonctionnelles](#9-modèle-de-données--entités-fonctionnelles)
10. [Parcours utilisateur principal](#10-parcours-utilisateur-principal)
11. [Risques et contraintes](#11-risques-et-contraintes)
12. [Roadmap de développement](#12-roadmap-de-développement)
13. [Questions ouvertes](#13-questions-ouvertes)

---

## 1. Vue d'ensemble du projet

### 1.1 Objectif

Application web permettant de gérer une watchlist d'actions pour identifier des opportunités de vente de **Cash Secured Puts (CSP)** et **Covered Calls (CC)** dans le cadre de la stratégie **Wheel**, en utilisant les données en temps réel du compte Interactive Brokers (IBKR).

### 1.2 Périmètre du projet

- Usage **mono-utilisateur** (usage personnel, pas de support multi-tenant en v1)
- Application web accessible via navigateur
- Connexion à un unique compte IBKR (le compte personnel de l'utilisateur)
- **Analyse uniquement** : aucune exécution d'ordre depuis l'application en v1

### 1.3 Stack technique de référence

| Composant            | Technologie                                              |
| -------------------- | -------------------------------------------------------- |
| Frontend             | Next.js 14+ (App Router)                                 |
| Backend/API Routes   | Next.js API Routes                                       |
| Base de données      | PostgreSQL (Docker local → Neon en cible)                |
| ORM                  | Prisma                                                   |
| Broker API           | IBKR Client Portal Web API (via Client Portal Gateway)   |
| Authentification app | NextAuth.js + 2FA TOTP obligatoire                       |
| UI Components        | shadcn/ui + Tailwind CSS                                 |
| Graphiques           | Recharts ou TradingView Lightweight Charts               |
| Déploiement cible    | Vercel (frontend) + VPS dédié (Gateway IBKR) + Neon (DB) |

---

## 2. Fonctionnalités — Vue d'ensemble (MoSCoW)

### Must Have (v1 — MVP)

- Authentification IBKR (session via Gateway)
- Authentification applicative avec **2FA TOTP obligatoire**
- Gestion Watchlist (CRUD)
- Récupération données marché temps réel (prix, options chain)
- Filtres de base (Delta, DTE, Strike)
- Sélecteur de preset DTE (Weekly / Standard / Custom)
- Calcul rendement CSP/CC
- Affichage Options Chain
- Dashboard de synthèse

### Should Have (v1.5)

- IV Rank / IV Percentile historique
- Alertes (email)
- Scoring automatique des opportunités
- Historique des positions ouvertes (via IBKR)
- Vue comparative Weekly vs Standard DTE
- Tracking de performance par style de trading (TradeLog)

### Could Have (v2+)

- Exécution directe d'ordres depuis l'app
- Backtesting
- Alertes Discord/Telegram
- Recommandation intelligente de preset DTE selon profil utilisateur

### Won't Have (v1)

- Machine learning / prédictions
- Support multi-broker
- Application mobile native
- **Exécution d'ordres** (analyse uniquement, décision actée)
- **Support multi-utilisateurs** (nécessiterait une refonte architecturale majeure : une instance Gateway par utilisateur, gestion multi-comptes IBKR, isolation stricte des données — à traiter comme projet séparé si envisagé)
- **Infrastructure VPS payante en Phase 1** (repoussée après validation fonctionnelle complète)

---

## 3. Spécifications détaillées par module

### Module 1 : Authentification & Connexion IBKR

**User Story** : En tant qu'utilisateur, je veux me connecter à mon compte IBKR pour accéder à mes données de marché et mon portefeuille.

**Fonctionnalités :**

- Connexion via IBKR Client Portal Gateway (authentification manuelle via navigateur, 2FA IBKR natif)
- Vérification du statut de session (heartbeat requis toutes les < 60 secondes)
- Gestion de la reconnexion (notification si session expirée, nécessitant une ré-authentification manuelle)
- Affichage du statut de connexion dans l'UI (connecté/déconnecté)
- Monitoring/alerte en cas de déconnexion du Gateway

**Contraintes identifiées :**

- Le Gateway doit tourner en continu sur l'infrastructure active (local en Phase 1, VPS en Phase 3)
- Session généralement valide jusqu'à minuit (heure US Eastern) ou selon inactivité
- Un seul Gateway actif par compte IBKR à la fois
- Ré-authentification quotidienne probable (contrainte IBKR non contournable simplement)

---

### Module 2 : Authentification applicative (NextAuth + 2FA)

**User Story** : En tant qu'utilisateur, je veux protéger l'accès à mon outil par une authentification forte, indépendamment de l'authentification IBKR.

**Fonctionnalités :**

- Connexion via NextAuth (Credentials Provider)
- **2FA TOTP obligatoire** (compatible Google Authenticator, Authy, 1Password)
- Écran de setup initial du 2FA (QR code à scanner)
- Vérification du code TOTP à chaque connexion

**Principe d'architecture** : Deux couches d'authentification indépendantes et complémentaires :

```
1. Authentification APPLICATIVE (NextAuth + 2FA TOTP)
   → Protège l'accès à l'outil web lui-même

2. Authentification IBKR (Gateway + 2FA IBKR natif)
   → Protège l'accès aux données du compte de trading
   → Gérée entièrement par IBKR, indépendante de NextAuth
```

---

### Module 3 : Gestion de Watchlist

**User Story** : En tant qu'utilisateur, je veux créer et gérer des listes d'actions à surveiller pour la stratégie Wheel.

**Fonctionnalités :**

| Feature           | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| Créer watchlist   | Nommer et créer une nouvelle liste                         |
| Ajouter ticker    | Recherche par symbole (autocomplete via IBKR)              |
| Supprimer ticker  | Retirer un ticker de la liste                              |
| Catégorisation    | Tags custom : "Core", "Growth", "Speculative", "Blacklist" |
| Notes             | Champ texte libre par ticker (thèse d'investissement)      |
| Import/Export CSV | Bulk import/export de tickers                              |
| Multi-watchlists  | Créer plusieurs listes thématiques                         |
| Prix cible        | Champ optionnel indiquant le prix cible d'achat pour CSP   |

---

### Module 4 : Options Chain & Données de marché

**User Story** : En tant qu'utilisateur, je veux visualiser la chaîne d'options d'un ticker pour choisir un strike/expiration optimal.

**Fonctionnalités :**

- Sélecteur d'expiration (tabs horizontaux)
- Affichage tableau options chain : Strike, Bid, Ask, Last, Volume, Open Interest, Delta, Gamma, Theta, Vega, IV
- Filtre Puts / Calls (format chain traditionnel : Puts à gauche, Strike au centre, Calls à droite)
- Highlight automatique des strikes dans la zone delta cible (configurable, défaut 0.15–0.30)
- Prix sous-jacent en temps réel
- Distance % au prix actuel affichée par strike

---

### Module 5 : Calculateur de Rendement CSP/CC

**User Story** : En tant qu'utilisateur, je veux calculer automatiquement le rendement d'une position CSP/CC avant de la vendre.

**Métriques à calculer pour chaque option sélectionnée :**

| Métrique                    | Description                                       |
| --------------------------- | ------------------------------------------------- |
| Prime totale                | Bid × 100 (par contrat)                           |
| Collatéral requis (CSP)     | Strike × 100                                      |
| Rendement %                 | (Prime / Collatéral) × 100                        |
| Rendement annualisé         | Rendement % × (365 / DTE)                         |
| Break-even (CSP)            | Strike - Prime/share                              |
| Probabilité ITM (approx)    | Basé sur le Delta                                 |
| Max profit                  | Prime reçue                                       |
| Max loss (CSP)              | Strike - Prime (si action tombe à 0)              |
| Rendement net (après frais) | Rendement annualisé ajusté du coût de transaction |

**Affichage** : panneau latéral (Sheet) avec diagramme Profit/Loss visuel (breakeven, zone profit/perte colorée).

---

### Module 6 : Dashboard / Vue d'ensemble

**User Story** : En tant qu'utilisateur, je veux une vue synthétique de toutes les opportunités sur ma watchlist.

**Fonctionnalités :**

- Vue "Cards" par défaut (Ticker, Prix, Meilleur strike, Rendement annualisé, Delta, Badge de score coloré)
- Vue "Tableau dense" alternative pour scan rapide
- Tri/Filtre par rendement annualisé, delta, DTE
- Résumé du compte (buying power disponible via IBKR)
- Toggle de sélection du preset DTE affiché (Weekly / Standard / Vue comparative)

---

### Module 7 : Positions actuelles (Portfolio Sync)

**User Story** : En tant qu'utilisateur, je veux voir mes positions ouvertes (actions + options) synchronisées avec IBKR.

**Fonctionnalités :**

- Liste des positions actions détenues (candidates pour Covered Call)
- Liste des options vendues actuellement ouvertes (CSP/CC en cours)
- P&L latent par position
- Jours restants avant expiration
- Alerte visuelle si option proche de l'expiration (< 5 jours) ou proche ITM
- Indicateur visuel de seuil de gestion (21 DTE) pour les positions Standard (voir Module 9.2 — Règle 45-21)

---

### Module 8 : Système d'alertes (v1.5)

**Fonctionnalités :**

- Alerte email quand un ticker de la watchlist atteint un delta cible
- Alerte quand IV Rank dépasse un seuil configuré
- Alerte earnings imminents (J-5) sur un ticker en position
- Alerte de déconnexion du Gateway IBKR (monitoring technique)

> ⚠️ **Contrainte de disponibilité** : Ce module nécessite une session IBKR active en permanence (surveillance continue via cron job) pour détecter les conditions d'alerte à tout moment, y compris en dehors des heures d'utilisation active de l'application. Cela suppose que le Gateway IBKR tourne 24/7, ce qui **n'est pas garanti tant que celui-ci reste hébergé en local (Phase 1 et 2)**.
>
> **Le Module 8 est donc fonctionnellement dépendant de la Phase 3** (migration du Gateway vers un VPS dédié tournant en continu). Il ne peut pas être implémenté de manière fiable avant cette étape, même si le développement du code peut être anticipé.

---

### Module 9 : Multi-Strategy DTE Comparator

**User Story** : En tant qu'utilisateur, je veux comparer les opportunités CSP/CC selon différentes fenêtres de DTE (Weekly vs Monthly) pour choisir la stratégie la plus adaptée à mon style de trading et suivre mes performances par style.

#### 9.1 Sélecteur de presets DTE

| Preset    | Plage DTE   | Description                                         |
| --------- | ----------- | --------------------------------------------------- |
| Weekly    | 5–10 jours  | Rotation rapide, gestion active                     |
| Bi-Weekly | 10–21 jours | Compromis rendement/gestion                         |
| Standard  | 30–45 jours | Approche TastyTrade classique                       |
| Extended  | 45–60 jours | Moins de gestion, capital immobilisé plus longtemps |
| Custom    | 0–90 jours  | Plage personnalisée                                 |

#### 9.2 Vue comparative

Comparaison côte-à-côte (layout deux colonnes symétriques) pour un même ticker entre deux presets, incluant :

- Strike, prime, delta
- Rendement annualisé et rendement net (après frais)
- Break-even, théta par jour
- Nombre de trades estimés par an
- Frais de transaction annuels estimés
- Estimation qualitative du temps de gestion requis
- Recommandation automatique (bandeau visible, bordure colorée)

**Logique de recommandation :**

- Écart de rendement annualisé > seuil significatif (ex : 5 points) → privilégier le meilleur rendement
- Écart faible → privilégier la stratégie nécessitant le moins de gestion (Standard)
- Prise en compte de l'impact des frais de transaction, particulièrement significatif sur les primes faibles (weekly)

**Recommandation de gestion pratique — Règle "45-21" (approche TastyTrade) :**

Pour le preset **Standard (30-45 DTE)**, l'application doit intégrer et afficher la règle de gestion suivante, largement reconnue dans le milieu (issue des études statistiques TastyTrade) :

- **Ouverture** : vendre l'option autour de 45 DTE
- **Gestion/Clôture** : fermer ou rouler la position à **21 DTE**, indépendamment du niveau de profit atteint, afin de limiter l'exposition au risque gamma qui s'accélère fortement en dessous de ce seuil

Cette règle doit être matérialisée dans l'UI par :

- Un indicateur visuel sur les positions ouvertes (Module 7) signalant qu'une position approche ou dépasse le seuil des 21 DTE, l'invitant à une action de gestion
- Une mention explicative de cette règle dans l'aide contextuelle (tooltip) du preset Standard

#### 9.3 Tracking de performance par style (v1.5)

Suivi des trades exécutés avec :

- Style DTE utilisé, strike, prime, dates d'ouverture/fermeture
- Issue du trade (expiré / assigné / clôturé anticipé / roulé)
- P&L réalisé et rendement annualisé réel

Vue Analytics comparant les styles : nombre de trades, win rate, rendement moyen, rendement net, temps de gestion estimé, nombre d'assignations, avec insight textuel automatique.

#### 9.4 Recommandation intelligente selon profil (v2)

Suggestion automatique de preset DTE par défaut selon : temps disponible par semaine, tolérance au risque, taille du compte.

#### 9.5 Paramètres utilisateur additionnels

| Paramètre               | Valeur par défaut |
| ----------------------- | ----------------- |
| Preset DTE par défaut   | Standard          |
| Frais par contrat       | $0.65             |
| Delta cible min         | 0.15              |
| Delta cible max         | 0.30              |
| Jour de rotation weekly | Vendredi          |

---

## 4. Stratégie de déploiement en 3 phases

### Principe directeur

Développement **100% en local** dans un premier temps (aucune dépendance cloud), puis migration progressive et isolée composant par composant vers l'infrastructure cible.

### Phase 1 — Développement local complet

```
Votre PC :
    Next.js (localhost:3000)
    Client Portal Gateway IBKR (localhost:5000)
    PostgreSQL (Docker local)
```

- Objectif : valider l'ensemble des fonctionnalités métier sans dépendance cloud, coût nul
- Base de données PostgreSQL via Docker (même moteur que Neon, migration facilitée)
- Toute configuration pilotée par variables d'environnement (`.env.local`)

### Phase 2 — Migration de la base de données vers Neon

```
Votre PC :
    Next.js (localhost:3000)
    Client Portal Gateway IBKR (localhost:5000)
        ↓ HTTPS
Neon (Cloud) — PostgreSQL managé
```

- Seul changement requis : variable `DATABASE_URL`
- Aucune modification de code applicatif ni de schéma Prisma
- Permet de valider la connexion cloud dans un contexte encore simple à débugger, sans urgence de déploiement

### Phase 3 — Déploiement production complet

```
Vercel (Next.js prod)
        ↓ HTTPS
    ┌────┴──────────────┐
    ▼                     ▼
  Neon                 VPS dédié
  (inchangé)            Gateway IBKR
                         (Nginx + reverse proxy)
```

- Déploiement du code sur Vercel (variables d'environnement configurées dans le dashboard Vercel)
- Migration du Gateway IBKR du PC local vers un VPS dédié
- Neon reste totalement inchangé depuis la Phase 2

### Tableau récapitulatif

| Composant        | Phase 1 (Local)         | Phase 2 (DB Cloud)                  | Phase 3 (Prod complète)           |
| ---------------- | ----------------------- | ----------------------------------- | --------------------------------- |
| Frontend/Backend | localhost:3000          | localhost:3000                      | Vercel                            |
| Base de données  | Docker PostgreSQL local | Neon                                | Neon (inchangé)                   |
| Gateway IBKR     | localhost:5000          | localhost:5000                      | VPS                               |
| Coût             | 0€                      | 0€ (tier gratuit Neon)              | Coût VPS uniquement (~5-10€/mois) |
| Déclencheur      | —                       | Sécuriser les données / tester Neon | MVP validé et stable              |

### Principes techniques garantissant une migration transparente

1. **Aucun appel direct frontend → Gateway IBKR** : toujours via API Routes internes Next.js
2. **Configuration centralisée** dans un seul module lisant les variables d'environnement (pas de `process.env` dispersé dans le code)
3. **Schéma Prisma en PostgreSQL dès le premier jour** (pas de SQLite), garantissant zéro migration de schéma lors du passage à Neon
4. **Certificat SSL auto-signé du Gateway** accepté uniquement en développement, avec vérification stricte de l'environnement pour ne jamais désactiver la validation SSL en production
5. **Docker Compose** dès la Phase 1 pour la base de données locale, réutilisable comme base si auto-hébergement PostgreSQL sur VPS envisagé en repli

---

## 5. Architecture de connexion IBKR

### 5.1 APIs IBKR disponibles

| API                               | Type             | Adapté à ce projet                   |
| --------------------------------- | ---------------- | ------------------------------------ |
| **Client Portal Web API (CPAPI)** | REST + WebSocket | ✅ Retenue                           |
| TWS API                           | Socket natif     | Alternative si instabilité CPAPI     |
| FIX API                           | Protocole FIX    | Non pertinent (usage institutionnel) |
| Excel API (RTD)                   | COM/RTD          | Non pertinent                        |

### 5.2 Principe du Client Portal Gateway

Le Gateway (processus Java fourni par IBKR) fait l'intermédiaire entre l'application et les serveurs IBKR :

```
Application → Client Portal Gateway → Serveurs IBKR
```

Il gère l'authentification (login + 2FA), le maintien de session, et la traduction des appels REST.

### 5.3 Contraintes techniques à respecter

| Contrainte                      | Détail                                                                 |
| ------------------------------- | ---------------------------------------------------------------------- |
| Heartbeat obligatoire           | Requête de maintien de session toutes les < 60 secondes                |
| Session quotidienne             | Ré-authentification manuelle généralement nécessaire chaque jour       |
| 2FA IBKR                        | Complique l'automatisation du login initial (accepté comme contrainte) |
| Un seul Gateway actif à la fois | Par compte IBKR                                                        |
| Rate limits                     | Non documentés précisément, à gérer avec prudence (cache, throttling)  |

### 5.4 Architecture cible sécurisée (Phase 3)

```
Vercel (Frontend Next.js)
        ↓ HTTPS
VPS dédié :
    Nginx (reverse proxy, HTTPS, firewall)
        ↓
    Backend interne (API authentifiée)
        ↓ (localhost uniquement)
    Client Portal Gateway IBKR
        ↓ HTTPS
Serveurs IBKR
```

Le Gateway n'est **jamais exposé directement à Internet** : seul le backend interne, protégé par authentification, est accessible depuis le frontend.

---

## 6. Sécurité

### 6.1 Double couche d'authentification

| Couche                   | Rôle                                             |
| ------------------------ | ------------------------------------------------ |
| NextAuth + 2FA TOTP      | Protège l'accès à l'application elle-même        |
| Gateway IBKR + 2FA natif | Protège l'accès aux données du compte de trading |

### 6.2 Exigences de sécurité de la connexion IBKR

- Firewall du VPS : fermeture du port du Gateway à l'extérieur (accessible uniquement en localhost, Phase 3)
- HTTPS obligatoire sur toutes les communications externes
- Authentification SSH par clé uniquement (pas de mot de passe), Phase 3
- Aucun identifiant IBKR stocké dans le code ou la base de données (authentification manuelle via navigateur uniquement)
- Monitoring de la disponibilité du Gateway avec alerte en cas de déconnexion

**Détail du mécanisme de health check :**

| Aspect                           | Spécification                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Endpoint utilisé                 | Appel régulier à l'endpoint `/tickle` du Client Portal Gateway (endpoint natif IBKR de maintien de session)                |
| Fréquence de vérification        | Toutes les 30 à 45 secondes (marge de sécurité sous le seuil critique des 60 secondes)                                     |
| Détection de panne               | Absence de réponse ou réponse en erreur sur 2 vérifications consécutives → statut "déconnecté"                             |
| Canal de notification            | Notification visuelle immédiate dans l'UI (bandeau d'alerte) ; notification email si le Module Alertes est actif (Phase 3) |
| Action attendue de l'utilisateur | Ré-authentification manuelle via l'interface web du Gateway (`https://localhost:5000` en Phase 1/2, URL du VPS en Phase 3) |

### 6.3 Classification des données stockées

| Donnée                             | Stockage                    | Sensibilité         |
| ---------------------------------- | --------------------------- | ------------------- |
| Watchlist (tickers, tags, notes)   | Base de données             | Faible              |
| IV Rank historique                 | Base de données             | Faible              |
| Historique de trades (TradeLog)    | Base de données             | Élevée              |
| Identifiants IBKR                  | Non stockés                 | N/A                 |
| Positions actuelles / Buying power | Non stocké (temps réel)     | N/A                 |
| Session token IBKR                 | Temporaire (cookie/mémoire) | Élevée si mal gérée |

### 6.4 Exigences de protection des données

- Chiffrement au repos de la base de données
- Chiffrement en transit (SSL/TLS) pour toute connexion à la base de données
- Principe de moindre privilège pour l'utilisateur applicatif de la base de données
- Sauvegardes automatiques régulières, chiffrées si stockées séparément
- Aucune donnée sensible dans les logs applicatifs (pas de montants, positions en clair)
- Variables d'environnement sécurisées pour toute chaîne de connexion (jamais commitées dans le repository)

---

## 7. Base de données

### 7.1 Choix retenu : PostgreSQL (Docker local → Neon)

| Phase    | Solution                        |
| -------- | ------------------------------- |
| Phase 1  | PostgreSQL via Docker (local)   |
| Phase 2+ | Neon (cloud, PostgreSQL managé) |

### 7.2 Justification du choix Neon

| Critère              | Évaluation                                                                            |
| -------------------- | ------------------------------------------------------------------------------------- |
| Tier gratuit         | Généreux (0.5 GB storage, compute autosuspend), suffisant pour usage mono-utilisateur |
| Compatibilité Prisma | Excellente, PostgreSQL standard                                                       |
| Serverless-friendly  | Conçu nativement pour Vercel/serverless                                               |
| Cold start           | Léger délai (~1-2s) après inactivité sur tier gratuit, acceptable en usage perso      |
| Scalabilité future   | Migration fluide vers tier payant sans changement d'architecture                      |
| Branching de DB      | Possibilité de tester des migrations Prisma sans risque sur les données de prod       |

### 7.3 Comparaison avec les alternatives

| Provider        | Tier gratuit                                | Verdict                                                             |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| **Neon**        | Généreux, PostgreSQL pur                    | ✅ Retenu                                                           |
| Supabase        | Devenu payant au-delà d'un seuil restrictif | ❌ Écarté (fonctionnalités superflues, coût plus rapide qu'attendu) |
| Vercel Postgres | Très limité (basé sur Neon en interne)      | ❌ Moins généreux que Neon direct                                   |
| PlanetScale     | Plus de tier gratuit depuis 2024            | ❌ Non pertinent (MySQL)                                            |
| Railway         | Petit crédit gratuit puis payant            | ❌ Moins généreux long terme                                        |

---

## 8. UI/UX

### 8.1 Philosophie générale de design

- Densité d'information maîtrisée
- Lisibilité des chiffres (typographie monospace, alignement à droite)
- Codes couleur cohérents (vert/rouge universellement compris)
- Rapidité d'accès à l'information clé

### 8.2 Références du milieu

| Outil                | Inspiration retenue                                         |
| -------------------- | ----------------------------------------------------------- |
| ThinkOrSwim          | Structure de tableau options chain, code couleur des Greeks |
| TastyTrade           | Mise en avant du rendement/probabilité, cartes synthétiques |
| Bloomberg Terminal   | Hiérarchisation typographique (chiffres clés en gros)       |
| OptionAlpha          | Système de badges/scores visuels                            |
| Robinhood/Public.com | Diagramme Profit/Loss simple et visuel                      |

### 8.3 Recommandations par écran

**Dashboard principal**

- Vue "Cards" par défaut : Ticker, Prix (+ variation %), Meilleur strike, Rendement annualisé (mis en avant), Delta, Badge de score coloré
- Toggle vers vue "Tableau dense" pour utilisateurs avancés

**Options Chain**

- Format chain traditionnel (Puts gauche / Strike centre / Calls droite)
- Highlight de ligne au survol
- Zone colorée pour la plage de delta cible
- Tabs horizontaux pour les expirations

**Calculateur de rendement**

- Slide-over panel (Sheet) plutôt que modal plein écran
- Diagramme Profit/Loss en SVG/Canvas
- Métriques clés en gros caractères, secondaires en plus petit

**Vue comparative DTE**

- Layout deux colonnes symétriques (façon comparateur de produits)
- Bandeau de recommandation visible (bordure colorée, icône)

### 8.4 Palette de couleurs

| Usage                    | Couleur                                                  |
| ------------------------ | -------------------------------------------------------- |
| Gain / Zone delta cible  | Vert (`green-500`)                                       |
| Perte / Alerte           | Rouge (`red-500`)                                        |
| Neutre / Info secondaire | Gris (`gray-500`)                                        |
| Fond dashboard           | **Thème sombre par défaut** (standard du milieu trading) |

### 8.5 Composants shadcn/ui recommandés

| Composant         | Usage                                        |
| ----------------- | -------------------------------------------- |
| `Card`            | Dashboard synthèse par ticker                |
| `Table`           | Options Chain                                |
| `Tabs`            | Sélection expiration, toggle Weekly/Standard |
| `Badge`           | Score/recommandation visuelle                |
| `Sheet`           | Panel détail calculateur de rendement        |
| `Command` (Cmd+K) | Recherche rapide de ticker                   |
| `Tooltip`         | Explications des Greeks au survol            |

### 8.6 Fonctionnalité différenciante

**Command Palette (Cmd+K)** : navigation rapide vers l'options chain d'un ticker par simple recherche clavier, sans passer par un menu — améliore la rapidité d'usage pour une consultation quotidienne multiple.

---

## 9. Modèle de données — Entités fonctionnelles

| Entité          | Description                                                  |
| --------------- | ------------------------------------------------------------ |
| User            | Compte utilisateur de l'application (avec configuration 2FA) |
| Watchlist       | Liste nommée de tickers surveillés                           |
| WatchlistTicker | Ticker individuel avec tags, notes, prix cible               |
| IVHistory       | Historique quotidien de l'IV Rank par symbole                |
| Alert           | Configuration d'alerte (type, condition, statut)             |
| TradeLog        | Historique des trades exécutés avec métriques de performance |

---

## 10. Parcours utilisateur principal

```
1. Login application → Authentification NextAuth + validation code 2FA TOTP
2. Connexion IBKR → Vérification statut session Gateway
3. Dashboard → Vue synthétique watchlist selon preset DTE sélectionné
4. Clic sur ticker (ou Cmd+K) → Options Chain
5. Sélection strike/expiration → Calcul rendement affiché (Sheet panel)
6. Analyse de l'opportunité → Décision manuelle de l'utilisateur
7. Exécution de l'ordre directement sur la plateforme IBKR (hors app)
8. Retour Dashboard → Position visible dans "Positions actuelles" (sync IBKR)
```

---

## 11. Risques et contraintes

| Risque                                           | Impact             | Mitigation                                                                                                                                                            |
| ------------------------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session IBKR expire (Gateway doit rester up)     | Élevé              | Monitoring + reconnexion manuelle rapide                                                                                                                              |
| Rate limits IBKR API                             | Moyen              | Cache local des données, requêtes groupées                                                                                                                            |
| Pas d'IV historique natif dans IBKR API          | Moyen              | Stockage quotidien en DB (cron job)                                                                                                                                   |
| Complexité authentification 2FA IBKR             | Moyen              | Login manuel accepté comme contrainte, bien documenté                                                                                                                 |
| Application mono-utilisateur par design          | N/A (scope assumé) | Documenté comme limitation v1                                                                                                                                         |
| Fuite de données de trading (TradeLog)           | Modéré             | Chiffrement DB, accès restreint, backups sécurisés                                                                                                                    |
| Accès non autorisé à l'application               | Modéré             | 2FA TOTP obligatoire dès v1                                                                                                                                           |
| Dépendance PC local en Phase 1                   | Faible (assumé)    | Migration VPS prévue en Phase 3 dès validation MVP                                                                                                                    |
| **Module Alertes non fonctionnel avant Phase 3** | **Moyen**          | **Documenté explicitement : dépend d'un Gateway actif 24/7, donc conditionné à la migration VPS. Développement du code anticipable, mais activation réelle différée** |

---

## 12. Roadmap de développement

### Sprint 1 — Fondations (Phase 1 Local)

- Setup Next.js + Prisma + PostgreSQL (Docker local)
- Setup NextAuth avec 2FA TOTP obligatoire
- Setup IBKR Client Portal Gateway en local
- Module Authentification IBKR (test connexion basique)

### Sprint 2 — Watchlist & Data

- CRUD Watchlist
- Récupération prix temps réel
- Récupération Options Chain basique
- Sélecteur de preset DTE
- Premiers éléments UI (thème dark, structure Cards dashboard)

### Sprint 3 — Calculs & Dashboard

- Calculateur rendement CSP/CC (Sheet panel + diagramme P/L)
- Dashboard synthèse (Cards + Command Palette Cmd+K)
- UI Options Chain complète (format chain traditionnel)
- Vue comparative DTE

### Sprint 4 — Positions & Polish

- Module Positions actuelles
- Tests end-to-end
- Polish UI/UX (tooltips, badges de score, responsive)

### Phase 2 (post-Sprint 4, déclenchement manuel)

- Migration base de données locale → Neon

### Phase 3 (post-validation MVP stable)

- Déploiement Vercel
- Migration Gateway vers VPS
- Reverse proxy Nginx + sécurisation complète

### v1.5+ (post-MVP)

- Système d'alertes
- IV Rank historique
- Tracking de performance par style DTE (TradeLog complet)

---

## 13. Questions ouvertes — Réponses actées

1. **Librairie 2FA TOTP** : `otplib` ✅
2. **Provider email pour les alertes (v1.5)** : Gmail SMTP (via mot de passe d'application Gmail, pas de clé API classique) ✅
3. **Fournisseur VPS pour la Phase 3** : OVH ✅
4. **Niveau de granularité du TradeLog** : synchronisation automatique via l'historique d'ordres IBKR (nécessite un endpoint dédié de récupération d'historique d'ordres et une logique de mapping ordre → trade — voir spec technique section 9.4 à ajouter) ✅
5. **Alternative TWS API** : différée, à évaluer uniquement si CPAPI s'avère instable en usage réel — décision maintenue

---

_Fin du document — Spécification Fonctionnelle v1.5_
