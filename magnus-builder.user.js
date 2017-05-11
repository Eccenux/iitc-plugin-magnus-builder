// ==UserScript==
// @id             iitc-plugin-magnus-builder@eccenux
// @name           IITC plugin: Magnus builder tracker
// @category       Misc
// @version        0.1.1
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @description    [0.1.1] Allow manual entry of deployed, unique resonators. Use the 'highlighter-magnusBuilder' plugin to show the magnusBuilder on the map, and 'sync' to share between multiple browsers or desktop/mobile. It will try and guess which portals you have captured from portal details, but this will not catch every case.
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @include        https://*.ingress.com/mission/*
// @include        http://*.ingress.com/mission/*
// @match          https://*.ingress.com/mission/*
// @match          http://*.ingress.com/mission/*
// @grant          none
// @updateURL      https://github.com/Eccenux/iitc-plugin-magnus-builder/raw/master/magnus-builder.meta.js
// @downloadURL    https://github.com/Eccenux/iitc-plugin-magnus-builder/raw/master/magnus-builder.user.js
// ==/UserScript==

function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};


//PLUGIN START ////////////////////////////////////////////////////////

//use own namespace for plugin
window.plugin.magnusBuilder = function() {};

//delay in ms
window.plugin.magnusBuilder.SYNC_DELAY = 5000;

// maps the JS property names to localStorage keys
window.plugin.magnusBuilder.FIELDS = {
	'magnusBuilder': 'plugin-magnusBuilder-data',
	'updateQueue': 'plugin-magnusBuilder-data-queue',
	'updatingQueue': 'plugin-magnusBuilder-data-updating-queue',
};

window.plugin.magnusBuilder.magnusBuilder = {};
window.plugin.magnusBuilder.updateQueue = {};
window.plugin.magnusBuilder.updatingQueue = {};

window.plugin.magnusBuilder.enableSync = false;

window.plugin.magnusBuilder.disabledMessage = null;
window.plugin.magnusBuilder.contentHTML = null;

window.plugin.magnusBuilder.isHighlightActive = false;

/**
 * Very simple logger.
 */
function LOG() {
	var args = Array.prototype.slice.call(arguments); // Make real array from arguments
	args.unshift("[magnusBuilder] ");
	console.log.apply(console, args);
}
function LOGwarn() {
	var args = Array.prototype.slice.call(arguments); // Make real array from arguments
	args.unshift("[magnusBuilder] ");
	console.warn.apply(console, args);
}

/**
 * Portal details loaded.
 */
window.plugin.magnusBuilder.onPortalDetailsUpdated = function() {
	if(typeof(Storage) === "undefined") {
		$('#portaldetails > #resodetails').before(plugin.magnusBuilder.disabledMessage);
		return;
	}

	var guid = window.selectedPortal,
		details = portalDetail.get(guid),
		nickname = window.PLAYER.nickname;
	if(details) {
		function installedByPlayer(entity) {
			return entity && entity.owner == nickname;
		}
		
		// TODO
		/*
		if(details.resonators.some(installedByPlayer)) {
			plugin.magnusBuilder.updateVisited(true);
		}
		*/
	}

	// append all-captured checkbox
	$('#portaldetails > #resodetails').before(plugin.magnusBuilder.contentHTML);
	$('#portaldetails input#magnusBuilder-captured').click(function () {
		var captured = this.checked;
		plugin.magnusBuilder.updateCaptured(captured);
	});

	// resonator cells order to N-clockwise order
	var clockwiseOrder = [
		0, 1,
		7, 2,
		6, 3,
		5, 4
	];
	// append individual resonator checkboxes
	$('#portaldetails #resodetails td').each(function(index){
		var resonatorIndex = clockwiseOrder[index];
		$(this).prepend('<input type="checkbox" class="magnusBuilder-resonator" data-index="'+resonatorIndex+'">')
		.on('click', 'input.magnusBuilder-resonator', function () {
			var captured = this.checked;
			plugin.magnusBuilder.updateResonator(resonatorIndex, captured);
        });
	});

	// init state
	plugin.magnusBuilder.updateCheckedAndHighlight(guid);
};

/**
 * Update/init checboxes state.
 * @param {String} guid
 * @returns {undefined}
 */
