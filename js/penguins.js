function afficherPingouins(donnees) {
  const zone = document.querySelector("#pingouins");
  const tachesTerminees = donnees.taches.filter(function (tache) {
    return tache.statut === "terminee";
  });
  const nombrePingouins = 1 + tachesTerminees.length;
  const nombreTaches = donnees.taches.length;
  const progression = document.querySelector("#progression");
  const tachesEnRetard = donnees.taches
    .filter(function (tache) {
      return tache.statut !== "terminee"
        && tache.echeance
        && new Date(tache.echeance).getTime() <= Date.now();
    })
    .sort(function (a, b) {
      return new Date(a.echeance).getTime() - new Date(b.echeance).getTime();
    });

  zone.innerHTML = "";

  progression.textContent = nombreTaches === 0
    ? "0 tâche terminée · 1 pingouin sur la banquise"
    : tachesTerminees.length + " tâche" + (tachesTerminees.length === 1 ? "" : "s")
      + " terminée" + (tachesTerminees.length === 1 ? "" : "s")
      + " sur " + nombreTaches + " · "
      + (nombrePingouins + tachesEnRetard.length) + " pingouin"
      + (nombrePingouins + tachesEnRetard.length === 1 ? "" : "s") + " sur la banquise";

  for (let i = 0; i < nombrePingouins; i += 1) {
    const pingouin = document.createElement("span");
    pingouin.className = "pingouin";
    pingouin.textContent = "🐧";
    pingouin.setAttribute("aria-hidden", "true");
    zone.appendChild(pingouin);
  }

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
