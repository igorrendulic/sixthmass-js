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
/** @const */ var STORAGE_LOCAL = 'm6_local';
/** @const */ var STORAGE_COOKIES = 'm6_cookies';
/** @const */ var STORAGE_USER_PROFILE = 'm6_user_profile';
/** @const */ var STORAGE_SESSION = 'm6_session';
/** @const */ var STORAGE_QUEUE = 'm6_queue';
/** @const */ var STORAGE_QUEUE_INDEX = 'm6_queue_index';
/** @const */ var INACTIVE_SESSION_RESET = 30; // 30 minutes
/** @const */ var URL = 'http://events.sixthmass.com/v1/event';
/** @const */ var URL_PROFILE = 'http://events.sixthmass.com/v1/profile';
// /** @const */ var URL = 'http://localhost:8079/v1/event';
// /** @const */ var URL_PROFILE = 'http://localhost:8079/v1/profile';
var globalDataQueue = [];

var m6_instance;

/*
* Config
*/
var Config = {
    debug: false,
    LIB_VERSION: '0.0.2',
    events: ['click'], // dblclick
    attributePrefix: 'm6-',
    trackOnlyM6: true
};

var PostfixAction = "event";

/**
 * SixthMassLib Object
 * @constructor
 */
var SixthMassLib  = function() {};

/**
* Init of library after javascript library loaded
*/
function _m6_init() {
    var m6 = window.m6;
    if (!m6) {
        console.error('SixthMass is undefined!');
        return;
    }
    var lib = new SixthMassLib();
    lib.executeFunctions(m6,lib);
    m6_instance = lib;
    return m6_instance;
}

