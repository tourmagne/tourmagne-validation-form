'use strict';

require('dotenv').config();
const { Readable } = require('node:stream');
const { google } = require('googleapis');

const {
  GDRIVE_CLIENT_EMAIL,
  GDRIVE_PRIVATE_KEY,
} = process.env;
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

/**
 * Get authorization with service account
 *
 */
async function getAuthorization() {
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
 * @param {string} params.textString String to write in Google Drive
 * @param {string} params.folderId Id of the folder to put the file in
 */
async function saveFile({ auth, buffer, fileName, folderId, mimeType }) {
  const drive = google.drive({ version: 'v3', auth });

  await drive.files.create({
    media: {
      body: Readable.from(buffer),
      mimeType,
    },
    requestBody: {
      mimeType,
      name: fileName,
      parents: [folderId],
    },
  });
}

/**
 * Delete one file
 * @param {object} params -
 * @param {OAuth2Client} params.auth An authorized OAuth2 client.
 * @param {string} params.fileId id of the file to delete
 */
async function deleteFile({ auth, fileId, fileName }) {
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.delete({
    fileId,
  });

  console.log(`File ${fileId} of name ${fileName} deleted: status ${res.status}`);
}

/**
 * Delete all files
 * @param {object} params -
 * @param {OAuth2Client} params.auth An authorized OAuth2 client.
 */
async function deleteAllFiles({ auth }) {
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.list({
    fields: 'nextPageToken, files(id, name)',
  });

  const files = res.data.files;
  if (files.length === 0) {
    console.log('No files found.');
    return;
  }

  console.log('Files:');
  files.map((file) => {
    console.log(`${file.name} (${file.id})`);
  });
  console.log('\n');

  const promises = files.map((file) => deleteFile({ auth, fileId: file.id, fileName: file.name }));
  console.log('\n');

  await Promise.all(promises);

  console.log(`Total of ${files.length} files DELETED`);
}

module.exports = {
  getAuthorization,
  deleteAllFiles,
  createFolder,
  listFiles,
  saveFile,
};
