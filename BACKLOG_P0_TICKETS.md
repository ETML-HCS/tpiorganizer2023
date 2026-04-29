# Backlog P0 - Tickets prets a copier

## 1) Regles de ticketing

1. 1 Epic ticket par domaine.
2. 3 a 6 Stories par Epic.
3. Chaque Story contient: valeur metier, criteres d'acceptation, DoD, estimation.
4. Le sprint embarque uniquement des Stories "Ready" (DoR valide).

---

## 2) Epics P0

### WF-EP01 - Orchestrateur Workflow 3 etapes

- Type: Epic
- Priorite: P0
- Objectif: imposer les etats annuels `planning -> voting_open -> published` avec audit.
- KPI associe: 0 transition invalide en production.

### WF-EP02 - Planification robuste

- Type: Epic
- Priorite: P0
- Objectif: valider les conflits hard et geler un snapshot immuable.
- KPI associe: 0 conflit hard au moment du freeze.

### WF-EP03 - Campagne de votes

- Type: Epic
- Priorite: P0
- Objectif: lancer, relancer, cloturer la validation Expert1/Expert2/Chef projet.
- KPI associe: >95% des votes avant deadline.

### WF-EP04 - Publication definitive

- Type: Epic
- Priorite: P0
- Objectif: publier une version finale et distribuer les liens de consultation.
- KPI associe: 100% des publies issus de `confirmed`.

### WF-EP05 - Securite Magic Links v2

- Type: Epic
- Priorite: P0
- Objectif: separer strictement `vote_link` et `soutenance_link`.
- KPI associe: 0 incident cross-scope.

### WF-EP08 - Qualite, tests, observabilite

- Type: Epic
- Priorite: P0
- Objectif: fiabiliser le workflow complet avec tests et monitoring.
- KPI associe: 0 publication bloquee sans alerte.

---

## 3) Stories par Epic

## WF-EP01 - Orchestrateur Workflow

### WF-101 - Lire l'etat workflow annuel

- Type: Story
- Priorite: P0
- Estimation: 3 pts
- Description: En tant qu'admin, je veux consulter l'etat global d'une annee pour piloter le process.
- Criteres d'acceptation:
1. `GET /api/workflow/:year` retourne `year`, `state`, `allowedTransitions`.
2. Si l'annee n'existe pas, creation auto en `planning`.
3. Les annees invalides retournent `400`.
- DoD:
1. Tests API automatises.
2. Documentation endpoint ajoutee.

### WF-102 - Enforcer les transitions autorisees

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant qu'admin, je veux changer d'etape sans risque de transition incoherente.
- Criteres d'acceptation:
1. `POST /api/workflow/:year/transition` accepte uniquement `planning -> voting_open -> published`.
2. Transition invalide retourne `409` avec etat courant et transitions autorisees.
3. Transition valide met a jour l'etat et les timestamps de phase.
- DoD:
1. Tests unitaires de la matrice de transitions.
2. Tests integration route `transition`.

### WF-103 - Journaliser les actions critiques

- Type: Story
- Priorite: P0
- Estimation: 3 pts
- Description: En tant qu'auditeur, je veux tracer les transitions de workflow.
- Criteres d'acceptation:
1. Chaque transition cree un event d'audit (acteur, action, payload minimal, timestamp).
2. Les erreurs de transition sont aussi journalisees.
3. Les logs sont consultables par annee.
- DoD:
1. Schema d'audit versionne.
2. Test sur creation d'event de succes et d'echec.

### WF-104 - Verrouiller les actions par etat

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant que systeme, je veux empecher les actions hors sequence.
- Criteres d'acceptation:
1. Les endpoints critiques verifient l'etat workflow avant execution.
2. Retour `409` si etat incompatible.
3. Message d'erreur explicite pour l'operateur.
- DoD:
1. Middleware reutilisable ajoute.
2. Couverture sur au moins 2 endpoints critiques.

## WF-EP02 - Planification robuste

