var M6_LIB_URL="sixthmass.min.0.0.2.js";
(function(){var c=window.m6=window.m6||[];c.factory=function(a){return function(){var b=Array.prototype.slice.call(arguments);b.unshift(a);c.push(b);return c}};for(var b=["init","track","profile","purchase","register"],d=0;d<b.length;d++){var e=b[d];c[e]=c.factory(e)}var a=document.createElement("script");a.type="text/javascript";a.async=!0;a.src="//storage.googleapis.com/zivoradjscdn/"+M6_LIB_URL;b=document.getElementsByTagName("script")[0];b.parentNode.insertBefore(a,b);var f=!1;a.onload=a.onreadystatechange=
function(){f||this.readyState&&"loaded"!==this.readyState&&"complete"!==this.readyState||(f=!0,a.onload=a.onreadystatechange=null,window.m6=_m6_init())}})();
