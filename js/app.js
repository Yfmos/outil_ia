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
const modeCompte = { inscription: false };

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

formulaireCompte.addEventListener("submit", async function (evenement) {
  evenement.preventDefault();
  erreurCompte.textContent = "";

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
        chargerComptes().length === 0 ? chargerDonneesLegacy() : donneesVides()
      )
      : await connecterCompte(identifiantCompte.value, motDePasseCompte.value);

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

boutonChangerModeCompte.addEventListener("click", function () {
  modeCompte.inscription = !modeCompte.inscription;
  afficherModeCompte();
});

document.querySelector("#deconnexion").addEventListener("click", function () {
  definirCompteActif(null);
  window.location.reload();
});

afficherModeCompte();
identifiantCompte.focus();

function initialiserTaskFlow(compte) {
const donnees = chargerDonnees(compte.id);
let donneesModifiees = false;
if (!Array.isArray(donnees.categories)) {
  donnees.categories = [];
  donneesModifiees = true;
}
donnees.taches.forEach(function (tache) {
  if (typeof tache.categorie !== "string") {
    tache.categorie = "";
    donneesModifiees = true;
  } else if (tache.categorie && !donnees.categories.includes(tache.categorie)) {
    donnees.categories.push(tache.categorie);
    donneesModifiees = true;
  }
});
const categoriesVisibles = new Set(donnees.categories);
let afficherSansCategorie = true;
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
const formulaireTache = document.querySelector("#formulaire-tache");
const formulaireCategorie = document.querySelector("#formulaire-categorie");
const champNouvelleCategorie = formulaireCategorie.elements.categorie;
const etatCategories = document.querySelector("#etat-categories");
const afficherTerminees = document.querySelector("#afficher-terminees");
const nombreTerminees = document.querySelector("#nombre-terminees");
const dialogueRappel = document.querySelector("#dialogue-rappel");
const boutonNotifications = document.querySelector("#activer-notifications");
const etatNotifications = document.querySelector("#etat-notifications");
const rappelsEnAttente = [];
const minuteursRappel = new Map();
const delaiMaximalTimer = 2147483647;
let minuteurEcheance;

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

function afficherProchainRappel() {
  if (dialogueRappel.open || rappelsEnAttente.length === 0) {
    return;
  }

  const tache = rappelsEnAttente.shift();
  document.querySelector("#message-rappel").textContent =
    "Il est temps de vous occuper de « " + tache.titre + " ». Son échéance approche.";
  dialogueRappel.showModal();
}

function programmerRappel(tache) {
  window.clearTimeout(minuteursRappel.get(tache));
  minuteursRappel.delete(tache);

  if (!tache.echeance || !tache.rappelLe || tache.rappelAffiche || tache.statut === "terminee") {
    return;
  }

  const attente = new Date(tache.rappelLe).getTime() - Date.now();
  const minuteur = window.setTimeout(function () {
    minuteursRappel.delete(tache);

    if (attente > delaiMaximalTimer) {
      programmerRappel(tache);
      return;
    }

    if (!donnees.taches.includes(tache) || tache.statut === "terminee") {
      return;
    }

    tache.rappelAffiche = true;
    sauvegarderDonnees(donnees);

    if (tache.echeance && new Date(tache.echeance).getTime() <= Date.now()) {
      return;
    }

    if (!afficherNotificationRappel(tache)) {
      rappelsEnAttente.push(tache);
      afficherProchainRappel();
    }
  }, Math.max(0, Math.min(attente, delaiMaximalTimer)));
  minuteursRappel.set(tache, minuteur);
}

function programmerProchaineEcheance() {
  window.clearTimeout(minuteurEcheance);

  const maintenant = Date.now();
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

  const prochainMinuit = new Date();
  prochainMinuit.setHours(24, 0, 0, 0);
  const attente = Math.min(prochaineEcheance, prochainMinuit.getTime()) - maintenant;
  minuteurEcheance = window.setTimeout(function () {
    actualiserAffichage();
  }, Math.min(attente, delaiMaximalTimer));
}

function actualiserAffichage() {
  const totalTerminees = donnees.taches.filter(function (tache) {
    return tache.statut === "terminee";
  }).length;
  nombreTerminees.textContent = totalTerminees > 0 ? "(" + totalTerminees + ")" : "";

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
  afficherTaches(donnees, function (tache, estTerminee) {
    tache.statut = estTerminee ? "terminee" : "a_faire";
    sauvegarderDonnees(donnees);
    actualiserAffichage();
  }, function (tache) {
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
  }, function (tache, modifications) {
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
  }, function () {
    actualiserAffichage();
  }, afficherTerminees.checked, donnees.categories, categoriesVisibles, afficherSansCategorie);
  afficherPingouins(donnees);
  programmerProchaineEcheance();
}

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

  const tache = {
    id: "task-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    titre: titre,
    categorie: formulaireTache.elements.categorie.value,
    priorite: "basse",
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

formulaireCategorie.addEventListener("submit", function (evenement) {
  evenement.preventDefault();

  const nom = champNouvelleCategorie.value.trim();
  if (!nom) {
    champNouvelleCategorie.setCustomValidity("Saisissez le nom de la catégorie.");
    champNouvelleCategorie.reportValidity();
    return;
  }

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

champNouvelleCategorie.addEventListener("input", function () {
  champNouvelleCategorie.setCustomValidity("");
  etatCategories.textContent = "";
});

formulaireTache.elements.titre.addEventListener("input", function () {
  formulaireTache.elements.titre.setCustomValidity("");
});

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

afficherTerminees.addEventListener("change", actualiserAffichage);

["echeance", "rappelLe"].forEach(function (nomChamp) {
  formulaireTache.elements[nomChamp].addEventListener("input", function () {
    formulaireTache.elements.echeance.setCustomValidity("");
    formulaireTache.elements.rappelLe.setCustomValidity("");
  });
});

dialogueRappel.addEventListener("close", afficherProchainRappel);
document.querySelector("#fermer-rappel").addEventListener("click", function () {
  dialogueRappel.close();
});
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) {
    mettreAJourEtatNotifications();
    actualiserAffichage();
  }
});

actualiserAffichage();
donnees.taches.forEach(programmerRappel);
mettreAJourEtatNotifications();
}
