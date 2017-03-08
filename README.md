# Zivorad Javascript

## HTML Code Snippet

```javascript
<script type="text/javascript">
var ZR_LIB_URL="//storage.googleapis.com/zivoradjscdn/zivorad.min.0.0.1.js";
(function(){var c=window.zr=window.zr||[];c.factory=function(a){return function(){var b=Array.prototype.slice.call(arguments);b.unshift(a);c.push(b);return c}};for(var b=["init","track","profile","purchase","register"],d=0;d<b.length;d++){var e=b[d];c[e]=c.factory(e)}var a=document.createElement("script");a.type="text/javascript";a.async=!0;a.src=ZR_LIB_URL;b=document.getElementsByTagName("script")[0];b.parentNode.insertBefore(a,b);var f=!1;a.onload=a.onreadystatechange=function(){f||this.readyState&&
"loaded"!==this.readyState&&"complete"!==this.readyState||(f=!0,a.onload=a.onreadystatechange=null,window.zr=_zr_init())}})();
zr.init("YOUR KEY");
</script>
```

Replace "YOUR KEY" with the key from sixthmass.com

## Javascript methods

### Basic event tracking

```javascript
zr.track('my event',{'name':'igor'});
```

Most basic and most common event tracking.
'my event' is required. Seconds parameter is custom json object.

### User Registration Tracking

```javascript
zr.register({"first_name":"Rudi", 
			 "last_name":"Popudi", 
			 "user_id":"theone", 
			 "email":"igor+test1@sixthmass.com", 
			 "business_name":"Sixthmass Inc.",
			 "birthday":"1982-05-05"},
		{'some_number':1, 'date_me':Date.now(), 'boolean_value':true, 'string_value':'StringYes', 'decimal_value':0.1});
```

Registration requires at least one of the following fields:
- first_name
- last_name
- user_id
- email
- business_name
- birthday

Each call to zr.register overwrites the previous information. 

There is no need to call profile (method bellow) after registration (it records default registration event and creates/updates users profile)

### User Profile Tracking

```javascript
zr.profile(
	{"first_name":"Igor","last_name":"Rendulic","user_id":"123456","email":"something@sixthmass.com","gender":"male","business_name":"Sixthmass company","birthday":"1979-04-13"},
	{'custom':1, 'date':Date.now(), 'use':true, 'str':'StringYes', 'decimal':0.1});
```

Updates users profile. Method overrides users profile with latest data from zr.profile. 
First parameter is JSON Object with predefined fields. Second parameter is optional and holds custom values.

### Purchase Tracking

```javascript
zr.purchase(
	[{"id":"itemId","name":"itemName","price":2134.23,"quantity":1},
			 {"id":"itemId2","name":"itemName2","price":1111.23,"quantity":2}
	]
);
```

List of items in users basket after the purchase is made.

