# Roadmap Workflow Soutenances - Epics, User Stories, DoD

## 1) Vision produit

Mettre en place un workflow unique, robuste et audit-able en 3 etapes:

1. Planification: construire un planning sans conflits bloquants.
2. Planification-votes: faire confirmer par Expert 1, Expert 2, Chef de projet.
3. Publication: publier une version definitive dans `Soutenances/:year`.

Contrainte cle: 2 magic links distincts et etanches:

- `vote_link`: pour voter uniquement.
- `soutenance_link`: pour consulter la version finale uniquement (vue filtree utilisateur).

---

## 2) Perimetre

### In scope

- Workflow complet de bout en bout par annee.
- Boutons d'action dans les interfaces concernees.
- Envoi automatique des liens par email.
- Filtrage strict des vues par utilisateur.
- Versionning publication + rollback.
- Journal d'audit.

### Out of scope (V1)

- SMS/WhatsApp.
- SSO externe.
- Signature electronique avancee.

---

## 3) Epics

| Epic | Nom | Objectif | Priorite |
|---|---|---|---|
| EPIC-01 | Orchestrateur Workflow 3 etapes | Etats, transitions, verrouillages, audit | P0 |
| EPIC-02 | Planification robuste | Import, detection conflits, gel snapshot | P0 |
| EPIC-03 | Campagne de votes | Lancer/relancer/fermer votes + vote_link | P0 |
| EPIC-04 | Publication definitive | Publier version finale + soutenance_link | P0 |
| EPIC-05 | Securite des magic links | Hash, expiry, revocation, rate limit, trace | P0 |
| EPIC-06 | UX Boutons et parcours | Boutons automatiques dans les ecrans | P1 |
| EPIC-07 | Migration legacy et rollout | Coexistence, bascule progressive, rollback | P1 |
| EPIC-08 | Qualite, tests, observabilite | Tests e2e, monitoring, runbooks | P0 |

---

## 4) Detail des epics et user stories

## EPIC-01 - Orchestrateur Workflow 3 etapes

### Objectif

Piloter l'etat global annuel et imposer l'ordre des etapes.

### User stories

- US-01: En tant qu'admin, je veux voir l'etat global d'une annee (`planning`, `voting_open`, `published`) pour savoir ou j'en suis.
- US-02: En tant qu'admin, je veux bloquer certaines actions selon l'etape pour eviter les erreurs de process.
- US-03: En tant qu'auditeur, je veux un journal d'actions horodate pour tracer qui a fait quoi.

### Criteres d'acceptation

- Un etat unique est stocke par annee.
- Les transitions invalides retournent 409.
- Chaque action critique ecrit un event d'audit (acteur, action, payload minimal, timestamp).

### Livrables

- Modele `WorkflowYear`.
- Middleware de garde de transition.
- API `GET /api/workflow/:year`.

### DoD Epic

- Etats et transitions testes (unit + integration).
- Audit ecrit pour 100% des actions critiques.

---

## EPIC-02 - Planification robuste

### Objectif

Construire un planning valide avant vote.

### User stories

- US-04: En tant qu'admin, je veux importer CSV/iCal pour creer la base de planification.
- US-05: En tant qu'admin, je veux detecter les conflits bloquants (personne/salle a la meme heure).
- US-06: En tant qu'admin, je veux geler un snapshot pour l'envoyer en vote sans derive.

### Criteres d'acceptation

- Detection conflits hard:
  - meme personne sur 2 slots au meme moment;
  - meme salle sur 2 TPI au meme moment.
- Le gel snapshot cree une version immuable.
- Impossible d'ouvrir le vote sans snapshot gele.

### Livrables

- Service `planningValidationService`.
- Modele `PlanningSnapshot`.
- Endpoint `POST /api/workflow/:year/planification/freeze`.

### DoD Epic

- `0 conflit hard` requis avant freeze.
- Snapshot rejouable et identique (deterministe).

---

## EPIC-03 - Campagne de votes

### Objectif

Executer la validation par Expert 1, Expert 2, Chef de projet.

### User stories

- US-07: En tant qu'admin, je veux lancer une campagne de vote depuis un bouton unique.
- US-08: En tant qu'admin, je veux relancer automatiquement les non repondants.
- US-09: En tant qu'expert/chef de projet, je veux ouvrir ma vue de vote filtree via un `vote_link`.
- US-10: En tant qu'admin, je veux fermer la campagne et traiter les cas `manual_required`.

### Criteres d'acceptation

- `vote_link` cree pour chaque votant concerne.
- Envoi email automatique au lancement.
- Relance possible via bouton + relance planifiee.
- Vue vote limitee aux TPI autorises pour le porteur du token.

### Livrables

- Endpoints:
  - `POST /api/workflow/:year/votes/start`
  - `POST /api/workflow/:year/votes/remind`
  - `POST /api/workflow/:year/votes/close`
- Ecran admin de suivi de campagne.

### DoD Epic

