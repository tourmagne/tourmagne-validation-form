'use strict';

const fs = require('fs');
const handlebars = require('handlebars');
const path = require('path');

const datePlusDurationToStr = require('./datePlusDurationToStr');

function trackToCoordinates(track) {
  const coordinates = track.map((segment) => segment.map((point) => [point.lon, point.lat]));

  return JSON.stringify(coordinates);
}

function generateHtmlFile({ firstname, lastname, results }, language) {
  const {
    accuracy: {
      missedDistance,
      offTrackRatio,
    },
    kpi: {
      distance,
      rollingDuration,
      slowestSegmentStart: {
        distance: startPositionOfSlowestSegment,
        elapsedTime,
      },
    },
    tracks: {
      chall,
      missedSegments,
      // ref,
      worst,
    },
  } = results;

  const {
    dateStr,
    timeStr,
  } = datePlusDurationToStr(
    new Date(chall[0][0].time),
    elapsedTime,
    language,
  );

  const source = fs.readFileSync(
    path.join(__dirname, '..', 'views', language, 'htmlSynthesisTemplate.hbs'),
    'utf8',
  );

  const template = handlebars.compile(source);

  const offTrackRatioPerCent = Number.parseFloat(offTrackRatio * 100).toFixed(2);

  const data = {
    challCoordinates: trackToCoordinates(chall),
    missedCoordinates: trackToCoordinates(missedSegments),
    // refCoordinates: trackToCoordinates(ref),
    worstCoordinates: trackToCoordinates(worst),
    dateStr,
    distance: Number.parseFloat(distance / 1000).toFixed(3),
    firstname,
    lastname,
    missedDistance: Number.parseFloat(missedDistance / 1000).toFixed(1),
    offTrackRatio: offTrackRatioPerCent,
    onTrackRatio: 100 - offTrackRatioPerCent,
    rollingDuration,
    startPositionOfSlowestSegment: Number.parseFloat(startPositionOfSlowestSegment / 1000).toFixed(1),
    timeStr,
  };

  return template(data);
}

module.exports = generateHtmlFile;
