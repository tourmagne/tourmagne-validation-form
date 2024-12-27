'use strict';

const fs = require('fs').promises;

async function deleteFilesFromServer(files, next) {
  try {
    await Promise.allSettled(
      files.map(async (file) => {
        const { path } = file;
        await fs.unlink(path);
      }),
    );
    console.log('All files deleted successfully!');
  } catch (err) {
    next(err);
  }
}

module.exports = deleteFilesFromServer;
