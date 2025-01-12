'use strict';

const fs = require('fs');
const handlebars = require('handlebars');
const path = require('path');

const datePlusDurationToStr = require('./datePlusDurationToStr');

function trackToCoordinates(track) {
  const coordinates = track.map((segment) => segment.map((point) => [point.lon, point.lat]));

  return JSON.stringify(coordinates);
}

function generateHtmlFile({ firstname, lastname, results }) {
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
    'fr-FR',
  );

  const source = fs.readFileSync(
    path.join(__dirname, 'htmlSynthesisTemplate.hbs'),
    'utf8',
  );

  const template = handlebars.compile(source);

  const data = {
    challCoordinates: trackToCoordinates(chall),
    missedCoordinates: trackToCoordinates(missedSegments),
    // refCoordinates: trackToCoordinates(ref),
    worstCoordinates: trackToCoordinates(worst),
    dateStr,
    distance: Math.round(distance / 100) / 10,
    firstname,
    lastname,
    missedDistance: Math.round(missedDistance / 100) / 10,
    offTrackRatio: Math.round(offTrackRatio * 10_000) / 100,
    onTrackRatio: 100 - Math.round(offTrackRatio * 10_000) / 100,
    rollingDuration,
    startPositionOfSlowestSegment: Math.round(startPositionOfSlowestSegment / 100) / 10,
    timeStr,
  };

  return template(data);
}

module.exports = generateHtmlFile;
