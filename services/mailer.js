'use strict';

const nodemailer = require('nodemailer');

const { asyncLocalStorage } = require('../middlewares/contextMiddleware');
const buildEmailContent = require('./buildEmailContent');

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

async function notify(params) {
  const {
    emailContent,
    from,
    html,
    subject,
  } = buildEmailContent(params);

  const { logger } = asyncLocalStorage.getStore();

  const info = await transporter.sendMail({
    from,
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
