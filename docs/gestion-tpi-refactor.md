# Refonte du module gestion-tpi

## Objectif

Le module `gestion-tpi` a ete separe en un noyau metier API, une couche de routes explicite, un service client dedie et une configuration de cycle de vie partagee. Les anciennes URLs restent disponibles comme alias pour eviter une rupture immediate de l'interface et des scripts existants.

## Arborescence finale

```text
shared/
  gestionTpiLifecycle.json

API/
  modules/
    gestionTpi/
      constants.js
      normalization.js
      rules.js
      catalogService.js
  routes/
    gestionTpiRoutes.js
    legacyAdminRoutes.js
  models/
    tpiModels.js
  tests/
    gestionTpiRules.test.js
    gestionTpiCatalogService.test.js

src/
  constants/
    tpiLifecycle.js
  services/
    gestionTpiService.js
  components/
    tpiControllers/
      TpiController.jsx
    tpiManagement/
      TpiForm.jsx
      TpiList.jsx
      tpiManagementUtils.js
      tpiManagementUtils.test.js
```

## Nouvelles regles

- Parties prenantes requises: candidat, expert 1, expert 2, chef de projet.
- Creation manuelle: les quatre parties prenantes doivent etre resolues dans le referentiel `Person`.
- Import: les parties prenantes peuvent rester a confirmer, mais les dates et statuts restent controles.
- Dates TPI: debut <= fin <= rendu final <= defense.
- Visites: premiere visite dans la periode TPI, deuxieme visite apres la premiere et dans la periode.
- Journal: un journal en cours exige une date de debut; les entrees avant le debut sont bloquees.
- Rapport: un rapport depose/valide/rejete exige une date de depot ou un lien; un depot tardif est signale en avertissement.
- Statuts autorises: `draft`, `stakeholders_pending`, `ready_for_planning`, `imported_to_planning`, `defense_scheduled`, `journal_review`, `report_review`, `completed`, `cancelled`.
- Transitions bloquees: les sauts incoherents, par exemple `draft -> completed`, sont refuses.

## Suppressions et deplacements

- Suppression de la logique TPI catalogue dans `API/routes/legacyAdminRoutes.js`.
- Conservation dans `legacyAdminRoutes.js` uniquement des routes de salles/publication legacy encore appelees par `tpiSchedule`.
- Deplacement des anciennes fonctions de liaison, hydratation, validation et recherche vers `API/modules/gestionTpi/catalogService.js`.
- Suppression de la duplication de normalisation des references TPI dans `tpiDossierService`, qui reutilise maintenant `API/modules/gestionTpi/normalization.js`.
- Le client n'appelle plus directement `/api/get-tpi`, `/api/save-tpi`, `/api/update-tpi`; il passe par `src/services/gestionTpiService.js`.
- Suppression des alias HTTP historiques du catalogue TPI; seuls les endpoints `/api/gestion-tpi` restent exposes.

## Endpoints

Endpoints principaux:

- `GET /api/gestion-tpi/:year/tpis`
- `POST /api/gestion-tpi/:year/tpis`
- `PUT /api/gestion-tpi/:year/tpis/:id`
- `GET /api/gestion-tpi/:year/by-candidate/:candidateName`
- `POST /api/gestion-tpi/:year/delete`

Les alias historiques `/api/get-tpi`, `/api/save-tpi/:year`,
`/api/update-tpi/:year/:id`, `/api/tpi/:year/byCandidate/:candidateName` et
`/api/delete-tpi-year/:year` ont ete retires.

## Migration

1. Mettre a jour les scripts externes pour utiliser les endpoints `/api/gestion-tpi`.
2. Deployer le code sans alias de catalogue TPI.
3. Laisser Mongoose ajouter progressivement les champs optionnels `status`, `statusHistory`, `journal`, `rapport`, `validation`.
4. Executer un chargement de l'annee via Gestion TPI pour enrichir les liens parties prenantes manquants.
5. Pour les donnees existantes sans statut, appliquer ce mapping:
   - parties prenantes incompletes: `stakeholders_pending`
   - parties prenantes completes, absent de la coordination: `ready_for_planning`
   - present dans coordination non confirme: `imported_to_planning`
   - coordination confirmee ou date de defense connue: `defense_scheduled`
   - coordination annulee: `cancelled`
   - coordination terminee: `completed`

## Tests ajoutes

- Regles de dates, journal, rapport et transitions: `API/tests/gestionTpiRules.test.js`.
- Persistance catalogue, refus avant ecriture, transitions invalides: `API/tests/gestionTpiCatalogService.test.js`.
- Routes canoniques du catalogue TPI: `API/tests/gestionTpiRoutes.test.js`.
- Round-trip UI des champs statut/journal/rapport: `src/components/tpiManagement/tpiManagementUtils.test.js`.

## Mise a jour 2026-05-19

Le flux d'envoi final des horaires s'appuie sur les soutenances publiees et sur les identifiants `Person` embarques dans les donnees de planification. Les champs `candidatPersonId`, `expert1.personId`, `expert2.personId` et `boss.personId` doivent donc rester resolus avant publication si l'on veut produire les destinataires, les iCal personnels et les PDF personnels.

Cette dependance ne change pas les endpoints Gestion TPI, mais elle renforce le point de migration: charger l'annee dans Gestion TPI puis valider les parties prenantes avant de publier les defenses.

## Deuxieme passe

- Normalisation stricte des annees: les valeurs partielles comme `2026abc` sont refusees.
- Rapprochement coordination consolide pour les references legacy `042` et workflow `TPI-2026-042`.
- Le statut de suivi tient compte de l'avancement coordination sans ecraser un statut metier plus avance comme `report_review`.
- Un passage vers un statut planifiable est bloque si les parties prenantes ne sont pas validees.
- Le resume UI respecte les compteurs de validation fournis par l'API, meme si une ancienne liste d'issues est encore presente.

## Risques residuels

- Les collections existantes n'ont pas toutes les champs `status`, `journal`, `rapport`; elles sont optionnelles pour permettre une migration douce.
- Des scripts externes peuvent encore appeler les anciens endpoints; ils doivent etre migres vers `/api/gestion-tpi` avant de recevoir cette version.
- Le module `tpiSchedule` utilise encore des routes legacy de salles. Elles n'ont pas ete supprimees car elles restent appelees par l'interface actuelle.
- La validation du retard de rapport est un avertissement, pas un blocage. Si le reglement exige un blocage strict, changer `report_submitted_late` en `error` dans `API/modules/gestionTpi/rules.js`.
