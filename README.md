# multiblob-http

serve content-addressed blobs over http.
see use with [multiblob](https://github.com/ssbc/multiblob)

# example

``` js
var MultiBlob = require('multiblob')
var MultiBlobHttp = require('multiblob-http')
var http = require('http')

var dir = where_files_go //set this.

var blobs = MultiBlob(dir)

http.createServer(MultiBlobHttp(blobs, '/blobs')).listen(8000)
```
this will return an http handler (compatible with express middleware)
that will handle requests
 * `GET /blobs/get/{id}`
 * `POST /blobs/add` (which will respond with the hash)

you can also set a different prefix, but I use `/blobs`

## http api

### GET /get/{id}

retrive blob with hash {id}

### POST /add

posts to add do not require to have a hash, but will respond with the hash.
(TODO: take a POST to /add/{id} and error if received content did not have that hash)

## caching && headers

`multiblobs-http` provides the correct headers to make serving content-addressed
files as efficient as possible.

First the the `etag` header is set to the hash and the expires header is set to a year in the future.
Ideally, the browser shouldn't request this resource again for a whole year.
Probably it might revalidate it when someone uses `ctrl-R` to reload the page.
When it does, it will request with `if-none-modified` set to the hash.
Since content-addressed files are _never_ modified, the server immediately responds
with 304 (not modified)

the `content-length` header is always used unless "opts.size=false".
This way, if a connection fails somehow,
or there is an error later, the browser should detect it.

Of course, it would be way better if browsers just understood content-hashes.
But, we have to play the hand we where delt, and
`multiblob-http` makes the most of the broken web we live in.


## License

MIT



