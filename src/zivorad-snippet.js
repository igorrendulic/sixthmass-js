var M6_LIB_URL = '//storage.googleapis.com/zivoradjscdn/zivorad.min.0.0.1.js';

(function(){
	var m6 = window.m6 = window.m6 || [];

	// method stub factory (makeing it possible to call functions before the lib is loaded - defered method calls)
	m6.factory = function(method){
      return function(){
        var args = Array.prototype.slice.call(arguments);
        args.unshift(method);
        m6.push(args);
        return m6;
      };
    };

    // exposed javascript methods
    var methods = ['init','track','profile','purchase', 'register'];
    for (var i=0; i<methods.length; i++) {
    	var method = methods[i];
    	m6[method] = m6.factory(method);
    }

    // loading javascript
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.async = true;
	script.src = M6_LIB_URL;

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
			window.m6 = _m6_init();
		}
	};
})();
