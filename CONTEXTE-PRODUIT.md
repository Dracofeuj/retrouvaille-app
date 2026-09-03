# Contexte produit — Réseau de retrouvailles

> **À lire par l'assistant de code comme référence de fond.**
> Ce document décrit le produit **en entier**, pour que tu comprennes où on va.
> ⚠️ **Ne construis QUE ce que demande le prompt de la tranche en cours.** Tout le reste ci-dessous est du contexte pour plus tard, pas à construire maintenant.

---

## Le concept
Une application web pour organiser des retrouvailles dans la vraie vie : on cale une date ensemble, on se voit, et les photos se rangent dans l'album partagé de l'événement. Un **réseau social sans messagerie** — le but est de se voir, pas de discuter derrière un écran.

## Le principe fondateur
**Pas de messagerie.** L'app ne cherche pas à retenir les gens à l'écran, elle les pousse à se voir. Pas de chat, pas de messages privés, pas de commentaires. C'est l'identité du produit.

## La boucle produit (un cycle)
1. **Avant — caler.** On lance une question (« Dispo pour un verre ? »). Chacun peint ses jours disponibles sur un calendrier. Une vue de groupe surligne les jours selon le nombre de participants ; le meilleur ressort, on valide.
2. **Pendant — se voir.** Ça se passe hors de l'app. C'est le but.
3. **Après — se souvenir.** Les participants déposent leurs photos dans l'album de l'événement.

## Les écrans (direction, version épurée)
- **Accueil / fil** : les sorties et albums des proches ; cartes « à voter », « album passé », « à venir ». Aucune conversation.
- **Vote** : on peint ses jours dispo (jaune) sur un calendrier ; la vue de groupe colore les jours par intensité selon le nombre de dispos, met en avant le meilleur.
- **Calendrier** : la vue d'ensemble personnelle.
- **Contacts** : inviter vite les personnes qu'on retrouve souvent.
- **Album** : les photos d'une sortie ; rattachées à l'événement ET au groupe ; on peut ajouter une photo, en retirer une de soi.
- **Groupe** : un cercle persistant (ex. « copains d'enfance ») ; ses membres, la prochaine sortie, les albums passés.

## Visibilité par groupes
La visibilité passe par des cercles persistants (« copains d'enfance », « famille »).
**Double rattachement** : une sortie appartient à la fois à l'événement et au groupe ; les photos appartiennent à l'événement, et tout membre du groupe y accède — même absent ce jour-là.

## Distribution (web-first)
- L'application native est un bonus ; le cœur est une **page web responsive**.
- Le partage se fait par un **lien** qui s'affiche en carte riche (balises Open Graph) dans WhatsApp/Messenger/etc., via le menu « Partager » du téléphone.
- **Modèle invité → compte** : on vote d'abord en invité (juste un prénom, rien à installer) ; juste après, on propose de créer un compte pour retrouver ses groupes, ses photos et son planning.

## Feuille de route
**Colonne vertébrale (d'abord)** : comptes + mémoire ; créer un événement et peindre ses dispos ; partage web-first + participation invité ; vue de groupe, meilleur jour, validation ; album de l'événement.
**Juste après** : fil social ; groupes/favoris comme modèle de visibilité (avec suggestion automatique du bon groupe) ; contacts « souvent invités ».
**Plus tard** : synchro agendas externes ; suggestion de lieu ; recommandation intelligente ; rappels/notifications push (au service des retrouvailles, jamais de l'engagement pur) ; monétisation par les lieux (sponsorisés, clairement distingués des suggestions neutres).

## Modèle de données (cible)
- **users** : id, prenom, email
- **groupes** : id, nom, cree_par → users
- **membres** : groupe_id → groupes, user_id → users, role
- **evenements** : id, titre, groupe_id → groupes (optionnel), organisateur_id → users, statut, jour_valide
- **participants** : id, evenement_id → evenements, user_id → users (optionnel : invité si vide), prenom
- **dispos** : id, participant_id → participants, jour (date)
- **photos** : id, evenement_id → evenements, ajoutee_par → users, url

Décisions clés : le participant sans `user_id` = un invité (rattachable à un compte plus tard) ; la heatmap = un simple comptage de `dispos` par jour ; la visibilité d'un album se déduit du groupe de l'événement.

## Critères de succès
Une majorité d'événements aboutissent à un jour validé ; un organisateur en crée un deuxième ; des photos sont déposées après la sortie. Ces signaux priment sur le nombre d'inscrits.

## Lancement
D'abord une V1 testée en cercle restreint (vraies sorties entre proches) avant toute ouverture.
