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
      throw new ParsingError('overlapingGpxError');
    }
  }
};

// Parse gpx string
// -> [{lat, lon, time}]
const parseGpx = (workerData) => {
  const {
    filenames,
    strs,
    options: {
      challengerGpx = false,
    },
  } = workerData;

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
    throw new ParsingError('invalidGpxError {{invalidFiles}}', { invalidFiles: invalidFiles.join('\n - ') });
  }

  // For challenger tracks, check if they have timestamps
  if (challengerGpx) {
    if (trkptsArr.some((trkptsFile) => typeof trkptsFile[0][0].time === 'undefined')) {
      throw new ParsingError('missingGpxTimestampsError');
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

  return trkptsLines.map((line) => line.map((trkpt) => keepLatLonTime(trkpt)));
};

try {
  const result = parseGpx(workerData);
  parentPort.postMessage(result);
} catch (error) {
  if (error instanceof ParsingError && workerData.options?.challengerGpx) {
    parentPort.postMessage({
      error: {
        message: error.message,
        data: error.data,
      },
    });
  } else {
    throw error;
  }
}
