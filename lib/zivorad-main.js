/*
 * Copyright 2017, Igor Rendulic. All Rights Reserved
 *
 * Includes portions of Underscore.js
 * http://documentcloud.github.com/underscore/
 * (c) 2011 Jeremy Ashkenas, DocumentCloud Inc.
 * Released under the MIT License.
 */

// ==ClosureCompiler==
// ==/ClosureCompiler==

/*
SIMPLE STYLE GUIDE:
this.x === public function
this._x === internal - only use within this file
this.__x === private - only use within the class
Globals should be all caps
*/

//import { _ } from './utils';
//import { _ } from './autotracker';
'use strict';

var _util = require('./util');

var _util2 = _interopRequireDefault(_util);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
* Config
*/
var Config = {
	DEBUG: true,
	LIB_VERSION: '0.0.1'
};

var zivorad = function zivorad(initParams) {
	this.zivorad = new Zivorad(initParams);
	return zivorad;
};

var Zivorad = function Zivorad(initParams) {
	this.initParams = initParams;
	this.Config = Config;
	var autotracker = new EventTracker(initParams);
	this.autotracker = autotracker;
};

Zivorad.prototype.debug = function () {
	if (this.Config.DEBUG) {
		if (arguments) {
			for (var i = 0; i < arguments.length; i++) {
				console.log('--- zivorad debug ---->', arguments[i]);
			}
		}
	}
};

Zivorad.prototype.test = function (testParams) {
	var test = zr_util.isBlockedUA('baiduspider');
	this.debug(this.autotracker.getOptions());
};