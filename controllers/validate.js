'use strict';

const fs = require('fs').promises;
const path = require('path');

const {
  gdrive,
} = require('../../services');

const UPLOAD_PATH = path.resolve(__dirname, '../../uploads');

async function validate(req, res) {
  const {
    body: {
      challengerFolderId,
      text,
    },
    files: {
      photoFiles,
      gpxFiles,
    },
  } = req;

  const auth = await gdrive.authorize();

  const submissionFolderName = new Date().toISOString();

  const { id: submissionFolderId } = await gdrive.createFolder({
    auth,
    name: submissionFolderName,
    parent: challengerFolderId,
  });

  // Text
  const textPath = path.resolve(UPLOAD_PATH, `${submissionFolderName}-text`);
  await fs.writeFile(textPath, text, (err) => {
    if (err) throw err;
  });

  await gdrive.uploadFile({
    auth,
    fileName: 'Challenger text.txt',
    filePath: textPath,
    folderId: submissionFolderId,
  });

  // Photos
  for (const photoFile of photoFiles) {
    const {
      filename,
      originalname,
      size,
    } = photoFile;

    if (size > 50_000) {
      console.log(`File ${originalname} too big, won't be uploaded`);
      continue;
    }

    const filePath = path.resolve(UPLOAD_PATH, filename);
    await gdrive.uploadFile({
      auth,
      fileName: originalname,
      filePath,
      folderId: submissionFolderId,
    });
  }

  // Gpx
  const { id: gpxFolderId } = await gdrive.createFolder({
    auth,
    name: 'challengerGpx',
    parent: submissionFolderId,
  });

  for (const gpxFile of gpxFiles) {
    const {
      filename,
      originalname,
    } = gpxFile;

    const filePath = path.resolve(UPLOAD_PATH, filename);
    await gdrive.uploadFile({
      auth,
      fileName: originalname,
      filePath,
      folderId: gpxFolderId,
    });
  }

  const fileNames = await gdrive.listFiles({ auth });

  console.log(fileNames);

  res.send('OK');
};

module.exports = validate;
