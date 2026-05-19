# Version 27.00.00 - Placement collaboratif des TPI

Date: 2026-05-19

## Decision d'architecture v27

La version `27.00.00` doit rester orientee publication et collaboration web controlee. Elle ne doit pas lancer en parallele une migration Electron complete.

Direction retenue:

- garder le backoffice prive pour les actions administratives, la configuration, les corrections forcees et la publication;
- publier seulement les surfaces utiles aux parties prenantes externes;
- rendre `Placement collaboratif` accessible depuis Internet par session ciblee ou lien personnel;
- calculer les droits cote serveur a partir de la personne, de ses roles, de l'annee et des TPI concernes;
- ne pas exposer les autres modules depuis le net;
- reporter Electron a une decision ulterieure, comme outil local d'administration, generation et publication si ce besoin reste pertinent.

Pour ce document, cela signifie que le module devient un portail web controle pour proposer ou valider des placements, pas une ouverture publique du planning complet ni du backoffice.

## Idee generale

Ajouter un nouveau module dans `Acces principaux` pour permettre aux parties prenantes de participer directement au placement des TPI.

Le module ne doit pas etre un simple formulaire de vote supplementaire. L'objectif est de faire evoluer la planification vers un espace collaboratif synchronise: chaque personne autorisee peut proposer ou effectuer un placement selon son role, et les autres parties prenantes concernees sont automatiquement informees quand l'action ne vient pas d'elles.

Nom de travail:

- `Placement collaboratif`
- alternative courte pour l'accueil: `Placer les TPI`

## Intention produit

Aujourd'hui, la coordination concentre les decisions dans le backoffice: propositions, votes, arbitrages, publication, notifications et corrections passent principalement par l'admin.

La version `27.00.00` doit explorer une logique plus directe:

- les parties prenantes voient les TPI qui les concernent;
- elles peuvent proposer un creneau, deplacer un TPI ou valider un placement selon les droits donnes;
- une action cree un evenement de coordination partage;
- les personnes concernees, sauf l'initiateur de l'action, recoivent une notification;
- tous les modules lisent le meme etat synchronise.

L'idee centrale est donc: un planning vivant, collaboratif, mais toujours tracable et controlable.

## Position dans l'application

Le module serait ajoute dans `Acces principaux`, a cote de:

- `Planification`;
- `Coordination`;
- `Defenses`.

Proposition:

```text
Acces principaux
  - Planification
  - Coordination
  - Placement collaboratif
  - Defenses
```

Le module doit etre accessible par lien applicatif et par lien personnel, comme les votes et les soutenances.

Frontiere d'acces:

- vue admin: accessible uniquement dans le backoffice authentifie;
- vue personne: accessible depuis le web avec un contexte limite aux TPI concernes;
- aucune personne externe ne voit le planning complet sauf decision explicite;
- aucune route publique ne donne acces a `Gestion TPI`, `Parties prenantes`, `Configuration`, `Evaluation` ou `Liens d'acces`;
- les actions externes creent d'abord des propositions tracees, sauf regle metier explicitement ouverte plus tard.

## Roles et droits

Les droits doivent rester bases sur le referentiel `Person` et les relations TPI.

Principe minimal:

- `admin`: voit tout, peut tout corriger, publier et annuler;
- `chef_projet`: peut agir sur les TPI dont il est chef de projet;
- `expert`: peut agir sur les TPI ou il est expert 1 ou expert 2;
- `candidat`: peut consulter son TPI et proposer des preferences, mais pas imposer un placement final sans regle metier explicite.

Point a trancher:

- autoriser toutes les parties prenantes a placer directement;
- ou transformer leurs actions en propositions a confirmer par les autres personnes concernees ou par l'admin.

Recommandation initiale: commencer par un modele de propositions appliquees sous controle, puis ouvrir davantage quand les conflits sont bien maitrises.

## Parcours cible

1. L'admin ouvre une phase `placement collaboratif` pour l'annee.
2. Les parties prenantes recoivent ou utilisent un lien personnel.
3. La personne voit les TPI qui la concernent, les creneaux possibles, les indisponibilites et les conflits.
4. Elle propose un placement, un deplacement ou un swap.
5. Le systeme verifie les contraintes du planning.
6. Si l'action est acceptable, elle est enregistree comme evenement de coordination.
7. Les parties prenantes concernees, sauf l'initiateur, sont notifiees.
8. Les modules Planification, Coordination, Votes, Defenses et Publication se synchronisent sur le nouvel etat.

## Notification

