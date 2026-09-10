# Découpage d'implémentation par lots

## Wheel Strategy Watchlist Tool — Intégration IBKR

**Version** : 1.1
**Date** : Septembre 2026
**Basé sur** : Spécification Fonctionnelle v1.5 + Spécification Technique v1.0
**Usage** : Brief de référence pour implémentation assistée par agent IA, lot par lot

---

## Principe d'utilisation de ce document

Chaque lot est conçu pour être soumis **indépendamment** à un agent IA, dans l'ordre indiqué. Ne pas passer au lot suivant tant que les critères d'acceptation du lot courant ne sont pas validés.

Chaque lot précise :

- Les modules/sections de la spec fonctionnelle et technique concernés
- Le périmètre exact (ce qui est inclus / exclus)
- Les critères d'acceptation
- Les cas de test à couvrir (alignés sur la section 14 de la spec technique)

---

## Lot 0 — Squelette du projet

**Spec concernée** : Spécification Technique — sections 1, 3, 12

### Périmètre

- Initialisation Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- `docker-compose.yml` pour PostgreSQL local
- Structure de dossiers complète (section 3 de la spec technique)
- Schéma Prisma initial limité à `User` et `UserSettings`
- Fichiers `.env.local` / `.env.example`

### Exclusions explicites

- Aucune logique métier, aucune UI fonctionnelle au-delà d'une page de test

### Critères d'acceptation

- [x] `npm run dev` démarre sans erreur
- [x] Le conteneur PostgreSQL démarre via `docker-compose up`
- [x] `npx prisma migrate dev` s'exécute avec succès sur le schéma initial
- [x] La structure de dossiers correspond exactement à celle de la section 3
- [x] Une page d'accueil minimale s'affiche en thème sombre

### Cas de test

- Test manuel : démarrage complet de l'environnement en suivant les étapes de la section 12

---

## Lot 1 — Authentification applicative

**Spec concernée** : Spécification Fonctionnelle — Module 2 · Spécification Technique — sections 5, 13.2

### Périmètre

- NextAuth Credentials Provider (email + mot de passe, hash **bcrypt**)
- Librairie TOTP retenue : **otplib**
- NextAuth Credentials Provider (email + mot de passe, hash bcrypt/argon2)
- Choix et intégration de la librairie TOTP (RFC 6238)
- Écran de setup 2FA avec génération de QR code
- Chiffrement du secret TOTP (AES-256-GCM) avant stockage — section 13.1
- Vérification du code TOTP avec fenêtre de tolérance ± 30 secondes
- Rate limiting sur les tentatives de vérification (5 tentatives / 15 min)
- Middleware de protection des routes (session complète requise)

### Exclusions explicites

- Aucune intégration IBKR à ce stade

### Critères d'acceptation

- [ ] Un utilisateur peut créer un compte et configurer son 2FA via QR code
- [ ] La connexion échoue sans code TOTP valide
- [ ] Le secret TOTP n'est jamais visible en clair en base de données
- [ ] Après 5 tentatives échouées, la vérification est bloquée temporairement
- [ ] Toute route du groupe `(dashboard)` redirige vers le login si la session n'est pas complète

### Cas de test

- Test unitaire : fonction de vérification TOTP (code valide, code expiré, code invalide)
- Test unitaire : chiffrement/déchiffrement du secret 2FA
- Test d'intégration : flow complet login → setup 2FA → vérification → session complète
- Test manuel : blocage après dépassement du rate limit

---

## Lot 2 — Client Gateway IBKR minimal (statut & heartbeat)

**Spec concernée** : Spécification Fonctionnelle — Module 1 · Spécification Technique — sections 6, 8

### Périmètre

