const CLE_STOCKAGE = "taskflow";

function chargerDonnees() {
  const brut = localStorage.getItem(CLE_STOCKAGE);

  if (!brut) {
    return {
      taches: [],
      filtreActif: "toutes"
    };
  }

  return JSON.parse(brut);
}

function sauvegarderDonnees(donnees) {
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(donnees));
}
