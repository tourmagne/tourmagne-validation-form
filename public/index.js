'use strict';

/* eslint-disable no-undef */

// ------ DOM ------//
const formEl = document.getElementById('form');

// ------ EVENT LISTENERS ------//
formEl.addEventListener('submit', submitForm);

// ------ METHODS ------//
async function submitForm(event) {
  event.preventDefault(); // Prevent the default form submission

  const gpxFilesInputEl = document.getElementById('gpxFilesInput');
  const photoFilesInputEl = document.getElementById('photoFilesInput');
  const challengerFolderIdEl = document.getElementById('challengerFolderId');
  const textInputEl = document.getElementById('textInput');

  const gpxErrorsEl = document.getElementById('gpxErrors');
  const messageEl = document.querySelector('#message');
  const resultsEl = document.querySelector('#results');
  const successInfosEl = document.getElementById('successInfos');
  const submitButtonEl = document.getElementById('submitButton');

  submitButtonEl.disabled = true;
  gpxErrorsEl.innerText = '';

  const challengerFolderId = challengerFolderIdEl.value;
  const text = textInputEl.value;

  const formData = new FormData();

  for (const file of gpxFilesInputEl.files) {
    formData.append('gpxFiles', file);
  }

  for (const file of photoFilesInputEl.files) {
    formData.append('photoFiles', file);
  }

  formData.append('text', text);
  formData.append('challengerFolderId', challengerFolderId);

  try {
    messageEl.innerHTML = 'Analyse des fichiers en cours';
    messageEl.classList.toggle('d-none');

    const response = await fetch('/', {
      method: 'POST',
      body: formData,
    });

    const issueString = await response.text();

    messageEl.classList.toggle('d-none');
    messageEl.innerHTML = '';

    if (!issueString) {
      resultsEl.classList.remove('d-none');
      const successInfosHTML = `<p>Les données suivantes ont bien été prises en compte:<p>
      <ul>Votre texte ci-dessus</ul>`;
      successInfosEl.innerHTML = successInfosHTML;
    } else {
      gpxErrorsEl.innerText = issueString;
      submitButtonEl.disabled = false;
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
