// OpenRCT2 Telemetry Plugin
// Polls metrics on a configurable real-time interval and POSTs a snapshot to a configured local HTTP endpoint.
//
// Configuration (set via the in-game console using the eval prefix):
//   eval context.sharedStorage.set('TelemetryPlugin.endpoint', 'localhost:8080/topics/openrct2');
//   eval context.sharedStorage.set('TelemetryPlugin.enabled', 'false');  // disable without uninstalling
//   eval context.sharedStorage.set('TelemetryPlugin.debug', 'true');     // log each payload to stdout
//   eval context.sharedStorage.set('TelemetryPlugin.pollInterval', 5000); // poll interval in ms (default: 5000)
//
// The endpoint must be a localhost address. Use a local relay to forward to external services.
// The watchdog checks once per in-game day for config changes or to recover from failures.

var currentEndpoint = null;
var currentPollInterval = null;
var subscription = null;
var failed = false;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Metric helpers
// ---------------------------------------------------------------------------

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
    return (total / guests.length) / 255 * 100; // normalised 0-100
}

function getParkRating() {
    return park.rating; // 0-999
}

function getAverageRideDowntime() {
    var rides = map.rides;
    if (rides.length === 0) return 0;
    var total = rides.reduce(function (sum, r) { return sum + r.downtime; }, 0);
    return total / rides.length; // 0-100; higher = less reliable
}

function getAverageRideSatisfaction() {
    var rides = map.rides.filter(function (r) { return r.status === 'open'; });
    if (rides.length === 0) return 0;
    var total = rides.reduce(function (sum, r) { return sum + r.satisfaction; }, 0);
    return (total / rides.length) / 255 * 100; // normalised 0-100
}

function getRideReliability() {
    var rides = map.rides;
    if (rides.length === 0) return 0;
    var open = rides.filter(function (r) { return r.status === 'open'; });
    return (open.length / rides.length) * 100; // % of rides currently open
}

function getAverageQueueTime() {
    var rides = map.rides.filter(function (r) { return r.status === 'open'; });
    if (rides.length === 0) return 0;
    var total = 0;
    var count = 0;
    rides.forEach(function (ride) {
        ride.stations.forEach(function (station) {
            total += station.queueTime;
            count++;
        });
    });
    return count === 0 ? 0 : (total / count) / 40; // converted to seconds
}

function getGuestSegmentation() {
    var guests = map.getAllEntities('guest');
    var happy    = guests.filter(function (g) { return g.happiness > 170; }).length;
    var neutral  = guests.filter(function (g) { return g.happiness >= 85 && g.happiness <= 170; }).length;
    var unhappy  = guests.filter(function (g) { return g.happiness < 85; }).length;
    var nauseated = guests.filter(function (g) { return g.nausea > 128; }).length;
    var hungry   = guests.filter(function (g) { return g.hunger < 85; }).length;
    var thirsty  = guests.filter(function (g) { return g.thirst < 85; }).length;
    var lost     = guests.filter(function (g) { return g.isLost; }).length;
    var broke    = guests.filter(function (g) { return g.cash < 100; }).length;
    var totalCash = guests.reduce(function (sum, g) { return sum + g.cash; }, 0);
    return {
        total: guests.length,
        happy: happy,
        neutral: neutral,
        unhappy: unhappy,
        nauseated: nauseated,
        hungry: hungry,
        thirsty: thirsty,
        lost: lost,
        broke: broke,
        totalSpendingPower: totalCash
    };
}

function getRevenueMetrics() {
    return {
        totalIncomeFromAdmissions: park.totalIncomeFromAdmissions,
        entranceFee: park.entranceFee,
        totalAdmissions: park.totalAdmissions,
        cash: park.cash,
        bankLoan: park.bankLoan,
        companyValue: park.companyValue,
        parkValue: park.value
    };
}

function getPerRideMetrics() {
    return map.rides.map(function (ride) {
        var avgQueueTime = 0;
        if (ride.stations && ride.stations.length > 0) {
            var qTotal = ride.stations.reduce(function (sum, s) { return sum + s.queueTime; }, 0);
            avgQueueTime = (qTotal / ride.stations.length) / 40; // seconds
        }
        return {
            id: ride.id,
            name: ride.name,
            type: ride.type,
            status: ride.status,
            totalCustomers: ride.totalCustomers,
            totalProfit: ride.totalProfit,
            runningCost: ride.runningCost,
            buildCost: ride.buildCost,
            excitement: ride.excitement,
            intensity: ride.intensity,
            nausea: ride.nausea,
            reliability: ride.reliability,
            downtime: ride.downtime,
            satisfaction: ride.satisfaction,
            age: ride.age,
            avgQueueTime: avgQueueTime
        };
    });
}

function getStaffMetrics() {
    var staff = map.getAllEntities('staff');
    var handymen    = staff.filter(function (s) { return s.staffType === 'handyman'; });
    var mechanics   = staff.filter(function (s) { return s.staffType === 'mechanic'; });
    var security    = staff.filter(function (s) { return s.staffType === 'security'; });
    var entertainers = staff.filter(function (s) { return s.staffType === 'entertainer'; });
    var openRides   = map.rides.filter(function (r) { return r.status === 'open'; });
    return {
        handymenCount: handymen.length,
        mechanicCount: mechanics.length,
        securityCount: security.length,
        entertainerCount: entertainers.length,
        ridesPerMechanic: mechanics.length > 0 ? openRides.length / mechanics.length : null
    };
}

function getEnvironmentMetrics() {
    return {
        weather: climate.current.weather,
        temperature: climate.current.temperature,
        month: date.month,
        year: date.year
    };
}

// ---------------------------------------------------------------------------
// Core loop
// ---------------------------------------------------------------------------

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
        console.log('[Telemetry] Set one via: eval context.sharedStorage.set("TelemetryPlugin.endpoint", "localhost:8080/topics/openrct2")');
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
            park: {
                name: park.name,
                scenarioFilename: scenario.filename
            },
            environment: getEnvironmentMetrics(),
            metrics: {
                averageCash: getAverageCash(),
                averageHappiness: getAverageHappiness(),
                parkRating: getParkRating(),
                rideReliability: getRideReliability(),
                averageQueueTime: getAverageQueueTime(),
                averageRideDowntime: getAverageRideDowntime(),
                averageRideSatisfaction: getAverageRideSatisfaction()
            },
            guests: getGuestSegmentation(),
            revenue: getRevenueMetrics(),
            rides: getPerRideMetrics(),
            staff: getStaffMetrics()
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

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------

function parseEndpoint(endpoint) {
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

    var responseData = '';

    socket.on('error', function (err) {
        onFailure('socket error: ' + err);
    });

    socket.on('data', function (data) {
        responseData += data;
    });

    socket.on('close', function () {
        var statusMatch = responseData.match(/^HTTP\/1\.[01] (\d+)/);
        var status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
        if (status < 200 || status >= 300) {
            console.log('[Telemetry] Server responded ' + status + ': ' + responseData);
            onFailure('HTTP ' + status);
        }
    });

    socket.connect(endpoint.port, endpoint.host, function () {
        socket.write(request);
    });
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

registerPlugin({
    name: 'Telemetry',
    version: '1.1',
    authors: ['chridgn'],
    type: 'local',
    licence: 'MIT',
    targetApiVersion: 77,
    main: main
});

