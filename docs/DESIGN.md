# Computer Use MCP - IO Class Architecture Design

## Overview

This design transforms the MCP server from a monolithic tool with a single `computer` tool into a modular, extensible system with multiple specialized tools organized by IO categories. The architecture uses dependency injection for loose coupling and supports dynamic tool registration and batch command execution.

## Goals

1. **Modularity**: Each IO class handles a specific domain (keyboard, mouse, screenshot, etc.)
2. **Extensibility**: New IO classes can be added without modifying core server code
3. **Discoverability**: Claude can discover available tools dynamically
4. **Batch Operations**: Execute multiple commands in a single request for efficiency
5. **Type Safety**: Strong TypeScript typing throughout
6. **Testability**: Each IO class can be tested independently

## Architecture

### IO Class Categories

Tools are organized into logical categories:

#### Input Category
- **keyboard** - Keyboard input operations
  - `keyboard_press` - Press key combinations (supports hold duration)
  - `keyboard_type` - Type text strings
  - Common params: `window` (optional window ID), `hold` (optional duration in ms)

- **mouse** - Mouse/cursor operations
  - `mouse_move` - Move cursor to coordinates
  - `mouse_click` - Click (left/right/middle/double)
  - `mouse_drag` - Click and drag
  - `mouse_position` - Get cursor position
  - Common params: `window` (optional window ID)

- **gamepad** - Xbox controller emulation (future)
  - `gamepad_button` - Press buttons (A, B, X, Y, LB, RB, Start, Back, Xbox, L3, R3)
  - `gamepad_trigger` - Press triggers (LT, RT with pressure 0-255)
  - `gamepad_stick` - Move analog sticks (left/right stick with X/Y axes -32768 to 32767)
  - `gamepad_dpad` - Press D-pad directions (up, down, left, right)
  - `gamepad_reset` - Reset controller to neutral state (all sticks centered, no buttons pressed)
  - Common params: `window` (optional window ID), `hold` (optional duration in ms)

#### Vision Category
- **screenshot** - Screen capture operations
  - `screenshot_capture` - Capture full screen, region, or specific window
  - `screenshot_find` - Find image on screen (template matching)
  - Common params: `window` (optional window ID), `region` (optional x,y,w,h)

- **windows** - Window management (future)
  - `windows_list` - List open windows with IDs, titles, positions
  - `windows_focus` - Focus a specific window by ID
  - `windows_position` - Get/set window position and size
  - `windows_info` - Get detailed window info (process, title, bounds)

#### System Category
- **clipboard** - Clipboard operations (future)
  - `clipboard_copy` - Copy to clipboard
  - `clipboard_paste` - Paste from clipboard
  - `clipboard_read` - Read clipboard content

### Dependency Injection Pattern

Using a simple DI container to manage IO class instances:

```typescript
interface DIContainer {
  register<T>(key: string, instance: T): void;
  resolve<T>(key: string): T;
  getAll(): Map<string, unknown>;
}
```

### Base IO Class Interface

All IO classes implement a common interface:

```typescript
interface IOClass {
  // Metadata
  readonly category: 'input' | 'vision' | 'system';
  readonly name: string;
  readonly description: string;

  // Tool registration
  getTools(): Tool[];

  // Action handling
  handleAction(action: string, params: Record<string, unknown>): Promise<ToolResponse>;
}
```

### Tool Registration Flow

```
Server Startup
    ↓
1. Create DI Container
    ↓
2. Instantiate IO Classes
    ↓
3. Register IO Classes in Container
    ↓
4. Collect Tools from All IO Classes
    ↓
5. Register Tools with MCP Server
    ↓
6. Server Ready
```

### Dynamic Tool Discovery

```typescript
// In server.ts
const container = new DIContainer();

// Register IO classes
container.register('keyboard', new KeyboardIO());
container.register('mouse', new MouseIO());
container.register('screenshot', new ScreenshotIO());
// ... more IO classes

// Collect all tools dynamically
const tools: Tool[] = [];
for (const [name, ioClass] of container.getAll()) {
  if (isIOClass(ioClass)) {
    tools.push(...ioClass.getTools());
  }
}

// Register with MCP
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
```

