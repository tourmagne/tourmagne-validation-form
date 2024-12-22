'use strict';

function displayForm(req, res) {
  const {
    query: {
      id: challengerFolderId,
    },
  } = req;

  const locals = {
    challengerFolderId,
  };

  res.render('form', locals);
}

module.exports = displayForm;
