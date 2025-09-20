'use strict';

let constants;

switch (process.env.NODE_ENV) {
  case 'production':
    constants = {
      LANGUAGES: ['fr', 'en', 'de'],
      MIN_CHALLENGER_GPX_POINTS: 40_000,
      MIN_DELAY_BETWEEN_SUBMISSIONS: 3600 * 1000, // one hour in ms
      MAX_FILE_SIZE: 40 * 1024 * 1024,
      MAX_GPX_NB: 20,
      MAX_PHOTO_NB: 5,
      MIN_TEXT_LENGTH: 50, // in string length
      MAX_TEXT_LENGTH: 10_000, // in string length
      COMPARATOR_OPTIONS: {
        MAX_DETOUR: 100_000, // in meters
        MAX_SEG_LENGTH: 200, // in meters
        REF_TRACK_FILENAME: 'monotrace.gpx',
        ROLLING_DURATION: 24, // in hours
        TOLERANCE: 80, // in meters
        TRIGGER: 8, // in meters - trigger must be less than tolerance
      },
    };
    break;
  case 'dev':
    constants = {
      LANGUAGES: ['fr', 'en', 'de'],
      MIN_CHALLENGER_GPX_POINTS: 5000,
      MIN_DELAY_BETWEEN_SUBMISSIONS: 60 * 1000, // one minute in ms
      MAX_FILE_SIZE: 2 * 1024 * 1024,
      MAX_GPX_NB: 3,
      MAX_PHOTO_NB: 2,
      MIN_TEXT_LENGTH: 5, // in string length
      MAX_TEXT_LENGTH: 10_000, // in string length
      COMPARATOR_OPTIONS: {
        MAX_DETOUR: 20_000, // in meters
        MAX_SEG_LENGTH: 200, // in meters
        REF_TRACK_FILENAME: 'mini-monotrace.gpx',
        ROLLING_DURATION: 1, // in hours
        TOLERANCE: 80, // in meters
        TRIGGER: 8, // in meters - trigger must be less than tolerance
      },
    };
    break;
  default:
    throw new Error ('Incorrect NODE_ENV');
}

module.exports = constants;
