// Calcule, pour chaque jour de la periode, combien de participants sont
// disponibles. Le "meilleur jour" est simplement celui qui a le plus de
// disponibilites (pas de calcul complique).

function calculerHeatmap(joursPeriode, participants) {
  const totalParticipants = participants.length;

  // compte[jour] = nombre de participants disponibles ce jour-la
  const compte = {};
  for (const jour of joursPeriode) {
    compte[jour] = 0;
  }
  for (const participant of participants) {
    for (const dispo of participant.dispos) {
      if (compte[dispo.jour] !== undefined) {
        compte[dispo.jour] += 1;
      }
    }
  }

  const maxCompte = Math.max(0, ...Object.values(compte));

  const meilleursJours =
    maxCompte > 0
      ? joursPeriode.filter((jour) => compte[jour] === maxCompte)
      : [];

  return { compte, totalParticipants, maxCompte, meilleursJours };
}

// Renvoie un palier d'intensite (0 a 5) selon la proportion de dispos de ce
// jour par rapport au jour le plus vote (pas par rapport au nombre total
// d'inscrits) : le ou les jours au maximum sont donc toujours au palier le
// plus fonce, meme si peu de monde a repondu au total.
function niveauIntensite(nombreDispos, maxCompte) {
  if (nombreDispos === 0 || maxCompte === 0) return 0;
  const ratio = nombreDispos / maxCompte;
  if (ratio <= 0.2) return 1;
  if (ratio <= 0.4) return 2;
  if (ratio <= 0.6) return 3;
  if (ratio <= 0.8) return 4;
  return 5;
}

module.exports = { calculerHeatmap, niveauIntensite };
