# computer-use-mcp

💻 An MCP server for Claude to control **your physical computer**. This tool interacts with your actual machine - files, applications, and windows on your desktop.

**Important**: This operates on your **real machine**, NOT in an isolated container like `bash_tool`. Files and applications accessible here are separate from containerized environments.

## When to Use This Tool

**Use `computer-use` for:**
- ✅ Clicking buttons in desktop applications
- ✅ Typing text into applications (word processors, browsers, games)
- ✅ Taking screenshots of your desktop
- ✅ Managing windows (focus, move, resize)
- ✅ Playing games with keyboard/mouse/gamepad control
- ✅ GUI automation tasks

**Use other tools instead:**
- ❌ Terminal commands → Use `bash_tool` or shell execution MCP servers
- ❌ Reading/writing files → Use filesystem MCP servers
- ❌ Running scripts → Use `bash_tool` or command execution tools

<!-- TODO: demo video -->

To get best results:
- Install and enable the [Rango browser extension](https://chromewebstore.google.com/detail/rango/lnemjdnjjofijemhdogofbpcedhgcpmb). This enables keyboard navigation for websites, which is far more reliable than Claude trying to click coordinates.
- On high resolution displays, consider zooming in to active windows. You can also bump up the font size setting in Rango to make the text more visible.

> [!WARNING]
> At time of writing, models make frequent mistakes and are vulnerable to prompt injections. As this MCP server gives the model complete control of your computer, this could do a lot of damage. You should therefore treat this like giving a hyperactive toddler access to your computer - you probably want to supervise it closely, and consider only doing this in a sandboxed user account.

## How it works

This MCP server provides Claude with **19 specialized tools** organized into a modular architecture, going beyond Anthropic's single computer use tool. Each tool focuses on a specific capability:

**Input Tools (9 tools):**
- **Keyboard** (2): `keyboard_press`, `keyboard_type`
- **Mouse** (7): `mouse_move`, `mouse_click`, `mouse_drag`, `mouse_double_click`, `mouse_right_click`, `mouse_middle_click`, `mouse_position`
- **Gamepad** (5): Xbox controller emulation for gaming (Windows only)

**Vision Tools (1 tool):**
- **Screenshot** (1): `screenshot_capture` with window and region support

**System Tools (4 tools):**
- **Windows** (4): `windows_list`, `windows_focus`, `windows_position`, `windows_info`

**Orchestration (1 tool):**
- **Sequence** (1): Execute multiple commands with shared context and delays

All input commands automatically capture screenshots after execution for immediate visual feedback.

Under the hood, this uses [nut.js](https://github.com/nut-tree/nut.js) for cross-platform desktop automation.

## Available Tools

### Keyboard Control
- `keyboard_press` - Press key combinations (e.g., "ctrl+c", "cmd+space")
  - Supports modifiers, function keys, navigation keys
  - Optional `hold` parameter for sustained key presses
  - Optional `window` parameter to target specific windows
- `keyboard_type` - Type text strings
  - Simulates natural typing
  - Supports newlines (`\n`) - automatically presses Return/Enter
  - Handles multi-line text and blank lines
  - Window targeting support

### Mouse Control
- `mouse_move` - Move cursor to (x, y) coordinates
- `mouse_click` - Click with button selection (left/right/middle/double)
- `mouse_drag` - Click and drag to coordinates
- `mouse_double_click` - Double-click left button
- `mouse_right_click` - Right-click at location
- `mouse_middle_click` - Middle-click at location
- `mouse_position` - Get current cursor position

All mouse commands support optional coordinate specification and window targeting.

### Gamepad Control (Windows Only)
Xbox controller emulation for gaming - **requires [ViGEm driver](https://github.com/nefarius/ViGEmBus/releases)**:

- `gamepad_button` - Press buttons (A, B, X, Y, LB, RB, Start, Back, Xbox, L3, R3)
- `gamepad_trigger` - Press triggers (LT, RT) with analog pressure (0-255)
- `gamepad_stick` - Move analog sticks with X/Y axes (-32768 to 32767)
- `gamepad_dpad` - Press D-pad directions (up, down, left, right)
- `gamepad_reset` - Reset controller to neutral state

Controller state persists between commands unless explicitly reset.

### Screenshot Capture
- `screenshot_capture` - Capture screen with optional targeting
  - Full screen capture
  - Window-specific capture (via `window` parameter)
  - Region capture (via `region` parameter with x, y, width, height)
  - Automatic resizing and compression for Claude's size limits

### Window Management
- `windows_list` - List all open windows with IDs, titles, and positions
- `windows_focus` - Focus (activate) a specific window by ID
- `windows_position` - Get or set window position and size
- `windows_info` - Get detailed information about a window

Use `windows_list` to get window IDs, then reference them in other commands.

### Command Sequences
- `sequence` - Execute multiple commands in a single request
  - Shared window context across all commands
  - Configurable delays between steps (`delayBetween`)
  - Error handling options (`stopOnError`)
  - Screenshot control (`captureIntermediate` for debugging, or only final result)

Example sequence:
```json
{
  "commands": [
    {"tool": "keyboard", "action": "keyboard_press", "params": {"keys": "cmd+space"}},
    {"tool": "keyboard", "action": "keyboard_type", "params": {"text": "Terminal"}},
    {"tool": "keyboard", "action": "keyboard_press", "params": {"keys": "return"}}
  ],
  "delayBetween": 200,
  "stopOnError": true,
  "captureIntermediate": false
}
```

## macOS Permissions

**IMPORTANT**: On macOS, this MCP server requires system permissions to control your computer:

1. **Accessibility Permission** (Required for keyboard/mouse control)
   - Open **System Preferences** > **Privacy & Security** > **Privacy** > **Accessibility**
   - Click the lock icon and authenticate
   - Add and enable **node** (or **Terminal** if using terminal-installed node)

2. **Screen Recording Permission** (Required for screenshots)
   - Open **System Preferences** > **Privacy & Security** > **Privacy** > **Screen Recording**
   - Add and enable **node** (or **Terminal**)

3. **Restart Claude Desktop** after granting permissions

**Note**: On first use, macOS may open System Preferences to request these permissions. The server logs permission status on startup to `~/.mcp/computer-use/server.log`

## Installation

Follow the instructions below for your preferred client:

- [Claude Desktop](#claude-desktop)
- [Cursor](#cursor)
- [Cline](#cline)

### Claude Desktop

#### (Recommended) Via manual .dxt installation

1. Find the latest dxt build in [the GitHub Actions history](https://github.com/cykonova/computer-use-mcp/actions/workflows/build-dxt.yml?query=branch%3Amaster) (the top one)
2. In the 'Artifacts' section, download the `dxt-package` file
3. Rename the `.zip` file to `.dxt`
4. Double-click the `.dxt` file to open with Claude Desktop
5. Click "Install"

#### (Advanced) Alternative: Via JSON configuration

1. Install [Node.js](https://nodejs.org/en/download)
2. Open Claude Desktop and go to Settings → Developer
3. Click "Edit Config" to open your `claude_desktop_config.json` file
4. Add the following configuration to the "mcpServers" section:

```json
{
  "mcpServers": {
    "computer-use": {
      "command": "npx",
      "args": [
        "-y",
        "@cykonova/computer-use-mcp"
      ]
    }
  }
}
```

5. Save the file and restart Claude Desktop

**Note**: For private packages, you'll need to configure npm authentication first. See [Installing from GitHub Packages](#installing-from-github-packages) below.

### Cursor

#### (Advanced) Via JSON configuration

Create either a global (`~/.cursor/mcp.json`) or project-specific (`.cursor/mcp.json`) configuration file:

```json
{
  "mcpServers": {
    "computer-use": {
      "command": "npx",
      "args": ["-y", "@cykonova/computer-use-mcp"]
    }
  }
}
```

**Note**: For private packages, you'll need to configure npm authentication first. See [Installing from GitHub Packages](#installing-from-github-packages) below.

### Cline

#### (Recommended) Via marketplace

1. Click the "MCP Servers" icon in the Cline extension
2. Search for "Computer Use" and click "Install"
3. Follow the prompts to install the server

**Note**: The marketplace version may use the public package. For the private @cykonova version, use JSON configuration below.

#### (Advanced) Alternative: Via JSON configuration

1. Click the "MCP Servers" icon in the Cline extension
2. Click on the "Installed" tab, then the "Configure MCP Servers" button at the bottom
3. Add the following configuration to the "mcpServers" section:

```json
{
  "mcpServers": {
    "computer-use": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@cykonova/computer-use-mcp"]
    }
  }
}
```

**Note**: For private packages, you'll need to configure npm authentication first. See [Installing from GitHub Packages](#installing-from-github-packages) below.

## Configuration

### Environment Variables

**SCREENSHOT_CACHE** (optional, default: disabled)
- Set to `true` to enable saving screenshots to disk for debugging
- When enabled, screenshots are saved to `~/.mcp/computer-use/screenshots/`
  - macOS/Linux: `/Users/{user}/.mcp/computer-use/screenshots/`
  - Windows: `C:\Users\{user}\.mcp\computer-use\screenshots\`
- Filenames: `screenshot-{timestamp}.png`
- Useful for troubleshooting and verifying screenshot captures
- File paths logged to `~/.mcp/computer-use/server.log`

Example (Claude Desktop config):
```json
{
  "mcpServers": {
    "computer-use": {
      "command": "npx",
      "args": ["-y", "@cykonova/computer-use-mcp"],
      "env": {
        "SCREENSHOT_CACHE": "true"
      }
    }
  }
}
```

## Contributing

Pull requests are welcomed on GitHub! To get started:

1. Install Git and Node.js
2. Clone the repository
3. Install dependencies with `npm install`
4. Run `npm run test` to run tests
5. Build with `npm run build`

## Releases

Versions follow the [semantic versioning spec](https://semver.org/).

To release:

1. Use `npm version <major | minor | patch>` to bump the version
2. Run `git push --follow-tags` to push with tags
3. Wait for GitHub Actions to publish to GitHub Packages (private registry)

### Installing from GitHub Packages

This package is published as a private package to GitHub Packages under `@cykonova/computer-use-mcp`. To install:

1. Create a personal access token with `read:packages` scope at https://github.com/settings/tokens
2. Create or edit `~/.npmrc` with:
   ```
   @cykonova:registry=https://npm.pkg.github.com/
   //npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
   ```
3. Install the package:
   ```bash
   npm install @cykonova/computer-use-mcp
   ```

See `.npmrc.example` for a template configuration file.
