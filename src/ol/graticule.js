goog.provide('ol.Graticule');

goog.require('ol');
goog.require('ol.extent');
goog.require('ol.geom.GeometryLayout');
goog.require('ol.geom.LineString');
goog.require('ol.geom.flat.geodesic');
goog.require('ol.math');
goog.require('ol.proj');
goog.require('ol.proj.transforms');
goog.require('ol.proj.proj4');
goog.require('ol.render.EventType');
goog.require('ol.style.Stroke');
goog.require('ol.style.Text');
goog.require('ol.style.Fill');
goog.require('ol.geom.Point');

/**
 * Render a grid for a coordinate system on a map.
 * @constructor
 * @param {olx.GraticuleOptions=} opt_options Options.
 * @api
 */
ol.Graticule = function(opt_options) {
  var options = opt_options || {};

 /**
  * @type {ol.Map}
  * @private
  */
  this.map_ = null;

 /**
  * @type {ol.proj.Projection}
  * @private
  */
  this.projection_ = null;

 /**
  * @type {number}
  * @private
  */
  this.maxLat_ = Infinity;

 /**
  * @type {number}
  * @private
  */
  this.maxLon_ = Infinity;

 /**
  * @type {number}
  * @private
  */
  this.minLat_ = -Infinity;

 /**
  * @type {number}
  * @private
  */
  this.minLon_ = -Infinity;

 /**
  * @type {number}
  * @private
  */
  this.maxLatP_ = Infinity;

 /**
  * @type {number}
  * @private
  */
  this.maxLonP_ = Infinity;

 /**
  * @type {number}
  * @private
  */
  this.minLatP_ = -Infinity;

 /**
  * @type {number}
  * @private
  */
  this.minLonP_ = -Infinity;

 /**
  * @type {number}
  * @private
  */
  this.targetSize_ = options.targetSize !== undefined ?
     options.targetSize : 100;

 /**
  * @type {number}
  * @private
  */
  this.maxLines_ = options.maxLines !== undefined ? options.maxLines : 100;

 /**
  * @type {Array.<ol.geom.LineString>}
  * @private
  */
  this.meridians_ = [];

 /**
  * @type {Array.<ol.geom.LineString>}
  * @private
  */
  this.parallels_ = [];

  /**
   * @type {Array.<ol.geom.Point>}
   * @private
   */
  this.leftLabels_ = [];

  /**
   * @type {Array.<ol.geom.Point>}
   * @private
   */
  this.rightLabels_ = [];

  /**
   * @type {Array.<ol.geom.Point>}
   * @private
   */
  this.topLabels_ = [];

  /**
   * @type {Array.<ol.geom.Point>}
   * @private
   */
  this.bottomLabels_ = [];

  /**
   * @type {ol.style.Text}
   * @private
   */
  this.textStyle_ = options.textStyle || ol.Graticule.DEFAULT_TEXT_STYLE_;

  /**
  * @type {ol.style.Stroke}
  * @private
  */
  this.strokeStyle_ = options.strokeStyle !== undefined ?
     options.strokeStyle : ol.Graticule.DEFAULT_STROKE_STYLE_;

 /**
  * @type {ol.TransformFunction|undefined}
  * @private
  */
  this.fromLonLatTransform_ = undefined;

 /**
  * @type {ol.TransformFunction|undefined}
  * @private
  */
  this.toLonLatTransform_ = undefined;

 /**
  * @type {ol.Coordinate}
  * @private
  */
  this.projectionCenterLonLat_ = null;

  this.setMap(options.map !== undefined ? options.map : null);
};


/**
 * @type {ol.style.Stroke}
 * @private
 * @const
 */
ol.Graticule.DEFAULT_STROKE_STYLE_ = new ol.style.Stroke({
  color: 'rgba(0,0,0,0.2)'
});

/**
 * @type {ol.style.Text}
 * @private
 * @const
 */
ol.Graticule.DEFAULT_TEXT_STYLE_ = new ol.style.Text({
  textAlign : 'right',
  textBaseline :'bottom',
  font : 'normal 12px Arial',
  fill: new ol.style.Fill({color: 'rgba(0,0,0,1)'}),
  stroke: new ol.style.Stroke({color: 'rgba(255,255,255,0.5)', width: 2})
});

/**
 * TODO can be configurable
 * @type {Array.<number>}
 * @private
 */
ol.Graticule.intervals_ = [90, 45, 30, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05,
  0.01, 0.005, 0.002, 0.001];