- 100% des TPI sortent de `voting` vers `confirmed` ou `manual_required`.
- Historique complet des votes par role.

---

## EPIC-04 - Publication definitive

### Objectif

Publier une version finale stable et consultable.

### User stories

- US-11: En tant qu'admin, je veux publier uniquement les TPI confirmes.
- US-12: En tant qu'admin, je veux envoyer automatiquement les `soutenance_link` apres publication.
- US-13: En tant qu'utilisateur, je veux voir une vue finale filtree a mes soutenances.
- US-14: En tant qu'admin, je veux rollback la publication precedente si besoin.

### Criteres d'acceptation

- Publication genere une `PublicationVersion`.
- `Soutenances/:year` lit exclusivement la version publiee.
- `soutenance_link` donne acces lecture seule a la vue filtree utilisateur.
- Rollback restaure integralement la version N-1.

### Livrables

- Service de publication versionnee.
- Endpoints:
  - `POST /api/workflow/:year/publication/publish`
  - `POST /api/workflow/:year/publication/send-links`
  - `POST /api/workflow/:year/publication/rollback/:version`

### DoD Epic

- Publication et rollback testes en integration.
- Aucune edition directe possible sur la vue finale.

---

## EPIC-05 - Securite des magic links

### Objectif

Garantir separation stricte des usages et robustesse securite.

### User stories

- US-15: En tant que systeme, je veux stocker des hash de tokens, jamais les tokens clairs.
- US-16: En tant qu'admin, je veux revoquer un lien a tout moment.
- US-17: En tant que systeme, je veux des durees d'expiration differentes par type.
- US-18: En tant qu'auditeur, je veux tracer consommation et echecs de tokens.

### Criteres d'acceptation

- Modele `MagicLink` avec `type in {vote, soutenance}`.
- Scope strict:
  - `vote_link`: `year + campaignId + personId (+ role)`
  - `soutenance_link`: `year + publicationVersion + personId`
- Verification anti replay (usage unique configurable).
- Rate limiting et logs de securite.

### Livrables

- `magicLinkService` v2.
- Endpoint `GET /api/magic-link/resolve?token=...`.
- Tableau admin de revocation.

### DoD Epic

- Tests de securite passes (expiry, replay, scope mismatch, revocation).
- Aucun endpoint ne melange les scopes vote/soutenance.

---

## EPIC-06 - UX Boutons et parcours operateur

### Objectif

Rendre le workflow operable sans manip technique.

### User stories

- US-19: En tant qu'admin planification, je veux un bouton `Valider et geler`.
- US-20: En tant qu'admin vote, je veux `Lancer`, `Relancer`, `Clore`.
- US-21: En tant qu'admin publication, je veux `Publier`, `Envoyer liens`, `Rollback`.

### Criteres d'acceptation

