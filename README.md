# TPIorganizer 2023 - Version stable VS.260502

TPIorganizer 2023 est une application React + Node/Express pour organiser les défenses TPI : configuration annuelle, gestion des parties prenantes, planification, workflow de validation, votes, liens d'accès et publication publique.

## Screenshots

![Connexion](/captures/login.png)
![Accueil](/captures/accueil.png)
![Planification](/captures/planification.png)
![Planning et votes](/captures/planning-votes.png)
![Gestion TPI](/captures/gestion-tpi.png)
![Parties prenantes](/captures/parties-prenantes.png)
![Configuration](/captures/configuration.png)
![Défenses](/captures/defenses.png)

## Fonctionnalités principales

- Configuration annuelle des types de classes, dates de défense, sites, salles, horaires, couleurs et icônes de parties prenantes.
- Paramètres de workflow par année : délai de vote, nombre maximal de propositions, demandes spéciales, rappels automatiques, validité et nombre d'utilisations des liens.
- Campagnes de vote par magic links, avec liens vers l'application ou vers le mini-site statique de vote.
- Génération et prévisualisation des liens d'accès admin pour les votes et les soutenances publiées, avec récupération des liens encore valides.
- Publication statique des soutenances et publication statique des votes, avec génération locale, aperçu, publication FTP et synchronisation des réponses de vote.
- Configuration centralisée de l'email, de l'expéditeur, du reply-to et de l'URL publique de publication.
- Exports/imports, snapshots de planning, gel de planning et vérifications avant publication.

## Stack actuelle

- Frontend : React 19, Vite 8, React Router 7.
- Backend : Node.js, Express 5, MongoDB/Mongoose 9.
- Tests frontend : Jest 30, jsdom, Babel, Testing Library.
- Tests API : `node --test` sur les tests `API/tests`.
- Publication : génération HTML/PHP locale dans `static-publication`, puis FTP pour la mise en ligne.

## Démarrage rapide

1. Installer Node.js et les dépendances avec `npm install`.
2. Copier `.env.example` vers `.env`, puis renseigner au minimum l'authentification, `JWT_SECRET` et `DB_URI`.
3. Lancer frontend + API avec `npm run dev`.
4. Ouvrir le frontend sur `http://localhost:3000`.

Scripts utiles :

- `npm run dev` : API locale en watch + frontend Vite.
- `npm run backend` : API seule sur `http://localhost:5001`.
- `npm start` : frontend seul.
- `npm run build` : build de production Vite.
- `npm test` : tests frontend Jest.
- `npm run test:api` : tests API Node.
- `npm run check-env-prod` : contrôle des variables sensibles avant production.

## Configuration importante

- `DB_URI` configure MongoDB.
- `JWT_SECRET` est requis pour les sessions et magic links.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `SMTP_FROM` pilotent l'envoi automatique.
- `STATIC_PUBLIC_BASE_URL`, `STATIC_PUBLIC_PATH`, `FTP_HOST`, `FTP_PORT`, `FTP_USER`, `FTP_PASSWORD`, `FTP_REMOTE_DIR` et `FTP_STATIC_REMOTE_DIR` restent disponibles comme fallback de publication.
- La configuration de publication peut aussi être enregistrée depuis l'interface. Le mot de passe est stocké chiffré côté MongoDB via `PublicationDeploymentConfig`.
- `STATIC_VOTE_SYNC_SECRET` est requis pour synchroniser les votes saisis sur le mini-site statique.
- `STATIC_VOTE_AUTO_SYNC=true` active la synchronisation automatique au démarrage de l'API pour les années configurées via `STATIC_VOTE_AUTO_SYNC_YEARS`.

## Publication statique

La publication des soutenances génère une page publique autonome pour les défenses validées. Le workflow génère les fichiers localement, permet l'aperçu, puis publie le dossier par FTP.

La publication des votes génère un mini-site statique protégé par liens personnels. Les réponses sont enregistrées côté hébergement dans un flux JSONL, puis synchronisées dans MongoDB via l'API. Les liens de vote peuvent cibler l'application ou ce mini-site selon l'option choisie dans la génération de liens.

La configuration publique et FTP est centralisée dans l'écran de configuration planning. Le protocole FTP est opérationnel pour la publication automatique actuelle ; FTPS/SFTP/SSH sont cadrés dans la configuration mais ne sont pas encore publiés automatiquement.

## Orientation desktop

La piste Electron portable autonome reste documentée dans [ELECTRON_PORTABLE_AUTONOME.md](./ELECTRON_PORTABLE_AUTONOME.md). Aucun runtime Electron n'est inclus pour l'instant : le projet reste web-first, avec un backend exportant `startServer()` pour faciliter une intégration desktop future.

## Maintenance récente

- Mise à jour majeure des dépendances : React 19, React Router 7, Express 5, Mongoose 9, Nodemailer 8, Jest/Babel.
- Remplacement du flux de tests frontend `react-scripts test` par Jest direct.
- Ajout des paramètres de workflow, d'accès, d'email et de publication dans les modèles de configuration.
- Ajout de la publication statique des votes et de la synchronisation distante.
- Nettoyage d'anciens artefacts, scripts et dépendances obsolètes.

## Licence

Sous licence MIT, détails dans le fichier `LICENSE`.
