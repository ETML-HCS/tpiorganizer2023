# Module acces-liens

## Responsabilites

- `constants.js`: types, sources et normalisation des cibles de liens depuis `shared/accessLinkPolicy.json`.
- `tokenService.js`: creation, reutilisation, revocation, resolution, securite d'usage et logs.
- `previewService.js`: construction de la vue admin des liens vote, defense et arbitrage.

Les imports internes pointent directement vers ce module. Les anciennes facades
`API/services/magicLinkV2Service.js` et `API/services/accessLinkPreviewService.js`
ont ete supprimees pendant le nettoyage.

## Collections

- `magicLinks`: liens existants, inchanges.
- `accessLinkLogs`: journal append-only des resolutions de liens.

## Endpoints principaux

- `POST /api/workflow/:year/access-links/preview`
- `POST /api/workflow/:year/access-links/generate`
- `GET /api/workflow/:year/access-links/logs`
- `GET /api/magic-link/resolve`

## Metadonnees exposees

Les liens recuperables exposent maintenant aussi:

- `createdAt`;
- `source`;
- `publicationVersion`;
- les statuts d'envoi email deja presents (`deliveryStatus`, `deliveryError`, `sentAt`).

Quand un lien de soutenance est resolu, l'API peut rattacher le lien de vote associe et renvoyer `voteAccessCreatedAt`, `voteAccessPublicationVersion` et `voteAccessSource`. Le mini-site statique des defenses utilise ces champs pour afficher la version et la date du formulaire de demande de modification lie.

## Migration

Aucune migration de donnees obligatoire. Les liens historiques sans `rawToken`
restent non recuperables dans l'interface admin; il faut regenerer les acces
concernes pour les rendre affichables.

Prevoir une retention des `accessLinkLogs` si le volume devient important.
