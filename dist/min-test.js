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

var PostfixAction = "event";

/**
 * ZivoradLib Object
 * @constructor
 */
var ZivoradLib  = function() {};


/**
* Init of library after javascript library loaded
*/
function _zr_init(zr) {
    if (!zr) {
        console.error('zivorad object undefined!');
        return;
    }

    var loaded = false;
    var lib = new ZivoradLib();
    

    function dom_loaded_init(lib) {
        if (loaded) {
            console.log('Zivorad lib already loaded');
            return;
        }
        loaded = true;
        lib.executeFunctions(zr,lib);
        return lib;
    }

    if (document.addEventListener) {
        if (document.readyState === 'complete') {
            dom_loaded_init(lib);
        } else {
            document.addEventListener('DOMContentLoaded', dom_loaded_init(lib), false);
        }
    } else if (document.attachEvent) {
        // IE
        document.attachEvent('onreadystatechange', dom_loaded_init(lib));
    }
};

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


ZivoradLib.prototype.debug = function() {
    if (this.Config.DEBUG) { 
        if (arguments) {
            for (var i=0; i<arguments.length; i++) {
                console.log('--- zivorad debug ---->', arguments[i]);
            }
        }
    }
};

ZivoradLib.prototype.getUrl = function() {
    return URL;
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
ZivoradLib.prototype.initUser = function() {

    var userProfile = zr_util.storage.get(STORAGE_USER_PROFILE, this.Config.storage);
    if (userProfile == null) {
        var profile = {};
        profile['uId'] = zr_util.uuid4(); // we don't know more about user at this point
        zr_util.storage.set(STORAGE_USER_PROFILE,zr_util.JSONEncode(profile), this.Config.storage);
    }
    this.touchSession(); // init session if needed
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

        this.httpRequest(current, 1); // 1 seconds start with progressive backoff (max to 15 seconds)
    }
}

ZivoradLib.prototype.httpRequest = function(data, delay) {
    try {
        if (data.sent) {
            if (data.sent === 1) {
                console.log('not sending this event: ', data);
                return; // don't resend events
            }
        }
        var http = zr_util.createXMLHTTPObject();
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
        http.send(JSON.stringify(data.data));
    } catch (ex) {
        console.error(ex);
    }
}

/*
 * Copyright 2017, Igor Rendulic. All Rights Reserved
 * Some utility functions borrowed from Mixpanel Inc., https://github.com/mixpanel/mixpanel-js/blob/master/src/utils.js
 */

  // ==ClosureCompiler==
// @compilation_level ADVANCED_OPTIMIZATIONS
// ==/ClosureCompiler==

 var zr_util  = {

 };

var XMLHttpFactories = [
    function () {return new XMLHttpRequest()},
    function () {return new ActiveXObject("Msxml2.XMLHTTP")},
    function () {return new ActiveXObject("Msxml3.XMLHTTP")},
    function () {return new ActiveXObject("Microsoft.XMLHTTP")}
];

zr_util.createXMLHTTPObject = function() {
    var xmlhttp = false;
    for (var i=0;i<XMLHttpFactories.length;i++) {
        try {
            xmlhttp = XMLHttpFactories[i]();
        }
        catch (e) {
            continue;
        }
        break;
    }
    return xmlhttp;
}


zr_util.timestamp = function() {
    Date.now = Date.now || function() {
        return +new Date;
    };
    return Date.now();
};

// _.isBlockedUA()
// This is to block various web spiders from executing our JS and
// sending false tracking data
zr_util.isBlockedUA = function(ua) {
    if (/(google web preview|baiduspider|yandexbot|bingbot|googlebot|yahoo! slurp)/i.test(ua)) {
        return true;
    }
    return false;
};

zr_util.isTag = function(el, tag) {
    return el && el.tagName && el.tagName.toLowerCase() === tag.toLowerCase();
};

/**
 * @param {*=} obj
 * @param {function(...[*])=} iterator
 * @param {Object=} context
 */
