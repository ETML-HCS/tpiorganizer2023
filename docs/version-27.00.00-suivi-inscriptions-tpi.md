# Version 27.00.00 - Suivi, inscriptions et attribution des TPI

Date: 2026-05-19

## Decision d'architecture v27

La version `27.00.00` ne doit pas devenir une migration Electron. Les deux gros chantiers de cette version demandent d'abord une surface web collaborative accessible depuis Internet, mais limitee aux personnes concernees.

Direction retenue:

- garder le backoffice prive pour l'administration complete;
- publier uniquement des portails web controles pour les usages externes;
- utiliser des sessions admin ou des liens personnels avec droits calcules cote serveur;
- ne jamais rendre accessibles les modules d'administration qui ne sont pas necessaires aux parties prenantes;
- repousser Electron a une decision ulterieure, comme outil local de preparation, generation et publication si ce besoin reste pertinent.

Pour ce document, cela signifie que `Suivi TPI` devient un portail web controle pour les inscriptions et attributions, tout en conservant une vue admin privee. Le but reste de preparer des donnees fiables pour publier, planifier et notifier, pas d'ouvrir toute l'application sur le net.

## Idee generale

Refondre la partie `Suivi` pour en faire un module d'inscription, de creation et d'attribution progressive des TPI.

Les parties prenantes doivent pouvoir s'inscrire selon leur role, puis agir dans les limites de ce role:

- creer un TPI;
- choisir un TPI comme expert 1;
- choisir un TPI comme expert 2;
- choisir un TPI comme chef de projet;
- choisir un chef de projet quand la personne est candidate ou etudiante;
- completer le domaine informatique et les mots cles du TPI.

Les admins gardent la main complete: ils peuvent creer des TPI, attribuer directement les experts et le chef de projet, forcer une attribution et bloquer une etape si necessaire.

## Objectif produit

Le module `Suivi` ne doit plus etre seulement un suivi de profils. Il doit devenir le point d'entree de constitution des TPI avant la planification.

Objectifs:

- laisser les personnes s'inscrire elles-memes;
- permettre a chaque role de participer a la construction du TPI;
- reduire les attributions manuelles repetitives;
- garder une possibilite d'arbitrage admin;
- conserver un systeme souple, temporel, mais sans machine d'etat rigide;
- synchroniser les donnees avec `Parties prenantes`, `Gestion TPI`, `Coordination` et `Planification`.

## Position dans l'application

Le module peut remplacer ou refondre l'actuel `Suivi des profils`.

Nom de travail:

- `Suivi TPI`;
- alternative: `Inscriptions TPI`;
- alternative courte: `Suivi`.

Position possible:

```text
Administration
  - Gestion TPI
  - Parties prenantes
  - Suivi TPI
  - Evaluation
  - Configuration
  - Liens d'acces
```

Selon l'importance donnee aux inscriptions externes, une entree secondaire peut aussi apparaitre dans `Acces principaux` pendant les periodes d'inscription.

Frontiere d'acces:

- vue admin: accessible uniquement dans le backoffice authentifie;
- vue personne: accessible depuis le web par lien personnel ou session ciblee;
- aucune route publique ne donne acces a `Gestion TPI`, `Parties prenantes`, `Configuration`, `Evaluation` ou `Liens d'acces`;
- les droits ne dependent jamais d'un choix envoye par le client, mais de la personne, de ses roles et de l'annee.

## Roles concernes

Le module doit s'appuyer sur le referentiel `Person`.

Roles de base:

- `admin`;
- `candidat`;
- `etudiant`;
- `expert`;
- `chef_projet`.

Une meme personne peut cumuler plusieurs roles. Exemple: une personne peut etre `expert` et `chef_projet`; un utilisateur peut etre `etudiant` puis devenir `candidat` pour une annee TPI.

Regle importante: les droits sont calcules cote serveur a partir des roles et de l'annee active. Le client ne decide jamais seul du role utilise.

## Capacites par role

### Admin

L'admin peut:

