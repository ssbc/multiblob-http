var assert = require('assert')

var crypto = require('crypto')

for(var i = 0; i < 100; i++) {

  var key = crypto.randomBytes(32).toString('base64')
  var _key = encodeURIComponent(key)
  var key_ = decodeURIComponent(_key)
  var key__ = decodeURIComponent(key)

  assert.equal(key_, key__)
  assert.equal(key_, key)
  assert.equal(key_, decodeURIComponent(key__))
}






