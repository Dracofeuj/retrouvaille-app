// Connexion par code a usage unique envoye par email, sans mot de passe.
//
// Mode test actuel : au lieu d'envoyer un vrai email, le code est renvoye
// directement a l'ecran (voir server.js, route POST /connexion/code). Pour
// brancher un vrai envoi d'email plus tard, il suffit de remplacer l'appel a
// `genererEtEnregistrerCode` par un envoi via un prestataire (ex: Resend) au
// lieu de retourner le code en clair au routeur - le reste (verification,
// creation de session) ne change pas.

const prisma = require('./db');
const { lireCookies, ecrireCookie } = require('./cookies');

const DUREE_CODE_MINUTES = 10;
const DUREE_SESSION_JOURS = 30;
const NOM_COOKIE_SESSION = 'session';

function genererCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 chiffres
}

async function genererEtEnregistrerCode(email) {
  const code = genererCode();
  const expireA = new Date(Date.now() + DUREE_CODE_MINUTES * 60 * 1000);
  await prisma.codeConnexion.create({ data: { email, code, expireA } });
  return code;
}

// Verifie le code, cree le compte s'il n'existe pas encore (connexion et
// inscription sont le meme geste), ouvre une session et pose le cookie.
async function verifierCodeEtConnecter(res, email, code) {
  const demande = await prisma.codeConnexion.findFirst({
    where: { email, code, utilise: false, expireA: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!demande) return null;

  await prisma.codeConnexion.update({ where: { id: demande.id }, data: { utilise: true } });

  const utilisateur = await prisma.user.upsert({
    where: { email },
    create: { email },
    update: {},
  });

  const expireA = new Date(Date.now() + DUREE_SESSION_JOURS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({ data: { userId: utilisateur.id, expireA } });

  ecrireCookie(res, NOM_COOKIE_SESSION, session.id, { maxAge: DUREE_SESSION_JOURS * 24 * 60 * 60 });

  return utilisateur;
}

async function obtenirUtilisateurConnecte(req) {
  const cookies = lireCookies(req);
  const sessionId = cookies[NOM_COOKIE_SESSION];
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (!session || session.expireA < new Date()) return null;

  return session.user;
}

async function deconnecter(req, res) {
  const cookies = lireCookies(req);
  const sessionId = cookies[NOM_COOKIE_SESSION];
  if (sessionId) {
    await prisma.session.deleteMany({ where: { id: sessionId } });
  }
  ecrireCookie(res, NOM_COOKIE_SESSION, '', { maxAge: 0 });
}

module.exports = {
  genererEtEnregistrerCode,
  verifierCodeEtConnecter,
  obtenirUtilisateurConnecte,
  deconnecter,
};
