// Reconnaissance du createur d'une sortie sur son propre appareil, sans
// compte ni deuxieme lien : on pose un petit cookie au moment de la
// creation, et on le compare au jeton secret de l'evenement a chaque visite.
//
// Limite assumee : ca ne marche que sur le meme navigateur/appareil. La
// reconnaissance fiable partout viendra avec les comptes (tranche suivante) ;
// ce jour-la, `estOrganisateurPourEvenement` pourra aussi verifier une
// session utilisateur (ex: `evenement.createurUserId === req.session.userId`)
// en plus du cookie, sans rien changer aux appels existants.

const UN_AN_EN_SECONDES = 365 * 24 * 60 * 60;

function nomCookie(evenementId) {
  return `org_${evenementId}`;
}

function lireCookies(req) {
  const entete = req.headers.cookie;
  if (!entete) return {};
  const cookies = {};
  entete.split(';').forEach((partie) => {
    const separateur = partie.indexOf('=');
    if (separateur === -1) return;
    const cle = partie.slice(0, separateur).trim();
    const valeur = partie.slice(separateur + 1).trim();
    if (cle) cookies[cle] = decodeURIComponent(valeur);
  });
  return cookies;
}

function estOrganisateurPourEvenement(req, evenement) {
  const cookies = lireCookies(req);
  return cookies[nomCookie(evenement.id)] === evenement.jetonCreateur;
}

function definirCookieOrganisateur(res, evenement) {
  const valeur = encodeURIComponent(evenement.jetonCreateur);
  res.setHeader(
    'Set-Cookie',
    `${nomCookie(evenement.id)}=${valeur}; Max-Age=${UN_AN_EN_SECONDES}; Path=/e/${evenement.id}; HttpOnly; SameSite=Lax`
  );
}

module.exports = { estOrganisateurPourEvenement, definirCookieOrganisateur };
