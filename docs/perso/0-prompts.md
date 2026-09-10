# Prompts d'implémentation par lot

## Wheel Strategy Watchlist Tool — Intégration IBKR

**Version** : 1.0
**Date** : Septembre 2026
**Usage** : Prompts prêts à soumettre à l'agent IA, un lot à la fois, dans l'ordre indiqué. Ne pas passer au lot suivant tant que les critères d'acceptation du lot courant ne sont pas validés.

---

## Principe d'utilisation

1. Copier-coller le prompt du lot concerné dans une conversation avec l'agent IA
2. Attacher les fichiers de référence mentionnés (spec fonctionnelle, spec technique, découpage par lots, schéma Prisma, conventions)
3. Valider manuellement les critères d'acceptation avant de passer au lot suivant
4. Cocher les cases dans `3-decoupage-par-lots.md` une fois validées

---

## Prompt — Lot 0 : Squelette du projet

```markdown
Je démarre l'implémentation du **Lot 0 — Squelette du projet** de mon application "Wheel Strategy Watchlist Tool".

## Contexte

Je te fournis les documents de référence suivants (à consulter en pièces jointes) :

- `1-spec-onctionnelle.md`
- `2-spec-technique.md`
- `3-decoupage-par-lots.md`
- `4-conventions.md`
- `prisma/schema.prisma` (déjà rédigé, à utiliser tel quel)

## Périmètre du Lot 0 (spec technique — sections 1, 3, 12)

Merci d'implémenter uniquement ce qui suit, rien de plus :

1. Initialisation du projet Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
2. Structure de dossiers complète exactement conforme à la section 3 de la spec technique
3. `docker-compose.yml` définissant un service PostgreSQL 16.x local
4. Intégration du schéma Prisma fourni (`prisma/schema.prisma`) — ne pas le modifier, juste l'intégrer et générer la première migration
5. Fichier `.env.local.example` listant les variables d'environnement nécessaires à ce stade (connexion DB uniquement)
6. Page d'accueil minimale en thème sombre par défaut (texte de bienvenue, aucune logique)
7. Configuration ESLint + Prettier selon `CONVENTIONS.md`
8. Alias d'import `@/` pointant vers `src/`

## Exclusions explicites

- Aucune logique métier
- Aucune authentification
- Aucune intégration IBKR
- Aucun composant UI fonctionnel au-delà de la page de test

## Critères d'acceptation à respecter

- [ ] `npm run dev` démarre sans erreur
- [ ] Le conteneur PostgreSQL démarre via `docker-compose up`
- [ ] `npx prisma migrate dev` s'exécute avec succès sur le schéma fourni
- [ ] La structure de dossiers correspond exactement à celle de la section 3 de la spec technique
- [ ] Une page d'accueil minimale s'affiche en thème sombre

## Conventions à respecter

- Code en anglais, commentaires en français (cf. `CONVENTIONS.md`)
- Nommage PascalCase pour les composants, kebab-case pour les utilitaires

## Ce que j'attends de toi

1. Propose la liste des fichiers que tu vas créer/modifier avant de commencer
2. Implémente le Lot 0 complet
3. Donne les commandes exactes à exécuter (Windows) pour valider chaque critère d'acceptation
4. Ne passe pas au Lot 1 — je validerai ce lot avant de donner le prompt suivant
```

---

## Prompt — Lot 1 : Authentification applicative

