/**
 * Point d'entrée principal de l'application TaskFlow.
 * Gère l'authentification (connexion / inscription sécurisée avec Web Crypto),
 * le routage de l'affichage entre l'écran de connexion et l'espace de travail,
 * la gestion des catégories, la planification des rappels (modale et notifications de bureau)
 * et la mise à jour continue de l'interface.
 */

// Sélecteurs des éléments du formulaire d'authentification
const formulaireCompte = document.querySelector("#formulaire-compte");
const identifiantCompte = formulaireCompte.elements.identifiant;
const motDePasseCompte = formulaireCompte.elements.motDePasse;
const confirmerMotDePasse = formulaireCompte.elements.confirmation;
const confirmationMotDePasse = document.querySelector("#confirmation-mot-de-passe");
const erreurCompte = document.querySelector("#erreur-compte");
const boutonSoumettreCompte = document.querySelector("#soumettre-compte");
const boutonChangerModeCompte = document.querySelector("#changer-mode-compte");
const connexion = document.querySelector("#connexion");
const application = document.querySelector("#application");
const sessionCompte = document.querySelector("#session-compte");

// État du mode d'authentification : true = inscription, false = connexion
const modeCompte = { inscription: false };

/**
 * Met à jour les éléments de l'interface du formulaire de compte
 * selon que l'utilisateur est en mode "Connexion" ou "Créer un compte".
 */
function afficherModeCompte() {
  confirmationMotDePasse.hidden = !modeCompte.inscription;
  confirmerMotDePasse.required = modeCompte.inscription;
  motDePasseCompte.autocomplete = modeCompte.inscription ? "new-password" : "current-password";
  boutonSoumettreCompte.textContent = modeCompte.inscription ? "Créer mon compte" : "Se connecter";
  boutonChangerModeCompte.textContent = modeCompte.inscription
    ? "J’ai déjà un compte"
    : "Créer un compte";
  document.querySelector("#titre-connexion").textContent = modeCompte.inscription
    ? "Créer un compte TaskFlow"
    : "Connexion à TaskFlow";
  erreurCompte.textContent = "";
}

/**
 * Écouteur d'événement sur la soumission du formulaire d'authentification (connexion ou inscription).
 * Valide les entrées, effectue l'opération cryptographique requise, configure le compte actif,
 * masque l'écran de connexion et initialise l'application TaskFlow.
 */
formulaireCompte.addEventListener("submit", async function (evenement) {
  evenement.preventDefault();
  erreurCompte.textContent = "";

  // En mode inscription, vérification de la concordance des deux mots de passe
  if (modeCompte.inscription && motDePasseCompte.value !== confirmerMotDePasse.value) {
    erreurCompte.textContent = "Les mots de passe ne correspondent pas.";
    confirmerMotDePasse.focus();
    return;
  }

  boutonSoumettreCompte.disabled = true;
  try {
    const compte = modeCompte.inscription
      ? await creerCompte(
        identifiantCompte.value,
        motDePasseCompte.value,
        // Si c'est le tout premier compte créé sur l'appareil, migration des données legacy
        chargerComptes().length === 0 ? chargerDonneesLegacy() : donneesVides()
      )
      : await connecterCompte(identifiantCompte.value, motDePasseCompte.value);

    // Initialisation de la session utilisateur
    definirCompteActif(compte.id);
    connexion.hidden = true;
    application.hidden = false;
    sessionCompte.hidden = false;
    document.querySelector("#nom-compte").textContent = compte.identifiant;
    initialiserTaskFlow(compte);
  } catch (erreur) {
    erreurCompte.textContent = erreur.message || "Impossible d’ouvrir ce compte local.";
  } finally {
    boutonSoumettreCompte.disabled = false;
  }
});

// Basculement interactif entre le mode Inscription et le mode Connexion
boutonChangerModeCompte.addEventListener("click", function () {
  modeCompte.inscription = !modeCompte.inscription;
  afficherModeCompte();
});

// Déconnexion : suppression du compte actif et réinitialisation de la page
document.querySelector("#deconnexion").addEventListener("click", function () {
  definirCompteActif(null);
  window.location.reload();
});

