/* eslint-disable no-undef */
// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    // eslint-disable-next-line no-undef
    const vscode = acquireVsCodeApi();

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'initGui':
                document.getElementById("fexecutable").value = message.executable;
                document.getElementById("fcmdoptions").value = message.cmdOptions;
                document.getElementById("fdir").value = message.searchDirectory;
                document.getElementById("ftext").value = message.searchText;
                document.getElementById("finclude").value = message.includeFiles;
                break;
            case 'directorySelected':
                document.getElementById("fdir").value = message.dir;
                break;
            case 'executableSelected':
                document.getElementById("fexecutable").value = message.file;
                break;
            case 'outputAvailable':
                document.getElementById("output").innerHTML = message.output;
                break;
            case 'setProgressBar':
            {
                let elem = document.getElementById("progressbar");
                elem.style.width = message.value + '%';
                if (message.value == 0)
                    elem.innerHTML = '';
                else
                    elem.innerHTML = message.value + '%';
                break;
            }
        }
    });

    document.getElementById("btnSubmit").addEventListener("click", function()
    {
        vscode.postMessage({
            command: 'onSubmit',
            executable: document.getElementById("fexecutable").value,
            cmdOptions: document.getElementById("fcmdoptions").value, 
            search: document.getElementById("ftext").value,
            dir: document.getElementById("fdir").value,
            includes: document.getElementById("finclude").value
        });
    });

    document.getElementById("btnBrowseDir").addEventListener("click", function()
    {
        vscode.postMessage({
            command: 'btnBrowseDirClicked',
            text: 'Button browse dir clicked'
        }); 
    });

    document.getElementById("btnExecutable").addEventListener("click", function() {
        vscode.postMessage({
            command: 'btnExecutableClicked',
            text: 'Button executable clicked'
        });
    });

    document.getElementById("fdir").addEventListener("change", function(ev)
    {
        let files = ev.target.files;
        vscode.postMessage({
            command: 'alert',
            text: files[0].webkitRelativePath
        });
    });

}()
);
