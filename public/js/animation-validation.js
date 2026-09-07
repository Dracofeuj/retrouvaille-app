// Anime "C'est valide !" en plein ecran, avec un petit feu d'artifice de
// confettis, la premiere fois qu'on ouvre le lien d'une sortie confirmee. Ne
// se rejoue plus ensuite pour cette meme sortie sur cet appareil (on retient
// ca dans le localStorage du navigateur).

(function () {
  const { evenementId, estConfirme, texteValidation } = window.DONNEES_SORTIE;
  if (!estConfirme || !texteValidation) return;

  const cleVu = `retrouvailles:vu-validation:${evenementId}`;
  let dejaVu = false;
  try {
    dejaVu = window.localStorage.getItem(cleVu) === '1';
  } catch (erreur) {
    // Pas de localStorage disponible : tant pis, on ne bloque pas l'affichage
    // mais on ne pourra pas non plus se souvenir pour la prochaine fois.
  }
  if (dejaVu) return;

  const COULEURS = ['#6ee07a', '#f5c84c', '#e9ebf0', '#4dd0e1'];

  const overlay = document.createElement('div');
  overlay.className = 'overlay-validation';

  const canvas = document.createElement('canvas');
  canvas.className = 'overlay-validation-canvas';
  overlay.appendChild(canvas);

  const titre = document.createElement('p');
  titre.className = 'overlay-validation-titre';
  titre.textContent = "C'est validé ! 🎉";
  overlay.appendChild(titre);

  const texte = document.createElement('p');
  texte.className = 'overlay-validation-texte';
  texte.textContent = texteValidation;
  overlay.appendChild(texte);

  const astuce = document.createElement('p');
  astuce.className = 'overlay-validation-astuce';
  astuce.textContent = "Touche l'écran pour continuer";
  overlay.appendChild(astuce);

  document.body.appendChild(overlay);
  const debordementOriginal = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const ctx = canvas.getContext('2d');
  let largeur = 0;
  let hauteur = 0;

  function ajusterTaille() {
    largeur = canvas.width = window.innerWidth;
    hauteur = canvas.height = window.innerHeight;
  }
  ajusterTaille();
  window.addEventListener('resize', ajusterTaille);

  const particules = [];
  for (let i = 0; i < 140; i++) {
    particules.push({
      x: Math.random() * largeur,
      y: -20 - Math.random() * hauteur * 0.6,
      taille: 4 + Math.random() * 5,
      vitesseY: 2 + Math.random() * 3,
      vitesseX: (Math.random() - 0.5) * 2,
      rotation: Math.random() * Math.PI * 2,
      vitesseRotation: (Math.random() - 0.5) * 0.2,
      couleur: COULEURS[Math.floor(Math.random() * COULEURS.length)],
    });
  }

  let animationEnCours = true;
  function dessiner() {
    if (!animationEnCours) return;
    ctx.clearRect(0, 0, largeur, hauteur);
    particules.forEach((p) => {
      p.x += p.vitesseX;
      p.y += p.vitesseY;
      p.rotation += p.vitesseRotation;
      if (p.y > hauteur + 20) {
        p.y = -20;
        p.x = Math.random() * largeur;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.couleur;
      ctx.fillRect(-p.taille / 2, -p.taille / 4, p.taille, p.taille / 2);
      ctx.restore();
    });
    requestAnimationFrame(dessiner);
  }
  dessiner();

  function marquerCommeVu() {
    try {
      window.localStorage.setItem(cleVu, '1');
    } catch (erreur) {
      // Tant pis : l'animation pourra se rejouer une prochaine fois.
    }
  }

  let dejaFerme = false;
  function fermer() {
    if (dejaFerme) return;
    dejaFerme = true;
    animationEnCours = false;
    window.removeEventListener('resize', ajusterTaille);
    marquerCommeVu();
    overlay.classList.add('overlay-validation-sortie');
    document.body.style.overflow = debordementOriginal;
    setTimeout(() => overlay.remove(), 300);
  }

  overlay.addEventListener('click', fermer);
  setTimeout(fermer, 2800);
})();
