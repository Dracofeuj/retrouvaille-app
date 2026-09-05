// Interactivite du formulaire de creation : bascule entre les deux modes, et
// selection des dates sur un vrai calendrier mensuel navigable (on peut
// avancer d'autant de mois qu'on veut, pour organiser un mariage annonce
// un an ou deux a l'avance par exemple) :
//  - "Je propose des dates" : on touche chaque jour qui interesse (multi-selection).
//  - "Calendrier ouvert" : on touche le premier jour puis le dernier jour de
//    la periode, comme pour choisir des dates de vol.

(function () {
  const champMode = document.getElementById('champ-mode');
  const boutonsMode = document.querySelectorAll('.bouton-mode');
  const etiquette = document.getElementById('etiquette-calendrier-creation');
  const grille = document.getElementById('calendrier-creation');
  const libelleMois = document.getElementById('libelle-mois-affiche');
  const boutonMoisPrecedent = document.getElementById('bouton-mois-precedent');
  const boutonMoisSuivant = document.getElementById('bouton-mois-suivant');
  const conteneurChampsCaches = document.getElementById('conteneur-champs-caches');
  const aujourdhui = document.getElementById('champ-aujourdhui').value; // "AAAA-MM-JJ"

  const NOMS_MOIS = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];

  const ETIQUETTES = {
    dates_precises: "Touche les jours qui t'intéressent. Ils passent en jaune.",
    calendrier_libre: 'Touche le premier jour, puis le dernier jour de la période (comme pour réserver un billet d\'avion).',
  };

  const [anneeAuj, moisAuj] = aujourdhui.split('-').map(Number);

  let mode = 'dates_precises';
  const joursSelectionnes = new Set(); // mode "dates_precises"
  let rangeDebut = null; // mode "calendrier_libre"
  let rangeFin = null;
  let moisAffiche = { annee: anneeAuj, mois: moisAuj }; // mois : 1 a 12

  function toISO(annee, mois, jour) {
    return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
  }

  // Nombre de jours dans un mois : le "jour 0" du mois suivant est le dernier
  // jour du mois courant. Date.UTC gere tout seul le changement d'annee.
  function joursDansLeMois(annee, mois) {
    return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  }

  // Position du 1er du mois dans la semaine, convention francaise (0 = lundi).
  function decalageDuPremierJour(annee, mois) {
    const jourJs = new Date(Date.UTC(annee, mois - 1, 1)).getUTCDay(); // 0 = dimanche
    return (jourJs + 6) % 7;
  }

  function reinitialiserSelection() {
    joursSelectionnes.clear();
    rangeDebut = null;
    rangeFin = null;
  }

  function estSelectionne(iso) {
    if (mode === 'dates_precises') return joursSelectionnes.has(iso);
    if (rangeDebut) return iso >= rangeDebut && iso <= (rangeFin || rangeDebut);
    return false;
  }

  function rendreCalendrier() {
    libelleMois.textContent = `${NOMS_MOIS[moisAffiche.mois - 1]} ${moisAffiche.annee}`;
    boutonMoisPrecedent.disabled = moisAffiche.annee === anneeAuj && moisAffiche.mois === moisAuj;

    grille.innerHTML = '';

    const decalage = decalageDuPremierJour(moisAffiche.annee, moisAffiche.mois);
    for (let i = 0; i < decalage; i++) {
      const caseVide = document.createElement('div');
      caseVide.className = 'case-jour-mois case-jour-mois-vide';
      grille.appendChild(caseVide);
    }

    const totalJours = joursDansLeMois(moisAffiche.annee, moisAffiche.mois);
    for (let jour = 1; jour <= totalJours; jour++) {
      const iso = toISO(moisAffiche.annee, moisAffiche.mois, jour);
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'case-jour-mois';
      bouton.textContent = String(jour);
      bouton.dataset.jour = iso;

      if (iso < aujourdhui) {
        bouton.classList.add('case-jour-mois-desactivee');
        bouton.disabled = true;
      } else if (estSelectionne(iso)) {
        bouton.classList.add('case-jour-mois-selectionnee');
      }

      grille.appendChild(bouton);
    }
  }

  function reconstruireChampsCaches() {
    conteneurChampsCaches.innerHTML = '';
    function ajouterChampCache(nom, valeur) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = nom;
      input.value = valeur;
      conteneurChampsCaches.appendChild(input);
    }

    if (mode === 'dates_precises') {
      joursSelectionnes.forEach((jour) => ajouterChampCache('dates', jour));
    } else if (rangeDebut) {
      ajouterChampCache('dateDebut', rangeDebut);
      ajouterChampCache('dateFin', rangeFin || rangeDebut);
    }
  }

  boutonsMode.forEach((bouton) => {
    bouton.addEventListener('click', () => {
      mode = bouton.dataset.mode;
      champMode.value = mode;
      boutonsMode.forEach((b) => b.classList.toggle('bouton-mode-actif', b === bouton));
      etiquette.textContent = ETIQUETTES[mode];
      reinitialiserSelection();
      rendreCalendrier();
      reconstruireChampsCaches();
    });
  });

  boutonMoisPrecedent.addEventListener('click', () => {
    moisAffiche = moisAffiche.mois === 1
      ? { annee: moisAffiche.annee - 1, mois: 12 }
      : { annee: moisAffiche.annee, mois: moisAffiche.mois - 1 };
    rendreCalendrier();
  });

  boutonMoisSuivant.addEventListener('click', () => {
    moisAffiche = moisAffiche.mois === 12
      ? { annee: moisAffiche.annee + 1, mois: 1 }
      : { annee: moisAffiche.annee, mois: moisAffiche.mois + 1 };
    rendreCalendrier();
  });

  grille.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('.case-jour-mois');
    if (!bouton || bouton.disabled || bouton.classList.contains('case-jour-mois-vide')) return;
    const jour = bouton.dataset.jour;

    if (mode === 'dates_precises') {
      if (joursSelectionnes.has(jour)) {
        joursSelectionnes.delete(jour);
      } else {
        joursSelectionnes.add(jour);
      }
    } else if (!rangeDebut || (rangeDebut && rangeFin)) {
      // premiere selection, ou une plage etait deja complete : on repart a zero
      rangeDebut = jour;
      rangeFin = null;
    } else if (jour < rangeDebut) {
      rangeFin = rangeDebut;
      rangeDebut = jour;
    } else {
      rangeFin = jour;
    }

    rendreCalendrier();
    reconstruireChampsCaches();
  });

  rendreCalendrier();
})();
