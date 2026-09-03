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

// Renvoie une classe CSS d'intensite (0 a 4) selon la proportion de
// participants disponibles ce jour-la, pour la vue de groupe en ambre.
function niveauIntensite(nombreDispos, totalParticipants) {
  if (nombreDispos === 0 || totalParticipants === 0) return 0;
  const ratio = nombreDispos / totalParticipants;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

module.exports = { calculerHeatmap, niveauIntensite };
