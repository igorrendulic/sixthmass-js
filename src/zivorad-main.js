/*
 * Copyright 2017, Igor Rendulic. All Rights Reserved
 *
 * Includes portions of Underscore.js
 * http://documentcloud.github.com/underscore/
 * (c) 2011 Jeremy Ashkenas, DocumentCloud Inc.
 * Released under the MIT License.
 */

 // ==ClosureCompiler==
// @compilation_level ADVANCED_OPTIMIZATIONS
// ==/ClosureCompiler==

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
/** @const */ var URL = 'http://events.sixthmass.com/v1/event';
/** @const */ var URL_PROFILE = 'http://events.sixthmass.com/v1/profile';
/** @const */ //var URL = 'http://localhost:8079/v1/event';
/** @const */ //var URL_PROFILE = 'http://localhost:8079/v1/profile';
var globalDataQueue = [];

var zr_instance;

/*
* Config
*/
var Config = {
    DEBUG: true,
    LIB_VERSION: '0.0.2',
    events: ['click'], // dblclick
    attributePrefix: 'zr-',
    trackOnlyZr: true
};

var PostfixAction = "event";

/**
 * ZivoradLib Object
 * @constructor
 */
var ZivoradLib  = function() {};


/**
* Init of library after javascript library loaded
*/
function _zr_init() {
    var zr = window.zr;
    if (!zr) {
        console.error('zivorad object undefined!');
        return;
    }
    var lib = new ZivoradLib();
    lib.executeFunctions(zr,lib);
    zr_instance = lib;
    return zr_instance;
}

/** @constructor */
ZivoradLib.prototype.init = function(token) {

    this.initParams = {'token':token};
    this.Config = Config;
    if (this.initParams.trackOnlyZr != null) {
        this.Config.trackOnlyZr = this.initParams.trackOnlyZr;
    }

    // detect if localstorage prossible if not set cookies
    if (zr_util.islocalStorageSupported()) {
        this.Config.storage = STORAGE_LOCAL;
    } else {
        this.Config.storage = STORAGE_COOKIES;
    }

    this.PostfixAction = PostfixAction;

    // uniquely identify session and user
    this.initUser();

    // register autotracking events
    var eventList = this.Config.events;
    for (var i=0; i<eventList.length; i++) {
        var eventType = eventList[i];
        this.registerEvent(eventType,document,true);
    }
}

ZivoradLib.prototype.track = function(event, properties) {
    var e = this.createEvent(event,properties, this);
    this.queueEvent(e);
}

ZivoradLib.prototype.profile = function(profile, customProperties) {
    var p = this.createProfile(profile,customProperties,this);
    var data = {};
    data.data = p;
    this.httpRequest(data, this.getProfileUrl(), 1, false); // first delay 1 second, don't store to queue
}

ZivoradLib.prototype.purchase = function(array) {
    if (!zr_util.isArray(array)) {
        console.error('Required array of purchased items.');
        return;
    }
    var e = this.createPurchase(array, this);
    this.queueEvent(e);
}

ZivoradLib.prototype.register = function(profile,customProperties) {
    var e = this.createRegister(profile, customProperties, this);
    this.queueEvent(e);
    this.profile(profile, customProperties);
}

// Execute defered functions when
ZivoradLib.prototype.executeFunctions = function(zr,lib) {
    if (zr) {
        zr_util.each(zr, function(item) {
            var fn_name = item[0];
            if (item.length > 0) {
                item.shift();
                var args = item;
                var fn  = this[fn_name]
                if (typeof fn === 'function') {
                    fn.apply(lib,args);
                }
            }
        },this);
    }
}

ZivoradLib.prototype.getUrl = function() {
    return URL;
}

ZivoradLib.prototype.getProfileUrl = function() {
    return URL_PROFILE;
}

// register events to track
ZivoradLib.prototype.registerEvent = function(eventType, element, useCapture) {
    if (!element) {
        console.error('No valid element provided for registerEvent');
    }
    var that = this;
    element.addEventListener(eventType, function(e) {
        that.handleEvents(e, that);
    }, useCapture);
}

