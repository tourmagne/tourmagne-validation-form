require('dotenv').config();

const { gdrive } = require('./services');

async function main() {
  const auth = await gdrive.getAuthorization();
  const parentFolderId = '1GW0zu1ejgE2ic3wM43_jfTYg_XrdAFu6';
  const folder = await gdrive.getMostRecentFolder({ auth, parentFolderId });

  const lastSubmissionISOString = folder.name.split(' ').at(-1);
  const lastSubmissionTimestamp = new Date(lastSubmissionISOString).getTime();

  console.log(lastSubmissionTimestamp);
}

main();
