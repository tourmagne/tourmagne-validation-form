'use strict';

// Same function as in https://www.npmjs.com/package/express-async-handler

module.exports = (fn) => (...args) => {
  const next = args.at(-1);
  Promise.resolve(fn(...args)).catch(next);
};
