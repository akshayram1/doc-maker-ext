# Documentation Maker Extension

A VS Code extension that automatically generates comprehensive documentation for your codebase using Gemini AI.

## Features

- **Initial Documentation**: Generate complete documentation for your entire codebase
- **Git-Aware Updates**: Only update documentation for files that have changed in git commits
- **Powered by Gemini AI**: Uses Google's Gemini 2.5 API for high-quality documentation
- **Comprehensive Coverage**:
  - File structure overview
  - File relationship analysis
  - Detailed per-file documentation

## Setup Instructions

1. **Install the Extension**
   - If you're testing locally:
     - Run `npm install` in the extension directory
     - Press F5 to launch the extension in debug mode
   - If installed from marketplace:
     - Install from VS Code marketplace

2. **Initial Configuration**
   - After installation, you will be prompted to enter your Gemini API key
   - If not prompted automatically, open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P) and run:
     `Documentation Maker: Initial Setup`
   - You'll be asked to provide your Gemini API key (get one from [Google AI Studio](https://makersuite.google.com/app/apikey))

3. **Generate Documentation**
   - Open a project folder in VS Code
   - Open the Command Palette and run:
     `Documentation Maker: Initial Setup`
   - The extension will analyze your project and generate documentation in a `code-docs` folder

4. **Update Documentation**
   - After making changes to your codebase, run:
     `Documentation Maker: Update Documentation`
   - This will only update docs for files that have changed

## Requirements

- VS Code 1.60.0 or newer
- Git (for the update documentation feature)
- Gemini API key

## Commands

- **Documentation Maker: Initial Setup**: Generate documentation for the entire project
- **Documentation Maker: Update Documentation**: Update documentation for files changed in recent commits

## Extension Settings

* `doc-maker.geminiApiKey`: Your Gemini API key for AI-powered documentation generation

## Output Structure

The extension creates a `code-docs` folder in your project with:

```
code-docs/
├── file-structure.md          # Overview of project structure
├── file-relationships.md      # Analysis of dependencies between files
└── files/                     # Individual file documentation
    ├── path_to_file1.md
    ├── path_to_file2.md
    └── ...
```

## Troubleshooting

### Command Not Found

If you're seeing "Command Not Found" errors:

1. **Reload VS Code**
   - Sometimes VS Code needs to be reloaded after installing an extension
   - Use Command Palette to run "Developer: Reload Window"

2. **Check Extension Activation**
   - Open Output panel (View > Output)
   - Select "Documentation Maker" from the dropdown
   - Check for any errors during activation

3. **Check Commands**
   - Open Command Palette and type "Documentation Maker"
   - Both commands should appear in the list
   - If they don't appear, check the extension is properly installed

4. **Manual Function Call** (Advanced Users)
   - Open the VS Code Developer Console (Help > Toggle Developer Tools)
   - Type the following:
     ```javascript
     vscode.commands.getCommands().then(cmds => console.log(cmds.filter(c => c.includes('doc-maker'))))
     ```
   - This will show if the commands are registered

5. **Report the Issue**
   - If problems persist, please report the issue with logs from the Output panel

## Known Issues

- Large binary files are skipped
- Files over 100KB may not be documented fully
- Requires an active internet connection for Gemini API

## Release Notes

### 0.1.0

- Initial release
- Support for JavaScript, TypeScript, Python, Java, and Go files
- Basic dependency analysis
- Git integration for smart updates

---

## Privacy Notice

This extension sends code content to Gemini API for analysis. Please ensure your code does not contain sensitive information or review the documentation before sending.# doc-maker-ext
