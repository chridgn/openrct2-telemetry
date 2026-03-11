// OpenRCT2 Telemetry Plugin
// Polls metrics on a configurable real-time interval and POSTs a snapshot to a configured local HTTP endpoint.
//
// Configuration (set via the in-game console):
//   context.sharedStorage.set('TelemetryPlugin.endpoint', 'localhost:8080/topics/openrct2');
//   context.sharedStorage.set('TelemetryPlugin.enabled', 'false');  // disable without uninstalling
//   context.sharedStorage.set('TelemetryPlugin.debug', 'true');     // log each event to stdout
//   context.sharedStorage.set('TelemetryPlugin.pollInterval', 5000); // poll interval in milliseconds (default: 5000)
//
// The endpoint must be a localhost address. Use a local relay to forward to external services.
// The watchdog checks once per in-game day for config changes or to recover from failures.

var currentEndpoint = null;
var currentPollInterval = null;
var subscription = null;
var failed = false;

function main() {
    tryStart();

    context.subscribe('interval.day', function () {
        var enabled = context.sharedStorage.get('TelemetryPlugin.enabled');
        var endpoint = context.sharedStorage.get('TelemetryPlugin.endpoint');
        var pollInterval = context.sharedStorage.get('TelemetryPlugin.pollInterval') || 5000;
        if (enabled === 'false' || endpoint !== currentEndpoint || pollInterval !== currentPollInterval || failed) {
            tryStart();
        }
    });
}

function getAverageCash() {
    var guests = map.getAllEntities('guest');
    if (guests.length === 0) return 0;
    var total = guests.reduce(function (sum, g) { return sum + g.cash; }, 0);
    return total / guests.length;
}

function getAverageHappiness() {
    var guests = map.getAllEntities('guest');
    if (guests.length === 0) return 0;
    var total = guests.reduce(function (sum, g) { return sum + g.happiness; }, 0);
    // hook returns 0-255 value; normalizing for readability
    return (total / guests.length) / 255 * 100;
}

function getParkRating() {
    return park.rating; // 0–999, no calculation needed
}

function getAverageRideDowntime() {
    var rides = map.rides;
    if (rides.length === 0) return 0;
    var total = rides.reduce(function (sum, r) { return sum + r.downtime; }, 0);
    return total / rides.length; // 0-100 percentage; higher = less reliable
}

function getAverageRideSatisfaction() {
    var rides = map.rides.filter(function (r) { return r.status === 'open'; });
    if (rides.length === 0) return 0;
    var total = rides.reduce(function (sum, r) { return sum + r.satisfaction; }, 0);
    // satisfaction is 0-255; normalizing for readability
    return (total / rides.length) / 255 * 100;
}

function tryStart() {
    if (subscription) {
        context.clearInterval(subscription);
        subscription = null;
    }
    failed = false;

    var enabled = context.sharedStorage.get('TelemetryPlugin.enabled');
    if (enabled === 'false') {
        console.log('[Telemetry] Disabled via TelemetryPlugin.enabled.');
        return;
    }

    var endpoint = context.sharedStorage.get('TelemetryPlugin.endpoint');
    currentEndpoint = endpoint;

    if (!endpoint) {
        console.log('[Telemetry] No endpoint configured.');
        console.log('[Telemetry] Set one via: context.sharedStorage.set("TelemetryPlugin.endpoint", "localhost:8080/topics/openrct2")');
        return;
    }

    var parsed = parseEndpoint(endpoint);
    if (!parsed) {
        console.log('[Telemetry] Invalid endpoint "' + endpoint + '". Expected format: "host:port/path"');
        return;
    }

    var pollInterval = context.sharedStorage.get('TelemetryPlugin.pollInterval') || 5000;
    currentPollInterval = pollInterval;

    subscription = context.setInterval(function () {
        if (failed) return;
        var payload = {
            tick: date.ticksElapsed,
            type: 'snapshot',
            metrics: {
                averageCash: getAverageCash(),
                averageHappiness: getAverageHappiness(),
                parkRating: getParkRating(),
                averageRideDowntime: getAverageRideDowntime(),
                averageRideSatisfaction: getAverageRideSatisfaction()
            }
        };
        if (context.sharedStorage.get('TelemetryPlugin.debug') === 'true') {
            console.log('[Telemetry] ' + JSON.stringify(payload));
        }
        postEvent(parsed, payload, function (reason) {
            if (failed) return;
            failed = true;
            console.log('[Telemetry] Stopped: ' + reason);
            context.clearInterval(subscription);
        });
    }, pollInterval);

    console.log('[Telemetry] Started. Posting snapshots every ' + pollInterval + 'ms to ' + endpoint);
}

function parseEndpoint(endpoint) {
    // Expected format: "host:port/path" e.g. "localhost:8080/topics/openrct2"
    var match = endpoint.match(/^([^:/]+):(\d+)(\/.*)?$/);
    if (!match) return null;
    return {
        host: match[1],
        port: parseInt(match[2], 10),
        path: match[3] || '/'
    };
}

function postEvent(endpoint, payload, onFailure) {
    var body = JSON.stringify(payload);
    var request = [
        'POST ' + endpoint.path + ' HTTP/1.1',
        'Host: ' + endpoint.host + ':' + endpoint.port,
        'Content-Type: application/json',
        'Content-Length: ' + body.length,
        'Connection: close',
        '',
        body
    ].join('\r\n');

    var socket = network.createSocket();

    socket.on('error', function (err) {
        onFailure('socket error: ' + err);
    });

    socket.connect(endpoint.port, endpoint.host, function () {
        socket.write(request);
    });
}

registerPlugin({
    name: 'Telemetry',
    version: '1.0',
    authors: ['chridgn'],
    type: 'local',
    licence: 'MIT',
    targetApiVersion: 77,
    main: main
});
