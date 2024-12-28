'use strict';

const multer = require('multer');
const path = require('path');

const {
  MAX_FILE_SIZE,
  MAX_GPX_NB,
  MAX_PHOTO_NB,
} = require('../constants');
const deleteFilesFromServer = require('./utils/deleteFilesFromServer');

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
  };

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(__dirname, '../uploads'));
    },
    filename: function (req, file, cb) {
      cb(null, `${new Date().toISOString()} - ${file.originalname}`);
    },
  });

  const upload = multer({
    dest: path.join(__dirname, '../uploads'),
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
    const issues = {
      gpxFiles: [],
      photoFiles: [],
    };

    if (req.user.hasTooManyGpxFiles) {
      issues.gpxFiles.push(`Le nombre de fichiers GPX dépasse le maximum (${MAX_GPX_NB} maximum)`);
    }

    if (req.user.hasTooManyPhotoFiles) {
      issues.photoFiles.push(`Le nombre de photos dépasse le maximum (${MAX_PHOTO_NB} maximum)`);
    }

    // Handled errors
    if (err && err instanceof multer.MulterError && err.code === LIMIT_FILE_SIZE) {
      if (err.field === 'gpxFiles') {
        issues.gpxFiles.push(`Certains fichiers GPX sont trop volumineux (max: ${MAX_FILE_SIZE / (1024 * 1024)} Mo)`);
      }

      if (err.field === 'photoFiles') {
        issues.photoFiles.push(`Certaines photos sont trop volumineuses (max: ${MAX_FILE_SIZE / (1024 * 1024)} Mo)`);
      }
    }

    if (issues.gpxFiles.length || issues.photoFiles.length) {
      await deleteFilesFromServer(next);

      res.json({
        success: false,
        data: {
          issues,
        },
      });

      return;
    }

    // Other errors (not handled here)
    if (err) {
      return next(err);
    }

    next();
  });
}

module.exports = uploadFiles;
