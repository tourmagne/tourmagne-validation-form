'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');

const express = require('express');
const exphbs = require('express-handlebars');
const helmet = require('helmet');
const i18n = require('i18n');
const path = require('path');

const { LANGUAGES } = require('./constants');
const checkAndSaveData = require('./controllers/checkAndSaveData');
const displayForm = require('./controllers/displayForm');
const uploadFiles = require('./controllers/uploadFiles');

const {
  asyncLocalStorage,
  contextMiddleware,
} = require('./middlewares/contextMiddleware');

const asyncHandler = require('./utils/ayncHandler');
const deleteFilesFromServer = require('./utils/deleteFilesFromServer');

const app = express();

// Configure i18n
i18n.configure({
  locales: LANGUAGES,
  directory: __dirname + '/locales',
});

// Configure handlebars
app.engine('hbs', exphbs.engine({
  extname: 'hbs',
  defaultLayout: 'main',
  helpers: {
    __: function () {
      return i18n.__.apply(this, arguments);
    },
  },
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
}));

app.set('view engine', 'hbs');

// Middlewares
app.use(i18n.init);
app.use((req, res, next) => {
  let {
    query: {
      language,
    },
  } = req;

  if (!LANGUAGES.includes(language)) {
    language = LANGUAGES[0];
  }

  res.setLocale(language);
  next();
});
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
  const { logger } = asyncLocalStorage.getStore();

  logger(`Error handler: ${err.message}`);

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
