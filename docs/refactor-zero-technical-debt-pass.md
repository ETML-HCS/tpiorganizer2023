# Passe dette technique globale

Date: 2026-05-07

## Perimetre audite

- Frontend actif: `src/App.jsx`, `src/components/Home`, `tpiSchedule`, `tpiManagement`, `partiesPrenantes`, `planningConfiguration`, `tpiPlanning`, `tpiSoutenance`, `tpiEval`, `tpiDetail`, `genToken`, `tpiTracker`.
- Services frontend actifs: `src/services/apiService.js`, `gestionTpiService.js`, `coordinationService.js`, `tpiDossierService.js`.
- Backend actif: `API/serverAPI.js`, routes `gestionTpiRoutes`, `coordinationRoutes`, `workflowRoutes`, `importRoutes`, `magicLinkRoutes`, `tpiDossierRoutes` et routes legacy montees.
- Contrats partages actifs: `shared/stakeholderDefinitions.json`, `shared/gestionTpiLifecycle.json`, `shared/coordinationWorkflow.json`, `shared/accessLinkPolicy.json`.
- Scripts operatoires: `scripts/check-prod-config.js`, `scripts/refactor-global-migration.js`, `scripts/diagnose-year.js`, `scripts/reset-year.js`.

## Garde

- Les routes legacy montees dans `API/serverAPI.js`: elles restent compatibles avec des liens publics, des flux de salles ou des modules UI encore actifs.
- Les modules `planning*` aliasant `coordination*`: ils sont non canoniques mais conservent les anciens imports internes ou externes.
- `shared/planningWorkflow.json`: non importe par le code applicatif actuel, mais documente comme suppression future car il peut servir a des consommateurs externes.
- `scripts/diagnose-year.js`: hors graphe applicatif mais utile au diagnostic manuel.
- `cross-env`: signale par `depcheck`, conserve car utilise dans les scripts npm.
- `jest-environment-jsdom`: signale par `depcheck`, conserve car reference par la configuration Jest.

## Migre ou corrige maintenant

- `scripts/reset-year.js` est devenu non destructif par defaut. Il produit un rapport en dry-run et exige `--apply` pour supprimer les donnees de l'annee.
- `scripts/refactor-global-migration.js` et `scripts/reset-year.js` refusent maintenant les annees partielles comme `2026abc`.
- Deuxieme passe: `scripts/check-prod-config.js` expose maintenant une validation pure testable, sans execution au `require`, tout en conservant le comportement CLI.
- Deuxieme passe: les controles de production couvrent les nouvelles variables de delivrabilite email: sender SMTP, envelope-from, DKIM et avertissement SPF/DMARC.
- Derniere passe: `.env.example` ne duplique plus les variables SMTP/DKIM et garde un seul bloc documente pour la delivrabilite email.
- `.env.example` pointe vers le PDF reel `./API/models/mEvalV3.pdf` et expose les limites API ainsi que les variables d'auto-sync des votes statiques.
- `README.md` aligne la version affichee sur `package.json`, retire la mention de licence inexistante et documente les scripts de maintenance non destructifs.
- La devDependency `@babel/plugin-proposal-private-property-in-object` a ete retiree: elle n'est pas referencee par `babel.config.js` ni par la configuration applicative.

## Supprimable maintenant

- Aucune route publique ni aucun fichier applicatif supplementaire n'a ete supprime: les signaux Knip non importes concernent surtout des alias `planning*`, des scripts manuels ou du legacy documente.

## Supprimable plus tard apres validation metier

- `API/routes/planningRoutes.js`, `src/services/planningService.js`, `src/utils/planningYear.js`, `src/constants/planningStatus.js`, `API/modules/planning/status.js` apres validation qu'aucun import externe ne depend encore de ces alias.
- Les facades `API/services/planning*` et `API/models/planning*` apres migration des noms de collections et contrats historiques.
- `shared/planningWorkflow.json` si aucun consommateur externe ne l'importe.
- `GET /api/makeToken/:bossName` si les anciens generateurs de tokens ne sont plus utilises.
- Les routes CRUD globales de salles dans `legacyAdminRoutes.js` non appelees par le front actuel, listees dans `docs/legacy-boundary.md`.
- `legacyExpertsRoutes`, `legacyUsersRoutes`, `TpiSchedule` et les endpoints directs `tpiyear`/`tpiRoomYear` apres remplacement par le referentiel `Person` et les services de coordination/publication.

## Dependances

Audit execute:

- `npx knip --reporter json`
- `npx depcheck --json`
- `npm outdated --json`
- `npm audit --json`

Resultats:

- Vulnérabilites npm: 0.
- Dependency supprimee: `@babel/plugin-proposal-private-property-in-object`.
- Mises a jour appliquees dans les plages semver existantes: `@babel/preset-env` 7.29.3 -> 7.29.5, `react` 19.2.5 -> 19.2.6, `react-dom` 19.2.5 -> 19.2.6, `react-router-dom` 7.14.2 -> 7.15.0, `vite` 8.0.10 -> 8.0.11.
- Faux positifs conserves: `cross-env`, `jest-environment-jsdom`.
- Mise a jour majeure disponible mais non appliquee: `eslint` 8.57.1 -> 10.3.0.

## Migrations et donnees

- Aucune migration MongoDB n'a ete lancee.
- `scripts/refactor-global-migration.js` reste en dry-run par defaut et exige `--apply`.
- `scripts/reset-year.js` est maintenant en dry-run par defaut et exige `--apply`.
- Les scripts affichent les collections et compteurs avant toute ecriture.

## Validation executee

- Tests cibles scripts: `node --test API/tests/refactorGlobalMigrationScript.test.js API/tests/resetYearScript.test.js` -> 10 tests passes.
- Tests cibles deuxieme passe: `node --test API/tests/checkProdConfigScript.test.js API/tests/emailService.test.js` -> 25 tests passes.
- Suite API complete: `npm run test:api` -> 389 tests passes.
- Suite front complete: `npm test -- --runInBand` -> 48 suites, 344 tests passes.
- Build production: `npm run build` -> Vite 8.0.11 OK.
- Audit securite: `npm audit --json` -> 0 vulnerabilite.
- Derniere passe: `npx knip --reporter json`, `npx depcheck --json`, `npm outdated --json`, `npm audit --json` relances.
- Derniere passe: `npm run test:api`, `npm test -- --runInBand` et `npm run build` relances avec les memes resultats OK.
- Derniere passe: verification des variables SMTP/DKIM uniques dans `.env.example` et `git diff --check -- . ':!ELECTRON_PORTABLE_AUTONOME.md'` OK, hors avertissements CRLF Windows.

## Risques residuels

- Des integrations externes peuvent encore appeler les alias ou endpoints legacy non visibles dans le graphe d'import local.
- Les collections Mongo gardent des noms `planning*` pour eviter une migration destructive.
- Les routes de publication et de salles restent en legacy tant que `TpiSchedule` et les liens deja diffuses en dependent.
- `eslint` reste en version 8 car le passage a ESLint 10 est un changement majeur a planifier avec la configuration `eslint-config-react-app`.
