/**
 * HTML e CSS para a interface da webview do chat
 */
export function getChatHtml(): string {
    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            --hacker-bg-primary: #0a0a0f;
            --hacker-bg-secondary: #1a1a2e;
            --hacker-bg-tertiary: #16213e;
            --hacker-accent: #00d4ff;
            --hacker-accent-dark: #0099cc;
            --hacker-text-primary: #e0e6ed;
            --hacker-text-secondary: #8892b0;
            --hacker-text-muted: #495670;
            --hacker-border: #233554;
            --hacker-shadow: 0 4px 20px rgba(0, 212, 255, 0.1);
            --hacker-glow: 0 0 20px rgba(0, 212, 255, 0.3);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            padding:0px !important;
            font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
            background: var(--hacker-bg-primary);
            color: var(--hacker-text-primary);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            font-size: 12px;
            line-height: 1.4;
        }

        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background:
                radial-gradient(circle at 20% 80%, rgba(0, 212, 255, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(0, 212, 255, 0.08) 0%, transparent 50%),
                linear-gradient(45deg, transparent 49%, rgba(0, 212, 255, 0.02) 50%, transparent 51%);
            pointer-events: none;
            z-index: 0;
        }

        .header {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            background: var(--hacker-bg-secondary);
            border-bottom: 1px solid var(--hacker-border);
            box-shadow: var(--hacker-shadow);
            position: relative;
            z-index: 2;
            min-height: 48px;
        }

        .logo {
            width: 24px;
            height: 24px;
            margin-right: 12px;
            background: linear-gradient(135deg, var(--hacker-accent) 0%, var(--hacker-accent-dark) 100%);
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--hacker-bg-primary);
            font-weight: bold;
            font-size: 12px;
            box-shadow: var(--hacker-glow);
            animation: pulse 2s infinite;
        }

        .title {
            font-size: 14px;
            font-weight: 700;
            color: var(--hacker-text-primary);
            text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
            letter-spacing: 0.5px;
        }

        .subtitle {
            font-size: 9px;
            color: var(--hacker-accent);
            margin-left: auto;
            padding: 2px 6px;
            background: rgba(0, 212, 255, 0.1);
            border-radius: 8px;
            border: 1px solid rgba(0, 212, 255, 0.3);
            text-transform: uppercase;
            letter-spacing: 1px;
            animation: flicker 3s infinite;
        }

        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            z-index: 1;
        }

        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            scroll-behavior: smooth;
        }
        
        .message {
            margin-bottom: 12px;
            animation: slideInMatrix 0.5s ease-out;
            width: 100%;
        }
        
        .message.user {
            display: flex;
            justify-content: flex-end;
        }
        
        .message.assistant {
            display: flex;
            justify-content: flex-start;
        }
        
        .message-content {
            width: 100%;
            max-width: none;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 11px;
            line-height: 1.5;
            word-wrap: break-word;
            position: relative;
            backdrop-filter: blur(10px);
        }
        
        .message.user .message-content {
            background: linear-gradient(135deg, var(--hacker-accent) 0%, var(--hacker-accent-dark) 100%);
            color: var(--hacker-bg-primary);
            border-bottom-right-radius: 2px;
            box-shadow: var(--hacker-glow);
            font-weight: 500;
            max-width: 85%;
        }
        
        .message.assistant .message-content {
            background: rgba(26, 26, 46, 0.8);
            color: var(--hacker-text-primary);
            border: 1px solid var(--hacker-border);
            border-bottom-left-radius: 2px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }
        
        .message.assistant .message-content::before {
            content: '> ';
            color: var(--hacker-accent);
            font-weight: bold;
        }
        
        /* Markdown Styles */
        .message-content h1, .message-content h2, .message-content h3 {
            color: var(--hacker-accent);
            margin: 8px 0 4px 0;
            font-size: 12px;
            font-weight: bold;
        }
        
        .message-content h1 { font-size: 13px; }
        .message-content h2 { font-size: 12px; }
        .message-content h3 { font-size: 11px; }
        
        .message-content p {
            margin: 4px 0;
            font-size: 11px;
        }
        
        .message-content code {
            background: rgba(0, 212, 255, 0.1);
            color: var(--hacker-accent);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            border: 1px solid rgba(0, 212, 255, 0.2);
        }
        
        .message-content pre {
            background: var(--hacker-bg-primary);
            border: 1px solid var(--hacker-border);
            border-radius: 4px;
            padding: 8px;
            margin: 6px 0;
            overflow-x: auto;
            font-size: 10px;
            box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3);
        }
        
        .message-content pre code {
            background: none;
            border: none;
            padding: 0;
            font-size: 10px;
        }
        
        .message-content ul, .message-content ol {
            margin: 4px 0;
            padding-left: 16px;
            font-size: 11px;
        }
        
        .message-content li {
            margin: 2px 0;
        }
        
        .message-content blockquote {
            border-left: 2px solid var(--hacker-accent);
            margin: 6px 0;
            padding-left: 8px;
            color: var(--hacker-text-secondary);
            font-style: italic;
            font-size: 11px;
        }
        
        .message-content strong {
            color: var(--hacker-accent);
            font-weight: bold;
        }
        
        .message-content em {
            color: var(--hacker-text-secondary);
            font-style: italic;
        }
        
        .message-content a {
            color: var(--hacker-accent);
            text-decoration: underline;
            cursor: pointer;
        }
        
        .message-content a:hover {
            color: var(--hacker-accent-dark);
        }
        
        .input-container {
            padding: 12px;
            background: var(--hacker-bg-secondary);
            border-top: 1px solid var(--hacker-border);
            position: relative;
            z-index: 2;
        }

        .input-wrapper {
            display: flex;
            align-items: flex-end;
            gap: 8px;
            position: relative;
            background: var(--hacker-bg-tertiary);
            border-radius: 16px;
            border: 1px solid var(--hacker-border);
            padding: 3px;
            transition: all 0.3s ease;
            width: 100%;
        }

        .input-wrapper:focus-within {
            border-color: var(--hacker-accent);
            box-shadow: var(--hacker-glow);
        }

        .input-field {
            flex: 1;
            min-height: 32px;
            max-height: 80px;
            padding: 8px 12px;
            padding-right: 50px;
            border: none;
            border-radius: 14px;
            background: transparent;
            color: var(--hacker-text-primary);
            font-size: 11px;
            line-height: 1.3;
            resize: none;
            outline: none;
            font-family: inherit;
            width: 100%;
        }

        .input-field::placeholder {
            color: var(--hacker-text-muted);
            font-size: 11px;
        }

        .send-button {
            position: absolute;
            right: 4px;
            bottom: 4px;
            width: 28px;
            height: 28px;
            border: none;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--hacker-accent) 0%, var(--hacker-accent-dark) 100%);
            color: var(--hacker-bg-primary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            font-size: 14px;
            font-weight: bold;
            box-shadow: var(--hacker-glow);
        }

        .send-button:hover:not(:disabled) {
            transform: scale(1.1);
            box-shadow: 0 0 25px rgba(0, 212, 255, 0.6);
        }

        .send-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .typing-indicator {
            display: none;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            color: var(--hacker-accent);
            font-style: italic;
            animation: flicker 2s infinite;
            font-size: 10px;
        }

        .typing-dots {
            display: flex;
            gap: 4px;
        }

        .typing-dots span {
            width: 6px;
            height: 6px;
            background: var(--hacker-accent);
            border-radius: 50%;
            animation: matrixPulse 1.4s infinite ease-in-out;
            box-shadow: 0 0 8px var(--hacker-accent);
        }

        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

        .welcome-message {
            text-align: center;
            padding: 40px 16px;
            color: var(--hacker-text-secondary);
        }

        .welcome-icon {
            font-size: 48px;
            margin-bottom: 16px;
            animation: float 3s ease-in-out infinite;
            filter: drop-shadow(0 0 15px var(--hacker-accent));
        }

        .welcome-text {
            font-size: 16px;
            margin-bottom: 8px;
            color: var(--hacker-text-primary);
            text-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
            font-weight: 600;
        }

        .welcome-subtitle {
            font-size: 11px;
            color: var(--hacker-accent);
            opacity: 0.8;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        /* Animations */
        @keyframes slideInMatrix {
            from {
                opacity: 0;
                transform: translateX(-20px) translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateX(0) translateY(0);
            }
        }

        @keyframes matrixPulse {
            0%, 80%, 100% {
                transform: scale(0.8);
                opacity: 0.3;
            }
            40% {
                transform: scale(1.2);
                opacity: 1;
            }
        }

        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 20px rgba(0, 212, 255, 0.3); }
            50% { box-shadow: 0 0 30px rgba(0, 212, 255, 0.6); }
        }

        @keyframes flicker {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }

        /* Scrollbar styling */
        .messages::-webkit-scrollbar {
            width: 8px;
        }

        .messages::-webkit-scrollbar-track {
            background: var(--hacker-bg-secondary);
            border-radius: 4px;
        }

        .messages::-webkit-scrollbar-thumb {
            background: linear-gradient(var(--hacker-accent), var(--hacker-accent-dark));
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
        }

        .messages::-webkit-scrollbar-thumb:hover {
            box-shadow: 0 0 15px rgba(0, 212, 255, 0.5);
        }

        /* Matrix-like terminal effect */
        .terminal-line {
            font-family: 'Courier New', monospace;
            color: var(--hacker-accent);
            opacity: 0.7;
            font-size: 12px;
            margin: 2px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">⚡</div>
        <div class="title">xCOPILOT</div>
        <div class="subtitle">NEURAL NET</div>
    </div>

    <div class="chat-container">
        <div class="messages" id="messages">
            <div class="welcome-message">
                <div class="welcome-icon">🕴️</div>
                <div class="welcome-text">SISTEMA INICIALIZADO</div>
                <div class="welcome-subtitle">ANONYMOUS AI READY</div>
            </div>
        </div>

        <div class="typing-indicator" id="typingIndicator">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span>PROCESSANDO...</span>
        </div>

        <div class="input-container">
            <div class="input-wrapper">
                <textarea
                    id="prompt"
                    class="input-field"
                    placeholder=">>> Digite seu comando..."
                    rows="1"
                ></textarea>
                <button id="send" class="send-button" title="Executar comando">
                    ▶
                </button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const promptInput = document.getElementById('prompt');
        const sendButton = document.getElementById('send');
        const messagesContainer = document.getElementById('messages');
        const typingIndicator = document.getElementById('typingIndicator');

        let isWaitingResponse = false;
        
        // Simple markdown parser
        function parseMarkdown(text) {
            return text
        }

        // Auto-resize textarea
        promptInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        });

        function addMessage(content, isUser) {
            const welcomeMsg = messagesContainer.querySelector('.welcome-message');
            if (welcomeMsg && isUser) {
                welcomeMsg.remove();
            }

            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + (isUser ? 'user' : 'assistant');

            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            if (isUser) {
                contentDiv.textContent = content;
            } else {
                contentDiv.innerHTML = parseMarkdown(content);
            }

            messageDiv.appendChild(contentDiv);
            messagesContainer.appendChild(messageDiv);

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function showTyping() {
            typingIndicator.style.display = 'flex';
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function hideTyping() {
            typingIndicator.style.display = 'none';
        }

        function sendMessage() {
            const prompt = promptInput.value.trim();
            if (!prompt || isWaitingResponse) return;

            // Add user message
            addMessage(prompt, true);

            // Clear input
            promptInput.value = '';
            promptInput.style.height = 'auto';

            // Show typing indicator
            isWaitingResponse = true;
            sendButton.disabled = true;
            showTyping();

            // Send to backend
            vscode.postMessage({ type: 'ask', prompt: prompt });
        }

        sendButton.addEventListener('click', sendMessage);

        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'answer') {
                hideTyping();
                addMessage(message.text, false);
                isWaitingResponse = false;
                sendButton.disabled = false;
                promptInput.focus();
            }
        });

        // Focus input on load
        promptInput.focus();
    </script>
</body>
</html>`;
}
