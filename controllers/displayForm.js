'use strict';

const {
  MAX_GPX_NB,
  MAX_GPX_SIZE,
  MAX_PHOTO_NB,
  MAX_PHOTO_SIZE,
} = require('../constants');

function displayForm(req, res) {
  const {
    query: {
      id: challengerFolderId,
    },
  } = req;

  const locals = {
    challengerFolderId,
    maxGpxNb: MAX_GPX_NB,
    maxGpxSizeMo: MAX_GPX_SIZE / (1024 * 1024),
    maxPhotoNb: MAX_PHOTO_NB,
    maxPhotoSizeMo: MAX_PHOTO_SIZE / (1024 * 1024),
  };

  res.render('form', locals);
}

module.exports = displayForm;
