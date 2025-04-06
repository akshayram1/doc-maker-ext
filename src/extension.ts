import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import axios from 'axios';

let geminiApiKey = '';
let outputChannel: vscode.OutputChannel;

/**
 * This method is called when your extension is activated
 * @param context - The extension context
 */
export function activate(context: vscode.ExtensionContext): void {
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel("Documentation Maker");
    outputChannel.show(true); // Show the output channel immediately for debugging
    outputChannel.appendLine('Documentation Maker activation started...');
    console.log('Documentation Maker activation started...');

    try {
        // Register commands with proper error handling
        const initialSetupCommand = vscode.commands.registerCommand(
            'doc-maker.initialSetup',
            () => {
                outputChannel.appendLine('Initial setup command triggered');
                return initialSetup();
            }
        );

        const updateDocsCommand = vscode.commands.registerCommand(
            'doc-maker.updateDocs',
            () => {
                outputChannel.appendLine('Update docs command triggered');
                return updateDocumentation();
            }
        );

        context.subscriptions.push(initialSetupCommand, updateDocsCommand);

        outputChannel.appendLine('Commands registered successfully:');
        outputChannel.appendLine('- doc-maker.initialSetup');
        outputChannel.appendLine('- doc-maker.updateDocs');

        // Check for API key on startup
        checkApiKey();

        // Show welcome message and setup instructions
        showWelcomeMessage();

        outputChannel.appendLine('Documentation Maker activation completed successfully!');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        outputChannel.appendLine(`ERROR during activation: ${errorMessage}`);
        console.error('Documentation Maker activation error:', error);
        vscode.window.showErrorMessage(`Documentation Maker failed to activate: ${errorMessage}`);
    }
}

function showWelcomeMessage(): void {
    outputChannel.appendLine('Showing welcome message...');
    vscode.window.showInformationMessage(
        'Documentation Maker is active! Run "Documentation Maker: Initial Setup" to begin.',
        'Setup Now', 'Read Docs'
    ).then(selection => {
        if (selection === 'Setup Now') {
            outputChannel.appendLine('User selected "Setup Now" - executing initialSetup command');
            // Use direct function call instead of executeCommand for reliability
            initialSetup().catch((err: Error) => {
                outputChannel.appendLine(`Error during setup: ${err.message}`);
            });
        } else if (selection === 'Read Docs') {
            // If a README.md exists, open it
            const extensionPath = vscode.extensions.getExtension('akshaychame.documentation-maker')?.extensionPath;
            if (extensionPath) {
                const readmePath = path.join(extensionPath, 'README.md');
                if (fs.existsSync(readmePath)) {
                    vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(readmePath));
                }
            }
        }
    }).then(undefined, (err: Error) => {
        outputChannel.appendLine(`Error showing welcome message: ${err.message}`);
    });
}

async function checkApiKey(): Promise<void> {
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
    } else {
        outputChannel.appendLine('Gemini API Key is not configured.');
    }
}

