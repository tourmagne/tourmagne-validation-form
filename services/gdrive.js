'use strict';

const fs = require('fs');
const { google } = require('googleapis');
const { Readable } = require('node:stream');

const { FileError } = require('../utils/errors');
const filenameAsUTF8 = require('../utils/filenameAsUTF8');

const {
  GDRIVE_CLIENT_EMAIL,
  GDRIVE_PRIVATE_KEY,
} = process.env;

const SCOPES = ['https://www.googleapis.com/auth/drive'];

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
 * Lists the names and IDs of up to 100 files.
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
 * Get most recent folder in parent folder
 * @param {object} params -
 * @param {OAuth2Client} params.auth An authorized OAuth2 client.
 */
async function getMostRecentFolder({ auth, parentFolderId }) {
  const drive = google.drive({ version: 'v3', auth });

  const folder = await drive.files.list({
    pageSize: 1,
    q: `mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents`,
    fields: 'nextPageToken, files(name)',
    orderBy: 'name desc',
  });

  return folder.data.files[0];
}

// Read specific file
async function readFile({ auth, filename, folderId }) {
  const drive = google.drive({ version: 'v3', auth });

  // Search for the file in the folder
  const fileList = await drive.files.list({
    q: `'${folderId}' in parents and name = '${filename}' and trashed = false`,
    fields: 'files(id, name)',
  });

  const files = fileList?.data?.files;

  if (!files.length) {
    throw new FileError(`File '${filename}' not found in folder '${folderId}'.`);
  }

  if (files.length > 1) {
    throw new FileError(`${files.length} files named '${filename}' found in folder '${folderId}'. There should only be one such file.`);
  }

  const fileId = files[0].id;

  const file = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'text' },
  );

  return file;
}

// Check folder existence
async function checkFolderExistence({ auth, folderId }) {
  const drive = google.drive({ version: 'v3', auth });

  await drive.files.get({
    fileId: folderId,
    fields: 'id, name',
  });
}

/**
 * Create a new file on google drive.
 * @param {object} params -
 * @param {OAuth2Client} param.auth An authorized OAuth2 client.
 * @param {string} params.folderId Id of the folder to put the file in
 */
async function saveFile({ auth, buffer, fileName, filePath, folderId, mimeType }) {
  const drive = google.drive({ version: 'v3', auth });

  const body = buffer ? Readable.from(buffer) : fs.createReadStream(filePath);

  await drive.files.create({
    media: {
      body,
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
 * Create a new files on google drive.
 * @param {object} params -
 * @param {OAuth2Client} param.auth An authorized OAuth2 client.
 * @param {string} params.folderId Id of the folder to put the file in
 */
async function saveFiles({
  auth,
  files,
  folderId,
}) {
  const promises = files.map((file) => {
    const {
      buffer,
      path: filePath,
      originalname,
      mimetype: mimeType,
    } = file;

    return saveFile({
      auth,
      buffer,
      fileName: filenameAsUTF8(originalname),
      filePath,
      folderId,
      mimeType,
    });
  });

  await Promise.all(promises);
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
  checkFolderExistence,
  createFolder,
  deleteAllFiles,
  getAuthorization,
  listFiles,
  getMostRecentFolder,
  readFile,
  saveFile,
  saveFiles,
};
