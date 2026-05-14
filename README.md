# TPIorganizer 2023 - version 26.5.8

TPIorganizer 2023 est une application React + Node/Express pour organiser les défenses TPI : configuration annuelle, gestion des parties prenantes, planification, coordination des votes, liens d'accès et publication publique.

## Screenshots

![Accueil](/captures/accueil.png)
![Planification](/captures/planification.png)
![Coordination et votes](/captures/coordination-votes.png)
![Gestion TPI](/captures/gestion-tpi.png)
![Parties prenantes](/captures/parties-prenantes.png)
![Configuration](/captures/configuration.png)
![Défenses](/captures/defenses.png)

## Fonctionnalités principales

- Configuration annuelle des types de classes, dates de défense, sites, salles, horaires, couleurs et icônes de parties prenantes.
- Paramètres annuels de vote et de liens : délai de vote, nombre maximal de propositions, demandes spéciales, rappels automatiques, validité et nombre d'utilisations des liens.
- Campagnes de vote par magic links, avec liens vers l'application ou vers le mini-site statique de vote.
- Génération et prévisualisation des liens d'accès admin pour les votes et les soutenances publiées, avec récupération des liens encore valides.
- Publication statique des soutenances et publication statique des votes, avec génération locale, aperçu, publication FTP et synchronisation des réponses de vote.
- Configuration centralisée de l'email, de l'expéditeur, du reply-to et de l'URL publique de publication.
- Exports/imports, snapshots de planification, gel de planification et vérifications avant publication.

## Stack actuelle

- Frontend : React 19, Vite 8, React Router 7.
- Backend : Node.js, Express 5, MongoDB/Mongoose 9.
- Tests frontend : Jest 30, jsdom, Babel, Testing Library.
- Tests API : `node --test` sur les tests `API/tests`.
- Publication : génération HTML/PHP locale dans `static-publication`, puis FTP pour la mise en ligne.

## Démarrage rapide

1. Installer Node.js et les dépendances avec `npm install`.
2. Copier `.env.example` vers `.env`, puis renseigner au minimum `JWT_SECRET` et `DB_URI`.
3. Lancer frontend + API avec `npm run dev`.
4. Ouvrir le frontend sur `http://localhost:3000`.

Scripts utiles :

- `npm run dev` : API locale en watch + frontend Vite.
- `npm run backend` : API seule sur `http://localhost:5001`.
- `npm start` : frontend seul.
- `npm run build` : build de production du client React dans `build/`.
- `npm run build:app` : alias explicite du build applicatif actuel. Le backend Node n'a pas d'etape de compilation, mais il sert `build/` en production.
- `npm run start:prod` : demarre l'API en `NODE_ENV=production` et sert le client compile si `build/index.html` existe.
- `npm run prod` : controle la configuration de production, reconstruit le client, puis demarre le serveur production.
- `easyStart_prod.cmd` : lanceur Windows pour `npm run prod`.
- `npm test` : tests frontend Jest.
- `npm run test:api` : tests API Node.
- `npm run check-env-prod` : contrôle des variables sensibles avant production.
- `node scripts/refactor-global-migration.js --year=<annee>` : audit de migration non destructif par défaut.
- `node scripts/reset-year.js --year=<annee>` : rapport de reset non destructif par défaut; ajouter `--apply` pour supprimer les données de l'année.

## Configuration importante

