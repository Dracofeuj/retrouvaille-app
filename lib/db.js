// Un seul client Prisma partage par toute l'application (evite d'ouvrir
// une nouvelle connexion a chaque requete).
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