ZivoradLib.prototype.handleEvents = function(e, zr) { // e = event, zr = reference to zivorad
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
ZivoradLib.prototype.decorateEvents = function(events,zr) {
    if (!zr.initParams.token) {
        console.error('Missing token!');
        return;
    }
    if (events.length > 0) {
        zr_util.each(events, function(e) {
            zr_util.each(e.attributes, function(a) {
                if (a.name === (zr.Config.attributePrefix + zr.PostfixAction)) {
                    var newEvent = zr.createEvent(a.value,null,zr);
                    zr.queueEvent(newEvent);
                }
            });
        });
    }
}

ZivoradLib.prototype.createEvent = function(name, properties,zr) {
     var newEvent = {} // event object
    var userProfile = zr_util.storage.parse(STORAGE_USER_PROFILE, zr.Config.storage);
    var sessionProfile = zr_util.storage.parse(STORAGE_SESSION, zr.Config.storage);
    if (!userProfile)  {
       userProfile = this.initUser();
    }
    newEvent.uId = userProfile.userId;
    newEvent.cId = zr.initParams.token;
    newEvent.e = name;
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
    if (!zr_util.isUndefined(properties)) {
        newEvent.customValues  = properties;
    }
    return newEvent;
}

ZivoradLib.prototype.createProfile = function(profile,customProperties,zr) {
    var p = {};
    var userProfile = zr_util.storage.parse(STORAGE_USER_PROFILE, zr.Config.storage);
    if (!userProfile) {
        userProfile = zr.initUser();
    }
    p.userId = userProfile.userId;
    p.clientId = zr.initParams.token;
    p.remoteUserId = profile.user_id;
    p.email = profile.email;
    p.firstName = profile.first_name;
    p.lastName = profile.last_name;
    p.tzOffset = zr_util.timezone() * 60;
    p.gender = profile.gender;
    p.businessName = profile.business_name;
    p.birthday = profile.birthday;
    if (!zr_util.isUndefined(customProperties)) {
        p.customValues = customProperties;
    }
    zr_util.storage.set(STORAGE_USER_PROFILE,zr_util.JSONEncode(p), zr.Config.storage); // save to local storage
    return p;
}

ZivoradLib.prototype.createRegister = function(profile, customProperties, zr) {
    var p = zr.createProfile(profile, customProperties, this);
    var e = zr.createEvent('zr_register', null, zr);
    return e;
}

ZivoradLib.prototype.createPurchase = function(items, zr) {

    var purchaseEvent = zr.createEvent('zr_purchase', null, zr);
    purchaseEvent.pItems = [];
    zr_util.each(items, function(item) {
        var convItem = {};
        convItem.id = item.id;
        convItem.n = item.name;
        convItem.pr = item.price;
        convItem.q = item.quantity;
        purchaseEvent.pItems.push(convItem);
    });
    return purchaseEvent;

}

    // 1. check if storage contains user information
    // 2. if yes put this in Config
    // 3. if no uniqueId for user
    // 4. set new sessionId if old sessionId is too old (more than 30 minutes)
ZivoradLib.prototype.initUser = function() {

    var userProfile = zr_util.storage.get(STORAGE_USER_PROFILE, this.Config.storage);
    if (userProfile == null || zr_util.isUndefined(userProfile)) {
        userProfile = {};

        if (navigator.cookieEnabled) {
            var userId = zr_util.cookieStorage.get('zr_user_id');
            if (zr_util.isUndefined(userId) || userId == null) { // if not in cookies
              userId = zr_util.uuid4();
              userProfile.userId = userId;
            } else {
              userProfile.userId = userId;
            }
            zr_util.cookieStorage.set('zr_user_id',userId,3650,true,false);
        } else {
          // if cookies not enabled
          userProfile.userId = zr_util.uuid4();
        }
        zr_util.storage.set(STORAGE_USER_PROFILE,zr_util.JSONEncode(userProfile), this.Config.storage);
    }
    // todo: check what is the real id? (email, remoteId, or just our userProfile.userId)
    if (userProfile.hasOwnProperty('remoteUserId')) {
      userProfile.userId = userProfile.remoteUserId;
    }
    this.touchSession(); // init session if needed
    return userProfile;
}

// refresh session time and calculate current session length in seconds
ZivoradLib.prototype.touchSession = function() {

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
            console.log('new session defined');

            zr_util.storage.remove(STORAGE_QUEUE, this.Config.storage); // remove queue from storage (fresh start)
            zr_util.storage.remove(STORAGE_QUEUE_INDEX, this.Config.storage); // remove also queue index

            sessionJson['sId'] = zr_util.uuid4(); // new id and timestamp
            sessionJson['ts'] = now;
            sessionJson['lastTouch'] = now;
            zr_util.storage.set(STORAGE_SESSION,zr_util.JSONEncode(sessionJson), this.Config.storage);
        } else {
            var duration = (now - sessionTs) / 1000; // seconds
            console.log('session duration current', duration);
            sessionJson['sessDuration'] = duration;
            sessionJson['lastTouch'] = now;
            zr_util.storage.set(STORAGE_SESSION,zr_util.JSONEncode(sessionJson), this.Config.storage);
        }
    }
    return sessionJson;
}

// check if local storage available, otherwise use in memory queue (cookies too small - up to 4K)
ZivoradLib.prototype.queueEvent = function(event) {
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
ZivoradLib.prototype.sendData = function(queue) {

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

        this.httpRequest(current, this.getUrl(), 1, true); // 1 seconds start with progressive backoff (max to 16 seconds), store to queue
    }
}

ZivoradLib.prototype.httpRequest = function(data, url, delay, storeToQueue) {
    try {
        if (data.sent) {
            if (data.sent === 1) {
                return; // don't resend events
            }
        }
        console.log('sending ...', data);

        var http = zr_util.createXMLHTTPObject();
        http.open('POST', url, true);
        http.withCredentials = true;
        http.setRequestHeader('Content-type', 'application/json');
        var instance = this;
        http.onreadystatechange = function() {
            if(http.readyState === 4) {
                if (http.status === 200) {
                    if (storeToQueue) {
                        var queue = zr_util.storage.parse(STORAGE_QUEUE, instance.Config.storage);
                        if (queue) {
                            data.sent = 1;
                            data.sentTime = zr_util.timestamp();
                            queue[data.queueIndex] = data;
                            zr_util.storage.set(STORAGE_QUEUE,zr_util.JSONEncode(queue), instance.Config.storage);
                            queue = zr_util.storage.parse(STORAGE_QUEUE, instance.Config.storage); // remove this one
                        }
                    }
                } else {
                    // progressive backoff if failed
                    if (delay >= 1 && delay <= 15) {
                        var newDelay = delay === 1 ? 2 : delay * 2;
                        console.log('Bad HTTP Status. Retrying: ', newDelay);
                        setTimeout(function() {
                          instance.httpRequest(data, url, newDelay);
                        }, newDelay * 1000);
                    } else {
                        // handle failure
                        console.error('Bad HTTP status: ' + http.status + ', ' + http.statusText);
                    }
                }
            }
        }
        http.send(JSON.stringify(data.data));
    } catch (ex) {
        console.error(ex);
    }
}
