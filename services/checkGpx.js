const { XMLParser } = require('fast-xml-parser');

const checkGpx = async (strs) => {
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

  if (trkptsArr.some((trkptsFile) => typeof trkptsFile[0][0].time === 'undefined')) {
    return 'Lors de l\'import de plusieurs fichiers GPX, ceux ci doivent impérativement contenir des données temporelles pour pouvoir être classés par ordre chronologique';
  }

  trkptsArr.sort((a, b) => new Date(a[0][0].time.valueOf()) - new Date(b[0][0].time.valueOf()));

  // Check that last point of each file is before 1st point of the next file
  for (let fileNb = 0; fileNb < trkptsArr.length - 1; fileNb += 1) {
    const endTimeOfCurrentFile = new Date(trkptsArr[fileNb].flat().slice(-1)[0].time.valueOf());
    const startTimeOfNextFile = new Date(trkptsArr[fileNb + 1][0][0].time.valueOf());
    if (endTimeOfCurrentFile > startTimeOfNextFile) {
      return 'Les différents fichiers GPX importés ne doivent pas se chevaucher temporellement';
    }
  }

  return;
};

module.exports = checkGpx;
