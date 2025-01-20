'use strict';

const fs = require('fs');
const multer = require('multer');
const path = require('path');

const { asyncLocalStorage } = require('../middlewares/contextMiddleware');
const deleteFilesFromServer = require('../utils/deleteFilesFromServer');

const {
  MAX_FILE_SIZE,
  MAX_GPX_NB,
  MAX_PHOTO_NB,
  MAX_TEXT_LENGTH,
  MIN_TEXT_LENGTH,
} = require('../constants');

const LIMIT_FILE_SIZE = 'LIMIT_FILE_SIZE';

// Custom file filter to check file number (maxCount does not work well https://github.com/expressjs/multer/issues/1057)
const fileFilter = (req, file, cb) => {
  const fieldCounts = req.user.fieldCounts || {};
  const fieldName = file.fieldname;

  fieldCounts[fieldName] = (fieldCounts[fieldName] || 0) + 1;

  req.user.fieldCounts = fieldCounts;

  if (fieldName === 'photoFiles' && fieldCounts[fieldName] > MAX_PHOTO_NB) {
    req.user.hasTooManyPhotoFiles = true;
    cb(null, false);

    return;
  }

  if (fieldName === 'gpxFiles' && fieldCounts[fieldName] > MAX_GPX_NB) {
    req.user.hasTooManyGpxFiles = true;
    cb(null, false);

    return;
  }

  cb(null, true); // Accept the file if it meets the requirements
};

function uploadFiles(req, res, next) {
  const {
    logger,
    requestId,
  } = asyncLocalStorage.getStore();

  const destinationFolderPath = path.join(__dirname, `../temp/${requestId}`);

  if (!fs.existsSync(destinationFolderPath)) {
    fs.mkdirSync(destinationFolderPath);
    logger('Upload controller - Folder created successfully!');
  } else {
    logger('Upload controller - Folder already exists.');
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, destinationFolderPath);
    },
    filename: function (req, file, cb) {
      cb(null, `${new Date().toISOString()} - ${file.originalname}`);
    },
  });

  const upload = multer({
    fileFilter,
    limits: {
      fileSize: Math.max(MAX_FILE_SIZE),
    },
    storage,
  }).fields([
    { name: 'gpxFiles' },
    { name: 'photoFiles' },
  ]);

  upload(req, res, async function (err) {
    const {
      body: {
        firstname,
        lastname,
        text,
      } = {},
    } = req;

    logger(`upload controller: started for ${firstname} ${lastname}`);

    if (text.length < MIN_TEXT_LENGTH) {
      logger('checkAndSaveData controller ERROR: text too short');
      req.user.issues.text.push(`Tu as vécu une grande aventure, on compte sur toi pour nous en dire un peu plus !`);
    }
    if (text.length > MAX_TEXT_LENGTH) {
      logger('checkAndSaveData controller ERROR: text too long');
      req.user.issues.text.push(`Le text est trop long (maximum : ${MAX_TEXT_LENGTH} caractères)`);
    }

    if (req.user.hasTooManyGpxFiles) {
      req.user.issues.gpxFiles.push(`Le nombre de fichiers GPX dépasse le maximum (${MAX_GPX_NB} maximum)`);
    }

    if (req.user.hasTooManyPhotoFiles) {
      req.user.issues.photoFiles.push(`Le nombre de photos dépasse le maximum (${MAX_PHOTO_NB} maximum)`);
    }

    // Handled errors
    if (err && err instanceof multer.MulterError && err.code === LIMIT_FILE_SIZE) {
      if (err.field === 'gpxFiles') {
        req.user.issues.gpxFiles.push(`Certains fichiers GPX sont trop volumineux (max: ${MAX_FILE_SIZE / (1024 * 1024)} Mo)`);
      }

      if (err.field === 'photoFiles') {
        req.user.issues.photoFiles.push(`Certaines photos sont trop volumineuses (max: ${MAX_FILE_SIZE / (1024 * 1024)} Mo)`);
      }
    }

    if (req.user.issues.gpxFiles.length
      || req.user.issues.photoFiles.length
      || req.user.issues.text.length
    ) {
      logger('upload controller ERROR: error in form input (gpx, photos or text)');

      res.json({
        success: false,
        data: {
          issues: req.user.issues,
        },
      });

      // Pass logger and requestId because under certain circumstances (??), asyncLocalStorage.getStore() is undefined in deleteFilesFromServer
      return await deleteFilesFromServer(next, { logger, requestId });
    }

    // Other errors (not handled here)
    if (err) {
      logger('upload controller ERROR - Unhandled');
      return next(err);
    }

    logger('upload controller: finished');
    next();
  });
}

module.exports = uploadFiles;
