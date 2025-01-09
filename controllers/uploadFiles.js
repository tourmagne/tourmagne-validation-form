'use strict';

const multer = require('multer');

const {
  MAX_FILE_SIZE,
  MAX_GPX_NB,
  MAX_PHOTO_NB,
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
  // Store request specific data in request.user
  req.user = {
    fieldCounts: {},
    hasTooManyGpxFiles: false,
    hasTooManyPhotoFiles: false,
    issues: {
      generic: [],
      gpxFiles: [],
      photoFiles: [],
      text: [],
    },
  };

  const storage = multer.memoryStorage();

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
    console.log('upload controller: started');

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

    if (req.user.issues.gpxFiles.length || req.user.issues.photoFiles.length) {
      console.log('upload controller: returning an handled error');
      res.json({
        success: false,
        data: {
          issues: req.user.issues,
        },
      });

      return;
    }

    // Other errors (not handled here)
    if (err) {
      console.log('upload controller: returning an unhandled error');
      return next(err);
    }

    console.log('upload controller: going to the next controller');
    next();
  });
}

module.exports = uploadFiles;