/**
 * @param {number} lon Longitude.
 * @param {number} minLat Minimal latitude.
 * @param {number} maxLat Maximal latitude.
 * @param {number} squaredTolerance Squared tolerance.
 * @param {ol.Extent} extent Extent.
 * @param {number} index Index.
 * @return {number} Index.
 * @private
 */
ol.Graticule.prototype.addMeridian_ = function(lon, minLat, maxLat, squaredTolerance, extent, index) {
  var lineString = this.getMeridian_(lon, minLat, maxLat,
      squaredTolerance, index);
  if (ol.extent.intersects(lineString.getExtent(), extent)) {
    this.meridians_[index++] = lineString;
  }
  return index;
};


/**
 * @param {number} lat Latitude.
 * @param {number} minLon Minimal longitude.
 * @param {number} maxLon Maximal longitude.
 * @param {number} squaredTolerance Squared tolerance.
 * @param {ol.Extent} extent Extent.
 * @param {number} index Index.
 * @return {number} Index.
 * @private
 */
ol.Graticule.prototype.addParallel_ = function(lat, minLon, maxLon, squaredTolerance, extent, index) {
  var lineString = this.getParallel_(lat, minLon, maxLon, squaredTolerance,
      index);
  if (ol.extent.intersects(lineString.getExtent(), extent)) {
    this.parallels_[index++] = lineString;
  }
  return index;
};


/**
 * @param {ol.Extent} extent Extent.
 * @param {ol.Coordinate} center Center.
 * @param {number} resolution Resolution.
 * @param {number} squaredTolerance Squared tolerance.
 * @private
 */
ol.Graticule.prototype.createGraticule_ = function(extent, center, resolution, squaredTolerance) {

  var interval = this.enabled ? this.getInterval_(resolution) : -1;

  if (interval == -1) {
    this.meridians_.length = this.parallels_.length = 0;

	  this.topLabels_.length = 0;
	  this.bottomLabels_.length = 0;
	  this.leftLabels_.length = 0;
	  this.rightLabels_.length = 0;
    return;
  }

  var centerLonLat = this.toLonLatTransform_(center);
  var centerLon = centerLonLat[0];
  var centerLat = centerLonLat[1];
  var maxLines = this.maxLines_;
  var cnt, idx, lat, lon;

  var validExtent = [
    Math.max(extent[0], this.minLonP_),
    Math.max(extent[1], this.minLatP_),
    Math.min(extent[2], this.maxLonP_),
    Math.min(extent[3], this.maxLatP_)
  ];

  validExtent = ol.proj.transformExtent(validExtent, this.projection_,
      'EPSG:4326');
  var maxLat = validExtent[3];
  var maxLon = validExtent[2];
  var minLat = validExtent[1];
  var minLon = validExtent[0];

  // Create meridians

  centerLon = Math.floor(centerLon / interval) * interval;
  lon = ol.math.clamp(centerLon, this.minLon_, this.maxLon_);

  idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, 0);

  cnt = 0;

  if (this.useLine) {
    var mapLon, mapLat;

    minLon = this.toLonLatTransform_([extent[0],center[1]])[0],
    maxLon = this.toLonLatTransform_([extent[2],center[1]])[0],
    minLat = this.toLonLatTransform_([center[0],extent[1]])[1],
    maxLat = this.toLonLatTransform_([center[0],extent[3]])[1];

    minLon = Math.floor(minLon/interval)*interval;
    maxLon = Math.ceil(maxLon/interval)*interval;
    minLat = Math.floor(minLat/interval)*interval;
    maxLat = Math.ceil(maxLat/interval)*interval;

    idx = 0;
    for(lon=minLon; lon<=maxLon; lon+=interval) {
      mapLon = this.fromLonLatTransform_([lon,centerLonLat[1]])[0];
      this.meridians_[idx] = this.getLineMeridian_(mapLon, squaredTolerance, extent, idx);
      this.topLabels_[idx] = this.getLabel_(this.topLabels_,mapLon,extent[3],idx);
      this.bottomLabels_[idx++] = this.getLabel_(this.bottomLabels_,mapLon,extent[1],idx);
    }
    this.meridians_.length = idx;
    this.topLabels_.length = idx;
    this.bottomLabels_.length = idx;

    idx = 0;
    for(lat=minLat; lat<=maxLat; lat+=interval) {
      mapLat = this.fromLonLatTransform_([centerLonLat[0],lat])[1];
      this.parallels_[idx] = this.getLineParallel_(mapLat, squaredTolerance, extent, idx);
      this.leftLabels_[idx] = this.getLabel_(this.leftLabels_,extent[0],mapLat,idx);
      this.rightLabels_[idx++] = this.getLabel_(this.rightLabels_,extent[2],mapLat,idx);
    }
    this.parallels_.length = idx;
    this.leftLabels_.length = idx;
    this.rightLabels_.length = idx;

    return;
  }

  idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, 0);

  while (lon != this.minLon_ && cnt++ < maxLines) {
    lon = Math.max(lon - interval, this.minLon_);
    idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, idx);
  }

  lon = ol.math.clamp(centerLon, this.minLon_, this.maxLon_);

  cnt = 0;
  while (lon != this.maxLon_ && cnt++ < maxLines) {
    lon = Math.min(lon + interval, this.maxLon_);
    idx = this.addMeridian_(lon, minLat, maxLat, squaredTolerance, extent, idx);
  }

  this.meridians_.length = idx;

  // Create parallels

  centerLat = Math.floor(centerLat / interval) * interval;
  lat = ol.math.clamp(centerLat, this.minLat_, this.maxLat_);

  idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, 0);

  cnt = 0;
  while (lat != this.minLat_ && cnt++ < maxLines) {
    lat = Math.max(lat - interval, this.minLat_);
    idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, idx);
  }

  lat = ol.math.clamp(centerLat, this.minLat_, this.maxLat_);

  cnt = 0;
  while (lat != this.maxLat_ && cnt++ < maxLines) {
    lat = Math.min(lat + interval, this.maxLat_);
    idx = this.addParallel_(lat, minLon, maxLon, squaredTolerance, extent, idx);
  }

  this.parallels_.length = idx;

};


