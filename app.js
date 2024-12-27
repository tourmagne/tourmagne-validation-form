'use strict';

const asyncHandler = require('./utils/ayncHandler');
const express = require('express');
const exphbs = require('express-handlebars');
const helmet = require('helmet');
const path = require('path');

const checkAndSaveData = require('./controllers/checkAndSaveData');
const displayForm = require('./controllers/displayForm');
const uploadFiles = require('./controllers/uploadFiles');

const app = express();

app.engine('hbs', exphbs.engine({
  extname: 'hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.json()); // body parser
app.use('/public', express.static(path.join(__dirname, 'public')));
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

// Mount routes
app.get('/', displayForm);
app.post('/',
  uploadFiles,
  asyncHandler(checkAndSaveData),
);

app.use((err, req, res, next) => {
  if (req.xhr) {
    res.status(500).json({
      sucess: false,
      data: {
        issues: {
          generic: [err.message],
        },
      },
    });

    return;
  }

  // Default error handeler
  next(err);
});

module.exports = app;
