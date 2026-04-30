# Algorithme de planification automatique

Ce document decrit le fonctionnement actuel du bouton de planification automatique.
Le code principal est dans `API/services/planningAutomationService.js`.

## Objectif

La planification automatique prend les TPI planifiables d'une annee et produit:

- des `Slot` workflow pour l'annee;
- un creneau propose par TPI place;
- des TPI en `manual_required` quand aucun placement valide n'est possible;
- des rooms legacy `tpiRooms_YEAR` pour que l'ecran historique de planification puisse afficher le resultat.

L'objectif n'est pas seulement de remplir le premier creneau libre. L'algo doit respecter les contraintes du workflow:

- dates autorisees par classe;
- dates de defense portees par un TPI, uniquement si elles restent compatibles avec sa classe;
- disponibilites des participants;
- absence de double presence d'une meme personne au meme moment;
- limite de TPI consecutifs par personne;
- compatibilite MATU / non-MATU des salles;
- reutilisation des salles deja ouvertes avant d'en ouvrir une nouvelle;
- regroupement des participants dans la meme salle quand ils interviennent plusieurs fois le meme jour;
- reequilibrage final pour viser au moins 3 TPI par salle ouverte quand c'est possible.

## Point d'entree

Le bouton "Planification automatique" appelle:

```txt
POST /api/workflow/:year/planification/auto-plan
```

Le endpoint est defini dans `API/routes/workflowRoutes.js`.

Le endpoint refuse l'action si l'annee n'est pas dans l'etat workflow `planning`.

Le flux cote API est:

1. Charger l'etat workflow de l'annee.
2. Synchroniser le catalogue legacy GestionTPI vers les documents workflow avec `syncLegacyCatalogToPlanning`.
3. Executer `planningAutomationService.autoPlanYear(year)`.
4. Valider le planning genere avec `planningValidationService.validatePlanningForYear(year)`.
5. Retourner le resume, les rooms legacy et le resultat de validation.

## Donnees utilisees

### Configuration annuelle

La configuration vient de `getPlanningConfig(year)`.

Elle contient notamment:

- `classTypes`: types/classes, prefixes et dates de defense autorisees;
- `soutenanceDates`: dates globales de defense si disponibles;
- `siteConfigs`: configuration par site.

Chaque configuration de site peut definir:

- `siteCode`;
- `numSlots`: nombre de creneaux par salle;
- `tpiTimeMinutes`: duree d'un TPI;
- `breaklineMinutes`: pause entre deux TPI;
- `firstTpiStartTime`: heure du premier TPI;
- `maxConsecutiveTpi`: nombre maximal de TPI consecutifs pour une meme personne;
- `manualRoomTarget`: nombre de salles a forcer par date, optionnel.

Par defaut, la limite de TPI consecutifs est `4`.

Important: cette regle signifie "4 TPI a la suite maximum", pas "4 TPI maximum dans la journee".
Un expert peut donc avoir plus de 4 TPI sur une journee si une pause ou un creneau libre coupe la serie.

### Catalogue partage

Le catalogue vient de `getSharedPlanningCatalog()`.

Il fournit les sites et leurs salles:

- code du site;
- libelle;
- salles actives;
- capacite;
- ordre d'affichage;
- noms de salles.

Seules les salles actives sont prises en compte.

### TPI workflow

Les TPI sont charges depuis `TpiPlanning`.

Le chargement:

- filtre par annee;
- exclut les sites hors planification comme `hors ETML`;
- peuple `candidat`, `expert1`, `expert2`, `chefProjet`;
- exclut les TPI `cancelled` et `completed`.

Les TPI sont ensuite filtres par `filterPlanifiableTpis`, qui respecte les sites actifs de la configuration annuelle.

## Synchronisation depuis GestionTPI

Avant la planification, le endpoint appelle `syncLegacyCatalogToPlanning`.

Cette etape cree les TPI workflow manquants a partir de `tpiList_YEAR`.

Elle copie aussi la date de defense legacy:

```txt
legacyTpi.dates.soutenance -> TpiPlanning.dates.soutenance
```

Le schema `TpiPlanning` possede donc maintenant:

```js
dates: {
  soutenance: Date,
  debut: Date,
  fin: Date,
  premiereVisite: Date,
  deuxiemeVisite: Date,
  renduFinal: Date
}
```

Les imports CSV reconnaissent aussi plusieurs colonnes de date de defense:

- `dateDefense`;
- `dateDefence`;
- `dateSoutenance`;
- `soutenance`.

## Construction des contextes de site

La fonction `buildSiteContextIndex` transforme le catalogue et la configuration annuelle en contextes de site.

