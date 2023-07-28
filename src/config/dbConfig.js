const mongoose = require('mongoose');
const dbName = 'dbOrganizer';

// localhost ou 127.0.0.1 ne foncitonne plus :-( 
// https://stackoverflow.com/questions/46523321/mongoerror-connect-econnrefused-127-0-0-127017

mongoose.connect(`mongodb://0.0.0.0:27017/${dbName}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', (err) => console.error('Erreur de connexion à MongoDB :', err));
db.once('open', () => console.log('Connexion à la base de données réussie !'));

module.exports = db;
