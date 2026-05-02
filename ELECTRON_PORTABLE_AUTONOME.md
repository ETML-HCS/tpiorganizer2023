# Electron portable autonome

## Decision

Le choix retenu pour l'evolution desktop est une application Electron portable et autonome.

L'objectif n'est pas de le construire immediatement, mais de preparer le terrain pour pouvoir y aller proprement plus tard, sans melanger cette direction avec les travaux web actuels.

## Cible

L'application finale devra pouvoir etre lancee comme un executable Windows portable, sans installation serveur manuelle.

La cible fonctionnelle est :

- une interface React embarquee dans Electron ;
- une API locale lancee automatiquement par l'application ;
- une base de donnees locale ou embarquee ;
- des donnees stockees dans un dossier utilisateur ou un dossier portable clairement defini ;
- une configuration minimale pour les usages hors ligne ;
- une possibilite ulterieure d'import/export ou de synchronisation avec une base distante si besoin.

## Etat actuel

Le projet est aujourd'hui structure ainsi :

- frontend React construit avec Vite ;
- backend Node/Express dans `API/serverAPI.js` ;
- persistance MongoDB via Mongoose ;
- configuration API centralisee cote frontend dans `src/config/appConfig.js` ;
- demarrage backend deja expose par `startServer()`, ce qui facilitera l'integration Electron.

Le point bloquant pour un vrai mode autonome est MongoDB. Tant que l'application depend d'un MongoDB externe ou d'Atlas, elle peut etre portable mais pas totalement autonome.

## Strategie recommandee

La strategie la plus saine est de proceder en deux temps.

### Phase 1 - Preparations sans migration

- Garder l'application web fonctionnelle.
- Ne pas introduire Electron tant que les flux metier principaux ne sont pas stabilises.
- Eviter d'ajouter de nouvelles dependances directes a MongoDB dans le frontend.
- Centraliser autant que possible les appels API dans les services existants.
- Garder les operations de donnees derriere des services backend, pas dans les routes.
- Documenter toute nouvelle collection ou structure de donnees.

### Phase 2 - Prototype Electron connecte

- Ajouter Electron uniquement quand le besoin devient concret.
- Emballer le build React dans une fenetre Electron.
- Lancer l'API Express locale depuis le process principal Electron.
- Pointer le frontend vers l'API locale Electron.
- Garder MongoDB externe au depart pour limiter le risque.

Cette phase sert a valider l'emballage desktop, le demarrage, les chemins de fichiers, les droits Windows et la distribution portable.

### Phase 3 - Autonomie des donnees

Deux options restent ouvertes :

- embarquer un MongoDB local portable ;
- migrer vers une base embarquee, probablement SQLite.

SQLite est l'option la plus propre pour une vraie application desktop portable, mais elle demandera une couche de persistance differente de Mongoose.

MongoDB portable reduit la migration metier, mais complique la distribution, le demarrage, les chemins de donnees et la maintenance.

## Regles de preparation a respecter

- Ne pas appeler directement MongoDB depuis le frontend.
- Ne pas multiplier les chemins d'acces API hors de `src/config/appConfig.js` et des services existants.
- Ne pas disperser la logique metier dans les composants React.
- Garder les exports/imports de donnees robustes, car ils seront utiles pour migrer vers un stockage autonome.
- Eviter les chemins absolus dans le backend.
- Utiliser `path.resolve()` avec une racine configurable pour les fichiers locaux.
- Garder les secrets et les variables sensibles hors du bundle frontend.

## Questions a trancher plus tard

- Les donnees doivent-elles rester dans le meme dossier que l'executable portable ou dans le profil utilisateur Windows ?
- L'application doit-elle fonctionner entierement hors ligne, y compris l'envoi d'emails ?
- Faut-il conserver une compatibilite avec MongoDB Atlas pour un mode hybride ?
- Faut-il prevoir un export complet lisible par un humain, par exemple JSON ou CSV ?
- Le mode portable doit-il etre mono-utilisateur ou partager une base entre plusieurs postes ?

## Prochaine action utile

Pour l'instant, ne pas lancer la migration Electron.

La prochaine action raisonnable est de continuer a stabiliser le backend et les flux de planification tout en gardant ce document comme reference unique pour la future evolution desktop autonome.
