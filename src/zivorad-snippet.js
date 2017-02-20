(function(){
	var zivorad = window.zivorad = window.zivorad || [];

	// method stub factory (makeing it possible to call functions before the lib is loaded - defered method calls)
	zivorad.factory = function(method){
      return function(){
        var args = Array.prototype.slice.call(arguments);
        args.unshift(method);
        zivorad.push(args);
        return zivorad;
      };
    };

    // exposed javascript methods
    var methods = ['init','getUrl','track'];
    for (var i=0; i<methods.length; i++) {
    	var method = methods[i];
    	zivorad[method] = zivorad.factory(method);
    }

    // loading javascript
	var script = document.createElement('script');
	script.type = 'text/javascript';
	script.async = true;
	script.src = 'dist/zivorad.min.0.0.1.js';

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

			_zr_init(zivorad);
		}
	};
})();

zivorad.init('YOUR TOKEN HERE');