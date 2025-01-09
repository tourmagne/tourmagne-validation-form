'use strict';

const geolib = require('geolib');
const {
  parentPort,
  workerData,
} = require('node:worker_threads');

// Calculate challenger passage time at each ref point
// -> [{lat, lon, time, closestDist}]
// * lat: ref point latitude
// * lon: ref point longitude
// * time: time elapsed since challenger passed by its 1st ref point
//   null if ref point missed
// * closestDistance: distance between ref point & challenger
//   when challenger was the closest (before maxDetour)
const calculateClosest = (refPoints, challPoints, options) => {
  const {
    trigger,
    maxDetour,
    maxSegLength,
  } = options;

  const initialTime = new Date(challPoints[0].time).valueOf();

  // geolib getDistanceFromLine wrapper to fix a bug from the library
  // See https://github.com/manuelbieh/geolib/issues/227
  const getDistanceFromLine = (point, lineStart, lineEnd, accuracy = 1) => {
    const d1 = geolib.getDistance(lineStart, point, accuracy);
    const d2 = geolib.getDistance(point, lineEnd, accuracy);
    const d3 = geolib.getDistance(lineStart, lineEnd, accuracy);

    if (d1 === 0 || d2 === 0) {
      // point located at the exact same place as lineStart or lineEnd
      return 0;
    }
    if (d3 === 0) {
      return d1; // lineStart and lineEnd are the same - return point-to-point distance
    }
    return geolib.getDistanceFromLine(point, lineStart, lineEnd);
  };

  // challIndex: index of the point of challenger track that was
  // at less than trigger distance from the last found ref point
  let challIndex = 0;
  let is1stPointFound = false;

  // eslint-disable-next-line no-unused-vars
  return refPoints.map((refPoint, index) => {
    // const progress = (Math.round((index / refPoints.length) * 10_000) / 100).toFixed(2);
    // console.log(`    - Progress: ${progress} %`);

    // challLocalIndex: running index on challenge track used to find closest point
    let challLocalIndex = challIndex;
    let detour = 0;
    let closestDistanceIndex;
    let closestDistance;

    // To allow challenger track to start long before start of ref track
    // we use maxDetour === Infinity until one point of ref track has been found on chall track.
    let maxDetourUsed;
    if (is1stPointFound) {
      maxDetourUsed = maxDetour;
    } else {
      maxDetourUsed = Infinity;
    }

    while (challLocalIndex + 1 < challPoints.length && detour <= maxDetourUsed) {
      let distance;
      if (geolib.getDistance(
        challPoints[challLocalIndex],
        challPoints[challLocalIndex + 1],
      ) < maxSegLength) {
        distance = getDistanceFromLine(
          refPoint,
          challPoints[challLocalIndex],
          challPoints[challLocalIndex + 1],
        );
      } else {
        distance = geolib.getDistance(refPoint, challPoints[challLocalIndex]);
      }

      if (!closestDistance || distance < closestDistance) {
        closestDistance = distance;
        closestDistanceIndex = challLocalIndex;
      }

      if (closestDistance <= trigger) {
        challIndex = challLocalIndex;
        is1stPointFound = true;
        break;
      }

      detour += geolib.getDistance(challPoints[challLocalIndex], challPoints[challLocalIndex + 1]);
      challLocalIndex += 1;
    }

    return {
      lat: refPoint.lat,
      lon: refPoint.lon,
      time: new Date(challPoints[closestDistanceIndex].time).valueOf() - initialTime,
      closestDistance,
    };
  });
};

