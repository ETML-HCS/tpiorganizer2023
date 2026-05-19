# Prompte Codex chapeau - Version 27 extensions collaboratives

Tu es Codex, agent de developpement senior. Tu travailles dans le depot `tpiorganizer2023`.

Ce prompte chapeaute les deux extensions v27:

- `Suivi TPI`
- `Placement collaboratif`

Tu dois les traiter comme deux extensions coordonnees d'un meme flux produit: inscription et constitution des TPI d'abord, collaboration sur le placement ensuite.

## Intention

Je veux creer les extensions v27 sans ouvrir toute l'application sur Internet et sans lancer une migration Electron.

Objectif general:

- garder le backoffice prive;
- exposer seulement des portails web controles pour les personnes concernees;
- calculer tous les droits cote serveur;
- eviter toute deuxieme source de verite;
- garder la publication comme sortie controlee;
- livrer une base technique extensible, testee et coherente avec le depot.

## Documents a lire au demarrage

Lis ces documents dans cet ordre, sans les recopier integralement:

1. `docs/version-27.00.00-suivi-inscriptions-tpi.md`
2. `docs/version-27.00.00-placement-collaboratif.md`
3. `docs/promptes/version27Suivitpi.md`
4. `docs/promptes/version27PlanningCollaboratif.md`
5. `README.md`

Ensuite explore le code avec `rg`, en priorite:

- `src/App.jsx`
- `src/config/appConfig.js`
- `src/components/shared/mainNavigation.js`
- `src/components/tpiTracker`
- `src/components/tpiPlanning`
- `src/components/tpiSchedule`
- `src/services`
- `API/routes/workflowRoutes.js`
- `API/routes/coordinationRoutes.js`
- `API/services`
- `API/models`
- `API/modules/accessLinks`
- `API/services/magicLinkService.js`

Ne charge pas tout le depot en contexte. Lis par tranche utile.

## Non negociables

- La v27 n'est pas une migration Electron.
- Le backoffice reste prive.
- Les portails publics controles sont seulement `Suivi TPI`, `Placement collaboratif`, votes/propositions et defenses publiees.
- Les modules `Gestion TPI`, `Parties prenantes`, `Configuration`, `Evaluation`, `Liens d'acces` ne sont pas exposes publiquement.
- Les droits sont calcules cote serveur.
- Les magic links/session ciblees ne donnent acces qu'au perimetre de la personne.
- `Suivi TPI` ne cree pas une deuxieme source de verite pour les personnes ou les TPI.
- `Placement collaboratif` ne cree pas un deuxieme planning.
- Aucune publication definitive n'est modifiee silencieusement.
- L'initiateur d'une action ne recoit pas la meme notification que les personnes impactees.
- Toute action importante est auditee.

## Strategie de travail

Commence par une phase d'audit courte:

1. `git status --short`
2. cartographie des routes frontend;
3. cartographie des routes API;
4. identification des modeles/services reutilisables;
5. plan d'implementation en 4 a 8 etapes.

Ensuite implemente. Ne reste pas au niveau proposition si le code peut etre modifie.

Si le chantier complet est trop large pour une seule session, livre une tranche verticale solide:

- fondation backend partagee;
- une surface frontend minimale;
- protection serveur;
- audit;
- tests;
- checkpoint clair pour la suite.

## Ordre recommande

### Phase 1 - Fondation commune

Mettre en place ou reutiliser:

- resolution d'identite via session admin, session ciblee ou magic link;
- helpers serveur pour calculer le perimetre d'une personne;
- audit workflow unifie;
- conventions d'erreurs API;
- marquage publication obsolete si un planning publie change;
- services backend plutot que logique metier dans React.

### Phase 2 - Extension Suivi TPI

Utilise `docs/promptes/version27Suivitpi.md`.

Priorite:

- page admin `Suivi TPI`;
- portail personnel `Suivi TPI`;
- contexte limite a la personne;
- creation/completion de TPI;
- choix/demande de chef de projet;
- choix expert 1 / expert 2;
- verrouillage/fenetres temporelles;
- audit;
- synchronisation vers les modules existants.

### Phase 3 - Extension Placement collaboratif

Utilise `docs/promptes/version27PlanningCollaboratif.md`.

Priorite:

- module `Placement collaboratif`;
- portail personnel limite aux TPI concernes;
- propositions de creneaux sans application directe;
- file admin dans `Coordination`;
- validation avec les regles de planification existantes;
- application/refus admin;
- notifications;
- publication marquee a regenerer si necessaire.

### Phase 4 - Tests et durcissement

Verifier au minimum:

- droits par role;
- perimetre limite des magic links;
- refus des actions hors role;
- audit des actions forcees;
- notifications sans l'initiateur;
- absence de deuxieme source de verite;
- publication obsolete apres changement publie;
- routes admin protegees;
- routes personnelles limitees.

## Commandes et hygiene Codex

Utilise les commandes de shell utiles:

```powershell
git status --short
rg "suivi|tracker|workflow|magic-link|coordination|publication" src API docs
npm test -- --runInBand
npm run test:api
git diff --stat
git diff -- <fichier>
```

Adapte les tests a ce qui a change. Pour les tests lourds, lance d'abord les tests cibles puis indique clairement ce qui reste non lance.

Si l'interface Codex propose des slash commands:

- utilise `/compact` apres avoir ecrit un checkpoint quand le contexte devient lourd;
- evite `/clear` pendant le travail;
- n'utilise `/clear` qu'entre deux sessions, apres avoir sauvegarde un resume de reprise;
- si un resume automatique existe, verifie qu'il contient les decisions v27 non negociables.

Checkpoint conseille avant toute compaction:

```text
ETAT V27
- Objectif en cours:
- Decisions conservees:
- Fichiers modifies:
- Tests lances:
- Resultats:
- Reste a faire:
- Risques ouverts:
```

Ecris ce checkpoint dans:

```text
docs/promptes/.codex-checkpoints/version27-execution-checkpoint.md
```

Si les sous-agents Codex sont disponibles et autorises par l'utilisateur:

- lance un explorateur backend pour `API/routes`, `API/services`, `API/models`;
- lance un explorateur frontend pour `src/App.jsx`, navigation, composants et services;
- lance un explorateur tests pour reperer les tests a etendre;
- confie a des workers uniquement des modifications avec zones de fichiers disjointes;
- integre et relis toi-meme avant de conclure.

## Definition of done

La session est terminee seulement si tu peux donner:

- ce qui a ete implemente;
- les fichiers modifies;
- les protections d'acces ajoutees ou reutilisees;
- les tests lances et leurs resultats;
- les limites restantes;
- la prochaine tranche recommandee.

Si tu ne peux pas tout terminer, ne masque pas l'incomplet. Livre une base propre et documente le relais.
