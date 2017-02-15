/*
 * Copyright 2017, Igor Rendulic. All Rights Reserved
 *
 * Includes portions of Underscore.js
 * http://documentcloud.github.com/underscore/
 * (c) 2011 Jeremy Ashkenas, DocumentCloud Inc.
 * Released under the MIT License.
 */

//import { _ } from './utils';
//import { _ } from './autotracker';
'use strict';

/** @const */ var ELEMENT_NODE = 1;
/** @const */ var TEXT_NODE = 3;
/** @const */ var STORAGE_LOCAL = '_zr_local';
/** @const */ var STORAGE_COOKIES = '_zr_cookies';
/** @const */ var STORAGE_USER_PROFILE = '_zr_user_profile';
/** @const */ var STORAGE_SESSION = '_zr_session';
/** @const */ var STORAGE_QUEUE = '_zr_queue';
/** @const */ var STORAGE_QUEUE_INDEX = '_zr_queue_index';
/** @const */ var INACTIVE_SESSION_RESET = 30; // 30 minutes
/** @const */ var URL = 'http://localhost:8079/v1/event'; // 30 minutes
var globalDataQueue = [];

/*
* Config
*/
var Config = {
    DEBUG: true,
    LIB_VERSION: '0.0.1',
	events: ['click'], // dblclick
	attributePrefix: 'zr-',
	trackOnlyZr: true
};

var zivorad = function(initParams) {
	window.zivorad = new Zivorad(initParams)
	return zivorad;
}

var Zivorad = function(initParams) {
	this.initParams = initParams;
	this.Config = Config;
	if (initParams.trackOnlyZr != null) {
		this.Config.trackOnlyZr = initParams.trackOnlyZr;
	}

	// detect if localstorage prossible if not set cookies
	if (zr_util.islocalStorageSupported()) {
		this.Config.storage = STORAGE_LOCAL;
	} else {
		this.Config.storage = STORAGE_COOKIES;
	}

	// uniquely identify session and user
	this.initUser();

	// register autotracking events
	var eventList = this.Config.events;
	for (var i=0; i<eventList.length; i++) {
		var eventType = eventList[i];
		this.registerEvent(eventType,document,true);
	}
}

Zivorad.prototype.debug = function() {
	if (this.Config.DEBUG) { 
		if (arguments) {
			for (var i=0; i<arguments.length; i++) {
				console.log('--- zivorad debug ---->', arguments[i]);
			}
		}
	}
};

Zivorad.prototype.getUrl = function() {
	return URL;
}

// register events to track
Zivorad.prototype.registerEvent = function(eventType, element, useCapture) {
	if (!element) {
		console.error('No valid element provided for registerEvent');
	}
	var that = this;
	element.addEventListener(eventType, function(e) {
		that.handleEvents(e, that);
	}, useCapture);
}

Zivorad.prototype.handleEvents = function(e, zr) { // e = event, zr = reference to zivorad
	if (e) {
		this.touchSession(); // refresh session

		var target = e.target;
		if (typeof e.target === 'undefined') { // https://developer.mozilla.org/en-US/docs/Web/API/Event/target#Compatibility_notes
            target = e.srcElement;
        } else {
            target = e.target;
        }
        if (target.nodeType === TEXT_NODE) { // defeat Safari bug (see: http://www.quirksmode.org/js/events_properties.html)
        	target = target.parentNode;
    	}
    	var targetList = [target];
    	var currentElement = target;
    	while (currentElement.parentNode && !zr_util.isTag(currentElement,'body')) { // ignore clicks on body tag directly (already included)
    		targetList.push(currentElement.parentNode);
    		currentElement = currentElement.parentNode;
    	} 

    	if (zr_util.shouldTrackDOMEvent(target)) {

    		var listOfEvents = [];
        	// link targets (extract links and buttons with zr- prefix)
        	zr_util.each(targetList, function(element, index) {
                var elementProperties = zr_util.getPropertiesFromElement(element);

                if (zr.Config.trackOnlyZr) {
	                if (elementProperties) {
	                	zr_util.each(elementProperties.attributes, function(el,idx) {
							if (el.name && el.name.startsWith(zr.Config.attributePrefix)) {
								listOfEvents.push(elementProperties);
							}
	                	});
	                }
            	} else { // tracking all clicks on links and submit
	            	if (elementProperties.tag_name === 'a') {
	            		listOfEvents.push(elementProperties);
	            	} else if (elementProperties.tag_name === 'input') {
	            		zr_util.each(elementProperties.attributes, function(el,idx) {
							if (el.name === 'type' && (el.value === 'submit' || el.value === 'button')) {
	            				listOfEvents.push(elementProperties);
	            			}
	            		});
	        		} else if (elementProperties.tag_name === 'button') {
	        			zr.debug(elementProperties.attributes);
	        			listOfEvents.push(elementProperties);
	        		}
            	} 
        	});
        	zr.decorateEvents(listOfEvents,zr);
    	}
	}
}

