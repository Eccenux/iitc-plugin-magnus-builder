// ==UserScript==
// @id             iitc-plugin-magnus-builder@eccenux
// @name           IITC plugin: Magnus builder tracker
// @category       Misc
// @version        0.0.1
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @description    Allow manual entry of deployed, unique resonators. Use the 'highlighter-magnusBuilder' plugin to show the magnusBuilder on the map, and 'sync' to share between multiple browsers or desktop/mobile. It will try and guess which portals you have captured from portal details, but this will not catch every case.
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
	console.log.apply(console.log, args);
}

/**
	Portal details loaded.
*/
window.plugin.magnusBuilder.onPortalDetailsUpdated = function() {
	if(typeof(Storage) === "undefined") {
		$('#portaldetails > .imgpreview').after(plugin.magnusBuilder.disabledMessage);
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

	$('#portaldetails > .imgpreview').after(plugin.magnusBuilder.contentHTML);
	// resonator cells order to N-clockwise order
	var clockwiseOrder = [
		0, 1,
		7, 2,
		6, 3,
		5, 4
	];
	$('#portaldetails #resodetails td').each(function(index){
		var resonatorIndex = clockwiseOrder[index];
		$(this).append('<input type="checkbox" class="resonator-box">')
		.on('click', 'input', function () {
			var captured = this.checked;
			plugin.magnusBuilder.updateResonator(resonatorIndex, captured);
        });
	});
	plugin.magnusBuilder.updateCheckedAndHighlight(guid);
};

window.plugin.magnusBuilder.updateCheckedAndHighlight = function(guid) {
	runHooks('pluginmagnusBuilderUpdatemagnusBuilder', { guid: guid });

	if (guid == window.selectedPortal) {

		/*
		var uniqueInfo = plugin.magnusBuilder.magnusBuilder[guid],
			visited = (uniqueInfo && uniqueInfo.visited) || false,
			captured = (uniqueInfo && uniqueInfo.captured) || false;
		$('#visited').prop('checked', visited);
		$('#magnusBuilder-captured').prop('checked', captured);
		*/
	}

	if (window.plugin.magnusBuilder.isHighlightActive) {
		if (portals[guid]) {
			window.setMarkerStyle (portals[guid], guid == selectedPortal);
		}
	}
};

/**
 * Update/set resonator state.
 * @param {Number} resonatorIndex With North beign 0, NE being 1 and continues clockwise.
 * @param {Boolean} captured Is resonator captured.
 * @param {String} guid Portal GUID.
 */
window.plugin.magnusBuilder.updateResonator = function(resonatorIndex, captured, guid) {
	LOG('updateVisited:', resonatorIndex, captured, guid);
/*
	if(guid == undefined) guid = window.selectedPortal;

	var uniqueInfo = plugin.magnusBuilder.magnusBuilder[guid];
	if (!uniqueInfo) {
		plugin.magnusBuilder.magnusBuilder[guid] = uniqueInfo = {
			visited: false,
			captured: false
		};
	}

	if(visited == uniqueInfo.visited) return;

	if (visited) {
		uniqueInfo.visited = true;
	} else { // not visited --> not captured
		uniqueInfo.visited = false;
		uniqueInfo.captured = false;
	}

	plugin.magnusBuilder.updateCheckedAndHighlight(guid);
	plugin.magnusBuilder.sync(guid);
*/
};

window.plugin.magnusBuilder.updateCaptured = function(captured, guid) {
/*
	if(guid == undefined) guid = window.selectedPortal;

	var uniqueInfo = plugin.magnusBuilder.magnusBuilder[guid];
	if (!uniqueInfo) {
		plugin.magnusBuilder.magnusBuilder[guid] = uniqueInfo = {
			visited: false,
			captured: false
		};
	}

	if(captured == uniqueInfo.captured) return;

	if (captured) { // captured --> visited
		uniqueInfo.captured = true;
		uniqueInfo.visited = true;
	} else {
		uniqueInfo.captured = false;
	}

	plugin.magnusBuilder.updateCheckedAndHighlight(guid);
	plugin.magnusBuilder.sync(guid);
*/
};

// <editor-fold desc="Storage/sync" defaultstate="collapsed">

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
	highlight: function(data) {
		var guid = data.portal.options.ent[0];
		var uniqueInfo = window.plugin.magnusBuilder.magnusBuilder[guid];

		var style = {};

		if (uniqueInfo) {
			if (uniqueInfo.captured) {
				// captured (and, implied, visited too) - no highlights

			} else if (uniqueInfo.visited) {
				style.fillColor = 'yellow';
				style.fillOpacity = 0.6;
			} else {
				// we have an 'uniqueInfo' entry for the portal, but it's not set visited or captured?
				// could be used to flag a portal you don't plan to visit, so use a less opaque red
				style.fillColor = 'red';
				style.fillOpacity = 0.5;
			}
		} else {
			// no visit data at all
			style.fillColor = 'red';
			style.fillOpacity = 0.7;
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
	//.html("#magnusBuilder-container {\n  display: block;\n  text-align: center;\n  margin: 6px 3px 1px 3px;\n  padding: 0 4px;\n}\n#magnusBuilder-container label {\n  margin: 0 0.5em;\n}\n#magnusBuilder-container input {\n  vertical-align: middle;\n}\n\n.portal-list-magnusBuilder input[type=\'checkbox\'] {\n  padding: 0;\n  height: auto;\n  margin-top: -5px;\n  margin-bottom: -5px;\n}\n")
	.appendTo("head");
};

window.plugin.magnusBuilder.setupContent = function() {
	plugin.magnusBuilder.contentHTML = '<div id="magnusBuilder-container">'
		+ '<label><input type="checkbox" id="magnusBuilder-captured" onclick="window.plugin.magnusBuilder.updateCaptured($(this).prop(\'checked\'))"> Resonators Captured</label>'
		+ '</div>';
	plugin.magnusBuilder.disabledMessage = '<div id="magnusBuilder-container" class="help" title="Your browser does not support localStorage">Plugin magnusBuilder disabled</div>';
};

var setup = function() {
	window.pluginCreateHook('pluginmagnusBuilderUpdatemagnusBuilder');
	window.pluginCreateHook('pluginmagnusBuilderRefreshAll');

	window.plugin.magnusBuilder.setupCSS();
	window.plugin.magnusBuilder.setupContent();
	window.plugin.magnusBuilder.loadLocal('magnusBuilder');
	window.addPortalHighlighter('magnusBuilder', window.plugin.magnusBuilder.highlighter);
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


