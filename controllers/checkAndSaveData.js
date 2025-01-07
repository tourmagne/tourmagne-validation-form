'use strict';

const {
  checkGpx,
  gdrive,
  mailer,
} = require('../services');

// Function to fix encoding issue with multer (see https://github.com/expressjs/multer/issues/1104)
function filenameAsUTF8(originalname) {
  return Buffer.from(originalname, 'latin1').toString('utf8');
}

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
      fileName: filenameAsUTF8(originalname),
      folderId,
      mimeType,
    });
  });

  await Promise.all(promises);
}

// eslint-disable-next-line no-unused-vars
async function checkAndSaveData(req, res, next) {
  console.log('checkAndSaveData controller: started');

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
  const fileContentArray = gpxFiles.map((file) => file.buffer.toString());

  console.log('checkAndSaveData controller: before checkGpx service launch');
  const gpxContentIssue = await checkGpx(fileContentArray);

  console.log('checkAndSaveData controller: after checkGpx service finished');

  // Early return if GPX files are not valid
  if (gpxContentIssue) {
    console.log('checkAndSaveData controller: returning an handled error');
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

  console.log('checkAndSaveData controller: get authorization from Google Drive');
  const auth = await gdrive.getAuthorization();

  console.log('checkAndSaveData controller: create submission folder in Google Drive');
  const { id: submissionFolderId } = await gdrive.createFolder({
    auth,
    name: submissionFolderName,
    parent: challengerFolderId,
  });

  // Save text file on Google Drive
  console.log('checkAndSaveData controller: save text file in Google Drive');
  await gdrive.saveFile({
    auth,
    buffer: text,
    fileName: 'Challenger text.txt',
    folderId: submissionFolderId,
    mimeType: 'text/plain',
  });

  // Save photos on Google Drive
  console.log('checkAndSaveData controller: save photo files in Google Drive');
  await saveFiles({
    auth,
    files: photoFiles,
    folderId: submissionFolderId,
    mimeType: 'image/jpg',
  });

  // Save GPX files on Google Drive
  console.log('checkAndSaveData controller: create gpx folder in Google Drive');
  const { id: gpxFolderId } = await gdrive.createFolder({
    auth,
    name: 'challengerGpx',
    parent: submissionFolderId,
  });

  console.log('checkAndSaveData controller: save gpx files in Google Drive');
  await saveFiles({
    auth,
    files: gpxFiles,
    folderId: gpxFolderId,
    mimeType: 'application/gpx+xml',
  });

  // Send email
  console.log('checkAndSaveData controller: notify by email');
  await mailer.notify({
    challengerFolderId,
    submissionFolderId,
  });

  const gpxFilelist = gpxFiles.map((file) => filenameAsUTF8(file.originalname));
  const photoFilelist = photoFiles.map((file) => filenameAsUTF8(file.originalname));

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
