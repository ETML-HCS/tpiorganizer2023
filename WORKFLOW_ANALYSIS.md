# Analyse Complète: Système de Workflow et Planification TPI

**Date d'analyse**: 11 avril 2026  
**Couverture**: Routes, modèles, services, transitions d'état, approbations

---

## 1. FLUX PLANIFICATION BRUTE (Raw Planning)

### État: `planning`

```
Création du TPI
    ↓
[Admin propose slots]
    ↓
POST /api/planning/tpi/:id/propose-slots
    ↓
Scoring des créneaux:
  • Chef de projet dispo? → OUI (30pts) ou NON → BLOQUÉ
  • Candidat dispo? → OUI (25pts) ou NON → BLOQUÉ
  • Expert1/Expert2 dispo? → +20pts chacun si OUI, -5pts si NON
  • Règle 4 TPI max consécutifs? → Vérifiée, -15pts si risque
  • Site match? → +10pts si OUI
    ↓
Sélection: Top 3-5 créneaux par score
    ↓
TPI status = "voting"
Vote records créés (3 votes/slot × N_slots)
Emails envoyés avec magic links
```

### Validation et Gel (Freeze)

**Endpoint**: `POST /:year/planification/freeze`

**Préconditions**:
- État workflow = `planning`
- Tous les TPI avec slots proposés (ou confirmés manuellement)

**Validation des conflits "hard"**:
- ❌ Personne double-bookée au même créneau
- ❌ Salle double-bookée au même créneau

**Résultat**:
```javascript
PlanningSnapshot {
  year: 2026,
  version: 1,
  isActive: true,
  hash: "sha256(...)",  // Immutable checksum
  entries: [           // Tous les TPI confirmés
    {
      reference: "TPI-2026-001",
      slot: { date, period, room, participants },
      status: "confirmed"
    }
  ],
  hardConflicts: [],   // [{ type, dateKey, period, personId, references }]
  validationSummary: { 
    hasHardConflicts: false,
    hardConflictCount: 0,
    personOverlapCount: 0,
    roomOverlapCount: 0
  }
}
```

**Transitions possibles**:
- ✅ `allowHardConflicts=false` + aucun conflit → Snapshot frozen, prêt au vote
- ✅ `allowHardConflicts=true` + conflits détectés → Force freeze anyway
- ❌ Hard conflicts + `allowHardConflicts=false` → `409 Conflict`

---

## 2. FLUX PLANIFICATION VOTE (Voting Planning)

### État: `voting_open`

**Transition** (depuis `planning`):
```
POST /:year/votes/start
    ↓
[Vérification]: Active planning snapshot exists?
    ↓
SI OUI: workflow.state = "voting_open"
        votingOpenedAt = now()
SI NON: ❌ "Impossible d'ouvrir le vote sans snapshot gelé"
```

### Processus de Vote

Pour chaque TPI en état `voting`:
- N_slots = 3-5 (créneaux proposés)
- N_voters = 3 (expert1, expert2, chefProjet)
- Total votes = N_slots × N_voters

**Chaque vote**:
```javascript
Vote {
  tpiPlanning: ObjectId,
  slot: ObjectId,
  voter: ObjectId,
  voterRole: 'expert1' | 'expert2' | 'chef_projet',
  decision: 'pending' | 'accepted' | 'rejected' | 'preferred',
  votedAt: Date,
  comment: String (optional),
  priority: Number (optional)
}
```

### Soumission des Votes

**Single vote**:
```
POST /api/planning/votes/:id
{
  decision: 'accepted' | 'rejected' | 'preferred',
  comment: '...',
  priority: 1
}
```

**Bulk votes** (pour une même personne, plusieurs créneaux):
```
POST /api/planning/votes/bulk
{
  votes: [
    { voteId: ObjectId, decision: '...', priority: 1 },
    { voteId: ObjectId, decision: '...', priority: 2 }
  ]
}
```

### Conditions de Validation & Auto-Confirmation

Après chaque vote soumis, fonction `registerVoteAndCheckValidation()`:

#### Niveau 1️⃣: Consensus Unanime
```
Pour CHAQUE créneau parmi les proposés:
  SI expert1 voted (accepted|preferred)
  ET expert2 voted (accepted|preferred)
  ET chefProjet voted (accepted|preferred)
  ET tous les 3 ont voté le MÊME créneau
  
  ALORS:
    ✅ Auto-confirmation du créneau
    ✅ TPI status = "confirmed"
    ✅ Tous les autres créneaux libérés (status = 'available')
    ✅ Email de confirmation envoyée
```

Fonction clé: `Vote.findUnanimousSlot(tpiId)` - agrégation MongoDB

