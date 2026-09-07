# Retrouvailles — boucle de vote

Application web pour caler une sortie entre amis : un organisateur propose
une sortie (des dates précises, ou un calendrier ouvert), avec une heure et
un ou plusieurs lieux facultatifs ; chacun vote ses disponibilités et ses
lieux préférés, le meilleur ressort tout seul dans une liste triée,
l'organisateur valide. Pas de compte, pas de messagerie, un seul lien pour
tout le monde. Design neumorphique sombre (surfaces embossées, accent vert).

Cette version couvre **uniquement la boucle de vote** (créer une sortie
dans l'un des deux modes avec heure/lieu, voter, contre-proposer une date ou
un lieu, voir le résultat, valider). Le reste du produit (comptes, groupes,
albums photo...) est décrit dans `CONTEXTE-PRODUIT.md` mais n'est pas
construit ici.

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
lib/organisateur.js     reconnaissance du createur via un cookie (lien unique)
lib/db.js               connexion a la base de donnees (Prisma)
views/                  pages HTML (moteur de template EJS)
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

Il n'y a plus qu'un seul lien par sortie (`/e/:id`). Au moment de la
création, le serveur pose un cookie (`org_<id>`, invisible, "HttpOnly") sur
le navigateur du créateur, contenant le `jetonCreateur` de l'événement. À
chaque visite de `/e/:id`, le serveur compare ce cookie au jeton stocké en
base (`lib/organisateur.js`) : s'ils correspondent, la personne voit les
actions d'organisateur (valider le jour, accepter/refuser une
contre-proposition).

**Limite assumée** : ça ne marche que sur le même appareil/navigateur — si
le créateur change d'appareil ou vide son navigateur, il perd ce statut. La
reconnaissance fiable sur tous les appareils viendra avec les comptes
utilisateur (tranche suivante) ; le code est écrit pour qu'on puisse alors
ajouter une vérification par compte (`evenement.createurUserId`) à côté du
cookie, sans rien casser.

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
- Il n'y a pas encore de compte utilisateur : un "participant" est identifié
  uniquement par son prénom sur un événement donné (`@@unique([evenementId, prenom])`
  dans `prisma/schema.prisma`). Le doc `CONTEXTE-PRODUIT.md` prévoit d'ajouter
  des comptes plus tard, avec un `userId` optionnel sur `Participant`.

## Mettre en ligne (déploiement)

Voir les instructions séparées données par l'assistant, ou demander : elles
expliquent comment déployer gratuitement sur Render.com.
