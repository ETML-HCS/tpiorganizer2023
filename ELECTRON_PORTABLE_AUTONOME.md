# Electron portable autonome

## Décision

La piste desktop retenue reste une application Electron portable et autonome pour Windows.

La version web `26.5.8` sert de gel fonctionnel pour 2026 avant la refonte portable. Le projet ne contient pas encore Electron. Les derniers nettoyages ont au contraire gardé l'application centrée sur le web, avec React/Vite côté frontend et Node/Express côté API. Ce document sert de référence unique pour préparer la future version desktop sans mélanger cette direction avec les travaux web en cours.

La cible change toutefois de nature : l'application portable ne doit pas simplement empaqueter tout le web existant. Elle doit devenir un outil local de préparation, génération, publication et synchronisation. Les surfaces consultées par les personnes externes doivent être les sites générés ; les modules qui ne servent pas ce flux devront être isolés, simplifiés ou supprimés.

## État actuel après les dernières modifications

Le socle actuel est :

- frontend React 19 construit avec Vite 8 ;
- backend Node/Express 5 dans `API/serverAPI.js` ;
- persistance MongoDB via Mongoose 9 ;
- API exportée par `app` et `startServer()`, ce qui reste favorable à un lancement depuis le process principal Electron ;
- configuration frontend centralisée dans `src/config/appConfig.js` et les services `src/services` ;
- tests frontend lancés par Jest/Babel sans `react-scripts` ;
- publication statique générée sous `static-publication` ou sous un dossier configurable.

Les dernières évolutions ajoutent aussi :

- `workflowSettings` et `accessLinkSettings` dans la configuration annuelle ;
- `emailSettings` et `publicationSettings` dans le catalogue partagé ;
- `PublicationDeploymentConfig` pour la configuration de publication, avec mot de passe chiffré côté backend ;
- publication statique des soutenances ;
- publication statique des votes avec `index.php`, `sync.php`, `.htaccess` et synchronisation JSONL ;
- synchronisation automatique optionnelle des votes statiques au démarrage de l'API.
- envoi final des horaires définitifs depuis une publication active, avec iCal personnel, PDF personnel, PDF global des salles et suivi `finalScheduleDeliveries`.
- métadonnées de version et de création exposées dans les liens de soutenance afin d'afficher le contexte du formulaire de modification lié.
- Une base de données noSQL, est-ce vraiment le bon format ?

## Nouvelle orientation

Le programme doit être repensé autour d'un flux plus court :

- importer ou saisir les données utiles ;
- configurer les sites, dates, salles, votes, emails et publications ;
- générer les planifications et les propositions de résolution ;
- générer les sites publics nécessaires ;
- publier ces sites et récupérer les réponses distantes ;
- envoyer ou préparer les horaires définitifs pour les parties prenantes ;
- exporter ou sauvegarder les données.

Dans cette cible, les sites générés deviennent la surface publique principale. Le reste de l'application sert surtout à produire, contrôler et synchroniser ces sites. Les écrans, routes et services historiques qui ne participent pas à ce flux ne doivent pas être portés automatiquement dans Electron.

Les modules legacy restent utiles uniquement s'ils permettent de relire d'anciennes données, de maintenir des liens déjà envoyés, ou de faciliter une migration. Sinon, ils doivent être considérés comme du code transitoire à retirer pendant la refonte.

### Orientation UX pour le module Planification

Le module Planification ne doit pas être pensé comme un simple tableau de rooms et de slots. Son rôle principal est d'aider à arbitrer une planification TPI complexe : placer les TPI, résoudre les conflits, respecter les contraintes de classes, salles, personnes, disponibilités, préférences, synchronisation GestionTPI, validation et publication.

Pour la version portable, l'objectif de confort est de transformer la planification en poste de régulation :