## Common Parameters

All input commands support these optional parameters:

### Window Targeting
```typescript
window?: string | number;  // Window ID from windows_list, or undefined for desktop
```
When specified, the command targets a specific window. When omitted, commands operate on the currently focused window or desktop.

**Note**: The desktop itself may not have a window ID (OS-dependent). Commands without a `window` parameter will interact with whatever currently has focus.

### Hold Duration
```typescript
hold?: number;  // Duration in milliseconds
```
For keyboard/gamepad: How long to hold the key/button before releasing.

**Examples**:
- `keyboard_press(keys="space", hold=500)` - Hold spacebar for 500ms
- `gamepad_button(button="A", hold=1000)` - Hold A button for 1 second
- `gamepad_stick(stick="left", x=32767, hold=2000)` - Hold stick right for 2 seconds

### Auto-Screenshot on Success

**All input commands automatically return a screenshot upon successful execution.**

This provides immediate visual feedback for the next decision without requiring a separate screenshot command.

- When `window` is specified: Returns screenshot of that window
- When `window` is omitted: Returns screenshot of focused area or full screen

```typescript
// Response format for input commands
{
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        action: 'keyboard_press',
        keys: 'space',
        window: 'window-123',  // or null if targeting desktop/focused window
        success: true,
        duration_ms: 42
      })
    },
    {
      type: 'image',
      data: '<base64-encoded-screenshot>',
      mimeType: 'image/png'
    }
  ]
}
```

## Command Grouping System

### Sequential Execution (Default)

Use the `sequence` tool to execute commands one after another with shared context:

```typescript
{
  name: 'sequence',
  description: 'Execute multiple commands in order with shared context',
  inputSchema: {
    type: 'object',
    properties: {
      window: {
        type: 'string',
        description: 'Window ID to target for all commands (can be overridden per command, omit for desktop/focused window)'
      },
      commands: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tool: { type: 'string' },
            action: { type: 'string' },
            params: { type: 'object' },
            captureResult: {
              type: 'boolean',
              default: false,
              description: 'Capture screenshot for this command (overrides auto-screenshot)'
            }
          },
          required: ['tool', 'action']
        }
      },
      captureIntermediate: {
        type: 'boolean',
        default: false,
        description: 'Capture screenshots for intermediate steps (default: only final step)'
      },
      stopOnError: {
        type: 'boolean',
        default: true,
        description: 'Stop execution if any command fails'
      },
      delayBetween: {
        type: 'number',
        default: 0,
        description: 'Delay in ms between commands'
      }
    },
    required: ['commands']
  }
}
```

### Sequence Example: Launch Game and Play

```json
{
  "tool": "sequence",
  "captureIntermediate": false,
  "delayBetween": 100,
  "commands": [
    {
      "tool": "keyboard",
      "action": "keyboard_press",
      "params": { "keys": "cmd+space" }
    },
    {
      "tool": "keyboard",
      "action": "keyboard_type",
      "params": { "text": "MyGame" }
    },
    {
      "tool": "keyboard",
      "action": "keyboard_press",
      "params": { "keys": "return" }
    },
    {
      "tool": "gamepad",
      "action": "gamepad_button",
      "params": { "button": "A" }
    },
    {
      "tool": "gamepad",
      "action": "gamepad_stick",
      "params": { "stick": "left", "x": 32767, "hold": 1000 }
    }
  ]
}
```

**Response**: Returns only final screenshot (after stick movement) unless `captureIntermediate: true`.

### Parallel Execution (Future)

Use the `parallel` tool to execute independent commands simultaneously:

```typescript
{
  name: 'parallel',
  description: 'Execute multiple commands simultaneously',
  inputSchema: {
    type: 'object',
    properties: {
      commands: {
        type: 'array',
        description: 'Commands to execute in parallel (must be independent)'
      },
      timeout: {
        type: 'number',
        description: 'Maximum time to wait for all commands (ms)'
      }
    }
  }
}
```

### Conditional Execution (Future)

Use the `conditional` tool to execute commands based on conditions:

```typescript
{
  name: 'conditional',
  description: 'Execute commands based on screen conditions',
  inputSchema: {
    type: 'object',
    properties: {
      condition: {
        type: 'object',
        properties: {
          type: { enum: ['image_present', 'image_absent', 'window_exists'] },
          params: { type: 'object' }
        }
      },
      onTrue: { type: 'array', description: 'Commands if condition is true' },
      onFalse: { type: 'array', description: 'Commands if condition is false' }
    }
  }
}
```

## File Structure

```
src/
├── core/
│   ├── di-container.ts              # DI container implementation
│   ├── io-class.interface.ts        # IOClass interface definition
│   └── batch-handler.ts             # Batch command handler
├── io/
│   ├── input/
│   │   ├── keyboard-io.ts           # KeyboardIO class
│   │   ├── mouse-io.ts              # MouseIO class
│   │   └── gamepad-io.ts            # GamepadIO class (future)
│   ├── vision/
│   │   ├── screenshot-io.ts         # ScreenshotIO class
│   │   └── windows-io.ts            # WindowsIO class (future)
│   └── system/
│       └── clipboard-io.ts          # ClipboardIO class (future)
├── actions/                         # Legacy - to be migrated
│   ├── keyboard.ts
│   ├── mouse.ts
│   └── screenshot.ts
├── schemas/
│   ├── tool-schema.ts               # Remove - replaced by IO classes
│   └── types.ts                     # Shared types
├── utils/
│   ├── config.ts
│   └── coordinate-validator.ts
├── server.ts                        # Refactored to use DI + dynamic registration
├── index.ts
└── xdotoolStringToKeys.ts
```

## Implementation Phases

### Phase 1: Core Infrastructure
**Goal**: Set up DI container and base interfaces

**Tasks**:
- [ ] Create `core/di-container.ts` with registration/resolution
- [ ] Create `core/io-class.interface.ts` with IOClass interface
- [ ] Create shared types and response formats
- [ ] Write tests for DI container

**Success Criteria**: DI container can register and resolve instances

### Phase 2: Migrate Existing Actions to IO Classes
**Goal**: Convert keyboard, mouse, screenshot to IO classes

**Tasks**:
- [ ] Create `io/input/keyboard-io.ts` from `actions/keyboard.ts`
- [ ] Create `io/input/mouse-io.ts` from `actions/mouse.ts`
- [ ] Create `io/vision/screenshot-io.ts` from `actions/screenshot.ts`
- [ ] Each IO class implements `getTools()` and `handleAction()`
- [ ] Write tests for each IO class

**Success Criteria**: All existing functionality works through IO classes

### Phase 3: Dynamic Tool Registration
**Goal**: Server dynamically discovers and registers tools

**Tasks**:
- [ ] Refactor `server.ts` to use DI container
- [ ] Implement dynamic tool collection from IO classes
- [ ] Update `ListToolsRequestSchema` handler
- [ ] Update `CallToolRequestSchema` handler to route to IO classes
- [ ] Remove old static tool definitions

**Success Criteria**: Server exposes multiple tools dynamically

### Phase 4: Batch Command System
**Goal**: Support executing multiple commands in one request

**Tasks**:
- [ ] Create `core/batch-handler.ts`
- [ ] Implement batch tool schema
- [ ] Implement sequential execution with error handling
- [ ] Support `stopOnError` flag
- [ ] Aggregate results into single response
- [ ] Write tests for batch execution

**Success Criteria**: Can execute multi-step operations in single request

### Phase 5: New IO Classes
**Goal**: Add new capabilities (windows, gamepad, clipboard)

**Tasks**:
- [ ] Implement `io/vision/windows-io.ts` (window management)
- [ ] Implement `io/input/gamepad-io.ts` (game controller support)
- [ ] Implement `io/system/clipboard-io.ts` (clipboard operations)
- [ ] Add OS-specific implementations where needed
- [ ] Write tests for new IO classes

**Success Criteria**: New tools available and working

### Phase 6: Enhanced Features
**Goal**: Add advanced capabilities to existing IO classes

