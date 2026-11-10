## User Stories

```
- En tant qu’étudiant, je veux voir une banquise avec un pingouin dès l’ouverture de TaskFlow afin de suivre ma progression dans un univers visuel amusant.
- En tant qu’étudiant, je veux qu’un pingouin s’ajoute à la banquise chaque fois que je termine une tâche afin de voir mes réussites s’accumuler.
- En tant qu’étudiant, je veux qu’un pingouin se mette à tourner sans fin lorsqu’une tâche dépasse son échéance sans être terminée afin de repérer les tâches en retard.
- En tant qu’étudiant, je veux pouvoir attribuer une priorité (basse, moyenne ou haute) à chaque tâche afin de repérer celles qui demandent mon attention en premier.
- En tant qu’étudiant, je veux recevoir un rappel avant l’échéance d’une tâche afin de ne pas oublier de la terminer.
- En tant qu’étudiant, je veux découper une tâche importante en sous-tâches afin d’avancer étape par étape et de voir ma progression.
- En tant qu’étudiant, je veux consulter toutes mes tâches dans une liste affichant leur titre et leur état (« à faire » ou « terminée »), afin de voir rapidement ce qu’il me reste à accomplir.
- En tant qu’étudiant, je veux marquer une tâche comme terminée, puis pouvoir voir visuellement qu’elle est accomplie, afin de suivre mon avancement sans la confondre avec les tâches restantes.
- En tant qu’étudiant, je veux filtrer la liste pour afficher toutes les tâches, seulement celles à faire ou seulement celles terminées, afin de retrouver rapidement les tâches correspondant à mon besoin.
- En tant qu’étudiant, je veux supprimer une tâche de ma liste, afin de retirer celles qui ne sont plus utiles et de garder une liste à jour.
- En tant qu’étudiant, je veux pouvoir créer des tâches personnalisées, autant que voulu et manuellement.
- En tant qu’étudiant, je veux que la priorité d’une tâche augmente à l’approche de son échéance et que les tâches à traiter en premier apparaissent en haut de la liste.
- En tant qu’étudiant, je veux pouvoir modifier facilement une tâche créée afin de mettre à jour son titre, sa priorité, son échéance et son rappel sans perdre son état.

```

## Arborescence

```
.
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── tasks.js
│   ├── penguins.js
│   └── storage.js
└── assets/
    ├── images/
    │   └── banquise.svg
    └── icons/
```

## Modèle de données

```json
{
  "taches": [
    {
      "id": "task-1",
      "titre": "Réviser le CSS",
      "description": "Revoir Flexbox et faire des exercices",
      "priorite": "haute",
      "echeance": "2026-11-15",
      "statut": "a_faire",
      "sousTaches": [],
      "dateCreation": "2026-11-09T14:30:00"
    }
  ],
  "filtreActif": "toutes"
}
```