window.plugin.magnusBuilder.updateCheckedAndHighlight = function(guid) {
	runHooks('pluginmagnusBuilderUpdatemagnusBuilder', { guid: guid });

	// this portal details are opened
	if (guid == window.selectedPortal) {

		var portalState = plugin.magnusBuilder.getPortalState(guid);
		$('#portaldetails input#magnusBuilder-captured').prop('checked', portalState.all);
		// all selected
		if (portalState.all || portalState.indexes.length >= 8) {
			LOG('quick init - all captured');
			$('#portaldetails input.magnusBuilder-resonator').prop('checked', true);
		// all un-selected
		} else if (portalState.indexes.length === 0) {
			LOG('quick init - all un-captured');
			$('#portaldetails input.magnusBuilder-resonator').prop('checked', false);
		// individual
		} else {
			LOG('slow init - individual; ', portalState);
			$('#portaldetails input.magnusBuilder-resonator').each(function(){
				var resonatorIndex = parseInt(this.getAttribute('data-index'));
				var wasCaptured = portalState.indexes.indexOf(resonatorIndex) >= 0;
				$(this).prop('checked', wasCaptured);
			});
		}
	}

	if (window.plugin.magnusBuilder.isHighlightActive) {
		if (portals[guid]) {
			window.setMarkerStyle (portals[guid], guid == selectedPortal);
		}
	}
};

/**
 * State object for this plugin.
 *
 * Note. This just for documentation.
 *
 * @returns {PortalState}
 */
function PortalState() {
	/**
	 * True if all-captured was selected.
	 *
	 * Note! `all` MIGHT NOT be set if all resonators were selected manually.
	 */
	this.all = false;
	/**
	 * Indexes of captured portals.
	 *
	 * It's a state before `all` was set.
	 */
	this.indexes = [];
}

/**
 * Fix in-proper values and/or add default values.
 *
 * @param {PortalState} portalState
 * @returns {PortalState}
 */
function fixPortalState(portalState) {
	if (typeof portalState.all !== 'boolean') {
		portalState.all = false;
	}
	if (!Array.isArray(portalState.indexes)) {
		portalState.indexes = [];
	};
	return portalState;
}

/**
 * Gets or create (initialize) state for the portal.
 *
 * Note! This also sets the initial portal state.
 *
 * @param {String} guid Portal GUID.
 * @returns {PortalState} State object.
 */
window.plugin.magnusBuilder.getOrCreatePortalState = function(guid) {
	var portalState = plugin.magnusBuilder.magnusBuilder[guid];
	// create
	if (!portalState) {
		plugin.magnusBuilder.magnusBuilder[guid] = portalState = {};
		// add defaults
		fixPortalState(portalState);
	}
	// fix in-proper values or un-freeze
	else {
		if (Object.isFrozen(portalState)) {
			LOGwarn('portalState is frozen - replacing it');
			portalState = $.extend({}, portalState);
			plugin.magnusBuilder.magnusBuilder[guid] = portalState;
		}
		fixPortalState(portalState);
	}
	return portalState;
};

/**
 * Gets state for the portal.
 *
 * Note! You MUST NOT assume that changes to returend object will reflect state changes.
 * You SHOULD NOT change returned object.
 *
 * @param {String} guid Portal GUID.
 * @returns {PortalState} State object.
 */
window.plugin.magnusBuilder.getPortalState = function(guid) {
	var portalState = plugin.magnusBuilder.magnusBuilder[guid];
	if (!portalState) {
		portalState = {};
	}
	fixPortalState(portalState);
	return portalState;
};

/**
 * Update/set resonator state.
 * @param {Number} resonatorIndex With North beign 0, NE being 1 and continues clockwise.
 * @param {Boolean} captured Is resonator captured.
 * @param {String} guid Portal GUID.
 */
