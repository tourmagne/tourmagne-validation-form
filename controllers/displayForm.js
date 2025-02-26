'use strict';

const {
  LANGUAGES,
  MAX_FILE_SIZE,
  MAX_GPX_NB,
  MAX_PHOTO_NB,
} = require('../constants');

function displayForm(req, res) {
  const {
    query: {
      firstname,
      id: challengerFolderId,
      language = LANGUAGES[0],
      lastname,
    },
  } = req;

  if (!LANGUAGES.includes(language)) {
    return res.render(`unknownLanguage`, { language });
  }

  req.setLocale(language);

  const locals = {
    challengerFolderId,
    firstname,
    lastname,
    maxFileSizeMo: MAX_FILE_SIZE / (1024 * 1024),
    maxGpxNb: MAX_GPX_NB,
    maxPhotoNb: MAX_PHOTO_NB,
  };

  res.render(`${language}/form`, locals);
}

module.exports = displayForm;
