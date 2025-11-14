# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that enables Claude to control your computer through multiple modular tools: keyboard input, mouse control, and screenshot capture. It implements computer use functionality similar to Anthropic's official computer use guide, using nut.js for cross-platform system control with a modern IO class architecture for extensibility.

## Architecture

### Core Components

**IOClass Architecture (`src/core/`)**: Foundation for modular tool system
- **IOClass Interface** (`io-class.interface.ts`): Base contract all IO classes implement with methods `getTools()` and `handleAction()`
- **DIContainer** (`di-container.ts`): Dependency injection container managing IO class instances and their registration
- **SequenceHandler** (`sequence-handler.ts`): Executes multi-step command sequences with shared context, configurable delays, and error handling

**Input IO Classes (`src/io/input/`)**:
- **KeyboardIO**: Provides `keyboard_press` (with optional hold duration) and `keyboard_type` tools
- **MouseIO**: Provides 7 mouse tools:
  - `mouse_move`: Move cursor to coordinates
  - `mouse_click`: Click with selectable button (left/right/middle/double)
  - `mouse_drag`: Click and drag to coordinates
  - `mouse_double_click`: Double-click left button
  - `mouse_right_click`: Right-click
  - `mouse_middle_click`: Middle-click
  - `mouse_position`: Get current cursor position (no auto-screenshot)
