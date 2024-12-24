'use strict';

const asyncHandler = require('./utils/ayncHandler');
const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');

const checkAndUploadData = require('./controllers/checkAndUploadData');
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

// Mount routes
app.get('/', displayForm);
app.post('/',
  asyncHandler(uploadFiles),
  asyncHandler(checkAndUploadData));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500).send('Internal Server Error');
});

module.exports = app;
