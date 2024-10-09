'use strict';

const asyncHandler = require('./utils/ayncHandler');
const express = require('express');
const multer = require('multer');
const path = require('path');

const submitForm = require('./controllers/submitForm');
const validate = require('./controllers/validate');

const app = express();
const upload = multer({ dest: path.join(__dirname, '../uploads/') });

// Middlewares
// app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // body parser

// Mount routes
app.get('/:id', submitForm);
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
