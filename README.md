# TPIorganizer version 2023 - Mise à jour du [23.07.2023] | V 0.10

TPIorganizer version 2023 est une application React permettant d'organiser et de gérer les soutenances de TPI (Travaux de fin d'études) selon différentes dates et salles.

## Fonctionnalités

- Affichage des soutenances selon un filtre de date et de salle.
- Création de nouveaux créneaux de soutenance avec un composant principal `DateRoom` composé de `TPISlots` et de `BreakLines`.
- Édition des créneaux de soutenance existants, ainsi que la possibilité de créer de nouveaux créneaux.
- Exportation et importation des données des soutenances via un fichier CSV.

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

- **17 juillet** : Terminé la fonctionnalité d'ajout et de suppression des salles. Les utilisateurs peuvent créer de nouveaux créneaux de soutenance en sélectionnant la date, le site et la salle. Un design adaptatif a été mis en place pour s'ajuster selon les choix de site (ETML/CFPV). Les utilisateurs peuvent également sélectionner les salles disponibles et remplir le champ de date au format valide pour une expérience simplifiée.

- **18 juillet** : Ajout des fonctionnalités d'édition des créneaux de soutenance existants. Les utilisateurs peuvent désormais modifier les informations telles que la date, le site et la salle pour les créneaux existants. Correction d'un bug qui inversait l'état d'édition avec le bouton "Save" après plusieurs basculements entre le mode édition et le mode sauvegarde.

- **22 juillet** : Le drag and drop initial s'est avéré plus compliqué que prévu, donc après réflexion, j'ai décidé de rendre la zone des temps non éditable pour éviter toute modification accidentelle. Cependant, j'ai mis en place un fichier de configuration qui permet de fixer les plages des différents créneaux de défenses. Ce fichier de configuration offre également la possibilité d'ajouter de nouvelles classes pour une meilleure personnalisation et adaptabilité de l'application. Ces nouvelles fonctionnalités devraient améliorer l'expérience globale des utilisateurs.

- **23 juillet** : Ajout d'animations CSS pour améliorer l'expérience utilisateur lors de l'interaction avec les boutons. Les boutons affichent maintenant différentes couleurs grâce à un système de couleurs aléatoires. Modification de la classe CSS saveMessage pour afficher un message temporaire lors de la sauvegarde des données dans le local storage. / est maintenant (home.jsx) le point d'entrée de l'application, ouvrant la voie au développement de plusieurs mini programmes autour des TPI.

## Prochaines étapes

1. Envoi de mails : Je vais implémenter la fonctionnalité d'envoi de mails en utilisant une liste prédéfinie au format JSON. Les utilisateurs pourront facilement envoyer des notifications par e-mail aux participants des soutenances, ce qui améliorera la communication et la coordination des événements.

2. Sauvegarde dans une base de données NoSQL (cloud) : Je prévois d'ajouter la possibilité de sauvegarder les données dans une base de données NoSQL hébergée dans le cloud. Cela permettra aux utilisateurs de stocker leurs informations de manière sécurisée et d'accéder aux données de n'importe où, ce qui garantira une meilleure accessibilité et une sauvegarde fiable des informations.

3. Création d'un bouton "Publier" : J'envisage de mettre en place un bouton "Publier" qui permettra de générer un lien accessible pour les personnes souhaitant consulter le planning des soutenances. Ce lien unique dirigera les utilisateurs vers une page HTML spécifique affichant le planning de manière lisible et interactive, facilitant ainsi le partage du planning avec les étudiants, les membres du jury et autres parties prenantes.

4. Personnalisation avancée avec un fichier de configuration : J'ai déjà mis en place un fichier de configuration permettant de fixer les plages des différents créneaux de défenses. Dans les prochaines étapes, je prévois d'étendre ce fichier de configuration pour offrir aux utilisateurs la possibilité d'ajouter de nouvelles classes pour une meilleure personnalisation et adaptabilité de l'application. Cela permettra aux utilisateurs de définir des configurations spécifiques à leurs besoins et préférences.

>Je suis très satisfait des progrès réalisés jusqu'à présent et de l'évolution de TPIorganizer version 2023. Je suis enthousiaste à l'idée de continuer le développement de cette application et de fournir des fonctionnalités encore plus utiles et pratiques pour les utilisateurs.
