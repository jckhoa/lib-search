import * as vscode from 'vscode';

import fs = require('fs');
import path = require('path');
import cp = require('child_process');

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('libSearch.start', () => {
			LibSearchPanel.createOrShow(context.extensionUri);
		})
	);

	if (vscode.window.registerWebviewPanelSerializer) {
		// Make sure we register a serializer in activation event
		vscode.window.registerWebviewPanelSerializer(LibSearchPanel.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
				console.log(`Got state: ${state}`);
				LibSearchPanel.revive(webviewPanel, context.extensionUri);
				//await vscode.workspace.getConfiguration().update("conf.resource.executable", exe, vscode.ConfigurationTarget.Global);
			}
		});
	}

}

const walk = function(dir: any, recursive=false, done: { (err: any, res: any): void; (err: any, files: any[]): void; (arg0: null, arg1: string[]): void; }) {
	let results: string[] = [];
	fs.readdir(dir, function(err: any, list: any[]) {
		if (err) return done(err, results);
		let pending = list.length;
		if (!pending) return done(null, results);
		list.forEach(function(file: any) {
			file = path.resolve(dir, file);
			fs.stat(file, function(err: any, stat: { isDirectory: () => any; }) {
				if (stat && stat.isDirectory()) {
					if (recursive)
					{
						walk(file, recursive, function(err: any, res: any) {
							results = results.concat(res);
							if (!--pending) done(null, results);
						});
					}
				} else {
					results.push(file);
					if (!--pending) done(null, results);
				}
			});
		});
	});
};

const findFile = function(dir: any, filename:string, recursive=false, done: { (err: any, res: any): void; (err: any, files: any[]): void; (arg0: null, arg1: string[]): void; }) {
	let results: string[] = [];
	fs.readdir(dir, function(err: any, list: any[]) {
		if (err) return done(err, results);
		let pending = list.length;
		if (!pending) return done(null, results);
		list.forEach(function(file: any) {
			file = path.resolve(dir, file);
			fs.stat(file, function(err: any, stat: { isDirectory: () => any; }) {
				if (stat && stat.isDirectory()) {
					if (recursive)
					{
						findFile(file, filename, recursive, function(err: any, res: any) {
							results = results.concat(res);
							if (!--pending) done(null, results);
						});
					}
				} else {
					if (path.basename(file) == filename)
						results.push(file);
					if (!--pending) done(null, results);
				}
			});
		});
	});
};

/**
 * Manages library search webview panels
 */
class LibSearchPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: LibSearchPanel | undefined;

	public executable!: string | "";
	public cmdOptions!: string | "";
	public searchText: string | undefined;
	public searchDirectory: string | undefined;
	public includeFiles: string | undefined;

	public static readonly viewType = 'librarySearch';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (LibSearchPanel.currentPanel && column) {
			LibSearchPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			LibSearchPanel.viewType,
			'Library Search',
			column || vscode.ViewColumn.One,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
			}
		);

		LibSearchPanel.currentPanel = new LibSearchPanel(panel, extensionUri);
	}

	public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		LibSearchPanel.currentPanel = new LibSearchPanel(panel, extensionUri);
	}

	private destructor()
	{
		return;
	}
	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;

		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	
		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
					case 'btnBrowseDirClicked':
					{
						vscode.window.showErrorMessage(message.text);
						const options: vscode.OpenDialogOptions = {
							canSelectMany: false,
							canSelectFiles: false,
							canSelectFolders: true,
							openLabel: 'Select Folder'
						};

						vscode.window.showOpenDialog(options).then(fileUri => {
							if (fileUri && fileUri[0]) {
								this._panel.webview.postMessage({ command: 'directorySelected', dir: fileUri[0].fsPath });
							}
						});
						return;
					}
					case 'btnExecutableClicked':
					{
						const options: vscode.OpenDialogOptions = {
							canSelectMany: false,
							canSelectFiles: true,
							canSelectFolders: false,
							openLabel: 'Select File'
						};

						vscode.window.showOpenDialog(options).then(fileUri => {
							if (fileUri && fileUri[0]) {
								this._panel.webview.postMessage({ command: 'executableSelected', file: fileUri[0].fsPath });
							}
						});
						return;
					}
					case 'onSubmit':
					{
						this._panel.webview.postMessage({ command: 'setProgressBar', value: 0 });
						this.executable = message.executable;
						this.cmdOptions = message.cmdOptions;
						this.searchText = message.search;
						this.searchDirectory = message.dir;
						this.includeFiles = message.includes;

						// save configuration
						const target = vscode.ConfigurationTarget.Global;
						vscode.workspace.getConfiguration().update('conf.resource.executable', this.executable, target);
						vscode.workspace.getConfiguration().update('conf.resource.cmdOptions', this.cmdOptions, target);
						vscode.workspace.getConfiguration().update('conf.resource.searchDirectory', this.searchDirectory, target);
						vscode.workspace.getConfiguration().update('conf.resource.searchText', this.searchText, target);
						vscode.workspace.getConfiguration().update('conf.resource.includeFiles', this.includeFiles, target);
						
						const options:string[] = this.cmdOptions ? this.cmdOptions.split(";") : [];
						options.forEach((item, index) => {
							options[index] = item.trim();
						});
					
						const incFiles:string[] = this.includeFiles ? this.includeFiles.split(";") : [];
						incFiles.forEach((item, index) => {
							incFiles[index] = item.trim();
						});
			
						
						walk(message.dir, true, (err: any, files: any[]) => {
							const allFiles:string[] = [];
							for (const pattern of incFiles)
							{
								const filePaths:string[] = files.filter((el: any) => (new RegExp(pattern + '$').test(path.extname(el).toLowerCase())));
								
								for (const el of filePaths)
								{
									allFiles.push(el);
									
								}
							}

							const results:string[] = [];
							for (let i = 0; i < allFiles.length; ++i)
							{
								const el = allFiles[i];
								const ops = [...options, el];
								const proc = cp.spawnSync(this.executable, ops, {
									encoding: 'utf8'
								});

								if (proc.stdout.includes(message.search))
								{
									results.push(el);
								}
								const progress = (i + 1) * 100/allFiles.length;
								this._panel.webview.postMessage({ command: 'setProgressBar', value: progress });
							}
							this._panel.webview.postMessage({ 
								command: 'outputAvailable',
								output: results.join('\n') 
							});
						});

						return;	
					}
				}
			},
			null,
			this._disposables
		);
	}

	public initGui(message: any)
	{
		this._panel.webview.postMessage(message);
	}

	public dispose() {

		LibSearchPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update() {
		const webview = this._panel.webview;

		this._panel.webview.html = this._getHtmlForWebview(webview);
		// Load configuration
		const item = { 
			command: 'initGui', 
			executable: vscode.workspace.getConfiguration().get('conf.resource.executable'),
			cmdOptions: vscode.workspace.getConfiguration().get('conf.resource.cmdOptions'),
			searchDirectory: vscode.workspace.getConfiguration().get('conf.resource.searchDirectory'),
			searchText: vscode.workspace.getConfiguration().get('conf.resource.searchText'),
			includeFiles: vscode.workspace.getConfiguration().get('conf.resource.includeFiles')
		};
		this._panel.webview.postMessage(item);

	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');

		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

		// Local path to css styles
		const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
		const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css');
		const stylesW3 = vscode.Uri.joinPath(this._extensionUri, 'media', 'w3.css');
		// Uri to load styles into webview
		const stylesResetUri = webview.asWebviewUri(styleResetPath);
		const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

		// Use a nonce to only allow specific scripts to be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${stylesResetUri}" rel="stylesheet">
				<link href="${stylesMainUri}" rel="stylesheet">
				<link href="${stylesW3}" rel="stylesheet">
				
				<title>Library Search</title>
			</head>
			<body>
				<form id="myform">
					<div>Search for function symbols recursively in a directory for specific file types.</div>
					<div>The results list the file which contain the function symbols.</div>
					<div>Hover over the fields for more information.</div>
					<button id="btnExecutable" type="button" title="Load the path to dumpbin.exe, nm, etc.">Tool</button>
					<input type="text" id="fexecutable" name="fexecutable" title="E.g. C:\\Program Files (x86)\\...\\dumpbin.exe" value="">
					<br>
					
					<label for="ftext" title="Command options for dumpbin.exe, nm, etc. (semi-colon separated)" >Command options</label>
					<input type="text" id="fcmdoptions" name="foptions" title="E.g. /EXPORTS" value="">
					<br>
					
					<label for="ftext" title="The function symbol as text to search for">Search text</label>
					<input type="text" id="ftext" name="ftext" title="E.g. FN_ADD" value="fl_xmap">
					<br>
					
					<button id="btnBrowseDir" type="button" title="Browse for directory">in directory</button>
					<input type="text" id="fdir" name="fdir" title="E.g. C:\\Qt\\5.12.6\\lib" value="c:\\Users\\raymo\\Documents\\almms">
					<br>

					<label for="ftext" title="File types (semi-colon separated)">in files</label>
					<input type="text" id="finclude" name="finclude" value="*.dll" title="E.g. .lib;.dll">
					<br>

					<button id="btnSubmit" type="button" title="Start the search">Start</button>
					<span class="mybar">
						<div id="progressbar" class="myprogress" style="width:0%"></div>
					</span>
				</form> 

				<pre id="output"></pre>
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
