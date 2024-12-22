'use strict';

function displayForm(req, res) {
  const {
    query: {
      id: challengerFolderId,
    },
  } = req;

  const locals = {
    challengerFolderId,
    textInput: 'Raconte nous une anecdote ici...',
  };

  res.render('form', locals);
}

module.exports = displayForm;
