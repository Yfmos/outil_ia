function afficherPingouins(donnees) {
  const zone = document.querySelector("#pingouins");
  const tachesTerminees = donnees.taches.filter(function (tache) {
    return tache.statut === "terminee";
  });
  const nombrePingouins = 1 + tachesTerminees.length;

  zone.innerHTML = "";

  for (let i = 0; i < nombrePingouins; i += 1) {
    const pingouin = document.createElement("span");
    pingouin.className = "pingouin";
    pingouin.textContent = "🐧";
    zone.appendChild(pingouin);
  }
}
