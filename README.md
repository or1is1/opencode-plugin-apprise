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

2. Configure Apprise with your notification URLs in a default Apprise config file such as `~/.apprise`, `~/.apprise.yml`, or `~/.config/apprise/apprise.yml`.

    Example:

    ```yaml
    # ~/.config/apprise/apprise.yml
    urls:
      - slack://TokenA/TokenB/TokenC
      - discord://webhook_id/webhook_token
      - tgram://bottoken/ChatID
    ```

3. Restart OpenCode — the plugin will automatically detect Apprise and use your configured services.

## Configuration

The plugin relies on Apprise's default configuration file behavior. No environment variables are required.

### Apprise Config File Locations

Apprise automatically looks for config files in these locations (in order):

- `~/.apprise`
- `~/.apprise.yml`
- `~/.config/apprise/apprise.yml`

For complete configuration options, see: https://github.com/caronc/apprise#configuration-file

### Behavior Defaults (hardcoded)

These defaults are built into the plugin and cannot be changed:

| Setting | Default |
|---------|:---|
| Idle delay before notification | 3,000 ms (3 seconds) |
| Maximum message length | 1,500 characters |
| Deduplication | Enabled (5-minute TTL) |
| Tag filtering | None (unless you specify in Apprise config) |

Messages are truncated at 1,500 characters to stay within limits for Discord, Telegram, and Slack. Notifications do not include sensitive information like API keys or environment variable values.

## Supported Services

Apprise supports many services. Use these URL formats:

- **Slack**: `slack://TokenA/TokenB/TokenC`
- **Discord**: `discord://webhook_id/webhook_token`
- **Telegram**: `tgram://bottoken/ChatID`
- **Email**: `mailto://user:pass@gmail.com`

For a complete list, see: https://github.com/caronc/apprise#supported-notifications

## Notification Triggers

The plugin sends notifications for these events:

- **Idle**: Triggered when session remains idle for the configured delay.
- **Question**: Triggered when Question tool requires user input.
- **Background**: Triggered when a background task finishes.
- **Permission**: Triggered when a tool requires explicit user permission.

## Notification Examples

```
📢 OpenCode Attention Required
📝 Request: Build a REST API
🤖 Response: I've created the Express server...
📋 Todo: ✅ 3 done | ▶️ 1 in_progress | ⚪ 2 pending
```

## Troubleshooting

- **apprise CLI not found**: Run `pip install apprise` to install the required dependency.
- **No notifications received**: Check your Apprise config file (`~/.apprise`, `~/.apprise.yml`, or `~/.config/apprise/apprise.yml`) and test with `apprise -t test -b test`.
- **Too many notifications**: Deduplication is enabled by default (5-minute TTL).
- **Notifications cut off**: The maximum message length is hardcoded at 1,500 characters.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Write tests first (TDD)
4. Ensure all tests pass (`bun test`)
5. Submit a pull request

**Development setup:**
```bash
git clone https://github.com/or1is1/opencode-apprise-notify.git
cd opencode-apprise-notify
bun install
pip install apprise  # Required for integration tests
bun test
```

## License

MIT
