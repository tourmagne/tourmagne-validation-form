'use strict';

function submitForm(req, res) {
  const {
    params: {
      id: folderId,
    },
  } = req;

  const locals = {
    folderId,
  };

  res.render('submitForm', locals);
}

module.exports = submitForm;
