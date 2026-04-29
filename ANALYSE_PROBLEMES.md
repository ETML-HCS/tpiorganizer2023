# Analyse profonde des problemes du projet

Date d'analyse: 26.04.2026  
Projet analyse: `tpiorganizer2023`

## Resume executif

Le projet compile et les suites de tests passent, mais il n'est pas pret a etre considere sain en production. Les problemes les plus importants sont:

- des routes API d'import qui modifient la base sans authentification;
- des tokens/liens d'acces et donnees sensibles versionnes dans le depot;
- des hooks React appeles conditionnellement dans `TpiDetailSections`, ce qui peut casser le rendu selon les donnees;
- une dette de dependances importante avec des vulnerabilites critiques/hautes;
- des problemes Windows/Linux lies a la casse des noms de fichiers;
- une CI/deploiement quasi inexistante et des scripts incoherents.

## Checks executes

| Check | Resultat | Notes |
| --- | --- | --- |
| `npm run build` | OK | Build Vite production reussi. |
| `npm run test:api` | OK | 186 tests API passes. |
| `npm test -- --watchAll=false` | OK | 40 suites / 179 tests front passes, mais beaucoup de warnings React `act(...)`. |
| `npx eslint src --ext .js,.jsx` | ECHEC | 94 problemes: 60 erreurs, 34 warnings. |
| `npx eslint API --ext .js` | OK avec warnings | 16 warnings. |
| `npm audit --omit=dev --json` | ECHEC | 68 vulnerabilites: 6 critiques, 33 hautes, 15 moyennes, 14 basses. |
| `pnpm audit --prod --json` | ECHEC | 8 critiques, 43 hautes, 37 moyennes, 18 basses. |
| `npm run check-env-prod` | ECHEC | Variables de production manquantes dans l'environnement courant. |

## Complement - Regle d'acces attendue

Regle metier confirmee: tout doit etre protege sauf la lecture des défenses publiees. L'admin doit avoir acces a tout. Les experts et chefs de projet doivent passer par un lien magique de vote et ne voir que leur perimetre.

### Statut global

- Admin: les routes modernes d'administration utilisent majoritairement `authMiddleware` + `requireRole('admin')`. C'est coherent pour les personnes, TPI, slots, workflow et actions de campagne.
- Défenses: `GET /api/soutenances/:year` est public et correspond a l'exception attendue. Les routes legacy `GET /api/tpiyear/:year` et `GET /api/tpiRoomYear/:year` exposent aussi des donnees de défense publiee, mais devraient etre clarifiees ou remplacees par `/api/soutenances/:year`.
- Votes via lien magique: les routes de mutation de vote sont plutot bien cadreess: `/api/planning/votes/pending`, `/api/planning/votes/respond/:tpiId`, `/api/planning/votes/bulk` et `/api/planning/votes/:id` verifient le votant et le scope du lien.
- Probleme principal: plusieurs routes non-soutenance restent publiques, et certaines vues accessibles par lien magique exposent plus que la vue personnelle du votant.

### Ecarts trouves

#### A. Ancien magic link planning non scope

Emplacements:

- `API/routes/planningRoutes.js:942`
- `API/routes/planningRoutes.js:980`
- `API/services/magicLinkService.js:19`
- `API/services/magicLinkService.js:56`
- `API/services/magicLinkService.js:98`
- `API/routes/planningRoutes.js:1457`
- `API/routes/planningRoutes.js:1659`

Probleme: `POST /api/planning/auth/magic-link` permet de demander un magic link pour n'importe quel email existant dans `Person`. `GET /api/planning/auth/verify` retourne ensuite un JWT de session planning classique, sans `authContext.type = 'vote_magic_link'`.

Impact: avec ce token planning classique, `buildScopedVoteTpiFilter()` retourne simplement `{ year }` au lieu de filtrer par personne. Un expert ou chef de projet connecte par ce vieux flux peut donc lire les TPI de toute l'annee via `GET /api/planning/tpi/:year` et les details via `GET /api/planning/tpi/:year/:id`.

