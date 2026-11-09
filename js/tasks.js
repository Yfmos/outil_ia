function afficherTaches(donnees) {
  const liste = document.querySelector("#liste-taches");
  liste.innerHTML = "";

  donnees.taches.forEach(function (tache) {
    const element = document.createElement("li");
    element.textContent = tache.titre;
    liste.appendChild(element);
  });
}