/**
 * @param {number} resolution Resolution.
 * @return {number} The interval in degrees.
 * @private
 */
ol.Graticule.prototype.getInterval_ = function(resolution) {
  var centerLon = this.projectionCenterLonLat_[0];
  var centerLat = this.projectionCenterLonLat_[1];
  var interval = -1;
  var i, ii, delta, dist;
  var target = Math.pow(this.targetSize_ * resolution, 2);
  /** @type {Array.<number>} **/
  var p1 = [];
  /** @type {Array.<number>} **/
  var p2 = [];
  for (i = 0, ii = ol.Graticule.intervals_.length; i < ii; ++i) {
    delta = ol.Graticule.intervals_[i] / 2;
    p1[0] = centerLon - delta;
    p1[1] = centerLat - delta;
    p2[0] = centerLon + delta;
    p2[1] = centerLat + delta;
    this.fromLonLatTransform_(p1, p1);
    this.fromLonLatTransform_(p2, p2);
    dist = Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2);
    if (dist <= target) {
      break;
    }
    interval = ol.Graticule.intervals_[i];
  }
  return interval;
};


/**
 * Get the map associated with this graticule.
 * @return {ol.Map} The map.
 * @api
 */
ol.Graticule.prototype.getMap = function() {
  return this.map_;
};


/**
 * @param {number} lon Longitude.
 * @param {number} minLat Minimal latitude.
 * @param {number} maxLat Maximal latitude.
 * @param {number} squaredTolerance Squared tolerance.
 * @return {ol.geom.LineString} The meridian line string.
 * @param {number} index Index.
 * @private
 */
ol.Graticule.prototype.getMeridian_ = function(lon, minLat, maxLat,
                                               squaredTolerance, index) {
  var flatCoordinates = ol.geom.flat.geodesic.meridian(lon,
     minLat, maxLat, this.projection_, squaredTolerance);
  var lineString = this.meridians_[index] !== undefined ?
     this.meridians_[index] : new ol.geom.LineString(null);
  lineString.setFlatCoordinates(ol.geom.GeometryLayout.XY, flatCoordinates);
  return lineString;
};


/**
 * @param {number} lon Longitude.
 * @param {number} squaredTolerance Squared tolerance.
 * @param {ol.Extent} extent Extent.
 * @param {number} index Index.
 * @return {ol.geom.LineString} The meridian line string.
 * @private
 */
ol.Graticule.prototype.getLineMeridian_ =
    function(lon, squaredTolerance, extent, index) {

	var lineString = this.meridians_[index] || new ol.geom.LineString(null);

	lineString.setFlatCoordinates(ol.geom.GeometryLayout.XY, [lon,extent[1],lon,extent[3]]);
	return lineString;
};

/**
 * Get the list of meridians.  Meridians are lines of equal longitude.
 * @return {Array.<ol.geom.LineString>} The meridians.
 * @api
 */
ol.Graticule.prototype.getMeridians = function() {
  return this.meridians_;
};