- creer un TPI pour un candidat;
- modifier toutes les donnees du TPI;
- attribuer ou forcer `expert1`;
- attribuer ou forcer `expert2`;
- attribuer ou forcer le `chef_projet`;
- bloquer ou rouvrir une etape;
- corriger les choix d'une personne;
- verrouiller un TPI complet;
- exporter l'etat de suivi.

Une attribution admin doit etre tracee comme une action forcee, avec l'acteur, la date et idealement une note.

### Candidat ou etudiant

Un candidat ou etudiant peut:

- creer ou completer sa demande de TPI;
- choisir son chef de projet parmi les personnes disponibles;
- choisir le domaine informatique;
- renseigner jusqu'a 3 mots cles;
- consulter les experts ou chefs de projet deja attribues;
- voir si une etape est ouverte, fermee ou bloquee.

Le candidat ne choisit pas directement `expert1` ou `expert2`, sauf decision metier contraire.

### Chef de projet

Un chef de projet peut:

- consulter les TPI ouverts a candidature CDP;
- choisir un TPI comme chef de projet;
- accepter ou refuser une demande d'un candidat;
- se retirer si la periode le permet;
- voir les mots cles et le domaine du TPI avant de choisir.

Point a trancher: le choix du candidat doit-il etre automatiquement accepte, ou doit-il etre confirme par le chef de projet.

### Expert

Un expert peut:

- consulter les TPI ouverts a expertise;
- choisir un TPI comme `expert1`;
- choisir un TPI comme `expert2`;
- se retirer si la periode le permet;
- filtrer par domaine, mots cles, classe ou disponibilite.

Regles a definir:

- un meme expert peut-il etre `expert1` et `expert2` sur le meme TPI? Recommandation: non.
- un expert peut-il choisir plusieurs TPI? Oui, avec limites configurables.
- un TPI peut-il etre visible avant choix du chef de projet? A trancher.

## Domaine et mots cles

Chaque TPI doit pouvoir declarer:

- un domaine informatique principal;
- jusqu'a 3 mots cles.

Domaines initiaux:

- `infra`;
- `dev`.

Extensions possibles plus tard:

- `securite`;
- `data`;
- `iot`;
- `mixte`.

Les mots cles doivent etre courts et normalises. Exemples:

- `laravel`;
- `react`;
- `vue`;
- `docker`;
- `linux`;
- `api`.

Regles recommandees:

- maximum 3 mots cles;
- minuscules a l'enregistrement;
- accents retires ou normalises;
- doublons interdits;
- longueur maximale par mot cle;
- pas de texte libre long dans les mots cles.

## Systeme temporel sans machine d'etat rigide

Le systeme doit etre temporel, mais pas construit comme une machine d'etat stricte.

Principe:

- chaque action est autorisee ou interdite selon des fenetres de temps, des verrous et des permissions;
- l'etat global est derive des donnees presentes, pas impose par une succession rigide de statuts;
- l'admin peut bloquer une etape sans casser le reste du suivi;
- une etape peut etre rouverte temporairement;
- les exceptions doivent rester possibles.

Exemples de fenetres temporelles:

- inscription des personnes;
- creation des TPI par candidats;
- choix du chef de projet;
- choix des experts;
- validation admin;
- gel avant planification.

Exemples de verrous:

- `candidateSubmissionBlocked`;
- `projectLeadChoiceBlocked`;
- `expertChoiceBlocked`;
- `adminAssignmentOnly`;
- `tpiLocked`;
- `yearLocked`.

Ces verrous ne sont pas des etats obligatoires. Ce sont des garde-fous configurables par annee.

## Etats derives utiles

Meme sans machine d'etat, l'interface doit afficher des statuts comprensibles.

Ces statuts peuvent etre derives:

- `profil incomplet`;
- `TPI a creer`;
- `TPI cree`;
- `chef de projet manquant`;
- `chef de projet choisi`;
- `expert 1 manquant`;
- `expert 2 manquant`;
- `equipe complete`;
- `bloque par admin`;
- `pret pour Gestion TPI`;
- `pret pour Coordination`.

Ces statuts sont des vues de lecture, pas une source de verite principale.

## Synchronisation avec les modules existants

Le module `Suivi TPI` doit synchroniser les modules suivants:

- `Parties prenantes`: creation et mise a jour des personnes, roles, emails et annees candidat;
- `Gestion TPI`: creation ou mise a jour des TPI;
- `Coordination`: disponibilite du TPI pour votes, arbitrages et planning;
- `Planification`: uniquement quand le TPI est suffisamment complet;
- `Acces-liens`: liens personnels d'inscription, choix ou correction;
- `Emails`: notifications d'inscription, choix, attribution forcee et blocage.

Regle centrale: `Suivi TPI` prepare les donnees, mais ne doit pas creer une deuxieme source de verite separee de `Gestion TPI` et `Person`.

Le module doit aussi produire des donnees directement exploitables par la publication et la coordination: une inscription incomplete ne doit pas polluer le planning publie, et une attribution complete doit pouvoir etre reprise sans ressaisie dans les modules aval.

## Creation et attribution d'un TPI

### Creation par candidat

Le candidat peut creer un TPI avec:

- annee;
- candidat;
- titre ou sujet provisoire;
- domaine informatique;
- jusqu'a 3 mots cles;
- chef de projet souhaite.

Le TPI reste incomplet tant que les experts ne sont pas attribues.

### Creation par admin

L'admin peut creer directement le TPI complet ou partiel:

- candidat;
- sujet;
- domaine;
- mots cles;
- chef de projet;
- expert 1;
- expert 2.

Une attribution forcee doit remplacer ou verrouiller le choix selon une option explicite.

### Choix par expert ou chef de projet

Les experts et chefs de projet peuvent choisir parmi les TPI compatibles avec leur role.

Le systeme doit verifier:

- role actif;
- annee active;
- limite de charge;
- TPI non verrouille;
- place encore disponible;
- absence de conflit metier evident;
- fenetre temporelle ouverte;
- etape non bloquee.

## Notifications

Chaque action importante doit pouvoir notifier les personnes concernees.

Exemples:

- un candidat choisit un chef de projet: le chef de projet est notifie;
- un chef de projet accepte: le candidat est notifie;
- un expert choisit un TPI: le candidat, le chef de projet et l'autre expert deja attribue sont notifies;
- un admin force un expert: l'expert, le candidat et le chef de projet sont notifies;
- une etape est bloquee: les personnes qui doivent encore agir peuvent etre notifiees.

Comme dans le module de placement collaboratif, la personne qui initie l'action ne doit pas recevoir la meme notification que les autres. Elle voit plutot une confirmation d'action.

## Audit et historique

Le module doit conserver un historique clair:

- inscription creee;
- role demande ou confirme;
- TPI cree;
- domaine modifie;
- mots cles modifies;
- chef de projet choisi;
- chef de projet force;
- expert 1 choisi;
- expert 2 choisi;
- attribution forcee par admin;
- retrait ou correction;
- etape bloquee ou rouverte.

Chaque entree doit stocker:

- annee;
- acteur;
- role utilise;
- TPI concerne;
- changement avant/apres;
- source: app, lien personnel, admin, import;
- date.

## Donnees a prevoir

Concepts probables:

- configuration annuelle des fenetres temporelles;
- verrous d'etapes par annee;
- limites de charge par role;
- intentions ou inscriptions de role;
- journal de suivi;
- champs TPI `domain`, `keywords`, `projectLeadChoiceSource`, `expertChoiceSource`;
- marqueurs d'attribution forcee.

Exemple de configuration annuelle:

```json
{
  "year": 2027,
  "profileRegistration": {
    "opensAt": "2027-01-15T00:00:00.000Z",
    "closesAt": "2027-02-15T23:59:59.000Z",
    "blocked": false
  },
  "candidateTpiCreation": {
    "opensAt": "2027-02-01T00:00:00.000Z",
    "closesAt": "2027-03-15T23:59:59.000Z",
    "blocked": false
  },
  "projectLeadChoice": {
    "opensAt": "2027-02-15T00:00:00.000Z",
    "closesAt": "2027-03-31T23:59:59.000Z",
    "blocked": false
  },
  "expertChoice": {
    "opensAt": "2027-03-01T00:00:00.000Z",
    "closesAt": "2027-04-15T23:59:59.000Z",
    "blocked": false
  }
}
```