Un `siteContext` contient:

- `siteKey`: cle normalisee;
- `siteId`;
- `siteCode`;
- `siteLabel`;
- `roomNames`: salles actives triees;
- `roomCapacityByName`;
- `numSlots`;
- `maxConsecutiveTpi`;
- `tpiTimeMinutes`;
- `breaklineMinutes`;
- `firstTpiStartTime`;
- `manualRoomTarget`.

Le tri des salles actives utilise:

1. l'ordre configure si disponible;
2. le libelle ou code de salle.

Ce contexte est utilise partout dans l'algo pour savoir quelles salles existent, combien de creneaux sont disponibles, et quelles regles s'appliquent.

## Transformation d'un TPI en tache

Chaque TPI devient une tache de planification via `buildSchedulingTask`.

Une tache contient:

- `tpi`: le document TPI;
- `tpiId`;
- `reference`;
- `siteValue`;
- `siteContext`;
- `allowedDateKeys`;
- `participants`;
- `preferredDateWeight`;
- `repeatedParticipantWeight`;
- `issues`.

### Participants

Les participants pris en compte sont:

- candidat;
- expert1;
- expert2;
- chefProjet.

Chaque participant est converti en:

- role;
- id personne;
- nom;
- preferences de soutenance;
- dates preferees.

Les personnes sans identifiant ne sont pas conservees dans la liste des participants.

## Dates autorisees

Les dates autorisees viennent d'abord de `buildVoteProposalContext`.

Cette fonction lit la classe du TPI et la configuration annuelle pour determiner les dates de defense autorisees.

La logique de classe est:

1. Chercher une correspondance exacte avec les `classTypes`.
2. Si une correspondance existe, utiliser les dates de ce type.
3. Sinon, separer MATU et non-MATU.
4. Pour une classe MATU, garder les dates MATU.
5. Pour une classe non-MATU, garder les dates non-MATU.
6. En dernier recours, utiliser les dates configurees disponibles.

### Date de defense portee par le TPI

La fonction `resolveTaskAllowedDateKeys` applique ensuite la date eventuellement portee par le TPI.

Elle lit:

- `tpi.dates.soutenance`;
- `tpi.dateSoutenance`;
- `tpi.soutenanceDateTime`.

Regle:

- si le TPI n'a pas de date fixe, on garde les dates de classe;
- si la classe n'a aucune date configuree, on utilise la date du TPI;
- si la date du TPI croise une date autorisee par la classe, elle devient une contrainte dure;
- si la date du TPI contredit la classe, on ignore cette date et on garde les dates de classe.

Exemple:

```txt
TPI non-MATU
Date TPI: 03.06
Dates non-MATU autorisees: 10.06

Resultat: 10.06
```

On ne satisfait donc pas une date individuelle si elle force un TPI non-MATU sur une date MATU.

Autre exemple:

```txt
TPI MATU
Date TPI: 03.06
Dates MATU autorisees: 03.06

Resultat: 03.06
```

## Timeline

La fonction `buildTimeline` construit tous les pas de temps utiles.

Un pas de temps est:

```txt
date + periode
```

Exemple:

```txt
2026-06-10#1
2026-06-10#2
2026-06-10#3
2026-06-11#1
```

La timeline ne depend pas des salles. Elle sert surtout a verifier les sequences consecutives.

Les creneaux sont tries par:

1. date;
2. periode.

## Poids et priorites des TPI

Avant la recherche, les taches sont enrichies avec deux poids.

### `preferredDateWeight`

Ce poids mesure la force des preferences de dates/creneaux des participants.

Une preference exacte date + periode vaut plus qu'une simple preference de date.

### `repeatedParticipantWeight`

Ce poids augmente quand les participants d'un TPI apparaissent aussi dans d'autres TPI.

But:

- traiter plus tot les TPI qui partagent des personnes;
- reduire le risque de bloquer tardivement sur des conflits de disponibilite.

## Tri initial des taches

Les taches sont triees avant planification:

1. moins de dates autorisees en premier;
2. plus de participants repetes en premier;
3. preference plus forte en premier;
4. reference TPI en dernier critere.

Cela place les TPI les plus contraints avant les TPI plus flexibles.

## Generation des salles candidates

Pour un TPI donne, a une date donnee, `buildCandidateRooms` construit les salles candidates.

L'ordre de preference est:

1. salles deja utilisees par un participant du TPI le meme jour;
2. salles deja ouvertes sur cette date;
3. prochaine salle configuree non encore ouverte;
4. salle synthetique si toutes les salles configurees sont deja ouvertes ou incompatibles.

Une salle synthetique est nommee avec le code du site:

