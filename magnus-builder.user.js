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

window.plugin.magnusBuilder.onPortalDetailsUpdated = function() {
	if(typeof(Storage) === "undefined") {
		$('#portaldetails > .imgpreview').after(plugin.magnusBuilder.disabledMessage);
		return;
	}

	var guid = window.selectedPortal,
		details = portalDetail.get(guid),
		nickname = window.PLAYER.nickname;
	if(details) {
		if(details.owner == nickname) {
			//FIXME: a virus flip will set the owner of the portal, but doesn't count as a unique capture
			plugin.magnusBuilder.updateCaptured(true);
			// no further logic required
		} else {
			function installedByPlayer(entity) {
				return entity && entity.owner == nickname;
			}
			
			if(details.resonators.some(installedByPlayer) || details.mods.some(installedByPlayer)) {
				plugin.magnusBuilder.updateVisited(true);
			}
		}
	}

	$('#portaldetails > .imgpreview').after(plugin.magnusBuilder.contentHTML);
	plugin.magnusBuilder.updateCheckedAndHighlight(guid);
}

window.plugin.magnusBuilder.onPublicChatDataAvailable = function(data) {
	var nick = window.PLAYER.nickname;
	data.result.forEach(function(msg) {
		var plext = msg[2].plext,
			markup = plext.markup;

		if(plext.plextType == 'SYSTEM_BROADCAST'
		&& markup.length==5
		&& markup[0][0] == 'PLAYER'
		&& markup[0][1].plain == nick
		&& markup[1][0] == 'TEXT'
		&& markup[1][1].plain == ' deployed an '
		&& markup[2][0] == 'TEXT'
		&& markup[3][0] == 'TEXT'
		&& markup[3][1].plain == ' Resonator on '
		&& markup[4][0] == 'PORTAL') {
			// search for "x deployed an Ly Resonator on z"
			var portal = markup[4][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.magnusBuilder.setPortalVisited(guid);
		} else if(plext.plextType == 'SYSTEM_BROADCAST'
		&& markup.length==3
		&& markup[0][0] == 'PLAYER'
		&& markup[0][1].plain == nick
		&& markup[1][0] == 'TEXT'
		&& markup[1][1].plain == ' deployed a Resonator on '
		&& markup[2][0] == 'PORTAL') {
			// search for "x deployed a Resonator on z"
			var portal = markup[2][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.magnusBuilder.setPortalVisited(guid);
		} else if(plext.plextType == 'SYSTEM_BROADCAST'
		&& markup.length==3
		&& markup[0][0] == 'PLAYER'
		&& markup[0][1].plain == nick
		&& markup[1][0] == 'TEXT'
		&& markup[1][1].plain == ' captured '
		&& markup[2][0] == 'PORTAL') {
			// search for "x captured y"
			var portal = markup[2][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.magnusBuilder.setPortalCaptured(guid);
		} else if(plext.plextType == 'SYSTEM_BROADCAST'
		&& markup.length==5
		&& markup[0][0] == 'PLAYER'
		&& markup[0][1].plain == nick
		&& markup[1][0] == 'TEXT'
		&& markup[1][1].plain == ' linked '
		&& markup[2][0] == 'PORTAL'
		&& markup[3][0] == 'TEXT'
		&& markup[3][1].plain == ' to '
		&& markup[4][0] == 'PORTAL') {
			// search for "x linked y to z"
			var portal = markup[2][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.magnusBuilder.setPortalVisited(guid);
		} else if(plext.plextType == 'SYSTEM_NARROWCAST'
		&& markup.length==6
		&& markup[0][0] == 'TEXT'
		&& markup[0][1].plain == 'Your '
		&& markup[1][0] == 'TEXT'
		&& markup[2][0] == 'TEXT'
		&& markup[2][1].plain == ' Resonator on '
		&& markup[3][0] == 'PORTAL'
		&& markup[4][0] == 'TEXT'
		&& markup[4][1].plain == ' was destroyed by '
		&& markup[5][0] == 'PLAYER') {
			// search for "Your Lx Resonator on y was destroyed by z"
			var portal = markup[3][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.magnusBuilder.setPortalVisited(guid);
		} else if(plext.plextType == 'SYSTEM_NARROWCAST'
		&& markup.length==5
		&& markup[0][0] == 'TEXT'
		&& markup[0][1].plain == 'Your '
		&& markup[1][0] == 'TEXT'
		&& markup[2][0] == 'TEXT'
		&& markup[2][1].plain == ' Resonator on '
		&& markup[3][0] == 'PORTAL'
		&& markup[4][0] == 'TEXT'
		&& markup[4][1].plain == ' has decayed') {
		    // search for "Your Lx Resonator on y has decayed"
			var portal = markup[3][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.magnusBuilder.setPortalVisited(guid);
		} else if(plext.plextType == 'SYSTEM_NARROWCAST'
		&& markup.length==4
		&& markup[0][0] == 'TEXT'
		&& markup[0][1].plain == 'Your Portal '
		&& markup[1][0] == 'PORTAL'
		&& markup[2][0] == 'TEXT'
		&& (markup[2][1].plain == ' neutralized by ' || markup[2][1].plain == ' is under attack by ')
		&& markup[3][0] == 'PLAYER') {
		    // search for "Your Portal x neutralized by y"
		    // search for "Your Portal x is under attack by y"
			var portal = markup[1][1];
			var guid = window.findPortalGuidByPositionE6(portal.latE6, portal.lngE6);
			if(guid) plugin.magnusBuilder.setPortalVisited(guid);
		}
	});
}

window.plugin.magnusBuilder.updateCheckedAndHighlight = function(guid) {
	runHooks('pluginmagnusBuilderUpdatemagnusBuilder', { guid: guid });

	if (guid == window.selectedPortal) {

		var uniqueInfo = plugin.magnusBuilder.magnusBuilder[guid],
			visited = (uniqueInfo && uniqueInfo.visited) || false,
			captured = (uniqueInfo && uniqueInfo.captured) || false;
		$('#visited').prop('checked', visited);
		$('#captured').prop('checked', captured);
	}

	if (window.plugin.magnusBuilder.isHighlightActive) {
		if (portals[guid]) {
			window.setMarkerStyle (portals[guid], guid == selectedPortal);
		}
	}
}


window.plugin.magnusBuilder.setPortalVisited = function(guid) {
	var uniqueInfo = plugin.magnusBuilder.magnusBuilder[guid];
	if (uniqueInfo) {
		if(uniqueInfo.visited) return;

		uniqueInfo.visited = true;
	} else {
		plugin.magnusBuilder.magnusBuilder[guid] = {
			visited: true,
			captured: false
		};
	}

	plugin.magnusBuilder.updateCheckedAndHighlight(guid);
	plugin.magnusBuilder.sync(guid);
}

window.plugin.magnusBuilder.setPortalCaptured = function(guid) {
	var uniqueInfo = plugin.magnusBuilder.magnusBuilder[guid];
	if (uniqueInfo) {
		if(uniqueInfo.visited && uniqueInfo.captured) return;

		uniqueInfo.visited = true;
		uniqueInfo.captured = true;
	} else {
		plugin.magnusBuilder.magnusBuilder[guid] = {
			visited: true,
			captured: true
		};
	}

	plugin.magnusBuilder.updateCheckedAndHighlight(guid);
	plugin.magnusBuilder.sync(guid);
}

window.plugin.magnusBuilder.updateVisited = function(visited, guid) {
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
}

window.plugin.magnusBuilder.updateCaptured = function(captured, guid) {
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
}

// stores the gived GUID for sync
plugin.magnusBuilder.sync = function(guid) {
	plugin.magnusBuilder.updateQueue[guid] = true;
	plugin.magnusBuilder.storeLocal('magnusBuilder');
	plugin.magnusBuilder.storeLocal('updateQueue');
	plugin.magnusBuilder.syncQueue();
}

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
}

//Call after IITC and all plugin loaded
window.plugin.magnusBuilder.registerFieldForSyncing = function() {
	if(!window.plugin.sync) return;
	window.plugin.sync.registerMapForSync('magnusBuilder', 'magnusBuilder', window.plugin.magnusBuilder.syncCallback, window.plugin.magnusBuilder.syncInitialed);
}

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
}

//syncing of the field is initialed, upload all queued update
window.plugin.magnusBuilder.syncInitialed = function(pluginName, fieldName) {
	if(fieldName === 'magnusBuilder') {
		plugin.magnusBuilder.enableSync = true;
		if(Object.keys(plugin.magnusBuilder.updateQueue).length > 0) {
			plugin.magnusBuilder.syncQueue();
		}
	}
}

window.plugin.magnusBuilder.storeLocal = function(name) {
	var key = window.plugin.magnusBuilder.FIELDS[name];
	if(key === undefined) return;

	var value = plugin.magnusBuilder[name];

	if(typeof value !== 'undefined' && value !== null) {
		localStorage[key] = JSON.stringify(plugin.magnusBuilder[name]);
	} else {
		localStorage.removeItem(key);
	}
}

window.plugin.magnusBuilder.loadLocal = function(name) {
	var key = window.plugin.magnusBuilder.FIELDS[name];
	if(key === undefined) return;

	if(localStorage[key] !== undefined) {
		plugin.magnusBuilder[name] = JSON.parse(localStorage[key]);
	}
}

/***************************************************************************************************************************************************************/
/** HIGHLIGHTER ************************************************************************************************************************************************/
/***************************************************************************************************************************************************************/
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
}


window.plugin.magnusBuilder.setupCSS = function() {
	$("<style>")
	.prop("type", "text/css")
	.html("#magnusBuilder-container {\n  display: block;\n  text-align: center;\n  margin: 6px 3px 1px 3px;\n  padding: 0 4px;\n}\n#magnusBuilder-container label {\n  margin: 0 0.5em;\n}\n#magnusBuilder-container input {\n  vertical-align: middle;\n}\n\n.portal-list-magnusBuilder input[type=\'checkbox\'] {\n  padding: 0;\n  height: auto;\n  margin-top: -5px;\n  margin-bottom: -5px;\n}\n")
	.appendTo("head");
}

window.plugin.magnusBuilder.setupContent = function() {
	plugin.magnusBuilder.contentHTML = '<div id="magnusBuilder-container">'
		+ '<label><input type="checkbox" id="visited" onclick="window.plugin.magnusBuilder.updateVisited($(this).prop(\'checked\'))"> Visited</label>'
		+ '<label><input type="checkbox" id="captured" onclick="window.plugin.magnusBuilder.updateCaptured($(this).prop(\'checked\'))"> Captured</label>'
		+ '</div>';
	plugin.magnusBuilder.disabledMessage = '<div id="magnusBuilder-container" class="help" title="Your browser does not support localStorage">Plugin magnusBuilder disabled</div>';
}

window.plugin.magnusBuilder.setupPortalsList = function() {
	if(!window.plugin.portalslist) return;

	window.addHook('pluginmagnusBuilderUpdatemagnusBuilder', function(data) {
		var info = plugin.magnusBuilder.magnusBuilder[data.guid];
		if(!info) info = { visited: false, captured: false };

		$('[data-list-magnusBuilder="'+data.guid+'"].visited').prop('checked', !!info.visited);
		$('[data-list-magnusBuilder="'+data.guid+'"].captured').prop('checked', !!info.captured);
	});

	window.addHook('pluginmagnusBuilderRefreshAll', function() {
		$('[data-list-magnusBuilder]').each(function(i, element) {
			var guid = element.getAttribute("data-list-magnusBuilder");

			var info = plugin.magnusBuilder.magnusBuilder[guid];
			if(!info) info = { visited: false, captured: false };

			var e = $(element);
			if(e.hasClass('visited')) e.prop('checked', !!info.visited);
			if(e.hasClass('captured')) e.prop('checked', !!info.captured);
		});
	});

	function uniqueValue(guid) {
		var info = plugin.magnusBuilder.magnusBuilder[guid];
		if(!info) return 0;

		if(info.visited && info.captured) return 2;
		if(info.visited) return 1;
	}

	window.plugin.portalslist.fields.push({
		title: "Visit",
		value: function(portal) { return portal.options.guid; }, // we store the guid, but implement a custom comparator so the list does sort properly without closing and reopening the dialog
		sort: function(guidA, guidB) {
			return uniqueValue(guidA) - uniqueValue(guidB);
		},
		format: function(cell, portal, guid) {
			var info = plugin.magnusBuilder.magnusBuilder[guid];
			if(!info) info = { visited: false, captured: false };

			$(cell).addClass("portal-list-magnusBuilder");

			// for some reason, jQuery removes event listeners when the list is sorted. Therefore we use DOM's addEventListener
			$('<input>')
				.prop({
					type: "checkbox",
					className: "visited",
					title: "Portal visited?",
					checked: !!info.visited,
				})
				.attr("data-list-magnusBuilder", guid)
				.appendTo(cell)
				[0].addEventListener("change", function(ev) {
					window.plugin.magnusBuilder.updateVisited(this.checked, guid);
					ev.preventDefault();
					return false;
				}, false);
			$('<input>')
				.prop({
					type: "checkbox",
					className: "captured",
					title: "Portal captured?",
					checked: !!info.captured,
				})
				.attr("data-list-magnusBuilder", guid)
				.appendTo(cell)
				[0].addEventListener("change", function(ev) {
					window.plugin.magnusBuilder.updateCaptured(this.checked, guid);
					ev.preventDefault();
					return false;
				}, false);
		},
	});
}

window.plugin.magnusBuilder.onMissionChanged = function(data) {
	if(!data.local) return;
	
	var mission = window.plugin.missions && window.plugin.missions.getMissionCache(data.mid, false);
	if(!mission) return;
	
	window.plugin.magnusBuilder.checkMissionWaypoints(mission);
};

window.plugin.magnusBuilder.onMissionLoaded = function(data) {
	// the mission has been loaded, but the dialog isn't visible yet.
	// we'll wait a moment so the mission dialog is opened behind the confirmation prompt
	setTimeout(function() {
		window.plugin.magnusBuilder.checkMissionWaypoints(data.mission);
	}, 0);
};

window.plugin.magnusBuilder.checkMissionWaypoints = function(mission) {
	if(!(window.plugin.missions && window.plugin.missions.checkedMissions[mission.guid])) return;
	
	if(!mission.waypoints) return;
	
	function isValidWaypoint(wp) {
		// might be hidden or field trip card
		if(!(wp && wp.portal && wp.portal.guid)) return false;
		
		// only use hack, deploy, link, field and upgrade; ignore photo and passphrase
		if(wp.objectiveNum <= 0 || wp.objectiveNum > 5) return false;
		
		return true;
	}
	function isVisited(wp) {
		var guid = wp.portal.guid,
			uniqueInfo = plugin.magnusBuilder.magnusBuilder[guid],
			visited = (uniqueInfo && uniqueInfo.visited) || false;
		
		return visited;
	}
	
	// check if all waypoints are already visited
	if(mission.waypoints.every(function(wp) {
		if(!isValidWaypoint(wp)) return true;
		return isVisited(wp);
	})) return;
	
	if(!confirm('The mission ' + mission.title + ' contains waypoints not yet marked as visited.\n\n' +
			'Do you want to set them to \'visited\' now?'))
		return;
	
	mission.waypoints.forEach(function(wp) {
		if(!isValidWaypoint(wp)) return;
		if(isVisited(wp)) return;
		
		plugin.magnusBuilder.setPortalVisited(wp.portal.guid);
	});
};


var setup = function() {
	window.pluginCreateHook('pluginmagnusBuilderUpdatemagnusBuilder');
	window.pluginCreateHook('pluginmagnusBuilderRefreshAll');
	
	// to mark mission portals as visited
	window.pluginCreateHook('plugin-missions-mission-changed');
	window.pluginCreateHook('plugin-missions-loaded-mission');
	
	window.plugin.magnusBuilder.setupCSS();
	window.plugin.magnusBuilder.setupContent();
	window.plugin.magnusBuilder.loadLocal('magnusBuilder');
	window.addPortalHighlighter('magnusBuilder', window.plugin.magnusBuilder.highlighter);
	window.addHook('portalDetailsUpdated', window.plugin.magnusBuilder.onPortalDetailsUpdated);
	window.addHook('publicChatDataAvailable', window.plugin.magnusBuilder.onPublicChatDataAvailable);
	window.addHook('iitcLoaded', window.plugin.magnusBuilder.registerFieldForSyncing);
	
	window.addHook('plugin-missions-mission-changed', window.plugin.magnusBuilder.onMissionChanged);
	window.addHook('plugin-missions-loaded-mission', window.plugin.magnusBuilder.onMissionLoaded);
	
	if(window.plugin.portalslist) {
		window.plugin.magnusBuilder.setupPortalsList();
	} else {
		setTimeout(function() {
			if(window.plugin.portalslist)
				window.plugin.magnusBuilder.setupPortalsList();
		}, 500);
	}
}

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


