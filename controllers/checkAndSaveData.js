'use strict';

const { Worker } = require('node:worker_threads');
const fs = require('fs').promises;
const path = require('path');

const { asyncLocalStorage } = require('../middlewares/contextMiddleware');
const {
  gdrive,
  mailer,
} = require('../services');
const deleteFilesFromServer = require('../utils/deleteFilesFromServer');
const filenameAsUTF8 = require('../utils/filenameAsUTF8');

const {
  MIN_DELAY_BETWEEN_SUBMISSIONS,
  COMPARATOR_OPTIONS: {
    MAX_DETOUR,
    MAX_SEG_LENGTH,
    REF_TRACK_FILENAME,
    ROLLING_DURATION,
    TOLERANCE,
    TRIGGER,
  },
} = require('../constants');

const datePlusDurationToStr = require('../utils/datePlusDurationToStr');
const generateFullGpxStr = require('../utils/generateFullGpxStr');
const generateHtmlFile = require('../utils/generateHtmlFile');

async function compare({
  auth,
  challengerFolderId,
  challPoints,
  firstname,
  lastname,
  submissionFolderId,
}, language) {
  const filename = REF_TRACK_FILENAME;

  const {
    logger,
    requestId,
  } = asyncLocalStorage.getStore();

  // Check if reference track available on Google Drive
  const file = await gdrive.readFile({
    auth,
    filename,
    folderId: challengerFolderId,
  });

  if (file) {
    logger(`Compare - Found file: ${filename}`);
  } else {
    throw new Error(`Compare - ERROR file not found: ${filename}`);
  }

  const refGpxString = file.data;

  const parsedGpx = await runParseGpxWorker({
    filenames: [filename],
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
      challPoints,
      requestId,
      options,
      refPoints,
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

  logger('Compare - Start generateHtmlFile');
  const htmlFile = generateHtmlFile({
    firstname,
    lastname,
    results,
  }, language);

  // Write result html file to Google Drive
  logger('Compare - Start saving HTML file on Drive');
  await gdrive.saveFile({
    auth,
    buffer: htmlFile,
    fileName: 'syntheseDuChallenge.html',
    folderId: submissionFolderId,
    mimeType: 'text/html',
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

async function checkAndSaveData(req, res, next) {
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

  const language = res.getLocale();

  const { logger } = asyncLocalStorage.getStore();

  logger('checkAndSaveData controller: started');

  if (!challengerFolderId) {
    req.user.issues.generic.push('Missing folder id in query params');

    res.json({
      success: false,
      data: {
        issues: req.user.issues,
      },
    });

    return await deleteFilesFromServer(next);
  }
  // Check GPX files validity
  const fileContentPromises = gpxFiles.map(async (file) => {
    const fileContent = await fs.readFile(file.path, 'utf-8');

    return fileContent;
  });
  const challGpxStrings = await Promise.all(fileContentPromises);

  logger('checkAndSaveData controller: before parseGpx worker launch');

  const result = await runParseGpxWorker({
    filenames: gpxFiles.map((file) => file.originalname),
    strs: challGpxStrings,
    options: { challengerGpx: true },
  });

  let challPoints;
  if (result.error) {
    req.user.issues.gpxFiles.push(res.__(result.error.message, result.error.data));
  } else {
    challPoints = result.flat();
  }

  logger('checkAndSaveData controller: after parseGpx worker finished');

  // Early return if GPX files are not valid
  if (req.user.issues.gpxFiles.length > 0) {
    logger('checkAndSaveData controller ERROR: challenger GPX not valid');

    res.json({
      success: false,
      data: {
        issues: req.user.issues,
      },
    });

    return await deleteFilesFromServer(next);
  }

  // Else, save files on Google Drive
  logger('checkAndSaveData controller: get authorization from Google Drive');
  const auth = await gdrive.getAuthorization();

  // Check challengerFolderId existence
  try {
    await gdrive.checkFolderExistence({ auth, folderId: challengerFolderId });
  } catch (error) {
    logger(`checkAndSaveData controller: ERROR with challengerFolderId ${challengerFolderId} - ${error.message}`);

    res.json({
      success: false,
      data: {
        issues: {
          generic: [`L'id ${challengerFolderId} est incorrect`],
        },
      },
    });

    return await deleteFilesFromServer(next);
  }

  // Check if recent submission occured
  const now = new Date();
  const mostRecentSubmissionFolder = await gdrive.getMostRecentFolder({
    auth,
    parentFolderId: challengerFolderId,
  });

  if (mostRecentSubmissionFolder) {
    const lastSubmissionISOString = mostRecentSubmissionFolder.name.split(' ').at(-1);
    const lastSubmissionDate = new Date(lastSubmissionISOString);

    if (now.getTime() < lastSubmissionDate.getTime() + MIN_DELAY_BETWEEN_SUBMISSIONS) {
      logger(`checkAndSaveData controller ERROR: last submission done on ${lastSubmissionISOString} too recent`);

      const {
        dateStr,
        timeStr,
      } = datePlusDurationToStr(lastSubmissionDate, 0, language);

      res.json({
        success: false,
        data: {
          issues: {
            generic: [res.__('recentSubmissionError {{dateStr}} {{timeStr}} {{minDelay}}', {
              dateStr,
              minDelay: MIN_DELAY_BETWEEN_SUBMISSIONS / 60_000,
              timeStr,
            })],
          },
        },
      });

      return await deleteFilesFromServer(next);
    }
  }

  const submissionFolderName = `Soumission du ${now.toISOString()}`;
  logger(`checkAndSaveData controller: create submission folder in Google Drive named "${submissionFolderName}"`);
  const { id: submissionFolderId } = await gdrive.createFolder({
    auth,
    name: submissionFolderName,
    parent: challengerFolderId,
  });

  // Send email
  logger('checkAndSaveData controller: notify by email');
  mailer.notify({
    challengerFolderId,
    firstname,
    lastname,
    submissionFolderId,
    text,
  });

  // Save text file on Google Drive
  logger('checkAndSaveData controller: save text file in Google Drive');
  await gdrive.saveFile({
    auth,
    buffer: text,
    fileName: 'Challenger text.txt',
    folderId: submissionFolderId,
    mimeType: 'text/plain',
  });

  // Save photos on Google Drive
  logger('checkAndSaveData controller: save photo files in Google Drive');
  await gdrive.saveFiles({
    auth,
    files: photoFiles,
    folderId: submissionFolderId,
  });

  // Save GPX files on Google Drive
  logger('checkAndSaveData controller: create gpx folder in Google Drive');
  const { id: gpxFolderId } = await gdrive.createFolder({
    auth,
    name: 'challengerGpx',
    parent: submissionFolderId,
  });

  logger('checkAndSaveData controller: save gpx files in Google Drive');
  await gdrive.saveFiles({
    auth,
    files: gpxFiles,
    folderId: gpxFolderId,
  });

  const gpxFilelist = gpxFiles.map((file) => filenameAsUTF8(file.originalname));
  const photoFilelist = photoFiles.map((file) => filenameAsUTF8(file.originalname));

  logger('checkAndSaveData controller: send response to browser');
  res.json({
    success: true,
    data: {
      text,
      gpxFilelist,
      photoFilelist,
    },
  });

  // Delete gpx & photo files from server
  logger('checkAndSaveData controller: start deleting files from server');
  await deleteFilesFromServer(next);

  // Compare tracks
  logger('checkAndSaveData controller: before compareTracks worker launch');
  try {
    await compare({
      auth,
      challengerFolderId,
      challPoints,
      firstname,
      lastname,
      submissionFolderId,
    }, language);
  } catch (error) {
    logger(`checkAndSaveData controller ERROR during comparison: ${error.message}`);
    logger('checkAndSaveData controller: writing error file on Google Drive');

    await gdrive.saveFile({
      auth,
      buffer: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      fileName: 'Error during reference GPX upload or GPX comparison.txt',
      folderId: submissionFolderId,
      mimeType: 'text/plain',
    });
  }

  logger('checkAndSaveData controller: request ENDED');
};

module.exports = checkAndSaveData;