window.plugin.magnusBuilder.updateResonator = function(resonatorIndex, captured, guid) {
	if(guid == undefined) guid = window.selectedPortal;

	LOG('updateResonator: ', resonatorIndex, captured, guid);

	var portalState = plugin.magnusBuilder.getOrCreatePortalState(guid);
	var stateChanged = false;

	// special case -- unselect when `all` was selected
	if (!captured && portalState.all) {
		stateChanged = true;
		// we need to rebuild the array because it don't have to have all resonators
		portalState.indexes.length = 0;
		for (var i = 0; i < 8; i++) {
			if (i !== resonatorIndex) {
				portalState.indexes.push(i);
			}
		}
		// `all` is no longer true
		portalState.all = false;
	// that shouldn't happen
	} else if (captured && portalState.all) {
		LOGwarn('captured && portalState.all');
	// !portalState.all
	} else {
		var wasCapturedIndex = portalState.indexes.indexOf(resonatorIndex);
		var wasCaptured = wasCapturedIndex >= 0;
		if (wasCaptured !== captured) {
			stateChanged = true;
			// add index
			if (captured) {
				portalState.indexes.push(resonatorIndex);
			// remove index
			} else {
				portalState.indexes.splice(wasCapturedIndex, 1);
			}
		}
	}

	if(!stateChanged) {
		LOGwarn('state didn\'t change');
		return;
	}

	plugin.magnusBuilder.updateCheckedAndHighlight(guid);
	plugin.magnusBuilder.sync(guid);
};

/**
 * Update/set all-resonators captured state.
 *
 * Note. Switching off captured state will bring back previously set state.
 *
 * @param {Boolean} fullyCaptured Are all resonator captured.
 * @param {String} guid [optional] Portal GUID (defaults to `selectedPortal`).
 * @param {Boolean} delaySync [optional] (default=false) If true then data will not be saved to server nor will portal details state change.
 */
window.plugin.magnusBuilder.updateCaptured = function(fullyCaptured, guid, delaySync) {
	if(guid == undefined) guid = window.selectedPortal;

	if (!delaySync) {
		LOG('updateCaptured: ', fullyCaptured, guid);
	}

	var portalState = plugin.magnusBuilder.getOrCreatePortalState(guid);
	var stateChanged = false;

	if (fullyCaptured !== portalState.all) {
		stateChanged = true;
		portalState.all = fullyCaptured;

		// clear specific indexes array if individual resonators were selected manually
		if (portalState.all && portalState.indexes.length >= 8) {
			portalState.indexes.length = 0;
		}
	}

	if (delaySync) {
		return;
	}

	if(!stateChanged) {
		LOGwarn('state didn\'t change');
		return;
	}

	plugin.magnusBuilder.updateCheckedAndHighlight(guid);
	plugin.magnusBuilder.sync(guid);
};

// <editor-fold desc="Selected portals tools" defaultstate="collapsed">
/**
 * Checks if the point is contained within a polygon.
 *
 * Based on //https://rosettacode.org/wiki/Ray-casting_algorithm
 *
 * @param {Array} polygonPoints Array of LatLng points creating a polygon.
 * @param {Object} point LatLng point to check.
 * @returns {Boolean}
 */
var rayCastingUtils = {
	/**
	 * Checks if the point is contained within a polygon.
	 *
	 * Based on //https://rosettacode.org/wiki/Ray-casting_algorithm
	 *
	 * @param {Array} polygonPoints Array of LatLng points creating a polygon.
	 * @param {Object} point LatLng point to check.
	 * @returns {Boolean}
	 */
	contains : function (polygonPoints, point) {
		var lat = point.lat;
		var lng = point.lng;
		var count = 0;
		for (var b = 0; b < polygonPoints.length; b++) {
			var vertex1 = polygonPoints[b];
			var vertex2 = polygonPoints[(b + 1) % polygonPoints.length];
			if (this.west(vertex1, vertex2, lng, lat))
				++count;
		}
		return count % 2 ? true : false;
	},
	/**
	 * @param {Object} A 1st point of an edge.
	 * @param {Object} B 2nd point of an edge.
	 * @param {Number} lng
	 * @param {Number} lat
     * @return {boolean} true if (lng,lat) is west of the line segment connecting A and B
	 */
    west : function (A, B, lng, lat) {
        if (A.lat <= B.lat) {
            if (lat <= A.lat || lat > B.lat ||
                lng >= A.lng && lng >= B.lng) {
                return false;
            } else if (lng < A.lng && lng < B.lng) {
                return true;
            } else {
                return (lat - A.lat) / (lng - A.lng) > (B.lat - A.lat) / (B.lng - A.lng);
            }
        } else {
            return this.west(B, A, lng, lat);
        }
    }
};

/**
 * Get visible portals withing given bounds.
 *
 * @param {L.LatLngBounds} bounds Rectangular bounds.
 * @param {Array} polygonPoints Array of LatLng points creating a polygon.
 * @returns {Array} Array of guids for portals that are within bounds.
 */
