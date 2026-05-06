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

## Migration

Aucune migration de donnees obligatoire. Les liens historiques sans `rawToken`
restent non recuperables dans l'interface admin; il faut regenerer les acces
concernes pour les rendre affichables.

Prevoir une retention des `accessLinkLogs` si le volume devient important.
