'use strict';

const datePlusDurationToStr = (date, duration, locale) => {
  const sumDate = new Date(date.getTime() + duration);
  const dateStr = sumDate.toLocaleDateString(
    locale,
    {
      weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
    },
  );
  const timeStr = sumDate.toLocaleTimeString(locale);

  return {
    dateStr,
    timeStr,
  };
};

const generateTrk = (segments, options) => {
  const {
    name,
    color,
  } = options;

  let gpxTrk = `\n  <trk>
    <name>${name}</name>
    <extensions>
      <gpxx:TrackExtension>
        <gpxx:DisplayColor>${color}</gpxx:DisplayColor>
      </gpxx:TrackExtension>
    </extensions>`;

  segments.forEach((seg) => {
    gpxTrk += '\n    <trkseg>';
    seg.forEach((point) => {
      gpxTrk += `\n      <trkpt lat="${point.lat}" lon="${point.lon}"></trkpt>`;
    });
    gpxTrk += '\n    </trkseg>';
  });
  gpxTrk += '\n  </trk>';

  return gpxTrk;
};

const generateFullGpxStr = (results) => {
  const {
    tracks: {
      ref,
      chall,
      missedSegments,
      worst,
    },
  } = results;

  let gpxStr = `<?xml version="1.0" encoding="UTF-8"?>
<gpx
  version="1.0"
  creator="GPX comparator"
  xmlns="http://www.topografix.com/GPX/1/0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/0 http://www.topografix.com/GPX/1/0/gpx.xsd">`;

  gpxStr += generateTrk(ref, {
    name: 'Référence',
    color: 'Blue',
  });

  gpxStr += generateTrk(chall, {
    name: `Réalisé - ${100 - Math.round(results.accuracy.offTrackRatio * 10000) / 100} % de la trace de référence parcourus`,
    color: 'Green',
  });

  gpxStr += generateTrk(missedSegments, {
    name: `Ecarts - ${Math.round(results.accuracy.missedDistance / 100) / 10} km de la trace de référence non parcourus (soit ${Math.round(results.accuracy.offTrackRatio * 10000) / 100} %)`,
    color: 'Red',
  });

  const {
    dateStr,
    timeStr,
  } = datePlusDurationToStr(new Date(results.tracks.chall[0][0].time), results.kpi.slowestSegmentStart.elapsedTime, 'fr-FR');

  gpxStr += generateTrk(worst, {
    name: `Distance de la trace parcourue pendant les ${results.kpi.rollingDuration} h les moins favorables : ${results.kpi.distance / 1000} km (à partir du ${dateStr} à ${timeStr}, au km ${results.kpi.slowestSegmentStart.distance / 1000} de la trace de référence)`,
    color: 'White',
  });

  gpxStr += '\n</gpx>';
  return gpxStr;
};

module.exports = generateFullGpxStr;
