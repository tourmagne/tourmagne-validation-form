'use strict';

// For dev & tests:
module.exports = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  MAX_GPX_NB: 2,
  MAX_PHOTO_NB: 2,
  COMPARATOR_OPTIONS: {
    MAX_DETOUR: 20000, // in meters
    MAX_SEG_LENGTH: 200, // in meters
    REF_TRACK_FILENAME: 'monotrace.gpx',
    ROLLING_DURATION: 1, // in hours
    TOLERANCE: 80, // in meters
    TRIGGER: 8, // in meters - trigger must be less than tolerance
  },
};

// For production:
// module.exports = {
//   MAX_FILE_SIZE: 25 * 1024 * 1024,
//   MAX_GPX_NB: 20,
//   MAX_PHOTO_NB: 10,
// };