```txt
ETML 02
ETML 03
```

L'algo evite d'ouvrir une nouvelle salle tant qu'une salle deja ouverte peut accueillir le TPI.

## Compatibilite des salles

La compatibilite est verifiee avec `getRoomCompatibilityReport`.

L'objectif principal est de ne pas melanger MATU et non-MATU dans des salles incompatibles.

Exemple:

- salle `M101`;
- TPI classe `DEV4`;
- la salle est interpretee comme MATU;
- le TPI est non-MATU;
- le placement est refuse.

Cette verification s'applique:

- lors de la generation des salles candidates;
- lors du reequilibrage final des rooms.

## Enumeration des placements candidats

Pour chaque tache, `enumerateCandidatePlacements` teste tous les placements possibles:

```txt
date autorisee
  periode 1..numSlots
    salle candidate
```

Chaque placement candidat est rejete si une contrainte dure echoue.

### Contrainte: conflit de personne

Un participant ne peut pas etre sur deux TPI au meme moment.

Le controle utilise:

```txt
personOccupancyByTimeKey
```

Si une personne est deja occupee sur `2026-06-10#2`, aucun autre TPI avec cette personne ne peut etre place sur ce pas de temps.

### Contrainte: disponibilite

Si la personne expose `isAvailableOn(date, period)`, l'algo l'appelle.

Le placement est refuse si au moins un participant est indisponible.

Si aucune disponibilite n'est declaree, une personne est consideree comme non contrainte par defaut.

### Contrainte: TPI consecutifs

Avant de placer un TPI, l'algo simule son insertion dans la timeline.

Pour chaque participant:

1. trouver l'index du creneau candidat dans la timeline;
2. regarder les creneaux occupes juste avant;
3. regarder les creneaux occupes juste apres;
4. calculer la longueur de la serie consecutive;
5. refuser si la serie depasse `maxConsecutiveTpi`.

Par defaut:

```txt
maxConsecutiveTpi = 4
```

Exemples:

```txt
P1, P2, P3, P4 -> OK
P1, P2, P3, P4, P5 -> refuse
P1, P2, P3, P4, pause, P6 -> OK
```

Cette regle vaut pour toute personne impliquee, pas seulement les experts.

### Contrainte: salle occupee

Une salle ne peut contenir qu'un TPI par date + periode.

La cle utilisee est:

```txt
site|room|date|period
```

Si cette cle existe deja dans `roomAssignments`, le placement est refuse.

## Score local des placements

Les placements valides sont tries.

L'ordre privilegie:

1. salle deja ouverte avant nouvelle salle;
2. salle preferee par les participants deja presents le meme jour;
3. preference exacte date + creneau;
4. nombre de participants qui preferent cette date;
5. date plus prioritaire dans la liste autorisee;
6. proximite avec les autres TPI des participants;
7. periode plus tot dans la journee;
8. ordre de salle;
9. nom de salle.

La priorite "salle deja ouverte" est volontairement haute.
Elle evite d'ouvrir une nouvelle salle simplement pour satisfaire une preference non bloquante.

## Recherche avec retour arriere

La fonction `searchCompleteAssignments` cherche une solution complete.

Elle utilise une recherche recursive avec retour arriere.

Principe:

1. Calculer les candidats possibles pour chaque tache restante.
2. Choisir la tache la plus contrainte.
3. Essayer son meilleur placement.
4. Continuer avec les taches restantes.
5. Si plus tard une tache n'a aucun candidat, revenir en arriere et essayer le placement suivant.

La selection de la tache la plus contrainte se base sur:

1. nombre de candidats disponibles;
2. nombre de dates autorisees;
3. poids de participants repetes;
4. poids de preference;
5. reference.

La recherche a une limite de noeuds:

```txt
50000
```

Cette limite evite qu'une grosse annee bloque le serveur trop longtemps.

## Fallback glouton

Si la recherche complete echoue ou depasse la limite, l'algo utilise `computeGreedyAssignments`.

Le fallback glouton:

1. prend la tache avec le moins de candidats a l'instant courant;
2. place le meilleur candidat;
3. met a jour l'etat;
4. recommence.

Si une tache n'a aucun candidat:

```txt
manual_required
```

avec la raison:

```txt
Aucun creneau valide sans conflit n a pu etre trouve.
```

## Etat interne pendant la planification

L'etat de planification contient:

```js
{
  generatedRoomsBySiteDate,
  roomAssignments,
  personOccupancyByTimeKey,
  personOccupiedKeysById,
  personDailyRoomByDate,
  personDailyPeriodsByDate
}
```

### `generatedRoomsBySiteDate`

