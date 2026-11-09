function afficherPingouins(donnees) {
  const zone = document.querySelector("#pingouins");
  const tachesTerminees = donnees.taches.filter(function (tache) {
    return tache.statut === "terminee";
  });
  const nombrePingouins = 1 + tachesTerminees.length;
  const nombreTaches = donnees.taches.length;
  const progression = document.querySelector("#progression");

  zone.innerHTML = "";

  progression.textContent = nombreTaches === 0
    ? "0 tâche terminée · 1 pingouin sur la banquise"
    : tachesTerminees.length + " tâche" + (tachesTerminees.length === 1 ? "" : "s")
      + " terminée" + (tachesTerminees.length === 1 ? "" : "s")
      + " sur " + nombreTaches + " · " + nombrePingouins + " pingouin"
      + (nombrePingouins === 1 ? "" : "s") + " sur la banquise";

  for (let i = 0; i < nombrePingouins; i += 1) {
    const pingouin = document.createElement("span");
    pingouin.className = "pingouin";
    pingouin.textContent = "🐧";
    zone.appendChild(pingouin);
  }
}
