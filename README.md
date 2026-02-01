# iOS Simulator MCP Server

An MCP (Model Context Protocol) server that gives Claude Code agentic control over the iOS Simulator for UI/UX debugging and development.

## Features

### Simulator Control
- List, boot, and shutdown simulators
- Take screenshots
- Set location, status bar overrides
- Push notifications
- Manage app permissions

### App Management
- Install, launch, and terminate apps
- List installed apps
- Open URLs
- Access app containers

### UI Interaction (requires IDB)
- Tap at coordinates
- Swipe gestures
- Text input
- Hardware button presses

### Deep UI Debugging (requires ClaudeDebugKit)
- Complete view hierarchy inspection
- Auto Layout constraint analysis
- Touch target size audit (44pt minimum)
- Color contrast audit (WCAG AA/AAA)
- Accessibility audit
- Font and color inspection
- View highlighting
- Trait collection overrides (dark mode, Dynamic Type)
- Memory stats and performance metrics

## Installation

### Prerequisites

1. **Xcode** with iOS Simulator
2. **Node.js** 18+
3. **IDB** (optional, for UI interaction):
   ```bash
   brew install idb-companion
   pip install fb-idb
   ```

### Install the MCP Server

```bash
cd ios-simulator-mcp-server
npm install
npm run build
```

### Configure Claude Code

Add to your Claude Code MCP configuration (`~/.config/claude-code/mcp.json`):

```json
{
  "mcpServers": {
    "ios-simulator": {
      "command": "node",
      "args": ["/path/to/ios-simulator-mcp-server/dist/index.js"]
    }
  }
}
```

### Add ClaudeDebugKit to Your iOS App

For deep UI inspection features, add the Swift package to your iOS project:

1. In Xcode: File → Add Package Dependencies
2. Enter: `file:///path/to/ClaudeDebugKit`
3. Add to your app (DEBUG builds only):

```swift
#if DEBUG
import ClaudeDebugKit

// In AppDelegate or SceneDelegate
func application(_ application: UIApplication, didFinishLaunchingWithOptions...) {
    ClaudeDebugServer.shared.start()
    return true
}
#endif
```

## Usage Examples

### Basic Simulator Control

```
"List all available iOS simulators"
"Boot iPhone 15 Pro"
"Take a screenshot of the simulator"
"Set the location to San Francisco (37.7749, -122.4194)"
```

### App Development Workflow

```
"Install my app from ~/Build/MyApp.app and launch it"
"Get the view hierarchy of the current screen"
"Find all interactive elements"
"Audit touch targets for HIG compliance"
```

### UI/UX Debugging

```
"Check color contrast for WCAG AA compliance"
"Show me the constraints on the login button"
"Highlight the view with accessibility label 'Submit'"
"Run a full UI/UX audit"
```

### Testing Different Configurations

```
"Switch to dark mode"
"Override Dynamic Type to extra large"
"Simulate a memory warning"
"Get memory stats for the app"
```

## Available Tools

### Simulator Management
| Tool | Description |
|------|-------------|
| `ios_list_devices` | List all simulators |
| `ios_boot_device` | Boot a simulator |
| `ios_shutdown_device` | Shutdown a simulator |
| `ios_screenshot` | Take screenshot |
| `ios_set_location` | Set GPS location |
| `ios_set_status_bar` | Override status bar |
| `ios_push_notification` | Send push notification |
| `ios_set_permission` | Grant/revoke permissions |
| `ios_get_logs` | Get app logs |

### App Management
| Tool | Description |
|------|-------------|
| `ios_install_app` | Install .app bundle |
| `ios_launch_app` | Launch app |
| `ios_terminate_app` | Terminate app |
| `ios_list_apps` | List installed apps |
| `ios_open_url` | Open URL |
| `ios_get_app_container` | Get container path |

### UI Interaction (requires IDB)
| Tool | Description |
|------|-------------|
| `ios_tap` | Tap at coordinates or label |
| `ios_swipe` | Swipe gesture |
| `ios_input_text` | Type text |
| `ios_press_button` | Hardware buttons |
| `ios_long_press` | Long press |

### View Debugging (requires ClaudeDebugKit)
| Tool | Description |
|------|-------------|
| `ios_get_view_hierarchy` | Full view tree |
| `ios_get_constraints` | Auto Layout constraints |
| `ios_find_element` | Find by label/identifier |
| `ios_get_view_colors` | Color information |
| `ios_get_font_info` | Font details |
| `ios_highlight_view` | Visual highlighting |
| `ios_get_interactive_elements` | All tappable elements |
| `ios_get_responder_chain` | Responder chain |
| `ios_get_traits` | Trait collection |
| `ios_override_traits` | Override appearance |
| `ios_get_memory_stats` | Memory usage |
| `ios_export_view_image` | Export view as PNG |

### Auditing (requires ClaudeDebugKit)
| Tool | Description |
|------|-------------|
| `ios_audit_touch_targets` | Check 44pt minimum |
| `ios_audit_contrast` | WCAG contrast check |
| `ios_audit_layout` | Auto Layout issues |
| `ios_audit_accessibility` | Accessibility issues |
| `ios_audit_all` | Full UI/UX audit |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Claude Code                          │
└─────────────────────┬───────────────────────────────────┘
                      │ MCP Protocol (stdio)
                      ▼
┌─────────────────────────────────────────────────────────┐
│              ios-simulator-mcp-server                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   simctl    │  │     IDB     │  │  Debug Client   │ │
│  │  (built-in) │  │ (optional)  │  │   (HTTP)        │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
└─────────┼────────────────┼──────────────────┼──────────┘
          │                │                  │
          ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                    iOS Simulator                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │                   Your iOS App                     │ │
│  │  ┌─────────────────────────────────────────────┐  │ │
│  │  │            ClaudeDebugKit                    │  │ │
│  │  │         (HTTP Server on :8765)               │  │ │
│  │  └─────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Requirements

- macOS with Xcode 15+
- Node.js 18+
- iOS 14+ target for ClaudeDebugKit

## License

MIT
