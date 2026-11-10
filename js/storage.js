/**
 * Module de persistance et de gestion des comptes utilisateurs locaux.
 * Gère le stockage sécurisé dans le localStorage, le hachage des mots de passe (PBKDF2)
 * et le cloisonnement des données de tâches par compte.
 */

// Clés de stockage dans le localStorage
const CLE_STOCKAGE = "taskflow";           // Ancienne clé pour les données hors-compte (legacy)
const CLE_COMPTES = "taskflow_comptes";    // Clé stockant la liste des comptes et leurs données

// Identifiant unique du compte actuellement connecté (en mémoire de session)
let identifiantCompteActif = null;

/**
 * Retourne la structure initiale vide pour un nouveau profil utilisateur.
 * 
 * @returns {Object} Un jeu de données par défaut (tâches vides, catégories vides, filtre actif).
 */
function donneesVides() {
  return {
    taches: [],
    categories: [],
    filtreActif: "toutes"
  };
}

/**
 * Récupère la liste de tous les comptes enregistrés dans le localStorage.
 * 
 * @returns {Array<Object>} Le tableau des comptes utilisateurs locaux.
 * @throws {Error} Si le format des données stockées est altéré ou corrompu.
 */
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

/**
 * Récupère les données existantes de l'ancienne version sans authentification (migration legacy).
 * 
 * @returns {Object} Les anciennes données de l'application ou une structure vide si rien n'existait.
 * @throws {Error} Si la sauvegarde existante est corrompue.
 */
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

/**
 * Convertit un tableau d'octets binaires en une chaîne encodée en Base64.
 * 
 * @param {Uint8Array} octets - Le tampon binaire à convertir.
 * @returns {string} La représentation textuelle en Base64.
 */
function convertirEnBase64(octets) {
  let binaire = "";
  octets.forEach(function (octet) {
    binaire += String.fromCharCode(octet);
  });
  return btoa(binaire);
}

/**
 * Calcule l'empreinte cryptographique d'un mot de passe à l'aide de l'algorithme PBKDF2 (SHA-256).
 * Utilise l'API Web Crypto du navigateur avec 310 000 itérations et un sel cryptographique aléatoire.
 * 
 * @param {string} motDePasse - Le mot de passe en clair saisi par l'utilisateur.
 * @param {Uint8Array} sel - Le sel cryptographique unique associé au compte.
 * @returns {Promise<string>} L'empreinte sécurisée au format Base64.
 * @throws {Error} Si les API de cryptographie Web Crypto ne sont pas supportées par le navigateur.
 */
async function empreinteMotDePasse(motDePasse, sel) {
  if (!crypto.subtle) {
    throw new Error("Le chiffrement requis n’est pas disponible dans ce navigateur.");
  }

  // Importation de la clé brute à partir du mot de passe
  const cle = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(motDePasse),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  // Dérivation de 256 bits avec PBKDF2, 310 000 itérations et SHA-256
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: sel,
    iterations: 310000,
    hash: "SHA-256"
  }, cle, 256);

  return convertirEnBase64(new Uint8Array(bits));
}

/**
 * Sauvegarde la liste complète des comptes locaux dans le localStorage.
 * 
 * @param {Array<Object>} comptes - Le tableau des comptes à sérialiser en JSON.
 */
function sauvegarderComptes(comptes) {
  localStorage.setItem(CLE_COMPTES, JSON.stringify(comptes));
}

/**
 * Crée un nouveau compte utilisateur avec identifiant et mot de passe sécurisé.
 * Effectue les vérifications de validation (taille, unicité), génère un sel aléatoire de 16 octets,
 * calcule l'empreinte et associe les données de départ (ou importe les données legacy existantes).
 * 
 * @param {string} identifiant - Le pseudonyme choisi pour le compte.
 * @param {string} motDePasse - Le mot de passe associé.
 * @param {Object} sauvegarde - Les données initiales de tâches à attacher au compte.
 * @returns {Promise<Object>} L'objet compte nouvellement créé.
 * @throws {Error} Si les contraintes de format ou d'unicité ne sont pas respectées.
 */
