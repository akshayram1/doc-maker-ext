"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const axios_1 = __importDefault(require("axios"));
let geminiApiKey = '';
let outputChannel;
/**
 * This method is called when your extension is activated
 * @param context - The extension context
 */
function activate(context) {
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel("Documentation Maker");
    outputChannel.show(true); // Show the output channel immediately for debugging
    outputChannel.appendLine('Documentation Maker activation started...');
    console.log('Documentation Maker activation started...');
    try {
        // Register commands with proper error handling
        const initialSetupCommand = vscode.commands.registerCommand('doc-maker.initialSetup', () => {
            outputChannel.appendLine('Initial setup command triggered');
            return initialSetup();
        });
        const updateDocsCommand = vscode.commands.registerCommand('doc-maker.updateDocs', () => {
            outputChannel.appendLine('Update docs command triggered');
            return updateDocumentation();
        });
        context.subscriptions.push(initialSetupCommand, updateDocsCommand);
        outputChannel.appendLine('Commands registered successfully:');
        outputChannel.appendLine('- doc-maker.initialSetup');
        outputChannel.appendLine('- doc-maker.updateDocs');
        // Check for API key on startup
        checkApiKey();
        // Show welcome message and setup instructions
        showWelcomeMessage();
        outputChannel.appendLine('Documentation Maker activation completed successfully!');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`ERROR during activation: ${errorMessage}`);
        console.error('Documentation Maker activation error:', error);
        vscode.window.showErrorMessage(`Documentation Maker failed to activate: ${errorMessage}`);
    }
}
function showWelcomeMessage() {
    outputChannel.appendLine('Showing welcome message...');
    vscode.window.showInformationMessage('Documentation Maker is active! Run "Documentation Maker: Initial Setup" to begin.', 'Setup Now', 'Read Docs').then(selection => {
        if (selection === 'Setup Now') {
            outputChannel.appendLine('User selected "Setup Now" - executing initialSetup command');
            // Use direct function call instead of executeCommand for reliability
            initialSetup().catch((err) => {
                outputChannel.appendLine(`Error during setup: ${err.message}`);
            });
        }
        else if (selection === 'Read Docs') {
            // If a README.md exists, open it
            const extensionPath = vscode.extensions.getExtension('akshaychame.documentation-maker')?.extensionPath;
            if (extensionPath) {
                const readmePath = path.join(extensionPath, 'README.md');
                if (fs.existsSync(readmePath)) {
                    vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(readmePath));
                }
            }
        }
    }).then(undefined, (err) => {
        outputChannel.appendLine(`Error showing welcome message: ${err.message}`);
    });
}
async function checkApiKey() {
    geminiApiKey = vscode.workspace.getConfiguration('doc-maker').get('geminiApiKey') || '';
    if (!geminiApiKey) {
        const key = await vscode.window.showInputBox({
            placeHolder: 'Enter your Gemini API Key',
            prompt: 'Gemini API Key is required for documentation generation'
        });
        if (key) {
            await vscode.workspace.getConfiguration('doc-maker').update('geminiApiKey', key, true);
            geminiApiKey = key;
            vscode.window.showInformationMessage('Gemini API Key saved!');
        }
    }
    // Log API key status (not the key itself)
    if (geminiApiKey) {
        outputChannel.appendLine('Gemini API Key is configured.');
    }
    else {
        outputChannel.appendLine('Gemini API Key is not configured.');
    }
}
async function initialSetup() {
    outputChannel.appendLine('Starting initial setup process...');
    if (!geminiApiKey) {
        outputChannel.appendLine('No API key found. Prompting user for input.');
        vscode.window.showErrorMessage('Please set up your Gemini API Key first');
        await checkApiKey();
        if (!geminiApiKey) {
            outputChannel.appendLine('API key setup failed or was cancelled by user.');
            return;
        }
    }
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        outputChannel.appendLine('Error: No workspace folder open');
        vscode.window.showErrorMessage('No workspace folder open. Please open a project folder first.');
        return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    const docsFolder = path.join(rootPath, 'code-docs');
    // Create docs directory if it doesn't exist
    if (!fs.existsSync(docsFolder)) {
        fs.mkdirSync(docsFolder);
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating documentation",
        cancellable: true
    }, async (progress, token) => {
        progress.report({ increment: 0, message: "Analyzing project structure..." });
        // Generate file structure document
        await generateFileStructure(rootPath, docsFolder);
        progress.report({ increment: 30, message: "Creating file relationships..." });
        // Generate file relationships
        await generateFileRelationships(rootPath, docsFolder);
        progress.report({ increment: 60, message: "Documenting individual files..." });
        // Generate individual file documentation
        await generateIndividualDocs(rootPath, docsFolder);
        progress.report({ increment: 100, message: "Documentation complete!" });
        vscode.window.showInformationMessage('Documentation generated successfully!');
    });
}
async function updateDocumentation() {
    outputChannel.appendLine('Starting documentation update process...');
    if (!geminiApiKey) {
        outputChannel.appendLine('No API key found. Prompting user for input.');
        vscode.window.showErrorMessage('Please set up your Gemini API Key first');
        await checkApiKey();
        if (!geminiApiKey) {
            outputChannel.appendLine('API key setup failed or was cancelled by user.');
            return;
        }
    }
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        outputChannel.appendLine('Error: No workspace folder open');
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    const docsFolder = path.join(rootPath, 'code-docs');
    // Check if docs folder exists
    if (!fs.existsSync(docsFolder)) {
        outputChannel.appendLine('Documentation folder not found. Initial setup required.');
        vscode.window.showErrorMessage('Documentation folder not found. Please run initial setup first.');
        return;
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Updating documentation",
        cancellable: true
    }, async (progress, token) => {
        progress.report({ increment: 0, message: "Getting changed files..." });
        // Get changed files since last commit
        const changedFiles = await getChangedFiles(rootPath);
        if (changedFiles.length === 0) {
            outputChannel.appendLine('No files changed since last documentation update.');
            vscode.window.showInformationMessage('No files changed since last documentation update.');
            return;
        }
        progress.report({ increment: 40, message: `Updating docs for ${changedFiles.length} files...` });
        // Update documentation for changed files
        await updateFileDocs(rootPath, docsFolder, changedFiles);
        // Update file structure and relationships if needed
        if (changedFiles.some(file => file.includes('/'))) {
            progress.report({ increment: 70, message: "Updating project structure..." });
            await generateFileStructure(rootPath, docsFolder);
            await generateFileRelationships(rootPath, docsFolder);
        }
        progress.report({ increment: 100, message: "Documentation updated!" });
        outputChannel.appendLine('Documentation updated successfully!');
        vscode.window.showInformationMessage('Documentation updated successfully!');
    });
}
async function getChangedFiles(rootPath) {
    return new Promise((resolve) => {
        (0, child_process_1.exec)('git diff --name-only HEAD HEAD~1', { cwd: rootPath }, (error, stdout, stderr) => {
            if (error) {
                outputChannel.appendLine(`Error getting changed files: ${error.message}`);
                vscode.window.showErrorMessage(`Error getting changed files: ${error.message}`);
                resolve([]);
                return;
            }
            const files = stdout.split('\n')
                .filter(file => file.trim() !== '')
                .filter(file => !file.includes('node_modules/') &&
                !file.includes('venv/') &&
                !file.includes('.env'));
            resolve(files);
        });
    });
}
async function generateFileStructure(rootPath, docsFolder) {
    return new Promise((resolve) => {
        (0, child_process_1.exec)('find . -type f -not -path "*/\\.*" -not -path "*/node_modules/*" -not -path "*/venv/*" | sort', { cwd: rootPath }, async (error, stdout, stderr) => {
            if (error) {
                outputChannel.appendLine(`Error generating file structure: ${error.message}`);
                vscode.window.showErrorMessage(`Error generating file structure: ${error.message}`);
                resolve();
                return;
            }
            const fileList = stdout.split('\n').filter(file => file.trim() !== '');
            const fileStructure = fileList.join('\n');
            // Generate documentation with Gemini
            const prompt = `Create a comprehensive file structure documentation from this list of files in the project. Organize it logically, explain the purpose of main directories, and highlight important files:\n\n${fileStructure}`;
            try {
                const documentation = await generateWithGemini(prompt);
                fs.writeFileSync(path.join(docsFolder, 'file-structure.md'), documentation);
                resolve();
            }
            catch (err) {
                outputChannel.appendLine(`Error with Gemini API: ${err instanceof Error ? err.message : String(err)}`);
                vscode.window.showErrorMessage(`Error with Gemini API: ${err instanceof Error ? err.message : String(err)}`);
                resolve();
            }
        });
    });
}
async function generateFileRelationships(rootPath, docsFolder) {
    // For a real extension, you might want to use a code analysis tool
    // This is a simplified version that uses file imports as relationships
    return new Promise((resolve) => {
        (0, child_process_1.exec)('find . -type f -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" -o -name "*.go" | xargs grep -l "import\\|require\\|from" 2>/dev/null', { cwd: rootPath }, async (error, stdout, stderr) => {
            let fileRelations = "# File Relationships\n\n";
            if (!error) {
                const files = stdout.split('\n').filter(file => file.trim() !== '');
                for (const file of files) {
                    if (file.includes('node_modules/') || file.includes('venv/'))
                        continue;
                    try {
                        const content = fs.readFileSync(path.join(rootPath, file), 'utf8');
                        fileRelations += `## ${file}\n\n`;
                        // Simple regex to find imports (this is just an example)
                        const importRegex = /import\s+.*?from\s+['"](.+?)['"]|require\s*\(\s*['"](.+?)['"]\s*\)|from\s+(\S+)\s+import/g;
                        let match;
                        const imports = [];
                        while ((match = importRegex.exec(content)) !== null) {
                            const importPath = match[1] || match[2] || match[3];
                            if (importPath && !importPath.startsWith('.')) {
                                imports.push(importPath);
                            }
                        }
                        if (imports.length > 0) {
                            fileRelations += "Dependencies:\n";
                            imports.forEach(imp => {
                                fileRelations += `- ${imp}\n`;
                            });
                        }
                        fileRelations += "\n";
                    }
                    catch (err) {
                        // Skip file if can't read
                    }
                }
            }
            // Generate comprehensive documentation with Gemini
            const prompt = `Analyze these file relationships and create a comprehensive documentation that explains the architecture and dependencies between files:\n\n${fileRelations}`;
            try {
                const documentation = await generateWithGemini(prompt);
                fs.writeFileSync(path.join(docsFolder, 'file-relationships.md'), documentation);
                resolve();
            }
            catch (err) {
                outputChannel.appendLine(`Error with Gemini API: ${err instanceof Error ? err.message : String(err)}`);
                vscode.window.showErrorMessage(`Error with Gemini API: ${err instanceof Error ? err.message : String(err)}`);
                fs.writeFileSync(path.join(docsFolder, 'file-relationships.md'), fileRelations);
                resolve();
            }
        });
    });
}
async function generateIndividualDocs(rootPath, docsFolder) {
    return new Promise((resolve) => {
        (0, child_process_1.exec)('find . -type f -not -path "*/\\.*" -not -path "*/node_modules/*" -not -path "*/venv/*" -not -path "*/code-docs/*" | sort', { cwd: rootPath }, async (error, stdout, stderr) => {
            if (error) {
                outputChannel.appendLine(`Error finding files: ${error.message}`);
                vscode.window.showErrorMessage(`Error finding files: ${error.message}`);
                resolve();
                return;
            }
            const files = stdout.split('\n').filter(file => file.trim() !== '');
            const individualDocsFolder = path.join(docsFolder, 'files');
            if (!fs.existsSync(individualDocsFolder)) {
                fs.mkdirSync(individualDocsFolder);
            }
            // Process files in batches to avoid overloading
            const batchSize = 5;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                await Promise.all(batch.map(file => documentSingleFile(rootPath, individualDocsFolder, file)));
            }
            resolve();
        });
    });
}
async function updateFileDocs(rootPath, docsFolder, changedFiles) {
    const individualDocsFolder = path.join(docsFolder, 'files');
    if (!fs.existsSync(individualDocsFolder)) {
        fs.mkdirSync(individualDocsFolder);
    }
    // Process files in batches
    const batchSize = 5;
    for (let i = 0; i < changedFiles.length; i += batchSize) {
        const batch = changedFiles.slice(i, i + batchSize);
        await Promise.all(batch.map(file => documentSingleFile(rootPath, individualDocsFolder, file)));
    }
}
async function documentSingleFile(rootPath, docsFolder, filePath) {
    // Skip binary files, large files, etc.
    try {
        // Create directory structure if needed
        const fileDocPath = path.join(docsFolder, `${filePath.replace(/\//g, '_')}.md`);
        const fileDir = path.dirname(fileDocPath);
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }
        const fullPath = path.join(rootPath, filePath);
        const stats = fs.statSync(fullPath);
        // Skip files that are too large
        if (stats.size > 100000) { // Skip files larger than ~100KB
            fs.writeFileSync(fileDocPath, `# ${filePath}\n\nFile too large for documentation.`);
            return;
        }
        // Read file content
        const content = fs.readFileSync(fullPath, 'utf8');
        // Generate documentation with Gemini
        const prompt = `Document this code file. Provide a comprehensive breakdown including:
1. File purpose
2. Key functions/classes and their purpose
3. Important variables
4. Overall architecture
5. Usage examples (if applicable)
6. Dependencies
7. Any notable algorithms or patterns used

File: ${filePath}

Content:
\`\`\`
${content}
\`\`\``;
        try {
            const documentation = await generateWithGemini(prompt);
            fs.writeFileSync(fileDocPath, `# ${filePath}\n\n${documentation}`);
        }
        catch (err) {
            outputChannel.appendLine(`Error generating documentation for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
            fs.writeFileSync(fileDocPath, `# ${filePath}\n\nError generating documentation: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    catch (err) {
        outputChannel.appendLine(`Error processing file ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
        // Skip file if can't read
    }
}
async function generateWithGemini(prompt) {
    try {
        outputChannel.appendLine('Calling Gemini API...');
        const response = await axios_1.default.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent', {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 8192
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiApiKey
            }
        });
        if (response.data && response.data.candidates && response.data.candidates[0].content) {
            outputChannel.appendLine('Gemini API call successful');
            return response.data.candidates[0].content.parts[0].text;
        }
        else {
            outputChannel.appendLine('Invalid response format from Gemini API: ' + JSON.stringify(response.data));
            throw new Error('Invalid response format from Gemini API');
        }
    }
    catch (error) {
        outputChannel.appendLine(`Gemini API Error: ${error.message}`);
        if (error.response) {
            outputChannel.appendLine(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`Gemini API Error: ${error.message}`);
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map