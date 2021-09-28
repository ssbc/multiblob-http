var test = require('tape')
var MultiBlob = require('multiblob')
var MultiBlobHttp = require('..')
var http = require('http')
var hyperquest = require('hyperquest')
var BufferList = require('bl')

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

test('get from start', function(t) {
  var server = http.createServer(MultiBlobHttp(blobs, '/blobs')).listen(8000, run)

  function run() {
    const req = hyperquest({
      uri: 'http://localhost:8000/blobs/get/' + encodeURIComponent(HASH),
      headers: {
        'range': 'bytes=0-19'
      }
    })
    req.on('error', ()=>t.error(err))
    req.on('response', res => {
      if (process.env.VERBOSE_TESTS) console.log(res.headers)
      t.equal(res.statusCode, 206,'status code')
      t.equal(res.headers['content-length'], '20', 'correct content-length')
      t.equal(res.headers['accept-ranges'], 'bytes', 'correct accept-ranges')
      t.equal(res.headers['content-range'], 'bytes 0-19/256', 'correct content-range')
      const b = BufferList()
      res.pipe(b)
      res.on('end', ()=>{
        if (process.env.VERBOSE_TESTS) console.log(b.toString('hex'))
        t.equal(b.toString('hex'), Buffer.from(data).slice(0,20).toString('hex'), 'correct data')
        server.close( ()=>t.end())
      })
    })
  }
})

test('get from middle', function(t) {
  var server = http.createServer(MultiBlobHttp(blobs, '/blobs')).listen(8000, run)

  function run() {
    const req = hyperquest({
      uri: 'http://localhost:8000/blobs/get/' + encodeURIComponent(HASH),
      headers: {
        'range': 'bytes=10-19'
      }
    })
    req.on('error', ()=>t.error(err))
    req.on('response', res => {
      if (process.env.VERBOSE_TESTS) console.log(res.headers)
      t.equal(res.statusCode, 206,'status code')
      t.equal(res.headers['content-length'], '10', 'correct content-length')
      t.equal(res.headers['accept-ranges'], 'bytes', 'correct accept-ranges')
      t.equal(res.headers['content-range'], 'bytes 10-19/256', 'correct content-range')
      const b = BufferList()
      res.pipe(b)
      res.on('end', ()=>{
        if (process.env.VERBOSE_TESTS) console.log(b.toString('hex'))
        t.equal(b.toString('hex'), Buffer.from(data).slice(10,20).toString('hex'), 'correct data')
        server.close( ()=>t.end())
      })
    })
  }
})

test('last 20 bytes', function(t) {
  var server = http.createServer(MultiBlobHttp(blobs, '/blobs')).listen(8000, run)

  function run() {
    const req = hyperquest({
      uri: 'http://localhost:8000/blobs/get/' + encodeURIComponent(HASH),
      headers: {
        'range': 'bytes=-20'
      }
    })
    req.on('error', ()=>t.error(err))
    req.on('response', res => {
      if (process.env.VERBOSE_TESTS) console.log(res.headers)
      t.equal(res.statusCode, 206,'status code')
      t.equal(res.headers['content-length'], '20', 'correct content-length')
      t.equal(res.headers['accept-ranges'], 'bytes', 'correct accept-ranges')
      t.equal(res.headers['content-range'], 'bytes 236-255/256', 'correct content-range')
      const b = BufferList()
      res.pipe(b)
      res.on('end', ()=>{
        if (process.env.VERBOSE_TESTS) console.log(b.toString('hex'))
        t.equal(b.toString('hex'), Buffer.from(data).slice(-20).toString('hex'), 'correct data')
        server.close( ()=>t.end())
      })
    })
  }
})

test('offset only', function(t) {
  var server = http.createServer(MultiBlobHttp(blobs, '/blobs')).listen(8000, run)

  function run() {
    const req = hyperquest({
      uri: 'http://localhost:8000/blobs/get/' + encodeURIComponent(HASH),
      headers: {
        'range': 'bytes=251-'
      }
    })
    req.on('error', ()=>t.error(err))
    req.on('response', res => {
      if (process.env.VERBOSE_TESTS) console.log(res.headers)
      t.equal(res.statusCode, 206,'status code')
      t.equal(res.headers['content-length'], '5', 'correct content-length')
      t.equal(res.headers['accept-ranges'], 'bytes', 'correct accept-ranges')
      t.equal(res.headers['content-range'], 'bytes 251-255/256', 'correct content-range')
      const b = BufferList()
      res.pipe(b)
      res.on('end', ()=>{
        if (process.env.VERBOSE_TESTS) console.log(b.toString('hex'))
        t.equal(b.toString('hex'), Buffer.from(data).slice(-5).toString('hex'), 'correct data')
        server.close( ()=>t.end())
      })
    })
  }
})

test('Unsatisfiable', function(t) {
  var server = http.createServer(MultiBlobHttp(blobs, '/blobs')).listen(8000, run)

  function run() {
    const req = hyperquest({
      uri: 'http://localhost:8000/blobs/get/' + encodeURIComponent(HASH),
      headers: {
        'range': 'bytes=256-'
      }
    })
    req.on('error', ()=>t.error(err))
    req.on('response', res => {
      if (process.env.VERBOSE_TESTS) console.log(res.headers)
      t.equal(res.statusCode, 416,'status code')
      t.equal(res.headers['accept-ranges'], 'bytes', 'correct accept-ranges')
      t.equal(res.headers['content-range'], 'bytes */256', 'correct content-range')
      server.close( ()=>t.end())
    })
  }
})
