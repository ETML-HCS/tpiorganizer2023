#!/bin/bash

# Vérifier si le service MongoDB est en cours d'exécution
if pgrep -x "mongod" > /dev/null
then
    echo "MongoDB est déjà en cours d'exécution."
else
    # Démarrer le service MongoDB si ce n'est pas déjà fait
    mongod --fork --logpath /var/log/mongodb.log
fi

# Vérifier si le service NGINX est en cours d'exécution
if pgrep -x "nginx" > /dev/null
then
    echo "NGINX est déjà en cours d'exécution."
else
    # Démarrer le service NGINX si ce n'est pas déjà fait
    sudo service nginx start
fi

# Vérifier si le serveur Node.js est en cours d'exécution
if pgrep -x "node" > /dev/null
then
    echo "Le serveur Node.js est déjà en cours d'exécution."
else
    # Démarrer le serveur Node.js en arrière-plan
    node server.js &
fi

# Afficher un message de confirmation
echo "Tous les services sont opérationnels."

# Démarrer le serveur Serve pour servir les fichiers statiques du répertoire 'build' sur le port 3000
serve -s build -l 3000