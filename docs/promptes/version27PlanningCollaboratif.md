# Prompte Codex - Extension v27 Placement collaboratif

Tu es Codex, agent de developpement senior. Tu travailles dans le depot `tpiorganizer2023`.

Ta mission est de concevoir puis implementer l'extension fonctionnelle `Placement collaboratif` pour la version `27.00.00`, en respectant l'architecture existante et la decision produit v27.

## Documents a lire avant de coder

Commence par lire, sans tout coller dans la reponse:

- `docs/version-27.00.00-placement-collaboratif.md`
- `docs/version-27.00.00-suivi-inscriptions-tpi.md`
- `README.md`
- les routes et services existants autour de `coordination`, `workflow`, `planning`, `votes`, `publication`, `magic links`, `scheduling` et `access links`

Utilise `rg` pour cartographier le code. Ne cree pas une architecture parallele si le depot a deja des services reutilisables.

## Decision v27 non negociable

La v27 n'est pas une migration Electron.

La direction est:

- backoffice prive pour l'administration, la configuration, les corrections forcees et la publication;
- portail web controle pour les personnes externes;
- acces par session admin, session ciblee ou magic link personnel;
- droits calcules cote serveur;
- aucune exposition publique de `Gestion TPI`, `Parties prenantes`, `Configuration`, `Evaluation` ou `Liens d'acces`;
- pas de planning separe;
- aucune publication definitive ne doit etre modifiee silencieusement;
- Electron reste hors scope pour cette implementation.

## Objectif produit

Ajouter un module `Placement collaboratif` / `Placer les TPI` permettant aux parties prenantes de participer au placement sans ouvrir le backoffice.

Le module doit permettre:

- de voir les TPI qui concernent la personne courante;
- de consulter les creneaux compatibles;
- de proposer un placement, un deplacement ou plus tard un swap;
- de journaliser chaque action;
- de notifier les personnes impactees, sauf l'initiateur;
- d'afficher les propositions dans `Coordination`;
- de laisser l'admin appliquer, refuser, annuler ou notifier;
- de synchroniser `Planification`, `Coordination`, `Votes`, `Defenses`, `Publication` et `Emails`.

MVP: les personnes externes proposent. L'admin reste arbitre final.

## Regles fonctionnelles

Roles:

- `admin`: voit tout, arbitre, applique, refuse, corrige, publie, annule;
- `chef_projet`: agit sur les TPI dont il est chef de projet;
- `expert`: agit sur les TPI ou il est expert 1 ou expert 2;
- `candidat`: consulte son TPI et propose des preferences, sans imposer un placement final.

Contraintes:

- le serveur calcule le perimetre de la personne;
- le client ne peut pas declarer librement le TPI, le role ou la personne impactee;
- une proposition ne modifie pas directement le planning;
- une application admin doit reutiliser les regles de planification existantes;
- les conflits bloquants empechent l'application;
- les compromis doivent etre visibles;
- les publications existantes sont marquees obsoletes si une defense publiee change;
- toute action est auditee.

Conflits bloquants:

- salle deja occupee;
- personne deja occupee sur le meme creneau;
- personne indisponible;
- date incompatible avec la classe;
- publication definitive verrouillee sans mode correction;
- lien personnel expire;
- role insuffisant.

Compromis a signaler:

- preference non respectee;
- temps d'attente important;
- trop de TPI consecutifs;
- changement apres publication;
- action impactant plusieurs personnes.

## MVP a implementer

Priorite a une tranche verticale coherente et testable:

1. Ajouter le module `Placement collaboratif` dans les acces principaux.
2. Ajouter un portail personnel accessible par session ciblee ou magic link.
3. Donner aux parties prenantes une vue personnelle des TPI qui les concernent.
4. Permettre de proposer un creneau compatible, sans application directe.
5. Notifier les autres parties prenantes concernees, sauf l'initiateur.
6. Afficher les propositions dans `Coordination`.
7. Permettre a l'admin d'appliquer ou refuser.
8. Synchroniser `Planification` et `Coordination` apres application.
9. Marquer la publication comme a regenerer si une defense publiee change.
10. Bloquer toute exposition publique du planning complet et des modules d'administration.