```markdown
Je démarre l'implémentation du **Lot 1 — Authentification applicative** de mon application "Wheel Strategy Watchlist Tool".

Le Lot 0 est validé et mergé sur `main`. Je travaille désormais sur la branche `feature/lot-1-auth`.

## Contexte

Documents de référence : `Spécification Fonctionnelle.md` (Module 2), `Spécification Technique.md` (sections 5, 13.2), `3-decoupage-par-lots.md` (Lot 1), `CONVENTIONS.md`.

## Périmètre du Lot 1

1. NextAuth Credentials Provider (email + mot de passe, hash **bcrypt**)
2. Intégration de la librairie TOTP **otplib**
3. Écran de setup 2FA avec génération de QR code
4. Chiffrement du secret TOTP (AES-256-GCM) avant stockage en base — jamais en clair
5. Vérification du code TOTP avec fenêtre de tolérance ± 30 secondes
6. Rate limiting sur les tentatives de vérification (5 tentatives / 15 minutes)
7. Middleware de protection des routes du groupe `(dashboard)` (session complète requise)

## Exclusions explicites

- Aucune intégration IBKR à ce stade

## Critères d'acceptation à respecter

- [ ] Un utilisateur peut créer un compte et configurer son 2FA via QR code
- [ ] La connexion échoue sans code TOTP valide
- [ ] Le secret TOTP n'est jamais visible en clair en base de données
- [ ] Après 5 tentatives échouées, la vérification est bloquée temporairement
- [ ] Toute route du groupe `(dashboard)` redirige vers le login si la session n'est pas complète

## Cas de test à livrer avec le code

- Test unitaire : vérification TOTP (code valide, expiré, invalide)
- Test unitaire : chiffrement/déchiffrement du secret 2FA
- Test d'intégration : flow complet login → setup 2FA → vérification → session complète
- Test manuel à documenter : blocage après dépassement du rate limit

## Ce que j'attends de toi

1. Liste des fichiers créés/modifiés avant de commencer
2. Implémentation complète + tests unitaires/intégration
3. Commandes pour exécuter les tests (Windows)
4. Étapes de test manuel à réaliser de mon côté
5. Ne pas démarrer le Lot 2
```

---

## Prompt — Lot 2 : Client Gateway IBKR minimal ⚠️

```markdown
Je démarre l'implémentation du **Lot 2 — Client Gateway IBKR minimal (statut & heartbeat)**.

Le Lot 1 est validé et mergé. Je travaille sur la branche `feature/lot-2-ibkr-gateway`.

J'ai déjà validé manuellement la connexion au Client Portal Gateway avec mon compte IBKR Paper Trading (login + 2FA IBKR natif fonctionnels sur `https://localhost:5000`).

## Contexte

Documents de référence : `Spécification Fonctionnelle.md` (Module 1), `Spécification Technique.md` (sections 6, 8), `3-decoupage-par-lots.md` (Lot 2).

## Périmètre du Lot 2

1. Module `lib/ibkr-gateway/` : client HTTP typé
   - Acceptation du certificat auto-signé **uniquement** si `NODE_ENV=development`
   - Récupération dynamique de l'`accountId` actif (jamais codé en dur)
2. Endpoint `/api/ibkr/status` (statut de session brut du Gateway)
3. Endpoint `/api/ibkr/health` (statut normalisé + latence mesurée)
4. Mécanisme de heartbeat (appel toutes les 30-45 secondes) au endpoint de maintien de session du Gateway
5. Bascule automatique en statut "déconnecté" après 2 échecs consécutifs
6. Badge de statut de connexion dans l'UI, avec polling via TanStack Query

## Exclusions explicites

- Aucune donnée de marché, aucune chaîne d'options, aucune position
- Pas de notification email (Module Alertes hors périmètre à ce stade)

## Critères d'acceptation à respecter

- [ ] Le badge affiche "connecté" quand le Gateway local répond
- [ ] Le badge bascule en "déconnecté" après 2 échecs consécutifs simulés
- [ ] Aucun appel direct au Gateway n'est effectué depuis le navigateur (vérifiable via l'onglet réseau)
- [ ] Le certificat auto-signé n'est accepté qu'en environnement de développement
- [ ] L'`accountId` actif est récupéré dynamiquement

## Cas de test à livrer avec le code

