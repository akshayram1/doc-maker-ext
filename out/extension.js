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
                !file.includes('.env') &&
                !file.includes('docker/') &&
                !/Dockerfile$|docker-compose\.ya?ml$|\.dockerfile$/i.test(file));
            resolve(files);
        });
    });
}
async function generateFileStructure(rootPath, docsFolder) {
    try {
        outputChannel.appendLine('Generating file structure documentation using Node.js fs...');
        // Use a recursive function to build file list instead of shell commands
        const fileList = [];
        await walkDir(rootPath, fileList, rootPath, [
            'node_modules', 'venv', '.git', 'dist', 'out', 'code-docs'
        ]);
        // Create a project manifest to provide better context
        const projectManifest = {
            rootPath: rootPath,
            packageJson: await getPackageJson(rootPath),
            fileCount: fileList.length,
            timestamp: new Date().toISOString()
        };
        // Enhanced prompt with project context
        const prompt = `Create a comprehensive file structure documentation from this list of files in the project.
Organize it logically, explain the purpose of main directories, and highlight important files.
Project context: ${JSON.stringify(projectManifest)}
File list:
${fileList.join('\n')}`;
        try {
            const documentation = await generateWithGemini(prompt);
            fs.writeFileSync(path.join(docsFolder, 'file-structure.md'), documentation);
            // Save the manifest for future reference
            fs.writeFileSync(path.join(docsFolder, 'project-manifest.json'), JSON.stringify(projectManifest, null, 2));
            outputChannel.appendLine('File structure documentation generated successfully');
        }
        catch (err) {
            outputChannel.appendLine(`Error with Gemini API: ${err instanceof Error ? err.message : String(err)}`);
            vscode.window.showErrorMessage(`Error with Gemini API: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    catch (error) {
        outputChannel.appendLine(`Error generating file structure: ${error instanceof Error ? error.message : String(error)}`);
        vscode.window.showErrorMessage(`Error generating file structure: ${error instanceof Error ? error.message : String(error)}`);
    }
    return Promise.resolve();
}
// Helper function for recursively walking directories
async function walkDir(dir, fileList, rootPath, ignoreDirs) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/'); // Normalize path separators
        if (entry.isDirectory()) {
            // Skip directories in the ignore list
            if (ignoreDirs.includes(entry.name) || entry.name.startsWith('.')) {
                continue;
            }
            await walkDir(fullPath, fileList, rootPath, ignoreDirs);
        }
        else {
            // Skip Docker files
            if (entry.name === 'Dockerfile' ||
                entry.name === 'docker-compose.yml' ||
                entry.name === 'docker-compose.yaml' ||
                entry.name.endsWith('.dockerfile')) {
                continue;
            }
            // Add the file to our list
            fileList.push(relativePath);
            try {
                // @ts-ignore: Keeping for future file size features
                const stats = fs.statSync(fullPath);
                // Optionally add file size info
                // fileList[fileList.length - 1] += ` (${formatFileSize(stats.size)})`;
            }
            catch (err) {
                // If stat fails, just use the filename
            }
        }
    }
}
// @ts-ignore: Keeping for future file size features
function formatFileSize(bytes) {
    if (bytes < 1024)
        return bytes + ' B';
    else if (bytes < 1024 * 1024)
        return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1024 * 1024 * 1024)
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    else
        return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}
async function generateFileRelationships(rootPath, docsFolder) {
    // Create a file dependency map
    const dependencyMap = new Map();
    const reverseMap = new Map(); // who imports this file
    return new Promise((resolve) => {
        // Use a more comprehensive approach to find imports
        (0, child_process_1.exec)('find . -type f -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py" -o -name "*.java" -o -name "*.go" | grep -v "node_modules\\|venv\\|dist\\|docker" | sort', { cwd: rootPath }, async (error, stdout, stderr) => {
            let fileRelations = "# File Relationships\n\n";
            if (!error) {
                const files = stdout.split('\n').filter(file => file.trim() !== '');
                for (const file of files) {
                    if (file.includes('node_modules/') || file.includes('venv/'))
                        continue;
                    try {
                        const content = fs.readFileSync(path.join(rootPath, file), 'utf8');
                        const fileExt = path.extname(file);
                        // Initialize sets if not exist
                        if (!dependencyMap.has(file)) {
                            dependencyMap.set(file, new Set());
                        }
                        // Use language-specific regex patterns based on file extension
                        const imports = extractImports(content, fileExt);
                        // Map relative imports to actual file paths
                        for (const imp of imports) {
                            if (imp.startsWith('.')) {
                                const importedFile = resolveRelativeImport(file, imp, rootPath);
                                if (importedFile) {
                                    dependencyMap.get(file).add(importedFile);
                                    // Update reverse map
                                    if (!reverseMap.has(importedFile)) {
                                        reverseMap.set(importedFile, new Set());
                                    }
                                    reverseMap.get(importedFile).add(file);
                                }
                            }
                            else {
                                dependencyMap.get(file).add(imp);
                            }
                        }
                    }
                    catch (err) {
                        outputChannel.appendLine(`Error analyzing imports in ${file}: ${err instanceof Error ? err.message : String(err)}`);
                    }
                }
                // Generate a more detailed relationship documentation
                fileRelations += "## Direct Dependencies\n\n";
                for (const [file, deps] of dependencyMap.entries()) {
                    if (deps.size > 0) {
                        fileRelations += `### ${file}\n\nThis file depends on:\n`;
                        [...deps].forEach(dep => {
                            fileRelations += `- ${dep}\n`;
                        });
                        fileRelations += "\n";
                    }
                }
                fileRelations += "## Reverse Dependencies\n\n";
                for (const [file, deps] of reverseMap.entries()) {
                    if (deps.size > 0) {
                        fileRelations += `### ${file}\n\nThis file is imported by:\n`;
                        [...deps].forEach(dep => {
                            fileRelations += `- ${dep}\n`;
                        });
                        fileRelations += "\n";
                    }
                }
            }
            // Save the raw relationship data for use in individual file docs
            fs.writeFileSync(path.join(docsFolder, 'relationships-data.json'), JSON.stringify({
                dependencies: [...dependencyMap.entries()].map(([file, deps]) => ({ file, deps: [...deps] })),
                reverseDeps: [...reverseMap.entries()].map(([file, deps]) => ({ file, deps: [...deps] }))
            }, null, 2));
            // Generate comprehensive documentation with Gemini
            const prompt = `Analyze these file relationships and create a comprehensive documentation that explains the architecture and dependencies between files. 
Include sections about key components, architectural patterns, and highlight central files based on their number of dependencies:

${fileRelations}`;
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
// Helper function to extract imports based on file type
function extractImports(content, fileExt) {
    const imports = [];
    // JavaScript/TypeScript
    if (['.js', '.ts', '.jsx', '.tsx'].includes(fileExt)) {
        const importRegex = /import\s+.*?from\s+['"](.+?)['"]|require\s*\(\s*['"](.+?)['"]\s*\)/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1] || match[2];
            if (importPath) {
                imports.push(importPath);
            }
        }
    }
    // Python
    else if (fileExt === '.py') {
        const importRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1] || match[2];
            if (importPath) {
                imports.push(importPath);
            }
        }
    }
    // Add more language support as needed
    return imports;
}
// Helper function to resolve relative imports to full paths
function resolveRelativeImport(sourceFile, importPath, rootPath) {
    try {
        const sourceDir = path.dirname(sourceFile);
        let fullPath = path.join(sourceDir, importPath);
        // Handle extensions
        if (!path.extname(fullPath)) {
            const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go'];
            for (const ext of extensions) {
                if (fs.existsSync(path.join(rootPath, fullPath + ext))) {
                    return fullPath + ext;
                }
            }
            // Check for index files
            for (const ext of extensions) {
                if (fs.existsSync(path.join(rootPath, fullPath, 'index' + ext))) {
                    return path.join(fullPath, 'index' + ext);
                }
            }
        }
        return fullPath;
    }
    catch (err) {
        outputChannel.appendLine(`Error resolving import ${importPath} in ${sourceFile}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}
async function generateIndividualDocs(rootPath, docsFolder) {
    return new Promise((resolve) => {
        (0, child_process_1.exec)('find . -type f -not -path "*/\\.*" -not -path "*/node_modules/*" -not -path "*/venv/*" -not -path "*/code-docs/*" -not -path "*/docker/*" -not -name "Dockerfile" -not -name "docker-compose.yml" -not -name "docker-compose.yaml" -not -name "*.dockerfile" | sort', { cwd: rootPath }, async (error, stdout, stderr) => {
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
            // Process files sequentially one by one instead of in parallel batches
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                outputChannel.appendLine(`Processing file ${i + 1}/${files.length}: ${file}`);
                // Show progress notification
                vscode.window.showInformationMessage(`Documenting file ${i + 1}/${files.length}: ${file}`);
                // Process one file at a time
                await documentSingleFile(rootPath, individualDocsFolder, file);
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
    // Process files sequentially
    for (let i = 0; i < changedFiles.length; i++) {
        const file = changedFiles[i];
        outputChannel.appendLine(`Updating documentation for file ${i + 1}/${changedFiles.length}: ${file}`);
        // Show progress notification
        vscode.window.showInformationMessage(`Updating documentation for file ${i + 1}/${changedFiles.length}: ${file}`);
        // Process one file at a time
        await documentSingleFile(rootPath, individualDocsFolder, file);
    }
}
async function documentSingleFile(rootPath, docsFolder, filePath) {
    try {
        // Create directory structure if needed
        const fileDocPath = path.join(docsFolder, `${filePath.replace(/\//g, '_')}.md`);
        const fileDir = path.dirname(fileDocPath);
        if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
        }
        const fullPath = path.join(rootPath, filePath);
        // Skip if file doesn't exist
        if (!fs.existsSync(fullPath)) {
            outputChannel.appendLine(`File does not exist: ${fullPath}`);
            return;
        }
        const stats = fs.statSync(fullPath);
        // Skip files that are too large
        if (stats.size > 100000) { // Skip files larger than ~100KB
            fs.writeFileSync(fileDocPath, `# ${filePath}\n\nFile too large for documentation.`);
            return;
        }
        // Read file content
        const content = fs.readFileSync(fullPath, 'utf8');
        // Get file type for specialized handling
        const fileExt = path.extname(filePath);
        // Try to load relationship data for better context
        let relationshipData = {};
        try {
            const relationshipPath = path.join(docsFolder, 'relationships-data.json');
            if (fs.existsSync(relationshipPath)) {
                const relationshipContent = fs.readFileSync(relationshipPath, 'utf8');
                relationshipData = JSON.parse(relationshipContent);
            }
        }
        catch (err) {
            outputChannel.appendLine(`Could not load relationship data: ${err instanceof Error ? err.message : String(err)}`);
        }
        // Find direct dependencies for this file
        const fileDeps = relationshipData.dependencies?.find((item) => item.file === filePath)?.deps || [];
        // Find what files import this file
        const fileImportedBy = relationshipData.reverseDeps?.find((item) => item.file === filePath)?.deps || [];
        // Try to get any surrounding context (nearby files)
        const fileDir2 = path.dirname(filePath);
        const siblingFiles = fs.readdirSync(path.join(rootPath, fileDir2))
            .filter(f => f !== path.basename(filePath))
            .slice(0, 5); // Just take a few for context
        // Generate tailored prompts based on file type
        let prompt = `Document this ${fileExt.replace('.', '')} file thoroughly. Provide a comprehensive breakdown including:
1. File purpose and overview
2. Key functions/classes/components and their purpose
3. Important variables/state/props
4. Overall architecture and code flow
5. Usage examples and intended use cases
6. Dependencies and imports analysisit sho
7. Any notable algorithms, patterns or design decisions

File path: ${filePath}

${fileDeps.length ? `This file imports: ${fileDeps.join(', ')}` : ''}
${fileImportedBy.length ? `This file is imported by: ${fileImportedBy.join(', ')}` : ''}
${siblingFiles.length ? `Other files in the same directory: ${siblingFiles.join(', ')}` : ''}

Content:
\`\`\`${fileExt}
${content}
\`\`\``;
        // Add special handling for specific file types
        if (['.js', '.ts', '.jsx', '.tsx'].includes(fileExt)) {
            prompt = addJavaScriptSpecificPrompt(prompt, content);
        }
        else if (fileExt === '.py') {
            prompt = addPythonSpecificPrompt(prompt, content);
        }
        else if (['.java', '.kt'].includes(fileExt)) {
            prompt = addJavaSpecificPrompt(prompt, content);
        }
        try {
            const documentation = await generateWithGemini(prompt);
            fs.writeFileSync(fileDocPath, `# ${filePath}\n\n${documentation}`);
            outputChannel.appendLine(`Successfully documented: ${filePath}`);
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
// Helper functions for language-specific enhancements
function addJavaScriptSpecificPrompt(prompt, content) {
    // Look for React components
    if (content.includes('React') || content.includes('Component') || content.includes('useState') ||
        content.includes('jsx') || content.includes('props')) {
        prompt += "\n\nThis appears to be a React component. Please include specifics about:  \n";
        prompt += "- Component lifecycle and hooks used\n";
        prompt += "- Props interface/structure\n";
        prompt += "- State management approach\n";
        prompt += "- Rendering logic and JSX structure\n";
    }
    // Look for Redux
    if (content.includes('createStore') || content.includes('useSelector') ||
        content.includes('useDispatch') || content.includes('reducer')) {
        prompt += "\n\nThis file appears to use Redux. Please explain:  \n";
        prompt += "- Redux actions and action creators\n";
        prompt += "- Reducer structure and state transformations\n";
        prompt += "- How store is connected to components\n";
    }
    return prompt;
}
function addPythonSpecificPrompt(prompt, content) {
    // Django detection
    if (content.includes('django') || content.includes('models.Model') ||
        content.includes('urls.py') || content.includes('views.py')) {
        prompt += "\n\nThis appears to be a Django file. Please include details about:  \n";
        prompt += "- Django-specific functionality (models, views, urls, etc.)\n";
        prompt += "- ORM usage if present\n";
        prompt += "- URL routing patterns\n";
    }
    // Flask detection
    if (content.includes('Flask') || content.includes('flask') ||
        content.includes('@app.route') || content.includes('Blueprint')) {
        prompt += "\n\nThis appears to be a Flask file. Please explain:  \n";
        prompt += "- Route definitions and HTTP methods\n";
        prompt += "- Request handling\n";
        prompt += "- Blueprint organization if applicable\n";
    }
    return prompt;
}
function addJavaSpecificPrompt(prompt, content) {
    // Spring detection
    if (content.includes('@Controller') || content.includes('@Service') ||
        content.includes('@Repository') || content.includes('@SpringBootApplication')) {
        prompt += "\n\nThis appears to be a Spring framework file. Please include details about:  \n";
        prompt += "- Spring annotations and their purpose\n";
        prompt += "- Bean lifecycle management\n";
        prompt += "- Dependency injection pattern\n";
    }
    return prompt;
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
function getPackageJson(rootPath) {
    try {
        const packageJsonPath = path.join(rootPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const content = fs.readFileSync(packageJsonPath, 'utf8');
            return JSON.parse(content);
        }
        return null;
    }
    catch (error) {
        outputChannel.appendLine(`Error reading package.json: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}
//# sourceMappingURL=extension.js.map