Si tout le MVP est trop large pour une seule session, implemente d'abord une base extensible:

- modele/service de proposition;
- validation serveur reutilisant les regles existantes;
- endpoints de contexte/proposition/admin;
- portail personnel minimal;
- file admin minimale dans Coordination;
- audit;
- tests critiques;
- document de reprise clair pour la suite.

## API indicative

Garde les routes dans le routeur workflow canonique si possible:

```text
GET  /api/workflow/:year/collaborative-placement/context
POST /api/workflow/:year/collaborative-placement/propose
POST /api/workflow/:year/collaborative-placement/apply
POST /api/workflow/:year/collaborative-placement/reject
POST /api/workflow/:year/collaborative-placement/cancel
GET  /api/workflow/:year/collaborative-placement/events
POST /api/workflow/:year/collaborative-placement/notify
```

Les endpoints publics doivent renvoyer seulement:

- les TPI de la personne courante;
- les creneaux compatibles;
- les conflits qui la concernent;
- les propositions et evenements utiles.

Les endpoints admin peuvent exposer:

- toutes les propositions;
- les comparaisons avant/apres;
- les conflits globaux;
- les actions `apply`, `reject`, `cancel`, `notify`.

## Evenements attendus

Prevois un journal d'evenements:

- `placement.proposed`
- `placement.applied`
- `placement.rejected`
- `placement.cancelled`
- `placement.swap_proposed`
- `placement.swap_applied`
- `placement.conflict_detected`
- `placement.notification_sent`
- `placement.publication_outdated`

Chaque evenement doit stocker au minimum:

- annee;
- TPI concerne;
- creneau source;
- creneau cible;
- initiateur;
- personnes impactees;
- resultat de validation;
- source: app, lien personnel, admin, import ou automatisation;
- date.

## Interface attendue

Vue personne:

- liste des TPI concernes;
- statut actuel;
- creneaux compatibles;
- action `Proposer ce creneau`;
- historique court;
- messages de conflit comprehensibles.

Vue admin:

- toutes les propositions;
- conflits crees ou resolus;
- filtres par personne, date, salle, classe, statut;
- comparaison avant/apres;
- appliquer;
- refuser;
- annuler;
- notifier;
- indicateur de publication a regenerer.

## Tests minimum

Ajoute ou adapte des tests cibles:

- un chef de projet propose un placement;
- un expert propose un deplacement;
- un candidat ne peut pas appliquer directement;
- une personne ne voit que ses TPI;
- l'initiateur ne recoit pas sa propre notification;
- une personne deja occupee bloque l'application;
- une publication existante est marquee obsolete;
- un lien expire ou role insuffisant bloque l'action;
- un admin applique/refuse avec audit.

Lance les tests les plus proches du changement. Si la suite complete est trop longue, lance au minimum les tests unitaires/API concernes et indique ce qui n'a pas ete lance.

## Hygiene Codex et gestion du contexte

Avant d'implementer:

1. Lance `git status --short`.
2. Lis les fichiers avec `rg`, `Get-Content`, `Select-String`; evite de charger des fichiers geants sans filtre.
3. Fais un plan court avec les fichiers que tu vas toucher.
4. N'ecrase jamais les changements utilisateur non lies.

Si ton contexte devient trop lourd:

- ecris un checkpoint dans `docs/promptes/.codex-checkpoints/version27-placement-checkpoint.md`;
- resume: objectif, decisions, fichiers modifies, tests lances, reste a faire;
- utilise `/compact` si l'interface Codex le permet;
- n'utilise `/clear` qu'entre deux sessions, apres checkpoint, jamais au milieu d'une implementation non resumee.

Si les sous-agents Codex sont disponibles et autorises par l'utilisateur:

- lance un explorateur backend sur coordination/workflow/publication;
- lance un explorateur frontend sur planning/coordination/routes UI;
- lance un explorateur tests sur validation, votes, publication et magic links;
- garde les edits pour toi ou pour des workers avec zones de fichiers disjointes.

## Resultat attendu

A la fin:

- implementation ou tranche verticale livree;
- resume des fichiers modifies;
- tests lances et resultats;
- limites restantes;
- prochaine etape concrete pour poursuivre la v27.
