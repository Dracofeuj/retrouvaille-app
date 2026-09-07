// Compte, pour chaque option proposee (une date ou un lieu), combien de
// participants l'ont choisie. Le "meilleur" est simplement celui qui a le
// plus de votes (pas de calcul complique).
//
// `cles` est la liste des identifiants d'options (ex: les jours votables, ou
// les ids des lieux valides). `obtenirClesChoisies(participant)` renvoie, pour
// un participant donne, la liste des cles qu'il a choisies.

function compterVotes(cles, participants, obtenirClesChoisies) {
  const totalParticipants = participants.length;

  const compte = {};
  for (const cle of cles) {
    compte[cle] = 0;
  }
  for (const participant of participants) {
    for (const cle of obtenirClesChoisies(participant)) {
      if (compte[cle] !== undefined) {
        compte[cle] += 1;
      }
    }
  }

  const maxCompte = Math.max(0, ...Object.values(compte));

  const meilleuresCles = maxCompte > 0 ? cles.filter((cle) => compte[cle] === maxCompte) : [];

  return { compte, totalParticipants, maxCompte, meilleuresCles };
}

function calculerVotesDates(joursVotables, participants) {
  return compterVotes(joursVotables, participants, (p) => p.dispos.map((d) => d.jour));
}

function calculerVotesLieux(lieux, participants) {
  return compterVotes(
    lieux.map((l) => l.id),
    participants,
    (p) => p.votesLieu.map((v) => v.lieuProposeId)
  );
}

module.exports = { compterVotes, calculerVotesDates, calculerVotesLieux };
