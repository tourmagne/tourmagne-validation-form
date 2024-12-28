const { gdrive } = require('../services');

async function main() {
  const auth = await gdrive.getAuthorization();
  await gdrive.deleteAllFiles({ auth });
}

main()
  .then(() => console.log('Script terminated'))
  .catch((err) => console.log(err));
