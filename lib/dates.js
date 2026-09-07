// Petits utilitaires pour manipuler des dates "simples" (juste AAAA-MM-JJ,
// sans heure ni fuseau horaire) afin d'eviter les bugs de decalage horaire.
// On utilise Date.UTC() partout pour que le calcul ne depende jamais du
// fuseau horaire de la machine qui execute le code.

const NOMS_JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const NOMS_MOIS = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre',
];

// Aujourd'hui, au format AAAA-MM-JJ.
function aujourdhui() {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

// Ajoute `n` jours a une date AAAA-MM-JJ et renvoie le resultat au meme format.
function ajouterJours(jourISO, n) {
  const [y, m, d] = jourISO.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return toISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function toISO(annee, mois, jour) {
  const mm = String(mois).padStart(2, '0');
  const jj = String(jour).padStart(2, '0');
  return `${annee}-${mm}-${jj}`;
}

// Liste tous les jours entre deux dates AAAA-MM-JJ (bornes incluses).
function listeDesJours(dateDebutISO, dateFinISO) {
  const jours = [];
  let courant = dateDebutISO;
  let garde = 0; // securite anti boucle infinie si les dates sont invalides
  while (courant <= dateFinISO && garde < 500) {
    jours.push(courant);
    courant = ajouterJours(courant, 1);
    garde += 1;
  }
  return jours;
}

// Formate une date AAAA-MM-JJ en "lun. 8 sept."
function formaterJourCourt(jourISO) {
  const [y, m, d] = jourISO.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const nomJour = NOMS_JOURS[date.getUTCDay()];
  const nomMois = NOMS_MOIS[m - 1].slice(0, 4) + '.';
  return `${nomJour} ${d} ${nomMois}`;
}

// Formate une date AAAA-MM-JJ en "lundi 8 septembre 2026"
function formaterJourLong(jourISO) {
  const [y, m, d] = jourISO.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const NOMS_JOURS_LONGS = [
    'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
  ];
  const nomJour = NOMS_JOURS_LONGS[date.getUTCDay()];
  return `${nomJour} ${d} ${NOMS_MOIS[m - 1]} ${y}`;
}

// Nom du mois (pour les entetes de section du calendrier), ex: "Septembre 2026"
function nomMoisAnnee(jourISO) {
  const [y, m] = jourISO.split('-').map(Number);
  const nom = NOMS_MOIS[m - 1];
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${y}`;
}

// Renvoie {jourSemaine, jourNombre} pour affichage compact dans une case du calendrier.
function formaterPourCase(jourISO) {
  const [y, m, d] = jourISO.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return {
    jourSemaine: NOMS_JOURS[date.getUTCDay()].replace('.', ''),
    jourNombre: d,
  };
}

// A partir d'une liste de jours (AAAA-MM-JJ), construit les infos d'affichage
// communes a tous les calendriers de l'app (case + entete de mois). Chaque
// route peut ensuite ajouter ses propres champs (heatmap, selection...).
function construireJoursAffiches(joursListe) {
  let dernierMoisAffiche = null;
  return joursListe.map((jour) => {
    const moisLabel = nomMoisAnnee(jour);
    const premierDuMois = moisLabel !== dernierMoisAffiche;
    dernierMoisAffiche = moisLabel;
    const { jourSemaine, jourNombre } = formaterPourCase(jour);
    return { jour, jourSemaine, jourNombre, moisLabel, premierDuMois };
  });
}

// Options d'heure pour les menus deroulants de creation (toutes les 30 min).
function genererOptionsHeure() {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const valeur = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const libelle = m === 0 ? `${h}h` : `${h}h${m}`;
      options.push({ valeur, libelle });
    }
  }
  return options;
}

// Formate "20:00" en "20h" ou "20:30" en "20h30".
function formaterHeure(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

// Formate une plage horaire facultative pour l'affichage : "20h", "20h - 23h30",
// "jusqu'a 23h30", ou null si aucune heure n'est definie.
function formaterPlageHeures(heureDebut, heureFin) {
  if (heureDebut && heureFin) return `${formaterHeure(heureDebut)} - ${formaterHeure(heureFin)}`;
  if (heureDebut) return `à partir de ${formaterHeure(heureDebut)}`;
  if (heureFin) return `jusqu'à ${formaterHeure(heureFin)}`;
  return null;
}

module.exports = {
  aujourdhui,
  ajouterJours,
  listeDesJours,
  formaterJourCourt,
  formaterJourLong,
  formaterPourCase,
  nomMoisAnnee,
  construireJoursAffiches,
  genererOptionsHeure,
  formaterHeure,
  formaterPlageHeures,
};
