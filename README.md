# opencode-apprise-notify

OpenCode plugin for multi-service notifications via Apprise.

## Features

- Multi-service support for 128+ notification services via Apprise.
- Automatic notifications for session idle events.
- Notifications for Question tool prompts.
- Alerts for background task completions.
- Notifications for permission requests.

## Prerequisites

- OpenCode
- Python 3.x
- Apprise (`pip install apprise`)

## Quick Start

1. Install the plugin by adding it to your `opencode.json` plugin array:

   ```json
   "plugins": ["opencode-apprise-notify"]
   ```

   Or use the CLI:
   `opencode plugins add opencode-apprise-notify`

2. Set your notification URLs as an environment variable:
   `export APPRISE_URLS="slack://T/B/C discord://id/token"`

Note: The `APPRISE_URLS` environment variable takes priority over CLI URLs.

## Configuration

| Variable | Description | Default |
| :--- | :--- | :--- |
| `APPRISE_URLS` | Comma or space separated Apprise URLs. Required if no `APPRISE_CONFIG`. | None |
| `APPRISE_CONFIG` | Path to an Apprise configuration file. Required if no `APPRISE_URLS`. | None |
| `OPENCODE_NOTIFY_IDLE_DELAY` | Delay before idle notification in milliseconds. | 3000 |
| `OPENCODE_NOTIFY_TRUNCATE` | Maximum message length in characters. | 1500 |
| `OPENCODE_NOTIFY_DEDUP` | Enable message deduplication. | true |
| `OPENCODE_NOTIFY_TAG` | Apprise tag filter for notifications. | None |

Messages are truncated at 1,500 characters to stay within limits for Discord, Telegram, and Slack. Notifications do not include sensitive information like API keys or environment variable values.

## Supported Services

Apprise supports many services. Use these URL formats:

- **Slack**: `slack://TokenA/TokenB/TokenC`
- **Discord**: `discord://webhook_id/webhook_token`
- **Telegram**: `tgram://bottoken/ChatID`
- **Email**: `mailto://user:pass@gmail.com`

## Notification Triggers

The plugin sends notifications for these events:

- **Idle**: Triggered when the session remains idle for the configured delay.
- **Question**: Triggered when the Question tool requires user input.
- **Background**: Triggered when a background task finishes.
- **Permission**: Triggered when a tool requires explicit user permission.

## Notification Examples

```
📢 OpenCode Attention Required
📝 Request: Build a REST API
🤖 Response: I've created the Express server...
📋 Todo: ✅ 3 done | ▶️ 1 in_progress | ⚪ 2 pending
```

## Apprise Config File

You can use a YAML configuration file instead of environment variables. Example `~/.apprise.yml`:

```yaml
# ~/.apprise.yml
urls:
  - slack://TokenA/TokenB/TokenC
  - discord://webhook_id/webhook_token
  - tgram://bottoken/ChatID
```


You can use a YAML configuration file instead of environment variables. Example `~/.apprise.yml`:

```yaml
urls:
  - slack://T/B/C
  - discord://id/token
```

## Troubleshooting

- **apprise CLI not found**: Run `pip install apprise` to install the required dependency.
- **No notifications received**: Check your `APPRISE_URLS` format and test with `apprise -t test -b test URL`.
- **Too many notifications**: Set `OPENCODE_NOTIFY_DEDUP=true` (default) to enable deduplication.
- **Notifications cut off**: Increase `OPENCODE_NOTIFY_TRUNCATE` to allow longer messages.

## License

MIT
