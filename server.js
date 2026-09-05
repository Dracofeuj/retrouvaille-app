// Point d'entree de l'application. Un seul fichier de routes pour rester
// simple : chaque route correspond a une page ou une action decrite dans
// le cahier des charges (creer une sortie, voter, voir le resultat, valider).

const express = require('express');
const prisma = require('./lib/db');
const semerDonneesDemo = require('./prisma/seed');
const { aujourdhui, ajouterJours, listeDesJours, formaterJourLong, formaterJourCourt, formaterPourCase, nomMoisAnnee } = require('./lib/dates');
const { calculerHeatmap, niveauIntensite } = require('./lib/heatmap');
const { estOrganisateurPourEvenement, definirCookieOrganisateur } = require('./lib/organisateur');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: false })); // formulaires HTML classiques
app.use(express.json()); // requetes AJAX (enregistrer les dispos)

// Renvoie la liste des jours sur lesquels on peut voter pour une sortie :
// soit les dates precises validees (mode "dates_precises"), soit tous les
// jours de la periode (mode "calendrier_libre"). Utilise partout ou on a
// besoin de cette liste, pour ne jamais avoir deux logiques qui divergent.
async function obtenirJoursVotables(evenement) {
  if (evenement.mode === 'dates_precises') {
    const datesValidees = await prisma.dateProposee.findMany({
      where: { evenementId: evenement.id, statut: 'validee' },
      orderBy: { jour: 'asc' },
    });
    return datesValidees.map((d) => d.jour);
  }
  return listeDesJours(evenement.dateDebut, evenement.dateFin);
}

// ---------- Page d'accueil : creer une sortie ----------

app.get('/', async (req, res) => {
  const debutParDefaut = aujourdhui();
  const finParDefaut = ajouterJours(debutParDefaut, 27); // 4 semaines
  const exemples = await prisma.evenement.findMany({ orderBy: { createdAt: 'asc' }, take: 2 });
  res.render('accueil', { debutParDefaut, finParDefaut, erreur: null, exemples });
});

app.post('/evenements', async (req, res) => {
  const titre = (req.body.titre || '').trim();
  const createurPrenom = (req.body.createurPrenom || '').trim();
  const mode = req.body.mode === 'calendrier_libre' ? 'calendrier_libre' : 'dates_precises';

  function erreurCreation(message) {
    const debutParDefaut = aujourdhui();
    const finParDefaut = ajouterJours(debutParDefaut, 27);
    return res.status(400).render('accueil', { debutParDefaut, finParDefaut, erreur: message, exemples: [] });
  }

  if (!titre) return erreurCreation('Merci de donner un titre a la sortie.');
  if (!createurPrenom) return erreurCreation('Merci d\'indiquer ton prenom.');

  let evenement;

  if (mode === 'calendrier_libre') {
    const dateDebut = req.body.dateDebut;
    const dateFin = req.body.dateFin;
    if (!dateDebut || !dateFin || dateFin < dateDebut) {
      return erreurCreation('Merci de choisir une periode valide (fin apres debut).');
    }

    evenement = await prisma.evenement.create({
      data: { titre, mode, createurPrenom, dateDebut, dateFin },
    });
  } else {
    // mode === 'dates_precises' : une ou plusieurs dates saisies a la main
    const datesBrutes = Array.isArray(req.body.dates) ? req.body.dates : req.body.dates ? [req.body.dates] : [];
    const datesValides = [...new Set(datesBrutes.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();

    if (datesValides.length === 0) {
      return erreurCreation('Merci de proposer au moins une date.');
    }

    evenement = await prisma.evenement.create({
      data: {
        titre,
        mode,
        createurPrenom,
        dateDebut: datesValides[0],
        dateFin: datesValides[datesValides.length - 1],
        datesProposees: {
          create: datesValides.map((jour) => ({ jour, statut: 'validee', proposeParPrenom: createurPrenom })),
        },
      },
    });
  }

  // Pose le cookie qui reconnaitra ce navigateur comme celui de l'organisateur.
  definirCookieOrganisateur(res, evenement);
  res.redirect(`/creation-reussie/${evenement.id}`);
});

app.get('/creation-reussie/:id', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable.');

  res.render('creation-reussie', {
    lienPartage: `${req.protocol}://${req.get('host')}/e/${evenement.id}`,
  });
});

// ---------- Page d'une sortie (vote + vue de groupe) ----------
// Un seul lien pour tout le monde : le createur est reconnu automatiquement
// comme organisateur sur son propre appareil grace a un cookie pose a la
// creation (voir lib/organisateur.js).

app.get('/e/:id', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable. Verifie le lien.');

  const estOrganisateur = estOrganisateurPourEvenement(req, evenement);
  const joursPeriode = await obtenirJoursVotables(evenement);
  const participants = await prisma.participant.findMany({
    where: { evenementId: evenement.id },
    include: { dispos: true },
    orderBy: { createdAt: 'asc' },
  });

  const { compte, totalParticipants, maxCompte, meilleursJours } = calculerHeatmap(joursPeriode, participants);

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
      intensite: niveauIntensite(compte[jour], maxCompte),
      estMeilleur: meilleursJours.includes(jour),
      estValide: evenement.jourValide === jour,
      moisLabel,
      premierDuMois,
    };
  });

  const datesEnAttente =
    evenement.mode === 'dates_precises'
      ? await prisma.dateProposee.findMany({
          where: { evenementId: evenement.id, statut: 'en_attente' },
          orderBy: { createdAt: 'asc' },
        })
      : [];

  res.render('sortie', {
    evenement,
    estOrganisateur,
    joursAffiches,
    totalParticipants,
    participants,
    datesEnAttente,
    formaterJourLong,
    lienPartage: `${req.protocol}://${req.get('host')}/e/${evenement.id}`,
  });
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

  const joursValides = new Set(await obtenirJoursVotables(evenement));
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

