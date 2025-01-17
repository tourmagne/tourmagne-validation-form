'use strict';

const fs = require('fs').promises;
const path = require('path');

const folderPath = path.join(__dirname, '../temp');

async function deleteFilesFromServer(next) {
  try {
    const files = await fs.readdir(folderPath);

    // Do not delete .gitkeep so that uploads folder stays synced on Github
    const filesToDelete = files.filter((file) => file !== '.gitkeep');

    const deletePromises = filesToDelete.map((file) =>
      fs.unlink(path.join(folderPath, file)),
    );

    await Promise.all(deletePromises);

    console.log(`All files deleted from ${folderPath}`);
  } catch (err) {
    next(err);
  }
}

module.exports = deleteFilesFromServer;