Une notification doit etre envoyee a toutes les personnes concernees par l'action, sauf la personne qui l'a initiee.

Exemples:

- un chef de projet place un TPI: le candidat et les deux experts sont notifies;
- un expert deplace un TPI: le candidat, l'autre expert et le chef de projet sont notifies;
- un admin applique un swap: toutes les personnes concernees par les deux TPI sont notifiees;
- une action est refusee ou mise en attente: l'initiateur recoit le resultat, mais les autres ne sont notifies que si l'action modifie l'etat partage.

Les notifications peuvent etre:

- email;
- notification applicative;
- journal d'activite dans Coordination;
- notification publique dans le lien personnel si la personne revient plus tard.

## Synchronisation attendue

Tous les modules doivent lire un etat coherent.

Modules impactes:

- `Gestion TPI`: source des TPI, des relations et des statuts metier;
- `Parties prenantes`: source des personnes, emails, roles et preferences;
- `Planification`: source des creneaux, salles, dates, conflits et placements;
- `Coordination`: suivi des phases, actions, validations, arbitrages et historique;
- `Votes`: reutilisable pour les accords, refus et demandes speciales;
- `Acces-liens`: creation des liens personnels du module;
- `Defenses`: consultation de la publication active;
- `Publication statique`: regeneration si le planning publie change;
- `Emails`: notifications et rappels.

Regle importante: aucune action collaborative ne doit modifier silencieusement une publication definitive. Si une publication existe deja, le systeme doit marquer l'ecart et demander une republication ou une notification de changement.

Cette regle devient un point de controle de la v27: le module peut accelerer la collaboration, mais il ne doit pas affaiblir la chaine de publication. Le planning publie reste une sortie controlee, pas un document vivant modifie sans validation.

## Modele d'evenements

Le module devrait s'appuyer sur un journal d'evenements plutot que sur des modifications silencieuses.

Evenements possibles:

- `placement.proposed`;
- `placement.applied`;
- `placement.rejected`;
- `placement.cancelled`;
- `placement.swap_proposed`;
- `placement.swap_applied`;
- `placement.conflict_detected`;
- `placement.notification_sent`;
- `placement.publication_outdated`.

Chaque evenement doit stocker:

- l'annee;
- le TPI concerne;
- le creneau source;
- le creneau cible;
- l'initiateur;
- les personnes impactees;
- le resultat de validation;
- la date;
- la source de l'action: app, lien personnel, admin, import ou automatisation.

## Gestion des conflits

Le module doit empecher les conflits durs et expliciter les compromis.

Conflits bloquants:

- salle deja occupee;
- personne deja occupee sur le meme creneau;
- personne indisponible;
- TPI hors date autorisee pour sa classe;
- publication definitive verrouillee sans mode correction;
- lien personnel expire ou role insuffisant.

Compromis a signaler:

- preference non respectee;
- temps d'attente important;
- trop de TPI consecutifs;
- changement apres publication;
- action impactant plusieurs personnes.

## Relation avec les votes

Le module peut remplacer une partie du flux de vote, mais ne doit pas le casser.

Approche possible:

- un placement propose par une personne cree une demande d'accord ciblee;
- les autres parties prenantes peuvent accepter, refuser ou proposer un autre creneau;
- si tout le monde accepte, le placement devient applicable;
- si une personne refuse, le cas retourne dans Coordination;
- l'admin garde la possibilite de forcer avec justification.

Le module devient ainsi une evolution du vote vers une action collaborative plus directe.

## Interface attendue

L'interface doit etre simple pour les externes et plus complete pour l'admin.

Vue partie prenante:

- liste des TPI concernes;
- statut actuel de chaque TPI;
- creneaux compatibles;
- action `Proposer ce creneau`;
- historique court des dernieres actions;
- messages de conflit comprehensibles.

Vue admin:

- tous les TPI;
- actions en attente;
- conflits crees ou resolus;
- filtre par personne, date, salle, classe, statut;
- comparaison avant/apres;
- bouton appliquer, refuser, annuler ou notifier;
- indicateur de publication a regenerer.

## Securite et audit

Le module doit etre concu comme une surface sensible.

Exigences:

- acces par session admin ou magic link personnel;
- droits calcules cote serveur;
- aucune confiance dans le TPI ou la personne envoyes par le client;
- audit de chaque action;
- journal consultable par l'admin;
- limite de frequence pour eviter les actions repetitives;
- expiration des liens personnels;
- possibilite de fermer la phase collaborative.

## Donnees et services a prevoir

