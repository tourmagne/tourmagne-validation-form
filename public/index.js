'use strict';

/* eslint-disable no-undef */

document.getElementById('form').addEventListener('submit', submitForm);

async function submitForm(event) {
  event.preventDefault();

  const gpxIssuesEl = document.getElementById('gpxErrors');
  const gpxFilesInputEl = document.getElementById('gpxFilesInput');
  const messageEl = document.querySelector('#message');
  const photoFilesInputEl = document.getElementById('photoFilesInput');
  const photoIssuesEl = document.getElementById('photoErrors');
  const submitButtonEl = document.getElementById('submitButton');

  // Update the display when the submit button is clicked
  gpxIssuesEl.innerText = '';
  gpxFilesInputEl.disabled = true;
  messageEl.innerHTML = 'Analyse des fichiers en cours';
  messageEl.classList.toggle('d-none');
  photoIssuesEl.innerText = '';
  photoFilesInputEl.disabled = true;
  submitButtonEl.disabled = true;

  // Build a FormData object to POST the form later
  const formData = new FormData();
  formData.append('challengerFolderId', document.getElementById('challengerFolderId').value);
  formData.append('text', document.getElementById('textInput').value);
  Array.from(gpxFilesInputEl.files).forEach((file) => formData.append('gpxFiles', file));
  Array.from(photoFilesInputEl.files).forEach((file) => formData.append('photoFiles', file));

  try {
    // POST the form data to check and maybe upload data
    const response = await fetch('/', {
      method: 'POST',
      body: formData,
    });

    const json = await response.json();

    const {
      success,
      data,
    } = json;

    // Update the display when data check and potential updload of the file is finishd
    messageEl.classList.toggle('d-none');
    messageEl.innerHTML = '';

    if (success) {
      document.querySelector('#results').classList.remove('d-none');
      document.getElementById('successText').innerText = `Texte : ${data.text}`;
      document.getElementById('successPhotos').innerText = `Photos : ${data.photoFilelist.map((el) => `"${el}"`).join(', ')}`;
      document.getElementById('successGpx').innerText = `Fichiers GPX : ${data.gpxFilelist.map((el) => `"${el}"`).join(', ')}`;
    } else {
      const {
        issues: {
          gpxIssues,
          photoIssues,
        },
      } = data;

      const gpxIssuesString = gpxIssues?.join('\n');
      const photoIssuesString = photoIssues?.join('\n');

      gpxIssuesEl.innerText = gpxIssuesString;
      photoIssuesEl.innerText = photoIssuesString;
      submitButtonEl.disabled = false;
      gpxFilesInputEl.disabled = false;
      photoFilesInputEl.disabled = false;
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
