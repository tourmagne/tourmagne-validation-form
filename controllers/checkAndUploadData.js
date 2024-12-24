'use strict';

const fs = require('fs').promises;
const path = require('path');

const {
  MAX_GPX_NB,
  MAX_GPX_SIZE,
  MAX_PHOTO_NB,
  MAX_PHOTO_SIZE,
} = require('../constants');
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

function checkFileSize({
  files,
  maxSize,
}) {
  return files
    .filter((file) => file.size > maxSize)
    .map((file) => file.originalname);
}

async function uploadFiles({
  auth,
  files,
  folderId,
}) {
  const promises = files.map((file) => {
    const {
      originalname,
      path,
    } = file;

    return gdrive.uploadFile({
      auth,
      fileName: originalname,
      filePath: path,
      folderId,
    });
  });

  await Promise.all(promises);
}

async function checkAndUploadData(req, res) {
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

  // Check number of files
  if (gpxFiles.length > MAX_GPX_NB) {
    issues.gpxIssues.push(`Vous avez soumis trop de fichiers GPX (max ${MAX_GPX_NB})`);
  }

  if (photoFiles.length > MAX_PHOTO_NB) {
    issues.photoIssues.push(`Vous avez soumis trop de photos (max ${MAX_PHOTO_NB})`);
  }

  // Check files size
  const gpxSizeIssues = checkFileSize({
    files: gpxFiles,
    maxSize: MAX_GPX_SIZE,
  });

  issues.gpxIssues.concat(gpxSizeIssues);

  const photoSizeIssues = checkFileSize({
    files: photoFiles,
    maxSize: MAX_PHOTO_SIZE,
  });

  issues.photoIssues.concat(photoSizeIssues);

  // Early return if number or size of file issue
  if (issues.gpxIssues.length || issues.photoIssues.length) {
    await deleteFiles([...gpxFiles, ...photoFiles]);

    res.json({
      success: false,
      data: {
        issues,
      },
    });

    return;
  }

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

  await gdrive.uploadFile({
    auth,
    fileName: 'Challenger text.txt',
    filePath: textPath,
    folderId: submissionFolderId,
  });

  await fs.unlink(textPath);

  // Upload photos
  await uploadFiles({
    auth,
    files: photoFiles,
    folderId: submissionFolderId,
    maxSize: MAX_PHOTO_SIZE,
  });

  // Upload GPX files
  const { id: gpxFolderId } = await gdrive.createFolder({
    auth,
    name: 'challengerGpx',
    parent: submissionFolderId,
  });

  await uploadFiles({
    auth,
    files: gpxFiles,
    folderId: gpxFolderId,
    maxSize: MAX_GPX_SIZE,
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

module.exports = checkAndUploadData;
