# Retrouvailles — boucle de vote

Application web pour caler une sortie entre amis : un organisateur propose
une sortie (des dates précises, ou un calendrier ouvert), avec une heure et
un ou plusieurs lieux facultatifs ; chacun vote ses disponibilités et ses
lieux préférés, le meilleur ressort tout seul dans une liste triée,
l'organisateur valide. Un compte est facultatif (connexion par code email,
sans mot de passe) : sans compte, tout marche pareil via un lien unique par
sortie ; avec un compte, un tableau de bord regroupe ses sorties à
venir/passées. Design neumorphique sombre (surfaces embossées, accent vert).

Cette version couvre la boucle de vote (créer une sortie dans l'un des deux
modes avec heure/lieu, voter, contre-proposer une date ou un lieu, voir le
résultat, valider) et une première version des comptes (connexion par code,
tableau de bord, navigation par onglets). Les groupes ("Cercle") sont
présents dans la navigation mais pas encore construits — écran "Bientôt
disponible" pour l'instant. Voir `CONTEXTE-PRODUIT.md` pour la vision
complète.

## Lancer le projet en local

Il faut [Node.js](https://nodejs.org/) installé (version 18 ou plus récente).

**La toute première fois** :

```bash
npm install
```

**À chaque fois qu'on veut lancer l'app** (une seule commande) :

```bash
npm start
```

Puis ouvrir **http://localhost:3000** dans le navigateur.

Ce que fait `npm start` automatiquement, sans rien à faire de plus :
- crée le fichier de base de données SQLite s'il n'existe pas encore (`prisma/dev.db`)
- met la structure de la base à jour si le schéma a changé
- remplit une sortie de démonstration avec quelques votes, si la base est vide
- démarre le serveur web

Pour arrêter le serveur : `Ctrl + C` dans le terminal où il tourne.

## Structure du projet

```
server.js              routes de l'application (une route = une page ou une action)
prisma/schema.prisma    structure de la base de données
prisma/seed.js          creation des donnees de demonstration
lib/dates.js            manipulation des dates (format AAAA-MM-JJ, sans fuseau horaire)
lib/heatmap.js          comptage des votes (dates et lieux) et calcul du "meilleur"
lib/organisateur.js     reconnaissance de l'organisateur (compte ou cookie)
lib/auth.js             connexion par code email, sessions
lib/cookies.js          lecture/ecriture de cookies (partage par organisateur.js et auth.js)
lib/db.js               connexion a la base de donnees (Prisma)
views/                  pages HTML (moteur de template EJS)
views/partials/nav-bas.ejs  navigation en bas d'ecran (3 onglets)
public/css/style.css    tout le style visuel
public/js/              interactivite cote navigateur (peindre les jours, copier un lien, formulaire de creation)
```

## Modèle de données

- **Evenement** : titre, `mode` (`dates_precises` ou `calendrier_libre`),
  période (`dateDebut`/`dateFin`), `heureDebut`/`heureFin` (facultatives),
  statut (`en_cours`/`confirme`), `jourValide`, `lieuValideId`,
  `createurPrenom`, et `jetonCreateur` (comparé au cookie posé sur le
  navigateur du créateur pour le reconnaître comme organisateur).
- **Participant** : un prénom rattaché à un événement (un invité, sans compte).
- **Dispo** : un jour où un participant a dit être disponible.
- **DateProposee** : utilisée seulement en mode `dates_precises` — une date
  avec un statut (`validee` ou `en_attente`) et qui l'a proposée
  (`proposeParPrenom`). Les dates de départ sont `validee` d'emblée ; une
  contre-proposition d'invité arrive `en_attente` jusqu'à ce que
  l'organisateur l'accepte.
- **LieuPropose** : un lieu proposé (`statut` `valide`/`en_attente`,
  `proposeParPrenom`), même logique que `DateProposee`.
- **VoteLieu** : un lieu qu'un participant approuve (équivalent de `Dispo`
  pour les lieux).

Le meilleur jour/lieu = celui qui a le plus de votes. La validation du jour
et celle du lieu sont indépendantes : on peut confirmer l'un sans l'autre.
La vue de groupe (`views/sortie.ejs` + partial `views/partials/ligne-vote.ejs`)
affiche une liste triée par nombre de votes décroissant, avec une barre de
remplissage proportionnelle — voir `lib/heatmap.js` pour le comptage.

Toutes les dates sont stockées comme de simples chaînes `AAAA-MM-JJ`, et les
heures comme `HH:MM` (pas de type datetime avec fuseau), pour éviter les
décalages selon le fuseau horaire du visiteur ou du serveur.

