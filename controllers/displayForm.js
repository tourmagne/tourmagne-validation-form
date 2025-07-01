'use strict';

const {
  MAX_FILE_SIZE,
  MAX_GPX_NB,
  MAX_PHOTO_NB,
  MAX_TEXT_LENGTH,
  MIN_TEXT_LENGTH,
} = require('../constants');

function displayForm(req, res) {
  const {
    query: {
      firstname,
      id: challengerFolderId,
      lastname,
    },
  } = req;

  const language = res.getLocale();

  const locals = {
    challengerFolderId,
    firstname,
    language,
    lastname,
    maxFileSizeMo: MAX_FILE_SIZE / (1024 * 1024),
    maxGpxNb: MAX_GPX_NB,
    maxPhotoNb: MAX_PHOTO_NB,
    minTextLength: MIN_TEXT_LENGTH,
    maxTextLength: MAX_TEXT_LENGTH,
  };

  res.render(`${language}/form`, locals);
}

module.exports = displayForm;
