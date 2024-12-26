'use strict';

// For dev & tests:
module.exports = {
  MAX_GPX_NB: 2,
  MAX_GPX_SIZE: 5 * 1024 * 1024,
  MAX_PHOTO_NB: 2,
  MAX_PHOTO_SIZE: 0.05 * 1024 * 1024, // octets
};

// For production:
// module.exports = {
//   MAX_GPX_NB: 20,
//   MAX_GPX_SIZE: 25 * 1024 * 1024, // octets
//   MAX_PHOTO_NB: 10,
//   MAX_PHOTO_SIZE: 5 *1024 * 1024, // octets
// };
