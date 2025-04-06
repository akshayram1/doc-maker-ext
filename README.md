# Documentation Maker Extension

A VS Code extension that automatically generates comprehensive documentation for your codebase using Gemini AI.

## Features

- **Project Structure Analysis**: Creates a summary of your project's file organization
- **File Relationship Documentation**: Maps dependencies between files, showing how modules connect
- **Individual File Documentation**: Generates detailed docs for each file including purpose, functions, and examples
- **Change-Based Updates**: Only updates documentation for files that have changed since last commit
- **AI-Powered**: Uses Google's Gemini 1.5 Pro to create intelligent, context-aware documentation

## Setup Instructions

### Installation

#### Local Development
1. Clone the repository
2. Run `npm install` to install dependencies 
3. Run `npm run compile` to compile TypeScript to JavaScript
4. Press F5 to start debugging the extension in a new VS Code window

#### From VSIX
1. Build the VSIX package with `vsce package`
2. In VS Code, go to Extensions view (Ctrl+Shift+X)
3. Click on "..." (More Actions) and select "Install from VSIX..."
4. Navigate to and select the generated .vsix file

### Initial Configuration

1. After installing, you'll be prompted to enter your Gemini API key
   - If not prompted, open Command Palette (Ctrl+Shift+P) and run: `Documentation Maker: Initial Setup`
2. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
3. Enter the API key when prompted

### Generate Documentation

1. Open a project folder in VS Code
2. Use Command Palette to run `Documentation Maker: Initial Setup`
3. The extension will:
   - Analyze your project structure
   - Create file relationship diagrams
   - Generate documentation for individual files
4. All documentation is saved to a `code-docs` folder in your project root

### Update Documentation

After making changes to your codebase:
1. Use Command Palette to run `Documentation Maker: Update Documentation`
2. Only files changed since the last commit will be updated

## Keyboard Shortcuts

- **Initial Setup**: `Ctrl+Alt+D I` (Mac: `Cmd+Alt+D I`)
- **Update Documentation**: `Ctrl+Alt+D U` (Mac: `Cmd+Alt+D U`)

## Troubleshooting

### Commands Not Found
If you can't find the extension commands:
1. Make sure you have an active workspace folder open
2. Reload VS Code window (Command Palette: `Developer: Reload Window`)
3. Check the Output panel (View > Output) and select "Documentation Maker"

### API Key Issues
1. You can manually set your API key in VS Code settings:
   - File > Preferences > Settings
   - Search for "Documentation Maker"
   - Enter your Gemini API key

### Compilation Issues
If developing the extension:
1. Make sure TypeScript is installed: `npm install -g typescript`
2. Check for errors with `npm run compile`
3. Look at the terminal output for any TypeScript errors

### Git Integration Issues
The "Update Documentation" feature requires Git:
1. Ensure Git is installed and in your PATH
2. Make sure your project is a Git repository
3. At least one commit must exist in the repository

## Requirements

- VS Code 1.60.0 or newer
- Node.js and npm (for development)
- Git (for the update documentation feature)
- Gemini API key

## Extension Settings

* `doc-maker.geminiApiKey`: Your Gemini API key for AI-powered documentation generation

## Development

This extension is written in TypeScript. To contribute:

1. Fork the repository
2. Make your changes in the `src` directory
3. Run `npm run compile` to compile TypeScript files
4. Test your changes with F5
5. Submit a pull request

### Project Structure

- `src/extension.ts`: Main extension source code
- `out/extension.js`: Compiled JavaScript (generated, don't edit)
- `package.json`: Extension manifest
- `.vscodeignore`: Files excluded from the extension package

## License

MIT

## Credits

Developed by Akshay Chame
