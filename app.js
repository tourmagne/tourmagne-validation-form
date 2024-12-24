'use strict';

const asyncHandler = require('./utils/ayncHandler');
const express = require('express');
const exphbs = require('express-handlebars');
const multer = require('multer');
const path = require('path');

const {
  MAX_GPX_NB,
  // MAX_GPX_SIZE,
  MAX_PHOTO_NB,
  // MAX_PHOTO_SIZE,
} = require('./constants');
const displayForm = require('./controllers/displayForm');
const checkAndUploadData = require('./controllers/checkAndUploadData');

const app = express();

app.engine('hbs', exphbs.engine({
  extname: 'hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views', 'layouts'),
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Custom file filter to check file size
// const fileFilter = (req, file, cb) => {
//   if (file.fieldname === 'photoFiles' && file.size > MAX_PHOTO_SIZE) {
//     return cb(new Error('Photo file size exceeds the 5MB limit'), false);
//   } else if (file.fieldname === 'gpxFiles' && file.size > MAX_GPX_SIZE) {
//     return cb(new Error('GPX file size exceeds the 10MB limit'), false);
//   }
//   cb(null, true); // Accept the file if it meets the requirements
// };

const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  // fileFilter,
});

// Middlewares
// app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // body parser
app.use('/public', express.static(path.join(__dirname, 'public')));

// Mount routes
app.get('/', displayForm);
app.post('/',
  upload.fields([
    { name: 'photoFiles', maxCount: MAX_PHOTO_NB },
    { name: 'gpxFiles', maxCount: MAX_GPX_NB },
  ]),
  asyncHandler(checkAndUploadData));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});

module.exports = app;
