var test = require('tape')
var MultiBlob = require('multiblob')
var MultiBlobHttp = require('..')
var http = require('http')
var hyperquest = require('hyperquest')
var BufferList = require('bl')
var fs = require('fs')

var dir = __dirname + '/tmp'
var blobs = MultiBlob({
  dir,
  alg: 'sha256'
})

const data = Array(256).fill(0)
for(let i=0; i<data.length; ++i) data[i] = i
const HASH = 'QK/y6dLYki5Hr9RkjmlnSXFYeF+9Hahw5xECZr+USIA=.sha256'

test('upload test date', function(t) {
  var server = http.createServer(MultiBlobHttp(blobs, '/blobs')).listen(8000, run)

  function run() {
    const req = hyperquest({
      method: 'post',
      uri: 'http://localhost:8000/blobs/add'
    })
    req.on('error', ()=>t.error(err))
    req.on('response', res => {
      if (process.env.VERBOSE_TESTS) console.log(res.headers)
      t.equal(res.headers['content-length'], '51', 'correct content-length')
      const b = BufferList()
      res.pipe(b)
      res.on('end', ()=>{
        if (process.env.VERBOSE_TESTS) console.log(b.toString())
        t.equal(b.toString(), HASH, 'correct hash')
        server.close( ()=>t.end())
      })
    })
    BufferList().append(Buffer.from(data)).pipe(req)
  }
})

test('get multiple ranges', function(t) {
  var server = http.createServer(MultiBlobHttp(blobs, '/blobs')).listen(8000, run)

  function run() {
    const req = hyperquest({
      uri: 'http://localhost:8000/blobs/get/' + encodeURIComponent(HASH) + '?contentType=' + encodeURIComponent('text/plain'),
      headers: {
        'range': 'bytes=65-65,66-66,67-67'
      }
    })
    req.on('error', ()=>t.error(err))
    req.on('response', res => {
      if (process.env.VERBOSE_TESTS) console.log(res.headers)
      t.equal(res.statusCode, 206,'status code')
      t.equal(res.headers['accept-ranges'], 'bytes', 'correct accept-ranges')
      t.equal(res.headers['content-range'], undefined, 'no content-range')
      t.equal(res.headers['content-type'], 'multipart/byteranges; boundary='+HASH.slice(0,20), 'content-type')
      const b = BufferList()
      res.pipe(b)
      res.on('end', ()=>{
        if (process.env.VERBOSE_TESTS) console.log(b.toString())
        t.equal(b.length, Number(res.headers['content-length']), 'correct content-length')
        t.equal(b.toString(), fs.readFileSync(__dirname + '/fixture', 'utf8'), 'correct body')
        server.close( ()=>t.end())
      })
    })
  }
})

