'use strict';

const nodemailer = require('nodemailer');

const { asyncLocalStorage } = require('../middlewares/contextMiddleware');

const {
  GMAIL_APP_EMAIL,
  GMAIL_APP_PASSWORD,
  MAIL_TO,
} = process.env;

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587, // 587 for TLS (old SSL with 465)
  secure: false, // true for port 465, false for other ports
  auth: {
    user: GMAIL_APP_EMAIL,
    pass: GMAIL_APP_PASSWORD, // app password
  },
});

function buildContent({
  challengerFolderId,
  firstname,
  lastname,
  submissionFolderId,
  text,
}) {
  const subject = `${firstname} ${lastname} est en train de soumettre ses fichiers !`;
  const html = `<p>Cher administrateur du Tourmagne,</p>
<p><a href='https://drive.google.com/drive/folders/${challengerFolderId}'>${firstname} ${lastname}</a> vient de lancer la soumission de ses fichiers. Ceux-ci seront disponibles dans ce <a href='https://drive.google.com/drive/folders/${submissionFolderId}'>dossier Google Drive</a> dans quelques minutes.</p>
<p>Voici le texte que ${firstname} ${lastname} a rédigé:<br>
<i>${text.replace(/\n/g, '<br>')}<i></p>
<p>De ton côté, voici les actions qu'il te reste à réaliser :<p>
<ul>
<li>Vérifie si ${firstname} ${lastname} est lauréat ou poète</li>
<li>Envoie-lui un email pour l'informer de son résultat</li>
<li>Ajoute son récit au <a href='https://tourmagne.bike/tableau-dhonneur-et-recits/'>tableau d'honneur</a></li>
</ul>
<p>Merci pour l'aide que tu apportes à l'association Challenge du Tourmagne !</p>
Le bureau du Tourmagne`;
  const emailContent = `Le challenger ${challengerFolderId} vient de lancer le téléchargement de ses fichiers. Ceux-ci seront disponible dans le dossier Google Drive ${submissionFolderId}`;

  return {
    html,
    subject,
    emailContent,
  };
}

async function notify(params) {
  const {
    html,
    subject,
    emailContent,
  } = buildContent(params);

  const { logger } = asyncLocalStorage.getStore();

  const info = await transporter.sendMail({
    from: '"Tourmagne Administration" <cedriclouyottest@gmail.com>',
    to: MAIL_TO,
    subject,
    html,
    text: emailContent,
  });

  logger(`Email sent: ${info.messageId}`);
}

module.exports = {
  notify,
};
