# opencode-plugin-apprise

OpenCode plugin for multi-service notifications via Apprise.

## Features

- Multi-service support for 128+ notification services via Apprise.
- Automatic notifications when sessions go idle.
- Delayed notifications for Question tool prompts (30-second grace period).
- Alerts when sessions transition to idle after activity.
- Notifications for permission requests with dual-mechanism reliability.

## Prerequisites

- OpenCode
- Python 3.x
- Apprise (`pip install apprise`)

## Quick Start

1. Install the plugin by adding it to your `opencode.json` plugin array:

    ```json
    "plugins": ["opencode-plugin-apprise"]
    ```

    Or use the CLI:
    `opencode plugins add opencode-plugin-apprise`

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

The plugin relies on Apprise's default configuration file behavior.

### Apprise Config File Locations

Apprise automatically looks for config files in these locations (in order):

- `~/.apprise`
- `~/.apprise.yml`
- `~/.config/apprise/apprise.yml`

For complete configuration options, see: https://github.com/caronc/apprise#configuration-file

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENCODE_NOTIFY_TAG` | No | Apprise tag for filtering which configured services receive notifications. When set, only services matching this tag in your Apprise config will be notified. |

### Behavior Defaults

| Setting | Value |
|---------|:------|
| Maximum message length | 1,500 characters |
| Deduplication TTL | 5 minutes (max 100 entries) |
| Question notification delay | 30 seconds |
| Apprise CLI timeout | 30 seconds |

## Notification Triggers

### Idle

Fires immediately when OpenCode emits a `session.idle` event. Includes the last user request, agent response, and todo status.

**Severity**: info

```
📢 OpenCode Attention Required
📝 Request: Build a REST API
🤖 Response: I've created the Express server...
📋 Todo: ✅ 3 done | ▶️ 1 in_progress | ⚪ 2 pending
```

### Question

Fires 30 seconds after the Question tool is invoked. If the user answers within 30 seconds, the notification is cancelled. This prevents spam for quick interactions.

**Severity**: warning

```
❓ OpenCode Question
❓ Question: Deploy to production?
Options:
  1. yes
  2. no
  3. cancel
```

### Background

Fires when a session's status transitions to `idle` after being active. This indicates the agent has finished working and the session is waiting.

**Severity**: success

```
✅ Background Task Complete
Task: Session ses_abc123
```

### Permission

Fires when a tool requires explicit user permission. Uses two mechanisms for reliability: the primary `permission.ask` hook and a fallback `permission.updated` event listener. Permissions are deduplicated by ID to prevent double notifications.

**Severity**: warning

```
🔐 OpenCode Permission Required
🔧 Tool: bash
⚡ Action: execute rm -rf node_modules
```

## Supported Services

Apprise supports many services. Use these URL formats:

- **Slack**: `slack://TokenA/TokenB/TokenC`
- **Discord**: `discord://webhook_id/webhook_token`
- **Telegram**: `tgram://bottoken/ChatID`
- **Email**: `mailto://user:pass@gmail.com`

For a complete list, see: https://github.com/caronc/apprise#supported-notifications

## How It Works

### Message Truncation

Messages exceeding 1,500 characters are truncated. For messages with more than 10 lines, the first 5 and last 5 lines are preserved with a `...(truncated)` marker. Otherwise, a simple character truncation is applied.

### Deduplication

Identical notifications are suppressed for 5 minutes. Duplicates are identified by a hash of the notification type, title, user request, and question text. The cache holds a maximum of 100 entries with LRU eviction.

### Notification Severity Mapping

| Event | Apprise Type |
|-------|:-------------|
| Idle | info |
| Question | warning |
| Background | success |
| Permission | warning |

## Troubleshooting

- **apprise CLI not found**: Run `pip install apprise` to install the required dependency.
- **No notifications received**: Check your Apprise config file (`~/.apprise`, `~/.apprise.yml`, or `~/.config/apprise/apprise.yml`) and test with `apprise -t test -b test`.
- **Notifications not reaching a specific service**: Set `OPENCODE_NOTIFY_TAG` to match the tag assigned to that service in your Apprise config.
- **Too many notifications**: Deduplication suppresses identical notifications for 5 minutes.
- **Notifications cut off**: Messages are truncated at 1,500 characters.
- **Apprise command hangs**: The CLI timeout is 30 seconds. If Apprise doesn't respond in time, the notification fails silently.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Write tests first (TDD)
4. Ensure all tests pass (`bun test`)
5. Submit a pull request

**Development setup:**
```bash
git clone https://github.com/or1is1/opencode-plugin-apprise.git
cd opencode-plugin-apprise
bun install
pip install apprise
bun test
```

## License

MIT
