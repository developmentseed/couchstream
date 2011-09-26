var url = require('url');
var request = require('request');
var crypto = require('crypto');

require('util').inherits(CouchStream, require('events').EventEmitter);
module.exports = CouchStream;
function CouchStream(uri) {
    if (typeof uri !== 'object') throw new Error('First argument must be an options hash');
    if (!uri.database) throw new Error('Missing database parameter');

    // Set defaults for the Couch URI.
    if (!uri.protocol) uri.protocol = 'http:';
    if (!uri.hostname) uri.hostname = 'localhost';
    if (!uri.port) uri.port = 5984;
    if (!uri.pathname) uri.pathname = '/' + uri.database + '/_changes';
    if (!uri.query) uri.query = {};
    if (!uri.query.feed) uri.query.feed = 'continuous';
    if (!uri.query.heartbeat) uri.query.heartbeat = 30000;
    this.uri = uri;

    this.connect = this.connect.bind(this);

    var stream = this;
    if (typeof uri.query.filter === 'function') {
        uri.query.filter = this.createFilter(uri.query.filter, function(err) {
            if (err) return stream.emit('error', err);
            stream.connect();
        });
    } else {
        this.connect();
    }
}

CouchStream.prototype.write = function(buffer) {
    var chunks = (this._chunk + buffer.toString('utf8')).split('\n');
    this._chunk = chunks.pop();
    for (var i = 0; i < chunks.length; i++) {
        if (!chunks[i]) continue;

        var data = null;
        try {
            data = JSON.parse(chunks[i]);
        } catch (err) {
            this.emit('error', err);
        }
        // Don't emit in the try/catch to avoid catching errors from emit.
        if (data) {
            this.seq = data.seq;
            this.emit('change', data);
        }
    }
};

CouchStream.prototype.connect = function() {
    var stream = this;
    this._chunk = '';
    if (typeof this.seq !== 'undefined') {
        this.uri.query.since = this.seq;
    }

    this._request = request.get(url.format(this.uri));
    this._request.on('error', function(err) {
        if (err.code == 'ECONNREFUSED') {
            console.log('WARNING: Could not connect to CouchDB. Retrying in 30s.');
            setTimeout(stream.connect, 30000);
        } else {
            stream.emit('error', err);
        }
    });
    this._request.pipe(this);
};

CouchStream.prototype.end = function() {
    var stream = this;
    console.warn('WARNING: Lost connection to CouchDB. Retrying in 5.');
    setTimeout(stream.connect, 5000);
};

// Emulate the buffer interface so that we can pipe into a CouchStream.
CouchStream.prototype.writable = true;


// Create filter functions
CouchStream.prototype.createFilter = function(filter, callback) {
    var filter = filter.toString();
    var name = crypto.createHash('md5').update(filter).digest('hex');
    var tries = 0;
    var uri = Object.create(this.uri);
    uri.pathname = '/' + uri.database + '/_design/couchstream';
    uri = url.format(uri);
    retrieve();

    function retrieve() {
        if (++tries > 10) return callback(new Error('Gave up retrieving filter'));
        request.get(uri, function(err, res, body) {
            if (err) setTimeout(retrieve, 1000);
            else if (res.statusCode == 404) create({});
            else create(JSON.parse(body));
        })
    }

    function create(doc) {
        if (++tries > 10) return callback(new Error('Gave up creating filter'));
        if (!doc.filters) doc.filters = {};
        if (doc.filters[name]) return callback(null);
        doc.filters[name] = filter;

        request.put({ uri: uri, body: JSON.stringify(doc) }, function(err, res, body) {
            if (err) setTimeout(create, 1000);
            else if (res.statusCode < 300) callback(null);
            else retrieve();
        });
    }

    return 'couchstream/' + name;
};