### WF-201 - Detecter conflits hard de personnes

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant qu'admin, je veux empecher qu'une meme personne soit sur 2 lieux en meme temps.
- Criteres d'acceptation:
1. Detection conflit par date+periode pour candidat/expert1/expert2/chefProjet.
2. Rapport de conflits detaille (TPI A/TPI B/personne).
3. Freeze refuse si conflit hard detecte.
- DoD:
1. Tests unitaires avec cas croises.
2. Message de validation comprehensible.

### WF-202 - Detecter conflits hard de salles

- Type: Story
- Priorite: P0
- Estimation: 3 pts
- Description: En tant qu'admin, je veux empecher 2 défenses dans la meme salle au meme slot.
- Criteres d'acceptation:
1. Detection par `site + room + date + period`.
2. Freeze refuse si collision de salle.
3. Rapport exportable JSON.
- DoD:
1. Test unitaire sur collisions multiples.
2. Integration dans endpoint de freeze.

### WF-203 - Geler un snapshot immuable

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant qu'admin, je veux figer la planification envoyee au vote.
- Criteres d'acceptation:
1. `POST /api/workflow/:year/planification/freeze` cree une version immuable.
2. Impossible de lancer les votes sans snapshot actif.
3. Le snapshot garde hash/version/date/auteur.
- DoD:
1. Tests integration freeze + lecture snapshot.
2. Audit event ecrit.

## WF-EP03 - Campagne de votes

### WF-301 - Lancer campagne de votes

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant qu'admin, je veux lancer la campagne en un clic.
- Criteres d'acceptation:
1. `POST /api/workflow/:year/votes/start` cree les demandes de vote.
2. Creation d'un `vote_link` par votant concerne.
3. Envoi email automatique avec lien et deadline.
- DoD:
1. Tests integration sur creation campagnes.
2. Retry idempotent sur envoi email.

### WF-302 - Relancer non repondants

- Type: Story
- Priorite: P0
- Estimation: 3 pts
- Description: En tant qu'admin, je veux relancer uniquement les personnes sans reponse.
- Criteres d'acceptation:
1. `POST /api/workflow/:year/votes/remind` cible les non votants.
2. La relance est tracable (qui/quand/combien).
3. Aucun envoi en double dans la meme minute.
- DoD:
1. Tests unitaires de ciblage.
2. Logging metrique relances.

### WF-303 - Cloturer campagne et classer les cas

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant qu'admin, je veux fermer la campagne et obtenir les statuts finaux.
- Criteres d'acceptation:
1. `POST /api/workflow/:year/votes/close` passe chaque TPI en `confirmed` ou `manual_required`.
2. Si consensus absent, raison explicite en sortie.
3. Transition vers `published` impossible tant que des `manual_required` bloquent.
- DoD:
1. Tests integration sur 3 cas (consensus, refus, absence vote).
2. Audit event de cloture.

### WF-304 - Vue vote filtree par utilisateur

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant qu'expert/chef projet, je veux voir uniquement mes TPI a voter.
- Criteres d'acceptation:
1. `vote_link` ouvre une vue limitee a `personId + year + campaignId`.
2. Aucun acces aux TPI d'un autre utilisateur.
3. Les votes peuvent etre soumis en lot ou unitaire.
- DoD:
1. Tests authz/filtrage.
2. E2E minimal du parcours de vote.

## WF-EP04 - Publication definitive

### WF-401 - Publier une version definitive

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant qu'admin, je veux publier uniquement les défenses confirmees.
- Criteres d'acceptation:
1. `POST /api/workflow/:year/publication/publish` cree `PublicationVersion`.
2. Exclusion automatique des TPI non confirmes.
3. Resume publication retourne `count` et `version`.
- DoD:
1. Tests integration sur contenu publie.
2. Audit event de publication.

### WF-402 - Envoyer soutenance_link automatiquement

- Type: Story
- Priorite: P0
- Estimation: 3 pts
- Description: En tant qu'admin, je veux envoyer les liens de consultation finale apres publication.
- Criteres d'acceptation:
1. `POST /api/workflow/:year/publication/send-links` envoie un lien par utilisateur concerne.
2. Le lien ouvre une vue lecture seule filtree.
3. Compteur succes/echec renvoye.
- DoD:
1. Tests de generation + envoi.
2. Retry idempotent.

