'use strict';

const fs = require('fs').promises;
const path = require('path');

const {
  checkGpx,
  gdrive,
  mailer,
} = require('../services');

async function deleteFiles(files) {
  try {
    await Promise.all(
      files.map(async (file) => {
        const { path } = file;
        await fs.unlink(path);
      }),
    );
    console.log('All files deleted successfully!');
  } catch (error) {
    console.error('Error deleting files:', error);
  }
}

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

async function checkAndSaveData(req, res) {
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
    gpxIssues: [],
    photoIssues: [],
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
    await deleteFiles([...gpxFiles, ...photoFiles]);

    issues.gpxIssues.push(gpxContentIssue);

    res.json({
      success: false,
      data: {
        issues,
      },
    });

    return;
  }

  // Else, upload files on Google Drive
  const submissionFolderName = `Soumission du ${new Date().toISOString()}`;

  const auth = await gdrive.getAuthorization();

  const { id: submissionFolderId } = await gdrive.createFolder({
    auth,
    name: submissionFolderName,
    parent: challengerFolderId,
  });

  // Upload text file
  const textPath = path.join(__dirname, '../uploads', `${submissionFolderName}-text`);

  await fs.writeFile(textPath, text);

  await gdrive.saveFile({
    auth,
    fileName: 'Challenger text.txt',
    filePath: textPath,
    folderId: submissionFolderId,
  });

  await fs.unlink(textPath);

  // Upload photos
  await saveFiles({
    auth,
    files: photoFiles,
    folderId: submissionFolderId,
  });

  // Upload GPX files
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
  await deleteFiles([...gpxFiles, ...photoFiles]);

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
