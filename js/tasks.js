function afficherTaches(
  donnees,
  auChangementDeStatut,
  auChangementDePriorite,
  aSupprimer,
  aModifier,
  annulerModification,
  afficherTerminees
) {
  const liste = document.querySelector("#liste-taches");
  const listeTerminees = document.querySelector("#liste-taches-terminees");
  const sectionTerminees = document.querySelector("#section-taches-terminees");
  liste.innerHTML = "";
  listeTerminees.innerHTML = "";

  const tachesActives = donnees.taches.filter(function (tache) {
    return tache.statut !== "terminee";
  });
  const tachesTerminees = donnees.taches.filter(function (tache) {
    return tache.statut === "terminee";
  });
  sectionTerminees.hidden = !afficherTerminees || tachesTerminees.length === 0;

  if (tachesActives.length === 0) {
    const message = document.createElement("li");
    message.className = "liste-taches-vide";
    message.textContent = tachesTerminees.length > 0
      ? "Aucune tâche à faire."
      : "Aucune tâche pour le moment.";
    liste.appendChild(message);
  }

  const tachesVisibles = tachesActives.concat(afficherTerminees ? tachesTerminees : []);
  tachesVisibles.forEach(function (tache) {
    const element = document.createElement("li");
    const libelle = document.createElement("label");
    const caseTerminee = document.createElement("input");
    const libellePriorite = document.createElement("label");
    const priorite = document.createElement("select");
    const echeance = tache.echeance ? new Date(tache.echeance) : null;
    const estEnRetard = echeance
      && !Number.isNaN(echeance.getTime())
      && echeance.getTime() <= Date.now()
      && tache.statut !== "terminee";

    caseTerminee.type = "checkbox";
    caseTerminee.checked = tache.statut === "terminee";
    caseTerminee.setAttribute(
      "aria-label",
      (caseTerminee.checked ? "Marquer comme à faire : " : "Marquer comme terminée : ") + tache.titre
    );
    caseTerminee.addEventListener("change", function () {
      auChangementDeStatut(tache, caseTerminee.checked);
    });

    libelle.appendChild(caseTerminee);
    libelle.appendChild(document.createTextNode(" " + tache.titre));
    element.appendChild(libelle);

    if (tache.echeance || tache.rappelLe) {
      const details = document.createElement("span");
      details.className = "details-echeance";
      if (estEnRetard) {
        element.classList.add("tache-en-retard");
        details.textContent = "En retard · Échéance : " + echeance.toLocaleString("fr-FR");
      } else if (tache.echeance) {
        details.textContent = "Échéance : " + echeance.toLocaleString("fr-FR");
      }
      if (tache.rappelLe) {
        details.appendChild(document.createTextNode(
          (details.textContent ? " · " : "")
            + "Rappel : " + new Date(tache.rappelLe).toLocaleString("fr-FR")
        ));
      }
      element.appendChild(details);
    }

    libellePriorite.className = "priorite-controle";
    libellePriorite.appendChild(document.createTextNode("Priorité "));
    priorite.setAttribute("aria-label", "Priorité de " + tache.titre);
    ["basse", "moyenne", "haute"].forEach(function (valeur) {
      const option = document.createElement("option");
      option.value = valeur;
      option.textContent = valeur.charAt(0).toUpperCase() + valeur.slice(1);
      priorite.appendChild(option);
    });
    priorite.value = ["basse", "moyenne", "haute"].includes(tache.priorite)
      ? tache.priorite
      : "moyenne";
    tache.priorite = priorite.value;
    element.classList.add("priorite-" + priorite.value);
    priorite.addEventListener("change", function () {
      element.classList.remove("priorite-basse", "priorite-moyenne", "priorite-haute");
      element.classList.add("priorite-" + priorite.value);
      auChangementDePriorite(tache, priorite.value);
    });
    libellePriorite.appendChild(priorite);
    element.appendChild(libellePriorite);

    const boutonModification = document.createElement("button");
    boutonModification.type = "button";
    boutonModification.className = "modifier-tache";
    boutonModification.textContent = "Modifier";
    boutonModification.setAttribute("aria-label", "Modifier la tâche : " + tache.titre);
    boutonModification.addEventListener("click", function () {
      const formulaire = document.createElement("form");
      formulaire.className = "formulaire-modification";

      const champs = [
        { nom: "titre", libelle: "Titre", type: "text", requis: true },
        { nom: "echeance", libelle: "Échéance", type: "datetime-local" },
        { nom: "rappelLe", libelle: "Me rappeler le", type: "datetime-local" }
      ];
      const controles = {};

      champs.forEach(function (champ) {
        const label = document.createElement("label");
        const input = document.createElement("input");
        const id = "modification-" + champ.nom + "-" + tache.id;
        label.htmlFor = id;
        label.textContent = champ.libelle;
        input.id = id;
        input.name = champ.nom;
        input.type = champ.type;
        if (champ.requis) {
          input.required = true;
          input.value = tache.titre;
        } else if (tache[champ.nom]) {
          const date = new Date(tache[champ.nom]);
          const dateLocale = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
          input.value = dateLocale.toISOString().slice(0, 16);
        }
        controles[champ.nom] = input;
        formulaire.appendChild(label);
        formulaire.appendChild(input);
      });

      const labelPriorite = document.createElement("label");
      const selectPriorite = document.createElement("select");
      const idPriorite = "modification-priorite-" + tache.id;
      labelPriorite.htmlFor = idPriorite;
      labelPriorite.textContent = "Priorité";
      selectPriorite.id = idPriorite;
      selectPriorite.name = "priorite";
      ["basse", "moyenne", "haute"].forEach(function (valeur) {
        const option = document.createElement("option");
        option.value = valeur;
        option.textContent = valeur.charAt(0).toUpperCase() + valeur.slice(1);
        selectPriorite.appendChild(option);
      });
      selectPriorite.value = ["basse", "moyenne", "haute"].includes(tache.priorite)
        ? tache.priorite
        : "moyenne";
      controles.priorite = selectPriorite;
      formulaire.appendChild(labelPriorite);
      formulaire.appendChild(selectPriorite);

      const actions = document.createElement("div");
      actions.className = "actions-modification";
      const enregistrer = document.createElement("button");
      enregistrer.type = "submit";
      enregistrer.textContent = "Enregistrer";
      const annuler = document.createElement("button");
      annuler.type = "button";
      annuler.textContent = "Annuler";
      annuler.addEventListener("click", annulerModification);
      actions.appendChild(enregistrer);
      actions.appendChild(annuler);
      formulaire.appendChild(actions);

      formulaire.addEventListener("submit", function (evenement) {
        evenement.preventDefault();
        const titre = controles.titre.value.trim();
        const echeanceValeur = controles.echeance.value;
        const rappelValeur = controles.rappelLe.value;

        if (!titre) {
          controles.titre.setCustomValidity("Saisissez le titre de la tâche.");
          controles.titre.reportValidity();
          return;
        }
        if (rappelValeur && !echeanceValeur) {
          controles.echeance.setCustomValidity(
            "Ajoutez une échéance pour pouvoir programmer un rappel."
          );
          controles.echeance.reportValidity();
          return;
        }
        if (rappelValeur && new Date(rappelValeur).getTime() >= new Date(echeanceValeur).getTime()) {
          controles.rappelLe.setCustomValidity("Le rappel doit être programmé avant l’échéance.");
          controles.rappelLe.reportValidity();
          return;
        }

        aModifier(tache, {
          titre: titre,
          priorite: controles.priorite.value,
          echeance: echeanceValeur ? new Date(echeanceValeur).toISOString() : "",
          rappelLe: rappelValeur ? new Date(rappelValeur).toISOString() : ""
        });
      });
      controles.titre.addEventListener("input", function () {
        controles.titre.setCustomValidity("");
      });
      [controles.echeance, controles.rappelLe].forEach(function (controle) {
        controle.addEventListener("input", function () {
          controles.echeance.setCustomValidity("");
          controles.rappelLe.setCustomValidity("");
        });
      });

      element.replaceChildren(formulaire);
      controles.titre.focus();
    });

    const boutonSuppression = document.createElement("button");
    boutonSuppression.type = "button";
    boutonSuppression.className = "supprimer-tache";
    boutonSuppression.textContent = "Supprimer";
    boutonSuppression.setAttribute("aria-label", "Supprimer la tâche : " + tache.titre);
    boutonSuppression.addEventListener("click", function () {
      aSupprimer(tache);
    });
    const actions = document.createElement("div");
    actions.className = "actions-tache";
    actions.appendChild(boutonModification);
    actions.appendChild(boutonSuppression);
    element.appendChild(actions);

    if (caseTerminee.checked) {
      element.classList.add("tache-terminee");
    }

    (tache.statut === "terminee" ? listeTerminees : liste).appendChild(element);
  });
}
