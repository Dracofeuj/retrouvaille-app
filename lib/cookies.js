// Lecture/ecriture de cookies, partagee par lib/organisateur.js (cookie
// "org_<id>") et lib/auth.js (cookie "session"). On ecrit avec res.append
// plutot que res.setHeader pour ne jamais ecraser un autre cookie deja pose
// sur la meme reponse.

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

function ecrireCookie(res, nom, valeur, options = {}) {
  const morceaux = [`${nom}=${encodeURIComponent(valeur)}`];
  if (options.maxAge !== undefined) morceaux.push(`Max-Age=${options.maxAge}`);
  morceaux.push(`Path=${options.path || '/'}`);
  morceaux.push('HttpOnly');
  morceaux.push('SameSite=Lax');
  res.append('Set-Cookie', morceaux.join('; '));
}

module.exports = { lireCookies, ecrireCookie };
