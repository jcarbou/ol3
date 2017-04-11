goog.require('ol.Graticule');
goog.require('ol.Map');
goog.require('ol.View');
goog.require('ol.layer.Tile');
goog.require('ol.layer.Vector');
goog.require('ol.proj');
goog.require('ol.source.OSM');
goog.require('ol.source.Vector');
goog.require('ol.style.Stroke');
goog.require('ol.format.GeoJSON');

var PROJ4_DATA = {
  "EPSG:4326":   false,
  "EPSG:3857":   false,
  "EPSG:32662": {
    proj4js_def: "+proj=eqc +lat_ts=0 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs",
    extent:      [-8000000, -8000000, 8000000, 8000000]
  },
  "EPSG:32761":  {
    proj4js_def: "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +ellps=WGS84 +datum=WGS84 +units=m +no_defs",
    extent:      [-4000000, -4000000, 8000000, 8000000]
  },
 "EPSG:32661":  {
    proj4js_def: "+proj=stere +lat_0=90 +lat_ts=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +ellps=WGS84 +datum=WGS84 +units=m +no_defs",
    extent:      [-4000000, -4000000, 8000000, 8000000]
  },
  "EPSG:3410": {
    proj4js_def: "+proj=cea +lat_0=0 +lon_0=0 +lat_ts=30 +a=6371228.0 +units=m",
    extent:      [-8000000, -8000000, 8000000, 8000000]
  },
  "ESRI:102031": {
    proj4js_def: "+proj=eqdc +lat_0=0 +lon_0=0 +lat_1=43 +lat_2=62 +x_0=0 +y_0=0 +ellps=intl +units=m no_defs",
    extent:      [-4000000, -4000000, 4000000, 4000000]
  },
  "EPSG:102020": {
    proj4js_def: "+proj=laea +lat_0=-90 +lon_0=0 +x_0=0 +y_0=0 +ellps=WGS84 +datum=WGS84 +units=m +no_defs",
    extent:      [-8000000, -8000000, 8000000, 8000000]
  },
  "ESRI:53009":  {
    proj4js_def: '+proj=moll +lon_0=0 +x_0=0 +y_0=0 +a=6371000 ' +
                 '+b=6371000 +units=m +no_defs',
    extent:      [-9009954.605703328, -9009954.605703328,
      9009954.605703328, 9009954.605703328],
    worldExtent: [-179, -89.99, 179, 89.99]
  }
};

var PROJECTIONS = {};

for(var code in PROJ4_DATA) {
  var data = PROJ4_DATA[code];
  if (data) {
    proj4.defs(code, data.proj4js_def);
    PROJECTIONS[code] = new ol.proj.Projection({
     code:        code,
     extent:      data.extent,
     worldExtent: data.worldExtent || data.extent
    });
  } else {
    PROJECTIONS[code] = ol.proj.get(code)
  }
};

var map = new ol.Map({
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
    /*new ol.layer.Vector({
      source: new ol.source.Vector({
        url: 'https://openlayers.org/en/v4.0.1/examples/data/geojson/countries.geojson',
        format: new ol.format.GeoJSON()
      })
    })*/
  ],
  target: 'map',
  view: new ol.View({
    center: ol.proj.fromLonLat([4.8, 47.75]),
    zoom: 5
  })
});

// Create the graticule component
var graticule = new ol.Graticule({
  // the style to use for the lines, optional.
  strokeStyle: new ol.style.Stroke({
    color: 'rgba(255,120,0,0.9)',
    width: 2,
    lineDash: [0.5, 4]
  })
});
graticule.setMap(map);

var codeSelect = document.getElementById('code');

function updateView() {
  var code = codeSelect.value,
      proj = PROJECTIONS[code];

  map.setView(new ol.View({
    projection: proj,
    center: ol.extent.getCenter(proj.getExtent()),
    zoom: 2
  }));
}

/**
 * Handle change event.
 */
codeSelect.onchange = function() {
  updateView();
};
