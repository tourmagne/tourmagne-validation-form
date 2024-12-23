'use strict';

const fs = require('fs').promises;
const path = require('path');

const {
  checkGpx,
  gdrive,
  mailer,
} = require('../services');

const UPLOAD_PATH = path.resolve(__dirname, '../uploads');

async function checkAndSubmitData(req, res) {
  const {
    body: {
      challengerFolderId,
      text,
    },
    files: {
      photoFiles = [],
      gpxFiles,
    },
  } = req;

  const strsPromises = gpxFiles.map(async (file) => {
    const str = await fs.readFile(file.path, 'utf-8');

    return str;
  });

  const strs = await Promise.all(strsPromises);
  const issueString = await checkGpx(strs);

  if (issueString) {
    for (const file of [...photoFiles, ...gpxFiles]) {
      const {
        path,
      } = file;

      await fs.unlink(path);
    }

    res.send(issueString);

    return;
  }

  const auth = await gdrive.getAuthorization();

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

  await fs.unlink(textPath);

  // Photos
  for (const photoFile of photoFiles) {
    const {
      originalname,
      path,
      size,
    } = photoFile;

    if (size > 50_000) {
      console.log(`File ${originalname} too big, won't be uploaded`);
    } else {
      await gdrive.uploadFile({
        auth,
        fileName: originalname,
        filePath: path,
        folderId: submissionFolderId,
      });
    }

    await fs.unlink(path);
  }

  // Gpx
  const { id: gpxFolderId } = await gdrive.createFolder({
    auth,
    name: 'challengerGpx',
    parent: submissionFolderId,
  });

  for (const gpxFile of gpxFiles) {
    const {
      originalname,
      path,
    } = gpxFile;

    await gdrive.uploadFile({
      auth,
      fileName: originalname,
      filePath: path,
      folderId: gpxFolderId,
    });

    await fs.unlink(path);
  }

  const fileNames = await gdrive.listFiles({ auth });

  console.log(fileNames);
  console.log('Nb de fichiers et dossiers appartenant au compte de service sur Google Drive', fileNames.length);

  await mailer.notify({
    challengerFolderId,
    submissionFolderId,
  });

  res.send();
};

module.exports = checkAndSubmitData;
