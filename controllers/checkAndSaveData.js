'use strict';

const { Worker } = require('node:worker_threads');
const fs = require('fs').promises;
const path = require('path');

const {
  gdrive,
  mailer,
} = require('../services');
const deleteFilesFromServer = require('../utils/deleteFilesFromServer');
const filenameAsUTF8 = require('../utils/filenameAsUTF8');

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
const generateHtmlFile = require('../utils/generateHtmlFile');

async function compare({
  auth,
  challengerFolderId,
  challPoints,
  firstname,
  lastname,
  submissionFolderId,
}) {
  const filename = REF_TRACK_FILENAME;

  // Check if reference track available on Google Drive
  let refGpxString;

  refGpxString = await gdrive.readFile({
    auth,
    filename,
    folderId: challengerFolderId,
  });

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

  const htmlFile = generateHtmlFile({
    firstname,
    lastname,
    results,
  });

  // Write result html file to Google Drive
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

    // Prepare transferable objects (ArrayBuffer) for challGpxStrings
    const transferList = workerData.strs.map((str) => {
      const encoder = new TextEncoder();
      return encoder.encode(str).buffer;
    });

    const transferableData = {
      ...workerData,
      strs: transferList,
    };

    const worker = new Worker(workerPath);
    worker.postMessage(transferableData, transferList);

    worker.on('message', (result) => resolve(result));
    worker.on('error', (error) => reject(error));
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      } else {
        console.log(`runParceGpxWorker: worker succesfully exited`);
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
      } else {
        console.log(`runParceGpxWorker: worker succesfully exited`);
      }
    });
  });
}

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

  console.log('checkAndSave - start', process.memoryUsage().heapUsed / (1024 * 1024));

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

  // Early return if text is too short or too long
  if (text.length < MIN_TEXT_LENGTH) {
    console.log('checkAndSaveData controller ERROR: text too short');
    req.user.issues.text.push(`Tu as vécu une grande aventure, on compte sur toi pour nous en dire un peu plus !`);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    console.log('checkAndSaveData controller ERROR: text too long');
    req.user.issues.text.push(`Le text est trop long (${text.length})`);
  }

  if (req.user.issues.text.length > 0) {
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

  console.log('checkAndSave - after challGpxString', process.memoryUsage().heapUsed / (1024 * 1024));

  console.log('checkAndSaveData controller: before parseGpx worker launch');

  const result = await runParseGpxWorker({
    filenames: gpxFiles.map((file) => file.originalname),
    strs: challGpxStrings,
    options: { challengerGpx: true },
  });

  console.log('checkAndSave - after worker parse', process.memoryUsage().heapUsed / (1024 * 1024));

  let challPoints;
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

    return await deleteFilesFromServer(next);
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
  await gdrive.saveFiles({
    auth,
    files: photoFiles,
    folderId: submissionFolderId,
  });

  // Save GPX files on Google Drive
  console.log('checkAndSaveData controller: create gpx folder in Google Drive');
  const { id: gpxFolderId } = await gdrive.createFolder({
    auth,
    name: 'challengerGpx',
    parent: submissionFolderId,
  });

  console.log('checkAndSaveData controller: save gpx files in Google Drive');
  await gdrive.saveFiles({
    auth,
    files: gpxFiles,
    folderId: gpxFolderId,
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

  // Delete gpx & photo files from server
  console.log('checkAndSaveData controller: start deleting files from server');
  await deleteFilesFromServer(next);

  console.log('checkAndSave - before worker compare', process.memoryUsage().heapUsed / (1024 * 1024));

  // Compare tracks
  console.log('checkAndSaveData controller: before compareTracks worker launch');
  try {
    await compare({
      auth,
      challengerFolderId,
      challPoints,
      firstname,
      lastname,
      submissionFolderId,
    });
    console.log('checkAndSave - after worker compare', process.memoryUsage().heapUsed / (1024 * 1024));
  } catch (error) {
    console.log(`checkAndSaveData controller ERROR during comparison: ${error.message}`);
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
