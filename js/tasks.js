/**
 * Module d'affichage et de gestion interactive des tâches et des catégories.
 * Calcule dynamiquement les priorités en fonction des échéances,
 * gère les filtres de catégories et assure le rendu complet du DOM.
 */

/**
 * Détermine dynamiquement la priorité effective d'une tâche selon la proximité de son échéance.
 * 
 * Règles de calcul :
 * - Si la tâche est terminée ou n'a pas d'échéance : priorité "basse".
 * - Si l'échéance est aujourd'hui ou déjà dépassée (<= 0 jour) : priorité "haute" ("Fait le vite").
 * - Si l'échéance arrive dans les 7 jours prochains (<= 7 jours) : priorité "moyenne" ("Va falloir le faire là").
 * - Au-delà de 7 jours : priorité "basse" ("Ça peut attendre").
 * 
 * @param {Object} tache - L'objet tâche à évaluer.
 * @returns {string} Le niveau de priorité calculé ("basse", "moyenne" ou "haute").
 */
function prioriteEffective(tache) {
  if (tache.statut === "terminee" || !tache.echeance) {
    return "basse";
  }

  const echeance = new Date(tache.echeance);
  if (Number.isNaN(echeance.getTime())) {
    return "basse";
  }

  // Calcul du nombre de jours calendaires complets restants (en UTC pour éviter les décalages horaires)
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

/**
 * Met à jour les options du menu déroulant des catégories dans le formulaire de création de tâche.
 * Conserve la catégorie actuellement sélectionnée si elle existe toujours.
 * 
 * @param {Array<string>} categories - La liste des catégories du compte actif.
 */
function actualiserSelecteurCategories(categories) {
  const selecteur = document.querySelector("#categorie-tache");
  const categorieSelectionnee = selecteur.value;

  // Réinitialisation avec l'option par défaut "Aucune catégorie"
  selecteur.replaceChildren(new Option("Aucune catégorie", ""));
  categories.forEach(function (categorie) {
    selecteur.add(new Option(categorie, categorie));
  });

  // Préservation du choix en cours de saisie
  if (categories.includes(categorieSelectionnee)) {
    selecteur.value = categorieSelectionnee;
  }
}

/**
 * Injecte la liste textuelle des catégories créées dans la section de gestion des catégories.
 * 
 * @param {Array<string>} categories - La liste des catégories existantes.
 */
function afficherCategories(categories) {
  const liste = document.querySelector("#liste-categories");
  liste.replaceChildren();

  categories.forEach(function (categorie) {
    const element = document.createElement("li");
    element.textContent = categorie;
    liste.appendChild(element);
  });
}

/**
 * Construit et actualise les cases à cocher de filtrage par catégorie dans l'interface.
 * Gère également le filtre spécifique pour les tâches n'ayant aucune catégorie assignée.
 * 
 * @param {Array<string>} categories - Liste de toutes les catégories disponibles.
 * @param {Array<Object>} taches - Tableau complet des tâches pour vérifier la présence de tâches sans catégorie.
 * @param {Set<string>} categoriesVisibles - Ensemble des catégories actuellement cochées/actives.
 * @param {boolean} afficherSansCategorie - Indique si les tâches sans catégorie doivent être affichées.
 * @param {Function} auChangement - Callback notifié lors du basculement d'un filtre : fn(categorie|null, estVisible).
 */
function actualiserFiltresCategories(categories, taches, categoriesVisibles, afficherSansCategorie, auChangement) {
  const section = document.querySelector("#filtres-categories");
  const options = document.querySelector("#options-filtres-categories");
  options.replaceChildren();

  // Vérifie si des tâches sans catégorie existent pour afficher le filtre associé
  const sansCategorieExiste = taches.some(function (tache) { return !tache.categorie; });
  section.hidden = categories.length === 0 && !sansCategorieExiste;

  // Création des cases à cocher pour chaque catégorie existante
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

  // Création du filtre pour les tâches orphelines de catégorie
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

/**
 * Génère et injecte dans le DOM la liste des tâches actives et terminées.
 * 
 * Cette fonction prend en charge :
 * - Le filtrage par catégories actives.
 * - Le tri automatique par priorité calculée (Haute > Moyenne > Basse), puis par date d'échéance.
 * - L'affichage des messages lorsque la liste ou le filtre est vide.
 * - Le marquage terminée / à faire via case à cocher.
 * - L'affichage des badges visuels de priorité avec libellés humoristiques ("Fait le vite", etc.).
 * - L'affichage du badge de catégorie.
 * - Le formulaire de modification en ligne intégrant le titre, la catégorie et les dates.
 * - Le bouton de suppression avec callback.
 * 
 * @param {Object} donnees - Données globales du compte contenant les tâches et catégories.
 * @param {Function} auChangementDeStatut - Callback exécuté quand la tâche est cochée/décochée : fn(tache, estTerminee).
 * @param {Function} aSupprimer - Callback exécuté pour demander la suppression : fn(tache).
 * @param {Function} aModifier - Callback exécuté pour sauvegarder les modifications : fn(tache, modifications).
 * @param {Function} annulerModification - Callback pour annuler l'édition en cours : fn().
 * @param {boolean} afficherTerminees - Indique si la section des tâches terminées est visible.
 * @param {Array<string>} categories - Liste des catégories disponibles pour le formulaire d'édition.
 * @param {Set<string>} categoriesVisibles - Ensemble des catégories sélectionnées dans le filtre.
 * @param {boolean} afficherSansCategorie - Si true, inclut les tâches sans catégorie.
 */
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
  // Récupération des conteneurs de liste dans le DOM
  const liste = document.querySelector("#liste-taches");
  const listeTerminees = document.querySelector("#liste-taches-terminees");
  const sectionTerminees = document.querySelector("#section-taches-terminees");
  liste.innerHTML = "";
  listeTerminees.innerHTML = "";

  // Prédicat de filtrage par catégorie
  const correspondAuFiltreCategorie = function (tache) {
    return tache.categorie
      ? categoriesVisibles.has(tache.categorie)
      : afficherSansCategorie;
  };

  // Séparation des tâches actives et terminées respectant les filtres de catégories
  const tachesActives = donnees.taches.filter(function (tache) {
    return tache.statut !== "terminee" && correspondAuFiltreCategorie(tache);
  });
  const tachesTerminees = donnees.taches.filter(function (tache) {
    return tache.statut === "terminee" && correspondAuFiltreCategorie(tache);
  });
  const toutesTachesActives = donnees.taches.filter(function (tache) {
    return tache.statut !== "terminee";
  });

  // Tri des tâches actives : priorité effective en premier (haute -> moyenne -> basse), puis échéance la plus proche
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

  // Tri des tâches terminées par priorité effective
  tachesTerminees.sort(function (a, b) {
    return rangPriorite[prioriteEffective(a)] - rangPriorite[prioriteEffective(b)];
  });

  // Visibilité du conteneur des tâches terminées
  sectionTerminees.hidden = !afficherTerminees || tachesTerminees.length === 0;

  // Affichage d'un message indicatif si la liste des tâches actives est vide
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

  // Concaténation de la liste des éléments à restituer
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

    // Configuration de la case à cocher (statut à faire / terminée)
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

    // Badge d'affichage de la priorité calculée avec libellé explicite
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

    // Badge de catégorie si assignée
    if (tache.categorie) {
      const badgeCategorie = document.createElement("span");
      badgeCategorie.className = "badge-categorie";
      badgeCategorie.textContent = tache.categorie;
      element.appendChild(badgeCategorie);
    }

    // Affichage des informations d'échéance et de rappel
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

    // Bouton de modification en ligne
    const boutonModification = document.createElement("button");
    boutonModification.type = "button";
    boutonModification.className = "modifier-tache";
    boutonModification.textContent = "Modifier";
    boutonModification.setAttribute("aria-label", "Modifier la tâche : " + tache.titre);
    boutonModification.addEventListener("click", function () {
      // Construction dynamique du formulaire d'édition
      const formulaire = document.createElement("form");
      formulaire.className = "formulaire-modification";

      const champs = [
        { nom: "titre", libelle: "Titre", type: "text", requis: true },
        { nom: "echeance", libelle: "Échéance", type: "datetime-local" },
        { nom: "rappelLe", libelle: "Me rappeler le", type: "datetime-local" }
      ];
      const controles = {};

      // Génération des champs titre et dates
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

      // Sélecteur de catégorie dans le formulaire d'édition
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

      // Boutons Enregistrer et Annuler
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

      // Soumission et validation des modifications
      formulaire.addEventListener("submit", function (evenement) {
        evenement.preventDefault();
        const titre = controles.titre.value.trim();
        const echeanceValeur = controles.echeance.value;
        const rappelValeur = controles.rappelLe.value;

        // Validation du titre
        if (!titre) {
          controles.titre.setCustomValidity("Saisissez le titre de la tâche.");
          controles.titre.reportValidity();
          return;
        }
        // Validation : un rappel nécessite une échéance
        if (rappelValeur && !echeanceValeur) {
          controles.echeance.setCustomValidity(
            "Ajoutez une échéance pour pouvoir programmer un rappel."
          );
          controles.echeance.reportValidity();
          return;
        }
        // Validation : le rappel doit être chronologiquement antérieur à l'échéance
        if (rappelValeur && new Date(rappelValeur).getTime() >= new Date(echeanceValeur).getTime()) {
          controles.rappelLe.setCustomValidity("Le rappel doit être programmé avant l’échéance.");
          controles.rappelLe.reportValidity();
          return;
        }

        // Transmission des nouvelles données au callback de sauvegarde
        aModifier(tache, {
          titre: titre,
          categorie: controles.categorie.value,
          echeance: echeanceValeur ? new Date(echeanceValeur).toISOString() : "",
          rappelLe: rappelValeur ? new Date(rappelValeur).toISOString() : ""
        });
      });

      // Réinitialisation des messages d'erreur lors de la saisie
      controles.titre.addEventListener("input", function () {
        controles.titre.setCustomValidity("");
      });
      [controles.echeance, controles.rappelLe].forEach(function (controle) {
        controle.addEventListener("input", function () {
          controles.echeance.setCustomValidity("");
          controles.rappelLe.setCustomValidity("");
        });
      });

      // Remplacement dans l'interface et focus
      element.replaceChildren(formulaire);
      controles.titre.focus();
    });

    // Bouton de suppression de la tâche
    const boutonSuppression = document.createElement("button");
    boutonSuppression.type = "button";
    boutonSuppression.className = "supprimer-tache";
    boutonSuppression.textContent = "Supprimer";
    boutonSuppression.setAttribute("aria-label", "Supprimer la tâche : " + tache.titre);
    boutonSuppression.addEventListener("click", function () {
      aSupprimer(tache);
    });

    // Regroupement des actions
    const actions = document.createElement("div");
    actions.className = "actions-tache";
    actions.appendChild(boutonModification);
    actions.appendChild(boutonSuppression);
    element.appendChild(actions);

    // Style barré pour tâche achevée
    if (caseTerminee.checked) {
      element.classList.add("tache-terminee");
    }

    // Placement dans la liste idoine
    (tache.statut === "terminee" ? listeTerminees : liste).appendChild(element);
  });
}
