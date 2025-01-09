'use strict';

const { Worker } = require('node:worker_threads');
const path = require('path');

const {
  gdrive,
  mailer,
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
  MIN_TEXT_LENGTH,
} = require('../constants');

const generateFullGpxStr = require('../utils/generateFullGpxStr');

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

  refGpxString = await gdrive.readFile({
    auth,
    filename: REF_TRACK_FILENAME,
    folderId: challengerFolderId,
  });

  const parsedGpx = await runParseGpxWorker({
    strs: [refGpxString],
    options: { challengerGpx: false },
  });
  const refPoints = parsedGpx.flat();

  // Compare tracks
  const options = {
    rollingDuration: ROLLING_DURATION, // in hours
    trigger: TRIGGER, // in meters - trigger must be less than tolerance
    tolerance: TOLERANCE, // in meters
    maxDetour: MAX_DETOUR, // in meters
    maxSegLength: MAX_SEG_LENGTH, // in meters
  };

  const results = await runCompareTracksWorker(
    {
      refPoints,
      challPoints,
      options,
    },
  );

  const gpxStr = generateFullGpxStr(results);

  // Write result GPX to Google Drive
  await gdrive.saveFile({
    auth,
    buffer: gpxStr,
    fileName: 'gpxComparisonSynthesis.gpx',
    folderId: submissionFolderId,
    mimeType: 'application/gpx+xml',
  });
}

function runParseGpxWorker(workerData) {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, '../workers/parseGpx.js');
    const worker = new Worker(workerPath, { workerData });

    worker.on('message', (result) => resolve(result));
    worker.on('error', (error) => reject(error));
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

function runCompareTracksWorker(workerData) {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, '../workers/compareTracks.js');
    const worker = new Worker(workerPath, { workerData });

    worker.on('message', (result) => resolve(result));
    worker.on('error', (error) => reject(error));
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// eslint-disable-next-line no-unused-vars
async function checkAndSaveData(req, res, next) {
  console.log('checkAndSaveData controller: started');

  const {
    body: {
      challengerFolderId,
      firstname,
      lastname,
      text,
    },
    files: {
      photoFiles = [],
      gpxFiles,
    },
  } = req;

  if (!challengerFolderId) {
    req.user.issues.generic.push('Missing folder id in query params');

    return res.json({
      success: false,
      data: {
        issues: req.user.issues,
      },
    });
  }

  // Early return if text is too short or too long
  if (text.length < MIN_TEXT_LENGTH) {
    console.log('checkAndSaveData controller ERROR: text too long');
    req.user.issues.text.push(`Tu as vécu une grande aventure, on compte sur toi pour nous en dire un peu plus !`);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    console.log('checkAndSaveData controller ERROR: text too long');
    req.user.issues.text.push(`Le text est trop long (${text.length})`);
  }

  if (req.user.issues.text.length > 0) {
    console.log('checkAndSaveData controller ERROR: text too long or too short');

    res.json({
      success: false,
      data: {
        issues: req.user.issues,
      },
    });

    return;
  }

  // Check GPX files validity
  const challGpxStrings = gpxFiles.map((file) => file.buffer.toString());

  console.log('checkAndSaveData controller: before parseGpx worker launch');

  let challPoints;

  const result = await runParseGpxWorker({
    strs: challGpxStrings,
    options: { challengerGpx: true },
  });

  if (result.error) {
    req.user.issues.gpxFiles.push(result.error.message);
  } else {
    challPoints = result.flat();
  }

  console.log('checkAndSaveData controller: after parseGpx worker finished');

  // Early return if GPX files are not valid
  if (req.user.issues.gpxFiles.length > 0) {
    console.log('checkAndSaveData controller ERROR: challenger GPX not valid');

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

  // Send email
  console.log('checkAndSaveData controller: notify by email');
  await mailer.notify({
    challengerFolderId,
    firstname,
    lastname,
    submissionFolderId,
    text,
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

  const gpxFilelist = gpxFiles.map((file) => filenameAsUTF8(file.originalname));
  const photoFilelist = photoFiles.map((file) => filenameAsUTF8(file.originalname));

  console.log('checkAndSaveData controller: send response to browser');
  res.json({
    success: true,
    data: {
      text,
      gpxFilelist,
      photoFilelist,
    },
  });

  // Compare tracks
  console.log('checkAndSaveData controller: before compareTracks worker launch');
  try {
    await compare({
      auth,
      challengerFolderId,
      challPoints,
      submissionFolderId,
    });
  } catch (error) {
    console.log(`checkAndSaveData controller ERROR during reference gpx parsing or gpx comparison: ${error.message}`);
    console.log('checkAndSaveData controller: writing error file on Google Drive');

    await gdrive.saveFile({
      auth,
      buffer: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      fileName: 'Error during reference GPX upload or GPX comparison.txt',
      folderId: submissionFolderId,
      mimeType: 'text/plain',
    });
  }

  console.log('checkAndSaveData controller: after compareTracks worker finished');
};

module.exports = checkAndSaveData;
