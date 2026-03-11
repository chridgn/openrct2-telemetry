# OpenRCT2-Telemetry Plugin

Polls in-game metrics on a configurable real-time interval and POSTs a JSON snapshot to a local HTTP endpoint.

In order to use/configure this plugin, start the game via openrct2.com (not .exe) in order to have access to the scripting console and monitor STDOUT.

## Payload

Each POST contains a JSON snapshot of the following shape:

```json
{
  "tick": 12345,
  "type": "snapshot",
  "metrics": {
    "averageCash": 430,
    "averageHappiness": 74.2,
    "parkRating": 812,
    "averageRideDowntime": 3.5,
    "averageRideSatisfaction": 68.1
  }
}
```

| Field | Description |
|-------|-------------|
| `tick` | Total game ticks elapsed since scenario start |
| `averageCash` | Mean cash held by all guests (game subunits) |
| `averageHappiness` | Mean guest happiness, normalised to 0–100 |
| `parkRating` | Current park rating (0–999) |
| `averageRideDowntime` | Mean downtime across all rides, 0–100 (higher = less reliable) |
| `averageRideSatisfaction` | Mean satisfaction of open rides, normalised to 0–100 |

## Configuration
Variables are set via the console launched alongside openrct2.com:

```
context.sharedStorage.set('TelemetryPlugin.<key>', <value>);
```

| Key | Default | Description |
|-----|---------|-------------|
| `TelemetryPlugin.endpoint` | *(none)* | Local HTTP endpoint to POST snapshots to, e.g. `localhost:8080/topics/openrct2` |
| `TelemetryPlugin.pollInterval` | `5000` | Poll interval in milliseconds |
| `TelemetryPlugin.enabled` | *(enabled)* | Set to `'false'` to disable without uninstalling |
| `TelemetryPlugin.debug` | *(off)* | Set to `'true'` to log each snapshot payload to STDOUT |

## Endpoint Setup
For security purposes the endpoint must be a local HTTP server set to receive POST requests. This can be a web server that routes requests to an external endpoint, or a message broker/event system that receives requests via REST proxy.

## Troubleshooting
If a socket error occurs, the plugin will stop sending. Every in-game day the watchdog checks for failures and retries — if the service has recovered, it will resume automatically. The watchdog also picks up any configuration changes (endpoint, poll interval, enabled state) without requiring a game restart.
