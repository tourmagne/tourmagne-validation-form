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

  const messageEl = document.querySelector('#message');

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
      document.getElementById('result').innerText = 'Données soumises !';
      document.getElementById('infos').innerText = 'Vous pouvez fermer cette fenêtre';
    } else {
      document.getElementById('result').innerText = 'Vos fichiers GPX ne sont pas conformes';
      document.getElementById('infos').innerText = issueString;
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