// decorating events with timestamp, timezoneOffset, referrer, sessionId, eventName, clientId, userId, userAgent,platform, lib version, language
Zivorad.prototype.decorateEvents = function(events,zr) {
	if (!zr.initParams.token) {
		console.error('Missing token!');
		return;
	}
	if (events.length > 0) {
		zr_util.each(events, function(e) {
			zr_util.each(e.attributes, function(a) {
				if (a.name.startsWith(zr.Config.attributePrefix)) {
					var newEvent = {} // event object
					var userProfile = zr_util.storage.parse(STORAGE_USER_PROFILE, zr.Config.storage);
					var sessionProfile = zr_util.storage.parse(STORAGE_SESSION, zr.Config.storage);
					newEvent.uId = userProfile.uId;
					newEvent.cId = zr.initParams.token;
					newEvent.e = a.value;
					newEvent.sId = sessionProfile.sId;
					newEvent.sessDuration = sessionProfile.sessDuration;
					newEvent.ts = zr_util.timestamp();
					newEvent.tzOffset = zr_util.timezone() * 60; // seconds
					newEvent.libVer = zr.Config.LIB_VERSION;
					var searchEngine = zr_util.referingFrom.searchEngine(document.referrer);
					if (searchEngine != null) {
						newEvent.refDomain = searchEngine;
						newEvent.searchQuery = zr_util.referingFrom.searchQuery(document.referrer);
					} else {
						newEvent.refDomain = zr_util.referingFrom.domain(document.referrer);
					}
					newEvent.browser = zr_util.referingFrom.browser(window.navigator.userAgent, window.navigator.vendor,window.opera);
					newEvent.browserVersion = zr_util.referingFrom.browserVersion(window.navigator.userAgent, window.navigator.vendor,window.opera);
					newEvent.os = zr_util.referingFrom.os(window.navigator.userAgent);
					newEvent.device = zr_util.referingFrom.device(window.navigator.userAgent);
					newEvent.lang = zr_util.referingFrom.language();
					newEvent.pageView = document.location.href;

					zr.queueEvent(newEvent);
				}
			});
		});
	}
}

	// 1. check if storage contains user information
	// 2. if yes put this in Config
	// 3. if no uniqueId for user
	// 4. set new sessionId if old sessionId is too old (more than 30 minutes)
Zivorad.prototype.initUser = function() {

	var userProfile = zr_util.storage.get(STORAGE_USER_PROFILE, this.Config.storage);
	if (userProfile == null) {
		var profile = {};
		profile['uId'] = zr_util.uuid4(); // we don't know more about user at this point
		zr_util.storage.set(STORAGE_USER_PROFILE,zr_util.JSONEncode(profile), this.Config.storage);
	}
	this.touchSession(); // init session if needed
}