// Initialisation de l'affichage initial du formulaire de connexion
afficherModeCompte();
identifiantCompte.focus();

/**
 * Initialise l'environnement de travail TaskFlow pour le compte utilisateur authentifié.
 * Configure la persistance des données, la gestion des catégories, l'API de notifications,
 * les minuteurs de rappels et de réévaluation des priorités journalières.
 * 
 * @param {Object} compte - Le compte utilisateur actuellement connecté.
 */
function initialiserTaskFlow(compte) {
  // Chargement des données propres au compte
  const donnees = chargerDonnees(compte.id);
  let donneesModifiees = false;

  // Migration de sécurité : s'assurer que le tableau de catégories existe
  if (!Array.isArray(donnees.categories)) {
    donnees.categories = [];
    donneesModifiees = true;
  }

  // Normalisation des tâches et détection des catégories orphelines
  donnees.taches.forEach(function (tache) {
    if (typeof tache.categorie !== "string") {
      tache.categorie = "";
      donneesModifiees = true;
    } else if (tache.categorie && !donnees.categories.includes(tache.categorie)) {
      donnees.categories.push(tache.categorie);
      donneesModifiees = true;
    }
  });

  // Gestion des filtres de catégories dans l'état local
  const categoriesVisibles = new Set(donnees.categories);
  let afficherSansCategorie = true;

  // Harmonisation de la priorité stockée (les priorités sont désormais calculées dynamiquement)
  let prioritesInitialesMisesAJour = false;
  donnees.taches.forEach(function (tache) {
    if (tache.priorite !== "basse") {
      tache.priorite = "basse";
      prioritesInitialesMisesAJour = true;
    }
  });
  if (prioritesInitialesMisesAJour || donneesModifiees) {
    sauvegarderDonnees(donnees);
  }

  // Sélecteurs des éléments du DOM dans l'espace connecté
  const formulaireTache = document.querySelector("#formulaire-tache");
  const formulaireCategorie = document.querySelector("#formulaire-categorie");
  const champNouvelleCategorie = formulaireCategorie.elements.categorie;
  const etatCategories = document.querySelector("#etat-categories");
  const afficherTerminees = document.querySelector("#afficher-terminees");
  const nombreTerminees = document.querySelector("#nombre-terminees");
  const dialogueRappel = document.querySelector("#dialogue-rappel");
  const boutonNotifications = document.querySelector("#activer-notifications");
  const etatNotifications = document.querySelector("#etat-notifications");

  // Files d'attente et gestion des minuteurs
  const rappelsEnAttente = [];
  const minuteursRappel = new Map();
  const delaiMaximalTimer = 2147483647; // 2^31 - 1 millisecondes (limite maximale de setTimeout)
  let minuteurEcheance;

  /**
   * Vérifie la disponibilité de l'API Notification du navigateur
   * et ajuste l'affichage et l'accessibilité du bouton d'activation.
   */
  function mettreAJourEtatNotifications() {
    if (!("Notification" in window)) {
      boutonNotifications.hidden = true;
      etatNotifications.textContent = "Les notifications de bureau ne sont pas disponibles dans ce navigateur.";
      return;
    }

    boutonNotifications.hidden = false;
    if (Notification.permission === "granted") {
      boutonNotifications.textContent = "Notifications de bureau activées";
      boutonNotifications.disabled = true;
      etatNotifications.textContent = "";
    } else if (Notification.permission === "denied") {
      boutonNotifications.textContent = "Notifications bloquées";
      boutonNotifications.disabled = true;
      etatNotifications.textContent =
        "Les notifications sont bloquées. Autorisez-les dans les paramètres du navigateur.";
    } else {
      boutonNotifications.disabled = false;
      etatNotifications.textContent = "";
    }
  }

  /**
   * Tente d'afficher une notification système de bureau via l'API Web Notification.
   * 
   * @param {Object} tache - La tâche faisant l'objet du rappel.
   * @returns {boolean} true si la notification a été créée et affichée avec succès, false sinon.
   */
  function afficherNotificationRappel(tache) {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return false;
    }

    try {
      const notification = new Notification("Rappel TaskFlow", {
        body: "Il est temps de vous occuper de « " + tache.titre + " ». Son échéance approche.",
        tag: tache.id
      });
      notification.addEventListener("click", function () {
        window.focus();
        notification.close();
      });
      return true;
    } catch (erreur) {
      console.error("Impossible d’afficher la notification de rappel.", erreur);
      return false;
    }
  }

  /**
   * Ouvre la boîte de dialogue modale de rappel de secours (HTML <dialog>)
   * pour la première tâche présente dans la file d'attente si aucune modale n'est déjà ouverte.
   */
  function afficherProchainRappel() {
    if (dialogueRappel.open || rappelsEnAttente.length === 0) {
      return;
    }

    const tache = rappelsEnAttente.shift();
    document.querySelector("#message-rappel").textContent =
      "Il est temps de vous occuper de « " + tache.titre + " ». Son échéance approche.";
    dialogueRappel.showModal();
  }

  /**
   * Planifie un minuteur (setTimeout) pour déclencher l'alerte de rappel d'une tâche.
   * Privilégie les notifications de bureau si elles sont autorisées,
   * sinon bascule vers la modale intégrée de l'application.
   * 
   * @param {Object} tache - La tâche pour laquelle configurer le rappel.
   */
  function programmerRappel(tache) {
    // Annulation de tout ancien minuteur pour cette tâche
    window.clearTimeout(minuteursRappel.get(tache));
    minuteursRappel.delete(tache);

    if (!tache.echeance || !tache.rappelLe || tache.rappelAffiche || tache.statut === "terminee") {
      return;
    }

    const attente = new Date(tache.rappelLe).getTime() - Date.now();
    const minuteur = window.setTimeout(function () {
      minuteursRappel.delete(tache);

      // Re-programmation en chaîne si le délai dépassait la limite de 24,8 jours
      if (attente > delaiMaximalTimer) {
        programmerRappel(tache);
        return;
      }

      if (!donnees.taches.includes(tache) || tache.statut === "terminee") {
        return;
      }

      tache.rappelAffiche = true;
      sauvegarderDonnees(donnees);

      // Si l'échéance est déjà dépassée au moment du déclenchement, on n'affiche plus de rappel
      if (tache.echeance && new Date(tache.echeance).getTime() <= Date.now()) {
        return;
      }

      // Si les notifications système échouent ou ne sont pas accordées, on utilise la modale
      if (!afficherNotificationRappel(tache)) {
        rappelsEnAttente.push(tache);
        afficherProchainRappel();
      }
    }, Math.max(0, Math.min(attente, delaiMaximalTimer)));
    minuteursRappel.set(tache, minuteur);
  }

  /**
   * Calcule et arme un minuteur pour actualiser l'interface :
   * - soit à la prochaine échéance d'une tâche active,
   * - soit au prochain minuit (changement de jour), ce qui permet de réévaluer
   *   automatiquement la priorité dynamique des tâches sans recharger la page.
   */
  function programmerProchaineEcheance() {
    window.clearTimeout(minuteurEcheance);

    const maintenant = Date.now();

    // Recherche de l'échéance future la plus proche
    const prochaineEcheance = donnees.taches
      .filter(function (tache) {
        return tache.statut !== "terminee" && tache.echeance;
      })
      .map(function (tache) {
        return new Date(tache.echeance).getTime();
      })
      .filter(function (date) {
        return Number.isFinite(date) && date > maintenant;
      })
      .sort(function (a, b) {
        return a - b;
      })[0];

    if (!prochaineEcheance) {
      return;
    }

    // Calcul du prochain passage à minuit pour recalculer les priorités quotidiennes
    const prochainMinuit = new Date();
    prochainMinuit.setHours(24, 0, 0, 0);
    const attente = Math.min(prochaineEcheance, prochainMinuit.getTime()) - maintenant;

    minuteurEcheance = window.setTimeout(function () {
      actualiserAffichage();
    }, Math.min(attente, delaiMaximalTimer));
  }

  /**
   * Fonction maîtresse de synchronisation et de mise à jour de l'interface utilisateur.
   * Actualise le compteur des tâches achevées, le sélecteur et la liste des catégories,
   * les filtres, la liste des tâches (avec les callbacks d'actions), la banquise et les minuteurs.
   */
  function actualiserAffichage() {
    // Calcul du total des tâches terminées
    const totalTerminees = donnees.taches.filter(function (tache) {
      return tache.statut === "terminee";
    }).length;
    nombreTerminees.textContent = totalTerminees > 0 ? "(" + totalTerminees + ")" : "";

    // Actualisation des vues liées aux catégories
    actualiserSelecteurCategories(donnees.categories);
    afficherCategories(donnees.categories);
    actualiserFiltresCategories(
      donnees.categories,
      donnees.taches,
      categoriesVisibles,
      afficherSansCategorie,
      function (categorie, estVisible) {
        if (categorie === null) {
          afficherSansCategorie = estVisible;
        } else if (estVisible) {
          categoriesVisibles.add(categorie);
        } else {
          categoriesVisibles.delete(categorie);
        }
        actualiserAffichage();
      }
    );

    // Rendu dynamique de la liste des tâches avec les callbacks associés
    afficherTaches(
      donnees,
      // Callback auChangementDeStatut : bascule entre terminée et à faire
      function (tache, estTerminee) {
        tache.statut = estTerminee ? "terminee" : "a_faire";
        sauvegarderDonnees(donnees);
        actualiserAffichage();
      },
      // Callback aSupprimer : suppression d'une tâche et nettoyage des rappels
      function (tache) {
        window.clearTimeout(minuteursRappel.get(tache));
        minuteursRappel.delete(tache);
        donnees.taches = donnees.taches.filter(function (tacheExistante) {
          return tacheExistante !== tache;
        });
        rappelsEnAttente.splice(0, rappelsEnAttente.length, ...rappelsEnAttente.filter(function (rappel) {
          return rappel !== tache;
        }));
        sauvegarderDonnees(donnees);
        actualiserAffichage();
      },
      // Callback aModifier : enregistrement des modifications issues du formulaire en ligne
      function (tache, modifications) {
        const rappelModifie = tache.rappelLe !== modifications.rappelLe
          || tache.echeance !== modifications.echeance;

        tache.titre = modifications.titre;
        tache.categorie = modifications.categorie;
        tache.echeance = modifications.echeance;
        tache.rappelLe = modifications.rappelLe;
        if (rappelModifie) {
          tache.rappelAffiche = false;
          rappelsEnAttente.splice(0, rappelsEnAttente.length, ...rappelsEnAttente.filter(function (rappel) {
            return rappel !== tache;
          }));
          programmerRappel(tache);
        }
        sauvegarderDonnees(donnees);
        actualiserAffichage();
      },
      // Callback annulerModification : annule la modification en réaffichant la vue normale
      function () {
        actualiserAffichage();
      },
      afficherTerminees.checked,
      donnees.categories,
      categoriesVisibles,
      afficherSansCategorie
    );

    // Actualisation des pingouins sur la banquise
    afficherPingouins(donnees);

    // Reprogrammation de la prochaine échéance ou du passage à minuit
    programmerProchaineEcheance();
  }

  /**
   * Écouteur d'événement sur la création d'une nouvelle tâche.
   * Valide les champs (titre, dates), construit l'objet tâche, l'ajoute au compte actif,
   * sauvegarde, réinitialise le formulaire et arme le rappel éventuel.
   */
  formulaireTache.addEventListener("submit", function (evenement) {
    evenement.preventDefault();

    const titre = formulaireTache.elements.titre.value.trim();
    if (!titre) {
      formulaireTache.elements.titre.setCustomValidity("Saisissez le titre de la tâche.");
      formulaireTache.elements.titre.reportValidity();
      return;
    }

    const echeance = formulaireTache.elements.echeance.value;
    const rappelLe = formulaireTache.elements.rappelLe.value;
    if (rappelLe && !echeance) {
      formulaireTache.elements.echeance.setCustomValidity(
        "Ajoutez une échéance pour pouvoir programmer un rappel."
      );
      formulaireTache.elements.echeance.reportValidity();
      return;
    }
    if (rappelLe && new Date(rappelLe).getTime() >= new Date(echeance).getTime()) {
      formulaireTache.elements.rappelLe.setCustomValidity(
        "Le rappel doit être programmé avant l’échéance."
      );
      formulaireTache.elements.rappelLe.reportValidity();
      return;
    }

    // Instanciation de la nouvelle tâche
    const tache = {
      id: "task-" + Date.now() + "-" + Math.random().toString(36).slice(2),
      titre: titre,
      categorie: formulaireTache.elements.categorie.value,
      priorite: "basse", // Initialisée à basse, recalculée dynamiquement selon l'échéance
      echeance: echeance ? new Date(echeance).toISOString() : "",
      rappelLe: rappelLe ? new Date(rappelLe).toISOString() : "",
      statut: "a_faire",
      sousTaches: [],
      dateCreation: new Date().toISOString()
    };

    donnees.taches.push(tache);
    sauvegarderDonnees(donnees);
    formulaireTache.reset();
    actualiserAffichage();
    programmerRappel(tache);
    formulaireTache.elements.titre.focus();
  });

  /**
   * Écouteur d'événement sur l'ajout d'une nouvelle catégorie.
   * Vérifie le non-vide et l'unicité (insensible à la casse en français),
   * l'ajoute aux données du compte et coche automatiquement le filtre pour la rendre visible.
   */
  formulaireCategorie.addEventListener("submit", function (evenement) {
    evenement.preventDefault();

    const nom = champNouvelleCategorie.value.trim();
    if (!nom) {
      champNouvelleCategorie.setCustomValidity("Saisissez le nom de la catégorie.");
      champNouvelleCategorie.reportValidity();
      return;
    }

    // Vérification de l'unicité de la catégorie
    const existeDeja = donnees.categories.some(function (categorie) {
      return categorie.localeCompare(nom, "fr", { sensitivity: "base" }) === 0;
    });
    if (existeDeja) {
      champNouvelleCategorie.setCustomValidity("Cette catégorie existe déjà.");
      champNouvelleCategorie.reportValidity();
      return;
    }

    donnees.categories.push(nom);
    categoriesVisibles.add(nom);
    sauvegarderDonnees(donnees);
    formulaireCategorie.reset();
    etatCategories.textContent = "Catégorie ajoutée.";
    actualiserAffichage();
    champNouvelleCategorie.focus();
  });

  // Réinitialisation des erreurs lors de la saisie d'une catégorie
  champNouvelleCategorie.addEventListener("input", function () {
    champNouvelleCategorie.setCustomValidity("");
    etatCategories.textContent = "";
  });

  // Réinitialisation des erreurs lors de la saisie du titre de la tâche
  formulaireTache.elements.titre.addEventListener("input", function () {
    formulaireTache.elements.titre.setCustomValidity("");
  });

  // Demande d'autorisation de l'API de notifications lors du clic sur le bouton
  boutonNotifications.addEventListener("click", function () {
    if (!("Notification" in window)) {
      mettreAJourEtatNotifications();
      return;
    }

    Notification.requestPermission().then(function () {
      mettreAJourEtatNotifications();
    }).catch(function (erreur) {
      console.error("Impossible de demander l’autorisation des notifications.", erreur);
      etatNotifications.textContent = "L’autorisation des notifications n’a pas pu être demandée.";
    });
  });

  // Afficher / masquer les tâches terminées
  afficherTerminees.addEventListener("change", actualiserAffichage);

  // Réinitialisation des messages d'erreur sur les champs de date
  ["echeance", "rappelLe"].forEach(function (nomChamp) {
    formulaireTache.elements[nomChamp].addEventListener("input", function () {
      formulaireTache.elements.echeance.setCustomValidity("");
      formulaireTache.elements.rappelLe.setCustomValidity("");
    });
  });

  // Gestion de la modale de rappel
  dialogueRappel.addEventListener("close", afficherProchainRappel);
  document.querySelector("#fermer-rappel").addEventListener("click", function () {
    dialogueRappel.close();
  });

  // Actualisation lorsque l'onglet redevient actif
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      mettreAJourEtatNotifications();
      actualiserAffichage();
    }
  });

  // Lancement initial de l'affichage, des rappels et de l'état des notifications
  actualiserAffichage();
  donnees.taches.forEach(programmerRappel);
  mettreAJourEtatNotifications();
}