## Endpoints possibles

Les noms sont indicatifs.

```text
GET  /api/workflow/:year/suivi/context
POST /api/workflow/:year/suivi/register
POST /api/workflow/:year/suivi/tpis
PUT  /api/workflow/:year/suivi/tpis/:tpiId
POST /api/workflow/:year/suivi/tpis/:tpiId/choose-project-lead
POST /api/workflow/:year/suivi/tpis/:tpiId/choose-expert
POST /api/workflow/:year/suivi/tpis/:tpiId/admin-assign
POST /api/workflow/:year/suivi/steps/:step/block
POST /api/workflow/:year/suivi/steps/:step/unblock
GET  /api/workflow/:year/suivi/events
```

Les endpoints exposes aux liens personnels doivent renvoyer un contexte limite a la personne authentifiee et aux TPI qu'elle peut consulter ou modifier. Les endpoints admin restent separes par role `admin`, meme s'ils partagent les memes services metier.

## Regles de qualite

- Une personne ne peut choisir que selon ses roles actifs.
- Un candidat ne peut creer ou modifier que son propre TPI, sauf admin.
- Un candidat peut choisir un chef de projet, mais le choix peut demander confirmation.
- Un expert ne peut pas occuper deux roles expert sur le meme TPI.
- Un admin peut forcer une attribution, mais l'action doit etre visible.
- Les mots cles sont limites a 3.
- Le domaine est obligatoire avant passage vers Gestion TPI.
- Les etapes peuvent etre bloquees sans changer le statut historique du TPI.
- Les statuts affiches sont derives, pas pilotes par une machine d'etat rigide.

## MVP recommande

Version minimale pour `27.00.00`:

1. Ajouter une page admin `Suivi TPI`.
2. Ajouter un portail web personnel `Suivi TPI` accessible par session ciblee ou magic link.
3. Permettre l'inscription ou la confirmation de role par personne.
4. Permettre au candidat de creer son TPI avec domaine et 3 mots cles maximum.
5. Permettre au candidat de choisir ou demander un chef de projet.
6. Permettre aux experts de choisir un TPI comme `expert1` ou `expert2`.
7. Permettre aux chefs de projet de choisir, accepter ou confirmer un TPI.
8. Permettre a l'admin de creer, corriger et forcer toutes les attributions.
9. Ajouter les fenetres temporelles et verrous d'etapes.
10. Synchroniser les TPI complets vers `Gestion TPI`.
11. Journaliser toutes les actions importantes.
12. Bloquer toute exposition publique des modules qui ne servent pas directement ce portail.

## Questions a trancher

- Le role `etudiant` doit-il devenir un role officiel du referentiel `Person` ou rester un statut d'inscription?
- Le choix du chef de projet par le candidat est-il une demande ou une attribution directe?
- Les experts choisissent-ils librement `expert1` ou `expert2`, ou le systeme attribue-t-il le numero automatiquement?
- Combien de TPI un expert ou chef de projet peut-il prendre?
- Un TPI sans chef de projet peut-il deja etre visible aux experts?
- L'admin peut-il forcer sans notification?
- Faut-il une validation finale avant synchronisation vers `Gestion TPI`?

## Decision provisoire

Pour `27.00.00`, la direction recommandee est de remplacer le suivi legacy par un module `Suivi TPI` souple:

- roles et inscriptions bases sur `Person`;
- creation de TPI par candidat ou admin;
- choix du chef de projet par candidat;
- choix des TPI par experts et chefs de projet selon leur role;
- attribution forcee possible par admin;
- temporalite par fenetres et verrous, sans machine d'etat stricte;
- domaine `infra` ou `dev` et maximum 3 mots cles;
- synchronisation vers les modules metier seulement quand les donnees sont suffisantes.

Decision produit associee:

- la v27 publie un portail web controle pour `Suivi TPI`;
- le backoffice reste prive;
- Electron n'est pas un objectif de cette version;
- toute fonctionnalite ajoutee doit aider a preparer, planifier, publier ou notifier les TPI.
