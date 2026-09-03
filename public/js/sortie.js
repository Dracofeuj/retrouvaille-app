// Interactivite de la page "sortie" cote invite : peindre ses jours dispo
// et les enregistrer, sans jamais recharger la page pour ca.

(function () {
  const { evenementId } = window.DONNEES_SORTIE;
  const cleLocalStorage = `retrouvailles:prenom:${evenementId}`;

  const champPrenom = document.getElementById('champ-prenom');
  const calendrier = document.getElementById('calendrier-perso');
  const boutonEnregistrer = document.getElementById('bouton-enregistrer');
  const messageEtat = document.getElementById('message-etat');

  const joursSelectionnes = new Set();

  function appliquerSelectionAuCalendrier() {
    calendrier.querySelectorAll('.case-jour').forEach((caseJour) => {
      const jour = caseJour.dataset.jour;
      caseJour.classList.toggle('case-jour-selectionnee', joursSelectionnes.has(jour));
    });
  }

  async function chargerDisposExistantes(prenom) {
    if (!prenom) return;
    try {
      const reponse = await fetch(`/e/${evenementId}/dispos/${encodeURIComponent(prenom)}`);
      const donnees = await reponse.json();
      joursSelectionnes.clear();
      (donnees.jours || []).forEach((jour) => joursSelectionnes.add(jour));
      appliquerSelectionAuCalendrier();
    } catch (erreur) {
      // Pas grave si ca echoue : l'invite peut quand meme peindre ses jours.
    }
  }

  // Au chargement : reprendre le prenom deja utilise sur ce navigateur, s'il y en a un.
  const prenomMemorise = window.localStorage.getItem(cleLocalStorage);
  if (prenomMemorise) {
    champPrenom.value = prenomMemorise;
    chargerDisposExistantes(prenomMemorise);
  }

  // Si l'invite tape un prenom deja utilise (par lui ou quelqu'un d'autre sur
  // cet evenement), on retrouve ses jours deja enregistres.
  champPrenom.addEventListener('blur', () => {
    const prenom = champPrenom.value.trim();
    if (prenom) chargerDisposExistantes(prenom);
  });

  calendrier.addEventListener('click', (evenement) => {
    const caseJour = evenement.target.closest('.case-jour');
    if (!caseJour) return;
    const jour = caseJour.dataset.jour;
    if (joursSelectionnes.has(jour)) {
      joursSelectionnes.delete(jour);
    } else {
      joursSelectionnes.add(jour);
    }
    appliquerSelectionAuCalendrier();
  });

  boutonEnregistrer.addEventListener('click', async () => {
    const prenom = champPrenom.value.trim();
    if (!prenom) {
      messageEtat.textContent = 'Indique ton prénom avant d\'enregistrer.';
      messageEtat.classList.add('message-erreur');
      champPrenom.focus();
      return;
    }

    boutonEnregistrer.disabled = true;
    messageEtat.classList.remove('message-erreur');
    messageEtat.textContent = 'Enregistrement...';

    try {
      const reponse = await fetch(`/e/${evenementId}/dispos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom, jours: Array.from(joursSelectionnes) }),
      });
      if (!reponse.ok) throw new Error('echec');

      window.localStorage.setItem(cleLocalStorage, prenom);
      messageEtat.textContent = 'Enregistré ! Mise à jour de la vue du groupe...';
      setTimeout(() => window.location.reload(), 700);
    } catch (erreur) {
      boutonEnregistrer.disabled = false;
      messageEtat.textContent = 'Oups, l\'enregistrement a échoué. Réessaie.';
      messageEtat.classList.add('message-erreur');
    }
  });
})();
