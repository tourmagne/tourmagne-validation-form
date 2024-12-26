'use strict';

const multer = require('multer');
const path = require('path');

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
  }

  if (fieldName === 'gpxFiles' && fieldCounts[fieldName] > MAX_GPX_NB) {
    req.user.hasTooManyGpxFiles = true;
    cb(null, false);
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

  const upload = multer({
    dest: path.join(__dirname, '../uploads'),
    fileFilter,
    limits: {
      fileSize: Math.max(MAX_FILE_SIZE),
    },
  }).fields([
    { name: 'photoFiles' },
    { name: 'gpxFiles' },
  ]);

  upload(req, res, function (err) {
    const issues = {
      gpxIssues: [],
      photoIssues: [],
    };

    if (req.user.hasTooManyGpxFiles) {
      issues.gpxIssues.push(`Le nombre de fichiers GPX dépasse le maximum (${MAX_GPX_NB} maximum)`);
    }

    if (req.user.hasTooManyPhotoFiles) {
      issues.photoIssues.push(`Le nombre de photos dépasse le maximum (${MAX_PHOTO_NB} maximum)`);
    }

    if (err && err instanceof multer.MulterError && err.code === LIMIT_FILE_SIZE) {
      if (err.field === 'gpxFiles') {
        issues.gpxIssues.push(`Certains fichiers GPX sont trop volumineux (max: ${MAX_FILE_SIZE / (1024 * 1024)} Mo)`);
      }

      if (err.field === 'photoFiles') {
        issues.gpxIssues.push(`Certaines photos sont trop volumineuses (max: ${MAX_FILE_SIZE / (1024 * 1024)} Mo)`);
      }
    }

    if (issues.gpxIssues.length || issues.photoIssues.length) {
      res.json({
        success: false,
        data: {
          issues,
        },
      });

      return;
    }

    if (err) {
      throw err;
    }

    next();
  });
}

module.exports = uploadFiles;
