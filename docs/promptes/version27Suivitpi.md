# Prompte Codex - Extension v27 Suivi TPI

Tu es Codex, agent de developpement senior. Tu travailles dans le depot `tpiorganizer2023`.

Ta mission est de concevoir puis implementer l'extension fonctionnelle `Suivi TPI` pour la version `27.00.00`, en respectant strictement l'architecture existante et la decision produit v27.

## Documents a lire avant de coder

Commence par lire, sans tout coller dans la reponse:

- `docs/version-27.00.00-suivi-inscriptions-tpi.md`
- `docs/version-27.00.00-placement-collaboratif.md`
- `README.md`
- les routes et services existants autour de `workflow`, `coordination`, `magic links`, `Person`, `Gestion TPI` et `TpiTracker`

Utilise `rg` pour trouver les fichiers pertinents. Ne pars pas d'une architecture theorique si le depot a deja un pattern local.

## Decision v27 non negociable

La v27 n'est pas une migration Electron.

La direction est:

- backoffice prive pour l'administration complete;
- portails web controles pour les personnes externes;
- acces par session admin, session ciblee ou magic link personnel;
- droits calcules cote serveur;
- aucune exposition publique de `Gestion TPI`, `Parties prenantes`, `Configuration`, `Evaluation` ou `Liens d'acces`;
- pas de deuxieme source de verite pour les TPI ou les personnes;
- Electron reste hors scope pour cette implementation.

## Objectif produit

Refondre l'actuel suivi en un module `Suivi TPI` qui permet:

- l'inscription ou la confirmation des roles des personnes;
- la creation progressive des TPI;
- le choix ou la demande d'un chef de projet;
- le choix ou l'attribution des experts 1 et 2;
- la gestion du domaine informatique;
- la gestion de 3 mots cles maximum;
- les corrections et attributions forcees par admin;
- la synchronisation avec `Person`, `Gestion TPI`, `Coordination`, `Planification`, `Acces-liens` et `Emails`.

Le module doit avoir deux surfaces:

- une vue admin privee;
- un portail personnel web controle, limite aux TPI et actions de la personne courante.

## Regles fonctionnelles

Roles:

- `admin`
- `candidat`
- `etudiant`
- `expert`
- `chef_projet`

Une personne peut cumuler plusieurs roles.

Contraintes:

- les droits sont calcules cote serveur a partir de la personne, de ses roles et de l'annee;
- le client ne choisit jamais librement le role effectif;
- un candidat ne modifie que son propre TPI, sauf admin;
- un candidat ne choisit pas directement `expert1` ou `expert2`;
- un expert ne peut pas etre `expert1` et `expert2` sur le meme TPI;
- les mots cles sont limites a 3, courts, normalises, en minuscules et sans doublons;
- le domaine est obligatoire avant synchronisation aval;
- les statuts affiches sont derives, pas stockes comme source de verite;
- les etapes peuvent etre bloquees sans reecrire l'historique;
- toute action forcee admin doit etre visible dans l'audit;
- l'auteur d'une action ne recoit pas la meme notification que les personnes impactees.

Domaines initiaux:

- `infra`
- `dev`

## MVP a implementer

Priorite a une tranche verticale coherente et testable:

1. Ajouter une page admin `Suivi TPI`.
2. Ajouter un portail personnel `Suivi TPI` accessible par session ciblee ou magic link.
3. Permettre l'inscription ou la confirmation de role.
4. Permettre au candidat de creer ou completer son TPI.
5. Permettre au candidat de choisir ou demander un chef de projet.
6. Permettre aux experts de choisir un TPI comme `expert1` ou `expert2`.
7. Permettre aux chefs de projet de choisir, accepter ou confirmer un TPI.
8. Permettre a l'admin de creer, corriger, forcer et verrouiller les attributions.
9. Ajouter des fenetres temporelles et verrous d'etapes par annee.
10. Synchroniser les TPI complets vers les modules existants.
11. Journaliser les actions importantes.
12. Bloquer toute exposition publique des modules hors portail.

Si tout le MVP est trop large pour une seule session, implemente d'abord une base extensible:

- modele/service backend;
- endpoints de contexte et d'action;
- protection serveur;
- page admin minimale;
- portail personnel minimal;
- tests des regles critiques;
- document de reprise clair pour la suite.

## API indicative

Garde les routes dans le routeur workflow canonique si possible:

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

Les endpoints publics doivent renvoyer uniquement le contexte de la personne courante. Les endpoints admin doivent exiger un role `admin`.

## Interface attendue

Vue personne:

- role actif et actions disponibles;
- TPI concernes;
- creation ou completion de TPI si autorisee;
- choix/demande de chef de projet;
- choix expert 1 / expert 2 si autorise;
- statut derive lisible;
- historique court;
- messages de refus comprehensibles.

Vue admin:

- liste des inscriptions et TPI;
- filtres par annee, role, statut derive, completude;
- actions forcees avec justification;
- verrous d'etapes;
- fenetres temporelles;
- historique/audit;
- indicateurs de synchronisation aval.

## Tests minimum

Ajoute ou adapte des tests cibles:

- un candidat cree ou complete son TPI;
- un candidat ne modifie pas le TPI d'un autre;
- un expert ne peut pas etre expert 1 et expert 2 du meme TPI;
- un admin peut forcer avec trace d'audit;
- un verrou d'etape bloque l'action;
- un lien/session personnel ne voit que son perimetre;
- les mots cles sont normalises et limites a 3;
- les statuts affiches sont derives.

Lance les tests les plus proches du changement. Si la suite complete est trop longue, lance au minimum les tests unitaires/API concernes et indique ce qui n'a pas ete lance.

## Hygiene Codex et gestion du contexte

Avant d'implementer:

1. Lance `git status --short`.
2. Lis les fichiers avec `rg`, `Get-Content`, `Select-String`; evite de charger des fichiers geants sans filtre.
3. Fais un plan court avec les fichiers que tu vas toucher.
4. N'ecrase jamais les changements utilisateur non lies.

Si ton contexte devient trop lourd:

- ecris un checkpoint dans `docs/promptes/.codex-checkpoints/version27-suivi-checkpoint.md`;
- resume: objectif, decisions, fichiers modifies, tests lances, reste a faire;
- utilise `/compact` si l'interface Codex le permet;
- n'utilise `/clear` qu'entre deux sessions, apres checkpoint, jamais au milieu d'une implementation non resumee.

Si les sous-agents Codex sont disponibles et autorises par l'utilisateur:

- lance un explorateur backend sur routes/services/modeles workflow;
- lance un explorateur frontend sur routes/components/services UI;
- lance un explorateur tests sur les tests existants pertinents;
- garde les edits pour toi ou pour des workers avec zones de fichiers disjointes.

## Resultat attendu

A la fin:

- implementation ou tranche verticale livree;
- resume des fichiers modifies;
- tests lances et resultats;
- limites restantes;
- prochaine etape concrete pour poursuivre la v27.