Correction recommandee: supprimer ou desactiver ce vieux flux si le seul acces expert/chef autorise est le lien magique de vote V2 (`/api/magic-link/resolve`). Sinon, forcer ses tokens a porter un `authContext` strict avec `type: 'vote_magic_link'`, `year`, `personId` et un scope exploitable.

#### B. Routes non-défense publiques

Emplacements:

- `API/routes/importRoutes.js:45`
- `API/routes/importRoutes.js:101`
- `API/routes/importRoutes.js:212`
- `API/routes/importRoutes.js:265`
- `API/routes/importRoutes.js:289`
- `API/routes/importRoutes.js:331`
- `API/serverAPI.js:108`
- `API/serverAPI.js:138`
- `API/serverAPI.js:177`
- `API/serverAPI.js:206`
- `API/routes/planningRoutes.js:68`
- `API/routes/planningRoutes.js:96`
- `API/routes/legacyExpertsRoutes.js:23`
- `API/routes/legacyExpertsRoutes.js:56`
- `API/routes/legacyExpertsRoutes.js:66`
- `API/routes/legacyExpertsRoutes.js:113`
- `API/routes/legacyAdminRoutes.js:196`

Probleme: ces routes ne sont pas des lectures de défenses publiees et n'ont pas d'authentification obligatoire.

Impact: elles exposent ou modifient des donnees de planning, imports, evaluations, catalogue/configuration, annuaire experts ou existence de salles sans session admin.

Correction recommandee: ajouter une protection admin par defaut sur ces endpoints. Si une lecture doit rester publique, la documenter explicitement et limiter la projection des champs retournes.

#### C. Ecritures de défense legacy non protegees au niveau route

Emplacements:

- `API/serverAPI.js:273`
- `API/serverAPI.js:339`
- `API/routes/legacySoutenanceRoutes.js:173`

Probleme: les routes legacy de mise a jour d'offres de défense sont publiques au niveau Express. `legacySoutenanceRoutes.js` fait une verification interne admin/token legacy/magic link, mais les deux routes dans `serverAPI.js` ecrivent directement sans bearer admin ni token magic link.

Impact: l'exception "défense publique" concerne la lecture. Les ecritures d'offres peuvent etre appelees directement et doivent etre verrouillees.

Correction recommandee: supprimer les doublons legacy dans `serverAPI.js` ou les proteger avec le meme controle que `legacySoutenanceRoutes.js`. Idealement, garder une seule route canonique.

#### D. Vues de vote trop larges pour un lien magique

Emplacements:

- `API/routes/planningRoutes.js:1457`
- `API/routes/planningRoutes.js:1485`
- `API/routes/planningRoutes.js:1520`
- `API/routes/planningRoutes.js:1640`
- `API/routes/planningRoutes.js:1641`
- `API/routes/planningRoutes.js:1659`
- `API/routes/planningRoutes.js:1676`

Probleme: le scope de TPI est applique pour savoir quels TPI le lien peut voir, mais les donnees de vote retournees ne sont pas limitees au votant courant. La liste TPI construit des `voteStats`, `voteRoleStatus` et `voteDecision` sur tous les votes du TPI. Le detail TPI retourne `Vote.find({ tpiPlanning: tpi._id })`, donc tous les votes associes au TPI.

Impact: un expert ou chef de projet avec un lien magique peut voir l'etat ou les commentaires/decisions d'autres roles sur les TPI auxquels il participe. Si "uniquement a leur vue" signifie uniquement ses propres choix et options de vote, c'est trop ouvert.

Correction recommandee: dans un contexte `vote_magic_link`, filtrer les `Vote` par `voter: context.personObjectId` ou retourner un DTO dedie sans donnees des autres votants. Garder la vue complete uniquement pour admin.

#### E. Scope des liens de vote par personne et annee, pas toujours par TPI

Emplacements:

- `API/services/votingCampaignService.js:356`
- `API/services/votingCampaignService.js:453`
- `API/routes/workflowRoutes.js:790`
- `API/routes/workflowRoutes.js:884`
- `API/routes/planningRoutes.js:214`
- `API/routes/planningRoutes.js:282`