window.plugin.magnusBuilder.getPortalsInBounds = function(bounds, polygonPoints) {
	var visiblePortals = [];
	$.each(window.portals, function(guid,portal) {
		var ll = portal.getLatLng();
		var isInside = false;
		if (bounds.contains(ll)) {
			if (!polygonPoints) {
				isInside = true;
			} else if (rayCastingUtils.contains(polygonPoints, ll)) {
				isInside = true;
			}
		}
		if (isInside) {
			visiblePortals.push(guid);
		}
	});
	return visiblePortals;
};

/**
 * Get polygons that are fully visible.
 * 
 * @returns {Array} Array of `L.Polygon`
 */
window.plugin.magnusBuilder.getVisiblePolygons = function() {
	if (!window.plugin.drawTools) {
		return [];
	}

	var visibleBounds = map.getBounds();

	var polygons = [];
	window.plugin.drawTools.drawnItems.eachLayer(function(layer) {
		if (!(layer instanceof L.Polygon)) {
			return;
		}

		if (visibleBounds.contains(layer.getBounds())) {
			polygons.push(layer);
		}
	});

	return polygons;
};

/**
 * Get polygons that are in fully visible polygons.
 *
 * @returns {Array} Array of guids for portals that are within bounds.
 */
window.plugin.magnusBuilder.getSelectedPortals = function() {
	var selection = {
		polygons: [],
		portals: []
	};
	if (!window.plugin.drawTools) {
		return selection;
	}

	// find visible polygons
	var polygons = window.plugin.magnusBuilder.getVisiblePolygons();
	if (polygons.length === 0) {
		return selection;
	}
	selection.polygons = polygons;

	// find and set state for portals in polygons
	for (var i = 0; i < polygons.length; i++) {
		var selectedPortals = window.plugin.magnusBuilder.getPortalsInBounds(
			polygons[i].getBounds(),
			polygons[i].getLatLngs()
		);
		for (var j = 0; j < selectedPortals.length; j++) {
			if (selection.portals.indexOf(selectedPortals[j]) < 0) {	// avoid duplicates
				selection.portals.push(selectedPortals[j]);
			}
		}
	}

	return selection;
};
// </editor-fold>

window.plugin.magnusBuilder.updateVisiblePortals = function(fullyCaptured) {
	if (!window.plugin.drawTools) {
		alert('Error: You must install draw tools before using this function.');
		return;
	}

	// find portals in visible polygons
	var selection = window.plugin.magnusBuilder.getSelectedPortals();

	// empty selection info
	if (selection.polygons.length === 0) {
		alert('No polygons are visible in this view. \n\
			Note that the polygon must be fully visible (all corners must be in view).');
		return;
	}
	if (selection.portals.length === 0) {
		alert('No portals are visible in the visible polygon(s).');
		return;
	}

	// confirmation
	if (!confirm('Are you sure you want to change state for all selected portals ('+selection.portals.length+')?')) {
		return;
	}

	// find and set state for portals in polygons
	for (var i = 0; i < selection.portals.length; i++) {
		var guid = selection.portals[i];
		plugin.magnusBuilder.updateCaptured(fullyCaptured, guid, true);
	}
	plugin.magnusBuilder.massPortalsUpdate(selection.portals);
};

/**
 * Saves state of many portals to server and runs GUI updates.
 *
 * This should be run after many portal state changes.
 * Use especially with `delaySync=true` in `updateCaptured`.
 *
 * @param {Array} portals Portal GUIDs
 */
window.plugin.magnusBuilder.massPortalsUpdate = function(portals) {
	// a full update - update the selected portal sidebar
	if (window.selectedPortal) {
		plugin.magnusBuilder.updateCheckedAndHighlight(window.selectedPortal);
	}
	// and also update all highlights, if needed
	if (window.plugin.magnusBuilder.isHighlightActive) {
		resetHighlightedPortals();
	}

	// save to server
	plugin.sync.updateMap('magnusBuilder', 'magnusBuilder', portals);
};

// <editor-fold desc="Storage/sync" defaultstate="collapsed">

/**
 * Forces saving all portals.
 */
window.plugin.magnusBuilder.forceSync = function() {
	var allGuids = Object.keys(plugin.magnusBuilder.magnusBuilder);
	// confirmation
	if (!confirm('Are you REALLY sure you want to force saving all portals ('+allGuids.length+')?')) {
		return;
	}
	plugin.sync.updateMap('magnusBuilder', 'magnusBuilder', allGuids);
};

