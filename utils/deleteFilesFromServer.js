'use strict';

const fs = require('fs').promises;
const path = require('path');

const { asyncLocalStorage } = require('../middlewares/contextMiddleware');

const baseFolder = path.join(__dirname, '../temp');

async function deleteFilesFromServer(next, { logger, requestId } = {}) {
  try {
    const store = asyncLocalStorage.getStore();
    const finalLogger = store ? store.logger : logger;
    const finalRequestId = store ? store.requestId : requestId;
    const folderPath = path.join(baseFolder, finalRequestId);

    const files = await fs.readdir(folderPath);

    const deletePromises = files.map((file) =>
      fs.unlink(path.join(folderPath, file)),
    );

    await Promise.all(deletePromises);
    await fs.rmdir(folderPath);

    finalLogger(`All files deleted from ${folderPath}`);
  } catch (err) {
    next(err);
  }
}

module.exports = deleteFilesFromServer;
