#!/bin/bash

# Démarrer le serveur Node.js
node server.js

# Démarrer le serveur Serve pour servir les fichiers statiques du répertoire 'build' sur le port 3000
serve -s build -l 3000

