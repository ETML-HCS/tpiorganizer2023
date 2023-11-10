****# TPIorganizer version 2023 - Mise à jour du [28.07.2023] | V 0.11 (Prototype, logiciel non fonctionnelle)

TPIorganizer version 2023 est une application React permettant d'organiser et de gérer les soutenances de TPI (Travaux de fin d'études) selon différentes dates et salles.

## Fonctionnalités

- Affichage des soutenances selon un filtre de date et de salle.
- Création de nouveaux créneaux de soutenance avec un composant principal `DateRoom` composé de `TPISlots` et de `BreakLines`.
- Édition des créneaux de soutenance existants, ainsi que la possibilité de créer de nouveaux créneaux.
- Exportation et importation des données des soutenances via un fichier CSV.
- Implémentation d'un système de Routes (URL) permettant d'offrir plusieurs programmes :
  - Gestion des TPI
  - Suivi de l'élève (candidat)
  - **Inscription** en tant qu'expert, chef de projet, doyen ou candidat
  - Module de planification pour créer et gérer les salles ainsi que poser les TPI selon l'horaire organisé en slot
  - Fonction pour le cliquer et déposer des TPI
  - Possibilité future pour les abonnés de s'inscrire sur une liste d'attente pour les TPI, attribuée par un responsable selon des critères spécifiques
  - Contrôle visuel lors de la planification selon le slot time et les noms des personnes figurant dans le TPI
  - Amélioration en cours de développement pendant l'édition de la planification avec des propositions basées sur la liste des TPI (liée au numéro de référence du TPI)

## Installation

1. Assurez-vous d'avoir Node.js installé sur votre machine.
2. Clonez ce dépôt sur votre machine : `git clone https://github.com/votre-utilisateur/tpiorganizer-2023.git`
3. Accédez au répertoire du projet : `cd tpiorganizer-2023`
4. Installez les dépendances : `npm install`

## Utilisation

1. Démarrez l'application en mode développement : `npm start`
2. Ouvrez votre navigateur et accédez à l'URL : `http://localhost:3000`
3. Vous pouvez maintenant utiliser l'application pour afficher, créer et éditer les créneaux de soutenance.

## Structure du projet

Le projet est organisé de la manière suivante :

- `src/` : Contient les fichiers sources de l'application.
  - `components/` : Comprend les différents composants de l'application, tels que `DateRoom`, `TPISlot`, `BreakLine`, etc.
  - `App.js` : Le composant principal de l'application.
  - `data.js` : Gère les données des soutenances et les fonctionnalités d'export/import.
- `public/` : Contient les fichiers statiques de l'application.

## Contribuer

Les contributions à ce projet sont les bienvenues ! Vous pouvez ouvrir une pull request pour proposer des améliorations, des corrections de bugs, ou ajouter de nouvelles fonctionnalités.

Assurez-vous de tester votre code et de suivre les bonnes pratiques de développement avant de soumettre une pull request.

## License

Ce projet est sous licence MIT. Pour plus d'informations, consultez le fichier LICENSE.

## Journal de développement

**17 juillet** :

- Terminé la fonctionnalité d'ajout et de suppression des salles. Design adaptatif pour les créneaux de soutenance en fonction du choix de site (ETML/CFPV). 
- Sélection simplifiée des salles disponibles et des dates au format valide.

**18 juillet** :

- Ajout des fonctionnalités d'édition des créneaux de soutenance existants. 
- Correction d'un bug lié à l'état d'édition avec le bouton "Save".

**22 juillet** : 

- Mise en place d'un fichier de configuration pour les plages de créneaux de défenses. 
- Possibilité d'ajouter de nouvelles classes pour une meilleure personnalisation.

**23 juillet** :

- Ajout d'animations CSS pour améliorer l'expérience utilisateur avec les boutons.
- Affichage de différentes couleurs de boutons grâce à un système de couleurs aléatoires.

**28 juillet** :

- Intégration de la base de données MongoDB pour les éléments tpiList et TpiRooms.
- Importation des données à partir d'un fichier CSV pour faciliter le remplissage initial de la base de données.
- Réorganisation du code pour une meilleure structure et refonte complète de tpiRooms.
- Correction du bug de perte de données des tpiData.
- Amélioration de la gestion des sauvegardes entre le localStorage et la base de données.
- Unification des aspects pour une apparence plus cohérente dans l'ensemble de l'application.
- Création de tpiuser dans le but de suivre et de tracer les utilisateurs.
- Travaux en cours pour l'implémentation du login avec le mot de passe hash.
- Mise en place des tpilists dans tpiRoom pour accélérer la planification des soutenances.

**10.11.2023 :**
Ajout d'un fichier .env pour la sécurisation des variables d'environnement, y compris les identifiants de base de données. 
Bien que l'utilisation de MongoDB Atlas ait été envisagée pour optimiser la gestion des données et la scalabilité, cette idée a été finalement écartée au profit de solutions plus adaptées à nos besoins actuels.
Consulter les tâches confiées à Azur
    
## Mise à jour pour Azur

### Transition vers MariaDB

- Nous remplaçons MongoDB par MariaDB pour une gestion de données améliorée.
- Les sauvegardes de LocalStorage seront intégrées à MariaDB.

### Nouvelles Fonctionnalités

- **Validation des Rendez-vous** : Les experts et chefs de projet pourront confirmer leur présence, signalée par un changement de couleur d'un indicateur.
- **Contrôle de Planification** : Un système de couleurs identifiera les conflits d'horaires et les défis logistiques pour les déplacements entre sites.

## Prochaines étapes

1. Envoi de mails : Je vais implémenter la fonctionnalité d'envoi de mails en utilisant une liste prédéfinie au format JSON. Les utilisateurs pourront facilement envoyer des notifications par e-mail aux participants des soutenances, ce qui améliorera la communication et la coordination des événements.

2. Sauvegarde dans une base de données NoSQL (cloud) : Je prévois d'ajouter la possibilité de sauvegarder les données dans une base de données NoSQL hébergée dans le cloud. Cela permettra aux utilisateurs de stocker leurs informations de manière sécurisée et d'accéder aux données de n'importe où, ce qui garantira une meilleure accessibilité et une sauvegarde fiable des informations.

3. Création d'un bouton "Publier" : J'envisage de mettre en place un bouton "Publier" qui permettra de générer un lien accessible pour les personnes souhaitant consulter le planning des soutenances. Ce lien unique dirigera les utilisateurs vers une page HTML spécifique affichant le planning de manière lisible et interactive, facilitant ainsi le partage du planning avec les étudiants, les membres du jury et autres parties prenantes.

4. Personnalisation avancée avec un fichier de configuration : J'ai déjà mis en place un fichier de configuration permettant de fixer les plages des différents créneaux de défenses. Dans les prochaines étapes, je prévois d'étendre ce fichier de configuration pour offrir aux utilisateurs la possibilité d'ajouter de nouvelles classes pour une meilleure personnalisation et adaptabilité de l'application. Cela permettra aux utilisateurs de définir des configurations spécifiques à leurs besoins et préférences.

>Je suis satisfait des progrès réalisés jusqu'à présent dans TPIorganizer version 2023. Le projet devient plus complexe, demandant plus de temps et d'efforts pour le développement. Malgré cela, je reste enthousiaste à l'idée de continuer à fournir des fonctionnalités utiles et pratiques aux utilisateurs. Je suis convaincu que nos efforts porteront leurs fruits, et je suis déterminé à relever les défis pour atteindre nos objectifs.
