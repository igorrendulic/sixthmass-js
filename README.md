# SixthMass Javascript SDK

## HTML Code Snippet

```javascript
<script type="text/javascript">
var M6_LIB_URL="sixthmass.min.0.0.3.js";
(function(){var c=window.m6=window.m6||[];c.factory=function(a){return function(){var b=Array.prototype.slice.call(arguments);b.unshift(a);c.push(b);return c}};for(var b=["init","track","profile","purchase","register"],d=0;d<b.length;d++){var e=b[d];c[e]=c.factory(e)}var a=document.createElement("script");a.type="text/javascript";a.async=!0;a.src="//storage.googleapis.com/zivoradjscdn/"+M6_LIB_URL;b=document.getElementsByTagName("script")[0];b.parentNode.insertBefore(a,b);var f=!1;a.onload=a.onreadystatechange=
function(){f||this.readyState&&"loaded"!==this.readyState&&"complete"!==this.readyState||(f=!0,a.onload=a.onreadystatechange=null,window.m6=_m6_init())}})();

m6.init("YOUR KEY HERE");
</script>
```

Replace `YOUR KEY HERE` with the key from [sixthmass.com](http://www.sixthmass.com)

## Javascript methods

### Basic event tracking

```javascript
m6.track('event name',{'name':'igor'});
```

Most basic and most common event tracking.
`event name` is required. Seconds parameter is `custom json` object.

### Optional Event Tracking
If you don't like to include your own javascript functions just for handling SixthMass events you can decorate links, buttons or any element in your web page.

```
<a href="mylink.html" m6-event="event name">This is link to somewhere</a>
```

### User Registration Tracking

```javascript
m6.register({"first_name":"Rudi",
			 "last_name":"Popudi",
			 "user_id":"theone",
			 "email":"igor+test1@demo.com",
			 "business_name":"Acme Inc.",
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

Each call to m6.register doesn't overwrite previous user properties but merges them with new values. New values take precedence over old values if both properties exist.

There is no need to call profile (method bellow) after registration (it records default registration event and creates/updates user profile)

### User Profile Tracking

Every time user profile is updated SixthMass accomuluates the properties. Newer properties take precedence over existing user profile properties.
First parameter is JSON Object with predefined fields. Second parameter is optional and holds custom values.

```javascript
m6.profile(
	{"first_name":"Igor",
	"last_name":"Rendulic",
	"user_id":"123456",
	"email":"something@demo.com",
	"gender":"male",
	"business_name":"Acme company",
	"birthday":"1979-04-13"});
```

Update user profile with custom propertiy values

```javascript
m6.profile(
	{"first_name":"Igor",
	"last_name":"Rendulic",
	"user_id":"123456",
	"email":"something@demo.com",
	"gender":"male",
	"business_name":"Acme company",
	"birthday":"1979-04-13"},
	{'custom':1, 'date':Date.now(), 'use':true, 'str':'StringYes', 'decimal':0.1});
```

#### User profile tagging

User tagging is very powerful feature for marketing or any other means where you want to specifically target a group of users.

By default SixthMass created tags for all users:
- Language (e.g. `en-US`)
- Country from which request originated as an [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) standard (e.g. `US`)
- City from which request originated (e.g. `San Francisco`)
- Operating System (e.g. `Mac OS X`)
- Browser (e.g. `Chrome`)
- Device (e.g. `iPhone`)
- Gender (e.g. `male`)
- Reference Domain, first domain person was referenced from (e.g. `google`)

> Why is tagging useful?
> Tagging is useful when filtering users. Imaging you want to sent an email only to users with iPhone devices, or Android devices. In some cases it might be useful to filter users based on multiple tags, for instance all iPhone users from San Francisco. 

Additional to default tags you can add your own tags. In case you know you'd like to contact only users who purchased something through your product you could add a custom tag: `purchased`. 

### Purchase Tracking

```javascript
m6.purchase(
	[{"id":"itemId","name":"itemName","price":2134.23,"quantity":1},
			 {"id":"itemId2","name":"itemName2","price":1111.23,"quantity":2}
	]
);
```

List of items in users basket after the purchase is made.

<a name="want-to-contribute"></a>
# Want to Contribute?

The SixthMass javascript library is an open source project. You're welcome to contribute!

Steps to contribute:
1. Fork this repository
2. Create local clone of your fork
3. Configure Git to sync your for with original SixthMass repository

These steps are described in detail [Here](https://help.github.com/articles/fork-a-repo/)

When you're done you can open a [pull request](https://help.github.com/articles/about-pull-requests/)


<a name="changelog"></a>
# Change Log
- 2017/07/06 Renamed variable names and removed unnecessary code complications

<a name="License"></a>
# License

```
See LICENSE file for details.
```
