// OpenRCT2 Telemetry Plugin
// Hooks into action.execute and POSTs each event to a configured local HTTP endpoint.
//
// Configuration (set via the in-game console):
//   context.sharedStorage.set('TelemetryPlugin.endpoint', 'localhost:8080/topics/openrct2');
//   context.sharedStorage.set('TelemetryPlugin.enabled', 'false');  // disable without uninstalling
//   context.sharedStorage.set('TelemetryPlugin.debug', 'true');    // log each event to stdout
//
// The endpoint must be a localhost address. Use a local relay to forward to external services.
// The watchdog checks once per in-game day for config changes or to recover from failures.

var currentEndpoint = null;
var subscription = null;
var failed = false;

function main() {
    tryStart();

    context.subscribe('interval.day', function () {
        var enabled = context.sharedStorage.get('TelemetryPlugin.enabled');
        var endpoint = context.sharedStorage.get('TelemetryPlugin.endpoint');
        if (enabled === 'false' || endpoint !== currentEndpoint || failed) {
            tryStart();
        }
    });
}

function tryStart() {
    if (subscription) {
        subscription.dispose();
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

    subscription = context.subscribe('action.execute', function (e) {
        if (failed) return;
        var payload = {
            tick: date.ticksElapsed,
            action: e.action,
            player: e.player,
            type: e.type,
            isClientOnly: e.isClientOnly,
            args: e.args,
            result: e.result
        };
        if (context.sharedStorage.get('TelemetryPlugin.debug') === 'true') {
            console.log('[Telemetry] ' + JSON.stringify(payload));
        }
        postEvent(parsed, payload, function (reason) {
            if (failed) return;
            failed = true;
            console.log('[Telemetry] Stopped: ' + reason);
            subscription.dispose();
        });
    });

    console.log('[Telemetry] Started. Posting action events to ' + endpoint);
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
    var response = '';

    socket.on('data', function (data) {
        response += data;
    });

    socket.on('close', function (hadError) {
        if (hadError) return; // error event already fired
        var match = response.match(/^HTTP\/\d+\.\d+\s+(\d+)/);
        var status = match ? parseInt(match[1], 10) : 0;
        if (status < 200 || status > 299) {
            onFailure('endpoint returned HTTP ' + (status || 'unknown'));
        }
    });

    socket.on('error', function (err) {
        onFailure('socket error: ' + err);
    });

    socket.connect(endpoint.port, endpoint.host, function () {
        socket.write(request);
        socket.end();
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