zr_util.each = function(obj, iterator, context) {
    if (obj === null || obj === undefined) {
        return;
    }
    if (Array.prototype && obj.forEach === Array.prototype) {
        obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
        for (var i = 0, l = obj.length; i < l; i++) {
            if (i in obj && iterator.call(context, obj[i], i, obj) === {}) {
                return;
            }
        }
    } else {
        for (var key in obj) {
            if (hasOwnProperty.call(obj, key)) {
                if (iterator.call(context, obj[key], key, obj) === {}) {
                    return;
                }
            }
        }
    }
};

zr_util.shouldTrackDOMEvent = function(element) {
    if (!element || this.isTag(element, 'html') || element.nodeType !== ELEMENT_NODE) {
        return false;
    }
    var tag = element.tagName.toLowerCase();
    switch (tag) {
        case 'html':
            return false;
        case 'form':
            return event.type === 'submit';
        case 'input':
            if (['button', 'submit'].indexOf(element.getAttribute('type')) === -1) {
                //return event.type === 'change';
                return false;
            } else {
                return event.type === 'click';
            }
        case 'select':
        case 'textarea':
            // return event.type === 'change';
            return false;
        default:
            return event.type === 'click';
    }
};

zr_util.getClassName = function(elem) {
    switch(typeof elem.className) {
        case 'string':
            return elem.className;
        case 'object': // handle cases where className might be SVGAnimatedString or some other type
            return elem.className.baseVal || elem.getAttribute('class') || '';
        default: // future proof
            return '';
    }
};

zr_util.getPropertiesFromElement = function(elem) {
    var props = {
        'classes': this.getClassName(elem).split(' '),
        'tag_name': elem.tagName.toLowerCase()
    };

    var attributes = [];
    this.each(elem.attributes, function(attr) {
        attributes.push({'name':attr.name, 'value':attr.value});
    });
    props['attributes'] = attributes;

    return props;
};

zr_util.islocalStorageSupported = function() {
    var supported = true;
     try {
        var key = '__zrstoragesupport__', val = 'zivorad';
            zr_util.localStorage.set(key, val);
            if (zr_util.localStorage.get(key) !== val) {
                supported = false;
            }
            zr_util.localStorage.remove(key);
    } catch (err) {
            supported = false;
    }
    if (!supported) {
        console.error('localStorage unsupported; falling back to cookie store');
    }
    return supported;
}

zr_util.uuid4 = function() {
    var d = Date.now();
    if(window.performance && typeof window.performance.now === "function"){
        d += performance.now(); //use high-precision timer if available
    }
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
}

zr_util.timestamp = function() {
    Date.now = Date.now || function() {
        return +new Date;
    };
    return Date.now();
}

zr_util.timezone = function() {
    return new Date().getTimezoneOffset();
}

// universal storage (either local storage or cookies)
zr_util.storage = {
    get: function(name,storageType) {
        if (storageType && storageType === '_zr_local') {
            return zr_util.localStorage.get(name);
        } else {
            return zr_util.cookie.get(name);
        }
    },
    set: function(name,value,storageType) {
        if (storageType && storageType === '_zr_local') {
            zr_util.localStorage.set(name,value);
        } else {
            zr_util.cookie.set(name,value, 5000, true, true);
        }
    },
    remove: function(name,storageType) {
        if (storageType && storageType === '_zr_local') {
            zr_util.localStorage.remove(name);
        } else {
            zr_util.cookie.remove(name, true);
        }
    },
    parse: function(name, storageType) {
        if (storageType && storageType === '_zr_local') {
            return zr_util.localStorage.parse(name);
        } else {
            return zr_util.cookie.parse(name);
        }
    }

}

