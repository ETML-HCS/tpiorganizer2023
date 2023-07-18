# TPIorganizer version 2023

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

- **17 juillet** : J'ai terminé la fonctionnalité qui permet l'ajout et la suppression des salles. Maintenant, les utilisateurs peuvent créer de nouveaux créneaux de soutenance en sélectionnant la date, le site et la salle. De plus, j'ai mis en place un design adaptatif qui s'ajuste parfaitement en fonction des choix de site (ETML/CFPV). Les utilisateurs peuvent également sélectionner les salles disponibles et remplir le champ de date au format valide pour simplifier leur expérience.

- **18 juillet** : J'ai ajouté les fonctionnalités d'édition des créneaux de soutenance existants. Les utilisateurs peuvent maintenant modifier les informations telles que la date, le site et la salle pour les créneaux de soutenance existants. J'ai également corrigé un bug qui inversait l'état d'édition avec le bouton "Save" après plusieurs basculements entre le mode édition et le mode sauvegarde.

### Prochaines étapes :

1. Envoi de mails : Je vais mettre en place la fonctionnalité d'envoi de mails en utilisant une liste prédéfinie au format JSON. Les utilisateurs pourront envoyer des notifications par e-mail aux participants des soutenances.

2. Sauvegarde dans une base de données NoSQL (cloud) : Je prévois d'ajouter la possibilité de sauvegarder les données dans une base de données NoSQL hébergée dans le cloud. Cela permettra aux utilisateurs de stocker leurs informations de manière sécurisée et durable.

> Je suis satisfait des progrès réalisés jusqu'à présent et je suis impatient de continuer à améliorer TPIorganizer version 2023 pour offrir une expérience plus complète et fonctionnelle aux utilisateurs.