/** @constructor */
SixthMassLib.prototype.init = function(token) {

    this.initParams = {'token':token};
    this.Config = Config;
    if (this.initParams.trackOnlyM6 != null) {
        this.Config.trackOnlyM6 = this.initParams.trackOnlyM6;
    }

    // detect if localstorage prossible if not set cookies
    if (m6_util.islocalStorageSupported()) {
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

SixthMassLib.prototype.track = function(event, properties) {
    var e = this.createEvent(event,properties, this);
    this.httpRequest(e, this.getUrl(), 1);
}

SixthMassLib.prototype.profile = function(profile, customProperties) {
    var p = this.createProfile(profile,customProperties,this);
    this.httpRequest(p, this.getProfileUrl(), 1);
}

SixthMassLib.prototype.purchase = function(array) {
    if (!m6_util.isArray(array)) {
        console.error('Required array of purchased items.');
        return;
    }
    var e = this.createPurchase(array, this);
    this.httpRequest(e, this.getUrl(), 1);
}

SixthMassLib.prototype.register = function(profile,customProperties) {
    var e = this.createRegister(profile, customProperties, this);
    var p = this.createProfile(profile, customProperties, this);
    this.httpRequest(e, this.getUrl(), 1);
    this.httpRequest(p, this.getProfileUrl(), 1);
}

// Execute defered functions when
SixthMassLib.prototype.executeFunctions = function(m6,lib) {
    if (m6) {
        m6_util.each(m6, function(item) {
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

SixthMassLib.prototype.getUrl = function() {
    return URL;
}

SixthMassLib.prototype.getProfileUrl = function() {
    return URL_PROFILE;
}

// register events to track
SixthMassLib.prototype.registerEvent = function(eventType, element, useCapture) {
    if (!element) {
        console.error('No valid element provided for registerEvent');
    }
    var that = this;
    element.addEventListener(eventType, function(e) {
        that.handleEvents(e, that);
    }, useCapture);
}

SixthMassLib.prototype.handleEvents = function(e, m6) { // e = event,  = reference to zivorad
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
        while (currentElement.parentNode && !m6_util.isTag(currentElement,'body')) { // ignore clicks on body tag directly (already included)
            targetList.push(currentElement.parentNode);
            currentElement = currentElement.parentNode;
        }

        if (m6_util.shouldTrackDOMEvent(target)) {

            var listOfEvents = [];
            // link targets (extract links and buttons with m6- prefix)
            m6_util.each(targetList, function(element, index) {
                var elementProperties = m6_util.getPropertiesFromElement(element);

                if (m6.Config.trackOnlyM6) {
                    if (elementProperties) {
                        m6_util.each(elementProperties.attributes, function(el,idx) {
                            if (el.name && el.name.startsWith(m6.Config.attributePrefix)) {
                                listOfEvents.push(elementProperties);
                            }
                        });
                    }
                } else { // tracking all clicks on links and submit
                    if (elementProperties.tag_name === 'a') {
                        listOfEvents.push(elementProperties);
                    } else if (elementProperties.tag_name === 'input') {
                        m6_util.each(elementProperties.attributes, function(el,idx) {
                            if (el.name === 'type' && (el.value === 'submit' || el.value === 'button')) {
                                listOfEvents.push(elementProperties);
                            }
                        });
                    } else if (elementProperties.tag_name === 'button') {
                        listOfEvents.push(elementProperties);
                    }
                }
            });
            m6.decorateEvents(listOfEvents,m6);
        }
    }
}

// decorating events with timestamp, timezoneOffset, referrer, sessionId, eventName, clientId, userId, userAgent,platform, lib version, language
SixthMassLib.prototype.decorateEvents = function(events,m6) {
    if (!m6.initParams.token) {
        console.error('Missing token!');
        return;
    }
    if (events.length > 0) {
        m6_util.each(events, function(e) {
            m6_util.each(e.attributes, function(a) {
                if (a.name === (m6.Config.attributePrefix + m6.PostfixAction)) {
                    var newEvent = m6.createEvent(a.value,null,m6);
                    m6.httpRequest(newEvent, m6.getUrl(), 1);
                }
            });
        });
    }
}

SixthMassLib.prototype.createEvent = function(name, properties,m6) {
     var newEvent = {} // event object
    var userProfile = m6_util.storage.parse(STORAGE_USER_PROFILE, m6.Config.storage);
    var sessionProfile = m6_util.storage.parse(STORAGE_SESSION, m6.Config.storage);
    userProfile = this.initUser();

    newEvent.uId = userProfile.userId;
    newEvent.cId = m6.initParams.token;
    newEvent.e = name;
    newEvent.sId = sessionProfile.sId;
    newEvent.sessDuration = sessionProfile.sessDuration;
    newEvent.ts = m6_util.timestamp();
    newEvent.tzOffset = m6_util.timezone() * 60; // seconds
    newEvent.libVer = m6.Config.LIB_VERSION;
    var searchEngine = m6_util.referingFrom.searchEngine(document.referrer);
    if (searchEngine != null) {
        newEvent.refDomain = searchEngine;
        newEvent.searchQuery = m6_util.referingFrom.searchQuery(document.referrer);
    } else {
        newEvent.refDomain = m6_util.referingFrom.domain(document.referrer);
    }
    newEvent.browser = m6_util.referingFrom.browser(window.navigator.userAgent, window.navigator.vendor,window.opera);
    newEvent.browserVersion = m6_util.referingFrom.browserVersion(window.navigator.userAgent, window.navigator.vendor,window.opera);
    newEvent.os = m6_util.referingFrom.os(window.navigator.userAgent);
    newEvent.device = m6_util.referingFrom.device(window.navigator.userAgent);
    newEvent.lang = m6_util.referingFrom.language();
    newEvent.pageView = document.location.href;
    if (!m6_util.isUndefined(properties)) {
        newEvent.customValues  = properties;
    }
    // augment with campaign data
    newEvent = this.augmentEventWithCampaign(newEvent);
    return newEvent;
}

SixthMassLib.prototype.augmentEventWithCampaign = function(newEvent) {
  var campaign = m6_util.cookieStorage.get('_m6_c');
  var content = m6_util.cookieStorage.get('_m6_cn');
  var source = m6_util.cookieStorage.get('_m6_src');
  var term = m6_util.cookieStorage.get('_m6_trm');
  var medium = m6_util.cookieStorage.get('_m6_m');

  if (source !== null && !m6_util.isUndefined(source)) {
    if (source.length > 1) {
      newEvent.utmSource = source;
    }
  }
  if (campaign !== null && !m6_util.isUndefined(campaign)) {
    if (campaign.length > 1) {
      newEvent.utmCampaign = campaign;
      newEvent.campaignType = 'click'; // defined only when campaign defined
    }
  }
  if (medium !== null && !m6_util.isUndefined(medium)) {
    if (medium.length > 1) {
      newEvent.utmMedium = medium;
    }
  }
  if (content !== null && !m6_util.isUndefined(content)) {
    if (content.length > 1) {
      newEvent.utmContent = content;
    }
  }
  if (term !== null && !m6_util.isUndefined(term)) {
    if (term.length > 1) {
      newEvent.utmTerm = term;
    }
  }
  return newEvent;
}

SixthMassLib.prototype.createProfile = function(profile,customProperties,m6) {
    var p = {};
    var userProfile = m6_util.storage.parse(STORAGE_USER_PROFILE, m6.Config.storage);
    if (!userProfile) {
        userProfile = m6.initUser();
    }
    p.userId = userProfile.userId;
    p.clientId = m6.initParams.token;
    p.remoteUserId = profile.user_id;
    p.email = profile.email;
    p.firstName = profile.first_name;
    p.lastName = profile.last_name;
    p.tzOffset = m6_util.timezone() * 60;
    p.gender = profile.gender;
    p.businessName = profile.business_name;
    p.birthday = profile.birthday;
    if (!m6_util.isUndefined(customProperties)) {
        p.customValues = customProperties;
    }
    m6_util.storage.set(STORAGE_USER_PROFILE,m6_util.JSONEncode(p), m6.Config.storage); // save to local storage
    return p;
}

SixthMassLib.prototype.createRegister = function(profile, customProperties,m6) {
    // var p = m6.createProfile(profile, customProperties, this);
    var e = m6.createEvent('m6 register', null, m6);
    return e;
}

SixthMassLib.prototype.createPurchase = function(items, m6) {

    var purchaseEvent = m6.createEvent('m6 purchase', null, m6);
    purchaseEvent.pItems = [];
    m6_util.each(items, function(item) {
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
SixthMassLib.prototype.initUser = function() {
    // init with campaign parameters
    var uid = m6_util.getQueryParam(window.location.href ,'uid');

    this.storeAllCampaignCookies();

    var userProfile = m6_util.storage.get(STORAGE_USER_PROFILE, this.Config.storage);
    var isProfileUndefined = userProfile == null || m6_util.isUndefined(userProfile);
    if (!isProfileUndefined) {
      userProfile = m6_util.JSONDecode(userProfile);
      // check if userId defined
      if (m6_util.isUndefined(userProfile['userId']) || userProfile['userId'] == null || userProfile['userId'].length <= 0) {
        isProfileUndefined = true;
      }
    }
    if (isProfileUndefined) {
        userProfile = {};

        if (navigator.cookieEnabled) {
            var userId = m6_util.cookieStorage.get('m6_user_id');
            if (m6_util.isUndefined(userId) || userId == null) { // if not in cookies
              // check first if from campaign
              if (!m6_util.isUndefined(uid) && uid !== null) {
                userId = uid;
              } else {
                userId = m6_util.uuid4();
              }
              userProfile.userId = userId;
            } else {
              userProfile.userId = userId;
            }
            m6_util.cookieStorage.set('m6_user_id',userId,3650,true,false);
        } else {
          // if cookies not enabled
          if (!m6_util.isUndefined(uid) && uid !== null) {
              userProfile.userId = uid;
          } else {
            userProfile.userId = m6_util.uuid4();
          }
        }
    }

    m6_util.storage.set(STORAGE_USER_PROFILE,m6_util.JSONEncode(userProfile), this.Config.storage);
    this.touchSession(); // init session if needed
    return userProfile;
}

// refresh session time and calculate current session length in seconds
SixthMassLib.prototype.touchSession = function() {
    var campaignSessionId = m6_util.getQueryParam(window.location.href ,'s');

    var sessionJson = m6_util.storage.parse(STORAGE_SESSION, this.Config.storage);
    if (sessionJson == null) {
        sessionJson = {};
        if (!m6_util.isUndefined(campaignSessionId) && campaignSessionId !== null) {
          sessionJson['sId'] = campaignSessionId;
        } else {
          sessionJson['sId'] = m6_util.uuid4();
        }
        sessionJson['ts'] = m6_util.timestamp();
        sessionJson['lastTouch'] = m6_util.timestamp();
        m6_util.storage.set(STORAGE_SESSION,m6_util.JSONEncode(sessionJson), this.Config.storage);
    } else {
        // check how old is the session
        var sessionTs = sessionJson['ts'];
        var sessionLastTouch = sessionJson['lastTouch'];
        var now = m6_util.timestamp();

        //if campaign session the sessionId is resetted to the campaign session id
        var continueSession = true;
        if (!m6_util.isUndefined(campaignSessionId) && campaignSessionId !== null) {
          if (campaignSessionId.length > 1) {
            sessionJson['sId'] = m6_util.uuid4(); // new id and timestamp
            sessionJson['ts'] = now;
            sessionJson['lastTouch'] = now;
            m6_util.storage.remove(STORAGE_QUEUE, this.Config.storage); // remove queue from storage (fresh start)
            m6_util.storage.remove(STORAGE_QUEUE_INDEX, this.Config.storage); // remove also queue index
            m6_util.storage.set(STORAGE_SESSION,m6_util.JSONEncode(sessionJson), this.Config.storage);
            continueSession = false;
          }
        }
        if (continueSession) {

          if (now - sessionLastTouch > INACTIVE_SESSION_RESET * 60 * 1000) { // if more than 30 minutes of inactivity
            if (this.Config.debug) {
              console.log('new session defined');
            }

              m6_util.storage.remove(STORAGE_QUEUE, this.Config.storage); // remove queue from storage (fresh start)
              m6_util.storage.remove(STORAGE_QUEUE_INDEX, this.Config.storage); // remove also queue index

              sessionJson['sId'] = m6_util.uuid4(); // new id and timestamp
              sessionJson['ts'] = now;
              sessionJson['lastTouch'] = now;
              m6_util.storage.set(STORAGE_SESSION,m6_util.JSONEncode(sessionJson), this.Config.storage);
          } else {
              var duration = (now - sessionTs) / 1000; // seconds
              if (this.Config.debug) {
                console.log('new session defined');
              }
              sessionJson['sessDuration'] = duration;
              sessionJson['lastTouch'] = now;
              m6_util.storage.set(STORAGE_SESSION,m6_util.JSONEncode(sessionJson), this.Config.storage);
          }
        }
    }
    return sessionJson;
}

// stoting all campaign cookies for later event decoration and profile decoration
SixthMassLib.prototype.storeAllCampaignCookies = function() {
  var utm_campaign = m6_util.getQueryParam(window.location.href,'utm_campaign');
  var utm_content = m6_util.getQueryParam(window.location.href,'utm_content'); // button name clicked
  var utm_source = m6_util.getQueryParam(window.location.href,'utm_source');
  var utm_term = m6_util.getQueryParam(window.location.href,'utm_term');
  var utm_medium = m6_util.getQueryParam(window.location.href,'utm_medium');
  // var campaignSessionId = m6_util.getQueryParam(window.location.href ,'s');
  // var uid = m6_util.getQueryParam(window.location.href ,'uid');

  if (!m6_util.isUndefined(utm_campaign) && utm_campaign !== null) {
    m6_util.cookieStorage.set('_m6_c',utm_campaign,3650,true,false);
  }
  if (!m6_util.isUndefined(utm_content) && utm_content !== null) {
    m6_util.cookieStorage.set('_m6_cn',utm_content,3650,true,false);
  }
  if (!m6_util.isUndefined(utm_source) && utm_source !== null) {
    m6_util.cookieStorage.set('_m6_src',utm_source,3650,true,false);
  }
  if (!m6_util.isUndefined(utm_term) && utm_term !== null) {
    m6_util.cookieStorage.set('_m6_trm',utm_term,3650,true,false);
  }
  if (!m6_util.isUndefined(utm_medium) && utm_medium !== null) {
    m6_util.cookieStorage.set('_m6_m',utm_medium,3650,true,false);
  }
}

SixthMassLib.prototype.httpRequest = function(data, url, delay) {
    try {

        var http = m6_util.createXMLHTTPObject();
        http.open('POST', url, true);

        http.withCredentials = true;
        http.setRequestHeader('Content-type', 'application/json');
        var instance = this;
        http.onreadystatechange = function() {
            if(http.readyState === 4) {
                if (http.status === 200) {
                    if (instance.Config.debug) {
                      console.log('sent: ', data);
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
        http.send(JSON.stringify(data));
    } catch (ex) {
        console.error(ex);
    }
}
