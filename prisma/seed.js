// Cree une sortie de demonstration avec quelques votes deja remplis, pour
// qu'on voie tout de suite un resultat a l'ouverture de l'app.
// Ne fait rien si une sortie existe deja (pour ne pas dupliquer a chaque
// demarrage du serveur).

const prisma = require('../lib/db');
const { aujourdhui, ajouterJours } = require('../lib/dates');

async function semerDonneesDemo() {
  const nombreEvenements = await prisma.evenement.count();
  if (nombreEvenements > 0) {
    return; // deja des donnees, on ne touche a rien
  }

  const debut = aujourdhui();
  const fin = ajouterJours(debut, 27); // 4 semaines

  const evenement = await prisma.evenement.create({
    data: {
      titre: 'Dispo pour un verre ? (exemple)',
      dateDebut: debut,
      dateFin: fin,
    },
  });

  // Quelques jours types dans la periode, pour repartir les votes de demo.
  const j3 = ajouterJours(debut, 3);
  const j4 = ajouterJours(debut, 4);
  const j5 = ajouterJours(debut, 5);
  const j10 = ajouterJours(debut, 10);
  const j11 = ajouterJours(debut, 11);

  const votes = [
    { prenom: 'Alex', jours: [j3, j4, j10] },
    { prenom: 'Camille', jours: [j4, j5, j10, j11] },
    { prenom: 'Sacha', jours: [j4, j10] },
  ];

  for (const vote of votes) {
    await prisma.participant.create({
      data: {
        evenementId: evenement.id,
        prenom: vote.prenom,
        dispos: {
          create: vote.jours.map((jour) => ({ jour })),
        },
      },
    });
  }

  console.log('Donnees de demo creees :');
  console.log(`  Lien de partage   : /e/${evenement.id}`);
  console.log(`  Lien organisateur : /o/${evenement.jetonOrganisateur}`);
}

module.exports = semerDonneesDemo;

// Permet aussi de lancer ce fichier directement avec `node prisma/seed.js`.
if (require.main === module) {
  semerDonneesDemo()
    .then(() => prisma.$disconnect())
    .catch(async (erreur) => {
      console.error(erreur);
      await prisma.$disconnect();
      process.exit(1);
    });
}
