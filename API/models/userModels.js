const mongoose = require('mongoose')

// Schéma pour les utilisateurs TPI
const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true }, // Prénom requis
    lastName: { type: String, required: true, trim: true }, // Nom de famille requis
    login: {
      type: String,
      unique: true,
      required: true,
      trim: true
    },
    email: {
      type: String,
      unique: true,
      required: true, // Email requis
      trim: true,
      match: /.+\@.+\..+/ // Validation de l'email
    },
    phone: { type: String, trim: true },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['student', 'projectManager', 'dean', 'expert'],
      required: true
    }, // Rôle du profil dans le suivi
    quota: [
      {
        expertise: { type: Number, min: 0 }, // Expertise ne peut pas être négative
        boss: { type: Number, min: 0 } // Boss ne peut pas être négatif
      }
    ]
  },
  { collection: 'tpiUsers' }
)

const User = mongoose.model('User', userSchema)

module.exports = User
