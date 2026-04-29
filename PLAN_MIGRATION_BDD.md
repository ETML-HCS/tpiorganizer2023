# Plan de modernisation de la base de données

Date: 2026-04-13

## Objectif

Décider puis exécuter, si validé, une évolution de l'architecture de données pour le projet TPI.

La stratégie de départ recommandée est:

- garder MongoDB pour les read models, snapshots et publications
- renforcer la cohérence applicative
- migrer seulement le coeur transactionnel vers une base relationnelle si le gain est confirmé

## Décision de départ

Le système ne doit pas subir une migration totale immédiate.

La cible la plus pragmatique est une approche hybride:

- MongoDB pour les données semi-structurées, les historiques et les vues matérialisées
- PostgreSQL pour les entités transactionnelles si la migration est validée

## Phase 0 - Cadrage

### Objectif

Fixer le périmètre exact, les règles métier non négociables et les critères de succès.

### Livrables

- liste des entités et relations métier
- inventaire des collections actuelles
- inventaire des flux critiques
- décision sur ce qui reste dans MongoDB
- décision sur ce qui peut migrer

### Critères de sortie

- le périmètre de migration est validé
- les risques majeurs sont connus
- les critères d'arrêt ou de rollback sont documentés

## Phase 1 - Audit de l'existant

### Objectif

Comprendre précisément ce qui fonctionne déjà et ce qui est fragile.

### Points à analyser

- modèles `Person`, `TpiPlanning`, `Slot`, `Vote`, `WorkflowYear`
- snapshots `PlanningSnapshot` et publications `PublicationVersion`
- flux `freeze`, `publish`, `rollback`
- logique de vote et conflits
- legacy par année et double source de vérité

### Livrables

- cartographie des dépendances
- liste des écritures multi-collections
- liste des invariants à protéger
- dette technique priorisée

### Critères de sortie

- les points de rupture sont identifiés
- les zones à garder dans MongoDB sont explicitement listées

## Phase 2 - Stabilisation de l'existant

### Objectif

Réduire le risque avant toute migration.

### Actions

- supprimer les collections par année au profit d'un champ `year`
- unifier les modèles legacy et modernes quand c'est possible
- isoler les read models des écritures métier
- vérifier les index utiles
- documenter les statuts et transitions

### Critères de sortie

- plus de duplication structurelle inutile
- les flux critiques sont plus lisibles et plus fiables
- les écritures les plus sensibles sont clairement bornées

## Phase 3 - Conception de la cible

### Objectif

Définir le schéma relationnel cible si la migration du coeur métier est confirmée.

### Tables candidates

- `persons`
- `tpi_plannings`
- `slots`
- `votes`
- `workflow_years`
- `workflow_audit_events`

### Données à garder en document ou JSONB

- `planning_snapshots`
- `publication_versions`
- historiques riches
- payloads variables

### Critères de sortie

- schéma cible validé
- mapping source -> cible documenté
- contraintes et index définis

## Phase 4 - Migration pilote

### Objectif

Migrer un périmètre limité pour valider le modèle cible sans risque global.

### Périmètre recommandé

- `Person`
- `TpiPlanning`
- `Slot`
- `Vote`

### Ce qu'il faut vérifier

- intégrité référentielle
- unicité des votes
- cohérence des statuts
- performance des requêtes métier
- équivalence fonctionnelle avec le système actuel

### Critères de sortie

- les tests de non-régression passent
- les écarts de données sont maîtrisés
- le comportement métier reste identique

## Phase 5 - Bascule progressive

### Objectif

Basculer les lectures et écritures par lot, pas en une seule fois.

### Ordre conseillé

- d'abord les lectures
- ensuite les écritures de référence
- ensuite les flux critiques
- enfin les exports et vues publiées

### Critères de sortie

- la nouvelle source de vérité est stable
- le legacy n'est plus nécessaire pour le périmètre migré

## Phase 6 - Nettoyage

### Objectif

Supprimer la dette technique résiduelle.

### Actions

- retirer les ponts legacy devenus inutiles
- supprimer les collections obsolètes
- simplifier les services
- documenter l'architecture finale

## Risques

- double source de vérité pendant la transition
- rollback de publication complexe
- perte de cohérence si les écritures ne sont pas atomiques
- migration de l'historique plus coûteuse que prévu
- surcoût de maintenance si la solution hybride est mal bornée

## Pré-requis

- sauvegarde complète avant toute migration
- stratégie de rollback testée
- jeux de tests de régression
- métriques sur les flux critiques
- validation métier des statuts et transitions

## Tests de validation

- création et confirmation d'un TPI
- génération de slots
- campagne de votes
- détection de consensus
- freeze du planning
- publication des défenses
- rollback d'une publication
- cohérence des conflits et des index

## Décision Go / No-Go

### Go si

- le gain en intégrité et en lisibilité est réel
- les coûts de migration sont maîtrisés
- les tests montrent un comportement identique

### No-Go si

- la migration exige une réécriture trop large
- le legacy bloque la bascule
- les read models dépendent trop du format document

## Conclusion

La stratégie recommandée est de préparer une base hybride, de stabiliser l'existant, puis de migrer seulement le coeur transactionnel si les critères de validation sont remplis.