zr_util.localStorage = {
    error: function(msg) {
        console.error('localStorage error: ' + msg);
    },

    get: function(name) {
        try {
            return window.localStorage.getItem(name);
        } catch (err) {
            console.error(err);
        }
        return null;
    },

    parse: function(name) {
        try {
            return zr_util.JSONDecode(zr_util.localStorage.get(name)) || {};
        } catch (err) {
            // noop
        }
        return null;
    },

    set: function(name, value) {
        try {
            window.localStorage.setItem(name, value);
        } catch (err) {
            console.error(err);
        }
    },

    remove: function(name) {
        try {
            window.localStorage.removeItem(name);
        } catch (err) {
            console.error(err);
        }
    }
};

// Methods partially borrowed from quirksmode.org/js/cookies.html and mixpanel.com
zr_util.cookieStorage = {
    get: function(name) {
        var nameEQ = name + '=';
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(nameEQ) === 0) {
                return decodeURIComponent(c.substring(nameEQ.length, c.length));
            }
        }
        return null;
    },

    parse: function(name) {
        var cookie;
        try {
            cookie = zr_util.JSONDecode(zr_util.cookie.get(name)) || {};
        } catch (err) {
            // noop
        }
        return cookie;
    },

    set_seconds: function(name, value, seconds, cross_subdomain, is_secure) {
        var cdomain = '',
            expires = '',
            secure = '';

        if (cross_subdomain) {
            var matches = document.location.hostname.match(/[a-z0-9][a-z0-9\-]+\.[a-z\.]{2,6}$/i),
                domain = matches ? matches[0] : '';

            cdomain = ((domain) ? '; domain=.' + domain : '');
        }

        if (seconds) {
            var date = new Date();
            date.setTime(date.getTime() + (seconds * 1000));
            expires = '; expires=' + date.toGMTString();
        }

        if (is_secure) {
            secure = '; secure';
        }

        document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/' + cdomain + secure;
    },

    set: function(name, value, days, cross_subdomain, is_secure) {
        var cdomain = '', expires = '', secure = '';

        if (cross_subdomain) {
            var matches = document.location.hostname.match(/[a-z0-9][a-z0-9\-]+\.[a-z\.]{2,6}$/i),
                domain = matches ? matches[0] : '';

            cdomain   = ((domain) ? '; domain=.' + domain : '');
        }

        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = '; expires=' + date.toGMTString();
        }

        if (is_secure) {
            secure = '; secure';
        }

        var new_cookie_val = name + '=' + encodeURIComponent(value) + expires + '; path=/' + cdomain + secure;
        document.cookie = new_cookie_val;
        return new_cookie_val;
    },

    remove: function(name, cross_subdomain) {
        document.cookie.set(name, '', -1, cross_subdomain);
    }
};

zr_util.getQueryParam = function(url, param) {
    // Expects a raw URL

    param = param.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]');
    var regexS = '[\\?&]' + param + '=([^&#]*)',
        regex = new RegExp(regexS),
        results = regex.exec(url);
    if (results === null || (results && typeof(results[1]) !== 'string' && results[1].length)) {
        return '';
    } else {
        return decodeURIComponent(results[1]).replace(/\+/g, ' ');
    }
};

zr_util.includes = function(str, needle) {
    return str.indexOf(needle) !== -1;
}

