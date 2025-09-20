'use strict';

const fs = require('fs');
const handlebars = require('handlebars');
const path = require('path');

const {
  GMAIL_APP_EMAIL,
} = process.env;

function buildEmailContent({
  challengerFolderId,
  firstname,
  lastname,
  submissionFolderId,
  text,
}) {
  const from = `"Tourmagne Administration" <${GMAIL_APP_EMAIL}>`;
  const emailContent = `Le challenger dont le dossier Google Drive a l'id ${challengerFolderId} vient de lancer le téléchargement de ses fichiers. Ceux-ci seront bientôt disponibles dans le dossier Google Drive ayant pour id ${submissionFolderId}`;
  const subject = `${firstname} ${lastname} est en train de soumettre ses fichiers !`;

  const htmlSource = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'fr', 'adminNotificationEmail.hbs'),
    'utf8',
  );

  const template = handlebars.compile(htmlSource);

  const html = template({
    challengerFolderId,
    firstname,
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