// Calculate ref points the challenger missed
// -> [{lat, lon, time, missedSegmentNb}]
// * missedSegmentNb: undefined if ref point reached by the challenger
//   Integer representing the number of the missed segment starting at 1
const calculateMissed = (refPointsPassBy, options) => {
  const {
    trigger,
    tolerance,
  } = options;

  const result = new Array(refPointsPassBy.length);
  let segmentNb = 1;
  let ind = 0;

  while (ind < refPointsPassBy.length) {
    if (refPointsPassBy[ind].closestDistance <= trigger) {
      result[ind] = null;
      ind += 1;
    } else {
      const startInd = ind;
      let localInd = ind;
      let missed = false;
      while (
        localInd < refPointsPassBy.length
        && refPointsPassBy[localInd].closestDistance > trigger
      ) {
        if (refPointsPassBy[localInd].closestDistance > tolerance) missed = true;
        localInd += 1;
      }
      if (missed) {
        result.fill(segmentNb, startInd, localInd);
        segmentNb += 1;
      } else {
        result.fill(null, startInd, localInd);
      }
      ind = localInd;
    }
  }
  return refPointsPassBy.map((el, index) => ({
    ...el,
    missedSegmentNb: result[index],
  }));
};

// Calculate rolling duration distances (Tourmagne KPI)
// -> [{rollingDurationDistance, rollingDurationEndIndex}]
// * rollingDurationDistance: distance travelled by the challenger
//   during next rolling duration (not taking into account missed points).
//   null for ref points of the last rollingDuration.
// * rollingDurationEndIndex: last index of refPoints included in rollingDurationDistance
//   null for ref points of the last rollingDuration
const calculateRollingDurationDistances = (timeDistanceTable, rollingDuration) => {
  const rollingDurationMs = rollingDuration * 3600 * 1000; // in ms
  let endInd = 0;

  return timeDistanceTable.map((point, startInd, table) => {
    let rollingDurationDistance;
    let rollingDurationEndIndex;

    if (point.elapsedTime === null) {
      return ({
        rollingDurationDistance: null,
        rollingDurationEndIndex: null,
      });
    }

    const endTime = point.elapsedTime + rollingDurationMs;

    while (endInd < table.length) {
      if (table[endInd].elapsedTime !== null && table[endInd].elapsedTime > endTime) {
        break;
      }
      endInd += 1;
    }

    if (endInd === table.length) {
      rollingDurationDistance = null;
      rollingDurationEndIndex = null;
    } else {
      rollingDurationDistance = table[endInd].cumulatedDistance - table[startInd].cumulatedDistance;
      rollingDurationEndIndex = endInd;
    }

    return ({
      rollingDurationDistance,
      rollingDurationEndIndex,
    });
  });
};

// Calculate elapsed challenger time & cumulated distance (with & without missed segments)
// -> [{elapsedTime, elapsedTimeWithoutMissed, cumulatedDistance, cumulatedDistanceWithoutMissed}]
// * elapsedTime: time elapsed since challenger passed by its 1st ref point
//   null if ref point missed
// * cumulatedDistance: cumulated distance on ref track
//   excluding segments missed by challenger
const calculateTimeDistanceTable = (refPointsMissed) => {
  let cumulatedDistance = 0;
  let lastNonNullRollingDurationDistance = 0;

  return refPointsMissed.map((point, ind, points) => {
    let elapsedTime;
    if (ind === 0) {
      elapsedTime = 0;
    } else {
      const intervalDistance = geolib.getDistance(point, points[ind - 1]);
      if (point.missedSegmentNb === null && points[ind - 1].missedSegmentNb === null) {
        elapsedTime = point.time;
        cumulatedDistance = lastNonNullRollingDurationDistance + intervalDistance;
        lastNonNullRollingDurationDistance = cumulatedDistance;
      } else {
        elapsedTime = null;
        cumulatedDistance = null;
      }
    }
    return {
      elapsedTime,
      cumulatedDistance,
    };
  });
};

// Generate missed segments
// -> [[{lat, lon}]]
// * Wrapping array is an array of segments
// * Nested arrays are missed segments
const generateMissedSegments = (refPointsMissed) => {
  const missedSegments = [];
  const numberOfMissedSegments = Math.max(...refPointsMissed
    .map((point) => point.missedSegmentNb)
    .filter((point) => point !== null));

  for (let segmentNb = 1; segmentNb <= numberOfMissedSegments; segmentNb += 1) {
    const missedSegment = refPointsMissed.filter((point) => point.missedSegmentNb === segmentNb);
    const missedSegmentCoordsOnly = missedSegment.map((point) => ({
      lat: point.lat,
      lon: point.lon,
    }));

    missedSegments.push(missedSegmentCoordsOnly);
  }
  return missedSegments;
};