**Tasks**:
- [ ] Screenshot: Region capture, multi-monitor support
- [ ] Screenshot: Image template matching (find UI elements)
- [ ] Mouse: Scroll support (horizontal/vertical)
- [ ] Keyboard: Key hold/release (separate from press)
- [ ] All: Better error messages with recovery hints

**Success Criteria**: Enhanced functionality available

## Example IO Class Implementation

### KeyboardIO Class

```typescript
import { IOClass, Tool, ToolResponse } from '../core/io-class.interface.js';
import { keyboard } from '@nut-tree-fork/nut-js';
import { toKeys } from '../xdotoolStringToKeys.js';

export class KeyboardIO implements IOClass {
  readonly category = 'input' as const;
  readonly name = 'keyboard';
  readonly description = 'Keyboard input operations';

  getTools(): Tool[] {
    return [
      {
        name: 'keyboard_press',
        description: 'Press a key or key combination (e.g., "ctrl+c", "return")',
        inputSchema: {
          type: 'object',
          properties: {
            keys: {
              type: 'string',
              description: 'Key combination to press (e.g., "ctrl+c", "alt+tab")'
            }
          },
          required: ['keys']
        }
      },
      {
        name: 'keyboard_type',
        description: 'Type a text string',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to type'
            }
          },
          required: ['text']
        }
      }
    ];
  }

  async handleAction(action: string, params: Record<string, unknown>): Promise<ToolResponse> {
    switch (action) {
      case 'keyboard_press':
        return this.handlePress(params.keys as string);
      case 'keyboard_type':
        return this.handleType(params.text as string);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async handlePress(keys: string): Promise<ToolResponse> {
    const keyArray = toKeys(keys);
    await keyboard.pressKey(...keyArray);
    await keyboard.releaseKey(...keyArray);
    return {
      content: [{ type: 'text', text: `Pressed: ${keys}` }]
    };
  }

  private async handleType(text: string): Promise<ToolResponse> {
    await keyboard.type(text);
    return {
      content: [{ type: 'text', text: `Typed: ${text}` }]
    };
  }
}
```

## Benefits

### For Users (Claude)
- **Better discoverability**: Multiple specific tools instead of one giant tool
- **Clearer intent**: Tool names indicate purpose (keyboard_press vs computer with action="key")
- **Batch operations**: Reduce round-trips for multi-step tasks
- **Better errors**: Tool-specific error messages

### For Developers
- **Separation of concerns**: Each IO class owns its domain
- **Easy to extend**: Add new IO class without touching existing code
- **Testability**: Test each IO class in isolation
- **Type safety**: Strong typing throughout
- **No breaking changes**: Can support legacy `computer` tool during migration

## Migration Strategy

### Backward Compatibility

During migration, support both old and new tool formats:

1. **Phase 1-3**: Keep existing `computer` tool alongside new tools
2. **Phase 4+**: Mark `computer` tool as deprecated in description
3. **Future**: Remove `computer` tool after grace period

### Tool Name Mapping

```
Old: computer(action="key", text="ctrl+c")
New: keyboard_press(keys="ctrl+c")

Old: computer(action="type", text="hello")
New: keyboard_type(text="hello")

Old: computer(action="left_click", coordinate=[100, 200])
New: mouse_click(button="left", coordinate=[100, 200])

Old: computer(action="get_screenshot")
New: screenshot_capture()
```

## Testing Strategy

### Unit Tests
- Test each IO class independently
- Mock nut.js dependencies
- Test error handling

### Integration Tests
- Test DI container registration
- Test dynamic tool discovery
- Test tool routing to correct IO class

### E2E Tests
- Test batch command execution
- Test multi-tool workflows
- Test error propagation

## Future Enhancements

1. **Plugin System**: Load IO classes from external modules
2. **Permissions**: Fine-grained control over which tools are available
3. **Rate Limiting**: Prevent abuse of certain operations
4. **Telemetry**: Track usage patterns per IO class
5. **Configuration**: Per-tool configuration (e.g., mouse speed per tool)
6. **Macros**: Define reusable command sequences
7. **Conditional Execution**: Batch commands with if/else logic

