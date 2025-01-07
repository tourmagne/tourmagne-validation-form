const { XMLParser } = require('fast-xml-parser');

const ParsingError = require('../utils/ParsingError');

const checkGpx = async (fileContentArray) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
    attributeNamePrefix: '',
  });

  // trkptsArr is an array with 3 levels
  // 1st level represents the file
  // 2nd level reprensents <trkseg>
  // 3rd level represent <trkpt>
  const trkptsArr = fileContentArray.map((str) => {
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

  if (trkptsArr.some((trkptsFile) => typeof trkptsFile[0][0].time === 'undefined')) {
    throw new ParsingError('Tes fichiers GPX ne sont pas conformes car au moins l\'un d\'eux ne contient pas de données temporelles (heure de passage à chaque point GPS)');
  }

  trkptsArr.sort((a, b) => new Date(a[0][0].time.valueOf()) - new Date(b[0][0].time.valueOf()));

  // Check that last point of each file is before 1st point of the next file
  for (let fileNb = 0; fileNb < trkptsArr.length - 1; fileNb += 1) {
    const endTimeOfCurrentFile = new Date(trkptsArr[fileNb].flat().slice(-1)[0].time.valueOf());
    const startTimeOfNextFile = new Date(trkptsArr[fileNb + 1][0][0].time.valueOf());
    if (endTimeOfCurrentFile > startTimeOfNextFile) {
      throw new ParsingError('Tes fichiers GPX ne sont pas conformes car au moins 2 d\'entre eux se chevauchent temporellement (ils contiennent des données pour le même horaire)');
    }
  }

  return;
};

module.exports = checkGpx;