zr_util.referingFrom = {
    domain: function(referer) {
        var split = referer.split('/');
        if (split.length >= 3) {
            return split[2];
        }
        return null;
    },
    searchEngine: function(referrer) {
        if (referrer.search('https?://(.*)google.([^/?]*)') === 0) {
            return 'google';
        } else if (referrer.search('https?://(.*)bing.com') === 0) {
            return 'bing';
        } else if (referrer.search('https?://(.*)yahoo.com') === 0) {
            return 'yahoo';
        } else if (referrer.search('https?://(.*)duckduckgo.com') === 0) {
            return 'duckduckgo';
        } else {
            return null;
        }
    },
    searchQuery: function(referrer) {
        var search = zr_util.referingFrom.searchEngine(referrer),param = (search != 'yahoo') ? 'q' : 'p',ret = "";

        if (search !== null) {

            var keyword = zr_util.getQueryParam(referrer, param);
            if (keyword.length) {
                ret = ret + "," + keyword;
            }
        }
        return ret;
    },

    browser: function(user_agent, vendor, opera) {
        vendor = vendor || ''; // vendor is undefined for at least IE9
        if (opera || zr_util.includes(user_agent, ' OPR/')) {
            if (zr_util.includes(user_agent, 'Mini')) {
                return 'Opera Mini';
            }
            return 'Opera';
        } else if (/(BlackBerry|PlayBook|BB10)/i.test(user_agent)) {
            return 'BlackBerry';
        } else if (zr_util.includes(user_agent, 'IEMobile') || zr_util.includes(user_agent, 'WPDesktop')) {
            return 'Internet Explorer Mobile';
        } else if (zr_util.includes(user_agent, 'Edge')) {
            return 'Microsoft Edge';
        } else if (zr_util.includes(user_agent, 'FBIOS')) {
            return 'Facebook Mobile';
        } else if (zr_util.includes(user_agent, 'Chrome')) {
            return 'Chrome';
        } else if (zr_util.includes(user_agent, 'CriOS')) {
            return 'Chrome iOS';
        } else if (zr_util.includes(user_agent, 'UCWEB') || zr_util.includes(user_agent, 'UCBrowser')) {
            return 'UC Browser';
        } else if (zr_util.includes(user_agent, 'FxiOS')) {
            return 'Firefox iOS';
        } else if (zr_util.includes(vendor, 'Apple')) {
            if (zr_util.includes(user_agent, 'Mobile')) {
                return 'Mobile Safari';
            }
            return 'Safari';
        } else if (zr_util.includes(user_agent, 'Android')) {
            return 'Android Mobile';
        } else if (zr_util.includes(user_agent, 'Konqueror')) {
            return 'Konqueror';
        } else if (zr_util.includes(user_agent, 'Firefox')) {
            return 'Firefox';
        } else if (zr_util.includes(user_agent, 'MSIE') || zr_util.includes(user_agent, 'Trident/')) {
            return 'Internet Explorer';
        } else if (zr_util.includes(user_agent, 'Gecko')) {
            return 'Mozilla';
        } else {
            return null;
        }
    },
    /**
     * This function detects which browser version is running this script,
     * parsing major and minor version (e.g., 42.1). User agent strings from:
     * http://www.useragentstring.com/pages/useragentstring.php
     */
    browserVersion: function(userAgent, vendor, opera) {
        var browser = zr_util.referingFrom.browser(userAgent, vendor, opera);
        var versionRegexs = {
            'Internet Explorer Mobile': /rv:(\d+(\.\d+)?)/,
            'Microsoft Edge': /Edge\/(\d+(\.\d+)?)/,
            'Chrome': /Chrome\/(\d+(\.\d+)?)/,
            'Chrome iOS': /CriOS\/(\d+(\.\d+)?)/,
            'UC Browser' : /(UCBrowser|UCWEB)\/(\d+(\.\d+)?)/,
            'Safari': /Version\/(\d+(\.\d+)?)/,
            'Mobile Safari': /Version\/(\d+(\.\d+)?)/,
            'Opera': /(Opera|OPR)\/(\d+(\.\d+)?)/,
            'Firefox': /Firefox\/(\d+(\.\d+)?)/,
            'Firefox iOS': /FxiOS\/(\d+(\.\d+)?)/,
            'Konqueror': /Konqueror:(\d+(\.\d+)?)/,
            'BlackBerry': /BlackBerry (\d+(\.\d+)?)/,
            'Android Mobile': /android\s(\d+(\.\d+)?)/,
            'Internet Explorer': /(rv:|MSIE )(\d+(\.\d+)?)/,
            'Mozilla': /rv:(\d+(\.\d+)?)/
        };
        var regex = versionRegexs[browser];
        if (regex === undefined) {
            return null;
        }
        var matches = userAgent.match(regex);
        if (!matches) {
            return null;
        }
        return parseFloat(matches[matches.length - 2]);
    },

    os: function(userAgent) {
        var a = userAgent;
        if (/Windows/i.test(a)) {
            if (/Phone/.test(a) || /WPDesktop/.test(a)) {
                return 'Windows Phone';
            }
            return 'Windows';
        } else if (/(iPhone|iPad|iPod)/.test(a)) {
            return 'iOS';
        } else if (/Android/.test(a)) {
            return 'Android';
        } else if (/(BlackBerry|PlayBook|BB10)/i.test(a)) {
            return 'BlackBerry';
        } else if (/Mac/i.test(a)) {
            return 'Mac OS X';
        } else if (/Linux/.test(a)) {
            return 'Linux';
        } else {
            return null;
        }
    },

    device: function(user_agent) {
        if (/Windows Phone/i.test(user_agent) || /WPDesktop/.test(user_agent)) {
            return 'Windows Phone';
        } else if (/iPad/.test(user_agent)) {
            return 'iPad';
        } else if (/iPod/.test(user_agent)) {
            return 'iPod Touch';
        } else if (/iPhone/.test(user_agent)) {
            return 'iPhone';
        } else if (/(BlackBerry|PlayBook|BB10)/i.test(user_agent)) {
            return 'BlackBerry';
        } else if (/Android/.test(user_agent)) {
            return 'Android';
        } else {
            return null;
        }
    },
    language: function() {
        return navigator.language || navigator.userLanguage; 
    }
};

