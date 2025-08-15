import fetch from 'node-fetch';
import * as vscode from 'vscode';

// Mantém referência à webview view (activity bar)
let currentView: vscode.WebviewView | undefined;

async function askBackend(prompt: string): Promise<string> {
  const endpoint = vscode.workspace.getConfiguration('xcopilot').get<string>('backendUrl') || 'http://localhost:3000/openai';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
  const data: any = await res.json();
    if (!res.ok) {
      return `Erro: ${data.error || res.statusText}`;
    }
    return data.resposta || JSON.stringify(data);
  } catch (err: any) {
    return `Falha na requisição: ${err.message}`;
  }
}

// Remove uso de WebviewPanel isolado; usamos somente WebviewViewProvider.

function getHtml() {
  return `<!DOCTYPE html>
<html lang="pt-br">
<head><meta charset="UTF-8" /><style>
body{font-family:Segoe UI,Arial;padding:10px;}
#out{white-space:pre-wrap;border:1px solid #444;padding:8px;margin-top:8px;min-height:120px;}
button{margin-top:6px;}
</style></head>
<body>
<h3>xCopilot</h3>
<input id="prompt" style="width:100%" placeholder="Pergunte algo..."/>
<button id="send">Enviar</button>
<div id="out"></div>
<script>
const vscode = acquireVsCodeApi();
document.getElementById('send').addEventListener('click', () => {
  const prompt = document.getElementById('prompt').value;
  vscode.postMessage({ type: 'ask', prompt });
});
window.addEventListener('message', ev => {
  if(ev.data.type==='answer'){
    document.getElementById('out').textContent = ev.data.text;
  }
});
</script>
</body></html>`;
}

export function activate(context: vscode.ExtensionContext) {
  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView(view: vscode.WebviewView) {
      currentView = view;
      view.webview.options = { enableScripts: true };
      view.webview.html = getHtml();
      view.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === 'ask' && msg.prompt) {
          view.webview.postMessage({ type: 'answer', text: 'Pensando...' });
          const answer = await askBackend(msg.prompt);
          view.webview.postMessage({ type: 'answer', text: answer });
        }
      });
    }
  };
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('xcopilotPanel', provider));

  context.subscriptions.push(vscode.commands.registerCommand('xcopilot.ask', async () => {
    await vscode.commands.executeCommand('workbench.view.extension.xcopilot');
    const quick = await vscode.window.showInputBox({ placeHolder: 'Pergunte ao xCopilot' });
    if (!quick) return;
    if (!currentView) {
      vscode.window.showWarningMessage('View xCopilot ainda não inicializada. Clique no ícone e tente novamente.');
      return;
    }
    currentView.webview.postMessage({ type: 'answer', text: 'Pensando...' });
    const answer = await askBackend(quick);
    currentView.webview.postMessage({ type: 'answer', text: answer });
  }));

  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('xcopilot.backendUrl')) {
      vscode.window.showInformationMessage('URL do backend xCopilot atualizada.');
    }
  }));
}

export function deactivate() {
  currentView = undefined;
}