- **GamepadIO**: Provides Xbox controller emulation (Windows only - requires ViGEm driver):
  - `gamepad_button`: Press buttons (A, B, X, Y, LB, RB, Start, Back, Xbox, L3, R3) with optional hold duration
  - `gamepad_trigger`: Press triggers (LT, RT) with analog pressure (0-255)
  - `gamepad_stick`: Move analog sticks (left/right) with X/Y axes (-32768 to 32767)
  - `gamepad_dpad`: Press D-pad directions (up, down, left, right)
  - `gamepad_reset`: Reset controller to neutral state (all sticks centered, no buttons pressed)
  - **Platform Support**: Windows only (requires ViGEm driver from https://github.com/nefarius/ViGEmBus)
  - **State Persistence**: Controller state persists between commands unless explicitly reset
  - **Hold Behavior**: Triggers and sticks return to neutral after hold duration if specified

**Vision IO Classes (`src/io/vision/`)**:
- **ScreenshotIO**: Provides `screenshot_capture` tool with optional window/region targeting

**System IO Classes (`src/io/system/`)**:
- **WindowsIO**: Provides window management tools:
  - `windows_list`: List all open windows with IDs, titles, and positions
  - `windows_focus`: Focus (activate) a specific window
  - `windows_position`: Get or set window position and size
  - `windows_info`: Get detailed information about a window

All input commands support:
- `window` parameter (optional window ID for targeting - use `windows_list` to get IDs)
- `hold` parameter (duration in ms for keyboard operations)
- Auto-screenshot on success (except mouse_position)
- Window focusing is automatic when `window` parameter is provided

**MCP Server (`src/server.ts`)**: ~100 line dynamic tool registration
- Collects tools from all registered IO classes
- Routes tool execution to appropriate IO class based on tool name pattern
- Handles `sequence` tool for multi-command execution
- Total of 20 tools exposed (2 keyboard + 7 mouse + 5 gamepad + 1 screenshot + 4 windows + 1 sequence)

**Key Translation (`src/xdotoolStringToKeys.ts`)**: Converts xdotool-style key strings (e.g., "ctrl+c", "super+space") to nut.js Key enums. Supports:
- Function keys (F1-F24)
- Navigation keys (arrows, home, end, page up/down)
- Modifiers (shift, ctrl, alt, super/win/cmd)
- Standard alphanumeric and punctuation keys
- Media keys (mute, volume, play/pause)
- Keypad keys

**Entry Point (`src/index.ts`)**: Stdio-based MCP server initialization with error handling and signal management.

### Technology Stack

- **MCP SDK** (`@modelcontextprotocol/sdk`): Model Context Protocol implementation
- **nut.js** (`@nut-tree-fork/nut-js`): Cross-platform desktop automation (mouse, keyboard, screen)
- **Zod**: Runtime type validation for tool parameters
- **Imagemin + pngquant**: Screenshot compression to stay within size limits
- **Dependency Injection pattern**: IO class management for extensibility
- **TypeScript**: Type-safe implementation with ES modules

### Screenshot Handling

The screenshot_capture action implements size constraints for Claude:
1. Waits 1 second for UI to load
2. Captures full screen via nut.js (or specific region if provided)
3. Resizes if resolution exceeds 1366x768 (maintains aspect ratio)
4. Compresses PNG using pngquant
5. Returns base64-encoded image with original dimensions metadata

## Development Commands

### Build and Run
```bash
npm run build           # Compile TypeScript to dist/
npm start               # Build and run the server
```

### Testing
```bash
npm test                # Run unit tests (vitest)
npm run test:watch      # Run tests in watch mode
npm run test:e2e        # Run end-to-end tests
```

### Code Quality
```bash
npm run lint            # Run ESLint
```

### DXT Package
```bash
npm run build-dxt       # Create .dxt package for Claude Desktop
```

The `build-dxt.sh` script:
1. Builds the project
2. Updates manifest.json with current version
3. Removes devDependencies and .ts files from node_modules
4. Creates a zip with manifest, icon, dist, node_modules, package.json, README, and LICENSE
5. Restores manifest template and full node_modules

## Project Structure

- `src/` - TypeScript source code
  - `index.ts` - Server entry point
  - `server.ts` - MCP server with dynamic tool registration
  - `xdotoolStringToKeys.ts` - Key mapping utilities
  - `core/` - Core infrastructure (DI container, IOClass interface, SequenceHandler)
  - `io/input/` - Input IO classes (keyboard, mouse)
  - `io/vision/` - Vision IO classes (screenshot)
  - `io/system/` - System IO classes (windows)
  - `actions/` - Legacy screenshot handler (used by IO classes for auto-screenshot)
  - `utils/` - Utility functions (config, validation)
  - `*.test.ts` - Unit tests
  - `e2e.test.ts` - End-to-end tests
- `dist/` - Compiled JavaScript output (gitignored)
- `manifest.json` - DXT package metadata with `{{VERSION}}` placeholder
- `build-dxt.sh` - DXT package build script
- `icon.png` - Package icon

## IO Class Architecture

The server uses a modular IO class system for extensibility:

### Adding New IO Classes
1. Create class implementing `IOClass` interface from `src/core/io-class.interface.ts`
   - Must implement `category` (readonly): 'input' | 'vision' | 'system'
   - Must implement `name` (readonly): unique identifier (e.g., 'keyboard')
   - Must implement `description` (readonly): description of capabilities
2. Implement `getTools()` to expose tool definitions as MCP Tool objects
3. Implement `handleAction()` to execute actions and return ToolResponse
4. Register in `src/server.ts` DIContainer with unique key
5. Tools automatically appear in MCP tool list (no server restart needed)

### Tool Naming Convention
Tools follow pattern: `{ioclass}_{action}` (e.g., `keyboard_press`, `mouse_click`, `screenshot_capture`)

The IOClass name becomes the prefix (e.g., KeyboardIO's name is 'keyboard', so tools are keyboard_*)

### Command Sequences
Use `sequence` tool to execute multiple commands with:
- Shared window context (apply window to all commands)
- Configurable delays between commands (in milliseconds)
- Error handling options: stop on error or continue on error
- Screenshot control: capture intermediate results or only final result

Example sequence:
```json
{
  "commands": [
    {"tool": "keyboard_press", "args": {"keys": "ctrl+a"}},
    {"tool": "keyboard_type", "args": {"text": "hello"}},
    {"tool": "mouse_click", "args": {"coordinate": [100, 100]}}
  ],
  "delay_ms": 100,
  "stop_on_error": true,
  "screenshot_mode": "final"
}
```

## Important Notes

### Available Tools
The server exposes 15 tools across 4 categories:

**Input Tools** (9):
- `keyboard_press`: Press key combinations with optional hold duration and window targeting
- `keyboard_type`: Type text strings with optional window targeting
- `mouse_move`: Move cursor to coordinates with optional window targeting
- `mouse_click`: Click with button selection (left/right/middle/double) and optional window targeting
- `mouse_drag`: Drag to coordinates with optional window targeting
- `mouse_double_click`: Double-click with optional window targeting
- `mouse_right_click`: Right-click with optional window targeting
- `mouse_middle_click`: Middle-click with optional window targeting
- `mouse_position`: Get current cursor position (no auto-screenshot)

**Vision Tools** (1):
- `screenshot_capture`: Capture screen or region, with optional window/region targeting

**System Tools** (4):
- `windows_list`: List all open windows with IDs, titles, and positions
- `windows_focus`: Focus (activate) a specific window by ID
- `windows_position`: Get or set window position and size
- `windows_info`: Get detailed information about a window

**Sequence Tools** (1):
- `sequence`: Execute multiple commands with shared context

### Common Parameters
All input commands support optional:
- `window` (string | number): Window ID to target
- `hold` (number): Duration in milliseconds to hold keys (keyboard only)

All input commands except `mouse_position` automatically return screenshots after execution.

### Build Configuration
- `tsconfig.json` extends `@tsconfig/node-lts` and `tsconfig-domdomegg`
- `tsconfig.build.json` excludes test files and outputs to `dist/` with declarations
- ES modules only (`"type": "module"` in package.json)

### Publishing
Use semantic versioning:
```bash
npm version <major|minor|patch>
git push --follow-tags
```
GitHub Actions automatically publishes to NPM on tag push.
