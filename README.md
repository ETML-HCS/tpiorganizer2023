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

- **17 juillet** : Terminé la fonctionnalité d'ajout et de suppression des salles. Les utilisateurs peuvent créer de nouveaux créneaux de soutenance en sélectionnant la date, le site et la salle. Un design adaptatif a été mis en place pour s'ajuster selon les choix de site (ETML/CFPV). Les utilisateurs peuvent également sélectionner les salles disponibles et remplir le champ de date au format valide pour une expérience simplifiée.

- **18 juillet** : Ajout des fonctionnalités d'édition des créneaux de soutenance existants. Les utilisateurs peuvent désormais modifier les informations telles que la date, le site et la salle pour les créneaux existants. Correction d'un bug qui inversait l'état d'édition avec le bouton "Save" après plusieurs basculements entre le mode édition et le mode sauvegarde.

- **19 juillet** : Implémentation d'une version fonctionnelle de drag and drop pour permettre aux utilisateurs de déplacer les créneaux de soutenance d'une salle à une autre. Cette fonctionnalité s'est révélée être un défi complexe, mais après plusieurs essais et ajustements, nous avons réussi à la rendre opérationnelle.

- **22 juillet** : Suite à l'implémentation du drag and drop, nous avons mis à jour le CSS pour améliorer la lisibilité et augmenter la visibilité des éléments. Nous avons également ajouté quelques effets simples mais sympathiques pour améliorer l'expérience utilisateur, rendant l'application plus attrayante et conviviale.

### Prochaines étapes :

1. Envoi de mails : Je vais implémenter la fonctionnalité d'envoi de mails en utilisant une liste prédéfinie au format JSON. Les utilisateurs pourront facilement envoyer des notifications par e-mail aux participants des soutenances, ce qui améliorera la communication et la coordination des événements.

2. Sauvegarde dans une base de données NoSQL (cloud) : Je prévois d'ajouter la possibilité de sauvegarder les données dans une base de données NoSQL hébergée dans le cloud. Cela permettra aux utilisateurs de stocker leurs informations de manière sécurisée et d'accéder aux données de n'importe où, ce qui garantira une meilleure accessibilité et une sauvegarde fiable des informations.

> Je suis extrêmement satisfait des progrès réalisés jusqu'à présent et de l'implémentation réussie du drag and drop. J'ai également effectué des améliorations significatives sur le CSS pour améliorer la lisibilité et la visibilité, tout en ajoutant des effets simples mais sympathiques. Je suis impatient de poursuivre le développement de TPIorganizer version 2023 et d'offrir une expérience plus complète et fonctionnelle aux utilisateurs. Ces ajouts renforceront l'utilité de l'application et faciliteront la gestion efficace des soutenances.

### Suite 

Voici comment vous pouvez créer un lien qui permettra aux utilisateurs d'accéder à votre programme une fois qu'il sera terminé :

1. Mettez en place un bouton "Publier" : Créez un bouton dans votre application que l'utilisateur peut cliquer pour publier son programme. Ce bouton déclenchera le processus de génération du lien.

2. Obtenez l'entrée de l'utilisateur : Lorsque l'utilisateur clique sur le bouton "Publier", vous pouvez lui demander de saisir un nom pour le lien. Vous pouvez utiliser une boîte de dialogue, un formulaire ou tout autre élément d'interface utilisateur pour obtenir l'entrée de l'utilisateur.

3. Générez le lien : Une fois que vous avez l'entrée de l'utilisateur (le nom du lien souhaité), vous devez créer un lien ou une URL qui pointe vers la page HTML de votre programme avec le nom spécifié. Vous pouvez utiliser n'importe quel format d'URL que vous préférez, comme `/nomdulien`.

4. Sauvegardez le lien : Vous devez enregistrer le lien généré sur le serveur ou dans une base de données avec les données pertinentes du programme de l'utilisateur.

5. Redirigez vers le lien : Après avoir généré et sauvegardé le lien, vous pouvez fournir à l'utilisateur une confirmation que son programme a été publié avec succès. Vous pouvez également inclure un lien qui lui permettra d'accéder directement au programme. En cliquant sur ce lien, l'utilisateur sera redirigé vers la page HTML associée au nom de lien fourni.

Voici un exemple simplifié de comment vous pouvez réaliser cela en utilisant React et JavaScript :

```jsx
import React, { useState } from "react";

const App = () => {
  const [publishedLink, setPublishedLink] = useState(null);
  const [linkName, setLinkName] = useState("");

  const handlePublish = () => {
    // Validez le nom du lien (assurez-vous qu'il n'est pas vide et ne contient pas de caractères invalides)
    if (!linkName.trim() || linkName.includes("/")) {
      alert("Veuillez entrer un nom de lien valide.");
      return;
    }

    // Générez l'URL pour le lien publié
    const publishedUrl = `/${linkName}`;

    // Sauvegardez le lien sur le serveur ou dans une base de données (vous pouvez mettre en œuvre cette partie en fonction de votre configuration de serveur)
    // À des fins de démonstration, nous mettons simplement à jour l'état ici.
    setPublishedLink(publishedUrl);
  };

  return (
    <div>
      {publishedLink ? (
        <div>
          <p>Votre programme a été publié avec succès !</p>
          <p>Accédez-y en utilisant le lien ci-dessous :</p>
          <a href={publishedLink}>{publishedLink}</a>
        </div>
      ) : (
        <div>
          <input
            type="text"
            placeholder="Entrez le nom du lien"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
          />
          <button onClick={handlePublish}>Publier</button>
        </div>
      )}
    </div>
  );
};

export default App;
```
