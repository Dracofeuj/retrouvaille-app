// Petit helper partagé : copie un lien dans le presse-papier au clic.

async function copierTexte(texte, bouton) {
  try {
    await navigator.clipboard.writeText(texte);
  } catch (erreur) {
    // Si le presse-papier n'est pas disponible (vieux navigateur), on ne bloque pas.
  }
  const texteOriginal = bouton.textContent;
  bouton.textContent = 'Copié !';
  setTimeout(() => { bouton.textContent = texteOriginal; }, 1500);
}

document.querySelectorAll('.bouton-copier').forEach((bouton) => {
  bouton.addEventListener('click', () => {
    const champ = document.getElementById(bouton.dataset.cible);
    if (champ) copierTexte(champ.value, bouton);
  });
});

const boutonCopierPartage = document.getElementById('bouton-copier-partage');
if (boutonCopierPartage) {
  boutonCopierPartage.addEventListener('click', () => {
    copierTexte(boutonCopierPartage.dataset.lien, boutonCopierPartage);
  });
}
