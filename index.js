var pull   = require('pull-stream')
var toPull = require('stream-to-pull-stream')
var many = require('pull-many')

var qs = require('querystring')
var URL = require('url')
var parseRange = require('range-parser')

var YEAR = 60*60*24*365

function headers(res, hash) {
  //don't set cache control because (i think) that tells
  //the browser to not keep the cache
  res.setHeader('cache-control', 'maxage='+YEAR)
  //expires makes the brower not even revalidate.
  res.setHeader('expires', new Date(Date.now()+YEAR*1000).toISOString())
  res.setHeader('expiry', new Date(Date.now()+YEAR*1000).toISOString())
  res.setHeader('etag', hash)
  // support range requests
  res.setHeader('accept-ranges', 'bytes')
}

//host blobs
module.exports = function (blobs, url, opts) {
  if (!blobs) { 
    throw new Error("multiblob-http failed to load because `blobs` is null. Did you load the ssb-blobs plugin?");
  }

  opts = opts || {}
  return function (req, res, next) {

    next = next || function (err) {
      res.writeHead(404, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({error: true, status: 404}))
    }

    if(req.method === 'POST' && req.url === url+'/add' && opts.readonly !== true)
      pull(
        toPull(req),
        blobs.add(function (err, hash) {
          res.end(hash)
        })
      )
    else if(req.url.indexOf(url+'/get/') == 0) {
      if(!(req.method === "GET" || req.method == 'HEAD')) return next()

      var u = URL.parse('http://makeurlparseright.com'+req.url)
      var hash = decodeURIComponent(u.pathname.substring((url+'/get/').length))
      var q = qs.parse(u.query)


      //if a browser revalidates, just tell them it hasn't changed, the hash has not changed.
      if(req.headers['if-none-match'] === hash) {
        headers(res, hash)
        return res.writeHead(304), res.end()
      }

      //enable cors by default
      if(opts.cors !== false) {
        res.setHeader('Access-Control-Allow-Origin', '*')
      }

      // prevent timeout while waiting for blob
      res.setTimeout(0)

      blobs.size(hash, function (err, size) {
        if(err) return next(err)
        if(!size) return next(new Error('no blob:'+hash))

        headers(res, hash)

        var boundary
        var ranges = req.headers.range && parseRange(size, req.headers.range)
        if (ranges == -2) {
          // bad request
          return res.writeHead(400), res.end()
        } else if (ranges == -1) {
          // Unsadisfiable range
          res.setHeader('content-range', 'bytes */' + size)
          return res.writeHead(416), res.end()
        }
        if (!ranges || !ranges.length) ranges = null

        if (ranges) {
          if (ranges.length>1) {
            boundary = hash.slice(0, 20)
          } else {
            //request for single range
            res.setHeader(
              'content-range', 
              ranges.type + ' ' + ranges[0].start + '-' + ranges[0].end + '/' + size
            )
            res.setHeader('content-length', ranges[0].end - ranges[0].start + 1)
          }
        } else if(opts.size !== false || q.size) {
          res.setHeader('content-length', size)
        }

        if(q.filename)
          res.setHeader('Content-Disposition', 'inline; filename='+q.filename)

        if(q.gzip)
          res.setHeader('Content-Encoding', 'gzip')

        if (!ranges || ranges.length < 2) {
          if(q.contentType) {
            res.setHeader('Content-Type', q.contentType)
          }
        } else {
          res.setHeader('Content-Type', 'multipart/byteranges; boundary=' + boundary)
        }

        if(req.method === 'HEAD') {
          res.writeHead(200)
          return res.end()
        }

        if (!ranges) {
          res.writeHead(200)
          pull(
            blobs.get(hash),
            //since this is an http stream, handle error the http way.
            //there is nothing we can do about an error now, since
            //we already wrote the headers. but since we included content-length
            //the client will know it went wrong.
            opts.transform ? opts.transform (q) : pull.through(),
            toPull(res)
          )
        } else if (ranges.length == 1) {
          res.writeHead(206)
          pull(
            blobs.getSlice({hash, start: ranges[0].start, end: ranges[0].end + 1}),
            opts.transform ? opts.transform (q) : pull.through(),
            toPull(res)
          )
        } else {
          var multipart_headers = ranges.map(function(range, i) {
            return (i ? '\r\n' : '') + '--' + boundary + '\r\n' +
                   (q.contentType ? 'Content-Type: ' + q.contentType + '\r\n' : '') +
                   'Content-Range: ' +
                      ranges.type + ' ' + range.start + '-' + range.end + '/' + size + '\r\n' +
                    '\r\n'
          })
          multipart_headers.push(
            '\r\n--' + boundary + '--'
          )
          let contentLength = ranges.reduce( (a, r)=> a + r.end - r.start + 1, 0)
          contentLength += multipart_headers.reduce( (a, h) => a + h.length, 0)
          res.setHeader('Content-Length', contentLength)
          res.writeHead(206)
          pull(
            many([
              pull.values(multipart_headers.map(s => pull.once(s))),
              pull.values(ranges.map(range => pull( 
                blobs.getSlice({hash, start: range.start, end: range.end + 1}),
                opts.transform ? opts.transform (q) : pull.through()
              )))
            ]),
            pull.flatten(),
            toPull(res)
          )
        }
      })
    }
    else next()
  }
}
