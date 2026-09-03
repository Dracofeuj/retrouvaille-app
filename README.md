# Retrouvailles — boucle de vote

Application web pour caler une sortie entre amis : un organisateur propose
une sortie, chacun peint ses jours de disponibilité, le meilleur jour
ressort tout seul, l'organisateur le valide. Pas de compte, pas de
messagerie.

Cette version couvre **uniquement la boucle de vote** (créer une sortie,
voter, voir le résultat, valider). Le reste du produit (comptes, groupes,
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
lib/heatmap.js          calcul du "meilleur jour" a partir des votes
lib/db.js               connexion a la base de donnees (Prisma)
views/                  pages HTML (moteur de template EJS)
public/css/style.css    tout le style visuel
public/js/              interactivite cote navigateur (peindre les jours, copier un lien)
```

## Modèle de données

- **Evenement** : titre, période (`dateDebut`/`dateFin`), statut
  (`en_cours`/`confirme`), `jourValide`, et `jetonOrganisateur` (le secret
  qui donne le droit de valider un jour).
- **Participant** : un prénom rattaché à un événement (un invité, sans compte).
- **Dispo** : un jour où un participant a dit être disponible.

Le meilleur jour = celui qui a le plus de lignes `Dispo`. Aucun calcul compliqué.

Toutes les dates sont stockées comme de simples chaînes `AAAA-MM-JJ` (pas
de type date avec heure/fuseau), pour éviter les décalages d'un jour selon
le fuseau horaire du visiteur ou du serveur.

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
