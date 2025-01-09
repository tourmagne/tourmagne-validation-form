'use strict';

const {
  MAX_FILE_SIZE,
  MAX_GPX_NB,
  MAX_PHOTO_NB,
} = require('../constants');

function displayForm(req, res) {
  const {
    query: {
      firstname,
      id: challengerFolderId,
      lastname,
    },
  } = req;

  const locals = {
    challengerFolderId,
    firstname,
    lastname,
    maxFileSizeMo: MAX_FILE_SIZE / (1024 * 1024),
    maxGpxNb: MAX_GPX_NB,
    maxPhotoNb: MAX_PHOTO_NB,
  };

  res.render('form', locals);
}

module.exports = displayForm;
