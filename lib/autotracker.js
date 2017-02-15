'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// specifying these locally here since some websites override the global Node var
// ex: https://www.codingame.com/
var ELEMENT_NODE = 1;
var TEXT_NODE = 3;

var EventTracker = function () {
	function EventTracker(initOptions) {
		var _this = this;

		_classCallCheck(this, EventTracker);

		if (!window.addEventListener) {
			console.error('Listening events not supported');
			return; // if no browser support
		}

		var defaultOpts = {
			events: ['click'], // dblclick
			attributePrefix: 'zr-',
			trackOnlyZr: false
		};
		this.opts = defaultOpts;
		if (initOptions) {
			// if user defined options
			if (initOptions.trackOnlyZr) {
				this.opts.trackOnlyZr = initOptions.trackOnlyZr;
			}
		}

		this.handleEvents = this.handleEvents.bind(this);

		this.delegates = {};
		this.opts.events.forEach(function (event) {
			_this.delegates[event] = delegate(document, event, selector, _this.handleEvents, { composed: true, useCapture: true });
		});

		// console.log('user defined options with default ones: ', this.opts);
		// var eventList = this.opts.events;
		// for (var i=0; i<eventList.length; i++) {
		// 	var eventType = eventList[i];
		// 	this.registerEvent(eventType,document,this.clickHandler,true);
		// }
	}

	_createClass(EventTracker, [{
		key: 'getOptions',
		value: function getOptions() {
			return this.opts;
		}

		// register events to track

	}, {
		key: 'registerEvent',
		value: function registerEvent(eventType, element, handler, useCapture) {
			if (!element) {
				console.error('No valid element provided for registerEvent');
			}
			element.addEventListener(eventType, handler, useCapture);
		}

		// handler for click events (click and dblclick)

	}, {
		key: 'handleEvents',
		value: function handleEvents(e, element) {
			if (e) {

				var target = e.target;
				if (typeof e.target === 'undefined') {
					// https://developer.mozilla.org/en-US/docs/Web/API/Event/target#Compatibility_notes
					target = e.srcElement;
				} else {
					target = e.target;
				}

				if (target.nodeType === TEXT_NODE) {
					// defeat Safari bug (see: http://www.quirksmode.org/js/events_properties.html)
					target = target.parentNode;
				}
				var targetList = [target];
				var currentElement = target;
				while (currentElement.parentNode && !zr_util.isTag(currentElement, 'body')) {
					// ignore clicks on body tag directly (already included)
					targetList.push(currentElement.parentNode);
					currentElement = currentElement.parentNode;
				}

				if (zr_util.shouldTrackDOMEvent(target)) {

					console.log(getOptions());

					var listOfEvents = [];
					// link targets (extract links and buttons with zr- prefix)
					zr_util.each(targetList, function (element, index) {
						var elementProperties = zr_util.getPropertiesFromElement(element);
						console.log(this.opts.trackOnlyZr);
						if (this.opts.trackOnlyZr) {
							if (elementProperties) {
								zr_util.each(elementProperties.attributes, function (el, idx) {
									if (el.name && el.name.startsWith(elPrefix)) {
										console.log('this one is ok');
									}
								});
							}
						} else {
							listOfEvents.push(elementProperties);
						}
					});
				}
			}
		}
	}]);

	return EventTracker;
}();