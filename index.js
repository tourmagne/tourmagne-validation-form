'use strict';

const env = process.env.NODE_ENV || 'dev';

require('@dotenvx/dotenvx').config({
  path: `.env.${env}`,
});

const app = require('./app');
const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('ERROR - Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('ERROR - uncaughtException', (err) => {
  console.error('There was an uncaught error:', err);
});

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

// Handle termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