// Calculate accuracy of the challenger following ref track
const calculateAccuracy = (refPoints, missedSegments) => {
  const refDistance = geolib.getPathLength(refPoints);
  const missedDistance = missedSegments
    .reduce((acc, segment) => acc + geolib.getPathLength(segment), 0);
  const offTrackRatio = missedDistance / refDistance;

  return {
    refDistance,
    missedDistance,
    offTrackRatio,
  };
};

// Calculate Tourmagne Kpis
const calculateKpis = (refPointsMissed, options) => {
  const {
    rollingDuration,
  } = options;
  const timeDistanceTable = calculateTimeDistanceTable(refPointsMissed);
  const rollingDurationDistances = calculateRollingDurationDistances(
    timeDistanceTable,
    rollingDuration,
  );

  const distances = rollingDurationDistances.map((el) => el.rollingDurationDistance);
  const rollingDurationMinDistance = Math.min(...distances.filter((el) => el != null));

  const startIndex = distances.indexOf(rollingDurationMinDistance);
  const endIndex = rollingDurationDistances[startIndex]?.rollingDurationEndIndex;

  const startElapsedTime = timeDistanceTable[startIndex]?.elapsedTime;
  const endElapsedTime = timeDistanceTable[endIndex]?.elapsedTime;

  const startDistance = timeDistanceTable[startIndex]?.cumulatedDistance;
  const endDistance = timeDistanceTable[endIndex]?.cumulatedDistance;

  const slowestSegmentStart = {
    index: startIndex,
    elapsedTime: startElapsedTime,
    // Distance travelled by challenger on ref track (without missed segments):
    distance: startDistance,
  };

  const slowestSegmentEnd = {
    index: endIndex,
    elapsedTime: endElapsedTime,
    // Distance travelled by challenger on ref track (without missed segments):
    distance: endDistance,
  };

  const distance = slowestSegmentEnd.distance - slowestSegmentStart.distance; // meters
  const meanSpeed = (distance / 1000) / rollingDuration; // km/h

  return {
    rollingDuration,
    slowestSegmentStart,
    slowestSegmentEnd,
    distance,
    meanSpeed,
  };
};

const validateOptions = (options) => {
  const {
    tolerance,
    trigger,
  } = options;

  if (tolerance < trigger) {
    throw new Error('La tolérance d\'écart doit être supérieure ou égale au seuil de déclenchement.');
  }
};

const compareTracks = (workerData) => {
  const {
    refPoints,
    challPoints,
    options,
  } = workerData;

  validateOptions(options);

  // Extend refPoints with missed segments
  console.log('  - Calculating closest challenger points to each reference points...');
  const refPointsPassBy = calculateClosest(refPoints, challPoints, options);
  console.log('  - Calculating closest missed reference points...');
  const refPointsMissed = calculateMissed(refPointsPassBy, options);

  // Generate missed segments & accuracy
  console.log('  - Generating missed segments GPX file and challenger accuracy...');
  const missedSegments = generateMissedSegments(refPointsMissed);
  const accuracy = calculateAccuracy(refPoints, missedSegments);

  // Tourmagne Kpis
  console.log('  - Calculating Kpis...');
  const kpi = calculateKpis(refPointsMissed, options);
  const worstPoints = refPoints.slice(
    kpi.slowestSegmentStart.index,
    kpi.slowestSegmentEnd.index + 1,
  );

  return {
    tracks: {
      missedSegments,
      ref: [refPoints],
      chall: [challPoints],
      worst: [worstPoints],
    },
    accuracy,
    kpi,
  };
};

const result = compareTracks(workerData);
parentPort.postMessage(result);