// Encoding, decoding borrwed from  https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
// Marshals a string to Uint8Array.
zr_util.encodeUTF8 = function(s) {
    var i = 0;
    var bytes = new Uint8Array(s.length * 4);
    for (var ci = 0; ci != s.length; ci++) {
        var c = s.charCodeAt(ci);
        if (c < 128) {
            bytes[i++] = c;
            continue;
        }
        if (c < 2048) {
            bytes[i++] = c >> 6 | 192;
        } else {
            if (c > 0xd7ff && c < 0xdc00) {
                if (++ci == s.length) throw 'UTF-8 encode: incomplete surrogate pair';
                var c2 = s.charCodeAt(ci);
                if (c2 < 0xdc00 || c2 > 0xdfff) throw 'UTF-8 encode: second char code 0x' + c2.toString(16) + ' at index ' + ci + ' in surrogate pair out of range';
                c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
                bytes[i++] = c >> 18 | 240;
                bytes[i++] = c>> 12 & 63 | 128;
            } else { // c <= 0xffff
                bytes[i++] = c >> 12 | 224;
            }
            bytes[i++] = c >> 6 & 63 | 128;
        }
        bytes[i++] = c & 63 | 128;
    }
    return bytes.subarray(0, i);
}

// Unmarshals an Uint8Array to string.
zr_util.decodeUTF8 = function(bytes) {
    var s = '';
    var i = 0;
    while (i < bytes.length) {
        var c = bytes[i++];
        if (c > 127) {
            if (c > 191 && c < 224) {
                if (i >= bytes.length) throw 'UTF-8 decode: incomplete 2-byte sequence';
                c = (c & 31) << 6 | bytes[i] & 63;
            } else if (c > 223 && c < 240) {
                if (i + 1 >= bytes.length) throw 'UTF-8 decode: incomplete 3-byte sequence';
                c = (c & 15) << 12 | (bytes[i] & 63) << 6 | bytes[++i] & 63;
            } else if (c > 239 && c < 248) {
                if (i+2 >= bytes.length) throw 'UTF-8 decode: incomplete 4-byte sequence';
                c = (c & 7) << 18 | (bytes[i] & 63) << 12 | (bytes[++i] & 63) << 6 | bytes[++i] & 63;
            } else throw 'UTF-8 decode: unknown multibyte start 0x' + c.toString(16) + ' at index ' + (i - 1);
            ++i;
        }

        if (c <= 0xffff) s += String.fromCharCode(c);
        else if (c <= 0x10ffff) {
            c -= 0x10000;
            s += String.fromCharCode(c >> 10 | 0xd800)
            s += String.fromCharCode(c & 0x3FF | 0xdc00)
        } else throw 'UTF-8 decode: code point 0x' + c.toString(16) + ' exceeds UTF-16 reach';
    }
    return s;
}

