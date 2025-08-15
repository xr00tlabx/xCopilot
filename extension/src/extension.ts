import * as vscode from 'vscode';
import fetch from 'node-fetch';

let panel: vscode.WebviewPanel | undefined;

async function askBackend(prompt: string): Promise<string> {
  const endpoint = vscode.workspace.getConfiguration('xcopilot').get<string>('backendUrl') || 'http://localhost:3000/openai';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (!res.ok) {
      return `Erro: ${data.error || res.statusText}`;
    }
    return data.resposta || JSON.stringify(data);
  } catch (err: any) {
    return `Falha na requisição: ${err.message}`;
  }
}

function ensurePanel(context: vscode.ExtensionContext) {
  if (panel) { return panel; }
  panel = vscode.window.createWebviewPanel(
    'xcopilotPanel',
    'xCopilot Assistente',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );
  panel.onDidDispose(() => { panel = undefined; });
  panel.webview.html = getHtml();
  return panel;
}

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
  context.subscriptions.push(
    vscode.commands.registerCommand('xcopilot.ask', async () => {
      const prompt = await vscode.window.showInputBox({ prompt: 'Pergunte ao xCopilot' });
      if (!prompt) { return; }
      const p = ensurePanel(context);
      p.reveal();
      p.webview.postMessage({ type: 'answer', text: 'Pensando...' });
      const answer = await askBackend(prompt);
      p.webview.postMessage({ type: 'answer', text: answer });
    })
  );

  if (!panel) {
    ensurePanel(context);
  }

  // Mensagens do webview
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {}));

  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('xcopilot.backendUrl')) {
      vscode.window.showInformationMessage('URL do backend xCopilot atualizada.');
    }
  }));
}

export function deactivate() {
  panel?.dispose();
}
