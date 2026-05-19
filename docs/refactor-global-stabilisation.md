# Rapport global de stabilisation

## Perimetre

Passe transversale sur les modules refondus:

- `gestion-tpi`
- `parties-prenantes`
- `acces-liens`

## Harmonisation realisee

- Ajout de `shared/accessLinkPolicy.json` pour centraliser les types de liens, cibles, sources, durees, usages et statuts de logs.
- Ajout de `shared/coordinationWorkflow.json` et `API/modules/coordination/status.js` pour centraliser les statuts de coordination, transitions, alias normalises et statuts ouvrant les votes.
- Alignement des modeles `MagicLink`, `AccessLinkLog`, `TpiPlanning`, `Vote`, `ResolutionProposal` sur les constantes partagees.
- Alignement des services `accessLinks`, `coordinationConfigService`, `votingCampaignService`, `staticVotePublicationService`, `resolutionProposalService` sur ces contrats.
- Exposition front des memes contrats via `src/constants/coordinationStatus.js`, `PlanningConfiguration`, `genToken`, `PlanningDashboard`, `VoteCommandCenter` et `stakeholderRules`.
- Remplacement des anciens endpoints catalogue TPI par les routes canoniques `/api/gestion-tpi/...`.
- Redirection des anciens chemins UI des modules refondus vers leurs routes canoniques:
  - `/gestionTPI` -> `/gestion-tpi`
  - `/partiesPrenantes` -> `/parties-prenantes`
  - `/genTokens` -> `/acces-liens`

## Nettoyage effectue

- Suppression des alias HTTP historiques:
  - `GET /api/get-tpi`
  - `POST /api/save-tpi/:year`
  - `PUT /api/update-tpi/:year/:id`
  - `GET /api/tpi/:year/byCandidate/:candidateName`
  - `POST /api/delete-tpi-year/:year`
- Suppression des classes CSS liees a l'ancien statut `requires_manual_intervention`; l'alias est normalise vers `manual_required`.
- Suppression des duplications de roles vote/arbitrage (`expert1`, `expert2`, `chef_projet`) au profit du referentiel parties prenantes.
- Suppression des duplications de politique de liens d'acces entre API, configuration de planification et UI.
- Deuxieme passe: raccordement de l'expiration des propositions d'arbitrage et des tests de configuration aux valeurs `shared/accessLinkPolicy.json`.
- Deuxieme passe: retrait d'une exception UI devenue inutile pour l'ancien chemin `/genTokens` dans `PageToolbar`.
- Passe complementaire: centralisation du formatage des roles TPI (`candidat`, `expert1`, `expert2`, `chef_projet`, aliases) dans le referentiel parties prenantes, cote API et cote UI.
- Passe complementaire: raccordement des apercus de liens, campagnes de votes, fiche TPI et configuration des icones de defense au meme formatteur de relations TPI.
- Derniere passe: raccordement des emails, messages de scheduling et publication statique defenses aux libelles de relations TPI partages.
- Passe migration: ajout du script `scripts/refactor-global-migration.js` en dry-run par defaut pour normaliser les statuts legacy et inspecter les liens du catalogue annuel.
- Passe legacy boundary: ajout de `docs/legacy-boundary.md` pour fixer les routes, ecrans et alias conserves temporairement.
- Passe finale globale:
  - expiration des propositions d'arbitrage alignee sur `accessLinkSettings.voteLinkValidityHours` de l'annee;
  - consultation publique des arbitrages expirees refusee avec `410`;
  - reporting migration corrige sur la collection Mongo reelle `planningSnapshots`;
  - labels et compteurs de roles de vote front raccordes au referentiel parties prenantes;
  - frontiere legacy etendue aux routes encore montees dans `serverAPI.js`.
- Deuxieme passe finale:
  - synchronisation des arbitrages du mini-site statique bloquee si la proposition est expiree ou deja close;
  - statut d'une proposition expiree marque `expired` pendant l'import statique sans enregistrer de reponse tardive;
  - metadonnees de statut des fiches detail raccordees a `src/constants/coordinationStatus.js`;
  - derniers libelles `candidat`, `expert1`, `expert2`, `chef_projet` des modules refondus raccordes au referentiel parties prenantes.
- Troisieme passe finale:
  - correction de l'import statique differe: l'expiration d'un arbitrage est evaluee sur `submittedAt`, pas sur l'heure de synchronisation;
  - une reponse soumise avant expiration reste importable meme si le sync admin est lance apres la deadline;
  - une reponse soumise apres expiration reste ignoree avec `proposal_expired`.