Probleme: les liens de campagne groupent volontairement les votes par personne et par annee (`scope.kind = 'stakeholder_votes'`) sans `scope.tpiId`. Le filtre autorise tous les TPI de l'annee ou la personne est `expert1`, `expert2` ou `chefProjet`. Les liens de test/dev mettent une `reference` dans le scope, mais le code de filtrage ignore cette reference; sans `scope.tpiId`, ils restent aussi scopes personne + annee.

Impact: si l'objectif est "un lien permet de traiter tous les votes de la personne pour l'annee", le comportement est coherent. Si l'objectif est "un lien ne donne acces qu'a un seul TPI ou une seule vue role", il faut ajouter et appliquer `scope.tpiId`, voire `scope.role`.

Correction recommandee: decider explicitement le niveau de scope attendu. Pour une vue strictement TPI, inclure `tpiId` dans `createVoteMagicLink()` et le verifier dans `buildScopedVoteTpiFilter()` et `isVoteScopeCompatibleWithTpi()`. Pour une vue role, tenir compte de `authContext.role`.

#### F. Etat workflow lisible avec un lien de vote

Emplacement:

- `API/routes/workflowRoutes.js:1424`

Probleme: `GET /api/workflow/:year` exige une authentification, mais pas le role admin. Un token issu d'un lien magique de vote peut donc lire l'etat workflow annuel.

Impact: fuite limitee mais inutile d'information interne si l'interface de vote n'en a pas besoin.

Correction recommandee: passer la route en admin si elle ne sert qu'au backoffice, ou retourner un payload public reduit pour les liens de vote.

#### G. Bypass d'authentification planning sans garde production

Emplacement:

- `API/services/magicLinkService.js:156`

Probleme: `SKIP_PLANNING_AUTH=true` fait passer `authMiddleware` sans verifier `NODE_ENV` ni un flag debug supplementaire. `requireRole('admin')` echouera souvent faute de `req.user`, mais les routes qui n'ont que `authMiddleware` peuvent devenir publiques.

Impact: mauvaise variable d'environnement = exposition des routes planning non admin.

Correction recommandee: aligner avec `requireAppAuth`, qui limite le bypass au dev/debug, ou supprimer ce bypass.

### Priorite de correction pour les acces

1. Desactiver ou re-scoper `/api/planning/auth/magic-link` et `/api/planning/auth/verify`.
2. Proteger toutes les routes non-défense publiques avec admin, en commencant par `/api/import/*`, les evaluations et les endpoints experts.
3. Verrouiller les ecritures legacy de défense et supprimer les doublons dans `serverAPI.js`.
4. Reduire les payloads de `GET /api/planning/tpi/:year` et `GET /api/planning/tpi/:year/:id` en contexte `vote_magic_link`.
5. Ajouter des tests d'autorisation: expert via lien vote ne voit que son perimetre, expert sans lien vote ne voit rien, admin voit tout, défense publique reste lisible.

## P0 - A corriger avant production

### 1. Routes d'import non protegees

Emplacements:

- `API/routes/importRoutes.js:45`
- `API/routes/importRoutes.js:101`
- `API/routes/importRoutes.js:212`
- `API/routes/importRoutes.js:265`
- `API/routes/importRoutes.js:289`
- `API/routes/importRoutes.js:331`
- `src/components/tpiPlanning/ImportPanel.jsx:118`
- `src/components/tpiPlanning/ImportPanel.jsx:159`

Probleme: toutes les routes `/api/import/*` sont montees sans `requireAppAuth`, `authMiddleware` ou role admin. Certaines ecrivent dans `Person` ou importent des TPI en base. Cote front, `ImportPanel` utilise `fetch` direct et n'envoie pas de bearer token.

Impact: un appel HTTP direct peut modifier les disponibilites, importer des TPI ou analyser/envoyer des fichiers sans session admin.

Correction recommandee: proteger les routes d'ecriture avec une authentification admin, puis remplacer les `fetch` directs de `ImportPanel` par un appel centralise qui ajoute `Authorization`.

