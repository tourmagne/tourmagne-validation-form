'use strict';

const multer = require('multer');
const path = require('path');

const {
  MAX_GPX_NB,
  MAX_GPX_SIZE,
  MAX_PHOTO_NB,
  MAX_PHOTO_SIZE,
} = require('../constants');

// Custom file filter to check file size
const fileFilter = (req, file, cb) => {
  const fieldCounts = req.fieldCounts || {};
  fieldCounts[file.fieldname] = (fieldCounts[file.fieldname] || 0) + 1;

  req.fieldCounts = fieldCounts;

  if ((file.fieldname === 'photoFiles' && fieldCounts[file.fieldname] > MAX_PHOTO_NB)
    || (file.fieldname === 'gpxFiles' && fieldCounts[file.fieldname] > MAX_GPX_NB)) {
    return cb(new multer.MulterError('LIMIT_FILE_COUNT', file.fieldname), false);
  }

  if ((file.fieldname === 'photoFiles' && file.size > MAX_PHOTO_SIZE)
    || (file.fieldname === 'gpxFiles' && file.size > MAX_GPX_SIZE)) {
    return cb(new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname), false);
  }

  cb(null, true); // Accept the file if it meets the requirements
};

const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  fileFilter,
}).fields([
  { name: 'photoFiles' },
  { name: 'gpxFiles' },
]);

function uploadFiles(req, res, next) {
  upload(req, res, function (err) {
    if (err && err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      const issues = {
        gpxIssues: [],
        photoIssues: [],
      };

      if (err.field === 'gpxFiles') {
        issues.gpxIssues.push(err.message);
      }

      if (err.field === 'photoFiles') {
        issues.photoIssues.push(err.message);
      }

      res.json({
        success: false,
        data: {
          issues,
        },
      });

      return;
    } else if (err) {
      throw err;
    }

    next();
  });
}

module.exports = uploadFiles;
