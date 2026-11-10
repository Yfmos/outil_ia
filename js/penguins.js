/**
 * Module de gestion de la banquise et de la gamification avec les pingouins.
 * Met en scène visuellement la progression de l'utilisateur sous forme de pingouins.
 */

/**
 * Met à jour et affiche la banquise avec les pingouins en fonction de l'avancement des tâches.
 *
 * Logique de gamification :
 * - 1 pingouin de base est toujours présent sur la banquise.
 * - Chaque tâche terminée fait apparaître 1 pingouin supplémentaire (récompense).
 * - Chaque tâche non terminée dont l'échéance est dépassée fait apparaître un pingouin agité/en rotation (alerte retard).
 * - Met également à jour le texte du résumé de progression dans le DOM.
 *
 * @param {Object} donnees - Données globales de l'application contenant la liste des tâches.
 */
function afficherPingouins(donnees) {
  // Récupération des conteneurs dans le DOM
  const zone = document.querySelector("#pingouins");
  const progression = document.querySelector("#progression");

  // Filtrage des tâches terminées pour le calcul de la progression
  const tachesTerminees = donnees.taches.filter(function (tache) {
    return tache.statut === "terminee";
  });

  // Calcul du nombre de pingouins "calmes" : 1 pingouin initial + 1 par tâche terminée
  const nombrePingouins = 1 + tachesTerminees.length;
  const nombreTaches = donnees.taches.length;

  // Détection des tâches en retard : non terminées, ayant une échéance antérieure ou égale à maintenant
  const tachesEnRetard = donnees.taches
    .filter(function (tache) {
      return tache.statut !== "terminee"
        && tache.echeance
        && new Date(tache.echeance).getTime() <= Date.now();
    })
    .sort(function (a, b) {
      // Tri chronologique des tâches en retard (les plus anciennes d'abord)
      return new Date(a.echeance).getTime() - new Date(b.echeance).getTime();
    });

  // Nettoyage préalable de la zone d'affichage des pingouins
  zone.innerHTML = "";

  // Mise à jour du texte de progression avec gestion grammaticale du singulier/pluriel
  progression.textContent = nombreTaches === 0
    ? "0 tâche terminée · 1 pingouin sur la banquise"
    : tachesTerminees.length + " tâche" + (tachesTerminees.length === 1 ? "" : "s")
      + " terminée" + (tachesTerminees.length === 1 ? "" : "s")
      + " sur " + nombreTaches + " · "
      + (nombrePingouins + tachesEnRetard.length) + " pingouin"
      + (nombrePingouins + tachesEnRetard.length === 1 ? "" : "s") + " sur la banquise";

  // Création et insertion des pingouins standards (décoratifs)
  for (let i = 0; i < nombrePingouins; i += 1) {
    const pingouin = document.createElement("span");
    pingouin.className = "pingouin";
    pingouin.textContent = "🐧";
    pingouin.setAttribute("aria-hidden", "true");
    zone.appendChild(pingouin);
  }

  // Création et insertion des pingouins en retard (animés par CSS pour tourner sur eux-mêmes)
  tachesEnRetard.forEach(function (tache) {
    const pingouin = document.createElement("span");
    pingouin.className = "pingouin pingouin-en-retard";
    pingouin.textContent = "🐧";
    pingouin.dataset.tacheId = tache.id;
    pingouin.setAttribute("role", "img");
    pingouin.setAttribute("aria-label", "Pingouin qui tourne : " + tache.titre);
    pingouin.title = "En retard : " + tache.titre;
    zone.appendChild(pingouin);
  });
}
