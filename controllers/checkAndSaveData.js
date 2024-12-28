'use strict';

const {
  checkGpx,
  gdrive,
  mailer,
} = require('../services');

async function saveFiles({
  auth,
  files,
  folderId,
}) {
  const promises = files.map((file) => {
    const {
      buffer,
      originalname,
      mimeType,
    } = file;

    return gdrive.saveFile({
      auth,
      buffer,
      fileName: originalname,
      folderId,
      mimeType,
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

  // Check GPX files validity
  const fileContentPromises = gpxFiles.map(async (file) => {
    const fileContent = file.buffer.toString();

    return fileContent;
  });

  const fileContentArray = await Promise.all(fileContentPromises);
  const gpxContentIssue = await checkGpx(fileContentArray);

  // Early return if GPX files are not valid
  if (gpxContentIssue) {
    req.user.issues.gpxFiles.push(gpxContentIssue);

    res.json({
      success: false,
      data: {
        issues: req.user.issues,
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

  // Save text file on Google Drive
  await gdrive.saveFile({
    auth,
    buffer: text,
    fileName: 'Challenger text.txt',
    folderId: submissionFolderId,
    mimeType: 'text/plain',
  });

  // Save photos on Google Drive
  await saveFiles({
    auth,
    files: photoFiles,
    folderId: submissionFolderId,
    mimeType: 'image/jpg',
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
    mimeType: 'application/gpx+xml',
  });

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
