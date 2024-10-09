'use strict';

require('dotenv').config();

const app = require('./app');
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('ERROR - Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('ERROR - uncaughtException', (err) => {
  console.error('There was an uncaught error:', err);
});
