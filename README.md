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

## Voici une synthèse de l'état actuel de mon programme

J'ai travaillé sur le développement de mon application en React, TPIorganizer version 2023. Jusqu'à présent, j'ai réussi à mettre en place l'affichage de base, mais je n'ai pas encore implémenté la fonctionnalité d'édition ni les données réelles.

Pour le moment, l'application affiche les soutenances en fonction des filtres de date, de site et d'autres critères. J'ai créé le composant principal, DateRoom, qui contient l'en-tête, les TPISlots et le bouton de suppression. Chaque TPISlot affiche l'heure de début et de fin, ainsi qu'une TpiCard simulée, mais sans données réelles.

Concernant les fonctionnalités d'édition, je n'ai pas encore implémenté la possibilité de modifier les éléments du composant principal ou de créer de nouveaux éléments. Cela reste à faire dans les prochaines étapes de développement.

De plus, pour le moment, l'application ne gère pas de données réelles. Les informations affichées sont fictives et statiques, et il n'y a pas de fonctionnalité d'importation ou d'exportation de données via un fichier CSV.

Malgré ces limitations, je suis satisfait de la progression de mon application jusqu'à présent. J'ai réussi à mettre en place l'infrastructure de base et à afficher les éléments nécessaires. Mon prochain objectif sera de travailler sur l'implémentation de l'édition et de la gestion des données réelles pour rendre l'application plus fonctionnelle et interactive.