- Boutons visibles seulement selon etat workflow.
- Confirmation explicite avant action irreversible.
- Feedback utilisateur clair (succes, erreurs, nombre d'emails envoyes).

### Livrables

- Actions UI dans `planification`, `planification-votes/:year`, `Soutenances admin`.

### DoD Epic

- Parcours complet realisable par un admin sans script manuel.

---

## EPIC-07 - Migration legacy et rollout

### Objectif

Migrer sans casser l'existant.

### User stories

- US-22: En tant qu'admin, je veux une migration des tokens legacy vers le nouveau modele.
- US-23: En tant qu'equipe, je veux activer le nouveau flux par feature flag.
- US-24: En tant qu'admin, je veux un plan de retour arriere immediat.

### Criteres d'acceptation

- Compatibilite temporaire assuree entre ancien et nouveau token.
- Bascule par annee possible.
- Rollback documente et teste.

### Livrables

- Script de migration.
- Feature flags (`WORKFLOW_V2_ENABLED`, `MAGIC_LINK_V2_ENABLED`).
- Runbook de bascule.

### DoD Epic

- Migration testee sur environnement de preprod + jeu de donnees reel anonymise.

---

## EPIC-08 - Qualite, tests, observabilite

### Objectif

Garantir fiabilite du workflow complet.

### User stories

- US-25: En tant qu'equipe, je veux des tests e2e du cycle complet 1->2->3.
- US-26: En tant qu'ops, je veux des metriques de campagne et publication.
- US-27: En tant que support, je veux des runbooks d'incident.

### Criteres d'acceptation

- Tests e2e verts pour le scenario nominal et 3 scenarios d'erreur.
- Dashboard: taux de vote, latence envoi email, echecs token.
- Alertes configurees sur erreurs critiques.

### Livrables

- Suite e2e automatique.
- Dashboard minimal (logs + compteurs).
- Runbook incident + checklist publication.

### DoD Epic

- Tous les tests bloquants passes avant mise en prod.

---

## 5) Backlog priorise (MVP)

### P0 - Obligatoire avant go-live

1. EPIC-01
2. EPIC-02
3. EPIC-03
4. EPIC-04
5. EPIC-05
6. EPIC-08 (minimum viable)

### P1 - Stabilisation

1. EPIC-06
2. EPIC-07

---

## 6) Definition of Ready (DoR)

Une user story est Ready si:

1. Le role et la valeur metier sont explicites.
2. Les donnees d'entree/sortie sont definies.
3. Les cas d'erreur majeurs sont listes.
4. Les criteres d'acceptation sont testables.
5. Les dependances sont identifiees.

---

## 7) Definition of Done (DoD) globale

Une story est Done si:

1. Code implemente et reviewe.
2. Tests unitaires + integration passes.
3. Tests e2e impactes passes.
4. Logs/audit conformes.
5. Documentation API/UI mise a jour.
6. Feature flag et rollback verifies.
7. Validation metier par PO effectuee.

---

## 8) Plan de livraison propose

### Sprint 1

- EPIC-01 (etat workflow)
- EPIC-05 (modele magic links v2)
- Base API resolve token

### Sprint 2

- EPIC-02 (validation planning + freeze snapshot)
- EPIC-03 (start/remind/close campagne)

### Sprint 3

- EPIC-04 (publication versionnee + soutenance_link)
- EPIC-06 (boutons UI operateur)

### Sprint 4

- EPIC-07 (migration progressive)
- EPIC-08 (hardening, monitoring, runbooks)

---

## 9) KPIs de succes

1. 100% des TPI publies proviennent d'un etat `confirmed`.
2. 0 incident de token cross-scope (vote vers soutenance ou inverse).
3. >95% des votes collectes avant deadline.
4. Publication + rollback executes en <5 minutes.
5. 0 modification manuelle hors workflow officiel.

---

## 10) Risques et mitigations

1. Coexistence legacy/nouveau flux -> feature flags + migration par annee.
2. Qualite des donnees personnes -> normalisation + clef `personId` partout.
3. Erreurs d'emailing -> retries idempotents + journal envoi.
4. Regressions UX -> parcours operateur testes e2e.

---

## 11) Decision de design a figer rapidement

1. Duree exacte des `vote_link` et `soutenance_link`.
2. Usage unique ou multi-usage pour `soutenance_link`.
3. Regle de cloture auto de campagne (date fixe ou quorum).
4. Politique de rollback (hard restore vs nouvelle version corrective).

---

## 12) TODO d'execution (checklist)

### EPIC-01 - Orchestrateur workflow

- [ ] Ajouter modele `WorkflowYear` (etat courant, horodatages, acteur).
- [ ] Ajouter table/event log `WorkflowAuditEvent`.
- [ ] Implementer garde de transitions (`planning -> voting_open -> published`).
- [ ] Exposer `GET /api/workflow/:year` + tests integration.

### EPIC-02 - Planification robuste

- [ ] Brancher validation conflits hard dans freeze.
- [ ] Implementer snapshot immuable (`PlanningSnapshot`).
- [ ] Bloquer `votes/start` si freeze absent.
- [ ] Ajouter tests: conflit personne, conflit salle, freeze deterministe.

### EPIC-03 - Campagne de votes

- [ ] Endpoint `POST /api/workflow/:year/votes/start` (creation tokens + envoi emails).
- [ ] Endpoint `POST /api/workflow/:year/votes/remind` (non repondants uniquement).
- [ ] Endpoint `POST /api/workflow/:year/votes/close` (resolution `confirmed`/`manual_required`).
- [ ] Ecran admin de suivi campagne (etat par TPI, filtres par role).

### EPIC-04 - Publication definitive

- [ ] Endpoint `publish` avec creation `PublicationVersion`.
- [ ] Endpoint `send-links` pour diffusion `soutenance_link`.
- [ ] Endpoint `rollback` vers version precedente.
- [ ] Basculer `Soutenances/:year` sur version publiee uniquement.

### EPIC-05 - Magic links v2

- [ ] Uniformiser un modele `MagicLink` type `vote|soutenance`.
- [ ] Stocker hash uniquement + expiration + revocation.
- [ ] Ajouter resolve token avec verification scope strict.
- [ ] Ajouter rate limit et audit de consommation.

### EPIC-06 - UX operateur

- [ ] Bouton `Valider et geler` en planification.
- [ ] Boutons `Lancer/Relancer/Clore` en planification-votes.
- [ ] Boutons `Publier/Envoyer liens/Rollback` en admin soutenances.
- [ ] Etats disabled/loading + confirmations explicites.

### EPIC-07 - Migration legacy

- [ ] Script migration tokens legacy -> v2.
- [ ] Feature flags workflow + magic links par annee.
- [ ] Double lecture temporaire legacy/v2 pendant transition.
- [ ] Runbook rollback operable en moins de 5 minutes.

### EPIC-08 - Qualite et observabilite

- [ ] Scenario e2e nominal complet `1->2->3`.
- [ ] Scenarios e2e d'erreur: token expire, conflit tardif, rollback.
- [ ] Dashboard minimal: taux votes, echecs emails, echecs tokens.
- [ ] Alerting sur erreurs critiques publication et token resolve.