async function initialSetup(): Promise<void> {
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

async function updateDocumentation(): Promise<void> {
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

async function getChangedFiles(rootPath: string): Promise<string[]> {
    return new Promise((resolve) => {
        exec('git diff --name-only HEAD HEAD~1', { cwd: rootPath }, (error, stdout, stderr) => {
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
async function getFilesRecursively(dir: string, ignoreDirs: string[] = ['node_modules', '.git', 'venv', 'dist', 'code-docs'], rootDir?: string): Promise<string[]> {
    let results: string[] = [];
    // Store the root directory on first call
    const rootPath = rootDir || dir;
    
    try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            // Skip ignored directories
            if (ignoreDirs.includes(file)) continue;
            
            // Create the full path
            const fullPath = path.join(dir, file);
            
            try {
                const stats = fs.statSync(fullPath);
                if (stats.isDirectory()) {
                    // Recurse for directories - pass rootPath to nested calls
                    const subResults = await getFilesRecursively(fullPath, ignoreDirs, rootPath);
                    results = results.concat(subResults);
                } else {
                    // Add file to results - using normalized paths for Windows compatibility
                    // Replace backslashes with forward slashes for consistency
                    let relativePath = path.relative(rootPath, fullPath);
                    relativePath = relativePath.replace(/\\/g, '/');
                    results.push(relativePath);
                }
            } catch (err) {
                outputChannel.appendLine(`Error processing ${fullPath}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    } catch (err) {
        outputChannel.appendLine(`Error reading directory ${dir}: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    return results;
}

async function generateFileStructure(rootPath: string, docsFolder: string): Promise<void> {
    return new Promise((resolve) => {
        const isWindows = process.platform === 'win32';
        
        // Improved Windows command with proper escaping
        const command = isWindows ?
            'powershell.exe -Command "Get-ChildItem -Path . -Recurse -File | Where-Object { $_.FullName -notlike \'*\\node_modules\\*\' -and $_.FullName -notlike \'*\\.git\\*\' -and $_.FullName -notlike \'*\\venv\\*\' } | Select-Object -Property FullName | ForEach-Object { $_.FullName }"' :
            'find . -type f -not -path "*/\\.*" -not -path "*/node_modules/*" -not -path "*/venv/*" | sort | xargs ls -la 2>/dev/null';
        
        outputChannel.appendLine(`Executing command: ${command}`);
        
        exec(command, { cwd: rootPath }, async (error, stdout, stderr) => {
            // If command fails, always use the fallback approach on Windows
            if (error || (isWindows && !stdout.trim())) {
                outputChannel.appendLine(`Using fallback file system approach...`);
                if (error) {
                    outputChannel.appendLine(`Command error: ${error.message}`);
                }
                
                try {
                    // Use file system directly
                    const fileList = await getFilesRecursively(rootPath, ['node_modules', '.git', 'venv', 'dist', 'code-docs'], rootPath);
                    
                    // For debugging, log the first few files found
                    outputChannel.appendLine(`Files found (first 5): ${fileList.slice(0, 5).join(', ')}`);
                    
                    const fileStructure = fileList.join('\n');
                    
                    // Create a project manifest
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
${fileStructure}`;
                    
                    outputChannel.appendLine('Generating documentation from collected files...');
                    const documentation = await generateWithGemini(prompt);
                    fs.writeFileSync(path.join(docsFolder, 'file-structure.md'), documentation);
                    // Save the manifest for future reference
                    fs.writeFileSync(path.join(docsFolder, 'project-manifest.json'), JSON.stringify(projectManifest, null, 2));
                    outputChannel.appendLine('File structure documentation generated successfully.');
                    resolve();
                } catch (err) {
                    outputChannel.appendLine(`Error with fallback approach: ${err instanceof Error ? err.message : String(err)}`);
                    vscode.window.showErrorMessage(`Error generating file structure: ${err instanceof Error ? err.message : String(err)}`);
                    resolve();
                }
                return;
            }

            // Process command output if successful
            const fileList = stdout.split('\n').filter(file => file.trim() !== '');
            const fileStructure = fileList.join('\n');
            
            // Continue with project manifest and doc generation
            const projectManifest = {
                rootPath: rootPath,
                packageJson: await getPackageJson(rootPath),
                fileCount: fileList.length,
                timestamp: new Date().toISOString()
            };
            
            // Define the prompt here as well - THIS WAS MISSING
            const prompt = `Create a comprehensive file structure documentation from this list of files in the project.
Organize it logically, explain the purpose of main directories, and highlight important files.
Project context: ${JSON.stringify(projectManifest)}
File list:
${fileStructure}`;
            
            try {
                const documentation = await generateWithGemini(prompt);
                fs.writeFileSync(path.join(docsFolder, 'file-structure.md'), documentation);
                fs.writeFileSync(path.join(docsFolder, 'project-manifest.json'), JSON.stringify(projectManifest, null, 2));
                resolve();
            } catch (err) {
                outputChannel.appendLine(`Error with Gemini API: ${err instanceof Error ? err.message : String(err)}`);
                vscode.window.showErrorMessage(`Error with Gemini API: ${err instanceof Error ? err.message : String(err)}`);
                resolve();
            }
        });
    });
}

// Add helper function to get package.json content
async function getPackageJson(rootPath: string): Promise<any> {
    try {
        const packageJsonPath = path.join(rootPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const content = fs.readFileSync(packageJsonPath, 'utf8');
            return JSON.parse(content);
        }
    } catch (err) {
        outputChannel.appendLine(`Error reading package.json: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
}

async function generateFileRelationships(rootPath: string, docsFolder: string): Promise<void> {
    // Create a file dependency map
    const dependencyMap = new Map<string, Set<string>>();
    const reverseMap = new Map<string, Set<string>>(); // who imports this file
    
    return new Promise((resolve) => {
        const isWindows = process.platform === 'win32';
        const extensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go'];
        
        // Skip command execution on Windows and use direct file system approach
        if (isWindows) {
            outputChannel.appendLine('Using direct file system approach for relationships on Windows...');
            processFilesForRelationships();
        } else {
            const command = `find . -type f \\( ${extensions.map(ext => `-name "*.${ext}"`).join(' -o ')} \\) | grep -v "node_modules\\|venv\\|dist" | sort`;
            outputChannel.appendLine(`Executing relationship command: ${command}`);
            
            exec(command, { cwd: rootPath }, (error, stdout) => {
                if (error) {
                    outputChannel.appendLine(`Error with command: ${error.message}`);
                    processFilesForRelationships();
                    return;
                }
                
                const files = stdout.split('\n')
                    .filter(file => file.trim() !== '')
                    .map(file => file.replace(/^\.[\\/]/, ''));
                
                processRelationships(files);
            });
        }
        
        // Helper function to process files using Node.js file system
        async function processFilesForRelationships() {
            try {
                const files = (await getFilesRecursively(rootPath, ['node_modules', '.git', 'venv', 'dist', 'code-docs'], rootPath))
                    .filter(file => extensions.includes(path.extname(file).substring(1)));
                
                processRelationships(files);
            } catch (err) {
                outputChannel.appendLine(`Error getting files: ${err instanceof Error ? err.message : String(err)}`);
                resolve();
            }
        }
        
        // Process the file relationships
        function processRelationships(files: string[]) {
            // Implement the actual relationship building here
            outputChannel.appendLine(`Processing relationships for ${files.length} files...`);
            
            // Process each file to extract imports
            for (const file of files) {
                try {
                    const fullPath = path.join(rootPath, file);
                    
                    // Skip if file doesn't exist (might have been deleted/moved)
                    if (!fs.existsSync(fullPath)) {
                        continue;
                    }
                    
                    // Read file content
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const fileExt = path.extname(file);
                    
                    // Initialize the dependency set for this file
                    if (!dependencyMap.has(file)) {
                        dependencyMap.set(file, new Set<string>());
                    }
                    
                    // Extract imports from this file
                    const imports = extractImports(content, fileExt);
                    
                    // For each import, try to resolve it to an actual file
                    for (const imp of imports) {
                        if (imp.startsWith('.')) {
                            // This is a relative import, try to resolve it
                            const resolvedImport = resolveRelativeImport(file, imp, rootPath);
                            if (resolvedImport) {
                                // Add to dependency map
                                dependencyMap.get(file)!.add(resolvedImport);
                                
                                // Also update reverse map
                                if (!reverseMap.has(resolvedImport)) {
                                    reverseMap.set(resolvedImport, new Set<string>());
                                }
                                reverseMap.get(resolvedImport)!.add(file);
                            }
                        } else {
                            // This is an external/package import
                            dependencyMap.get(file)!.add(imp);
                        }
                    }
                } catch (err) {
                    outputChannel.appendLine(`Error processing file ${file}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            
            // Create documentation from the relationship maps
            let fileRelations = "# File Relationships\n\n";
            
            // Generate direct dependencies documentation
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
            
            // Generate reverse dependencies documentation
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
            
            // Save relationship data for use in file documentation
            try {
                const relationshipData = {
                    dependencies: [...dependencyMap.entries()].map(([file, deps]) => ({ 
                        file, 
                        deps: [...deps] 
                    })),
                    reverseDeps: [...reverseMap.entries()].map(([file, deps]) => ({ 
                        file, 
                        deps: [...deps] 
                    }))
                };
                
                fs.writeFileSync(path.join(docsFolder, 'relationships-data.json'), JSON.stringify(relationshipData, null, 2));
            } catch (err) {
                outputChannel.appendLine(`Error saving relationship data: ${err instanceof Error ? err.message : String(err)}`);
            }
            
            // Generate a comprehensive documentation with Gemini
            const prompt = `Analyze these file relationships and create a comprehensive documentation that explains:
1. The overall architecture of the project
2. Key components and their responsibilities 
3. The main dependency flows between files
4. Any architectural patterns detected from these relationships

Here is the dependency information:

${fileRelations}`;
            
            generateWithGemini(prompt)
                .then(documentation => {
                    fs.writeFileSync(path.join(docsFolder, 'file-relationships.md'), documentation);
                    outputChannel.appendLine('File relationships documentation generated successfully.');
                    resolve();
                })
                .catch(err => {
                    outputChannel.appendLine(`Error generating AI documentation: ${err.message}`);
                    // Fallback to the basic documentation if AI fails
                    fs.writeFileSync(path.join(docsFolder, 'file-relationships.md'), fileRelations);
                    outputChannel.appendLine('Basic file relationships documentation saved as fallback.');
                    resolve();
                });
        }
    });
}

async function generateIndividualDocs(rootPath: string, docsFolder: string): Promise<void> {
    return new Promise((resolve) => {
        const isWindows = process.platform === 'win32';
        const command = isWindows ?
            'powershell -Command "Get-ChildItem -Path . -Recurse -File | Where-Object { $_.FullName -notlike \'*\\node_modules\\*\' -and $_.FullName -notlike \'*\\.git\\*\' -and $_.FullName -notlike \'*\\venv\\*\' -and $_.FullName -notlike \'*\\code-docs\\*\' } | Select-Object -ExpandProperty FullName"' :
            'find . -type f -not -path "*/\\.*" -not -path "*/node_modules/*" -not -path "*/venv/*" -not -path "*/code-docs/*" | sort';
        
        exec(command, { cwd: rootPath }, async (error, stdout, stderr) => {
            let files: string[] = [];
            
            if (error) {
                outputChannel.appendLine(`Error finding files: ${error.message}`);
                vscode.window.showInformationMessage('Using fallback file discovery method...');
                
                try {
                    files = await getFilesRecursively(rootPath, ['node_modules', '.git', 'venv', 'dist', 'code-docs'], rootPath);
                } catch (err) {
                    outputChannel.appendLine(`Fallback failed: ${err instanceof Error ? err.message : String(err)}`);
                    vscode.window.showErrorMessage(`Error finding files: ${err instanceof Error ? err.message : String(err)}`);
                    resolve();
                    return;
                }
            } else {
                files = stdout.split('\n')
                    .filter(file => file.trim() !== '')
                    .map(file => file.replace(/^\.[\\/]/, '')); // Remove ./ or .\ prefix
            }
            
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

async function updateFileDocs(rootPath: string, docsFolder: string, changedFiles: string[]): Promise<void> {
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

async function documentSingleFile(rootPath: string, docsFolder: string, filePath: string): Promise<void> {
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
        let relationshipData: any = {};
        try {
            const relationshipPath = path.join(docsFolder, 'relationships-data.json');
            if (fs.existsSync(relationshipPath)) {
                const relationshipContent = fs.readFileSync(relationshipPath, 'utf8');
                relationshipData = JSON.parse(relationshipContent);
            }
        } catch (err) {
            outputChannel.appendLine(`Could not load relationship data: ${err instanceof Error ? err.message : String(err)}`);
        }

        // Find direct dependencies for this file
        const fileDeps = relationshipData.dependencies?.find((item: any) => item.file === filePath)?.deps || [];

        // Find what files import this file
        const fileImportedBy = relationshipData.reverseDeps?.find((item: any) => item.file === filePath)?.deps || [];

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
6. Dependencies and imports analysis
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
        } else if (fileExt === '.py') {
            prompt = addPythonSpecificPrompt(prompt, content);
        } else if (['.java', '.kt'].includes(fileExt)) {
            prompt = addJavaSpecificPrompt(prompt, content);
        }

        try {
            const documentation = await generateWithGemini(prompt);
            fs.writeFileSync(fileDocPath, `# ${filePath}\n\n${documentation}`);
            outputChannel.appendLine(`Successfully documented: ${filePath}`);
        } catch (err) {
            outputChannel.appendLine(`Error generating documentation for ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
            fs.writeFileSync(fileDocPath, `# ${filePath}\n\nError generating documentation: ${err instanceof Error ? err.message : String(err)}`);
        }
    } catch (err) {
        outputChannel.appendLine(`Error processing file ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
        // Skip file if can't read
    }
}

// Helper functions for language-specific enhancements
function addJavaScriptSpecificPrompt(prompt: string, content: string): string {
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

function addPythonSpecificPrompt(prompt: string, content: string): string {
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

function addJavaSpecificPrompt(prompt: string, content: string): string {
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

async function generateWithGemini(prompt: string): Promise<string> {
    try {
        outputChannel.appendLine('Calling Gemini API...');
        
        const response = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
            {
                contents: [{ 
                    parts: [{ 
                        text: prompt + "\n\nPlease format your response as markdown with appropriate headings, code blocks with syntax highlighting, and well-structured sections. Focus on accuracy and thoroughness in your analysis." 
                    }] 
                }],
                generationConfig: {
                    temperature: 0.1,  // Lower temperature for more accurate/consistent results
                    maxOutputTokens: 8192,
                    topP: 0.95,
                    topK: 40
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': geminiApiKey
                }
            }
        );

        if (response.data && response.data.candidates && response.data.candidates[0].content) {
            outputChannel.appendLine('Gemini API call successful');
            return response.data.candidates[0].content.parts[0].text;
        } else {
            outputChannel.appendLine('Invalid response format from Gemini API: ' + JSON.stringify(response.data));
            throw new Error('Invalid response format from Gemini API');
        }
    } catch (error: any) {
        outputChannel.appendLine(`Gemini API Error: ${error.message}`);
        if (error.response) {
            outputChannel.appendLine(`Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
        }
        throw new Error(`Gemini API Error: ${error.message}`);
    }
}

export function deactivate(): void { }

function extractImports(content: string, fileExt: string): string[] {
    const imports: string[] = [];
    
    try {
        // JavaScript/TypeScript
        if (['.js', '.ts', '.jsx', '.tsx'].includes(fileExt)) {
            // Match ES6 imports
            const es6ImportRegex = /import\s+(?:(?:{[^}]*}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
            let match;
            while ((match = es6ImportRegex.exec(content)) !== null) {
                if (match[1]) imports.push(match[1]);
            }
            
            // Match CommonJS requires
            const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
            while ((match = requireRegex.exec(content)) !== null) {
                if (match[1]) imports.push(match[1]);
            }
        } 
        // Python
        else if (fileExt === '.py') {
            // Match Python imports
            const importFromRegex = /from\s+([^\s]+)\s+import/g;
            let match;
            while ((match = importFromRegex.exec(content)) !== null) {
                if (match[1]) imports.push(match[1]);
            }
            
            const importRegex = /import\s+([^\s,]+)/g;
            while ((match = importRegex.exec(content)) !== null) {
                if (match[1]) imports.push(match[1]);
            }
        }
        // Java
        else if (fileExt === '.java') {
            // Match Java imports
            const importRegex = /import\s+([^;]+);/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                if (match[1]) imports.push(match[1]);
            }
        }
        // Go
        else if (fileExt === '.go') {
            // Match Go imports
            const importRegex = /import\s+\(\s*((?:"[^"]+"\s*)+)\s*\)/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                if (match[1]) {
                    const importBlock = match[1];
                    const individualImports = importBlock.match(/"([^"]+)"/g);
                    if (individualImports) {
                        individualImports.forEach(imp => {
                            imports.push(imp.replace(/"/g, ''));
                        });
                    }
                }
            }
            
            // Single-line imports
            const singleImportRegex = /import\s+"([^"]+)"/g;
            while ((match = singleImportRegex.exec(content)) !== null) {
                if (match[1]) imports.push(match[1]);
            }
        }
    } catch (err) {
        outputChannel.appendLine(`Error extracting imports: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    return imports;
}

function resolveRelativeImport(sourceFile: string, importPath: string, rootPath: string): string | null {
    try {
        // Get directory containing the source file
        const sourceDir = path.dirname(sourceFile);
        let resolvedPath = '';
        
        // Handle relative imports
        if (importPath.startsWith('.')) {
            // Normalize to forward slashes for consistency
            resolvedPath = path.normalize(path.join(sourceDir, importPath)).replace(/\\/g, '/');
        } else {
            // For non-relative imports, just return as is
            return importPath;
        }
        
        // Remove file extension if present
        const ext = path.extname(resolvedPath);
        if (ext) {
            // If it already has an extension, check if the file exists
            const fullPath = path.join(rootPath, resolvedPath);
            if (fs.existsSync(fullPath)) {
                return resolvedPath;
            }
        }
        
        // Try common extensions if no extension or file not found
        const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go'];
        for (const ext of extensions) {
            const fullPath = path.join(rootPath, resolvedPath + ext);
            if (fs.existsSync(fullPath)) {
                return (resolvedPath + ext).replace(/\\/g, '/');
            }
        }
        
        // Handle index files in directories
        for (const ext of extensions) {
            const indexPath = path.join(resolvedPath, 'index' + ext);
            const fullPath = path.join(rootPath, indexPath);
            if (fs.existsSync(fullPath)) {
                return indexPath.replace(/\\/g, '/');
            }
        }
        
        // If we can't resolve it exactly, just return the normalized path
        return resolvedPath;
    } catch (err) {
        outputChannel.appendLine(`Error resolving import ${importPath} in ${sourceFile}: ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}

