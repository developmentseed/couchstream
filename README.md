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

You can also supply a filter as a plain JavaScript function. CouchStream will create a filter design document on the server and use that filter to retrieve the changes. Make sure that you don't reference any variables outside that function; they won't be available on the CouchDB server.

```javascript
new CouchStream({
    database: 'recipes',
    query: {
        since: 50,
        filter: function(doc, req) {
            return doc.type == 'recipe' &&
                   doc.ingredients.indexOf('Coconut') >= 0;
        }
    }
}).on('change', function(change) {
    console.warn(change);
});
```
