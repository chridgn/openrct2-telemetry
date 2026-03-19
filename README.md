# OpenRCT2-Telemetry Plugin

Polls in-game metrics on a configurable real-time interval and POSTs a JSON snapshot to a local HTTP endpoint.

In order to use/configure this plugin, start the game via openrct2.com (not .exe) in order to have access to the scripting console and monitor STDOUT.

## Payload Schema

Each POST contains a JSON snapshot of the following shape:

```json
{
  "tick": 12345,
  "type": "snapshot",
  "environment": {
    "weather": "partlyCloudy",
    "temperature": 18,
    "windSpeed": 5,
    "month": 3,
    "year": 2
  },
  "metrics": {
    "averageCash": 430,
    "averageHappiness": 74.2,
    "parkRating": 812,
    "rideReliability": 91.7,
    "averageQueueTime": 38.5,
    "averageRideDowntime": 3.5,
    "averageRideSatisfaction": 68.1
  },
  "guests": {
    "total": 312,
    "happy": 198,
    "neutral": 87,
    "unhappy": 27,
    "nauseated": 14,
    "hungry": 32,
    "thirsty": 19,
    "lost": 8,
    "broke": 11,
    "totalSpendingPower": 134400
  },
  "revenue": {
    "rideIncome": 24800,
    "shopIncome": 6200,
    "admissionsIncome": 18000,
    "entranceFee": 1000,
    "totalAdmissions": 3812,
    "cash": 450000,
    "bankLoan": 100000,
    "companyValue": 1200000,
    "parkValue": 980000
  },
  "rides": [
    {
      "id": 0,
      "name": "Corkscrew Coaster 1",
      "type": 3,
      "status": "open",
      "totalCustomers": 1482,
      "totalProfit": 74100,
      "runningCost": 200,
      "buildCost": 32000,
      "excitement": 721,
      "intensity": 534,
      "nausea": 312,
      "reliability": 94,
      "downtime": 2,
      "satisfaction": 210,
      "age": 48,
      "avgQueueTime": 42.3
    }
  ],
  "staff": {
    "handymenCount": 6,
    "mechanicCount": 3,
    "securityCount": 2,
    "entertainerCount": 1,
    "ridesPerMechanic": 4.3
  }
}
```

### Field Reference

**Top-level**

| Field | Description |
|-------|-------------|
| `tick` | Total game ticks elapsed since scenario start |
| `type` | Always `"snapshot"` |

**`environment`**

| Field | Description |
|-------|-------------|
| `weather` | Current weather condition string (e.g. `"sunny"`, `"rain"`, `"thunder"`) |
| `temperature` | Air temperature in degrees Celsius |
| `windSpeed` | Wind speed (game units) |
| `month` | In-game month (1–8) |
| `year` | In-game year |

**`metrics`**

| Field | Description |
|-------|-------------|
| `averageCash` | Mean cash held by all guests (game subunits) |
| `averageHappiness` | Mean guest happiness, normalised to 0–100 |
| `parkRating` | Current park rating (0–999) |
| `rideReliability` | Percentage of rides currently open |
| `averageQueueTime` | Mean queue time across all open ride stations, in seconds |
| `averageRideDowntime` | Mean downtime across all rides, 0–100 (higher = less reliable) |
| `averageRideSatisfaction` | Mean satisfaction of open rides, normalised to 0–100 |

**`guests`**

| Field | Description |
|-------|-------------|
| `total` | Total number of guests in the park |
| `happy` | Guests with happiness > 170 |
| `neutral` | Guests with happiness 85–170 |
| `unhappy` | Guests with happiness < 85 |
| `nauseated` | Guests with nausea > 128 |
| `hungry` | Guests with hunger < 85 |
| `thirsty` | Guests with thirst < 85 |
| `lost` | Guests flagged as lost |
| `broke` | Guests with cash < 100 subunits |
| `totalSpendingPower` | Sum of all guest cash (game subunits) |

**`revenue`**

| Field | Description |
|-------|-------------|
| `rideIncome` | Total ride income this month (game subunits) |
| `shopIncome` | Total food/drink income this month (game subunits) |
| `admissionsIncome` | Total admissions income this month (game subunits) |
| `entranceFee` | Current park entrance fee (game subunits) |
| `totalAdmissions` | Total guests admitted since scenario start |
| `cash` | Current park cash balance (game subunits) |
| `bankLoan` | Outstanding bank loan amount (game subunits) |
| `companyValue` | Company value (game subunits) |
| `parkValue` | Park value (game subunits) |

**`rides[]`**

| Field | Description |
|-------|-------------|
| `id` | Ride ID |
| `name` | Ride name |
| `type` | Ride type ID |
| `status` | `"open"`, `"closed"`, `"testing"`, or `"simulating"` |
| `totalCustomers` | Total customers served since opening |
| `totalProfit` | Total profit since opening (game subunits) |
| `runningCost` | Monthly running cost (game subunits) |
| `buildCost` | Original build cost (game subunits) |
| `excitement` | Excitement rating (game units) |
| `intensity` | Intensity rating (game units) |
| `nausea` | Nausea rating (game units) |
| `reliability` | Reliability percentage (0–100) |
| `downtime` | Downtime percentage (0–100) |
| `satisfaction` | Satisfaction (0–255) |
| `age` | Ride age in months |
| `avgQueueTime` | Mean queue time across stations, in seconds |

**`staff`**

| Field | Description |
|-------|-------------|
| `handymenCount` | Number of handymen |
| `mechanicCount` | Number of mechanics |
| `securityCount` | Number of security guards |
| `entertainerCount` | Number of entertainers |
| `ridesPerMechanic` | Open rides per mechanic; `null` if no mechanics |

## Configuration

Variables are set via the console launched alongside openrct2.com:

```
eval context.sharedStorage.set('TelemetryPlugin.<key>', <value>);
```

| Key | Default | Description |
|-----|---------|-------------|
| `TelemetryPlugin.endpoint` | *(none)* | Local HTTP endpoint to POST snapshots to, e.g. `localhost:8080/topics/openrct2` |
| `TelemetryPlugin.pollInterval` | `5000` | Poll interval in milliseconds |
| `TelemetryPlugin.enabled` | *(enabled)* | Set to `'false'` to disable without uninstalling |
| `TelemetryPlugin.debug` | *(off)* | Set to `'true'` to log each snapshot payload to STDOUT |
| `TelemetryPlugin.activeWhileParkClosed` | `'false'` | Set to `'true'` to continue sending telemetry when the park is closed |

NOTE: Telemetry is disabled while the game is paused.

## Endpoint Setup

For security purposes the endpoint must be a local HTTP server set to receive POST requests. This can be a web server that routes requests to an external endpoint, or a message broker/event system that receives requests via REST proxy.

## Troubleshooting

If a socket error occurs, the plugin will stop sending. Every in-game day the watchdog checks for failures and retries. If the service has recovered, it will resume automatically. The watchdog also picks up any configuration changes (endpoint, poll interval, enabled state) without requiring a game restart.
