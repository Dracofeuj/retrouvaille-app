// Stockage des photos. Pour l'instant : disque local, dans public/uploads/,
// servi directement en fichier statique par Express.
//
// Limite assumee : sur un hebergeur sans disque persistant (ex: Render en
// plan gratuit), ces fichiers disparaissent au redemarrage/redeploiement,
// comme le reste des donnees tant qu'on n'est pas passe a un stockage objet
// (ex: Cloudinary). Pour brancher ca plus tard, il suffit de remplacer le
// contenu de `enregistrerPhoto` par un upload vers ce service et de renvoyer
// l'URL qu'il donne en retour - le reste de l'app (route, vue galerie) ne
// change pas, puisqu'il ne manipule que l'URL finale.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DOSSIER_UPLOADS = path.join(__dirname, '..', 'public', 'uploads');

function assurerDossierUploads() {
  fs.mkdirSync(DOSSIER_UPLOADS, { recursive: true });
}

// Enregistre un fichier (Buffer, venant de multer en memoire) sur le disque
// et renvoie l'URL publique a stocker en base.
async function enregistrerPhoto(fichier) {
  assurerDossierUploads();
  const extension = path.extname(fichier.originalname).toLowerCase() || '.jpg';
  const nomFichier = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`;
  fs.writeFileSync(path.join(DOSSIER_UPLOADS, nomFichier), fichier.buffer);
  return `/uploads/${nomFichier}`;
}

module.exports = { enregistrerPhoto };
