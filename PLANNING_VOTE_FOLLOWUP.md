# Planning Vote Follow-up

Points volontairement laissés hors du correctif urgent du flux de vote.

## P0 différé

- Temps réel du suivi admin
  Le dashboard admin recharge encore sur action manuelle. Aucun SSE / websocket / polling court n'est en place.

- Vue conflits / manuel
  Le composant `ConflictResolver` reste branché sur un ancien format `tpi.votingSession.votes` qui n'est plus la source réelle des décisions.

- Unification complète des anciens endpoints vote
  Le nouveau flux principal passe par `POST /api/planning/votes/respond/:tpiId`, mais les anciens endpoints `votes/:id` et `votes/bulk` restent présents pour compatibilité et devraient être dépréciés proprement.

## P1

- Unifier tous les envois de lien de vote sur le service magic link v2
  `workflow/votes/start` utilise déjà v2, mais certains renvois legacy passent encore par l'ancien flow `/api/planning/auth/verify`.

- Corriger les appels front encore hardcodés
  `ConflictResolver.jsx` et `PlanningCalendar.jsx` contiennent encore des appels `fetch` qui contournent `apiService` et l'URL API centralisée.

- Ajuster les emails de vote
  Le template parle encore d'une validité "24 heures" alors que les liens de vote v2 sont configurés sur 7 jours par défaut.

- Rendre le suivi admin plus explicite
  Ajouter une vue par partie prenante avec colonnes `a voté`, `heure`, `OK / propose`, `demande spéciale`.

## P2

- Nettoyer les tests React
  La suite `VotingPanel.test.jsx` passe, mais génère encore des warnings `act(...)`.

- Documenter le contrat métier du vote
  Formaliser noir sur blanc :
  `1 lien = 1 partie prenante + 1 TPI`
  `2 réponses = OK ou Proposition`
  `Proposition = jusqu'à 3 créneaux du planning et/ou 1 demande spéciale`
