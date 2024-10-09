'use strict';

require('dotenv').config();
const fs = require('fs');
const { google } = require('googleapis');

const {
  GDRIVE_CLIENT_EMAIL,
  GDRIVE_PRIVATE_KEY,
} = process.env;
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/**
 * Authorize with service account and get jwt client
 *
 */
async function authorize() {
  const jwtClient = new google.auth.JWT(
    GDRIVE_CLIENT_EMAIL,
    null,
    GDRIVE_PRIVATE_KEY,
    SCOPES,
  );

  await jwtClient.authorize();

  return jwtClient;
}

/**
 * Create a new folder on google drive.
 * @param {object} params -
 * @param {OAuth2Client} params.auth An authorized OAuth2 client.
 * @param {string} params.name folder name
 */
async function createFolder({ auth, name, parent }) {
  const drive = google.drive({ version: 'v3', auth });

  const folder = await drive.files.create({
    requestBody: {
      parents: [parent],
      name,
      mimeType: 'application/vnd.google-apps.folder', // mime type for folders
    },
  });

  return folder.data;
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {object} params -
 * @param {OAuth2Client} params.auth An authorized OAuth2 client.
 */
async function listFiles({ auth }) {
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.list({
    // pageSize: 100,
    fields: 'nextPageToken, files(id, name)',
  });
  const files = res.data.files;

  return files;
}

/**
 * Create a new file on google drive.
 * @param {object} params -
 * @param {OAuth2Client} param.auth An authorized OAuth2 client.
 * @param {string} params.filePath Absolute path of the file to upload
 * @param {string} params.folderId Id of the folder to put the file in
 */
async function uploadFile({ auth, fileName, filePath, folderId }) {
  const drive = google.drive({ version: 'v3', auth });

  const fileSize = fs.statSync(filePath).size;

  console.log({ fileSize });

  const file = await drive.files.create({
    media: {
      body: fs.createReadStream(filePath),
    },
    requestBody: {
      parents: [folderId],
      name: fileName,
    },
  });

  console.log(file.data);
}

module.exports = {
  authorize,
  createFolder,
  listFiles,
  uploadFile,
};