/**
 * @param {number} lat Latitude.
 * @param {number} minLon Minimal longitude.
 * @param {number} maxLon Maximal longitude.
 * @param {number} squaredTolerance Squared tolerance.
 * @return {ol.geom.LineString} The parallel line string.
 * @param {number} index Index.
 * @private
 */
ol.Graticule.prototype.getParallel_ = function(lat, minLon, maxLon,
                                               squaredTolerance, index) {
  var flatCoordinates = ol.geom.flat.geodesic.parallel(lat,
     this.minLon_, this.maxLon_, this.projection_, squaredTolerance);
  var lineString = this.parallels_[index] !== undefined ?
     this.parallels_[index] : new ol.geom.LineString(null);
  lineString.setFlatCoordinates(ol.geom.GeometryLayout.XY, flatCoordinates);
  return lineString;
};


/**
 * @param {number} lat Latitude.
 * @param {number} squaredTolerance Squared tolerance.
 * @param {ol.Extent} extent Extent.
 * @param {number} index Index.
 * @return {ol.geom.LineString} The parallel line string.
 * @private
 */
ol.Graticule.prototype.getLineParallel_ =
    function(lat, squaredTolerance, extent, index) {

	var lineString = this.parallels_[index] || new ol.geom.LineString(null);

	lineString.setFlatCoordinates(ol.geom.GeometryLayout.XY, [extent[0], lat, extent[2], lat]);
	return lineString;
};

/**
 * Get the list of parallels.  Pallels are lines of equal latitude.
 * @return {Array.<ol.geom.LineString>} The parallels.
 * @api
 */
ol.Graticule.prototype.getParallels = function() {
  return this.parallels_;
};

/**
 * @param {Array.<ol.geom.Point>} labels label array
 * @param {number} lon Longitude.
 * @param {number} lat Latitude.
 * @param {number} index Index.
 * @return {ol.geom.Point} The label point.
 * @private
 */
ol.Graticule.prototype.getLabel_ =
    function(labels, lon, lat, index) {

	var point = labels[index] || new ol.geom.Point(null);

	point.setFlatCoordinates(ol.geom.GeometryLayout.XY, [lon,lat]);
	return point;
};

/**
 * @param {ol.render.Event} e Event.
 * @private
 */
ol.Graticule.prototype.handlePostCompose_ = function(e) {
  var vectorContext = e.vectorContext;
  var frameState = e.frameState;
  var extent = frameState.extent;
  var viewState = frameState.viewState;
  var center = viewState.center;
  var projection = viewState.projection;
  var resolution = viewState.resolution;
  var pixelRatio = frameState.pixelRatio;
  var squaredTolerance =
      resolution * resolution / (4 * pixelRatio * pixelRatio);

  var updateProjectionInfo = !this.projection_ ||
      !ol.proj.equivalent(this.projection_, projection);

  if (updateProjectionInfo) {
    this.updateProjectionInfo_(projection);
  }

  //Fix the extent if wrapped.
  //(note: this is the same extent as vectorContext.extent_)
  var offsetX = 0;
  if (projection.canWrapX()) {
    var projectionExtent = projection.getExtent();
    var worldWidth = ol.extent.getWidth(projectionExtent);
    var x = frameState.focus[0];
    if (x < projectionExtent[0] || x > projectionExtent[2]) {
      var worldsAway = Math.ceil((projectionExtent[0] - x) / worldWidth);
      offsetX = worldWidth * worldsAway;
      extent = [
        extent[0] + offsetX, extent[1],
        extent[2] + offsetX, extent[3]
      ];
    }
  }

  this.createGraticule_(extent, center, resolution, squaredTolerance);

  if (!this.enabled) {
    return
  }

  // Draw the lines
  vectorContext.setFillStrokeStyle(null, this.strokeStyle_);
  var i, l, line;
  for (i = 0, l = this.meridians_.length; i < l; ++i) {
    line = this.meridians_[i];
    vectorContext.drawLineString(line, null);
  }
  for (i = 0, l = this.parallels_.length; i < l; ++i) {
    line = this.parallels_[i];
    vectorContext.drawLineString(line, null);
  }

  this.textStyle_.setTextAlign('left');
  this.textStyle_.setTextBaseline('middle');
  this.drawLabels_(this.leftLabels_, vectorContext, 1);
  this.textStyle_.setTextAlign('right');
  this.drawLabels_(this.rightLabels_, vectorContext, 1);
  this.textStyle_.setTextAlign('center');
  this.textStyle_.setTextBaseline('top');
  this.drawLabels_(this.topLabels_, vectorContext, 0);
  this.textStyle_.setTextBaseline('bottom');
  this.drawLabels_(this.bottomLabels_, vectorContext, 0);
};

