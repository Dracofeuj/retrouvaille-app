// Point d'entree de l'application. Un seul fichier de routes pour rester
// simple : chaque route correspond a une page ou une action decrite dans
// le cahier des charges (creer une sortie, voter, voir le resultat, valider).

const express = require('express');
const prisma = require('./lib/db');
const semerDonneesDemo = require('./prisma/seed');
const {
  aujourdhui,
  listeDesJours,
  formaterJourLong,
  formaterJourCourt,
  construireJoursAffiches,
  genererOptionsHeure,
  formaterPlageHeures,
} = require('./lib/dates');
const { calculerVotesDates, calculerVotesLieux } = require('./lib/heatmap');
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

async function obtenirLieuxVotables(evenement) {
  return prisma.lieuPropose.findMany({
    where: { evenementId: evenement.id, statut: 'valide' },
    orderBy: { createdAt: 'asc' },
  });
}

function formatCompteVotes(n) {
  if (n === 0) return "Personne n'a encore voté";
  if (n === 1) return '1 a voté';
  return `${n} ont voté`;
}

// ---------- Page d'accueil : creer une sortie ----------

async function donneesAccueil(erreur) {
  const debutParDefaut = aujourdhui();
  const exemples = erreur ? [] : await prisma.evenement.findMany({ orderBy: { createdAt: 'asc' }, take: 2 });
  return { debutParDefaut, erreur, exemples, optionsHeure: genererOptionsHeure() };
}

app.get('/', async (req, res) => {
  res.render('accueil', await donneesAccueil(null));
});

