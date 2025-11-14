# computer-use-mcp

💻 An model context protocol server for Claude to control your computer. This is very similar to [computer use](https://docs.anthropic.com/en/docs/build-with-claude/computer-use), but easy to set up and use locally.

<!-- TODO: demo video -->

To get best results:
- Install and enable the [Rango browser extension](https://chromewebstore.google.com/detail/rango/lnemjdnjjofijemhdogofbpcedhgcpmb). This enables keyboard navigation for websites, which is far more reliable than Claude trying to click coordinates.
- On high resolution displays, consider zooming in to active windows. You can also bump up the font size setting in Rango to make the text more visible.

> [!WARNING]
> At time of writing, models make frequent mistakes and are vulnerable to prompt injections. As this MCP server gives the model complete control of your computer, this could do a lot of damage. You should therefore treat this like giving a hyperactive toddler access to your computer - you probably want to supervise it closely, and consider only doing this in a sandboxed user account.

## How it works

We implement a near identical computer use tool to [Anthropic's official computer use guide](https://docs.anthropic.com/en/docs/build-with-claude/computer-use), with some more nudging to prefer keyboard shortcuts.

This talks to your computer using [nut.js](https://github.com/nut-tree/nut.js).

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
