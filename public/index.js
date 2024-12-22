/* eslint-disable no-undef */
'use strict';

document.getElementById('form').addEventListener('submit', async (event) => {
  event.preventDefault(); // Prevent the default form submission

  const challengerFolderId = document.getElementById('challengerFolderId').value;
  const gpxFilesInput = document.getElementById('gpxFilesInput').value;
  const photoFilesInput = document.getElementById('photoFilesInput').value;
  const textInput = document.getElementById('textInput').value;

  const gpxErrors = document.getElementById('gpxErrors');

  try {
    const gpxIssueString = await checkGpxFiles(gpxFilesInput);

    if (gpxIssueString) {
      gpxErrors.innerText = gpxIssueString;
    } else {
      await fetch('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textInput,
          photoFiles: photoFilesInput,
          gpxFiles: gpxFilesInput,
          challengerFolderId,
        }),
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

function checkGpxFiles(gpxFiles) {
  // const gpxIssueString = 'Timestamps manquantes';
  const gpxIssueString = undefined;

  return gpxIssueString;
}
