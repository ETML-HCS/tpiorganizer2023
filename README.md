# TPIorganizer 2023 - Version stable VS.260502

TPIorganizer 2023 est une application React conçue pour faciliter l'organisation des défenses de travaux de fin d'études (TPI). Elle offre une gestion flexible des dates, des salles et du workflow de validation des plannings.

## Screenshot

![Connexion](/captures/login.png)
![Accueil](/captures/accueil.png)
![Planification](/captures/planification.png)
![Planning et votes](/captures/planning-votes.png)
![Gestion TPI](/captures/gestion-tpi.png)
![Parties prenantes](/captures/parties-prenantes.png)
![Configuration](/captures/configuration.png)
![Défenses](/captures/defenses.png)

## Points forts

- **Filtrage et affichage** : Vision claire des défenses par date et salle.
- **Gestion des créneaux** : Création et édition aisées des créneaux de défense.
- **Export/import CSV** : Transfert simple des données de défenses.
- **Navigation intuitive** : Système de routes pour une expérience utilisateur fluide.
- **Drag & drop** : Placement facile des TPI dans l'agenda.

## Démarrage rapide

1. **Installation** : Avoir Node.js, cloner le dépôt, installer les dépendances avec `npm install`.
2. **Utilisation complète** : Lancer l'app avec `npm run dev`, accéder au frontend via `http://localhost:3000`.
3. **Frontend seul** : Lancer uniquement Vite avec `npm start`.

## Orientation desktop

La piste Electron portable autonome est cadrée dans [ELECTRON_PORTABLE_AUTONOME.md](./ELECTRON_PORTABLE_AUTONOME.md). Ce document remplace les anciens plans dispersés à la racine du dépôt.

## Développement

- Pour démarrer le backend + frontend en mode développement : `npm run dev`
- Frontend accessible sur : `http://localhost:3000`
- API locale exposée sur : `http://localhost:5001`
- Pour démarrer uniquement l'API locale : `npm run backend`
- Vérifier le code avec : `npx eslint src --ext .js,.jsx`

## Notes de maintenance

- Corrections récentes sur le planning : gestion des états de vote et variables manquantes dans `PlanningDashboard`.
- Ajustements tests unitaires pour éviter l'accès direct aux nœuds DOM et utiliser les sélecteurs `@testing-library`.
- Le projet utilise Vite pour le développement local et React 18.

## Problèmes connus

- `PlanningDashboard` peut planter si des données de planning sont manquantes pour une année non configurée.
- HMR Vite peut parfois signaler une erreur de websocket sur certains environnements Windows sans impact fonctionnel sur l'app.
- Certains tests existants utilisent encore des accès DOM directs ou `container.querySelector`.

## Tests

- Exécuter les tests unitaires avec : `npm test`
- Les tests de composants sont centrés sur `@testing-library/react`.

## Contributions

Les améliorations et corrections via pull requests sont encouragées. Veillez à respecter les bonnes pratiques de développement.

## Licence

Sous licence MIT, détails dans le fichier LICENSE.

## Évolution récente

- **Juillet** : Améliorations de l'interface, intégration MongoDB, gestion des données améliorée.
- **Novembre** : Sécurisation des variables d'environnement, passage à MongoDB Atlas pour une meilleure scalabilité.

## À venir

- **Notifications par mail** : Mise en place d'une fonctionnalité d'envoi de mails pour une meilleure communication.
- **Sauvegarde cloud** : Intégration d'une base de données NoSQL cloud pour une accessibilité et sécurité accrues.
- **Publication de planning** : Création d'un bouton "Publier" pour partager facilement le planning des défenses.

L'engagement envers l'amélioration continue de TPIorganizer 2023 reste fort, avec un accent sur la fourniture d'outils pratiques et efficaces pour la gestion des défenses TPI.
