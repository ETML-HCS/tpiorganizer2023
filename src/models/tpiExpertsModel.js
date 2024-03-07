// Importation de Mongoose et définition du schéma
const mongoose = require('mongoose')
const Schema = mongoose.Schema

// Schéma pour les experts TPI
// Ce schéma définit la structure des documents dans la collection MongoDB.
// Chaque expert a un ID unique, un nom, un site et un email.
const tpiExpertsSchema = new Schema({
  _id: Schema.Types.ObjectId,
  id: Number,
  name: String,
  site: String,
  email: String,
  role:String,
  token: { type: String, required: false },
  date: {
    type: Date,
    default: function () {
      return this.token ? Date.now() : null
    }
  }
})

// Création du modèle Mongoose 'TpiExperts'
// IMPORTANT: Mongoose convertit par défaut le nom du modèle 'TpiExperts' en 'tpiexperts' (tout en minuscules)
// pour le nom de la collection dans MongoDB.
// Si le nom de votre collection dans MongoDB est exactement 'tpiExperts' (avec la casse spécifique),
// il est crucial de spécifier explicitement le nom de la collection lors de la création du modèle.
// Dans le cas contraire, Mongoose cherchera une collection nommée 'tpiexperts'.
const TpiExperts = mongoose.model('TpiExperts', tpiExpertsSchema, 'tpiExperts') // Le troisième argument spécifie le nom exact de la collection.

// Exportation du modèle pour une utilisation dans d'autres parties de l'application.
// Ce modèle est utilisé pour interagir avec la collection 'tpiExperts' dans MongoDB,
// notamment pour récupérer, ajouter, modifier ou supprimer des documents.
module.exports = TpiExperts

// Remarque : Assurez-vous que lors de l'utilisation de ce modèle dans les routes Express,
// la collection correspondante dans MongoDB existe et a le nom approprié.
// Cela garantira que les requêtes à la base de données fonctionnent comme prévu.
