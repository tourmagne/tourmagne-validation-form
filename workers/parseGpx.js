const {
  parentPort,
  workerData,
} = require('node:worker_threads');
const { XMLParser } = require('fast-xml-parser');

const { ParsingError } = require('../utils/errors');

// Sort files chronologically
const sortFiles = (trkptsArr) => {
  trkptsArr.sort((a, b) => new Date(a[0][0].time.valueOf()) - new Date(b[0][0].time.valueOf()));

  // Check that last point of each file is before 1st point of the next file
  for (let fileNb = 0; fileNb < trkptsArr.length - 1; fileNb += 1) {
    const endTimeOfCurrentFile = new Date(trkptsArr[fileNb].flat().slice(-1)[0].time.valueOf());
    const startTimeOfNextFile = new Date(trkptsArr[fileNb + 1][0][0].time.valueOf());
    if (endTimeOfCurrentFile > startTimeOfNextFile) {
      throw new ParsingError('Tes fichiers GPX ne sont pas conformes car au moins 2 d\'entre eux se chevauchent temporellement (ils contiennent des données pour le même horaire)');
    }
  }
};

// Parse gpx string
// -> [{lat, lon, time}]
const parseGpx = (workerData) => {
  const {
    filenames,
    strs: encodedStrs,
    options: {
      challengerGpx = false,
    },
  } = workerData;

  // Decode ArrayBuffers back into strings
  const strs = encodedStrs.map((buffer) => new TextDecoder().decode(new Uint8Array(buffer)));

  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
    attributeNamePrefix: '',
  });

  let invalidFiles = [];

  // trkptsArr is an array with 3 levels
  // 1st level represents the file
  // 2nd level reprensents <trkseg>
  // 3rd level represent <trkpt>
  const trkptsArr = strs.map((str, index) => {
    let gpx;

    try {
      gpx = parser.parse(str);
    // eslint-disable-next-line no-unused-vars
    } catch (error) {
      invalidFiles.push(filenames[index]);

      return undefined;
    }
    const trks = gpx?.gpx?.trk;

    let trksegs;
    if (Array.isArray(trks)) {
      trksegs = trks.map((trk) => trk.trkseg);
    } else {
      trksegs = trks?.trkseg;
    }

    // Deal with case with multiple <trkseg> in stringified gpx file
    if (Array.isArray(trksegs)) {
      return trksegs.map((trkseg) => trkseg.trkpt);
    }
    return [trksegs?.trkpt];
  });

  if (invalidFiles.length > 0) {
    throw new ParsingError(`Le ou les fichiers suivants ne sont pas des fichiers GPX valides :\n - ${invalidFiles.join('\n - ')}`);
  }

  // For challenger tracks, check if they have timestamps
  if (challengerGpx) {
    if (trkptsArr.some((trkptsFile) => typeof trkptsFile[0][0].time === 'undefined')) {
      throw new ParsingError('Tes fichiers GPX ne sont pas conformes car au moins l\'un d\'eux ne contient pas de données temporelles (heure de passage à chaque point GPS)');
    }
  }

  // If multiple gpx files strings where inputed, sort them chronollogically
  if (trkptsArr.length > 1) {
    sortFiles(trkptsArr);
  }

  // trkptsLines is an array with 2 levels
  // 1st level represents the lines to display (each line could be a file or a <trkseg>)
  // 2nd level reprensents <trkpt>
  const trkptsLines = trkptsArr.flat();

  // Only keep relevant properties and make sur lat & lon are number (i.e. lat, lon & time)
  const keepLatLonTime = ({ lat, lon, time }) => ({
    lat: Number(lat),
    lon: Number(lon),
    time,
  });

  console.log('parseGpx - avant gc', process.memoryUsage().heapUsed / (1024 * 1024));
  global.gc();
  console.log('parseGpx - après gc', process.memoryUsage().heapUsed / (1024 * 1024));

  return trkptsLines.map((line) => line.map((trkpt) => keepLatLonTime(trkpt)));
};

try {
  parentPort.on('message', (payload) => {
    const result = parseGpx(payload);
    parentPort.postMessage(result);
    process.exit(0);
  });
} catch (error) {
  if (error instanceof ParsingError && workerData.options?.challengerGpx) {
    parentPort.postMessage({ error });
  } else {
    throw error;
  }
}
