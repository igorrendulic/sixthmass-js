(function(){var c=window.zivorad=window.zivorad||[];c.factory=function(a){return function(){var b=Array.prototype.slice.call(arguments);b.unshift(a);c.push(b);return c}};for(var b=["init","getUrl","track"],d=0;d<b.length;d++){var e=b[d];c[e]=c.factory(e)}var a=document.createElement("script");a.type="text/javascript";a.async=!0;a.src="dist/zivorad.min.0.0.1.js";b=document.getElementsByTagName("script")[0];b.parentNode.insertBefore(a,b);var f=!1;a.onload=a.onreadystatechange=function(){f||this.readyState&&
"loaded"!==this.readyState&&"complete"!==this.readyState||(f=!0,a.onload=a.onreadystatechange=null,_zr_init(c))}})();zivorad.init("YOUR TOKEN HERE");