app.post('/evenements', async (req, res) => {
  const titre = (req.body.titre || '').trim();
  const createurPrenom = (req.body.createurPrenom || '').trim();
  const mode = req.body.mode === 'calendrier_libre' ? 'calendrier_libre' : 'dates_precises';
  const heureDebut = /^\d{2}:\d{2}$/.test(req.body.heureDebut) ? req.body.heureDebut : null;
  const heureFin = /^\d{2}:\d{2}$/.test(req.body.heureFin) ? req.body.heureFin : null;

  const lieuxBruts = Array.isArray(req.body.lieux) ? req.body.lieux : req.body.lieux ? [req.body.lieux] : [];
  const nomsLieux = [...new Set(lieuxBruts.map((l) => l.trim()).filter(Boolean))];

  async function erreurCreation(message) {
    res.status(400).render('accueil', await donneesAccueil(message));
  }

  if (!titre) return erreurCreation('Merci de donner un titre a la sortie.');
  if (!createurPrenom) return erreurCreation('Merci d\'indiquer ton prenom.');

  let evenement;
  const lieuxProposesData = { create: nomsLieux.map((nom) => ({ nom, statut: 'valide', proposeParPrenom: createurPrenom })) };

  if (mode === 'calendrier_libre') {
    const dateDebut = req.body.dateDebut;
    const dateFin = req.body.dateFin;
    if (!dateDebut || !dateFin || dateFin < dateDebut) {
      return erreurCreation('Merci de choisir une periode valide (fin apres debut).');
    }

    evenement = await prisma.evenement.create({
      data: { titre, mode, createurPrenom, dateDebut, dateFin, heureDebut, heureFin, lieuxProposes: lieuxProposesData },
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
        heureDebut,
        heureFin,
        dateDebut: datesValides[0],
        dateFin: datesValides[datesValides.length - 1],
        datesProposees: {
          create: datesValides.map((jour) => ({ jour, statut: 'validee', proposeParPrenom: createurPrenom })),
        },
        lieuxProposes: lieuxProposesData,
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
  const lieuxValides = await obtenirLieuxVotables(evenement);

  const participants = await prisma.participant.findMany({
    where: { evenementId: evenement.id },
    include: { dispos: true, votesLieu: true },
    orderBy: { createdAt: 'asc' },
  });

  // Calendrier personnel (inchange) : sert a peindre ses dispos.
  const { compte, meilleuresCles: meilleursJours } = calculerVotesDates(joursPeriode, participants);
  const joursAffiches = construireJoursAffiches(joursPeriode).map((j) => ({
    ...j,
    libelleCourt: formaterJourCourt(j.jour),
    nombreDispos: compte[j.jour],
    estMeilleur: meilleursJours.includes(j.jour),
    estValide: evenement.jourValide === j.jour,
  }));

  // Vue de groupe : liste triee par nombre de votes decroissant. En
  // "calendrier_libre" la periode peut etre tres longue, donc on ne montre
  // que les jours ayant recu au moins un vote ; en "dates_precises" la liste
  // de depart est courte, on montre tout.
  const maxComptejours = Math.max(0, ...joursAffiches.map((j) => j.nombreDispos));
  const joursListe = joursAffiches
    .filter((j) => evenement.mode === 'dates_precises' || j.nombreDispos > 0)
    .map((j) => ({
      ...j,
      pourcentage: maxComptejours > 0 ? Math.round((j.nombreDispos / maxComptejours) * 100) : 0,
      compteTexte: formatCompteVotes(j.nombreDispos),
    }))
    .sort((a, b) => b.nombreDispos - a.nombreDispos || (a.jour < b.jour ? -1 : 1));
  const totalParticipants = participants.length;

  // Lieux : meme principe.
  const votesLieux = calculerVotesLieux(lieuxValides, participants);
  const maxCompteLieux = votesLieux.maxCompte;
  const lieuxListe = lieuxValides
    .map((l) => ({
      id: l.id,
      nom: l.nom,
      nombreVotes: votesLieux.compte[l.id],
      pourcentage: maxCompteLieux > 0 ? Math.round((votesLieux.compte[l.id] / maxCompteLieux) * 100) : 0,
      compteTexte: formatCompteVotes(votesLieux.compte[l.id]),
      estMeilleur: votesLieux.meilleuresCles.includes(l.id),
      estValide: evenement.lieuValideId === l.id,
    }))
    .sort((a, b) => b.nombreVotes - a.nombreVotes || a.nom.localeCompare(b.nom));

  const datesEnAttente =
    evenement.mode === 'dates_precises'
      ? await prisma.dateProposee.findMany({ where: { evenementId: evenement.id, statut: 'en_attente' }, orderBy: { createdAt: 'asc' } })
      : [];
  const lieuxEnAttente = await prisma.lieuPropose.findMany({
    where: { evenementId: evenement.id, statut: 'en_attente' },
    orderBy: { createdAt: 'asc' },
  });

  // Texte partage entre le bandeau permanent et l'animation de validation.
  let texteValidation = null;
  if (evenement.statut === 'confirme') {
    const lieuValide = evenement.lieuValideId ? lieuxListe.find((l) => l.id === evenement.lieuValideId) : null;
    texteValidation = `Rendez-vous le ${formaterJourLong(evenement.jourValide)}${lieuValide ? ` à ${lieuValide.nom}` : ''}`;
  }

  res.render('sortie', {
    evenement,
    estOrganisateur,
    joursAffiches,
    joursListe,
    lieuxListe,
    totalParticipants,
    participants,
    datesEnAttente,
    lieuxEnAttente,
    formaterJourLong,
    formatCompteVotes,
    texteValidation,
    plageHeures: formaterPlageHeures(evenement.heureDebut, evenement.heureFin),
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

// ---------- Voter pour un ou plusieurs lieux ----------
// Meme mecanique que /dispos, mais pour les lieux.

app.post('/e/:id/votes-lieu', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).json({ erreur: 'Sortie introuvable.' });

  const prenom = (req.body.prenom || '').trim();
  const lieuxChoisis = Array.isArray(req.body.lieux) ? req.body.lieux : [];

  if (!prenom) {
    return res.status(400).json({ erreur: 'Merci d\'indiquer un prenom.' });
  }

  const lieuxValides = new Set((await obtenirLieuxVotables(evenement)).map((l) => l.id));
  const lieuxFiltres = lieuxChoisis.filter((id) => lieuxValides.has(id));

  const participant = await prisma.participant.upsert({
    where: { evenementId_prenom: { evenementId: evenement.id, prenom } },
    create: { evenementId: evenement.id, prenom },
    update: {},
  });

  await prisma.voteLieu.deleteMany({ where: { participantId: participant.id } });
  if (lieuxFiltres.length > 0) {
    await prisma.voteLieu.createMany({
      data: lieuxFiltres.map((lieuProposeId) => ({ participantId: participant.id, lieuProposeId })),
    });
  }

  res.json({ ok: true });
});

app.get('/e/:id/votes-lieu/:prenom', async (req, res) => {
  const participant = await prisma.participant.findUnique({
    where: { evenementId_prenom: { evenementId: req.params.id, prenom: req.params.prenom } },
    include: { votesLieu: true },
  });
  res.json({ lieux: participant ? participant.votesLieu.map((v) => v.lieuProposeId) : [] });
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

// ---------- Contre-proposition de lieu (ouverte a tous) ----------

app.post('/e/:id/contre-proposition-lieu', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable.');

  const nom = (req.body.nom || '').trim();
  const prenom = (req.body.prenom || '').trim();
  if (!nom) return res.status(400).send('Merci de proposer un nom de lieu.');
  if (!prenom) return res.status(400).send('Merci d\'indiquer un prenom.');

  await prisma.lieuPropose.upsert({
    where: { evenementId_nom: { evenementId: evenement.id, nom } },
    create: { evenementId: evenement.id, nom, statut: 'en_attente', proposeParPrenom: prenom },
    update: {}, // le lieu existe deja (valide ou deja en attente) : on ne change rien
  });

  res.redirect(`/e/${evenement.id}`);
});

app.post('/e/:id/lieux-proposes/:lieuProposeId/accepter', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable.');
  if (!estOrganisateurPourEvenement(req, evenement)) {
    return res.status(403).send('Seul l\'organisateur peut accepter une contre-proposition.');
  }

  await prisma.lieuPropose.updateMany({
    where: { id: req.params.lieuProposeId, evenementId: evenement.id },
    data: { statut: 'valide' },
  });

  res.redirect(`/e/${evenement.id}`);
});

app.post('/e/:id/lieux-proposes/:lieuProposeId/refuser', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable.');
  if (!estOrganisateurPourEvenement(req, evenement)) {
    return res.status(403).send('Seul l\'organisateur peut refuser une contre-proposition.');
  }

  await prisma.lieuPropose.deleteMany({
    where: { id: req.params.lieuProposeId, evenementId: evenement.id },
  });

  res.redirect(`/e/${evenement.id}`);
});

// ---------- Valider la sortie (date + lieu, organisateur uniquement) ----------
// Une seule action qui verrouille le jour et, s'il y a des lieux proposes,
// le lieu retenu en meme temps. Passe la sortie a l'etat "confirme", ce qui
// declenche l'animation de validation cote client (voir public/js/animation-validation.js).

app.post('/e/:id/valider-sortie', async (req, res) => {
  const evenement = await prisma.evenement.findUnique({ where: { id: req.params.id } });
  if (!evenement) return res.status(404).send('Sortie introuvable.');
  if (!estOrganisateurPourEvenement(req, evenement)) {
    return res.status(403).send('Seul l\'organisateur peut valider la sortie.');
  }

  const jour = req.body.jour;
  const joursValides = new Set(await obtenirJoursVotables(evenement));
  if (!jour || !joursValides.has(jour)) {
    return res.status(400).send('Jour invalide.');
  }

  const lieuxVotables = await obtenirLieuxVotables(evenement);
  let lieuValideId = null;
  if (lieuxVotables.length > 0) {
    const lieuxValides = new Set(lieuxVotables.map((l) => l.id));
    if (!req.body.lieuId || !lieuxValides.has(req.body.lieuId)) {
      return res.status(400).send('Lieu invalide.');
    }
    lieuValideId = req.body.lieuId;
  }

  await prisma.evenement.update({
    where: { id: evenement.id },
    data: { statut: 'confirme', jourValide: jour, lieuValideId },
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
