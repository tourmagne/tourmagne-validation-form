'use strict';

const {
  compareTracks,
  gdrive,
  mailer,
  parseGpx,
} = require('../services');

const {
  COMPARATOR_OPTIONS: {
    MAX_DETOUR,
    MAX_SEG_LENGTH,
    REF_TRACK_FILENAME,
    ROLLING_DURATION,
    TOLERANCE,
    TRIGGER,
  },
  MAX_TEXT_LENGTH,
} = require('../constants');

const generateFullGpxStr = require('../utils/generateFullGpxStr');

const {
  ParsingError,
  FileError,
} = require('../utils/errors');

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

async function compare({
  auth,
  challengerFolderId,
  challPoints,
  submissionFolderId,
}) {
  // Check if reference track available on Google Drive
  let refGpxString;
  try {
    refGpxString = await gdrive.readFile({
      auth,
      filename: REF_TRACK_FILENAME,
      folderId: challengerFolderId,
    });
  } catch (error) {
    if (error instanceof FileError) {
      // TODO : write error file in Google Drive
      console.log(error.message);

      return;
    } else {
      throw error;
    }
  }

  const refPoints = await parseGpx([refGpxString], { timestampsRequired: false }).flat();

  // Compare tracks
  const options = {
    rollingDuration: ROLLING_DURATION, // in hours
    trigger: TRIGGER, // in meters - trigger must be less than tolerance
    tolerance: TOLERANCE, // in meters
    maxDetour: MAX_DETOUR, // in meters
    maxSegLength: MAX_SEG_LENGTH, // in meters
  };

  const results = compareTracks(
    refPoints,
    challPoints,
    options,
  );

  const gpxStr = generateFullGpxStr(results);

  // Write result GPX to Google Drive
  await gdrive.saveFile({
    auth,
    buffer: gpxStr,
    fileName: 'gpxComparison.gpx',
    folderId: submissionFolderId,
    mimeType: 'application/gpx+xml',
  });
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
  const challGpxStrings = gpxFiles.map((file) => file.buffer.toString());

  console.log('checkAndSaveData controller: before parseGpx service launch');

  let challPoints;
  let gpxContentIssue;
  try {
    challPoints = await parseGpx(challGpxStrings, { timestampsRequired: true }).flat();
  } catch (error) {
    if (error instanceof ParsingError) {
      gpxContentIssue = error.message;
    } else {
      throw error;
    }
  }

  console.log('checkAndSaveData controller: after parseGpx service finished');

  // Early return if text is too long
  if (text.length > MAX_TEXT_LENGTH) {
    console.log('checkAndSaveData controller: returning an handled error');
    req.user.issues.text.push(`Le text est trop long (${text.length})`);
  }

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
  console.log('checkAndSaveData controller: get authorization from Google Drive');
  const auth = await gdrive.getAuthorization();

  console.log('checkAndSaveData controller: create submission folder in Google Drive');
  const submissionFolderName = `Soumission du ${new Date().toISOString()}`;
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

  // Compare tracks
  await compare({
    auth,
    challengerFolderId,
    challPoints,
    submissionFolderId,
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