- `DB_URI` configure MongoDB.
- `JWT_SECRET` est requis pour la session automatique de l'application et les magic links.
- `AUTH_SESSION_SECRET` peut être défini pour séparer le secret de session applicative de `JWT_SECRET`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` et `SMTP_FROM` pilotent l'envoi automatique.
- `SMTP_ALLOWED_FROM_DOMAINS`, `SMTP_ENVELOPE_FROM`, `SMTP_MESSAGE_ID_DOMAIN`, `SMTP_LIST_UNSUBSCRIBE_*` et `SMTP_DKIM_*` renforcent les en-têtes et la délivrabilité email.
- Délivrabilité email: `SMTP_FROM` doit être une adresse validée chez le fournisseur SMTP. Le service force les expéditeurs configurés dans l'interface à rester sur les domaines autorisés (`SMTP_ALLOWED_FROM_DOMAINS`, sinon domaines déduits de `SMTP_FROM`, `SMTP_ENVELOPE_FROM` et `SMTP_DKIM_DOMAIN`) et conserve un expéditeur refusé en `Reply-To`. Il ajoute aussi `List-Unsubscribe` via `SMTP_LIST_UNSUBSCRIBE_EMAIL`/`SMTP_LIST_UNSUBSCRIBE_URL` ou l'adresse de réponse. Configurer SPF, DKIM et DMARC dans le DNS du domaine expéditeur; `SMTP_DKIM_*` ne sert qu'en fallback si le fournisseur SMTP ne signe pas déjà en DKIM.
- `STATIC_PUBLIC_BASE_URL`, `FTP_HOST`, `FTP_PORT`, `FTP_USER`, `FTP_PASSWORD` et `FTP_REMOTE_DIR` forment la base commune de publication.
- Les chemins publiés sont configurables par site: `STATIC_DEFENSE_PUBLIC_PATH` / `FTP_STATIC_DEFENSE_REMOTE_DIR` pour les défenses, `STATIC_VOTE_PUBLIC_PATH` / `FTP_STATIC_VOTE_REMOTE_DIR` pour les votes. Les anciens `STATIC_PUBLIC_PATH`, `STATIC_PUBLICATION_PUBLIC_PATH`, `FTP_STATIC_PUBLIC_PATH` et `FTP_STATIC_REMOTE_DIR` restent acceptés comme fallback des défenses.
- La configuration de publication peut aussi être enregistrée depuis l'interface. Le mot de passe est stocké chiffré côté MongoDB via `PublicationDeploymentConfig`.
- `STATIC_VOTE_SYNC_SECRET` est requis pour synchroniser les votes saisis sur le mini-site statique.
- `STATIC_VOTE_AUTO_SYNC=true` active la synchronisation automatique au démarrage de l'API pour les années configurées via `STATIC_VOTE_AUTO_SYNC_YEARS`.

## Publication statique

La publication des soutenances génère une page publique autonome pour les défenses validées. L'admin génère les fichiers localement, les prévisualise, puis publie le dossier par FTP.

La publication des votes génère un mini-site statique protégé par liens personnels. Les réponses sont enregistrées côté hébergement dans un flux JSONL, puis synchronisées dans MongoDB via l'API. Les liens de vote peuvent cibler l'application ou ce mini-site selon l'option choisie dans la génération de liens.

La configuration publique et FTP est centralisée dans l'écran de configuration de planification. Le protocole FTP est opérationnel pour la publication automatique actuelle ; FTPS/SFTP/SSH sont cadrés dans la configuration mais ne sont pas encore publiés automatiquement.

## Démarrage production local

1. Copier `.env.example` vers `.env.production` ou `.env.production.local`.
2. Renseigner les secrets, MongoDB, SMTP, `CORS_ORIGIN` et `REACT_APP_API_URL_FALSE`.
3. Lancer `easyStart_prod.cmd` ou `npm run prod`.
4. Ouvrir `http://localhost:8080` si `PORT` n'est pas surcharge.

En production, Express sert le dossier `build/` genere par Vite. Les routes `/api/...` restent reservees au backend; les autres routes sont renvoyees vers `index.html` pour React Router.

## Orientation desktop

La piste Electron portable autonome reste documentée dans [ELECTRON_PORTABLE_AUTONOME.md](./ELECTRON_PORTABLE_AUTONOME.md). Aucun runtime Electron n'est inclus pour l'instant : cette version `26.5.8` fige le socle web 2026 avant une refonte plus large vers une application portable centrée sur la génération, la publication et la synchronisation des sites statiques.

## Maintenance récente

- Mise à jour majeure des dépendances : React 19, React Router 7, Express 5, Mongoose 9, Nodemailer 8, Jest/Babel.
- Remplacement du flux de tests frontend `react-scripts test` par Jest direct.
- Ajout des paramètres annuels de vote, d'accès, d'email et de publication dans les modèles de configuration.
- Ajout de la publication statique des votes et de la synchronisation distante.
- Nettoyage d'anciens artefacts, scripts et dépendances obsolètes.

## Licence

Projet privé (`private: true` dans `package.json`). Aucun fichier `LICENSE` n'est fourni dans ce dépôt.