- Passe publication finale 2026-05-19:
  - ajout de `finalScheduleDeliveryService` et du modele `FinalScheduleDelivery` pour preparer et tracer les envois d'horaires definitifs;
  - endpoints admin `GET /api/workflow/:year/publication/final-schedule/preview` et `POST /api/workflow/:year/publication/final-schedule/send`;
  - generation d'un iCal personnel, d'un PDF personnel et d'un PDF global des salles pour chaque destinataire envoyable;
  - envoi SMTP via le template `soutenanceSchedulePackage`, avec pieces jointes supportees par `emailService`;
  - UI de coordination enrichie avec apercu, compteur de destinataires, blocage des doublons et bouton d'envoi des horaires;
  - mini-site statique des defenses enrichi avec version de publication, date de generation et metadonnees du formulaire de modification lie.

## Tests ajoutes ou ajustes

- `API/tests/crossModuleContracts.test.js`
  - contrats acces-liens entre constantes, modeles et configuration de coordination;
  - statuts de coordination partages et transitions;
  - cycle Gestion TPI partage;
  - roles de vote alignes entre parties prenantes, votes et arbitrage.
- `API/tests/gestionTpiRoutes.test.js`
  - remplacement des tests d'alias par les endpoints canoniques.
- Tests de configuration et de liens mis a jour pour consommer les valeurs partagees au lieu de recopier les durees/usages par defaut.
- Tests parties prenantes et campagne de votes etendus pour verrouiller les libelles de roles TPI issus du catalogue partage.
- `API/tests/refactorGlobalMigrationScript.test.js` verrouille les helpers du script de migration sans connexion Mongo.
- Tests de migration ajoutes pour verrouiller dry-run, `--apply`, filtre par annee et reporting `planningSnapshots`.
- Tests d'arbitrage ajoutes pour verrouiller la duree configuree par annee et le refus des liens expires.
- Tests d'import statique ajoutes pour refuser une reponse d'arbitrage recue apres expiration.
- Tests d'import statique ajoutes pour couvrir une synchronisation tardive d'une reponse soumise avant expiration.
- Tests front ajoutes pour verrouiller les libelles de statut issus du contrat coordination.
- Tests d'envoi final ajoutes pour couvrir l'apercu, les destinataires non envoyables, les envois idempotents, les pieces jointes iCal/PDF et les routes admin.

## Validation

- `npm run test:api`: 377 tests passes.
- `npm test -- --runInBand`: 48 suites, 344 tests passes.
- `npm run build`: build Vite production OK.
- Validation 2026-05-19 apres ajout de l'envoi final: `npm run test:api` -> 447 tests passes.
- Scan final: aucun helper local `formatRoleLabel` residuel sur les modules refondus; les routes legacy encore montees sont inventoriees dans `docs/legacy-boundary.md`.

## Plan de migration global

1. Migrer les scripts externes et favoris internes depuis les anciens endpoints TPI vers `/api/gestion-tpi`.
2. Nettoyer les donnees de coordination legacy contenant encore `requires_manual_intervention` en les remplacant par `manual_required`.
3. Charger une annee dans Gestion TPI pour enrichir les liens `candidatPersonId`, `expert1PersonId`, `expert2PersonId`, `bossPersonId` via le referentiel parties prenantes.
4. Conserver les anciennes collections TPI le temps de la bascule coordination; les nouveaux contrats partages ne changent pas les schemas Mongo existants.
5. Regenerer les liens d'acces non recuperables si l'interface admin doit les afficher.
6. Executer `node scripts/refactor-global-migration.js --year=<annee>` en dry-run, puis `--apply` apres verification des compteurs.

## Risques residuels

- Les clients externes qui appellent encore les anciens endpoints TPI recevront un `404`; solution: migration vers `/api/gestion-tpi` avant de deployer cette passe.
- Les routes de salles/publication dans `legacyAdminRoutes.js` et `legacySoutenanceRoutes.js` restent actives car elles portent encore des flux de planification, publication et lecture de liens deja envoyes; solution: les isoler dans une passe dediee planification/publication.
- Des donnees de coordination legacy peuvent encore stocker `requires_manual_intervention`; solution: script de migration simple vers `manual_required`, deja supporte par la normalisation applicative, avec reporting sur `tpiPlannings` et `planningSnapshots`.
- Les collections existantes restent souples sur les nouveaux champs `status`, `journal`, `rapport`, `validation`; solution: migration progressive par chargement annuel puis controle via les tests de validation coordination.
- Plusieurs noms de collections `planning*` restent actifs malgre les noms de modules `coordination*`; solution: les conserver jusqu'a une migration Mongo dediee et documentee.