async function creerCompte(identifiant, motDePasse, sauvegarde) {
  const identifiantNormalise = identifiant.trim().toLocaleLowerCase("fr");

  // Règles de validation des champs
  if (identifiantNormalise.length < 3) {
    throw new Error("Le nom d’utilisateur doit contenir au moins 3 caractères.");
  }
  if (motDePasse.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }

  // Vérification de l'unicité de l'identifiant
  const comptes = chargerComptes();
  if (comptes.some(function (compte) {
    return compte.identifiantNormalise === identifiantNormalise;
  })) {
    throw new Error("Ce nom d’utilisateur est déjà utilisé sur cet appareil.");
  }

  // Génération d'un sel cryptographique aléatoire de 16 octets
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const compte = {
    id: crypto.randomUUID(),
    identifiant: identifiant.trim(),
    identifiantNormalise: identifiantNormalise,
    sel: convertirEnBase64(sel),
    empreinte: await empreinteMotDePasse(motDePasse, sel),
    donnees: sauvegarde
  };

  // Enregistrement et nettoyage de l'ancienne clé legacy
  comptes.push(compte);
  sauvegarderComptes(comptes);
  localStorage.removeItem(CLE_STOCKAGE);

  return compte;
}

/**
 * Authentifie un utilisateur en vérifiant son identifiant et son mot de passe.
 * Recalcule l'empreinte avec le sel stocké pour la comparer à l'empreinte enregistrée.
 * 
 * @param {string} identifiant - Le nom d'utilisateur saisi.
 * @param {string} motDePasse - Le mot de passe saisi.
 * @returns {Promise<Object>} L'objet compte correspondant en cas de succès.
 * @throws {Error} Si l'identifiant est introuvable ou si le mot de passe est erroné.
 */
async function connecterCompte(identifiant, motDePasse) {
  const identifiantNormalise = identifiant.trim().toLocaleLowerCase("fr");
  if (!identifiantNormalise) {
    throw new Error("Nom d’utilisateur ou mot de passe incorrect.");
  }

  // Recherche du compte correspondant à l'identifiant normalisé
  const compte = chargerComptes().find(function (compteLocal) {
    return compteLocal.identifiantNormalise === identifiantNormalise;
  });
  if (!compte) {
    throw new Error("Nom d’utilisateur ou mot de passe incorrect.");
  }

  // Reconstitution du sel binaire depuis le Base64
  const sel = Uint8Array.from(atob(compte.sel), function (caractere) {
    return caractere.charCodeAt(0);
  });

  // Calcul et vérification de l'empreinte PBKDF2
  const empreinte = await empreinteMotDePasse(motDePasse, sel);
  if (empreinte !== compte.empreinte) {
    throw new Error("Nom d’utilisateur ou mot de passe incorrect.");
  }

  return compte;
}

/**
 * Définit en mémoire l'identifiant du compte utilisateur actuellement actif pour la session.
 * 
 * @param {string|null} identifiant - L'identifiant UUID du compte ou null lors de la déconnexion.
 */
function definirCompteActif(identifiant) {
  identifiantCompteActif = identifiant;
}

/**
 * Récupère le jeu de données (tâches, catégories) propre à un compte donné.
 * 
 * @param {string} identifiant - L'identifiant unique UUID du compte.
 * @returns {Object} L'objet de données du compte utilisateur.
 * @throws {Error} Si le compte est introuvable ou si les données sont invalides.
 */
function chargerDonnees(identifiant) {
  const compte = chargerComptes().find(function (compteLocal) {
    return compteLocal.id === identifiant;
  });
  if (!compte || !compte.donnees || !Array.isArray(compte.donnees.taches)) {
    throw new Error("La sauvegarde de ce compte est introuvable ou invalide.");
  }
  return compte.donnees;
}

/**
 * Sauvegarde les données fournies (tâches, catégories) dans le compte utilisateur actif.
 * 
 * @param {Object} donnees - Le jeu complet de données à enregistrer pour le compte actif.
 * @throws {Error} Si aucun compte n'est actif ou si le compte actif n'est pas trouvé.
 */
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
