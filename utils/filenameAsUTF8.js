'use strict';

// Function to fix encoding issue with multer (see https://github.com/expressjs/multer/issues/1104)
function filenameAsUTF8(originalname) {
  return Buffer.from(originalname, 'latin1').toString('utf8');
}

module.exports = filenameAsUTF8;