zr_util.JSONDecode = (function() { // https://github.com/douglascrockford/JSON-js/blob/master/json_parse.js
    var at, // The index of the current character
        ch, // The current character
        escapee = {
            '"': '"',
            '\\': '\\',
            '/': '/',
            'b': '\b',
            'f': '\f',
            'n': '\n',
            'r': '\r',
            't': '\t'
        },
        text,
        error = function(m) {
            throw {
                name: 'SyntaxError',
                message: m,
                at: at,
                text: text
            };
        },
        next = function(c) {
            // If a c parameter is provided, verify that it matches the current character.
            if (c && c !== ch) {
                error('Expected \'' + c + '\' instead of \'' + ch + '\'');
            }
            // Get the next character. When there are no more characters,
            // return the empty string.
            ch = text.charAt(at);
            at += 1;
            return ch;
        },
        number = function() {
            // Parse a number value.
            var number,
                string = '';

            if (ch === '-') {
                string = '-';
                next('-');
            }
            while (ch >= '0' && ch <= '9') {
                string += ch;
                next();
            }
            if (ch === '.') {
                string += '.';
                while (next() && ch >= '0' && ch <= '9') {
                    string += ch;
                }
            }
            if (ch === 'e' || ch === 'E') {
                string += ch;
                next();
                if (ch === '-' || ch === '+') {
                    string += ch;
                    next();
                }
                while (ch >= '0' && ch <= '9') {
                    string += ch;
                    next();
                }
            }
            number = +string;
            if (!isFinite(number)) {
                error('Bad number');
            } else {
                return number;
            }
        },

        string = function() {
            // Parse a string value.
            var hex,
                i,
                string = '',
                uffff;
            // When parsing for string values, we must look for " and \ characters.
            if (ch === '"') {
                while (next()) {
                    if (ch === '"') {
                        next();
                        return string;
                    }
                    if (ch === '\\') {
                        next();
                        if (ch === 'u') {
                            uffff = 0;
                            for (i = 0; i < 4; i += 1) {
                                hex = parseInt(next(), 16);
                                if (!isFinite(hex)) {
                                    break;
                                }
                                uffff = uffff * 16 + hex;
                            }
                            string += String.fromCharCode(uffff);
                        } else if (typeof escapee[ch] === 'string') {
                            string += escapee[ch];
                        } else {
                            break;
                        }
                    } else {
                        string += ch;
                    }
                }
            }
            error('Bad string');
        },
        white = function() {
            // Skip whitespace.
            while (ch && ch <= ' ') {
                next();
            }
        },
        word = function() {
            // true, false, or null.
            switch (ch) {
                case 't':
                    next('t');
                    next('r');
                    next('u');
                    next('e');
                    return true;
                case 'f':
                    next('f');
                    next('a');
                    next('l');
                    next('s');
                    next('e');
                    return false;
                case 'n':
                    next('n');
                    next('u');
                    next('l');
                    next('l');
                    return null;
            }
            error('Unexpected "' + ch + '"');
        },
        value, // Placeholder for the value function.
        array = function() {
            // Parse an array value.
            var array = [];

            if (ch === '[') {
                next('[');
                white();
                if (ch === ']') {
                    next(']');
                    return array; // empty array
                }
                while (ch) {
                    array.push(value());
                    white();
                    if (ch === ']') {
                        next(']');
                        return array;
                    }
                    next(',');
                    white();
                }
            }
            error('Bad array');
        },
        object = function() {
            // Parse an object value.
            var key,
                object = {};

            if (ch === '{') {
                next('{');
                white();
                if (ch === '}') {
                    next('}');
                    return object; // empty object
                }
                while (ch) {
                    key = string();
                    white();
                    next(':');
                    if (Object.hasOwnProperty.call(object, key)) {
                        error('Duplicate key "' + key + '"');
                    }
                    object[key] = value();
                    white();
                    if (ch === '}') {
                        next('}');
                        return object;
                    }
                    next(',');
                    white();
                }
            }
            error('Bad object');
        };

    value = function() {
        // Parse a JSON value. It could be an object, an array, a string,
        // a number, or a word.
        white();
        switch (ch) {
            case '{':
                return object();
            case '[':
                return array();
            case '"':
                return string();
            case '-':
                return number();
            default:
                return ch >= '0' && ch <= '9' ? number() : word();
        }
    };

    // Return the json_parse function. It will have access to all of the
    // above functions and variables.
    return function(source) {
        var result;

        text = source;
        at = 0;
        ch = ' ';
        result = value();
        white();
        if (ch) {
            error('Syntax error');
        }

        return result;
    };
})();