Liste des salles ouvertes pour un site et une date.

Cle:

```txt
site|date
```

Valeur:

```txt
["A101", "A102"]
```

### `roomAssignments`

Map des slots deja occupes par une salle.

Cle:

```txt
site|room|date|period
```

### `personOccupancyByTimeKey`

Map des personnes occupees sur un pas de temps.

Cle:

```txt
date#period
```

### `personOccupiedKeysById`

Map des pas de temps occupes par personne.

Cette structure sert a verifier les TPI consecutifs.

### `personDailyRoomByDate`

Map des salles deja frequentees par personne et par date.

Elle sert a garder une personne dans la meme salle quand possible.

### `personDailyPeriodsByDate`

Map des periodes deja occupees par personne et par date.

Elle sert au calcul de proximite.

## Application d'un placement

Quand un placement est choisi, `applyPlacement`:

1. ajoute la salle dans `generatedRoomsBySiteDate` si elle n'existe pas encore;
2. marque le slot salle/date/periode comme occupe;
3. marque chaque participant comme occupe sur le pas de temps;
4. ajoute la salle quotidienne de chaque participant;
5. ajoute la periode quotidienne de chaque participant.

## Reequilibrage des salles ouvertes

Apres la recherche, l'algo appelle `rebalanceOpenRooms`.

Objectif:

```txt
viser au moins 3 TPI par salle ouverte quand c'est possible
```

Constante:

```js
MIN_TPI_PER_OPEN_ROOM = 3
```

Important: cette etape ne cherche pas a changer les horaires.
Elle deplace seulement un TPI d'une salle a une autre sur la meme date et la meme periode.

Donc elle ne cree pas de conflit de personne, car le pas de temps du TPI reste identique.

### Exemple

Avant reequilibrage:

```txt
A101: P1, P2, P3, P4
A102: P1, P2
```

Apres reequilibrage possible:

```txt
A101: 3 TPI
A102: 3 TPI
```

### Conditions pour deplacer un TPI

Un TPI peut etre deplace vers une salle sous-remplie si:

- la salle cible n'est pas deja occupee a la meme periode;
- la salle cible est compatible avec la classe du TPI;
- la salle donneuse garde au moins 3 TPI apres le deplacement.

L'algo ne ferme pas explicitement une salle ouverte vide, car il ne deplace pas les salles vides dans ce reequilibrage.
Il agit seulement sur les salles qui contiennent deja au moins un TPI.

## Creation des documents Slot

Une fois les assignments calcules, `buildAutomaticSlotDocuments` cree tous les slots workflow.

Pour chaque site/date/salle ouverte:

- creer un slot par periode de `1` a `numSlots`;
- marquer le slot `proposed` s'il contient un TPI;
- marquer le slot `available` sinon.

Si `manualRoomTarget` est configure, l'algo ajoute les salles forcees dans les documents, meme si elles n'ont pas ete ouvertes par les assignments.

Chaque slot contient:

- `year`;
- `date`;
- `period`;
- `startTime`;
- `endTime`;
- `room.name`;
- `room.site`;
- `room.capacity`;
- `status`;
- `assignedTpi`;
- `assignments` candidat/expert1/expert2/chefProjet;
- `config.duration`;
- `config.breakAfter`;
- `config.maxConsecutiveTpi`.

## Calcul des heures

Les heures sont calculees par `buildSlotTimesForPeriod`.

Formule:

```txt
start = firstTpiStartTime + (period - 1) * (tpiTimeMinutes + breaklineMinutes)
end = start + tpiTimeMinutes
```

Exemple:

```txt
firstTpiStartTime = 08:00
tpiTimeMinutes = 60
breaklineMinutes = 10

P1: 08:00 - 09:00
P2: 09:10 - 10:10
P3: 10:20 - 11:20
```

## Mise a jour des TPI workflow

Pour chaque TPI planifie:

```js
status: "pending_slots"
proposedSlots: [{ slot, proposedAt, score: 100, reason }]
confirmedSlot: null
soutenanceDateTime: slot.date
soutenanceRoom: slot.room.name
conflicts: []
```

L'algo supprime aussi:

```txt
votingSession
manualOverride
```

Pour chaque TPI non planifie:

```js
status: "manual_required"
proposedSlots: []
confirmedSlot: null
soutenanceDateTime: null
soutenanceRoom: ""
conflicts: [{ type: "no_common_slot", description }]
```

## Suppression des anciens votes et slots

Avant d'ecrire le nouveau planning:

- les votes lies aux TPI de l'annee sont supprimes;
- tous les slots de l'annee sont supprimes.

Cela signifie que l'auto-planification reconstruit completement la proposition de planning.

