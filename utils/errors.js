'use strict';

class ParsingError extends Error {
  constructor(message, data) {
    super(message);
    this.data = data;
  }
}

class FileError extends Error {
  constructor(message) {
    super(message);
  }
}

module.exports = {
  ParsingError,
  FileError,
};
