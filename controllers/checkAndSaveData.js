'use strict';

const fs = require('fs').promises;
const path = require('path');

const {
  checkGpx,
  gdrive,
  mailer,
} = require('../services');
const deleteFilesFromServer = require('./utils/deleteFilesFromServer');

async function saveFiles({
  auth,
  files,
  folderId,
}) {
  const promises = files.map((file) => {
    const {
      originalname,
      path,
    } = file;

    return gdrive.saveFile({
      auth,
      fileName: originalname,
      filePath: path,
      folderId,
    });
  });

  await Promise.all(promises);
}

async function checkAndSaveData(req, res, next) {
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

  const issues = {
    gpxFiles: [],
    photoFiles: [],
  };

  // Check GPX files validity
  const fileContentPromises = gpxFiles.map(async (file) => {
    const fileContent = await fs.readFile(file.path, 'utf-8');

    return fileContent;
  });

  const fileContentArray = await Promise.all(fileContentPromises);
  const gpxContentIssue = await checkGpx(fileContentArray);

  // Early return if GPX files are not valid
  if (gpxContentIssue) {
    await deleteFilesFromServer(next);

    issues.gpxFiles.push(gpxContentIssue);

    res.json({
      success: false,
      data: {
        issues,
      },
    });

    return;
  }

  // Else, save files on Google Drive
  const submissionFolderName = `Soumission du ${new Date().toISOString()}`;

  const auth = await gdrive.getAuthorization();

  const { id: submissionFolderId } = await gdrive.createFolder({
    auth,
    name: submissionFolderName,
    parent: challengerFolderId,
  });

  // Upload text on server and then save text file on Google Drive
  const textPath = path.join(__dirname, '../uploads', `${new Date().toISOString()} - text`);

  await fs.writeFile(textPath, text);

  try {
    await gdrive.saveFile({
      auth,
      fileName: 'Challenger text.txt',
      filePath: textPath,
      folderId: submissionFolderId,
    });
  } catch (err) {
    return next(err);
  } finally {
    await fs.unlink(textPath);
  }

  // Save photos on Google Drive
  await saveFiles({
    auth,
    files: photoFiles,
    folderId: submissionFolderId,
  });

  // Save GPX files on Google Drive
  const { id: gpxFolderId } = await gdrive.createFolder({
    auth,
    name: 'challengerGpx',
    parent: submissionFolderId,
  });

  await saveFiles({
    auth,
    files: gpxFiles,
    folderId: gpxFolderId,
  });

  // Delete gpx & photo files from server
  await deleteFilesFromServer(next);

  // Send email
  await mailer.notify({
    challengerFolderId,
    submissionFolderId,
  });

  const gpxFilelist = gpxFiles.map((file) => file.originalname);
  const photoFilelist = photoFiles.map((file) => file.originalname);

  res.json({
    success: true,
    data: {
      text,
      gpxFilelist,
      photoFilelist,
    },
  });
};

module.exports = checkAndSaveData;
