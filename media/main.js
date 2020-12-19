/* eslint-disable no-undef */
// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    // eslint-disable-next-line no-undef
    const vscode = acquireVsCodeApi();

    let submitBtn = document.getElementById("btnSubmit");

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
            {
                // enable form
                var form = document.getElementById("myform");
                var elements = form.elements;
                for (var i = 0, len = elements.length; i < len; ++i) {
                    elements[i].disabled = false;
                }
                document.getElementById("output").innerHTML = message.output;
                submitBtn.disabled = false;
                submitBtn.innerHTML = "Start";
                break;
            }
            case 'setProgressBar':
            {
                let elem = document.getElementById("progressbar");
                const percentage = Math.round(message.value * 100 / message.total);
                elem.style.width = percentage + '%';
                elem.innerHTML = percentage + '%';
                if (message.value == 0)
                    document.getElementById("output").innerHTML = '';
                vscode.postMessage({command:'progressBarSet', value: message.value});
                break;
            }
        }
    });

    document.getElementById("btnSubmit").addEventListener("click", function()
    { 
        if (submitBtn.innerHTML == "Start") {
            // disable form
            var form = document.getElementById("myform");
            var elements = form.elements;
            for (var i = 0, len = elements.length; i < len; ++i) {
                elements[i].disabled = true;
            }
            vscode.postMessage({
                command: 'onSubmit',
                executable: document.getElementById("fexecutable").value,
                cmdOptions: document.getElementById("fcmdoptions").value, 
                search: document.getElementById("ftext").value,
                dir: document.getElementById("fdir").value,
                includes: document.getElementById("finclude").value
            });
            submitBtn.innerHTML = "Cancel";
        }
        else {
            submitBtn.disabled = true;
            vscode.postMessage({
                command: 'cancel'
            });
        }
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
