// Cree deux sorties de demonstration (une par mode) avec quelques votes deja
// remplis, pour qu'on voie tout de suite un resultat a l'ouverture de l'app.
// Ne fait rien si des sorties existent deja (pour ne pas dupliquer a chaque
// demarrage du serveur).

const prisma = require('../lib/db');
const { aujourdhui, ajouterJours } = require('../lib/dates');

async function semerDonneesDemo() {
  const nombreEvenements = await prisma.evenement.count();
  if (nombreEvenements > 0) {
    return; // deja des donnees, on ne touche a rien
  }

  const debut = aujourdhui();

  // ----- Demo 1 : mode "calendrier ouvert" (comme la toute premiere version) -----
  const finCalendrier = ajouterJours(debut, 27); // 4 semaines
  const evenementCalendrier = await prisma.evenement.create({
    data: {
      titre: 'Dispo pour un verre ? (exemple calendrier ouvert)',
      mode: 'calendrier_libre',
      createurPrenom: 'Camille',
      dateDebut: debut,
      dateFin: finCalendrier,
      heureDebut: '20:00',
      lieuxProposes: {
        create: [
          { nom: 'Chez Papa', statut: 'valide', proposeParPrenom: 'Camille' },
          { nom: 'La Locanda', statut: 'valide', proposeParPrenom: 'Camille' },
        ],
      },
    },
    include: { lieuxProposes: true },
  });
  const [lieuChezPapa, lieuLocanda] = evenementCalendrier.lieuxProposes;

  const j3 = ajouterJours(debut, 3);
  const j4 = ajouterJours(debut, 4);
  const j5 = ajouterJours(debut, 5);
  const j10 = ajouterJours(debut, 10);
  const j11 = ajouterJours(debut, 11);

  for (const vote of [
    { prenom: 'Alex', jours: [j3, j4, j10], lieux: [lieuChezPapa.id] },
    { prenom: 'Camille', jours: [j4, j5, j10, j11], lieux: [lieuChezPapa.id, lieuLocanda.id] },
    { prenom: 'Sacha', jours: [j4, j10], lieux: [lieuChezPapa.id] },
  ]) {
    await prisma.participant.create({
      data: {
        evenementId: evenementCalendrier.id,
        prenom: vote.prenom,
        dispos: { create: vote.jours.map((jour) => ({ jour })) },
        votesLieu: { create: vote.lieux.map((lieuProposeId) => ({ lieuProposeId })) },
      },
    });
  }

  // ----- Demo 2 : mode "dates precises", avec une contre-proposition en attente -----
  const d1 = ajouterJours(debut, 12);
  const d2 = ajouterJours(debut, 17);
  const d3 = ajouterJours(debut, 27);
  const dContreProposition = ajouterJours(debut, 32);

  const evenementDatesPrecises = await prisma.evenement.create({
    data: {
      titre: 'Repas de rentree (exemple dates precises)',
      mode: 'dates_precises',
      createurPrenom: 'Maxence',
      dateDebut: d1,
      dateFin: d3,
      heureDebut: '19:30',
      heureFin: '23:00',
      datesProposees: {
        create: [
          { jour: d1, statut: 'validee' },
          { jour: d2, statut: 'validee' },
          { jour: d3, statut: 'validee' },
          { jour: dContreProposition, statut: 'en_attente', proposeParPrenom: 'Jacques' },
        ],
      },
      lieuxProposes: {
        create: [
          { nom: 'Restaurant Chez Papa', statut: 'valide', proposeParPrenom: 'Maxence' },
          { nom: 'Restaurant La Locanda', statut: 'en_attente', proposeParPrenom: 'Jacques' },
        ],
      },
    },
    include: { lieuxProposes: true },
  });
  const [lieuChezPapaResto] = evenementDatesPrecises.lieuxProposes.filter((l) => l.statut === 'valide');

  for (const vote of [
    { prenom: 'Maxence', jours: [d1, d2, d3], lieux: [lieuChezPapaResto.id] },
    { prenom: 'Alex', jours: [d2, d3], lieux: [lieuChezPapaResto.id] },
  ]) {
    await prisma.participant.create({
      data: {
        evenementId: evenementDatesPrecises.id,
        prenom: vote.prenom,
        dispos: { create: vote.jours.map((jour) => ({ jour })) },
        votesLieu: { create: vote.lieux.map((lieuProposeId) => ({ lieuProposeId })) },
      },
    });
  }

  console.log('Donnees de demo creees :');
  console.log(`  Calendrier ouvert : /e/${evenementCalendrier.id}`);
  console.log(`  Dates precises    : /e/${evenementDatesPrecises.id}`);
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
