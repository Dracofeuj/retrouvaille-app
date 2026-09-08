// Reconnaissance de l'organisateur d'une sortie, de deux facons possibles :
//  - via un compte : evenement.createurUserId === l'utilisateur connecte.
//  - via un cookie pose sur son navigateur au moment de la creation (marche
//    meme sans compte, mais seulement sur le meme appareil).
// Les deux cohabitent : un createur connecte qui change d'appareil retrouve
// son role grace au compte ; un createur sans compte le garde grace au cookie.

const { lireCookies, ecrireCookie } = require('./cookies');

const UN_AN_EN_SECONDES = 365 * 24 * 60 * 60;

function nomCookie(evenementId) {
  return `org_${evenementId}`;
}

function estOrganisateurPourEvenement(req, evenement, utilisateur) {
  if (utilisateur && evenement.createurUserId === utilisateur.id) return true;
  const cookies = lireCookies(req);
  return cookies[nomCookie(evenement.id)] === evenement.jetonCreateur;
}

function definirCookieOrganisateur(res, evenement) {
  ecrireCookie(res, nomCookie(evenement.id), evenement.jetonCreateur, {
    maxAge: UN_AN_EN_SECONDES,
    path: `/e/${evenement.id}`,
  });
}

module.exports = { estOrganisateurPourEvenement, definirCookieOrganisateur };