- une file de travail intelligente : TPI à placer, conflits durs, préférences non respectées, chefs indisponibles, écarts GestionTPI, TPI non importables et éléments récemment modifiés ;
- un inspecteur de décision pour le TPI ou le slot sélectionné : participants, contraintes, préférences, conflits actuels, raisons de compatibilité ou d'incompatibilité ;
- des suggestions classées : meilleurs slots libres, meilleurs swaps, déplacements qui résolvent un conflit, déplacements sans nouveau problème ;
- un score visuel simple : vert pour amélioration ou absence de dégradation, orange pour compromis acceptable, rouge pour blocage ou conflit créé ;
- un mode personne : cliquer un candidat, expert ou chef de projet montre tous ses TPI dans le planning ;
- une action d'annulation après chaque déplacement ;
- un verrouillage de TPI ou de slot pour protéger les arbitrages déjà validés ;
- une vue de résolution compacte `créneaux x rooms`, avec maximum 4 rooms visibles, sans rotation CSS du texte ;
- une mini-navigation ou liste de suggestions capable de scroller automatiquement vers la cible.

La priorité fonctionnelle future est : sélectionner un problème ou un TPI, afficher les meilleurs swaps possibles, prévisualiser l'impact avant/après, puis appliquer l'action choisie. Le confort attendu est de réduire les déplacements manuels et le scroll au hasard, pas seulement de compacter l'affichage.

## Cible Electron

L'application finale devra pouvoir être lancée comme un exécutable Windows portable, sans installation serveur manuelle.

La cible fonctionnelle est :

- embarquer le build React dans une fenêtre Electron ;
- lancer l'API Express locale automatiquement ;
- utiliser une base de données locale ou embarquée ;
- stocker les données dans un dossier utilisateur ou portable clairement défini ;
- conserver une configuration minimale pour les usages hors ligne ;
- permettre un import/export complet pour migration, sauvegarde ou synchronisation ;
- générer et publier les sites statiques depuis le poste local ;
- générer les paquets finaux d'horaires, avec iCal/PDF, sans dépendre d'un serveur web public complet ;
- conserver uniquement les modules web nécessaires à l'administration locale et à la génération.

## Points favorables

- `startServer()` isole déjà le démarrage API et peut être appelé depuis Electron.
- Les appels frontend passent majoritairement par des services, ce qui limite le couplage direct.
- Les secrets restent côté backend et ne doivent pas être injectés dans le bundle frontend.
- Les publications statiques utilisent `path.resolve()` et une racine configurable, ce qui prépare mieux les chemins desktop.
- Les paramètres métier sont maintenant stockés dans des collections identifiables plutôt que dispersés dans le code.
- L'envoi final des horaires est déjà isolé dans un service backend, ce qui permet de le conserver comme action locale ou de le brancher plus tard sur Outlook.

## Points bloquants

Le blocage principal reste MongoDB. Tant que l'application dépend d'un MongoDB externe ou d'Atlas, elle peut être empaquetée en desktop, mais pas devenir totalement autonome.

Autres points à traiter avant un vrai portable autonome :

- définir une racine de données desktop stable ;
- choisir entre dossier portable et profil utilisateur Windows ;
- remplacer ou encapsuler la persistance Mongoose si une base embarquée est choisie ;
- faire l'inventaire des routes, services et écrans réellement nécessaires au flux générateur ;
- retirer les modules non liés plutôt que les embarquer dans le portable ;
- éviter que la publication statique PHP devienne une dépendance du mode desktop ;
- gérer les secrets de publication et SMTP sans les exposer au renderer Electron ;
- décider si l'envoi email doit fonctionner hors ligne, ouvrir Outlook, être désactivé, ou rester lié à SMTP.

## Stratégie recommandée

### Phase 1 - Gel 2026 et inventaire

- Garder la version web `26.5.8` comme dernier état web stable de référence.
- Ne pas ajouter Electron directement sur tout le programme existant.
- Lister les modules à conserver : configuration, import/export, planification, coordination des votes, génération, publication, synchronisation, envoi final des horaires.
- Lister les modules à supprimer ou isoler : administration web historique, accès non utilisés, routes legacy sans rôle de migration.
- Documenter toute collection ou structure de données nécessaire avant migration.
- Conserver des exports/imports robustes pour préparer le changement de stockage.

