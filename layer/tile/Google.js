/*
 * Google layer using Google Maps API
 */

/* global google: true */

L.Google = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		minZoom: 0,
		maxZoom: 18,
		tileSize: 256,
		subdomains: 'abc',
		errorTileUrl: '',
		attribution: '',
		opacity: 1,
		continuousWorld: false,
		noWrap: false,
		mapOptions: {
			backgroundColor: '#dddddd'
		}
	},

	// Possible types: SATELLITE, ROADMAP, HYBRID, TERRAIN
	// Possible extra: NONE, BICYCLING, TRANSIT, TRAFFIC
	initialize: function (type, options, extra) {
		L.Util.setOptions(this, options);

		extra_layer = extra;
		
		this._ready = google.maps.Map !== undefined;
		if (!this._ready) L.Google.asyncWait.push(this);

		this._type = type || 'SATELLITE';

	},

	onAdd: function (map, insertAtTheBottom) {
		this._map = map;
		this._insertAtTheBottom = insertAtTheBottom;

		// create a container div for tiles
		this._initContainer();
		this._initMapObject();

		// set up events
		map.on('viewreset', this._reset, this);

		this._limitedUpdate = L.Util.limitExecByInterval(this._update, 150, this);
		map.on('move', this._update, this);

		map.on('zoomanim', this._handleZoomAnim, this);

		//20px instead of 1em to avoid a slight overlap with google's attribution
		map._controlCorners.bottomright.style.marginBottom = '20px';

		this._reset();
		this._update();
	},

	onRemove: function (map) {
		map._container.removeChild(this._container);

		map.off('viewreset', this._reset, this);

		map.off('move', this._update, this);

		map.off('zoomanim', this._handleZoomAnim, this);

		map._controlCorners.bottomright.style.marginBottom = '0em';
	},

	getAttribution: function () {
		return this.options.attribution;
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		if (opacity < 1) {
			L.DomUtil.setOpacity(this._container, opacity);
		}
	},

	setElementSize: function (e, size) {
		e.style.width = size.x + 'px';
		e.style.height = size.y + 'px';
	},

	_initContainer: function () {
		var tilePane = this._map._container,
			first = tilePane.firstChild;

		if (!this._container) {
			this._container = L.DomUtil.create('div', 'leaflet-google-layer leaflet-top leaflet-left');
			this._container.id = '_GMapContainer_' + L.Util.stamp(this);
			this._container.style.zIndex = 'auto';
		}

		tilePane.insertBefore(this._container, first);

		this.setOpacity(this.options.opacity);
		this.setElementSize(this._container, this._map.getSize());
	},

	_initMapObject: function () {
		if (!this._ready) return;
		this._google_center = new google.maps.LatLng(0, 0);
		var map = new google.maps.Map(this._container, {
			center: this._google_center,
			zoom: 0,
			tilt: 0,
			mapTypeId: google.maps.MapTypeId[this._type],
			disableDefaultUI: true,
			keyboardShortcuts: false,
			draggable: false,
			disableDoubleClickZoom: true,
			scrollwheel: false,
			streetViewControl: false,
			styles: this.options.mapOptions.styles,
			backgroundColor: this.options.mapOptions.backgroundColor
		});

		switch(extra_layer){
			case "NONE":
				break;
			case "BICYCLING":
				var bikeLayer = new google.maps.BicyclingLayer();
				bikeLayer.setMap(map);
				break;
			case "TRANSIT":
				var transitLayer = new google.maps.TransitLayer();
				transitLayer.setMap(map);
				break;
			case "TRAFFIC":
				var trafficLayer = new google.maps.TrafficLayer();
				trafficLayer.setMap(map);
				break;
		}

		var _this = this;
		this._reposition = google.maps.event.addListenerOnce(map, 'center_changed',
			function () { _this.onReposition(); });
		this._google = map;

		google.maps.event.addListenerOnce(map, 'idle',
			function () { _this._checkZoomLevels(); });
		google.maps.event.addListenerOnce(map, 'tilesloaded',
			function () { _this.fire('load'); });
		//Reporting that map-object was initialized.
		this.fire('MapObjectInitialized', {mapObject: map});
	},

	_checkZoomLevels: function () {
		//setting the zoom level on the Google map may result in a different zoom level than the one requested
		//(it won't go beyond the level for which they have data).
		// verify and make sure the zoom levels on both Leaflet and Google maps are consistent
		if ((this._map.getZoom() !== undefined) && (this._google.getZoom() !== this._map.getZoom())) {
			//zoom levels are out of sync. Set the leaflet zoom level to match the google one
			this._map.setZoom(this._google.getZoom());
		}
	},

	_reset: function () {
		this._initContainer();
	},

	_update: function () {
		if (!this._google) return;
		this._resize();

		var center = this._map.getCenter();
		var _center = new google.maps.LatLng(center.lat, center.lng);

		this._google.setCenter(_center);
		if (this._map.getZoom() !== undefined)
			this._google.setZoom(Math.round(this._map.getZoom()));

		this._checkZoomLevels();
	},

	_resize: function () {
		var size = this._map.getSize();
		if (this._container.style.width === size.x &&
				this._container.style.height === size.y)
			return;
		this.setElementSize(this._container, size);
		this.onReposition();
	},


	_handleZoomAnim: function (e) {
		var center = e.center;
		var _center = new google.maps.LatLng(center.lat, center.lng);

		this._google.setCenter(_center);
		this._google.setZoom(Math.round(e.zoom));
	},


	onReposition: function () {
		if (!this._google) return;
		google.maps.event.trigger(this._google, 'resize');
	}
});

extra_layer = "NONE";

L.Google.asyncWait = [];
L.Google.asyncInitialize = function () {
	var i;
	for (i = 0; i < L.Google.asyncWait.length; i++) {
		var o = L.Google.asyncWait[i];
		o._ready = true;
		if (o._container) {
			o._initMapObject();
			o._update();
		}
	}
	L.Google.asyncWait = [];
};