### 2. Donnees sensibles et tokens versionnes

Emplacements constates:

- `API/config/Autres/2023/liensExperts.txt:1`
- `src/config/Autres/2024/indexTokensProduction.html:118`
- `src/config/Autres/2024/IndexTokensDev.html`
- `API/config/subscribers.json:4`
- `src/config/subscribers.json:4`
- `API/config/Autres/db/dbOrganizer.tpiExperts.json`
- `src/config/Autres/db/dbOrganizer.tpiExperts.json`
- `src/config/Autres/2024/tpiExperts_2024.json`

Probleme: le depot contient des emails, tokens d'acces et mots de passe chiffres. Les mots de passe chiffres ne sont pas une protection suffisante ici, car le secret legacy est expose cote client via `REACT_APP_TPI_TRACKER_SECRET` (`src/config/appConfig.js:14`) et le dechiffrement se fait dans le navigateur (`src/components/tpiTracker/TpiTracker.jsx:204`).

Impact: fuite potentielle de liens/tokens historiques, donnees personnelles, et authentification legacy faible.

Correction recommandee: revoquer/regenerer les tokens, sortir ces fichiers du depot, nettoyer l'historique Git si le depot est partage, et remplacer le chiffrement client par une authentification serveur avec hash non reversible.

### 3. Violation des regles de hooks React

Emplacements:

- `src/components/tpiDetail/TpiDetailSections.jsx:592`
- `src/components/tpiDetail/TpiDetailSections.jsx:698`
- `src/components/tpiDetail/TpiDetailSections.jsx:704`
- `src/components/tpiDetail/TpiDetailSections.jsx:722`
- `src/components/tpiDetail/TpiDetailSections.jsx:757`
- `src/components/tpiDetail/TpiDetailSections.jsx:774`

Probleme: `TpiDetailSections` retourne `null` avant plusieurs hooks (`useMemo`, `useRef`, `useState`). Si `dossier` passe de null a non-null entre deux rendus, l'ordre des hooks change.

Impact: bugs React difficiles a reproduire, rendu incoherent, erreurs runtime possibles.

Correction recommandee: deplacer le `if (!dossier)` apres les hooks, ou extraire un composant enfant qui ne se rend que lorsque `dossier` existe.

### 4. Vulnerabilites de dependances

Emplacements:

- `package.json:11`
- `package.json:19`
- `package.json:22`
- `package.json:25`
- `package.json:32`
- `package.json:33`

Probleme: audit npm/pnpm remonte des vulnerabilites critiques/hautes. Les paquets directs concernes incluent notamment `axios`, `express`, `mongoose`, `nodemailer`, `react-router-dom` et `react-scripts`.

Point aggravant: `react-scripts` et les libs de test sont dans `dependencies` (`package.json:8`, `package.json:33`), donc inclus dans l'audit/install production alors que le build utilise Vite.

Correction recommandee: mettre a jour les paquets directs, retirer `react-scripts` si possible, migrer les tests vers une stack Vite/Vitest ou isoler CRA en dev uniquement, puis figer un seul lockfile.

## P1 - Risques eleves

### 5. Casse de fichiers incompatible Linux

Emplacements:

- `src/App.jsx:37`
- `src/App.jsx:41`
- Git suit `src/components/tpiSchedule/tpiSchedule.jsx`
- Git suit `src/components/genToken/genToken.jsx`
- Le code importe `./components/tpiSchedule/TpiSchedule` et `./components/genToken/GenToken`

Probleme: Windows accepte ces differences de casse, Linux non.

Impact: build/deploiement Linux ou CI Ubuntu peut echouer avec `Cannot find module`.

Correction recommandee: renommer avec `git mv` en deux etapes pour aligner exactement la casse suivie par Git et les imports.

### 6. Endpoints publics trop permissifs sur les experts

Emplacements:

- `API/routes/legacyExpertsRoutes.js:23`
- `API/routes/legacyExpertsRoutes.js:56`
- `API/routes/legacyExpertsRoutes.js:66`
- `API/routes/legacyExpertsRoutes.js:113`

