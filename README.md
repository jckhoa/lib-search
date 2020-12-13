# Library Search
Extension to search for function symbol in library files (.lib, .dll, .a, .so, etc.) recursively in a directory.
It helps programmer to include missing libraries when encountering the linking error: function symbol not found.

## Usage: 
1) Press Ctrl+Shift+P, type 'Lib search: Start lib search session' to open the lib search panel
2) Fill the following fields:
	- Load executable: click on this button and browse to where the executable for exploring function symbols is located. The executable can be 'dumpbin.exe' on Windows, or 'nm' on Unix.
	- Command options (semicolon separated): provide command options for the executable. For e.g.: '/EXPORTS' if dumpbin.exe is used
	- Search text: the function symbol to search for
	- in directory: click on this button to browse the directory where we want to perform the search. The search will be performed on the files found recursively in this directory.
	- in files (semicolon separated): the files or file types to search for in the search directory. For example: .lib;.dll will search for all the *.lib and *.dll recursively in the search directory.
3) Click Start button to perform the search
## VS Code API

### `vscode` module

- [`window.createWebviewPanel`](https://code.visualstudio.com/api/references/vscode-api#window.createWebviewPanel)
- [`window.registerWebviewPanelSerializer`](https://code.visualstudio.com/api/references/vscode-api#window.registerWebviewPanelSerializer)

## Running the example

- Open this example in VS Code 1.47+
- `npm install`
- `npm run watch` or `npm run compile`
- `F5` to start debugging

Run the `Lib search: Start lib search session` to create the webview.