// stores the gived GUID for sync
plugin.magnusBuilder.sync = function(guid) {
	plugin.magnusBuilder.updateQueue[guid] = true;
	plugin.magnusBuilder.storeLocal('magnusBuilder');
	plugin.magnusBuilder.storeLocal('updateQueue');
	plugin.magnusBuilder.syncQueue();
};

// sync the queue, but delay the actual sync to group a few updates in a single request
window.plugin.magnusBuilder.syncQueue = function() {
	if(!plugin.magnusBuilder.enableSync) return;
	
	clearTimeout(plugin.magnusBuilder.syncTimer);
	
	plugin.magnusBuilder.syncTimer = setTimeout(function() {
		plugin.magnusBuilder.syncTimer = null;

		$.extend(plugin.magnusBuilder.updatingQueue, plugin.magnusBuilder.updateQueue);
		plugin.magnusBuilder.updateQueue = {};
		plugin.magnusBuilder.storeLocal('updatingQueue');
		plugin.magnusBuilder.storeLocal('updateQueue');

		plugin.sync.updateMap('magnusBuilder', 'magnusBuilder', Object.keys(plugin.magnusBuilder.updatingQueue));
	}, plugin.magnusBuilder.SYNC_DELAY);
};

//Call after IITC and all plugin loaded
window.plugin.magnusBuilder.registerFieldForSyncing = function() {
	if(!window.plugin.sync) return;
	window.plugin.sync.registerMapForSync('magnusBuilder', 'magnusBuilder', window.plugin.magnusBuilder.syncCallback, window.plugin.magnusBuilder.syncInitialed);
};

//Call after local or remote change uploaded
window.plugin.magnusBuilder.syncCallback = function(pluginName, fieldName, e, fullUpdated) {
	if(fieldName === 'magnusBuilder') {
		plugin.magnusBuilder.storeLocal('magnusBuilder');
		// All data is replaced if other client update the data during this client
		// offline,
		// fire 'pluginmagnusBuilderRefreshAll' to notify a full update
		if(fullUpdated) {
			// a full update - update the selected portal sidebar
			if (window.selectedPortal) {
				plugin.magnusBuilder.updateCheckedAndHighlight(window.selectedPortal);
			}
			// and also update all highlights, if needed
			if (window.plugin.magnusBuilder.isHighlightActive) {
				resetHighlightedPortals();
			}

			window.runHooks('pluginmagnusBuilderRefreshAll');
			return;
		}

		if(!e) return;
		if(e.isLocal) {
			// Update pushed successfully, remove it from updatingQueue
			delete plugin.magnusBuilder.updatingQueue[e.property];
		} else {
			// Remote update
			delete plugin.magnusBuilder.updateQueue[e.property];
			plugin.magnusBuilder.storeLocal('updateQueue');
			plugin.magnusBuilder.updateCheckedAndHighlight(e.property);
			window.runHooks('pluginmagnusBuilderUpdatemagnusBuilder', {guid: e.property});
		}
	}
};

//syncing of the field is initialed, upload all queued update
window.plugin.magnusBuilder.syncInitialed = function(pluginName, fieldName) {
	if(fieldName === 'magnusBuilder') {
		plugin.magnusBuilder.enableSync = true;
		if(Object.keys(plugin.magnusBuilder.updateQueue).length > 0) {
			plugin.magnusBuilder.syncQueue();
		}
	}
};

window.plugin.magnusBuilder.storeLocal = function(name) {
	var key = window.plugin.magnusBuilder.FIELDS[name];
	if(key === undefined) return;

	var value = plugin.magnusBuilder[name];

	if(typeof value !== 'undefined' && value !== null) {
		localStorage[key] = JSON.stringify(plugin.magnusBuilder[name]);
	} else {
		localStorage.removeItem(key);
	}
};

window.plugin.magnusBuilder.loadLocal = function(name) {
	var key = window.plugin.magnusBuilder.FIELDS[name];
	if(key === undefined) return;

	if(localStorage[key] !== undefined) {
		plugin.magnusBuilder[name] = JSON.parse(localStorage[key]);
	}
};
// </editor-fold>

