var pull   = require('pull-stream')
var toPull = require('stream-to-pull-stream')

var qs = require('querystring')
var URL = require('url')

var YEAR = 60*60*24*365

function headers(res, hash) {
  //don't set cache control because (i think) that tells
  //the browser to not keep the cache
  res.setHeader('cache-control', 'maxage='+YEAR)
  //expires makes the brower not even revalidate.
  res.setHeader('expires', new Date(Date.now()+YEAR*1000).toISOString())
  res.setHeader('expiry', new Date(Date.now()+YEAR*1000).toISOString())
  res.setHeader('etag', hash)
}

//host blobs
module.exports = function (blobs, url, opts) {
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

      blobs.size(hash, function (err, size) {
        if(err) return next(err)
        if(!size) return next(new Error('no blob:'+hash))

        headers(res, hash)
        res.setHeader('content-length', size)

        if(q.filename)
          res.setHeader('Content-Discosition', 'inline; filename='+q.filename)

        if(q.gzip)
          res.setHeader('Content-Encoding', 'gzip')

        if(q.contentType)
          res.setHeader('Content-Type', q.contentType)

        //writing the status code now.
        res.writeHead(200)
        if(req.method === 'HEAD') return res.end()

        pull(
          blobs.get(hash),
          //since this is an http stream, handle error the http way.
          //there is nothing we can do about an error now, since
          //we already wrote the headers. but since we included content-length
          //the client will know it went wrong.
//          pull.through(null, function (err) {
//            if(err) throw err //DEBUG
//            if(err) next(err)
//          }),
          toPull(res)
        )
      })
    }
    else next()
  }
}

























