'use strict';

require('dotenv').config();

const nodemailer = require('nodemailer');

const {
  GMAIL_APP_EMAIL,
  GMAIL_APP_PASSWORD,
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
  submissionFolderId,
}) {
  const html = `New files uploaded in folder ${challengerFolderId}/${submissionFolderId}`;
  const text = `<p>New files <strong>uploaded</strong> in folder ${challengerFolderId}/${submissionFolderId}</p>`;

  return {
    html,
    text,
  };
}

async function notify(params) {
  const {
    html,
    text,
  } = buildContent(params);

  const info = await transporter.sendMail({
    from: '"Tourmagne Administration" <cedriclouyottest@gmail.com>',
    to: 'cedric.louyot@gmail.com',
    subject: 'A challenger submitted its files',
    html,
    text,
  });

  console.log('Message sent: %s', info.messageId);
}

module.exports = {
  notify,
};