#### Niveau 2️⃣: Compromis (Tous ont voté, mais pas unanime)
```
SI areAllVotesIn(tpi) == true
  (expert1Voted && expert2Voted && chefProjetVoted)

  ALORS chercher le meilleur compromis:
  
  Best Slot = celui avec:
    • Max(acceptedCount + preferredCount)
    • ET rejectedCount ≤ 1  (max 1 rejet)
  
  SI best slot trouvé:
    ✅ TPI status = "pending_validation"
    ✅ Suggestion: utiliser ce créneau
    ✅ Admin doit valider manuellement
    
  SINON:
    ❌ TPI status = "manual_required"
    ❌ Intervention manuelle OBLIGATOIRE
```

Fonction clé: `findBestCompromiseSlot()` - agrégation MongoDB

#### Niveau 3️⃣: En attente
```
SI moins de 3 votes collectés:
  → "En attente des autres votes"
     Aucune action
```

### Campagne de Votes - Cycle Complet

**Phase 1: Lancement**
```
POST /:year/votes/start
→ workflow.state = "voting_open"
→ Pour chaque TPI en "voting":
   - Génère magic links pour expert1, expert2, chefProjet
   - Envoie emails avec lien de vote + créneaux proposés
   - Ajoute votingSession.deadline = now() + 7 jours
```

**Phase 2: Suivi (optionnel)**
```
POST /:year/votes/remind
→ Doit être en état "voting_open"
→ Envoie rappels aux voteurs en attente
→ Incrémente votingSession.remindersCount
```

**Phase 3: Clôture**
```
POST /:year/votes/close
→ Doit être en état "voting_open"
→ Pour chaque TPI en ["voting", "pending_validation"]:
   
   SI unanimousSlot trouvé:
     • confirmSlotForTpi() → status="confirmed"
   
   SINON:
     • status="manual_required"
     • Ajoute conflit: "Cloture de campagne: pas de consensus unanime"

→ Résumé retourné:
   {
     tpiProcessed: N,
     confirmedCount: auto-confirmés,
     manualRequiredCount: besoin intervention manuelle,
     unresolvedCount: erreurs
   }
```

---

## 3. CONDITIONS DE TRANSITION & APPROBATIONS

### 3A. Qui approuve ? Quand ?

| Phase | Acteur | Décision | Mécanisme |
|-------|--------|----------|-----------|
| Proposal | Admin (système) | "Proposer 5 créneaux" | Algorithme scoring auto |
| Voting | Expert1 | Accept/Reject créneau | Vote + email magic link |
| Voting | Expert2 | Accept/Reject créneau | Vote + email magic link |
| Voting | Chef Projet | Accept/Reject créneau | Vote + email magic link |
| Resolution | Système OU Admin | Confirmer si unanime OU chercher compromis | Auto-confirm si unanime OU manual_required |

### 3B. Conditions pour Transition `voting_open` → `published`

**Préconditions** (du service `publishConfirmedPlanningSoutenances`):

```javascript
1. workflow.state ∈ ['voting_open', 'published']

2. Pas de TPI en états bloquants:
   ❌ status = 'voting'
   ❌ status = 'pending_validation'
   ❌ status = 'manual_required'

3. Seulement TPI en status 'confirmed' :
   ✅ Chacun a un confirmedSlot (ObjectId de Slot)
   ✅ Chacun a une soutenanceDateTime
   ✅ Chacun a une soutenanceRoom

4. Pour chaque confirmed TPI:
   → Créer entry ou update dans collection PublicationVersion
   → Créer PublicationVersion.rooms[] groupés par date/salle
   → Marquer PublicationVersion.isActive = true
   → Déprécier les anciennes versions
```

**Transition état workflow**:
```javascript
SI all confirmed:
  workflow.state = "published"
  workflow.publishedAt = now()
  workflow.transitions.push({ from: 'voting_open', to: 'published', ... })
```

### 3C. Publication et Diffusion des Liens

Après transition vers `published`:

```
POST /:year/publication/publish
    ↓
1. Valider que zero TPI en session en vote
2. Récupérer tous les TPI confirmés
3. Grouper par (date, salle, période)
4. Créer PublicationVersion
5. Pour chaque personne (candidat, expert1, expert2, chefProjet):
   → Générer soutenance_magic_link (scope: published_soutenances)
   → Envoyer email avec lien + date/heure/salle
6. Retourner:
   {
     success: true,
     roomsCount: N,
     publicationVersion: { version: 1 },
     sentLinks: { recipientsCount, emailsSent, emailsSucceeded }
   }
```

---

## 4. STATUTS TPI - Diagramme d'État

