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
      console.log(res.headers)
      t.equal(res.headers['content-length'], '51', 'correct content-length')
      const b = BufferList()
      res.pipe(b)
      res.on('end', ()=>{
        console.log(b.toString())
        t.equal(b.toString(), HASH, 'correct hash')
        server.close( ()=>t.end())
      })
    })
    BufferList().append(Buffer.from(data)).pipe(req)
  }
})

test('get blob', function(t) {
  var server = http.createServer(MultiBlobHttp(blobs, '/blobs')).listen(8000, run)

  function run() {
    const req = hyperquest({
      uri: 'http://localhost:8000/blobs/get/' + encodeURIComponent(HASH)
    })
    req.on('error', ()=>t.error(err))
    req.on('response', res => {
      console.log(res.headers)
      t.equal(res.headers['content-length'], '256', 'correct content-length')
      const b = BufferList()
      res.pipe(b)
      res.on('end', ()=>{
        console.log(b.toString('hex'))
        t.equal(b.toString('hex'), Buffer.from(data).toString('hex'), 'correct data')
        server.close( ()=>t.end())
      })
    })
  }
})