// refresh session time and calculate current session length in seconds
Zivorad.prototype.touchSession = function() {

	var sessionJson = zr_util.storage.parse(STORAGE_SESSION, this.Config.storage);
	if (sessionJson == null) {
		sessionJson = {};
		sessionJson['sId'] = zr_util.uuid4();
		sessionJson['ts'] = zr_util.timestamp();
		sessionJson['lastTouch'] = zr_util.timestamp();
		zr_util.storage.set(STORAGE_SESSION,zr_util.JSONEncode(sessionJson), this.Config.storage);
	} else {
		// check how old is the session
		var sessionTs = sessionJson['ts'];
		var sessionLastTouch = sessionJson['lastTouch'];
		var now = zr_util.timestamp();
		if (now - sessionLastTouch > INACTIVE_SESSION_RESET * 60 * 1000) { // if more than 30 minutes of inactivity
			this.debug('new session defined');
			
			zr_util.storage.remove(STORAGE_QUEUE, this.Config.storage); // remove queue from storage (fresh start)
			zr_util.storage.remove(STORAGE_QUEUE_INDEX, this.Config.storage); // remove also queue index

			sessionJson['sId'] = zr_util.uuid4(); // new id and timestamp
			sessionJson['ts'] = now;
			sessionJson['lastTouch'] = now;
			zr_util.storage.set(STORAGE_SESSION,zr_util.JSONEncode(sessionJson), this.Config.storage);
		} else {
			var duration = (now - sessionTs) / 1000; // seconds
			sessionJson['sessDuration'] = duration;
			sessionJson['lastTouch'] = now;
			zr_util.storage.set(STORAGE_SESSION,zr_util.JSONEncode(sessionJson), this.Config.storage);
		}
	}
	return sessionJson;
}

// check if local storage available, otherwise use in memory queue (cookies too small - up to 4K)
Zivorad.prototype.queueEvent = function(event) {
	var queue = null;
	var queueIndex = 0;
	try {
		// selecting in-memory or local storage queue (local storage preferred)
		if (zr_util.islocalStorageSupported()) {
			queue = zr_util.storage.parse(STORAGE_QUEUE, this.Config.storage);
		} else {
			queue = globalDataQueue;
		}
		if (queue == null) { // first event sent
			queue = [];
		}
		var data = {};
		queueIndex = queue.push(data) - 1;
		data.queueIndex = queueIndex;
		data.data = event;
		if (zr_util.islocalStorageSupported()) {
			zr_util.storage.set(STORAGE_QUEUE, zr_util.JSONEncode(queue), this.Config.storage);	
		}

		this.sendData(queue);
	} catch (ex) {
		console.error('storage queue problem:', ex);
	} 
}
	

/*
* Manages queue Index for input event queue (combines current event with previous event)
* After this function events and managed as one by one event queue
*/
Zivorad.prototype.sendData = function(queue) {
	
	if (!queue) {
		console.error('required defined queue and url');
		return;
	}

	for (var i=0; i<queue.length; i++) {
		var current = queue[i];
		if (i - 1 >= 0) {
			var previous = queue[i-1];
			current.data.pTs = previous.data.ts;
			current.data.p = previous.data.e;
		}
		current.queueIndex = i;

		this.httpRequest(current, 1); // 1 seconds start with progressive backoff (max to 15 seconds)
	}
}

Zivorad.prototype.httpRequest = function(data, delay) {
	try {
		if (data.sent) {
			if (data.sent === 1) {
				console.log('not sending this event: ', data);
				return; // don't resend events
			}
		}
		var http = new XMLHttpRequest();
		http.open('POST', this.getUrl(), true);
		http.withCredentials = true;
		http.setRequestHeader('Content-type', 'application/json');
		var instance = this;
		http.onreadystatechange = function() {
			if(http.readyState === 4) {
				if (http.status === 200) {
					var queue = zr_util.storage.parse(STORAGE_QUEUE, instance.Config.storage);
					if (queue) {
						console.log(queue);
						data.sent = 1;
						data.sentTime = zr_util.timestamp();
						queue[data.queueIndex] = data;
						zr_util.storage.set(STORAGE_QUEUE,zr_util.JSONEncode(queue), instance.Config.storage);
						queue = zr_util.storage.parse(STORAGE_QUEUE, instance.Config.storage); // remove this one
						console.log(queue);
					}

				} else {
					// progressive backoff if failed
					if (delay >= 1 && delay <= 15) {
						var newDelay = delay === 1 ? 2 : delay * 2;
						console.log('Bad HTTP Status. Retrying: ', newDelay);
				        setTimeout(function() {
				          instance.httpRequest(data, newDelay);
				        }, newDelay * 1000);
				    } else {
				        // handle failure
				        console.error('Bad HTTP status: ' + http.status + ', ' + http.statusText);
				    }
				}
			}
		}
		console.log('data:', data);
		http.send(JSON.stringify(data.data));
	} catch (ex) {
		console.error(ex);
	}
}

