# Frontiere legacy apres refonte globale

Ce document fixe les restes legacy assumes apres les refontes `gestion-tpi`,
`parties-prenantes`, `coordination` et `acces-liens`.

## Maintenu temporairement

- `API/routes/legacyAuthRoutes.js`
  - expose `GET /api/auth/session` pour la session applicative automatique;
  - conserve `POST /api/auth/login` seulement pour compatibilite legacy et tests API;
  - le nom du fichier est legacy, et l'ancien formulaire UI n'est plus monte.
- `API/routes/legacyAdminRoutes.js`
  - conserve les routes de salles historiques;
  - endpoint principal encore appele: `POST /api/save-tpi-rooms/:year`;
  - consommateur connu: `src/components/tpiControllers/TpiRoomsController.jsx`.
- `API/serverAPI.js`
  - garde des endpoints historiques hors routeur dedie:
    - `GET /api/get-pdf`, consomme par `src/components/tpiEval/NewEvaluationForm.jsx`;
    - `GET /api/tpiRoomYear/:year`, consomme par `src/components/tpiSchedule/TpiSchedule.jsx`;
    - `GET /api/tpiyear/:year`;
    - `PUT /api/tpiyear/:year/:id/:tpiRef/:expertOrBoss`;
    - `PUT /api/save-propositions/:year/:expertOrBoss/:tpi_indexes/:tpi_id`.
- `API/routes/legacySoutenanceRoutes.js`
  - conserve la lecture des defenses publiees;
  - accepte encore les anciens codes/liens deja diffuses;
  - garde les alias API `/api/defenses/...` et `/api/soutenances/...`;
  - garde les publications `publish-from-planification` et `publish-from-planning`.
- `API/routes/legacyExpertsRoutes.js`
  - conserve le referentiel expert/boss historique necessaire aux defenses publiees et a l'evaluation:
    - `GET /api/experts/listExpertsOrBoss`;
    - `GET /api/experts/getNameByToken`;
    - `GET /api/experts/emails`;
    - `GET /api/expert/:name`;
    - `GET /api/makeToken/:bossName`.
- `API/routes/legacyUsersRoutes.js`
  - conserve les routes du module `Suivi des profils`, hors refonte parties prenantes:
    - `POST /api/inscription`;
    - `GET /api/suivi-etudiants`;
    - `PUT /api/suivi-etudiants/:id`;
    - `DELETE /api/suivi-etudiants/:id`.
- `src/components/tpiSchedule/*`
  - UI historique de preparation des salles;
  - doit rester fonctionnel tant que `/api/save-tpi-rooms/:year` et `/api/tpiRoomYear/:year` existent.
- `src/components/tpiSoutenance/*`
  - UI historique de consultation/publication defense;
  - doit rester compatible avec les publications existantes et les liens deja envoyes.
- Collections Mongo a nom legacy encore actives pour eviter une migration destructive:
  - `tpiPlannings`;
  - `planningConfigs`;
  - `planningSharedCatalogs`;
  - `planningSnapshots`.
- `shared/*Workflow.json`
  - garde l'alias `requires_manual_intervention -> manual_required` pour normaliser les donnees existantes.

## Alias UI documentes

Ces chemins ne sont plus canoniques, mais restent montes comme redirections ou liens publics compatibles:

- `/gestionTPI` -> `/gestion-tpi`
- `/partiesPrenantes` -> `/parties-prenantes`
- `/genTokens` -> `/acces-liens`
- `/planning` et `/planning/:year` -> `/coordination/:year`
- `/planning/:year/votes` et `/planification-votes/:year` -> `/coordination/:year?tab=votes`
- `/planification/legacy` -> `/planification`
- `/Soutenances`, `/soutenances`, `/Soutenance`, `/soutenance`, `/defense` -> `/defenses`
- `/suiviEtudiants` garde le module `Suivi des profils`
- `/TpiEval` garde le module evaluation
- `/propose-<year>/:token` et `/propose/:year/:token` restent des alias publics d'arbitrage

## Supprime du chemin canonique

- Anciens endpoints catalogue TPI:
  - `GET /api/get-tpi`
  - `POST /api/save-tpi/:year`
  - `PUT /api/update-tpi/:year/:id`
  - `GET /api/tpi/:year/byCandidate/:candidateName`
  - `POST /api/delete-tpi-year/:year`
- Anciens chemins UI:
  - `/gestionTPI`
  - `/partiesPrenantes`
  - `/genTokens`

Ces chemins UI restent uniquement comme redirections vers les routes canoniques.

## Script de migration

Le script `scripts/refactor-global-migration.js` est non destructif par defaut.
Le script `scripts/reset-year.js` est egalement non destructif par defaut depuis la passe du 2026-05-07; il affiche les compteurs et exige `--apply` avant suppression.

Commandes:

```bash
node scripts/refactor-global-migration.js --year=2026
node scripts/refactor-global-migration.js --year=2026 --apply
node scripts/refactor-global-migration.js --year=2026 --include-legacy-catalog
node scripts/reset-year.js --year=2026
node scripts/reset-year.js --year=2026 --apply
```

Actions:

- normalise `tpiPlannings.status` de `requires_manual_intervention` vers `manual_required`;
- normalise les entrees de la collection legacy active `planningSnapshots` contenant cet alias;
- inspecte les `workflowYears` sans ecriture, car ils stockent des phases admin et non le statut TPI;
- inspecte le catalogue annuel legacy uniquement avec `--include-legacy-catalog`.

## Migration recommandee

1. Executer le script en dry-run sur l'annee cible.
2. Verifier les compteurs `tpiPlannings` et `planningSnapshots`.
3. Executer avec `--apply` si les compteurs sont attendus.
4. Charger l'annee dans Gestion TPI pour reconstruire les liens personnes manquants.
5. Verifier Acces-liens puis Coordination sur la meme annee.

## Legacy a migrer

- Remplacer `legacyExpertsRoutes` par le referentiel `Person` partout ou l'ancien modele expert/boss reste appele.
- Migrer `Suivi des profils` vers un modele explicitement separe ou vers `Person` apres decision metier.
- Migrer `TpiSchedule` vers les endpoints Coordination pour supprimer `/api/save-tpi-rooms/:year` et `/api/tpiRoomYear/:year`.
- Remplacer les endpoints directs `tpiyear`, `tpiRoomYear` et `save-propositions` par les services de publication defenses.
- Renommer les collections `planning*` seulement via une migration Mongo dediee, testee et planifiee.

## Supprimable apres verification

- `shared/planningWorkflow.json` si aucun consommateur externe ne l'importe encore; le code applicatif utilise `shared/coordinationWorkflow.json`.
- `GET /api/makeToken/:bossName` si aucun ancien generateur de tokens ne l'appelle encore.
- Routes CRUD de salles globales de `legacyAdminRoutes.js` non appelees par le front actuel:
  - `GET /api/check-room-existence/:idRoom`;
  - `GET /api/get-tpi-rooms`;
  - `GET /api/get-tpi-room/:id`;
  - `PUT /api/update-tpi-room/:id`;
  - `DELETE /api/delete-tpi-room/:id`;
  - `POST /api/create-tpi-collection/:year`;
  - `POST /api/overwrite-tpi-rooms/:year`.

## Conditions de suppression futures

- Supprimer `/api/save-tpi-rooms/:year` seulement apres migration de `TpiSchedule` vers Coordination.
- Supprimer `legacySoutenanceRoutes` seulement apres expiration ou regeneration des liens deja envoyes.
- Supprimer les aliases `requires_manual_intervention` seulement apres migration de toutes les donnees historiques.