// <editor-fold desc="Highlighter" defaultstate="collapsed">
window.plugin.magnusBuilder.highlighter = {
	title: 'Magnus Builder',	// this is set in setup as a user-visible name
	
	highlight: function(data) {
		var guid = data.portal.options.ent[0];
		var portalState = plugin.magnusBuilder.getPortalState(guid);

		var style = {};

		// Opaque -- all resonators captured.
		if (portalState.all || portalState.indexes.length === 8) {
			style.fillOpacity = 0.2;
			style.opacity = 0.2;
		}
		// Red -- no resonators captured.
		else if (portalState.indexes.length === 0) {
			style.fillColor = 'red';
			style.fillOpacity = 0.7;
		}
		// Yellow -- some resonators captured.
		else {
			style.fillColor = 'gold';
			style.fillOpacity = 0.8;
		}

		data.portal.setStyle(style);
	},

	setSelected: function(active) {
		window.plugin.magnusBuilder.isHighlightActive = active;
	}
};
// </editor-fold>


window.plugin.magnusBuilder.setupCSS = function() {
	$("<style>")
	.prop("type", "text/css")
	.html("\
	#magnusBuilder-container {\n\
		display: block;\n  text-align: center;\n\
		margin: .6em 0 .3em;\n\
		padding: 0 .5em;\n\
	}\n\
	#magnusBuilder-container label {\n\
		margin: 0 .5em;\n\
	}\n\
	#magnusBuilder-container input {\n\
		vertical-align: middle;\n\
	}\n\
	")
	.appendTo("head");
};

  // Manual import, export and reset data
window.plugin.magnusBuilder.openDialog = function() {
    dialog({
		html: plugin.magnusBuilder.dialogContentHTML,
		dialogClass: 'ui-dialog-magnusBuilder',
		title: 'Magnus Builder'
    });
	// move to top
	$('.ui-dialog-magnusBuilder').offset({top:0});
};

window.plugin.magnusBuilder.setupContent = function() {
	plugin.magnusBuilder.contentHTML = '<div id="magnusBuilder-container">'
			+ '<p><label><input type="checkbox" id="magnusBuilder-captured"> All Resonators Captured</label></p>'
		+ '</div>'
	;
	plugin.magnusBuilder.disabledMessage = '<div id="magnusBuilder-container" class="help" title="Your browser does not support localStorage">Plugin magnusBuilder disabled</div>';

	// add link in toolkit to open dialog
	$('#toolbox').append('<a \n\
		onclick="plugin.magnusBuilder.openDialog();return false;" \n\
		title="Magnus Builder mass operations for current selection">Magnus Builder</a>');

	// dialog
	plugin.magnusBuilder.dialogContentHTML = ''
		+'<p>Draw polygon(s) to "select" portals.<p>'
		+'<p>Mark selected portals as: '
			+'<a id="magnusBuilder-massOp-done" onclick="plugin.magnusBuilder.updateVisiblePortals(true); return false"> Done</a> '
			+' &bull; '
			+'<a id="magnusBuilder-massOp-undone" onclick="plugin.magnusBuilder.updateVisiblePortals(false); return false"> Not done</a>'
		+'</p>'
	;

	// leaflet (sidebar buttons)
	$('.leaflet-control-container .leaflet-top.leaflet-left').append(''
		+'<div class="leaflet-control-magnus leaflet-bar leaflet-control">'
		+'	<a class="leaflet-control-magnus-done" href="#" title="magnus done" onclick="plugin.magnusBuilder.updateVisiblePortals(true); return false">✅</a>'
		+'	<a class="leaflet-control-magnus-undone" href="#" title="magnus undone" onclick="plugin.magnusBuilder.updateVisiblePortals(false); return false">❌</a>'
		+'</div>'
	);
};

var setup = function() {
	window.pluginCreateHook('pluginmagnusBuilderUpdatemagnusBuilder');
	window.pluginCreateHook('pluginmagnusBuilderRefreshAll');

	window.plugin.magnusBuilder.setupCSS();
	window.plugin.magnusBuilder.setupContent();
	window.plugin.magnusBuilder.loadLocal('magnusBuilder');
	window.addPortalHighlighter(window.plugin.magnusBuilder.highlighter.title, window.plugin.magnusBuilder.highlighter);
	window.addHook('portalDetailsUpdated', window.plugin.magnusBuilder.onPortalDetailsUpdated);
	window.addHook('iitcLoaded', window.plugin.magnusBuilder.registerFieldForSyncing);
};

//PLUGIN END //////////////////////////////////////////////////////////


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);


