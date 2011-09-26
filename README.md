Subscribes to CouchDB's change feed and emits the JSON objects.

## Usage

```javascript
new CouchStream({
    database: 'recipes',
    query: {
        since: 50,
        heartbeat: 10000,
        filter: 'app/blueberries',
        vegetarian: true
    }
}).on('change', function(change) {
    console.warn(change);
});
```

All parameters except for `database` are optional. All unrecognized query parameters are passed along so that CouchDB filter functions can use them.
