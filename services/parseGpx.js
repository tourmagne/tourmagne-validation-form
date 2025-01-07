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
const parseGpx = (strs, { timestampsRequired = false }) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
    attributeNamePrefix: '',
  });

  // trkptsArr is an array with 3 levels
  // 1st level represents the file
  // 2nd level reprensents <trkseg>
  // 3rd level represent <trkpt>
  const trkptsArr = strs.map((str) => {
    const gpx = parser.parse(str);
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

  // For challenger tracks, check if they have timestamps
  if (timestampsRequired) {
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

  // Only keep relevant properties (i.e. lat, lon & time)
  const keepLatLonTime = ({ lat, lon, time }) => ({ lat, lon, time });

  return trkptsLines.map((line) => line.map((trkpt) => keepLatLonTime(trkpt)));
};

module.exports = parseGpx;