// ---------- Contre-proposition (mode "dates_precises" uniquement) ----------
// Un invite propose une date en plus de celles de depart. Elle arrive
// "en_attente" : seul l'organisateur la voit et peut l'accepter ou la refuser.

app.post('/e/:id/contre-proposition', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable.');
  if (evenement.mode !== 'dates_precises') {
    return res.status(400).send('Cette sortie ne permet pas de contre-proposition.');
  }

  const jour = req.body.jour;
  const prenom = (req.body.prenom || '').trim();
  if (!jour || !/^\d{4}-\d{2}-\d{2}$/.test(jour)) return res.status(400).send('Date invalide.');
  if (!prenom) return res.status(400).send('Merci d\'indiquer un prenom.');

  await prisma.dateProposee.upsert({
    where: { evenementId_jour: { evenementId: evenement.id, jour } },
    create: { evenementId: evenement.id, jour, statut: 'en_attente', proposeParPrenom: prenom },
    update: {}, // la date existe deja (validee ou deja en attente) : on ne change rien
  });

  res.redirect(`/e/${evenement.id}`);
});

app.post('/e/:id/dates-proposees/:dateProposeeId/accepter', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable.');
  if (!estOrganisateurPourEvenement(req, evenement)) {
    return res.status(403).send('Seul l\'organisateur peut accepter une contre-proposition.');
  }

  await prisma.dateProposee.updateMany({
    where: { id: req.params.dateProposeeId, evenementId: evenement.id },
    data: { statut: 'validee' },
  });

  res.redirect(`/e/${evenement.id}`);
});

app.post('/e/:id/dates-proposees/:dateProposeeId/refuser', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable.');
  if (!estOrganisateurPourEvenement(req, evenement)) {
    return res.status(403).send('Seul l\'organisateur peut refuser une contre-proposition.');
  }

  await prisma.dateProposee.deleteMany({
    where: { id: req.params.dateProposeeId, evenementId: evenement.id },
  });

  res.redirect(`/e/${evenement.id}`);
});

// ---------- Valider le jour retenu (organisateur uniquement) ----------

app.post('/e/:id/valider', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable.');
  if (!estOrganisateurPourEvenement(req, evenement)) {
    return res.status(403).send('Seul l\'organisateur peut valider le jour retenu.');
  }

  const jour = req.body.jour;
  const joursValides = new Set(await obtenirJoursVotables(evenement));
  if (!jour || !joursValides.has(jour)) {
    return res.status(400).send('Jour invalide.');
  }

  await prisma.evenement.update({
    where: { id: evenement.id },
    data: { statut: 'confirme', jourValide: jour },
  });

  res.redirect(`/e/${evenement.id}`);
});

// ---------- Demarrage ----------

async function demarrer() {
  await semerDonneesDemo();
  app.listen(PORT, () => {
    console.log(`Retrouvailles app disponible sur http://localhost:${PORT}`);
  });
}

demarrer();
