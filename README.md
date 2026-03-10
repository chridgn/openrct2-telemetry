# OpenRCT2-Telemetry Plugin

Emits in-game events to a local HTTP endpoint by hooking into `action.execute` and sending a POST for every event. 

In order to use/configure this plugin, start the game via openrct2.com (not .exe) in order to have access to the scripting console and monitor STDOUT.

## Configuration
The following variables can be configured via the console that is launched alongside openrct2.com.

```
# To set the endpoint
context.sharedStorage.set('TelemetryPlugin.endpoint', <endpoint: str>);

# To disable the plugin without uninstall, set:
context.sharedStorage.set('TelemetryPlugin.enabled', 'false');
```

## Endpoint Setup
For security purposes the endpoint must be a local HTTP server that is set to receive POST requests. This can be a webserver that serves an API that routes requests to an external endpoint, or a message broker/event system that receives requests via REST proxy. 

## Troubleshooting
If the endpoint returns a non-2xx status or a socket error occurs, the plugin will stop listening. Every in-game day the plugin checks for failures and retries — if the service has recovered, it will resume automatically.