- Module `ibkr-gateway/` : client HTTP typé, gestion du certificat auto-signé (dev uniquement, vérification stricte de `NODE_ENV`)
- Endpoint `/api/ibkr/status` (statut de session brut)
- Endpoint `/api/ibkr/health` (statut applicatif normalisé + latence)
- Mécanisme de heartbeat (appel toutes les 30-45 secondes)
- Bascule "déconnecté" après 2 échecs consécutifs
- Badge de statut de connexion dans l'UI (polling via TanStack Query)
- Récupération dynamique de l'`accountId` actif (ne jamais le coder en dur)

### Exclusions explicites

- Aucune donnée de marché, aucune chaîne d'options, aucune position
- Pas de notification email (dépend du Module Alertes, hors périmètre v1 initial)

### Note sur l'environnement de test

L'ensemble des Lots 0 à 8 doit être développé et validé contre un **compte IBKR Paper Trading (démo)**, dont le mécanisme d'authentification (login + 2FA) et le format des réponses API sont strictement identiques à un compte réel. Les points de vigilance suivants sont à garder en tête pendant le développement, sans être bloquants :

- **Données de marché** : potentiellement différées selon les abonnements associés au compte réel lié
- **Stabilité de session** : possiblement légèrement moins stable qu'un compte réel (non documenté officiellement, à valider empiriquement)
- **Reset périodique** : IBKR peut réinitialiser le capital/positions du compte paper à intervalles non garantis — ne pas se fier aux données accumulées en paper comme référence long terme
- **Exécution d'ordres** : non pertinent, l'application reste en analyse uniquement (aucun ordre n'est jamais passé depuis l'app)

Le passage à un compte réel en fin de parcours ne nécessite qu'un changement d'identifiants de connexion, aucune modification de code applicatif.

### Critères d'acceptation

- [ ] Le badge affiche "connecté" quand le Gateway local répond
- [ ] Le badge bascule en "déconnecté" après 2 échecs consécutifs simulés
- [ ] Aucun appel direct au Gateway n'est effectué depuis le navigateur (vérifiable via l'onglet réseau)
- [ ] Le certificat auto-signé n'est accepté qu'en environnement de développement
- [ ] L'`accountId` actif est récupéré dynamiquement, jamais codé en dur

### Cas de test

- Test unitaire : logique de détection de panne (2 échecs consécutifs → statut déconnecté)
- Test manuel : arrêt volontaire du Gateway local → vérification du changement de badge dans les 90 secondes
- Test manuel : vérification que `NODE_ENV=production` rejette le certificat auto-signé

> ⚠️ **Point d'attention** : ce lot est le plus risqué techniquement (dépendance à un compte IBKR réel et au 2FA IBKR natif). Ne pas avancer sur les lots suivants tant que ce lot n'est pas validé de façon stable sur plusieurs jours d'utilisation réelle.

---

## Lot 3 — Gestion de Watchlist

**Spec concernée** : Spécification Fonctionnelle — Module 3 · Spécification Technique — sections 4, 7

### Périmètre

