'use strict';

/* eslint-disable no-undef */

document.getElementById('form').addEventListener('submit', submitForm);

const translationsMapping = {
  fr: {
    analysisInProgress: 'Analyse des fichiers en cours. Ne fermez pas cette fenêtre, cette analyse peut durer quelques minutes si vos fichiers sont volumineux',
    photos: 'Photos',
    gpxFiles: 'Fichiers GPX',
  },
  en: {
    analysisInProgress: 'File analysis in progress. Do not close this window, as the analysis may take a few minutes if your files are large',
    photos: 'Photos',
    gpxFiles: 'GPX Files',
  },
  de: {
    analysisInProgress: 'Dateianalyse läuft. Schließen Sie dieses Fenster nicht, da die Analyse einige Minuten dauern kann, wenn Ihre Dateien groß sind',
    photos: 'Fotos',
    gpxFiles: 'GPX-Dateien',
  },
};

async function submitForm(event) {
  event.preventDefault();

  const language = document.documentElement.getAttribute('lang');
  const genericIssuesEl = document.getElementById('genericIssues');
  const gpxIssuesEl = document.getElementById('gpxIssues');
  const gpxFilesInputEl = document.getElementById('gpxFilesInput');
  const messageEl = document.getElementById('message');
  const photoFilesInputEl = document.getElementById('photoFilesInput');
  const photoIssuesEl = document.getElementById('photoIssues');
  const submitButtonEl = document.getElementById('submitButton');
  const textInputEl = document.getElementById('textInput');
  const textIssuesEl = document.getElementById('textIssues');

  const translations = Object.keys(translationsMapping).includes(language) ? translationsMapping[language] : translationsMapping.fr;

  // Update the display when the submit button is clicked
  genericIssuesEl.innerText = '';
  gpxIssuesEl.innerText = '';
  gpxFilesInputEl.disabled = true;
  messageEl.innerHTML = translations.analysisInProgress;
  messageEl.classList.toggle('d-none');
  photoIssuesEl.innerText = '';
  photoFilesInputEl.disabled = true;
  submitButtonEl.disabled = true;
  textInputEl.disabled = true;
  textIssuesEl.innerText = '';

  // Build a FormData object to POST the form later
  const challengerFolderId = document.getElementById('challengerFolderId').value;
  const firstname = document.getElementById('firstname').value;
  const lastname = document.getElementById('lastname').value;
  const formData = new FormData();
  formData.append('challengerFolderId', challengerFolderId);
  formData.append('firstname', firstname);
  formData.append('lastname', lastname);
  formData.append('text', textInputEl.value);
  Array.from(gpxFilesInputEl.files).forEach((file) => formData.append('gpxFiles', file));
  Array.from(photoFilesInputEl.files).forEach((file) => formData.append('photoFiles', file));

  try {
    console.log(`Request will be sent with Google Drive folder id: ${challengerFolderId}`);
    // POST the form data to check and maybe upload data
    const response = await fetch(`/?language=${language}`, {
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
      document.getElementById('successText').innerText = data.text;
      document.getElementById('successPhotos').innerText = `${translations.photos} : ${data.photoFilelist.map((el) => `"${el}"`).join(', ')}`;
      document.getElementById('successGpx').innerText = `${translations.gpxFiles} : ${data.gpxFilelist.map((el) => `"${el}"`).join(', ')}`;
    } else {
      const {
        issues: {
          generic = [],
          gpxFiles = [],
          photoFiles = [],
          text = [],
        },
      } = data;

      const genericIssuesString = generic?.join('\n');
      const gpxIssuesString = gpxFiles?.join('\n');
      const photoIssuesString = photoFiles?.join('\n');
      const textIssuesString = text?.join('\n');

      genericIssuesEl.innerText = genericIssuesString,
      gpxIssuesEl.innerText = gpxIssuesString;
      photoIssuesEl.innerText = photoIssuesString;
      submitButtonEl.disabled = false;
      gpxFilesInputEl.disabled = false;
      photoFilesInputEl.disabled = false;
      textInputEl.disabled = false;
      textIssuesEl.innerText = textIssuesString;
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