```
┌─────┐
│draft│ ← Créé mais pas d'action
└──┬──┘
   │ [Admin propose slots]
   ↓
┌────────┐
│ voting │ ← En attente de votes (3 votes × N_slots)
└──┬─────┘
   │
   ├─→ Unanimous? ──→ ┌───────────┐
   │                 │ confirmed │ (Auto-confirm)
   │                 └─────┬─────┘
   │                       │
   ├─→ Compromise? ──→ ┌──────────────────┐
   │                   │pending_validation│ (Besoin admin)
   │                   └─────┬────────────┘
   │                         │
   │                         ├─→ Admin valide ──→ confirmed
   │                         └─→ Admin refuse ──→ manual_required
   │
   └─→ No consensus? ──→ ┌─────────────────┐
                        │ manual_required │
                        └────────┬────────┘
                                 │
                                 └─→ Admin assigne ──→ confirmed

   confirmed ──→ ┌──────────────┐
                │ completed │ (après défense)
                └──────────────┘
```

---

## 5. BLOCAGES & PROBLÈMES IDENTIFIÉS

### 🔴 Blocages Critiques

**A. Workflow State Transitions**
```javascript
❌ planning → voting_open SANS PlanningSnapshot gelé
   Erreur: "Impossible d'ouvrir le vote sans snapshot gelé"
   Cause: transitionWorkflowYear() vérifie hasActivePlanningSnapshot(year)
```

**B. Vote Magic Links - Scoping**
```javascript
⚠️ Magic link type = 'vote_magic_link'
   • Scope.year DOIT correspondre au TPI.year
   • Scope.personId DOIT être expert1, expert2, ou chefProjet du TPI
   • Si hors scope: 403 "Acces hors scope du lien de vote"
   
   Problem: Si lien expiré ou réutilisé, vote échoue silencieusement
```

**C. Publication Bloquée par TPI Non-Confirmés**
```javascript
❌ Tant que existe TPI en status ∈ ['voting', 'pending_validation', 'manual_required']:
   Publication échoue avec 409 Conflict
   Message: "Publication bloquée tant que des TPI restent en vote..."
   
   Solution: Clore campagne de votes et valider tous les TPI manuels
```

### 🟡 Non-Blocages mais À Surveiller

**D. Legend "outils" - Concept Non Trouvé**
```javascript
⚠️ Recherche exhaustive: 0 occurrences
   • Pas de table "outils"
   • Pas de colonne "outils" dans TPI
   • Pas d'endpoint "outils"
   • Pas de collection spécifique
   
   Hypothèse: Les "outils" pourraient être:
   1. Les proposedSlots (créneaux proposés)
   2. Les votes eux-mêmes (offers/offres)
   3. Une métaphore pour les "options de créneau"
```

**E. Legacy Offers/Offres System**
```javascript
⚠️ DataRooms.tpiDatas[].expert1/2/boss.offres toujours synchronisé
   offres = { isValidated: boolean, submit: [] }
   
   Danger: Deux systèmes en parallèle
   • Nouveau: TpiPlanning + Vote collection
   • Legacy: DataRooms + tpiList_* collections
   
   Impact: Si migration incomplète, inconsistances possibles
```

### 🟢 Fonctionnement Nominal

**✅ Flux planification brute** (planning → freeze → snapshot)  
**✅ Flux vote unanime** (auto-confirmation)  
**✅ Flux vote compromis** (avec suggestion admin)  
**✅ Flux publication** (génération liens, envoi emails)  

---

## 6. ARCHITECTURE DÉTAILLÉE

### Routes Principales

```
/api/planning/
  GET  /:year/planification/validate     [Admin] Valider planning
  GET  /:year/planification/snapshot     [Admin] Lire snapshot gelé
  POST /:year/planification/freeze       [Admin] Geler planning
  
  POST /:year/votes/start                [Admin] Lancer campagne
  POST /:year/votes/remind               [Admin] Relancer voteurs
  POST /:year/votes/close                [Admin] Clore campagne
  
  GET  /tpi/:year                        [Auth]  Lister TPI
  GET  /tpi/:year/:id                    [Auth]  Détail TPI
  POST /tpi                              [Admin] Créer TPI
  POST /tpi/:id/propose-slots            [Admin] Proposer slots
  
  POST /votes/:id                        [Auth]  Voter
  POST /votes/bulk                       [Auth]  Voter multiple

/api/workflow/
  GET  /:year/state                      [Admin] État workflow
  POST /:year/transition                 [Admin] Forcer transition
  GET  /:year/audit                      [Admin] Audit trail

/api/auth/ [Legacy]
  POST /magic-link                       Génère lien auth
  GET  /verify                           Vérifie lien
```

### Services Clés

