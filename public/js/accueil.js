// Interactivite du formulaire de creation : bascule entre les deux modes, et
// selection des dates directement sur un calendrier (au lieu de champs de
// date a remplir a la main) :
//  - "Je propose des dates" : on touche chaque jour qui interesse (multi-selection).
//  - "Calendrier ouvert" : on touche le premier jour puis le dernier jour de
//    la periode, comme pour choisir des dates de vol.

(function () {
  const champMode = document.getElementById('champ-mode');
  const boutonsMode = document.querySelectorAll('.bouton-mode');
  const etiquette = document.getElementById('etiquette-calendrier-creation');
  const calendrier = document.getElementById('calendrier-creation');
  const conteneurChampsCaches = document.getElementById('conteneur-champs-caches');

  const ETIQUETTES = {
    dates_precises: "Touche les jours qui t'intéressent. Ils passent en jaune.",
    calendrier_libre: 'Touche le premier jour, puis le dernier jour de la période (comme pour réserver un billet d\'avion).',
  };

  let mode = 'dates_precises';
  const joursSelectionnes = new Set(); // mode "dates_precises"
  let rangeDebut = null; // mode "calendrier_libre"
  let rangeFin = null;

  function reinitialiserSelection() {
    joursSelectionnes.clear();
    rangeDebut = null;
    rangeFin = null;
  }

  function appliquerSelectionAuCalendrier() {
    calendrier.querySelectorAll('.case-jour').forEach((caseJour) => {
      const jour = caseJour.dataset.jour;
      let selectionne = false;
      if (mode === 'dates_precises') {
        selectionne = joursSelectionnes.has(jour);
      } else if (rangeDebut) {
        selectionne = jour >= rangeDebut && jour <= (rangeFin || rangeDebut);
      }
      caseJour.classList.toggle('case-jour-selectionnee', selectionne);
    });
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
      appliquerSelectionAuCalendrier();
      reconstruireChampsCaches();
    });
  });

  calendrier.addEventListener('click', (evenement) => {
    const caseJour = evenement.target.closest('.case-jour');
    if (!caseJour) return;
    const jour = caseJour.dataset.jour;

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
    } else {
      // un debut est deja choisi : ce clic fixe l'autre bout de la plage
      if (jour < rangeDebut) {
        rangeFin = rangeDebut;
        rangeDebut = jour;
      } else {
        rangeFin = jour;
      }
    }

    appliquerSelectionAuCalendrier();
    reconstruireChampsCaches();
  });
})();
