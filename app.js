'use strict';

const asyncHandler = require('./utils/ayncHandler');
const express = require('express');
const exphbs = require('express-handlebars');
const multer = require('multer');
const path = require('path');

const submitForm = require('./controllers/submitForm');
const validate = require('./controllers/validate');

const app = express();

app.engine('hbs', exphbs.engine({
  extname: 'hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

const upload = multer({ dest: path.join(__dirname, 'uploads') });

// Middlewares
// app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // body parser
app.use(express.static(path.join(__dirname, 'public')));

// Mount routes
app.get('/', submitForm);
app.post('/validator', upload.fields([
  { name: 'photoFiles', maxCount: 5 },
  { name: 'gpxFiles', maxCount: 20 },
]), asyncHandler(validate));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});

module.exports = app;
