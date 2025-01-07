'use strict';

class ParsingError extends Error {
  constructor(message) {
    super(message);
  }
}

module.exports = ParsingError;
