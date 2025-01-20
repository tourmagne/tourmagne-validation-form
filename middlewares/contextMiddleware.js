'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

const { nanoid } = require('nanoid');

const asyncLocalStorage = new AsyncLocalStorage();

function contextMiddleware(req, res, next) {
  // Store request specific data in request.user
  req.user = {
    fieldCounts: {},
    hasTooManyGpxFiles: false,
    hasTooManyPhotoFiles: false,
    issues: {
      generic: [],
      gpxFiles: [],
      photoFiles: [],
      text: [],
    },
  };

  // Create logger in AsyncLocalStorage
  const requestId = nanoid(6);

  function logger(message) {
    console.log(`${requestId} - ${message}`);
  }

  const context = {
    logger,
    requestId,
  };

  asyncLocalStorage.run(context, () => {
    next();
  });
}

module.exports = {
  asyncLocalStorage,
  contextMiddleware,
};