zr_util.JSONEncode = (function() {
    return function(mixed_val) {
        var value = mixed_val;
        var quote = function(string) {
            var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
            var meta = { // table of character substitutions
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"': '\\"',
                '\\': '\\\\'
            };

            escapable.lastIndex = 0;
            return escapable.test(string) ?
                '"' + string.replace(escapable, function(a) {
                    var c = meta[a];
                    return typeof c === 'string' ? c :
                        '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                }) + '"' :
                '"' + string + '"';
        };

        var str = function(key, holder) {
            var gap = '';
            var indent = '    ';
            var i = 0; // The loop counter.
            var k = ''; // The member key.
            var v = ''; // The member value.
            var length = 0;
            var mind = gap;
            var partial = [];
            var value = holder[key];

            // If the value has a toJSON method, call it to obtain a replacement value.
            if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
                value = value.toJSON(key);
            }

            // What happens next depends on the value's type.
            switch (typeof value) {
                case 'string':
                    return quote(value);

                case 'number':
                    // JSON numbers must be finite. Encode non-finite numbers as null.
                    return isFinite(value) ? String(value) : 'null';

                case 'boolean':
                case 'null':
                    // If the value is a boolean or null, convert it to a string. Note:
                    // typeof null does not produce 'null'. The case is included here in
                    // the remote chance that this gets fixed someday.

                    return String(value);

                case 'object':
                    // If the type is 'object', we might be dealing with an object or an array or
                    // null.
                    // Due to a specification blunder in ECMAScript, typeof null is 'object',
                    // so watch out for that case.
                    if (!value) {
                        return 'null';
                    }

                    // Make an array to hold the partial results of stringifying this object value.
                    gap += indent;
                    partial = [];

                    // Is the value an array?
                    if (toString.apply(value) === '[object Array]') {
                        // The value is an array. Stringify every element. Use null as a placeholder
                        // for non-JSON values.

                        length = value.length;
                        for (i = 0; i < length; i += 1) {
                            partial[i] = str(i, value) || 'null';
                        }

                        // Join all of the elements together, separated with commas, and wrap them in
                        // brackets.
                        v = partial.length === 0 ? '[]' :
                            gap ? '[\n' + gap +
                            partial.join(',\n' + gap) + '\n' +
                            mind + ']' :
                            '[' + partial.join(',') + ']';
                        gap = mind;
                        return v;
                    }

                    // Iterate through all of the keys in the object.
                    for (k in value) {
                        if (hasOwnProperty.call(value, k)) {
                            v = str(k, value);
                            if (v) {
                                partial.push(quote(k) + (gap ? ': ' : ':') + v);
                            }
                        }
                    }

                    // Join all of the member texts together, separated with commas,
                    // and wrap them in braces.
                    v = partial.length === 0 ? '{}' :
                        gap ? '{' + partial.join(',') + '' +
                        mind + '}' : '{' + partial.join(',') + '}';
                    gap = mind;
                    return v;
            }
        };

        // Make a fake root object containing our value under the key of ''.
        // Return the result of stringifying the value.
        return str('', {
            '': value
        });
    };
})();

//export  {zr_util}