### Phase 2 - Noyau portable générateur

- Ajouter Electron uniquement quand le besoin devient concret.
- Charger le build React dans une fenêtre Electron.
- Lancer `startServer()` depuis le process principal.
- Pointer le frontend vers l'API locale Electron.
- Garder MongoDB externe au départ si cela réduit le risque.
- Limiter l'interface au flux local de génération et de publication.
- Valider les chemins Windows, les droits fichier, le démarrage et l'arrêt propre de l'API.

### Phase 3 - Autonomie des données

Deux options restent ouvertes :

- embarquer un MongoDB local portable ;
- migrer vers une base embarquée, probablement SQLite.

SQLite reste l'option la plus propre pour une vraie application desktop portable, mais elle demande une couche de persistance différente de Mongoose. MongoDB portable réduit la migration métier, mais complique la distribution, le démarrage, les chemins de données et la maintenance.

## Règles de préparation

- Ne pas appeler directement MongoDB depuis le frontend.
- Ne pas multiplier les chemins d'accès API hors de `src/config/appConfig.js` et des services existants.
- Garder la logique métier dans les services backend plutôt que dans les composants React.
- Ne pas porter un module dans Electron sans lien clair avec import, configuration, planification, coordination des votes, génération, publication, synchronisation ou export.
- Garder les compatibilités legacy uniquement comme aides de migration documentées.
- Ne pas exposer les secrets SMTP, JWT ou FTP dans le renderer Electron.
- Utiliser une racine configurable pour tous les fichiers locaux.
- Garder les publications statiques et les exports indépendants du chemin absolu du projet.
- Prévoir un export complet JSON/CSV avant toute migration de base.

## Impact des sites générés

Les sites générés deviennent le coeur de l'usage externe : soutenances publiées, votes, réponses et consultation distante. Le portable doit donc produire des sites autonomes et contrôlables, sans supposer que l'ancien web complet reste accessible.

Pour Electron :

- la publication des soutenances doit rester un export généré et publiable ;
- le mini-site de vote statique devient le canal distant privilégié ;
- la synchronisation JSONL doit rester un pont avec l'hébergement public, pas la persistance desktop principale ;
- un mode desktop hors ligne devrait écrire directement dans la base locale via l'API locale.

## Questions à trancher plus tard

Emplacement des données
Les données doivent‑elles rester dans le même dossier que l’exécutable ou dans le profil utilisateur Windows
→ Version portable : un dossier portant le nom de l’application est créé, et tous les fichiers nécessaires y sont stockés.

Fonctionnement hors ligne et envoi d’emails
L’application doit‑elle fonctionner entièrement hors ligne, y compris pour l’envoi d’emails
→ Oui, tout fonctionne localement.
Pour l’envoi d’emails : soit l’utilisateur fournit son adresse Outlook, soit une fenêtre Outlook s’ouvre pour finaliser l’envoi.
Le web sait déjà envoyer les paquets finaux via SMTP et tracer les statuts dans `finalScheduleDeliveries`; la version portable doit décider si elle garde ce canal ou si elle transforme cet envoi en brouillons Outlook contrôlés par l'utilisateur.

Compatibilité MongoDB Atlas (mode hybride)
→ Non, aucune compatibilité Atlas n’est requise.

Format d’export de référence
→ JSON et CSV, l’utilisateur choisit le format souhaité.

Mode portable : mono‑utilisateur ou base partagée
→ Mono‑utilisateur uniquement.

Publications statiques : desktop ou web/admin
→ Disponibles depuis le desktop.
La version web disparaît : le programme devient exclusivement une application desktop.

## Prochaine action utile

Ne pas lancer la migration Electron comme simple emballage du programme actuel.

La prochaine action raisonnable est de faire un inventaire fonctionnel module par module, puis de définir le noyau portable : configuration, génération de planification, génération des sites, publication, synchronisation, export et sauvegarde. Ensuite seulement, créer un petit prototype Electron connecté pour valider le packaging Windows sans toucher encore à toute la persistance.