## Xbox Controller Specification

The gamepad IO class emulates a standard Xbox controller (Xbox One/Series X layout):

### Controller Layout

```
        LB                                    RB
        LT (analog)                    RT (analog)

    [Back]  [Xbox]  [Start]

    D-Pad           (Y)
      ↑           (X) (B)
    ← + →           (A)
      ↓

   [L-Stick]                        [R-Stick]
   (clickable)                      (clickable)
```

### Button Mapping

**Face Buttons**: A, B, X, Y
**Shoulder Buttons**: LB (Left Bumper), RB (Right Bumper)
**Triggers**: LT (Left Trigger), RT (Right Trigger) - Analog 0-255
**D-Pad**: Up, Down, Left, Right
**Stick Clicks**: L3 (Left Stick Click), R3 (Right Stick Click)
**System**: Start, Back/Select, Xbox (Home)

### Analog Ranges

**Sticks**: X and Y axes from -32768 (full left/down) to 32767 (full right/up)
**Triggers**: Pressure from 0 (not pressed) to 255 (fully pressed)

### Example Usage

```json
// Press A button
{
  "tool": "gamepad",
  "action": "gamepad_button",
  "params": { "button": "A", "duration": 100 }
}

// Move left stick right and slightly up
{
  "tool": "gamepad",
  "action": "gamepad_stick",
  "params": { "stick": "left", "x": 20000, "y": 5000 }
}

// Press right trigger halfway
{
  "tool": "gamepad",
  "action": "gamepad_trigger",
  "params": { "trigger": "RT", "pressure": 128 }
}

// Press D-pad up
{
  "tool": "gamepad",
  "action": "gamepad_dpad",
  "params": { "direction": "up" }
}

// Batch: Jump and move (common game action)
{
  "tool": "batch",
  "commands": [
    {"tool": "gamepad", "action": "gamepad_button", "params": {"button": "A"}},
    {"tool": "gamepad", "action": "gamepad_stick", "params": {"stick": "left", "x": 32767, "y": 0}}
  ]
}
```

### Implementation Notes

**Virtual Controller Driver**: Will require platform-specific virtual gamepad drivers:
- **Windows**: ViGEm (Virtual Gamepad Emulation Framework)
- **macOS**: May require custom driver or USB/IP solution
- **Linux**: uinput kernel module

**State Management**: Gamepad state must persist between commands (stick positions, held buttons) unlike keyboard where keys are typically press-and-release.

## Design Decisions Made

1. ✅ **Command grouping**: Use `sequence` tool for sequential execution with shared window context
2. ✅ **Auto-screenshot**: All input commands return screenshot on success (can be suppressed in sequences)
3. ✅ **Hold duration**: `hold` parameter in ms for keyboard/gamepad to hold keys/buttons
4. ✅ **Window targeting**: `window` parameter on all commands to target specific windows
5. ✅ **Intermediate results**: `captureIntermediate` flag in sequences to control screenshot frequency
6. ✅ **Gamepad state**: State persists until changed + `gamepad_reset` action for neutral state
7. ✅ **Gamepad reset**: Added explicit `gamepad_reset` action

## Questions to Resolve

1. Should we support command rollback on error (undo previous commands)?
2. How should we handle tool versioning (keyboard_v1 vs keyboard_v2)?
3. Should IO classes be singletons or instantiated per request?
4. Do we need rate limiting per tool or globally?
5. **Window focus**: Should we auto-focus windows before sending input, or require explicit focus command?
6. **Screenshot size**: When returning screenshots with input commands, use same size limits as screenshot_capture?
7. **Hold vs Press**: Should `hold=0` be equivalent to instant press/release, or require explicit different action?

## Success Metrics

- [ ] All existing functionality migrated to IO classes
- [ ] Server exposes 5+ distinct tools (keyboard, mouse, screenshot, batch, windows)
- [ ] Batch commands reduce average operation count by 30%
- [ ] New IO class can be added in < 100 lines of code
- [ ] All tests passing with >80% coverage
- [ ] Zero breaking changes to existing tool usage
