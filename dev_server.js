var zr_util = require('./src/util.js')
var zivorad = require('./src/zivorad-main.js')
var express = require('express')

var app = express()
app.use('/static', express.static(__dirname + '/'))

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})