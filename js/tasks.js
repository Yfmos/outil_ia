function prioriteEffective(tache) {
  if (tache.statut === "terminee" || !tache.echeance) {
    return "basse";
  }

  const echeance = new Date(tache.echeance);
  if (Number.isNaN(echeance.getTime())) {
    return "basse";
  }

  const aujourdHui = new Date();
  const jourEcheance = Date.UTC(echeance.getFullYear(), echeance.getMonth(), echeance.getDate());
  const jourActuel = Date.UTC(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate());
  const joursRestants = Math.round((jourEcheance - jourActuel) / 86400000);

  if (joursRestants <= 0) {
    return "haute";
  }
  if (joursRestants <= 7) {
    return "moyenne";
  }
  return "basse";
}

function actualiserSelecteurCategories(categories) {
  const selecteur = document.querySelector("#categorie-tache");
  const categorieSelectionnee = selecteur.value;
  selecteur.replaceChildren(new Option("Aucune catégorie", ""));
  categories.forEach(function (categorie) {
    selecteur.add(new Option(categorie, categorie));
  });
  if (categories.includes(categorieSelectionnee)) {
    selecteur.value = categorieSelectionnee;
  }
}

function afficherCategories(categories) {
  const liste = document.querySelector("#liste-categories");
  liste.replaceChildren();
  categories.forEach(function (categorie) {
    const element = document.createElement("li");
    element.textContent = categorie;
    liste.appendChild(element);
  });
}

function actualiserFiltresCategories(categories, taches, categoriesVisibles, afficherSansCategorie, auChangement) {
  const section = document.querySelector("#filtres-categories");
  const options = document.querySelector("#options-filtres-categories");
  options.replaceChildren();
  const sansCategorieExiste = taches.some(function (tache) { return !tache.categorie; });
  section.hidden = categories.length === 0 && !sansCategorieExiste;

  categories.forEach(function (categorie, index) {
    const label = document.createElement("label");
    const caseFiltre = document.createElement("input");
    caseFiltre.type = "checkbox";
    caseFiltre.checked = categoriesVisibles.has(categorie);
    caseFiltre.setAttribute("aria-label", "Afficher la catégorie " + categorie);
    caseFiltre.addEventListener("change", function () {
      auChangement(categorie, caseFiltre.checked);
    });
    label.appendChild(caseFiltre);
    label.appendChild(document.createTextNode(" " + categorie));
    options.appendChild(label);
  });

  if (sansCategorieExiste) {
    const label = document.createElement("label");
    const caseFiltre = document.createElement("input");
    caseFiltre.type = "checkbox";
    caseFiltre.checked = afficherSansCategorie;
    caseFiltre.setAttribute("aria-label", "Afficher les tâches sans catégorie");
    caseFiltre.addEventListener("change", function () {
      auChangement(null, caseFiltre.checked);
    });
    label.appendChild(caseFiltre);
    label.appendChild(document.createTextNode(" Sans catégorie"));
    options.appendChild(label);
  }
}

function afficherTaches(
  donnees,
  auChangementDeStatut,
  aSupprimer,
  aModifier,
  annulerModification,
  afficherTerminees,
  categories,
  categoriesVisibles,
  afficherSansCategorie
) {
  const liste = document.querySelector("#liste-taches");
  const listeTerminees = document.querySelector("#liste-taches-terminees");
  const sectionTerminees = document.querySelector("#section-taches-terminees");
  liste.innerHTML = "";
  listeTerminees.innerHTML = "";

  const correspondAuFiltreCategorie = function (tache) {
    return tache.categorie
      ? categoriesVisibles.has(tache.categorie)
      : afficherSansCategorie;
  };
  const tachesActives = donnees.taches.filter(function (tache) {
    return tache.statut !== "terminee" && correspondAuFiltreCategorie(tache);
  });
  const tachesTerminees = donnees.taches.filter(function (tache) {
    return tache.statut === "terminee" && correspondAuFiltreCategorie(tache);
  });
  const toutesTachesActives = donnees.taches.filter(function (tache) {
    return tache.statut !== "terminee";
  });
  const rangPriorite = { haute: 0, moyenne: 1, basse: 2 };
  tachesActives.sort(function (a, b) {
    const differencePriorite = rangPriorite[prioriteEffective(a)] - rangPriorite[prioriteEffective(b)];
    if (differencePriorite !== 0) {
      return differencePriorite;
    }

    const echeanceA = a.echeance ? new Date(a.echeance).getTime() : Infinity;
    const echeanceB = b.echeance ? new Date(b.echeance).getTime() : Infinity;
    return echeanceA === echeanceB ? 0 : echeanceA - echeanceB;
  });
  tachesTerminees.sort(function (a, b) {
    return rangPriorite[prioriteEffective(a)] - rangPriorite[prioriteEffective(b)];
  });
  sectionTerminees.hidden = !afficherTerminees || tachesTerminees.length === 0;

  if (tachesActives.length === 0) {
    const message = document.createElement("li");
    message.className = "liste-taches-vide";
    if (toutesTachesActives.length > 0) {
      message.textContent = "Aucune tâche à faire dans les catégories sélectionnées.";
    } else {
      message.textContent = donnees.taches.some(function (tache) {
        return tache.statut === "terminee";
      })
        ? "Aucune tâche à faire."
        : "Aucune tâche pour le moment.";
    }
    liste.appendChild(message);
  }

  const tachesVisibles = tachesActives.concat(afficherTerminees ? tachesTerminees : []);
  tachesVisibles.forEach(function (tache) {
    const element = document.createElement("li");
    const libelle = document.createElement("label");
    const caseTerminee = document.createElement("input");
    const libellePriorite = document.createElement("span");
    const echeance = tache.echeance ? new Date(tache.echeance) : null;
    const prioriteActuelle = prioriteEffective(tache);
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
    element.classList.add("priorite-" + prioriteActuelle);

    const badgePriorite = document.createElement("span");
    badgePriorite.className = "priorite-effective priorite-effective-" + prioriteActuelle;
    const libellesPriorite = {
      basse: "Ça peut attendre",
      moyenne: "Va falloir le faire là",
      haute: "Fait le vite"
    };
    badgePriorite.textContent = "Priorité : " + libellesPriorite[prioriteActuelle];
    libellePriorite.className = "priorite-affichage";
    libellePriorite.appendChild(badgePriorite);
    element.appendChild(libellePriorite);

    if (tache.categorie) {
      const badgeCategorie = document.createElement("span");
      badgeCategorie.className = "badge-categorie";
      badgeCategorie.textContent = tache.categorie;
      element.appendChild(badgeCategorie);
    }

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

      const labelCategorie = document.createElement("label");
      const selectCategorie = document.createElement("select");
      const idCategorie = "modification-categorie-" + tache.id;
      labelCategorie.htmlFor = idCategorie;
      labelCategorie.textContent = "Catégorie";
      selectCategorie.id = idCategorie;
      selectCategorie.name = "categorie";
      selectCategorie.add(new Option("Aucune catégorie", ""));
      categories.forEach(function (categorie) {
        selectCategorie.add(new Option(categorie, categorie));
      });
      selectCategorie.value = tache.categorie || "";
      controles.categorie = selectCategorie;
      formulaire.appendChild(labelCategorie);
      formulaire.appendChild(selectCategorie);

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
          categorie: controles.categorie.value,
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