Probleme: plusieurs endpoints experts sont publics. `listExpertsOrBoss` retourne `TpiExperts.find()` sans projection stricte, donc potentiellement plus que le strict necessaire.

Impact: exposition d'annuaire, emails, roles et tokens legacy selon le schema/donnees.

Correction recommandee: proteger par authentification ou limiter a une projection publique minimale. Les endpoints de resolution par token doivent eviter les tokens en query string quand possible.

### 7. Requetes front qui contournent le service API centralise

Emplacements:

- `src/components/tpiEval/TpiEval.jsx:48`
- `API/routes/legacyAdminRoutes.js:234`
- `src/components/tpiPlanning/ImportPanel.jsx:118`
- `src/components/tpiPlanning/ImportPanel.jsx:159`

Probleme: `TpiEval` appelle directement `/api/tpi/:year/byCandidate/:candidateName`, mais cette route exige `requireAppAuth`. Le fetch direct n'ajoute pas le token. Meme probleme structurel dans `ImportPanel`.

Impact: fonctionnalites qui marchent en dev selon le contexte, mais cassent en session reelle ou apres durcissement de l'API.

Correction recommandee: passer par `apiService` ou un helper commun pour tous les appels authentifies.

### 8. URLs d'API incorrectes dans le controleur des salles

Emplacements:

- `src/components/tpiControllers/TpiRoomsController.jsx:139`
- `src/components/tpiControllers/TpiRoomsController.jsx:168`
- Routes reelles: `API/routes/legacyAdminRoutes.js:386` et `API/routes/legacyAdminRoutes.js:410`

Probleme: `updateTpiRoom` et `deleteTpiRoom` appellent `/update-tpi-room/...` et `/delete-tpi-room/...` sans prefixe `/api`, alors que les routes sont montees sous `/api`.

Impact: update/delete de salles peut retourner 404 selon le chemin d'appel.

Correction recommandee: utiliser `apiService.put('/api/update-tpi-room/...')` et `apiService.delete('/api/delete-tpi-room/...')`.

### 9. Configuration production non verte

Emplacements:

- `scripts/check-prod-config.js:1`
- `API/config/loadEnv.js:1`
- `.env.example:23`
- `.env.example:26`

Probleme: `npm run check-env-prod` echoue dans l'environnement courant: `NODE_ENV`, secrets auth/JWT, DB, SMTP et CORS manquent. Le script ne charge pas explicitement `API/config/loadEnv.js`, donc il depend des variables deja presentes dans le shell.

Impact: risque de demarrer ou deployer avec une configuration incomplete, ou d'avoir un check local qui ne teste pas le meme contexte que le backend.

Correction recommandee: charger la meme logique d'env que l'API dans le check, ajouter un workflow CI qui execute ce check avec secrets factices de test, et documenter les variables de prod.

## P2 - Dette technique et maintenabilite

### 10. Deux lockfiles et gestionnaire de paquets melanges

Emplacements:

- `package-lock.json`
- `pnpm-lock.yaml`
- `node_modules/.pnpm`
- `package.json`

Probleme: le depot contient `package-lock.json` et `pnpm-lock.yaml`, les commandes sont en `npm`, mais `node_modules` est gere par pnpm. Exemple: `package-lock.json` reference `multer@2.0.2`, alors que `pnpm-lock.yaml`/`node_modules` reference `multer@2.1.1`.

Impact: audits et installs non reproductibles; un deploiement npm et un deploiement pnpm ne resolvent pas forcement les memes versions.

Correction recommandee: choisir npm ou pnpm, supprimer l'autre lockfile, puis regenerer proprement.

### 11. CI/deploiement incomplets

Emplacements:

- `.github/build.yml:1`
- `.github/workflows:1`
- `.github/automatisation.md`

Probleme: `.github/build.yml` ne contient que `name/on`, sans jobs. `.github/workflows` est un fichier et non un workflow YAML valide dans `.github/workflows/*.yml`.

Impact: les checks qui auraient attrape lint, audit, build Linux et tests ne tournent pas automatiquement.

