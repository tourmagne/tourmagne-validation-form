const style = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap Contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm', // This must match the source key above
    },
  ],
};

const map = new maplibregl.Map({
  container: 'map',
  style,
  center: [3.11, 46.42], // Display Melun - Nîmes zone
  zoom: 6,
});

map.addControl(new maplibregl.NavigationControl());

const refSegments = [
  [
    { lat: 44.829111, lon: -0.619358 },
    { lat: 44.828408, lon: -0.619424 },
    { lat: 44.837928, lon: -0.738540 },
  ],
  [
    { lat: 45.829111, lon: -0.619358 },
    { lat: 45.828408, lon: -0.619424 },
    { lat: 45.837928, lon: -0.738540 },
  ],
];

// const refCoordinates = [
//   [
//     [44.829111, -0.619358],
//     [44.828408, -0.619424],
//   ],
//   [
//     [45.829111, -0.619358],
//     [45.828408, -0.619424],
//   ],
// ];

const displayTrack = (map, id, segments, paint) => {
  const features = [];
  for (let i = 0; i < segments.length; i += 1) {
    features.push({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [],
      },
    });
  }

  const data = {
    type: 'FeatureCollection',
    features,
  };

  if (!map.getSource(id)) {
    map.addSource(
      id,
      {
        type: 'geojson',
        data,
      },
    );

    map.addLayer({
      id,
      type: 'line',
      source: id,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint,
    });
  }

  segments.forEach((points, index) => {
    points.forEach((point) => {
      data.features[index].geometry.coordinates.push([point.lon, point.lat]);
    });
  });

  map.getSource(id).setData(data);
};

map.on('load', () => {
  displayTrack(map, 'ref', refSegments, {
    'line-color': '#ff0000',
    'line-width': 6,
    'line-opacity': 0.7,
  });
});