Nouveaux concepts probables:

- phase annuelle `collaborative_placement`;
- collection d'evenements de placement;
- collection ou vue des propositions de placement en attente;
- service de validation de deplacement reutilisant les regles de planification;
- service de notification ciblant toutes les personnes impactees sauf l'initiateur;
- preview d'impact avant application;
- endpoint de synchronisation pour l'UI collaborative.

Endpoints possibles:

```text
GET  /api/workflow/:year/collaborative-placement/context
POST /api/workflow/:year/collaborative-placement/propose
POST /api/workflow/:year/collaborative-placement/apply
POST /api/workflow/:year/collaborative-placement/reject
GET  /api/workflow/:year/collaborative-placement/events
POST /api/workflow/:year/collaborative-placement/notify
```

Les noms sont indicatifs. La priorite est de garder le module dans le routeur workflow canonique.

Les endpoints publics doivent renvoyer uniquement les donnees necessaires a l'acteur courant: ses TPI, les creneaux compatibles, les conflits qui le concernent et l'historique utile. Les endpoints admin peuvent exposer la file complete des propositions, les comparaisons avant/apres et les actions d'application ou de refus.

## Regles de synchronisation

Une action appliquee doit declencher:

- mise a jour de la planification;
- recalcul des conflits;
- mise a jour du statut coordination;
- invalidation ou mise a jour des votes lies;
- marquage des publications comme potentiellement obsoletes;
- notification des personnes impactees;
- trace dans l'audit workflow;
- rafraichissement des apercus dans les modules ouverts.

Le systeme doit eviter deux sources de verite. Le placement collaboratif ne doit pas avoir son propre planning separe: il doit proposer ou appliquer des changements sur le planning de coordination.

## Risques

- Trop de liberte peut creer un planning instable.
- Les notifications peuvent devenir bruyantes si chaque micro-action envoie un email.
- Les droits par role peuvent etre mal compris si un expert agit sur un TPI impliquant plusieurs personnes.
- Les publications deja envoyees peuvent devenir obsoletes rapidement.
- Les magic links deviennent encore plus sensibles car ils permettent une action, pas seulement une consultation.

Mitigations:

- commencer par des propositions avant application directe;
- grouper les notifications;
- afficher clairement qui a fait quoi;
- verrouiller la phase apres publication definitive;
- garder un bouton admin pour annuler ou restaurer;
- tester d'abord sur une annee pilote.

## MVP recommande

Version minimale pour valider l'idee:

1. Ajouter le module `Placement collaboratif` dans `Acces principaux`.
2. Ajouter un portail web personnel accessible par session ciblee ou magic link.
3. Donner aux parties prenantes une vue personnelle des TPI qui les concernent.
4. Permettre de proposer un creneau compatible, sans application directe.
5. Notifier les autres parties prenantes concernees, sauf l'initiateur.
6. Afficher les propositions dans Coordination.
7. Permettre a l'admin d'appliquer ou refuser.
8. Synchroniser Planification et Coordination apres application.
9. Marquer la publication comme a regenerer si une defense publiee change.
10. Bloquer toute exposition publique du planning complet et des modules d'administration.

## Questions a trancher

- Les candidats peuvent-ils placer directement leur TPI ou seulement proposer?
- Un expert peut-il deplacer un TPI sans accord du chef de projet?
- Une action acceptee par tous doit-elle s'appliquer automatiquement?
- Les notifications doivent-elles partir instantanement ou par resume groupe?
- Que se passe-t-il si une personne ne repond pas?
- La phase collaborative reste-t-elle ouverte apres publication definitive?
- Le module doit-il fonctionner aussi sur le mini-site statique ou uniquement dans l'application?

## Decision provisoire

L'idee est solide, mais elle doit etre traitee comme un nouveau module de coordination, pas comme une simple extension visuelle du planning.

Pour `27.00.00`, la direction recommandee est:

- introduire un module `Placement collaboratif`;
- commencer par des propositions tracees;
- notifier toutes les personnes impactees sauf l'initiateur;
- garder l'admin comme arbitre final;
- synchroniser tous les modules autour du planning de coordination existant;
- ne jamais modifier une publication definitive sans marquer clairement l'impact.

Decision produit associee:

- la v27 publie un portail web controle pour le placement collaboratif;
- le backoffice reste prive;
- Electron n'est pas un objectif de cette version;
- le module doit completer `Suivi TPI`, `Gestion TPI`, `Coordination`, `Planification` et `Publication`, sans creer une deuxieme source de verite.
