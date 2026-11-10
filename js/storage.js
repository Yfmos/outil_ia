const CLE_STOCKAGE = "taskflow";
const CLE_COMPTES = "taskflow_comptes";
let identifiantCompteActif = null;

function donneesVides() {
  return {
    taches: [],
    categories: [],
    filtreActif: "toutes"
  };
}

function chargerComptes() {
  const brut = localStorage.getItem(CLE_COMPTES);
  if (!brut) {
    return [];
  }

  const comptes = JSON.parse(brut);
  if (!Array.isArray(comptes)) {
    throw new Error("Le fichier de comptes locaux est invalide.");
  }
  return comptes;
}

function chargerDonneesLegacy() {
  const brut = localStorage.getItem(CLE_STOCKAGE);
  if (!brut) {
    return donneesVides();
  }

  const donnees = JSON.parse(brut);
  if (!donnees || !Array.isArray(donnees.taches)) {
    throw new Error("La sauvegarde locale existante est invalide.");
  }
  return donnees;
}

function convertirEnBase64(octets) {
  let binaire = "";
  octets.forEach(function (octet) {
    binaire += String.fromCharCode(octet);
  });
  return btoa(binaire);
}

async function empreinteMotDePasse(motDePasse, sel) {
  if (!crypto.subtle) {
    throw new Error("Le chiffrement requis n’est pas disponible dans ce navigateur.");
  }

  const cle = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(motDePasse),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: sel,
    iterations: 310000,
    hash: "SHA-256"
  }, cle, 256);
  return convertirEnBase64(new Uint8Array(bits));
}

function sauvegarderComptes(comptes) {
  localStorage.setItem(CLE_COMPTES, JSON.stringify(comptes));
}

async function creerCompte(identifiant, motDePasse, sauvegarde) {
  const identifiantNormalise = identifiant.trim().toLocaleLowerCase("fr");
  if (identifiantNormalise.length < 3) {
    throw new Error("Le nom d’utilisateur doit contenir au moins 3 caractères.");
  }
  if (motDePasse.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }
  const comptes = chargerComptes();
  if (comptes.some(function (compte) {
    return compte.identifiantNormalise === identifiantNormalise;
  })) {
    throw new Error("Ce nom d’utilisateur est déjà utilisé sur cet appareil.");
  }

  const sel = crypto.getRandomValues(new Uint8Array(16));
  const compte = {
    id: crypto.randomUUID(),
    identifiant: identifiant.trim(),
    identifiantNormalise: identifiantNormalise,
    sel: convertirEnBase64(sel),
    empreinte: await empreinteMotDePasse(motDePasse, sel),
    donnees: sauvegarde
  };
  comptes.push(compte);
  sauvegarderComptes(comptes);
  localStorage.removeItem(CLE_STOCKAGE);
  return compte;
}

async function connecterCompte(identifiant, motDePasse) {
  const identifiantNormalise = identifiant.trim().toLocaleLowerCase("fr");
  if (!identifiantNormalise) {
    throw new Error("Nom d’utilisateur ou mot de passe incorrect.");
  }
  const compte = chargerComptes().find(function (compteLocal) {
    return compteLocal.identifiantNormalise === identifiantNormalise;
  });
  if (!compte) {
    throw new Error("Nom d’utilisateur ou mot de passe incorrect.");
  }

  const sel = Uint8Array.from(atob(compte.sel), function (caractere) {
    return caractere.charCodeAt(0);
  });
  const empreinte = await empreinteMotDePasse(motDePasse, sel);
  if (empreinte !== compte.empreinte) {
    throw new Error("Nom d’utilisateur ou mot de passe incorrect.");
  }
  return compte;
}

function definirCompteActif(identifiant) {
  identifiantCompteActif = identifiant;
}

function chargerDonnees(identifiant) {
  const compte = chargerComptes().find(function (compteLocal) {
    return compteLocal.id === identifiant;
  });
  if (!compte || !compte.donnees || !Array.isArray(compte.donnees.taches)) {
    throw new Error("La sauvegarde de ce compte est introuvable ou invalide.");
  }
  return compte.donnees;
}

function sauvegarderDonnees(donnees) {
  if (!identifiantCompteActif) {
    throw new Error("Aucun compte actif pour sauvegarder les données.");
  }

  const comptes = chargerComptes();
  const compte = comptes.find(function (compteLocal) {
    return compteLocal.id === identifiantCompteActif;
  });
  if (!compte) {
    throw new Error("Le compte actif est introuvable dans les sauvegardes locales.");
  }

  compte.donnees = donnees;
  sauvegarderComptes(comptes);
}