## Lien unique et reconnaissance de l'organisateur

Il n'y a qu'un seul lien par sortie (`/e/:id`). Deux façons d'être reconnu
comme organisateur, qui cohabitent (`lib/organisateur.js`) :
- **Avec un compte** : `evenement.createurUserId` est comparé à
  l'utilisateur connecté (fonctionne sur n'importe quel appareil).
- **Sans compte** : un cookie (`org_<id>`, invisible, "HttpOnly") est posé
  sur le navigateur du créateur au moment de la création, et compare au
  `jetonCreateur` de l'événement à chaque visite. Ne marche que sur le même
  appareil/navigateur.

## Comptes et connexion

Connexion par code à usage unique envoyé par email, sans mot de passe
(`lib/auth.js`) : un email crée ou retrouve un `User`, un `CodeConnexion` à
6 chiffres est généré (10 min de validité), sa vérification ouvre une
`Session` (30 jours) dont l'id est stocké dans un cookie `session`.

**Mode test actuel** : au lieu d'envoyer un vrai email, le code est affiché
directement à l'écran (bandeau "Mode test" sur la page `/connexion/code`).
Pour brancher un vrai envoi d'email, remplacer l'appel à
`genererEtEnregistrerCode` dans la route `POST /connexion/code` par un envoi
via un prestataire (ex: [Resend](https://resend.com)) au lieu de renvoyer le
code en clair à la vue — le reste (vérification, session) ne change pas.

Les boutons "Continuer avec Google/Apple" sont désactivés (`disabled`) en
attendant que ces intégrations OAuth soient mises en place — Google demande
une configuration Google Cloud Console (gratuite), Apple un compte
développeur payant (99$/an).

Un participant qui vote (ou un créateur qui crée une sortie) alors qu'il est
connecté voit son `userId` rattaché (`Participant.userId` /
`Evenement.createurUserId`), ce qui fait apparaître la sortie dans son
tableau de bord (`/`, vue `tableau-de-bord.ejs`) — sans rien changer pour
quelqu'un qui n'est pas connecté.

## Navigation

Trois onglets fixés en bas d'écran (`views/partials/nav-bas.ejs`, inclus par
`partials/foot.ejs`) : **Accueil** (`/`, tableau de bord ou écran invité),
**Événement** (`/nouvelle-sortie`, création — accessible sans compte), et
**Cercle** (`/cercle`, groupes — nécessite un compte, redirige vers
`/connexion` sinon). La nav est masquée sur les écrans de connexion via le
local `cacherNav` passé explicitement par chaque route dans `server.js` (ne
jamais l'assigner directement dans un template EJS : avec `with(locals)`,
une assignation sur une variable absente des locals fuit en variable globale
Node et contaminerait les autres requêtes du même processus).

## Passer de SQLite à PostgreSQL plus tard

Le code n'a aucune dépendance directe à SQLite (tout passe par Prisma). Pour
migrer :

1. Changer `provider = "sqlite"` en `provider = "postgresql"` dans `prisma/schema.prisma`.
2. Remplacer `DATABASE_URL` dans `.env` par l'adresse de la base PostgreSQL.
3. Relancer `npx prisma db push` (ou `npx prisma migrate dev` pour garder un historique de migrations).

Rien d'autre à changer dans le code de l'application.

## Reprendre le projet (pour un·e développeur·se)

- Le seul fichier de routes est `server.js` — chaque route est commentée et
  correspond à un écran ou une action du cahier des charges.
- Les calculs (dates, heatmap) sont isolés dans `lib/` pour rester faciles
  à tester séparément.
- Les pages (`views/*.ejs`) sont du HTML serveur classique, pas de framework
  frontend : la seule interactivité (peindre les jours, copier un lien) est
  dans `public/js/`, en JavaScript simple sans dépendance.
- Un "participant" reste identifié par son prénom sur un événement donné
  (`@@unique([evenementId, prenom])`) qu'il ait un compte ou non — le compte
  ne fait qu'ajouter un `userId` optionnel en plus, jamais une dépendance.
- L'onglet "Cercle" (groupes) est un écran "Bientôt disponible"
  (`views/cercle-bientot.ejs`) : le modèle de données pour les groupes n'a
  pas encore été construit. Voir `CONTEXTE-PRODUIT.md` pour la vision
  (cercles persistants, double rattachement evenement/groupe).

## Mettre en ligne (déploiement)

Voir les instructions séparées données par l'assistant, ou demander : elles
expliquent comment déployer gratuitement sur Render.com.