- Schéma Prisma : `Watchlist`, `WatchlistTicker` (avec contrainte d'unicité `(watchlistId, symbol)`)
- Endpoints CRUD `/api/watchlists` (validation Zod stricte)
- Recherche de ticker avec autocomplete (appel au Gateway pour résolution du conid)
- UI : création/suppression de watchlist, ajout/suppression de ticker, tags, notes, prix cible
- Import/Export CSV

### Exclusions explicites

- Aucune donnée de marché en temps réel affichée à ce stade (juste le symbole résolu)

### Critères d'acceptation

- [ ] Un utilisateur peut créer plusieurs watchlists et y ajouter des tickers
- [ ] L'ajout d'un ticker déjà présent dans la même watchlist est rejeté
- [ ] L'import CSV ajoute correctement les tickers avec gestion des doublons
- [ ] Les tags et notes sont persistés et réaffichés après rechargement

### Cas de test

- Test d'intégration : CRUD complet sur `/api/watchlists` avec base de données de test isolée
- Test unitaire : validation Zod des payloads (cas valides et invalides)
- Test manuel : import CSV avec fichier contenant des doublons volontaires

---

## Lot 4 — Données de marché & Options Chain

**Spec concernée** : Spécification Fonctionnelle — Module 4 · Spécification Technique — sections 6, 7

### Périmètre

- Endpoints `/api/ibkr/market-data`, `/api/ibkr/options-chain`
- UI Options Chain (format traditionnel Puts/Strike/Calls, tabs d'expiration)
- Highlight automatique de la zone delta cible (0.15–0.30 configurable)
- Distance % au prix actuel par strike

### Exclusions explicites

- Pas de calcul de rendement à ce stade (Lot 5)

### Critères d'acceptation

- [ ] La chaîne d'options s'affiche correctement pour un ticker de la watchlist
- [ ] Le changement d'expiration met à jour le tableau sans rechargement de page
- [ ] Les strikes dans la zone delta cible sont visuellement mis en évidence
- [ ] Les erreurs Gateway sont affichées sous forme normalisée, jamais brute

### Cas de test

- Test d'intégration : endpoint options-chain avec réponse Gateway simulée (mock)
- Test manuel : comportement UI en cas d'erreur Gateway (déconnexion pendant consultation)

---

## Lot 5 — Calculateur de rendement CSP/CC

**Spec concernée** : Spécification Fonctionnelle — Module 5 · Spécification Technique — section 9.1, section 14

### Périmètre

- Fonction pure de calcul isolée dans `lib/domain-services/` : prime totale, collatéral, rendement brut, rendement annualisé, rendement net après frais, break-even, max profit/loss
- **Tests unitaires livrés en même temps que la fonction**, pas après
- Sheet panel (slide-over) affichant les résultats
- Diagramme Profit/Loss (SVG/Canvas ou Recharts)

### Exclusions explicites

- Aucune connexion IBKR directe dans cette fonction (elle reçoit des paramètres déjà résolus)

### Critères d'acceptation

- [ ] La fonction de calcul est 100% pure (aucun effet de bord, aucun appel réseau/DB)
- [ ] La couverture de test de cette fonction est proche de l'exhaustivité (cf. section 14)
- [ ] Le Sheet panel affiche toutes les métriques listées en section 9.1 de la spec fonctionnelle
- [ ] Le diagramme P/L reflète correctement le breakeven et les zones profit/perte

### Cas de test **(obligatoires avant de considérer le lot terminé)**

- Test unitaire : cas CSP standard (prime, strike, DTE positifs)
- Test unitaire : cas CC standard
- Test unitaire : cas limite DTE = 0 (division par zéro à éviter)
- Test unitaire : cas avec frais de transaction supérieurs à la prime (rendement net négatif)
- Test unitaire : cas avec delta extrême (proche de 0 et proche de 1)
- Test manuel : cohérence visuelle du diagramme P/L pour un cas CSP et un cas CC

---

## Lot 6 — Dashboard de synthèse

**Spec concernée** : Spécification Fonctionnelle — Module 6 · Spécification Technique — section 10.3

### Périmètre

- Vue "Cards" par défaut + toggle vue "Tableau dense"
- Tri/filtre par rendement annualisé, delta, DTE
- Résumé de compte (buying power) via `/api/ibkr/account-summary`
- Command Palette (Cmd+K) pour navigation rapide vers l'Options Chain d'un ticker

### Critères d'acceptation

- [ ] Le dashboard affiche une carte par ticker de la watchlist active avec ses métriques clés
- [ ] Le toggle Cards/Tableau fonctionne sans perte de données ni de filtre actif
- [ ] Cmd+K ouvre la Command Palette et permet de naviguer vers un ticker en 2 actions maximum
- [ ] Le buying power affiché correspond à la donnée IBKR en temps réel

### Cas de test

- Test manuel : tri par rendement annualisé décroissant, vérification de l'ordre
- Test manuel : recherche via Command Palette avec un symbole partiel

---

## Lot 7 — Multi-Strategy DTE Comparator

**Spec concernée** : Spécification Fonctionnelle — Module 9 (9.1, 9.2, 9.5) · Spécification Technique — section 9.2, 9.3

### Périmètre

- Sélecteur de presets DTE (Weekly, Bi-Weekly, Standard, Extended, Custom)
- Fonction de calcul DTE + détection du seuil de gestion 21 jours (règle 45-21)
- Logique de recommandation (écart de rendement net annualisé)
- Vue comparative deux colonnes symétriques + bandeau de recommandation avec justification textuelle
- Paramètres utilisateur (section 9.5) : frais par contrat, delta cible min/max, jour de rotation

### Critères d'acceptation

- [ ] Le changement de preset met à jour les strikes suggérés en cohérence avec la plage DTE
- [ ] La recommandation automatique affiche une justification textuelle explicite
- [ ] La règle 45-21 est correctement appliquée : recommandation de gestion visible dès 21 DTE ou moins pour le preset Standard
- [ ] Les paramètres utilisateur sont persistés et repris lors des calculs suivants

### Cas de test

- Test unitaire : fonction de détection du seuil 21 DTE (cas 22, 21, 20 jours)
- Test unitaire : logique de recommandation (écart significatif vs écart faible, seuils limites)
- Test manuel : vue comparative avec deux tickers différents

---

## Lot 8 — Positions actuelles (Portfolio Sync)

**Spec concernée** : Spécification Fonctionnelle — Module 7 · Spécification Technique — section 7

### Périmètre

- Endpoint `/api/ibkr/positions`
- Liste des positions actions détenues + options ouvertes (CSP/CC)
- P&L latent par position
- Indicateur visuel de seuil 21 DTE (réutilisation de la fonction du Lot 7)
- Alerte visuelle si option proche ITM ou < 5 jours avant expiration

### Critères d'acceptation

- [ ] Les positions affichées correspondent exactement à celles visibles dans le compte IBKR
- [ ] L'indicateur de seuil 21 DTE s'affiche correctement sur les positions concernées
- [ ] Le P&L latent se met à jour à chaque rafraîchissement de la page

### Cas de test

- Test d'intégration : endpoint positions avec réponse Gateway simulée (mock)
- Test manuel : comparaison des positions affichées avec le compte IBKR réel (ou paper)

---

## Lot 9 — Migration Phase 2 puis Phase 3

**Spec concernée** : Spécification Technique — section 16 (checklist complète)

### Périmètre

- Phase 2 : migration de la base de données locale vers Neon (aucune modification de code)
- Phase 3 : déploiement Vercel, migration du Gateway vers VPS, reverse proxy Nginx, activation des jobs Vercel Cron

### Critères d'acceptation

- [ ] Toutes les fonctionnalités des Lots 0 à 8 fonctionnent sans régression après migration vers Neon
- [ ] Le Gateway répond correctement depuis le VPS via le reverse proxy
- [ ] Le port du Gateway n'est pas accessible directement depuis Internet
- [ ] Les jobs Vercel Cron s'exécutent selon la fréquence définie en section 8.3 de la spec technique

### Cas de test

- Test manuel : suivre intégralement la checklist de la section 16, point par point
- Test manuel : tentative d'accès direct au port du Gateway depuis l'extérieur (doit échouer)

---

## Récapitulatif — Ordre de dépendance entre lots

```
Lot 0 (squelette)
   ↓
Lot 1 (auth applicative)
   ↓
Lot 2 (Gateway IBKR minimal) ⚠️ point de validation critique
   ↓
Lot 3 (watchlist) ──┐
   ↓                 │
Lot 4 (options chain)│
   ↓                 │
Lot 5 (calculateur)  │  Lots 3-8 dépendent tous du Lot 2 stabilisé
   ↓                 │
Lot 6 (dashboard)     │
   ↓                 │
Lot 7 (DTE comparator)│
   ↓                 │
Lot 8 (positions) ────┘
   ↓
Lot 9 (migration Phase 2 → Phase 3)
```

---

*Fin du document — Découpage d'implémentation v1.1*