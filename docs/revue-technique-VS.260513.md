# Revue technique VS.260513

Date: 2026-05-13

Tag: `VS.260513`

Commit: `bd4654c release: VS.260513`

## Contexte

Passe lecture et validations. Aucun fichier applicatif n'a ete modifie pendant cette revue.

Globalement, les tests et le build passent, mais la diff ne doit pas etre consideree comme simplement cosmetique. Plusieurs zones meritent une vraie revue technique ou metier avant d'etre considerees comme stabilisees.

## Mise a jour 2026-05-19

Depuis cette revue, un flux d'envoi final des horaires a ete ajoute autour des soutenances publiees. Il prepare les destinataires depuis les `Person`, genere un iCal personnel, un PDF personnel et un PDF global des salles, puis trace l'envoi dans `finalScheduleDeliveries`.

Points de revue a ajouter au prochain passage:

- verifier le volume et le poids des pieces jointes pour les grandes annees TPI;
- confirmer que le verrouillage `pending` puis `sent` couvre bien les doubles clics, les retries SMTP et les pannes apres envoi mais avant enregistrement;
- valider les PDF/iCal sur Outlook, Apple Calendar, Google Calendar et lecteurs PDF usuels;
- decider la politique de retention de `finalScheduleDeliveries`.

## A traiter serieusement

### Identite des slots planning mutee pendant le render

Dans `src/components/tpiSchedule/DateRoom.jsx` ligne 687, le composant ecrit dans `safeRoomData.tpiDatas[iSlot]` et modifie `slotTpi.id` / `slotTpi.period` pendant le rendu.

Ce comportement rend le drag/drop dependant d'un effet de bord React, avec un risque de desynchronisation entre l'etat React et le `localStorage`. La reprise devrait se faire proprement cote normalisation, probablement autour de `src/components/tpiSchedule/tpiScheduleData.js` ligne 422.

### Magic links: tokens reutilisables stockes cote DB et navigateur

Le modele garde un `rawToken` dans `API/models/magicLinkModel.js` ligne 13, et certains liens sont crees avec `persistToken: true` dans `API/modules/accessLinks/previewService.js` ligne 522.

C'est peut-etre voulu pour pouvoir recuperer les liens, mais cela change fortement le modele de risque: DB, backups, logs et acces administrateur peuvent devenir des points d'exposition de bearer tokens.

Cote front, les URLs completes sont aussi memorisees dans le ledger `localStorage` via `src/components/genToken/genToken.jsx` ligne 1448. C'est le sujet securite/confidentialite prioritaire.

### Envoi email: URL potentiellement fournie par le client

Dans `API/routes/workflowRoutes.js` ligne 1811, `magicLinkUrl` peut venir de `target.magicLinkUrl` avant la version resolue cote serveur.

Pour un email officiel, le serveur devrait idealement reconstruire ou valider strictement l'URL depuis le `linkId` stocke. Sinon, le client peut influencer l'URL envoyee.

### Sync automatique GestionTPI qui reecrit la planification

Dans `src/components/tpiSchedule/TpiSchedule.jsx` ligne 2976, l'effet applique automatiquement `buildRoomsWithGestionTpiSync`, met a jour `newRooms`, ecrit le `localStorage` et invalide certaines validations.

Cette logique merite une validation metier: est-elle acceptable sur une planification proche publication, ou faut-il une confirmation explicite?

### Optimiseur planning: logique metier dense

`src/components/tpiSchedule/tpiScheduleOptimization.js` ligne 648 contient une logique greedy complexe, avec un warning `no-loop-func`.

Les tests passent, mais une vraie passe scenario metier reste recommandee: TPI scelles, sites, MATU/nonM, limites consecutives, temps d'attente et garantie de ne pas creer de nouveaux conflits.

### Tres grosse passe UI/CSS sans validation visuelle

Beaucoup de changements concernent `TpiSchedule`, `TpiScheduleButtons`, `genToken`, `globalStyles.css` et `tpiSheduleStyle.css`.

Les tests unitaires ne couvrent pas les regressions visuelles. Une validation manuelle ou e2e devrait couvrir le planning board, les panneaux sticky/fixed, les popovers, les vues mobile, la console emails, les etats vides et les etats de chargement.

## Validations lancees

- `npm run test:api`: OK, 423 tests.
- `npm test -- --runInBand`: OK, 459 tests.
- `npm run build`: OK.
- `npm audit --json`: 0 vulnerabilite.
- `git diff --check`: pas d'erreur whitespace, mais beaucoup d'avertissements LF/CRLF.
- `npx eslint src API --ext .js,.jsx`: pas vert, 185 problemes. Beaucoup semblent preexistants ou lies aux tests, mais il y a aussi des warnings dans les fichiers touches.

## Priorite

La premiere priorite est la politique des magic links/tokens. La deuxieme est la mutation de l'etat planning pendant le render.

Ce sont les deux zones ou une erreur peut produire soit une fuite d'acces, soit des bugs planning difficiles a diagnostiquer.
