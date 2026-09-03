// Point d'entree de l'application. Un seul fichier de routes pour rester
// simple : chaque route correspond a une page ou une action decrite dans
// le cahier des charges (creer une sortie, voter, voir le resultat, valider).

const express = require('express');
const prisma = require('./lib/db');
const semerDonneesDemo = require('./prisma/seed');
const { aujourdhui, ajouterJours, listeDesJours, formaterJourLong, formaterJourCourt, formaterPourCase, nomMoisAnnee } = require('./lib/dates');
const { calculerHeatmap, niveauIntensite } = require('./lib/heatmap');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: false })); // formulaires HTML classiques
app.use(express.json()); // requetes AJAX (enregistrer les dispos)

// ---------- Page d'accueil : creer une sortie ----------

app.get('/', async (req, res) => {
  const debutParDefaut = aujourdhui();
  const finParDefaut = ajouterJours(debutParDefaut, 27); // 4 semaines
  const exemple = await prisma.evenement.findFirst({ orderBy: { createdAt: 'asc' } });
  res.render('accueil', { debutParDefaut, finParDefaut, erreur: null, idExemple: exemple ? exemple.id : null });
});

app.post('/evenements', async (req, res) => {
  const titre = (req.body.titre || '').trim();
  const dateDebut = req.body.dateDebut;
  const dateFin = req.body.dateFin;

  if (!titre || !dateDebut || !dateFin || dateFin < dateDebut) {
    const debutParDefaut = aujourdhui();
    const finParDefaut = ajouterJours(debutParDefaut, 27);
    return res.status(400).render('accueil', {
      debutParDefaut,
      finParDefaut,
      erreur: 'Merci de remplir un titre et une periode valide (fin apres debut).',
    });
  }

  const evenement = await prisma.evenement.create({
    data: { titre, dateDebut, dateFin },
  });

  res.redirect(`/creation-reussie/${evenement.id}`);
});

app.get('/creation-reussie/:id', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable.');

  res.render('creation-reussie', {
    lienPartage: `${req.protocol}://${req.get('host')}/e/${evenement.id}`,
    lienOrganisateur: `${req.protocol}://${req.get('host')}/o/${evenement.jetonOrganisateur}`,
  });
});

// ---------- Page d'une sortie (vote + vue de groupe) ----------
// Accessible via le lien de partage (invite) ou le lien organisateur
// (memes infos + bouton de validation en plus).

async function chargerEtAfficherEvenement(req, res, evenement, estOrganisateur) {
  const joursPeriode = listeDesJours(evenement.dateDebut, evenement.dateFin);
  const participants = await prisma.participant.findMany({
    where: { evenementId: evenement.id },
    include: { dispos: true },
    orderBy: { createdAt: 'asc' },
  });

  const { compte, totalParticipants, meilleursJours } = calculerHeatmap(joursPeriode, participants);

  let dernierMoisAffiche = null;
  const joursAffiches = joursPeriode.map((jour) => {
    const moisLabel = nomMoisAnnee(jour);
    const premierDuMois = moisLabel !== dernierMoisAffiche;
    dernierMoisAffiche = moisLabel;
    const { jourSemaine, jourNombre } = formaterPourCase(jour);
    return {
      jour,
      libelleCourt: formaterJourCourt(jour),
      jourSemaine,
      jourNombre,
      nombreDispos: compte[jour],
      intensite: niveauIntensite(compte[jour], totalParticipants),
      estMeilleur: meilleursJours.includes(jour),
      estValide: evenement.jourValide === jour,
      moisLabel,
      premierDuMois,
    };
  });

  res.render('sortie', {
    evenement,
    estOrganisateur,
    joursAffiches,
    totalParticipants,
    participants,
    formaterJourLong,
    lienPartage: `${req.protocol}://${req.get('host')}/e/${evenement.id}`,
  });
}

app.get('/e/:id', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable. Verifie le lien.');
  await chargerEtAfficherEvenement(req, res, evenement, false);
});

app.get('/o/:jeton', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { jetonOrganisateur: req.params.jeton } });
  if (!evenement) return res.status(404).send('Lien organisateur invalide.');
  await chargerEtAfficherEvenement(req, res, evenement, true);
});

// ---------- Enregistrer les disponibilites d'un participant ----------
// Appele en AJAX depuis la page de la sortie. On remplace entierement la
// liste des jours du participant (plus simple et sans risque d'incoherence).

app.post('/e/:id/dispos', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).json({ erreur: 'Sortie introuvable.' });

  const prenom = (req.body.prenom || '').trim();
  const jours = Array.isArray(req.body.jours) ? req.body.jours : [];

  if (!prenom) {
    return res.status(400).json({ erreur: 'Merci d\'indiquer un prenom.' });
  }

  const joursValides = new Set(listeDesJours(evenement.dateDebut, evenement.dateFin));
  const joursFiltres = jours.filter((jour) => joursValides.has(jour));

  const participant = await prisma.participant.upsert({
    where: { evenementId_prenom: { evenementId: evenement.id, prenom } },
    create: { evenementId: evenement.id, prenom },
    update: {},
  });

  await prisma.dispo.deleteMany({ where: { participantId: participant.id } });
  if (joursFiltres.length > 0) {
    await prisma.dispo.createMany({
      data: joursFiltres.map((jour) => ({ participantId: participant.id, jour })),
    });
  }

  res.json({ ok: true });
});

// Recupere les jours deja enregistres pour un prenom donne (pour pre-remplir
// le calendrier si l'invite revient plus tard modifier ses dispos).
app.get('/e/:id/dispos/:prenom', async (req, res) => {
  const participant = await prisma.participant.findUnique({
    where: {
      evenementId_prenom: { evenementId: req.params.id, prenom: req.params.prenom },
    },
    include: { dispos: true },
  });
  res.json({ jours: participant ? participant.dispos.map((d) => d.jour) : [] });
});

// ---------- Valider le jour retenu (organisateur uniquement) ----------

app.post('/o/:jeton/valider', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { jetonOrganisateur: req.params.jeton } });
  if (!evenement) return res.status(404).send('Lien organisateur invalide.');

  const jour = req.body.jour;
  const joursValides = new Set(listeDesJours(evenement.dateDebut, evenement.dateFin));
  if (!jour || !joursValides.has(jour)) {
    return res.status(400).send('Jour invalide.');
  }

  await prisma.evenement.update({
    where: { id: evenement.id },
    data: { statut: 'confirme', jourValide: jour },
  });

  res.redirect(`/o/${req.params.jeton}`);
});

// ---------- Demarrage ----------

async function demarrer() {
  await semerDonneesDemo();
  app.listen(PORT, () => {
    console.log(`Retrouvailles app disponible sur http://localhost:${PORT}`);
  });
}

demarrer();
