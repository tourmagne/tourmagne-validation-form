require('dotenv').config();

const { gdrive } = require('../services');

async function main() {
  const auth = await gdrive.getAuthorization();
  const files = await gdrive.listFiles({ auth });

  console.log(`${files.length} files found.`);
}

main()
  .then(() => console.log('Script terminated'))
  .catch((err) => console.log('XX', err));
