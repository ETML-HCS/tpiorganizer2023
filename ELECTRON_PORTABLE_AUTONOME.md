# Electron portable autonome

## Décision

La piste desktop retenue reste une application Electron portable et autonome pour Windows.

Le projet ne contient pas encore Electron. Les derniers nettoyages ont au contraire gardé l'application centrée sur le web, avec React/Vite côté frontend et Node/Express côté API. Ce document sert de référence unique pour préparer une future version desktop sans mélanger cette direction avec les travaux web en cours.

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

## Cible Electron

L'application finale devra pouvoir être lancée comme un exécutable Windows portable, sans installation serveur manuelle.

La cible fonctionnelle est :

- embarquer le build React dans une fenêtre Electron ;
- lancer l'API Express locale automatiquement ;
- utiliser une base de données locale ou embarquée ;
- stocker les données dans un dossier utilisateur ou portable clairement défini ;
- conserver une configuration minimale pour les usages hors ligne ;
- permettre un import/export complet pour migration, sauvegarde ou synchronisation ;
- conserver un chemin possible vers un mode hybride avec une base distante.

## Points favorables

- `startServer()` isole déjà le démarrage API et peut être appelé depuis Electron.
- Les appels frontend passent majoritairement par des services, ce qui limite le couplage direct.
- Les secrets restent côté backend et ne doivent pas être injectés dans le bundle frontend.
- Les publications statiques utilisent `path.resolve()` et une racine configurable, ce qui prépare mieux les chemins desktop.
- Les paramètres métier sont maintenant stockés dans des collections identifiables plutôt que dispersés dans le code.

## Points bloquants

Le blocage principal reste MongoDB. Tant que l'application dépend d'un MongoDB externe ou d'Atlas, elle peut être empaquetée en desktop, mais pas devenir totalement autonome.

Autres points à traiter avant un vrai portable autonome :

- définir une racine de données desktop stable ;
- choisir entre dossier portable et profil utilisateur Windows ;
- remplacer ou encapsuler la persistance Mongoose si une base embarquée est choisie ;
- éviter que la publication statique PHP devienne une dépendance du mode desktop ;
- gérer les secrets de publication et SMTP sans les exposer au renderer Electron ;
- décider si l'envoi email doit fonctionner hors ligne, être désactivé, ou rester lié à SMTP.

## Stratégie recommandée

### Phase 1 - Stabilisation web

- Garder l'application web fonctionnelle.
- Ne pas ajouter Electron tant que les flux planning, votes, liens et publication ne sont pas stabilisés.
- Continuer à garder MongoDB derrière le backend.
- Documenter toute nouvelle collection ou structure de données.
- Conserver les exports/imports robustes pour préparer une migration de stockage.

### Phase 2 - Prototype Electron connecté

- Ajouter Electron uniquement quand le besoin devient concret.
- Charger le build React dans une fenêtre Electron.
- Lancer `startServer()` depuis le process principal.
- Pointer le frontend vers l'API locale Electron.
- Garder MongoDB externe au départ pour limiter le risque.
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
- Ne pas exposer les secrets SMTP, JWT ou FTP dans le renderer Electron.
- Utiliser une racine configurable pour tous les fichiers locaux.
- Garder les publications statiques et les exports indépendants du chemin absolu du projet.
- Prévoir un export complet JSON/CSV avant toute migration de base.

## Impact des publications statiques

La publication statique actuelle est utile pour le web, mais elle ne doit pas devenir le coeur du mode Electron.

Pour Electron :

- la publication des soutenances peut rester un export HTML/PHP optionnel ;
- le mini-site de vote statique reste utile pour un hébergement public distant ;
- la synchronisation JSONL doit être considérée comme un pont web, pas comme la persistance desktop principale ;
- un mode desktop hors ligne devrait écrire directement dans la base locale via l'API locale.

## Questions à trancher plus tard

- Les données doivent-elles rester dans le même dossier que l'exécutable ou dans le profil utilisateur Windows ?
- L'application doit-elle fonctionner entièrement hors ligne, y compris l'envoi d'emails ?
- Faut-il conserver une compatibilité MongoDB Atlas pour un mode hybride ?
- Quel format d'export complet doit devenir la référence : JSON, CSV, ou les deux ?
- Le mode portable doit-il être mono-utilisateur ou partager une base entre plusieurs postes ?
- Les publications statiques doivent-elles être disponibles depuis le desktop, ou réservées au mode web/admin ?

## Prochaine action utile

Ne pas lancer la migration Electron maintenant.

La prochaine action raisonnable est de stabiliser les flux web ajoutés récemment, surtout publication statique des votes, synchronisation, configuration de publication et rappels de vote. Ensuite seulement, créer un petit prototype Electron connecté à MongoDB externe pour valider le packaging Windows sans toucher encore à la persistance.
