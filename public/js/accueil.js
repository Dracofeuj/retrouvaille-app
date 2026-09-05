// Interactivite du formulaire de creation : bascule entre les deux modes,
// et ajout/suppression de dates en mode "Je propose des dates".

(function () {
  const champMode = document.getElementById('champ-mode');
  const boutonsMode = document.querySelectorAll('.bouton-mode');
  const sectionDatesPrecises = document.getElementById('section-dates-precises');
  const sectionCalendrierLibre = document.getElementById('section-calendrier-libre');
  const listeDates = document.getElementById('liste-dates');
  const boutonAjouterDate = document.getElementById('bouton-ajouter-date');

  boutonsMode.forEach((bouton) => {
    bouton.addEventListener('click', () => {
      const mode = bouton.dataset.mode;
      champMode.value = mode;
      boutonsMode.forEach((b) => b.classList.toggle('bouton-mode-actif', b === bouton));
      sectionDatesPrecises.hidden = mode !== 'dates_precises';
      sectionCalendrierLibre.hidden = mode !== 'calendrier_libre';
    });
  });

  boutonAjouterDate.addEventListener('click', () => {
    const ligne = document.createElement('label');
    ligne.className = 'champ champ-date-precise';
    ligne.innerHTML = `
      <span>Date</span>
      <span class="ligne-date-avec-suppression">
        <input type="date" name="dates" />
        <button type="button" class="bouton-supprimer-date" aria-label="Supprimer cette date">&times;</button>
      </span>
    `;
    listeDates.appendChild(ligne);
  });

  listeDates.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('.bouton-supprimer-date');
    if (!bouton) return;
    const ligne = bouton.closest('.champ-date-precise');
    // On garde toujours au moins une ligne de date visible.
    if (listeDates.querySelectorAll('.champ-date-precise').length > 1) {
      ligne.remove();
    }
  });
})();
