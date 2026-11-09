const donnees = chargerDonnees();
const formulaireTache = document.querySelector("#formulaire-tache");
const dialogueRappel = document.querySelector("#dialogue-rappel");
const rappelsEnAttente = [];
const minuteursRappel = new Map();
const delaiMaximalTimer = 2147483647;
let minuteurEcheance;

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

    rappelsEnAttente.push(tache);
    afficherProchainRappel();
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

  const attente = prochaineEcheance - maintenant;
  minuteurEcheance = window.setTimeout(function () {
    actualiserAffichage();
  }, Math.min(attente, delaiMaximalTimer));
}

function actualiserAffichage() {
  afficherTaches(donnees, function (tache, estTerminee) {
    tache.statut = estTerminee ? "terminee" : "a_faire";
    sauvegarderDonnees(donnees);
    actualiserAffichage();
  }, function (tache, priorite) {
    tache.priorite = priorite;
    sauvegarderDonnees(donnees);
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
    tache.priorite = modifications.priorite;
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
  });
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
    priorite: formulaireTache.elements.priorite.value,
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

formulaireTache.elements.titre.addEventListener("input", function () {
  formulaireTache.elements.titre.setCustomValidity("");
});

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
    actualiserAffichage();
  }
});

actualiserAffichage();
donnees.taches.forEach(programmerRappel);
