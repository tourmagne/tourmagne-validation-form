require('dotenv').config();

const { gdrive } = require('../services');

async function main() {
  const auth = await gdrive.getAuthorization();
  const files = await gdrive.listFiles({ auth });

  for (const file of files) {
    console.log(`${file.id} - ${file.name}`);
  }
  console.log(`${files.length} files found.`);
}

main()
  .then(() => console.log('listGoogleDriveFiles - Script terminated'))
  .catch((err) => console.log(err));