### WF-403 - Rollback de publication

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant qu'admin, je veux revenir a la version precedente en cas d'erreur.
- Criteres d'acceptation:
1. `POST /api/workflow/:year/publication/rollback/:version` restaure N-1.
2. Rollback trace et horodate.
3. Vue `Soutenances/:year` reflete la version active.
- DoD:
1. Test integration publish -> rollback.
2. Runbook de rollback valide.

## WF-EP05 - Securite Magic Links v2

### WF-501 - Stockage securise des tokens

- Type: Story
- Priorite: P0
- Estimation: 3 pts
- Description: En tant que systeme, je veux ne jamais persister les tokens en clair.
- Criteres d'acceptation:
1. Hash + salt stockes, pas le token brut.
2. Expiration obligatoire par token.
3. Verification refuse les tokens expires.
- DoD:
1. Tests unitaires hash/verify/expiry.
2. Revue securite validee.

### WF-502 - Scope strict vote vs défense

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant que systeme, je veux 2 types de magic links etanches.
- Criteres d'acceptation:
1. Type `vote` ne peut pas ouvrir la vue défense.
2. Type `soutenance` ne peut pas ouvrir la vue vote.
3. Rejet explicite `403/401` en cas de scope mismatch.
- DoD:
1. Tests integration de non-regression cross-scope.
2. Audit des echecs de scope.

### WF-503 - Revocation et anti-replay

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant qu'admin, je veux revoquer un lien compromis.
- Criteres d'acceptation:
1. Revocation immediate par id token.
2. Mode usage unique supporte.
3. Rate limiting sur endpoint resolve.
- DoD:
1. Tests sur replay et revocation.
2. Metriques `invalid_token`, `revoked_token`, `rate_limited`.

## WF-EP08 - Qualite et observabilite

### WF-801 - E2E workflow complet

- Type: Story
- Priorite: P0
- Estimation: 8 pts
- Description: En tant qu'equipe, je veux verifier le parcours complet 1->2->3.
- Criteres d'acceptation:
1. Scenario nominal passe en CI.
2. 3 scenarios d'erreur couverts.
3. Rapport de test archive.
- DoD:
1. Pipeline CI verte.
2. Reproductible localement.

### WF-802 - Dashboard de pilotage

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant qu'ops, je veux suivre la campagne et la publication.
- Criteres d'acceptation:
1. Metriques: taux votes, latence emails, echecs tokens.
2. Vue par annee.
3. Donnees exportables CSV.
- DoD:
1. Dashboard disponible en preprod.
2. Verif metriques par jeu de test.

### WF-803 - Alerting et runbooks

- Type: Story
- Priorite: P0
- Estimation: 5 pts
- Description: En tant que support, je veux reagir vite en cas d'incident.
- Criteres d'acceptation:
1. Alertes sur erreurs critiques (publication, resolve token, email batch).
2. Runbook incident publie et teste.
3. Astreinte sait executer rollback.
- DoD:
1. Drill incident realise.
2. Temps de restauration mesure.

---

## 4) Plan sprint recommande (P0)

1. Sprint 1: WF-101, WF-102, WF-103, WF-501.
2. Sprint 2: WF-201, WF-202, WF-203, WF-301.
3. Sprint 3: WF-302, WF-303, WF-304, WF-502.
4. Sprint 4: WF-401, WF-402, WF-403, WF-503.
5. Sprint 5: WF-801, WF-802, WF-803.

---

## 5) Tableau TODO execution

- [ ] Creer les Epics WF-EP01, WF-EP02, WF-EP03, WF-EP04, WF-EP05, WF-EP08.
- [ ] Creer toutes les Stories WF-101 a WF-803.
- [ ] Tagger chaque story avec `year-scope`, `security`, `workflow-v2`.
- [ ] Assigner un owner technique par Epic.
- [ ] Lancer Sprint 1.
