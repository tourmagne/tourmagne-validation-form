'use strict';

const fs = require('fs');
const handlebars = require('handlebars');
const path = require('path');

// handlebars.registerHelper('lt', function (a, b) {
//   return a < b;
// });

const {
  MIN_CHALLENGER_GPX_POINTS,
} = require('../constants');

const {
  GMAIL_APP_EMAIL,
} = process.env;

function buildEmailContent({
  challengerFolderId,
  challPointsLength,
  firstname,
  lastname,
  submissionFolderId,
  text,
}) {
  const from = `"Tourmagne Administration" <${GMAIL_APP_EMAIL}>`;
  let emailContent = `Le challenger dont le dossier Google Drive a l'id ${challengerFolderId} vient de lancer le téléchargement de ses fichiers. Ceux-ci seront bientôt disponibles dans le dossier Google Drive ayant pour id ${submissionFolderId}.\nSes fichiers GPX contiennent au total ${challPointsLength} points GPX. `;
  if (challPointsLength < MIN_CHALLENGER_GPX_POINTS) {
    emailContent += `ALERTE! Ce nombre de points est inférieur à ${MIN_CHALLENGER_GPX_POINTS}, une vérification manuelle détaillée des fichiers soumis par le challenger est nécessaire.`;
  } else {
    emailContent += `Ce nombre de points est supérieur à ${MIN_CHALLENGER_GPX_POINTS} et semble donc conforme.`;
  }
  const subject = `${firstname} ${lastname} est en train de soumettre ses fichiers !`;

  const htmlSource = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'fr', 'adminNotificationEmail.hbs'),
    'utf8',
  );

  const template = handlebars.compile(htmlSource);

  const html = template({
    challengerFolderId,
    challPointsLength,
    firstname,
    minChallengerGpxPoints: MIN_CHALLENGER_GPX_POINTS,
    lastname,
    submissionFolderId,
    text,
  });

  return {
    emailContent,
    from,
    html,
    subject,
  };
}

module.exports = buildEmailContent;
