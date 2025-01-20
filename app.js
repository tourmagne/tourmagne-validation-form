'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

const express = require('express');
const exphbs = require('express-handlebars');
const helmet = require('helmet');
const path = require('path');

const checkAndSaveData = require('./controllers/checkAndSaveData');
const displayForm = require('./controllers/displayForm');
const uploadFiles = require('./controllers/uploadFiles');

const { contextMiddleware } = require('./middlewares/contextMiddleware');

const asyncHandler = require('./utils/ayncHandler');
const deleteFilesFromServer = require('./utils/deleteFilesFromServer');

const app = express();

app.engine('hbs', exphbs.engine({
  extname: 'hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(contextMiddleware);
app.use(express.json()); // body parser
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ['\'self\''],
        'script-src': ['\'self\'', 'https://cdn.jsdelivr.net'],
      },
    },
  }),
);

// Workaround to make sure the asyncLocalStorage "passes through" multer middleware (see https://github.com/expressjs/multer/issues/814)
function ensureAsyncContext(middleware) {
  return (req, res, next) => middleware(req, res, AsyncLocalStorage.bind(next));
}

// Mount routes
app.get('/', displayForm);
app.post('/',
  ensureAsyncContext(uploadFiles),
  asyncHandler(checkAndSaveData),
);

// Error handler
app.use(async (err, req, res, next) => {
  await deleteFilesFromServer(next);

  if (res.headersSent) {
    return next(err);
  }

  req.user.issues.generic.push(err.message);

  res.status(500).json({
    sucess: false,
    data: {
      issues: req.user.issues,
    },
  });
});

module.exports = app;
