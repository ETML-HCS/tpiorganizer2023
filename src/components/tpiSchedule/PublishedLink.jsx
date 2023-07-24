import React from "react";

const PublishedLink = ({ match }) => {
  // Utilisez la valeur de match.params pour obtenir le nom de lien publié depuis l'URL
  const publishedLinkName = match.params.linkName;

  // Vous pouvez utiliser cette variable pour afficher la planification spécifique associée à ce nom de lien

  return (
    <div>
      {/* Contenu de la page publiée */}
      <h1>Planification publiée</h1>
      <p>
        Vous visualisez actuellement la planification pour "{publishedLinkName}"
      </p>
      {/* Autres contenus */}
    </div>
  );
};

export default PublishedLink;