- Test unitaire : logique de détection de panne (2 échecs consécutifs → statut déconnecté)
- Test manuel à documenter : arrêt volontaire du Gateway → vérification du changement de badge dans les 90 secondes
- Test manuel à documenter : vérification du rejet du certificat en mode production

## Point de vigilance

Ce lot est le plus critique du projet (dépendance à un service externe réel). Merci de gérer explicitement tous les cas d'erreur réseau (timeout, Gateway éteint, session expirée) sans jamais faire planter l'application.

## Ce que j'attends de toi

1. Liste des fichiers créés/modifiés
2. Implémentation complète + tests
3. Instructions précises pour que je teste manuellement avec mon Gateway réel en local
4. Ne pas démarrer le Lot 3 tant que je n'ai pas confirmé une stabilité sur plusieurs jours d'usage
```

---

## Prompt — Lot 3 : Gestion de Watchlist

```markdown
Je démarre l'implémentation du **Lot 3 — Gestion de Watchlist**.

Le Lot 2 est validé et stable depuis plusieurs jours. Je travaille sur la branche `feature/lot-3-watchlist`.

## Contexte

Documents de référence : `Spécification Fonctionnelle.md` (Module 3), `Spécification Technique.md` (sections 4, 7), `3-decoupage-par-lots.md` (Lot 3).

## Périmètre du Lot 3

1. Endpoints CRUD `/api/watchlists` (validation Zod stricte sur tous les payloads)
2. Recherche de ticker avec autocomplete, appelant le Gateway (module du Lot 2) pour résoudre le `conid`
3. UI :
   - Création/suppression de watchlist
   - Ajout/suppression de ticker (tag, notes, prix cible)
4. Import/Export CSV des tickers d'une watchlist

## Exclusions explicites

- Aucune donnée de marché en temps réel affichée (juste le symbole résolu et le conid)

## Critères d'acceptation à respecter

