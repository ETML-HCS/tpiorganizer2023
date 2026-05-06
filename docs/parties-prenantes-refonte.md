# Refonte du module Parties prenantes

Date: 2026-05-05

## Objectif

Le module Parties prenantes devient le référentiel unique des personnes utilisées par Gestion TPI, Coordination, Votes et Défenses.
La refonte supprime les structures d’écran legacy, centralise les rôles et garde seulement les flux nécessaires:

- créer et mettre à jour une fiche personne;
- associer ou retirer les rôles `candidat`, `expert`, `chef_projet`, `admin`;
- rattacher les candidats à leurs années TPI;
- compléter les brouillons issus de Gestion TPI;
- importer des personnes depuis CSV/TSV;
- fusionner les doublons d’identité;
- désactiver une fiche sans supprimer les relations historiques.

## Arborescence finale

```text
shared/
  stakeholderDefinitions.json

API/modules/stakeholders/
  stakeholderDefinitions.js

API/services/
  personRegistryService.js
  tpiStakeholderService.js
  personImportService.js
  personShortIdService.js

API/models/
  personModel.js

API/tests/
  stakeholderDefinitions.test.js
  tpiStakeholderService.test.js
  personRoutes.test.js
  personImportService.test.js

src/components/partiesPrenantes/
  PartiesPrenantes.jsx
  PartiesPrenantes.test.jsx
  stakeholderDraftEmailUtils.js
  stakeholderDraftEmailUtils.test.js
  stakeholderImportUtils.js
  stakeholderImportUtils.test.js

src/css/partiesPrenantes/
  partiesPrenantes.css

src/utils/
  stakeholderRules.js
  stakeholderRules.test.js

src/components/tpiManagement/
  tpiStakeholderDraftUtils.js
  tpiStakeholderDraftUtils.test.js
```

## Règles métier normalisées

Rôles du référentiel:

- `candidat`: personne présentée à la défense, filtrée par `candidateYears` quand une année est demandée.
- `expert`: personne utilisable en relation TPI `expert1` ou `expert2`.
- `chef_projet`: personne utilisable en relation TPI `chef_projet`; remplace les alias legacy `boss`, `responsable`, `chefProjet`.
- `admin`: rôle applicatif additionnel, exclu des relations TPI.

Relations TPI obligatoires:

- `candidat` -> rôle référentiel `candidat`;
- `expert1` -> rôle référentiel `expert`;
- `expert2` -> rôle référentiel `expert`;
- `chef_projet` -> rôle référentiel `chef_projet`.

Règles d’association:

- une relation TPI ne se résout que si la personne est active et possède le rôle requis;
- un candidat avec `candidateYears` renseigné doit contenir l’année du TPI;
- les placeholders texte `null` et `undefined` sont traités comme données manquantes;
- `formateur` n’est pas un rôle TPI reconnu;
- `admin` peut s’ajouter aux rôles TPI dans le formulaire, mais reste ignoré par les relations candidat/expert/chef de projet.
- les alias de rôles envoyés directement à l’API (`expert1`, `expert2`, `responsable`, `boss`, etc.) sont normalisés avant persistance.
- les redirections `returnTo` du module acceptent uniquement des chemins locaux commençant par `/`.
- les définitions de rôles, alias, relations TPI, responsabilités et colonnes d’import sont centralisées dans `shared/stakeholderDefinitions.json`.

## Suppressions

- Suppression du monolithe UI legacy de `PartiesPrenantes.jsx` et remplacement par un composant structuré autour du référentiel, du formulaire, des règles, des brouillons et de l’import.
- Suppression des anciennes fonctions locales du composant: parsing CSV, statuts de brouillons, détection de doublons, sérialisation formulaire, règles de rôles.
- Suppression de la feuille CSS legacy de 2 399 lignes et remplacement par une feuille limitée aux classes réellement rendues.
- Suppression de l’endpoint non utilisé `POST /api/coordination/persons/purge`.
- Suppression du helper serveur `purgeAllPeople`.
- Suppression du reset de compteur court `resetPersonShortIdSequence`, devenu inutilisé après retrait de la purge globale.
- Remplacement des mappings backend/frontend dispersés par `shared/stakeholderDefinitions.json`, consommé par `API/modules/stakeholders/stakeholderDefinitions.js`, `src/utils/stakeholderRules.js` et les imports CSV.
- Remplacement des duplications frontend avec `src/utils/stakeholderRules.js`, maintenant réutilisé par Gestion TPI pour les brouillons.

## Migration

Aucune migration MongoDB obligatoire n’est requise.

Les valeurs persistées restent compatibles:

- les rôles existants `candidat`, `expert`, `chef_projet`, `admin` sont conservés;
- les champs legacy TPI `candidatPersonId`, `expert1PersonId`, `expert2PersonId`, `bossPersonId` restent lus et complétés;
- les alias de relation `expert1`, `expert2`, `boss`, `responsable`, `chefProjet` sont normalisés au moment de la résolution;
- les brouillons stockés dans `pendingStakeholderImport` restent compatibles.

Plan de migration conseillé:

1. Déployer le code sans script de données.
2. Ouvrir Parties prenantes et traiter les brouillons `À créer` ou `À enrichir`.
3. Relancer la validation Coordination pour confirmer que les incohérences `legacy_tpi_missing_stakeholders` et `legacy_tpi_unresolved_stakeholders` disparaissent.
4. Remplacer tout usage externe éventuel de `POST /api/coordination/persons/purge` par un script de maintenance explicite et auditable si un reset complet est encore nécessaire.

## Tests

Validations exécutées:

- `npm test -- --runTestsByPath src/components/partiesPrenantes/PartiesPrenantes.test.jsx src/utils/stakeholderRules.test.js src/components/partiesPrenantes/stakeholderImportUtils.test.js src/components/tpiManagement/tpiStakeholderDraftUtils.test.js --watchAll=false`
- `npm test -- --watchAll=false --runInBand`
- `npm run test:api`
- `npm run build`

Couverture ajoutée:

- règles de rôle et d’année candidat;
- statuts de brouillons `create`, `enrich`, `resolved`;
- sérialisation de payload personne;
- filtres et statistiques du référentiel;
- import CSV/TSV et options de rôles;
- rendu, filtrage, création depuis brouillon, mise à jour et import côté composant;
- redirection locale après création et rejet des `returnTo` externes;
- définitions backend des rôles;
- normalisation API des alias de rôles legacy;
- résolution et validation des relations TPI legacy.

## Risques résiduels

- Des intégrations externes non présentes dans le dépôt pourraient appeler l’ancien endpoint de purge. Solution: fournir un script de maintenance séparé avec confirmation forte si ce besoin existe.
- Les anciens TPI contenant un alias métier non prévu peuvent rester non résolus. Solution: ajouter explicitement l’alias dans `stakeholderDefinitions.js` après validation métier.
- Les emails synthétiques `@tpiorganizer.ch` créés depuis les brouillons désactivent l’envoi par défaut. Solution: compléter les emails réels avant l’ouverture des votes si la personne doit recevoir des notifications.
- La fusion de doublons reste volontairement limitée aux identités même prénom/nom via l’API existante. Solution: utiliser `allowDifferentIdentity` uniquement dans un outil d’administration contrôlé si une fusion inter-identité est nécessaire.