/**
 * @param {Array.<ol.geom.Point>} labels Labels to draw.
 * @param {ol.render.VectorContext} vectorContext Vector context.
 * @param {number} index index.
 * @private
 */
ol.Graticule.prototype.drawLabels_ = function(labels, vectorContext, index) {
	var label, i, l, v;
	for (i = 0, l = labels.length; i < l; ++i) {
		label = labels[i];
		v = this.toLonLatTransform_(label.getFirstCoordinate())[index];
		v = (((v%360)+360+180)%360)-180;
		v = parseFloat(v.toFixed(6)); // Limit to 6 decimal number
		if (v==-180) {
			v=180;
		}
		this.textStyle_.setText( v+"°" );
		vectorContext.setTextStyle(this.textStyle_);
		vectorContext.drawPoint(label, null);
	}
};

/**
 * @param {ol.proj.Projection} projection Projection.
 * @private
 */
ol.Graticule.prototype.updateProjectionInfo_ = function(projection) {
  var epsg4326Projection = ol.proj.get('EPSG:4326');

  var extent = projection.getExtent();
  var worldExtent = projection.getWorldExtent();
  var worldExtentP = ol.proj.transformExtent(worldExtent,
     epsg4326Projection, projection);

  var maxLat = worldExtent[3];
  var maxLon = worldExtent[2];
  var minLat = worldExtent[1];
  var minLon = worldExtent[0];

  var maxLatP = worldExtentP[3];
  var maxLonP = worldExtentP[2];
  var minLatP = worldExtentP[1];
  var minLonP = worldExtentP[0];

  this.maxLat_ = maxLat;
  this.maxLon_ = maxLon;
  this.minLat_ = minLat;
  this.minLon_ = minLon;

  this.maxLatP_ = maxLatP;
  this.maxLonP_ = maxLonP;
  this.minLatP_ = minLatP;
  this.minLonP_ = minLonP;

  this.fromLonLatTransform_ = ol.proj.getTransform(
     epsg4326Projection, projection);

  this.toLonLatTransform_ = ol.proj.getTransform(
     projection, epsg4326Projection);

  this.projectionCenterLonLat_ = this.toLonLatTransform_(
     ol.extent.getCenter(extent));

  this.projection_ = projection;

  var code = projection.getCode(),
      status = this.getProjStatus(code);
  this.useLine = status=="line";
  this.enabled = status!=="none";
};

/**
 * Test if meridians and parralleles, using current projection, :
 * - can be drawn with simple lines (2 points)  => status "line".
 * - can be drawn with default method => status "default".
 * - can't be drawn => status "none"
 * @param {string} code : projection code.
 * @returns {string} : status "none" / "line" / "default"
 */
ol.Graticule.prototype.getProjStatus = function(code) {
  if (ol.ENABLE_PROJ4JS) {
    var proj4js = ol.proj.proj4.get();
    if (typeof proj4js == 'function') {
      var def = proj4js.defs(code);
      if (def !== undefined) {
        switch(def.projName) {
          case "eqc" : // Validated (EPSG:32662)
          case "longlat" : // Validated (
          case "merc" : return "line";

          // Stereographic (Test EPSG:32761) : The default method works
          // for meridians only and require too many ressources
          // (GC + core i5 => 3 minutes)
          case "stere" :

          // Cylindrical Equal Area (Test EPSG:3410) => No result
          case "cea" :

          // Equidistant Conic (Test ESRI:102031): The default method
          // works for meridians only and require too many ressources
          // (GC + core i5 => 3 minutes)
          case "eqdc" :
          return 'none';

          // Validated for moll (Test ESRI:53009)
          default : return"default";
        }
      }
    }
  }

  // Proj4Js disbaled, test if projection is one of default ol3 projections.
  // All default ol3 projections are compliant with "use line" optimisation.
  return !!ol.proj.transforms.get(code,"EPSG:4326") ? "line" : "default";
};

/**
 * Set the map for this graticule.  The graticule will be rendered on the
 * provided map.
 * @param {ol.Map} map Map.
 * @api
 */
ol.Graticule.prototype.setMap = function(map) {
  if (this.map_) {
    this.map_.un(ol.render.EventType.POSTCOMPOSE,
        this.handlePostCompose_, this);
    this.map_.render();
  }
  if (map) {
    map.on(ol.render.EventType.POSTCOMPOSE,
        this.handlePostCompose_, this);
    map.render();
  }
  this.map_ = map;
};
