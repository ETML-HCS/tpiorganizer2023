# Tache réalisée pour l'automatisation de mon application 
   1. Assurez-vous que vous êtes sur la branche principale : git checkout main
   2. Créez une nouvelle branche : git checkout -b prod
   3. Poussez la nouvelle branche vers votre dépôt distant : git push -u origin prod

## publication (ajouter uniquement build dans la branch prod )

Construisez votre application : npm run build
Ajoutez et committez les fichiers de build :
git add build/
git commit -m "Add production build"
Poussez les modifications vers la branche prod : git push origin prod

## Déploiement automatique 

- connection serveur de connection 
    ssh -p1322 bob_tpiorganiser@blue.section-inf.ch
- Si vous utilisez une clé SSH pour vous connecter, vous pouvez spécifier le chemin vers votre clé privée avec l'option -i.

Transfert des fichiers de build
 - scp -r /chemin/vers/votre/projet/build/ utpiorganiser@blue.section-inf.ch:/chemin/vers/votre/dossier/deployement

Vérification des fichiers déployés :
Configuration du serveur web 
Redémarrage du serveur web
Test de l'application


