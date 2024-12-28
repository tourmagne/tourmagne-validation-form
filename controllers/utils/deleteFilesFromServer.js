'use strict';

const fs = require('fs').promises;
const path = require('path');

const folderPath = path.join(__dirname, '../../uploads');

async function deleteFilesFromServer(next) {
  try {
    const files = await fs.readdir(folderPath);
    const deletePromises = files.map((file) =>
      fs.unlink(path.join(folderPath, file)),
    );
    await Promise.all(deletePromises);
    console.log(`All files deleted from ${folderPath}`);
  } catch (err) {
    next(err);
  }
}

module.exports = deleteFilesFromServer;
