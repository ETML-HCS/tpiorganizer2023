require('dotenv').config();
const mongoose = require('mongoose');

const dbName = process.env.DB_NAME;
const username = encodeURIComponent(process.env.DB_USERNAME);
const password = encodeURIComponent(process.env.DB_PASSWORD);
const cluster = process.env.DB_CLUSTER;

const uri = `mongodb+srv://${username}:${password}@${cluster}/${dbName}`;

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connexion à la base de données réussie !');
}).catch(err => {
  console.error('Erreur de connexion à MongoDB :', err);
});

const db = mongoose.connection;

module.exports = db;