- [ ] Un utilisateur peut créer plusieurs watchlists et y ajouter des tickers
- [ ] L'ajout d'un ticker déjà présent dans la même watchlist est rejeté (contrainte d'unicité respectée)
- [ ] L'import CSV ajoute correctement les tickers avec gestion des doublons
- [ ] Les tags et notes sont persistés et réaffichés après rechargement

## Cas de test à livrer avec le code

- Test d'intégration : CRUD complet sur `/api/watchlists` avec base de données de test isolée
- Test unitaire : validation Zod des payloads (cas valides et invalides)
- Test manuel à documenter : import CSV avec fichier contenant des doublons volontaires

## Ce que j'attends de toi

1. Liste des fichiers créés/modifiés
2. Implémentation complète + tests
3. Commandes pour exécuter les tests
4. Ne pas démarrer le Lot 4
```

---

## Prompt — Lot 4 : Données de marché & Options Chain

```markdown
Je démarre l'implémentation du **Lot 4 — Données de marché & Options Chain**.

Le Lot 3 est validé et mergé. Je travaille sur la branche `feature/lot-4-options-chain`.

## Contexte

Documents de référence : `Spécification Fonctionnelle.md` (Module 4), `Spécification Technique.md` (sections 6, 7), `3-decoupage-par-lots.md` (Lot 4).

## Périmètre du Lot 4

1. Endpoints `/api/ibkr/market-data` et `/api/ibkr/options-chain`
2. UI Options Chain :
   - Format traditionnel Puts/Strike/Calls
   - Tabs de sélection d'expiration
3. Highlight automatique de la zone delta cible (configurable, valeurs par défaut 0.15–0.30 depuis `UserSettings`)
4. Affichage de la distance en % au prix actuel par strike

## Exclusions explicites

- Aucun calcul de rendement à ce stade (réservé au Lot 5)

## Critères d'acceptation à respecter

- [ ] La chaîne d'options s'affiche correctement pour un ticker de la watchlist
- [ ] Le changement d'expiration met à jour le tableau sans rechargement de page
- [ ] Les strikes dans la zone delta cible sont visuellement mis en évidence
- [ ] Les erreurs Gateway sont affichées sous forme normalisée, jamais brute

## Cas de test à livrer avec le code

- Test d'intégration : endpoint options-chain avec réponse Gateway simulée (mock)
- Test manuel à documenter : comportement UI en cas de déconnexion du Gateway pendant la consultation

## Ce que j'attends de toi

1. Liste des fichiers créés/modifiés
2. Implémentation complète + tests
3. Ne pas démarrer le Lot 5
```

---

## Prompt — Lot 5 : Calculateur de rendement CSP/CC ⚠️

```markdown
Je démarre l'implémentation du **Lot 5 — Calculateur de rendement CSP/CC**.

Le Lot 4 est validé et mergé. Je travaille sur la branche `feature/lot-5-calculator`.

## Contexte

Documents de référence : `Spécification Fonctionnelle.md` (Module 5), `Spécification Technique.md` (section 9.1, section 14), `3-decoupage-par-lots.md` (Lot 5).

## Périmètre du Lot 5

1. Fonction pure de calcul isolée dans `lib/domain-services/yield-calculator.ts` :
   - Prime totale perçue
   - Collatéral requis (cas CSP)
   - Rendement brut en %
   - Rendement annualisé (base 365 jours)
   - Rendement net après frais de transaction + équivalent annualisé
   - Prix de break-even
   - Profit maximum et perte maximum théorique
2. **Tests unitaires livrés en même temps que la fonction, pas après**
3. Sheet panel (slide-over) affichant les résultats du calcul
4. Diagramme Profit/Loss (Recharts) généré dynamiquement à partir des résultats

## Exigence non négociable

La fonction de calcul doit être **100% pure** : aucun effet de bord, aucun appel réseau, aucun accès base de données. Elle reçoit uniquement des paramètres (strike, prime, DTE, contrats, frais, type CSP/CC) et retourne un objet de résultats.

## Exclusions explicites

- Aucune connexion IBKR directe dans cette fonction

## Critères d'acceptation à respecter

- [ ] La fonction de calcul est 100% pure et testable indépendamment
- [ ] La couverture de test de cette fonction est proche de l'exhaustivité
- [ ] Le Sheet panel affiche toutes les métriques listées ci-dessus
- [ ] Le diagramme P/L reflète correctement le breakeven et les zones profit/perte

## Cas de test obligatoires (à livrer avant de considérer le lot terminé)

- [ ] Cas CSP standard (prime, strike, DTE positifs)
- [ ] Cas CC standard
- [ ] Cas limite DTE = 0 (éviter toute division par zéro)
- [ ] Cas avec frais de transaction supérieurs à la prime (rendement net négatif)
- [ ] Cas avec delta extrême (proche de 0 et proche de 1)
- [ ] Test manuel à documenter : cohérence visuelle du diagramme P/L pour un cas CSP et un cas CC

## Ce que j'attends de toi

1. Livrer la fonction de calcul et TOUS les tests unitaires listés ci-dessus dans la même réponse
2. Ne pas passer à l'UI (Sheet panel) tant que je n'ai pas confirmé que les tests unitaires couvrent bien tous les cas
3. Une fois la fonction validée, implémenter le Sheet panel et le diagramme
4. Ne pas démarrer le Lot 6
```

---

## Prompt — Lot 6 : Dashboard de synthèse

```markdown
Je démarre l'implémentation du **Lot 6 — Dashboard de synthèse**.

Le Lot 5 est validé et mergé. Je travaille sur la branche `feature/lot-6-dashboard`.

## Contexte

Documents de référence : `Spécification Fonctionnelle.md` (Module 6), `Spécification Technique.md` (section 10.3), `3-decoupage-par-lots.md` (Lot 6).

## Périmètre du Lot 6

1. Vue "Cards" par défaut + toggle vers vue "Tableau dense"
2. Tri/filtre par rendement annualisé, delta, DTE
3. Résumé de compte (buying power) via endpoint `/api/ibkr/account-summary`
4. Command Palette (raccourci Cmd+K / Ctrl+K) pour navigation rapide vers l'Options Chain d'un ticker

## Critères d'acceptation à respecter

- [ ] Le dashboard affiche une carte par ticker de la watchlist active avec ses métriques clés
- [ ] Le toggle Cards/Tableau fonctionne sans perte de données ni de filtre actif
- [ ] Ctrl+K ouvre la Command Palette et permet de naviguer vers un ticker en 2 actions maximum
- [ ] Le buying power affiché correspond à la donnée IBKR en temps réel

## Cas de test à livrer avec le code

- Test manuel à documenter : tri par rendement annualisé décroissant, vérification de l'ordre
- Test manuel à documenter : recherche via Command Palette avec un symbole partiel

## Ce que j'attends de toi

1. Liste des fichiers créés/modifiés
2. Implémentation complète
3. Ne pas démarrer le Lot 7
```

---

## Prompt — Lot 7 : Multi-Strategy DTE Comparator

```markdown
Je démarre l'implémentation du **Lot 7 — Multi-Strategy DTE Comparator**.

Le Lot 6 est validé et mergé. Je travaille sur la branche `feature/lot-7-dte-comparator`.

## Contexte

Documents de référence : `Spécification Fonctionnelle.md` (Module 9, sections 9.1, 9.2, 9.5), `Spécification Technique.md` (sections 9.2, 9.3), `3-decoupage-par-lots.md` (Lot 7).

## Périmètre du Lot 7

1. Sélecteur de presets DTE (Weekly, Bi-Weekly, Standard, Extended, Custom)
2. Fonction de calcul DTE + détection du seuil de gestion à 21 jours (règle 45-21)
3. Logique de recommandation basée sur l'écart de rendement net annualisé entre deux presets
4. Vue comparative deux colonnes symétriques + bandeau de recommandation avec justification textuelle explicite
5. Paramètres utilisateur persistés (`UserSettings`) : frais par contrat, delta cible min/max, jour de rotation

## Critères d'acceptation à respecter

- [ ] Le changement de preset met à jour les strikes suggérés en cohérence avec la plage DTE
- [ ] La recommandation automatique affiche une justification textuelle explicite
- [ ] La règle 45-21 est correctement appliquée (recommandation de gestion visible dès 21 DTE ou moins pour le preset Standard)
- [ ] Les paramètres utilisateur sont persistés et repris lors des calculs suivants

## Cas de test à livrer avec le code

- Test unitaire : fonction de détection du seuil 21 DTE (cas 22, 21, 20 jours)
- Test unitaire : logique de recommandation (écart significatif vs écart faible, seuils limites)
- Test manuel à documenter : vue comparative avec deux tickers différents

## Ce que j'attends de toi

1. Liste des fichiers créés/modifiés + tests
2. Implémentation complète
3. Ne pas démarrer le Lot 8
```

---

## Prompt — Lot 8 : Positions actuelles (Portfolio Sync)

```markdown
Je démarre l'implémentation du **Lot 8 — Positions actuelles (Portfolio Sync)**.

Le Lot 7 est validé et mergé. Je travaille sur la branche `feature/lot-8-positions`.

## Contexte

Documents de référence : `Spécification Fonctionnelle.md` (Module 7), `Spécification Technique.md` (section 7, section 9.4), `3-decoupage-par-lots.md` (Lot 8).

## Périmètre du Lot 8

1. Endpoint `/api/ibkr/positions` (positions actions + options ouvertes CSP/CC)
2. P&L latent par position
3. Indicateur visuel de seuil 21 DTE (réutilisation de la fonction du Lot 7)
4. Alerte visuelle si option proche ITM ou expiration < 5 jours
5. Synchronisation automatique du TradeLog via l'historique d'ordres IBKR (`/api/ibkr/order-history`), conformément à la section 9.4 de la spec technique :
   - Mapping ordre STO → ouverture TradeLog
   - Mapping ordre BTC/expiration/assignation → clôture TradeLog
   - Rapprochement par symbole, strike, expiration, type d'option
   - Job cron quotidien de synchronisation

## Critères d'acceptation à respecter

- [ ] Les positions affichées correspondent exactement à celles visibles dans le compte IBKR (paper)
- [ ] L'indicateur de seuil 21 DTE s'affiche correctement sur les positions concernées
- [ ] Le P&L latent se met à jour à chaque rafraîchissement de la page
- [ ] Le TradeLog se synchronise automatiquement sans doublon (contrainte d'unicité sur `ibkrOpenOrderId`/`ibkrCloseOrderId` respectée)

## Point de vigilance

La logique de rapprochement TradeLog est complexe (ordres partiellement remplis, roulés en plusieurs étapes). Merci de bien gérer ces cas limites et de les documenter explicitement.

## Cas de test à livrer avec le code

- Test d'intégration : endpoint positions avec réponse Gateway simulée (mock)
- Test unitaire : logique de mapping ordre → TradeLog (cas simple, cas roulé, cas partiellement rempli)
- Test manuel à documenter : comparaison des positions affichées avec le compte IBKR paper réel

## Ce que j'attends de toi

1. Liste des fichiers créés/modifiés + tests
2. Implémentation complète
3. Ne pas démarrer le Lot 9
```

---

## Prompt — Lot 9 : Migration Phase 2 puis Phase 3

```markdown
Je démarre la **migration Phase 2 puis Phase 3** de mon application "Wheel Strategy Watchlist Tool".

Les Lots 0 à 8 sont validés et stables en local. Je travaille sur la branche `feature/lot-9-migration`.

## Contexte

Documents de référence : `Spécification Technique.md` (section 16, checklist complète), `3-decoupage-par-lots.md` (Lot 9).

## Périmètre — Phase 2 (migration base de données)

1. Guide pas à pas pour provisionner une instance Neon
2. Mise à jour de la variable de connexion à la base de données
3. Commandes pour exécuter les migrations Prisma contre la nouvelle instance
4. Checklist de non-régression sur les fonctionnalités des Lots 0 à 8

## Périmètre — Phase 3 (déploiement production)

1. Guide pas à pas pour provisionner le VPS **OVH** (Ubuntu LTS) et installer le Gateway IBKR
2. Configuration du reverse proxy Nginx (terminaison TLS) + règles de pare-feu (UFW + pare-feu OVH niveau infra)
3. Guide de déploiement sur Vercel avec configuration des variables d'environnement de production
4. Mise à jour de l'URL du Gateway dans la configuration applicative centralisée
5. Configuration des jobs Vercel Cron (health-check Gateway, snapshot IV quotidien)
6. Activation du Module Alertes (Gmail SMTP) une fois la disponibilité continue du Gateway confirmée

## Critères d'acceptation à respecter

- [ ] Toutes les fonctionnalités des Lots 0 à 8 fonctionnent sans régression après migration vers Neon
- [ ] Le Gateway répond correctement depuis le VPS via le reverse proxy
- [ ] Le port du Gateway n'est pas accessible directement depuis Internet
- [ ] Les jobs Vercel Cron s'exécutent selon la fréquence définie

## Ce que j'attends de toi

1. Ce lot nécessite des actions manuelles importantes de ma part (création de comptes, configuration serveur) — fournis-moi un guide étape par étape plutôt que du code à exécuter seul
2. Indique clairement à chaque étape ce qui est à faire par toi (code/config) et ce qui est à faire par moi (actions manuelles sur les consoles OVH/Neon/Vercel)
3. Fournis la checklist complète de validation finale
```

---

_Fin du document — Prompts par lot v1.0_