Correction recommandee: creer `.github/workflows/ci.yml` avec install, lint, tests API/front, build, audit minimal et verification de casse.

### 12. Composants et routes trop volumineux

Fichiers les plus lourds:

- `src/components/partiesPrenantes/PartiesPrenantes.jsx`: ~3503 lignes
- `src/components/planningConfiguration/PlanningConfiguration.jsx`: ~3138 lignes
- `src/components/tpiPlanning/PlanningDashboard.jsx`: ~2745 lignes
- `API/routes/planningRoutes.js`: ~2485 lignes
- `src/components/tpiSchedule/TpiSchedule.jsx`: ~2200 lignes
- `API/routes/workflowRoutes.js`: ~1514 lignes

Probleme: trop de logique metier, UI, et orchestration dans les memes fichiers.

Impact: corrections plus risquees, tests plus fragiles, regressions difficiles a isoler.

Correction recommandee: extraire progressivement hooks, services UI, sous-composants et route handlers par domaine.

### 13. Code backend duplique dans `src`

Emplacements:

- `src/dbConfig.js:1`
- `src/config/dbConfig.js:1`
- `src/models/userModels.js:43`
- `src/models/tpiRoomsModels.js:78`

Probleme: `src` contient des modules CommonJS/Mongoose et de connexion DB qui n'ont pas leur place cote frontend. Ils ne semblent pas importes par le front actuel, mais restent dans l'arborescence client.

Impact: confusion, risque d'import accidentel, fuite conceptuelle de configuration serveur vers le bundle.

Correction recommandee: supprimer ou deplacer dans `API/`/`legacy/archives`, puis interdire les imports backend depuis `src`.

### 14. Artefacts de build/deploiement versionnes

Emplacements:

- `bob_tpiorganiser@blue.section-/static/js/main.d88747ac.js`
- `bob_tpiorganiser@blue.section-/static/js/main.d88747ac.js.map`
- `bob_tpiorganiser@blue.section-/static/css/main.df213c02.css`

Probleme: un build/deploiement statique ancien est suivi par Git hors du dossier `build` ignore.

Impact: bruit dans le depot, risque de publier des sourcemaps ou assets obsoletes, confusion entre source et livrable.

Correction recommandee: retirer ces artefacts du suivi Git et ajouter une regle `.gitignore` ciblee.

### 15. Lint front actuellement rouge

Exemples:

- `src/components/tpiDetail/TpiDetailSections.jsx:698`
- `src/components/planningConfiguration/PlanningConfiguration.jsx:2550`
- `src/components/tpiSchedule/tpiScheduleOptimization.js:349`
- nombreux tests avec `testing-library/no-node-access`

Probleme: `npx eslint src --ext .js,.jsx` echoue avec 60 erreurs.

Impact: la qualite ne peut pas etre gatee en CI tant que lint reste rouge.

Correction recommandee: corriger en priorite `rules-of-hooks`, puis traiter les tests par lots.

### 16. Tests front passants mais bruyants

Probleme: `npm test -- --watchAll=false` passe, mais remonte beaucoup de warnings `ReactDOMTestUtils.act` deprecie et `not wrapped in act(...)`.

Impact: les vrais warnings runtime deviennent difficiles a voir, et une future mise a jour React/testing-library peut transformer ces warnings en blocages.

Correction recommandee: mettre a jour `@testing-library/react`, utiliser les patterns `await screen.findBy...`, `waitFor`, `userEvent`, et supprimer les assertions synchrones apres updates async.

## Ordre de correction recommande

1. Proteger `/api/import/*` et corriger les appels front associes.
2. Revoquer/sortir les tokens et donnees sensibles du depot.
3. Corriger `TpiDetailSections` pour respecter les hooks React.
4. Corriger la casse Git/imports (`TpiSchedule`, `GenToken`) et verifier sur Linux/CI.
5. Choisir un seul gestionnaire de paquets, regenerer le lockfile, puis traiter les upgrades de securite.
6. Ajouter une vraie CI avec build, tests, lint et audit.
7. Decouper les gros composants/routes par domaine.
