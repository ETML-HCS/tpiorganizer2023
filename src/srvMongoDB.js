const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./config/dbConfig');
const TpiModels = require('./models/tpiModels'); 
const User = require('./models/userModels');
const TpiRoomModel = require('./models/tpiRoomsModels');

const app = express();
const port = 5000;

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('App is Working');
});

/** #region: TPI MODEL */

// Route pour enregistrer un nouveau modèle de TPI
// amélioration avec update si existant :-)
app.post('/save-tpi', async (req, res) => {
  try {
    const modelData = req.body;
    const existingModel = await TpiModels.findOne({ refTpi: modelData.refTpi });

    if (existingModel) {
      // Si un modèle avec la même référence existe déjà, mettez à jour les données de ce modèle
      const updatedModel = await TpiModels.findByIdAndUpdate(existingModel._id, modelData, { new: true });
      console.log('Modèle de TPI mis à jour avec succès:', updatedModel);
      res.json(updatedModel);
    } else {
      // Sinon, enregistrez un nouveau modèle de TPI
      const newModel = new TpiModels(modelData);
      const savedModel = await newModel.save();
      console.log('Nouveau modèle de TPI enregistré avec succès:', savedModel);
      res.json(savedModel);
    }
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du modèle de TPI:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du modèle de TPI' });
  }
});


// Route pour récupérer tous les modèles de TPI
app.get('/get-tpi', async (req, res) => {
  console.log('get-tpi');
  try {
    const models = await TpiModels.find();
    console.log('Modèles de TPI récupérés:', models);
    res.json(models);
  } catch (error) {
    console.error('Erreur lors de la récupération des modèles de TPI:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des modèles de TPI' });
  }
});

// Route pour mettre à jour un modèle de TPI par son ID
app.put('/update-tpi/:id', async (req, res) => {
  const tpiId = req.params.id;
  const updateData = req.body;

  try {
    const updatedTpi = await TpiModels.findByIdAndUpdate(tpiId, updateData, { new: true });
    console.log('TPI mis à jour avec succès:', updatedTpi);
    res.json(updatedTpi);
  } catch (error) {
    console.error('Erreur lors de la mise à jour du TPI:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du TPI' });
  }
});

// Route pour récupérer un modèle de TPI par son ID
app.get('/get-tpi/:id', async (req, res) => {
  const tpiId = req.params.id;

  try {
    const tpi = await TpiModels.findById(tpiId);
    if (!tpi) {
      console.log('Aucun TPI trouvé avec cet ID:', tpiId);
      res.status(404).json({ error: 'Aucun TPI trouvé avec cet ID' });
    } else {
      console.log('TPI récupéré avec succès:', tpi);
      res.json(tpi);
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du TPI:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du TPI' });
  }
});


/** #endregion*/

/**#region: TPI rooms */

// Route pour enregistrer une nouvelle salle de TPI
app.post('/save-tpi-rooms', async (req, res) => {
  try {
    const roomData = req.body;
    console.log(roomData);
    const newRoom = new TpiRoomModel(roomData);
    const savedRooms = await newRoom.save();
    console.log('Salle de TPI enregistrée avec succès:', savedRooms);
    res.json(savedRooms);
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la salle de TPI:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la salle de TPI' });
  }
});

// Route pour récupérer toutes les salles de TPI
app.get('/get-tpi-rooms', async (req, res) => {
  try {
    const rooms = await TpiRoomModel.find();
    console.log('Salles de TPI récupérées:', rooms);
    res.json(rooms);
  } catch (error) {
    console.error('Erreur lors de la récupération des salles de TPI:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des salles de TPI' });
  }
});

// Route pour récupérer une salle de TPI par son ID
app.get('/get-tpi-room/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    const room = await TpiRoomModel.findById(roomId);
    console.log('Salle de TPI récupérée:', room);
    res.json(room);
  } catch (error) {
    console.error('Erreur lors de la récupération de la salle de TPI:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la salle de TPI' });
  }
});

// Route pour mettre à jour une salle de TPI
app.put('/update-tpi-room/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    const roomData = req.body;
    const updatedRoom = await TpiRoomModel.findByIdAndUpdate(roomId, roomData, { new: true });
    console.log('Salle de TPI mise à jour:', updatedRoom);
    res.json(updatedRoom);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la salle de TPI:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la salle de TPI' });
  }
});

// Route pour supprimer une salle de TPI
app.delete('/delete-tpi-room/:id', async (req, res) => {
  try {
    const roomId = req.params.id;
    await TpiRoomModel.findByIdAndDelete(roomId);
    console.log('Salle de TPI supprimée avec succès.');
    res.json({ message: 'Salle de TPI supprimée avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la salle de TPI:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la salle de TPI' });
  }
});
/**#endregion */



/**#region: tpiUsers */

// Route pour la création d'un nouvel utilisateur
app.post('/inscription', async (req, res) => {
  try {
    const userData = req.body; // Récupérer les données d'inscription envoyées depuis le client

    // Traiter les données d'inscription et enregistrer dans la base de données (utilisez le modèle User ici)
    const user = new User(userData);
    const savedUser = await user.save();
    console.log('Utilisateur enregistré avec succès:', savedUser);
    // Répondre au client avec les données enregistrées (vous pouvez renvoyer seulement l'ID ou l'objet complet, selon vos besoins)
    res.json(savedUser);
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des données d\'inscription :', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement des données d\'inscription' });
  }
});


// Route pour récupérer tous les utilisateurs
app.get('/suivi-etudiants', async (req, res) => {
  try {
    // Utilisez la méthode find() pour récupérer tous les utilisateurs depuis la base de données
    const users = await User.find();
    // Répondre au client avec les données récupérées
    res.json(users);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs :', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// Route pour mettre à jour un utilisateur par son ID
app.put('/suivi-etudiants/:id', async (req, res) => {
  const userId = req.params.id;
  const updateData = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });
    console.log('Utilisateur mis à jour avec succès:', updatedUser);
    res.json(updatedUser);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur :', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'utilisateur' });
  }
});

// Route pour supprimer un utilisateur par son ID
app.delete('/suivi-etudiants/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    const deletedUser = await User.findByIdAndDelete(userId);
    console.log('Utilisateur supprimé avec succès:', deletedUser);
    res.json(deletedUser);
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur :', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur' });
  }
});



/**#endregion */

app.listen(port, () => {
  console.log(`Serveur backend en cours d'exécution sur le port ${port}`);
});