```
workflowService.js
  • getWorkflowYearState(year)
  • transitionWorkflowYear({ year, targetState, user })
  • logWorkflowAuditEvent(...)
  
planningValidationService.js
  • validatePlanningForYear(year)
  • freezePlanningSnapshot({ year, user, allowHardConflicts })
  • detectHardConflicts(entries)

votingCampaignService.js
  • startVotesCampaign(year, baseUrl)
  • remindPendingVotes(year, baseUrl)
  • closeVotesCampaign(year)
  • sendSoutenanceLinksForYear(year, baseUrl)

schedulingService.js
  • proposeSlotsAndInitiateVoting(tpiId, maxSlots)
  • registerVoteAndCheckValidation(voteId, decision)
  • findAvailableSlotsForTpi(tpiId)
  • confirmSlotForTpi(tpiId, slotId)
```

### Modèles Clés

```
TpiPlanning {
  reference: String (unique),
  year: Number,
  candidat, expert1, expert2, chefProjet: ObjectId refs,
  status: String enum,
  proposedSlots: [{ slot: ObjectId, score, reason }],
  confirmedSlot: ObjectId,
  votingSession: { startedAt, deadline, voteSummary },
  conflicts: [{ type, description, detectedAt }],
  history: [{ action, by, at, details }]
}

Vote {
  tpiPlanning, slot, voter: ObjectId,
  voterRole: 'expert1'|'expert2'|'chef_projet',
  decision: 'pending'|'accepted'|'rejected'|'preferred',
  votedAt: Date,
  priority: Number
}

WorkflowYear {
  year: Number (unique),
  state: String enum,
  transitions: [{ from, to, actorId, actorEmail, at }],
  planningAt, votingOpenedAt, publishedAt: Dates
}

PlanningSnapshot {
  year, version (unique per year),
  isActive: Boolean,
  hash: String (sha256),
  entries: [{ reference, status, slot, participants }],
  hardConflicts: [{ type, personId, references }],
  validationSummary: { hasHardConflicts, counts }
}
```

---

## 7. LEGACY CODE À NETTOYER

### À DÉPRÉCIER

```javascript
// Routes legacy (toujours actives)
legacyAdminRoutes.js        // TpiModels, old save endpoints
legacyAuthRoutes.js         // Old token auth
legacyExpertsRoutes.js      // Old expert endpoints
legacySoutenanceRoutes.js   // Old viewing with legacy tokens
legacyUsersRoutes.js        // Old user management

// Models legacy
tpiModels.js                // tpiList_YEAR collection
tpiRoomsModels.js           // Parallel to TpiPlanning

// Services legacy
magicLinkService.js         // ❌ Use magicLinkV2Service.js instead
```

### Synchronisation Actuelle (⚠️ À Monitorer)

```javascript
publishedSoutenanceService.js:
  • syncLegacyPublishedRooms(year, rooms)
    → Met à jour DataRooms collection
  • updatePublishedSoutenanceOffersByLegacyId(...)
    → Synchronise les offres dans legacy tpiDatas
```

---

## 8. RECOMMANDATIONS D'ACTION

### Immédiat (P0)

- [x] ✅ Workflow orchestrator implémenté (planning → voting_open → published)
- [x] ✅ Planning snapshot freeze avec détection conflits
- [x] ✅ Vote campaign avec auto-confirmation unanime
- [x] ✅ Magic link v2 avec scoping par workflow

### Court terme (P1)

- [ ] 📋 Retirer routes legacy une fois migration 100% complète
- [ ] 📋 Valider scoping vote magic links en production (aucune fuite cross-scope)
- [ ] 📋 Tests de charge: 1000+ TPI/year, campagne 300+ voteurs

### À Investiguer

- [ ] 🔍 "Outils" = notion absente du système = vérifier avec PM
- [ ] 🔍 Cas edge: TPI sans chef de projet (conflits?)
- [ ] 🔍 Rollback de publication (endpoint existe mais logic incomplète?)

---

## 9. RÉSUMÉ EXÉCUTIF

### État du Système ✅

**Workflow**: Fully implemented, 3-state machine avec audit trail  
**Planification**: Scoring algorithm complet, freeze avec conflits  
**Voting**: Auto-confirmation unanime + compromis détecté  
**Approbation**: Expert1 + Expert2 + Chef Projet = consensus + admin fallback  
**Publication**: Versioning, magic links, audit trail  

### Blocages Connus 🔴

1. **Publication bloquée** tant que TPI en vote/pending_validation/manual_required
2. **Vote magic links** doivent matcher scope du TPI (cross-scope = 403)
3. **Planning freeze** impossible sans snapshot actif
4. **"Outils"** : Aucune mention dans nouveau système (clarifier besoin PM)

### Points d'Attention ⚠️

- Legacy system still running in parallel → données peuvent diverger
- Vote unanimous detection utilise MongoDB aggregation (vérifier index)
- Planning snapshot hash: à valider si immutability garantie en prod

---

*Analyse effectuée le 11 avril 2026*  
*Périmètre: API routes, models, services - complet*