## Reconstruction des rooms legacy

Apres insertion des slots, l'algo appelle `syncLegacyRoomsFromAutomaticPlanning`.

Cette etape:

1. convertit les slots workflow en rooms legacy;
2. groupe par date + site + salle;
3. reconstruit `tpiDatas`;
4. supprime les anciennes rooms `tpiRooms_YEAR`;
5. insere les nouvelles rooms.

Le format legacy sert a l'ecran historique de planification.

Chaque room legacy contient:

- `idRoom`;
- `lastUpdate`;
- `site`;
- `date`;
- `name`;
- `roomClassMode`;
- `configSite`;
- `tpiDatas`.

Les creneaux vides sont representes avec une carte vide.

## Resume retourne

`autoPlanYear` retourne:

```js
{
  year,
  totalTpis,
  plannedCount,
  manualRequiredCount,
  slotCount,
  roomCount,
  legacyRoomCount,
  legacyRooms,
  manualRequired
}
```

Le frontend utilise `legacyRooms` pour remplacer directement la planification locale affichee.

## Cas importants

### TPI avec date incompatible avec sa classe

Situation:

```txt
TPI non-MATU
Date TPI: 03.06
Dates classe non-MATU: 10.06
```

Resultat:

```txt
Le TPI est planifie sur 10.06.
```

Raison:

```txt
La contrainte de classe est prioritaire sur la date TPI incompatible.
```

### TPI MATU avec date MATU

Situation:

```txt
TPI MATU
Date TPI: 03.06
Dates MATU: 03.06
```

Resultat:

```txt
Le TPI est planifie sur 03.06 si un creneau valide existe.
```

### Une salle pleine et un TPI restant

Situation:

```txt
numSlots = 4
5 TPI le meme jour
participants compatibles
```

Resultat possible:

```txt
A101: 4 TPI
A102: 1 TPI
```

Pourquoi?

Il faut ouvrir une deuxieme salle pour placer le 5e TPI le meme jour si aucun autre jour n'est autorise.
La cible de 3 TPI par salle ne peut pas etre satisfaite avec seulement 5 TPI et 4 creneaux par salle.

### Six TPI avec quatre creneaux par salle

Situation:

```txt
numSlots = 4
6 TPI le meme jour
```

Resultat vise:

```txt
A101: 3 TPI
A102: 3 TPI
```

Le reequilibrage deplace un TPI de la salle la plus chargee vers la salle sous-remplie si la periode cible est libre et la salle compatible.

## Ce que l'algo ne fait pas encore

### Pas de limite journaliere totale par expert

L'algo gere:

```txt
4 TPI consecutifs maximum
```

Il ne gere pas encore:

```txt
4 TPI maximum par expert sur toute la journee
```

Si cette regle devient necessaire, il faut ajouter une contrainte de charge journaliere par role/personne.

### Pas d'optimisation globale multi-objectifs complete

L'algo utilise une recherche avec retour arriere pour trouver une solution valide, puis un reequilibrage simple.

Il ne cherche pas encore mathematiquement le score global optimal sur tous les criteres.

Exemples de criteres non optimises globalement:

- minimiser strictement le nombre total de salles;
- minimiser tous les deplacements inter-sites;
- equilibrer parfaitement les charges par personne;
- optimiser les preferences faibles une fois toutes les contraintes dures satisfaites.

### Pas de fermeture active des salles vides forcees

Si `manualRoomTarget` force des salles supplementaires, elles sont generees meme vides.

C'est volontaire: cette option signifie que l'admin veut prevoir ce nombre de salles par date.

## Tests principaux

Les tests de l'algo sont dans:

```txt
API/tests/planningAutomationService.test.js
```

Ils couvrent notamment:

- garder une personne repetee dans la meme salle;
- creer une salle supplementaire si un seul creneau est disponible;
- respecter la date TPI seulement si elle respecte les dates de classe;
- equilibrer une salle ouverte avec au moins 3 TPI quand possible;
- etaler une 5e defense pour eviter 5 TPI consecutifs;
- respecter une limite configurable de TPI consecutifs;
- passer en manuel si aucune solution n'existe;
- interdire deux TPI simultanes pour une meme personne;
- refuser une salle MATU incompatible avec un TPI non-MATU;
- privilegier une date ideale;
- privilegier un creneau exact;
- revenir en arriere quand un choix glouton bloque une contrainte;
- eviter une nouvelle salle pour une simple preference;
- respecter les indisponibilites.

Commande de verification:

```bash
node --test API/tests/planningAutomationService.test.js
```

Suite API complete:

```bash
npm run test:api
```

