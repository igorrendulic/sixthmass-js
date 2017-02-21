
// ==ClosureCompiler==
// @compilation_level SIMPLE_OPTIMIZATIONS
// @output_file_name zivorad-snippet.0.0.1.min.js
// ==/ClosureCompiler==

/** @define {string} */
var ZR_LIB_URL = 'dist/zivorad.min.0.0.1.js';

(function(){
	var zr = window.zr = window.zr || [];

	// method stub factory (makeing it possible to call functions before the lib is loaded - defered method calls)
	zr.factory = function(method){
      return function(){
        var args = Array.prototype.slice.call(arguments);
        args.unshift(method);
        zr.push(args);
        return zr;
      };
    };

    // exposed javascript methods
    var methods = ['init','track','profile'];
    for (var i=0; i<methods.length; i++) {
    	var method = methods[i];
    	zr[method] = zr.factory(method);
    }

    // loading javascript
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.async = true;
	script.src = ZR_LIB_URL;

	// Insert our script next to the first script element.
	var first = document.getElementsByTagName('script')[0];
	first.parentNode.insertBefore(script, first);


	var loaded = false;
	// // setup an onload handler to initialize the plugin once the runtime
	// // resources are downloaded
	script.onload = script.onreadystatechange = function() {
		if (!loaded && (!this.readyState || this.readyState === 'loaded' || this.readyState === 'complete')) {
			loaded = true;
			script.onload = script.onreadystatechange = null;
			_zr_init(zr);
		}
	};
})();

zr.init('YOUR TOKEN HERE');