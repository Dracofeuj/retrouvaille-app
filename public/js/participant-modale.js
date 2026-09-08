// Fiche mini-profil qui s'ouvre au clic sur le prenom d'un participant, avec
// la possibilite de l'ajouter a un cercle (voir server.js, routes
// /mes-cercles et /e/:id/participants/:id/ajouter-cercle).

(function () {
  const { evenementId, utilisateurConnecte } = window.DONNEES_SORTIE;

  const modale = document.getElementById('modale-participant');
  if (!modale) return;

  const titrePrenom = document.getElementById('modale-participant-prenom');
  const blocConnexionRequise = document.getElementById('modale-participant-connecte-requis');
  const lienConnexion = document.getElementById('lien-connexion-depuis-modale');
  const blocAjoutCercle = document.getElementById('modale-participant-ajout-cercle');
  const selectCercle = document.getElementById('select-cercle-modale');
  const champNouveauCercle = document.getElementById('champ-nouveau-cercle-modale');
  const boutonConfirmer = document.getElementById('bouton-confirmer-ajout-cercle');
  const messageEtat = document.getElementById('message-etat-modale');
  const boutonFermer = document.getElementById('bouton-fermer-modale-participant');

  let participantIdCourant = null;

  function fermerModale() {
    modale.hidden = true;
  }

  async function chargerMesCercles() {
    selectCercle.innerHTML = '<option value="">Choisis un cercle...</option><option value="__nouveau__">+ Créer un nouveau cercle</option>';
    try {
      const reponse = await fetch('/mes-cercles');
      if (!reponse.ok) return;
      const donnees = await reponse.json();
      (donnees.cercles || []).forEach((c) => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.nom;
        selectCercle.insertBefore(option, selectCercle.lastElementChild);
      });
    } catch (erreur) {
      // Pas grave : le select restera limite a "creer un nouveau cercle".
    }
  }

  document.body.addEventListener('click', async (evenement) => {
    const pilule = evenement.target.closest('.pilule-participant');
    if (!pilule) return;

    participantIdCourant = pilule.dataset.participantId;
    messageEtat.textContent = '';
    messageEtat.classList.remove('message-erreur');
    blocConnexionRequise.hidden = true;
    blocAjoutCercle.hidden = true;
    titrePrenom.textContent = '...';
    modale.hidden = false;

    const reponse = await fetch(`/e/${evenementId}/participants/${participantIdCourant}`);
    const infos = await reponse.json();
    titrePrenom.textContent = infos.prenom || '';

    if (!utilisateurConnecte) {
      lienConnexion.href = `/connexion?retour=${encodeURIComponent(window.location.pathname)}`;
      blocConnexionRequise.hidden = false;
      return;
    }

    blocAjoutCercle.hidden = false;
    champNouveauCercle.hidden = true;
    selectCercle.value = '';
    await chargerMesCercles();
  });

  selectCercle.addEventListener('change', () => {
    champNouveauCercle.hidden = selectCercle.value !== '__nouveau__';
  });

  boutonConfirmer.addEventListener('click', async () => {
    const valeur = selectCercle.value;
    if (!valeur) {
      messageEtat.textContent = 'Choisis un cercle.';
      messageEtat.classList.add('message-erreur');
      return;
    }
    if (valeur === '__nouveau__' && !champNouveauCercle.value.trim()) {
      messageEtat.textContent = 'Donne un nom au nouveau cercle.';
      messageEtat.classList.add('message-erreur');
      return;
    }

    boutonConfirmer.disabled = true;
    messageEtat.classList.remove('message-erreur');
    messageEtat.textContent = 'Ajout en cours...';

    const corps = valeur === '__nouveau__' ? { nouveauCercleNom: champNouveauCercle.value.trim() } : { cercleId: valeur };

    try {
      const reponse = await fetch(`/e/${evenementId}/participants/${participantIdCourant}/ajouter-cercle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corps),
      });
      const resultat = await reponse.json();
      if (!reponse.ok) throw new Error(resultat.erreur || 'echec');

      if (resultat.ajoute) {
        messageEtat.textContent = `Ajouté à "${resultat.cercleNom}" !`;
      } else {
        messageEtat.innerHTML = `Cette personne n'a pas de compte : partage-lui ce lien pour rejoindre "${resultat.cercleNom}" :<br><code>${resultat.lienInvitation}</code>`;
      }
    } catch (erreur) {
      messageEtat.textContent = "Oups, quelque chose n'a pas marché.";
      messageEtat.classList.add('message-erreur');
    } finally {
      boutonConfirmer.disabled = false;
    }
  });

  boutonFermer.addEventListener('click', fermerModale);
  modale.addEventListener('click', (evenement) => {
    if (evenement.target === modale) fermerModale();
  });
})();
