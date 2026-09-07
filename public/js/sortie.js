// Interactivite de la page "sortie" cote invite : peindre ses jours dispo et
// choisir ses lieux preferes, puis tout enregistrer en un seul geste.

(function () {
  const { evenementId, prenomOrganisateur } = window.DONNEES_SORTIE;
  const cleLocalStorage = `retrouvailles:prenom:${evenementId}`;

  const champPrenom = document.getElementById('champ-prenom');
  const calendrier = document.getElementById('calendrier-perso');
  const pilulesLieux = document.getElementById('pilules-lieux-perso');
  const boutonEnregistrer = document.getElementById('bouton-enregistrer');
  const messageEtat = document.getElementById('message-etat');

  const joursSelectionnes = new Set();
  const lieuxSelectionnes = new Set();

  function appliquerSelectionAuCalendrier() {
    calendrier.querySelectorAll('.case-jour').forEach((caseJour) => {
      const jour = caseJour.dataset.jour;
      caseJour.classList.toggle('case-jour-selectionnee', joursSelectionnes.has(jour));
    });
  }

  function appliquerSelectionAuxLieux() {
    if (!pilulesLieux) return;
    pilulesLieux.querySelectorAll('.pilule-lieu').forEach((pilule) => {
      pilule.classList.toggle('pilule-lieu-selectionnee', lieuxSelectionnes.has(pilule.dataset.lieu));
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

    if (pilulesLieux) {
      try {
        const reponseLieux = await fetch(`/e/${evenementId}/votes-lieu/${encodeURIComponent(prenom)}`);
        const donneesLieux = await reponseLieux.json();
        lieuxSelectionnes.clear();
        (donneesLieux.lieux || []).forEach((id) => lieuxSelectionnes.add(id));
        appliquerSelectionAuxLieux();
      } catch (erreur) {
        // Pas grave non plus.
      }
    }
  }

  // Au chargement : reprendre le prenom deja utilise sur ce navigateur pour
  // voter, sinon (si ce navigateur est reconnu comme celui de l'organisateur)
  // pre-remplir avec son prenom de createur.
  const prenomMemorise = window.localStorage.getItem(cleLocalStorage) || prenomOrganisateur;
  if (prenomMemorise) {
    champPrenom.value = prenomMemorise;
    chargerDisposExistantes(prenomMemorise);
  }

  // Si l'invite tape un prenom deja utilise (par lui ou quelqu'un d'autre sur
  // cet evenement), on retrouve ses jours/lieux deja enregistres.
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

  if (pilulesLieux) {
    pilulesLieux.addEventListener('click', (evenement) => {
      const pilule = evenement.target.closest('.pilule-lieu');
      if (!pilule) return;
      const id = pilule.dataset.lieu;
      if (lieuxSelectionnes.has(id)) {
        lieuxSelectionnes.delete(id);
      } else {
        lieuxSelectionnes.add(id);
      }
      appliquerSelectionAuxLieux();
    });
  }

  function verifierPrenomAvantEnvoi(champCachePrenomId, messageErreur) {
    const prenom = champPrenom.value.trim();
    if (!prenom) {
      messageEtat.textContent = messageErreur;
      messageEtat.classList.add('message-erreur');
      champPrenom.focus();
      return null;
    }
    if (champCachePrenomId) document.getElementById(champCachePrenomId).value = prenom;
    return prenom;
  }

  const formulaireContreProposition = document.getElementById('formulaire-contre-proposition');
  if (formulaireContreProposition) {
    formulaireContreProposition.addEventListener('submit', (evenementSubmit) => {
      if (!verifierPrenomAvantEnvoi('champ-prenom-contre-proposition', 'Indique ton prénom avant de proposer une date.')) {
        evenementSubmit.preventDefault();
      }
    });
  }

  const formulaireContrePropositionLieu = document.getElementById('formulaire-contre-proposition-lieu');
  if (formulaireContrePropositionLieu) {
    formulaireContrePropositionLieu.addEventListener('submit', (evenementSubmit) => {
      if (!verifierPrenomAvantEnvoi('champ-prenom-contre-proposition-lieu', 'Indique ton prénom avant de proposer un lieu.')) {
        evenementSubmit.preventDefault();
      }
    });
  }

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
      const requetes = [
        fetch(`/e/${evenementId}/dispos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prenom, jours: Array.from(joursSelectionnes) }),
        }),
      ];

      if (pilulesLieux) {
        requetes.push(
          fetch(`/e/${evenementId}/votes-lieu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prenom, lieux: Array.from(lieuxSelectionnes) }),
          })
        );
      }

      const reponses = await Promise.all(requetes);
      if (reponses.some((r) => !r.ok)) throw new Error('echec');

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
