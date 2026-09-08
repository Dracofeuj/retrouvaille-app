// Upload de photos (chaque participant peut en ajouter, avec ou sans
// compte) et affichage plein ecran au clic sur une vignette.

(function () {
  const formulaire = document.getElementById('formulaire-photos');
  const champFichiers = document.getElementById('champ-fichiers-photos');
  const champPrenomPhotos = document.getElementById('champ-prenom-photos');
  const messageEtat = document.getElementById('message-etat-photos');
  const champPrenomPrincipal = document.getElementById('champ-prenom');

  if (formulaire) {
    champFichiers.addEventListener('change', () => {
      if (champFichiers.files.length === 0) return;

      const prenom = (champPrenomPrincipal ? champPrenomPrincipal.value : '').trim();
      if (!prenom) {
        messageEtat.textContent = 'Indique ton prénom dans "Mes disponibilités" avant d\'ajouter des photos.';
        messageEtat.classList.add('message-erreur');
        champFichiers.value = '';
        if (champPrenomPrincipal) champPrenomPrincipal.focus();
        return;
      }

      champPrenomPhotos.value = prenom;
      messageEtat.classList.remove('message-erreur');
      messageEtat.textContent = 'Envoi en cours...';
      formulaire.submit();
    });
  }

  const modalePhoto = document.getElementById('modale-photo');
  if (modalePhoto) {
    const image = document.getElementById('image-modale-photo');
    const boutonFermer = document.getElementById('bouton-fermer-modale-photo');

    document.querySelectorAll('.vignette-photo').forEach((vignette) => {
      vignette.addEventListener('click', () => {
        image.src = vignette.dataset.photoUrl;
        modalePhoto.hidden = false;
      });
    });

    function fermer() {
      modalePhoto.hidden = true;
      image.src = '';
    }
    boutonFermer.addEventListener('click', fermer);
    modalePhoto.addEventListener('click', (evenement) => {
      if (evenement.target === modalePhoto) fermer();
    });
  }
})();
