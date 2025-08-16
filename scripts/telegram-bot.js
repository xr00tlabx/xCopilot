#!/usr/bin/env node

/**
 * 🤖 xCopilot Telegram Notification Bot
 * 
 * Script para enviar notificações personalizadas para o Telegram
 * Uso: node telegram-bot.js [message] [--dev]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 🔐 Configurações do Bot (use variáveis de ambiente em produção)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7635832623:AAHSEq2p5OFDPKLl_kztVh4kCVQQ_pGv8UI';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || -1002781291666;

class TelegramNotifier {
    constructor() {
        this.baseUrl = TELEGRAM_API;
        this.chatId = CHAT_ID;
    }

    /**
     * 📱 Enviar mensagem para o Telegram
     */
    async sendMessage(text, options = {}) {
        // Escapar caracteres especiais para MarkdownV2
        const escapedText = this.escapeMarkdownV2(text);
        
        const payload = {
            chat_id: this.chatId,
            text: escapedText,
            parse_mode: options.parseMode || 'MarkdownV2',
            disable_web_page_preview: options.disablePreview !== false,
            ...options
        };

        return this.makeRequest('sendMessage', payload);
    }

    /**
     * 🔧 Escapar caracteres especiais para MarkdownV2
     */
    escapeMarkdownV2(text) {
        // Caracteres que precisam ser escapados em MarkdownV2
        const specialChars = /[_*[\]()~`>#+\-=|{}.!]/g;
        return text.replace(specialChars, '\\$&');
    }

    /**
     * 📊 Enviar status do projeto
     */
    async sendProjectStatus() {
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../extension/package.json'), 'utf8'));
            const gitBranch = require('child_process').execSync('git branch --show-current', { encoding: 'utf8' }).trim();
            const gitCommit = require('child_process').execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
            
            const message = `🚀 *xCopilot Status Report*

📦 *Versão:* \`${packageJson.version}\`
🌿 *Branch:* \`${gitBranch}\`
🔗 *Commit:* \`${gitCommit}\`
⏰ *Timestamp:* ${new Date().toLocaleString('pt-BR')}

🔧 *Componentes:*
• Backend: Express + OpenAI
• Extension: VS Code WebView
• Services: 8+ módulos especializados

✨ *Features Ativas:*
• Chat AI Integrado
• Sugestões de Código
• Histórico de Conversas
• Git Integration
• Refatoração Automática

🎯 *Status:* Desenvolvendo InlineCompletion`;

            await this.sendMessage(message);
            console.log('✅ Status enviado com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao enviar status:', error.message);
        }
    }

    /**
     * 🧪 Enviar resultados de teste
     */
    async sendTestResults(results) {
        const emoji = results.success ? '✅' : '❌';
        const status = results.success ? 'SUCESSO' : 'FALHA';
        
        const message = `${emoji} *Resultados dos Testes*

🎯 *Status:* ${status}
🔧 *Testes Executados:* ${results.total || 'N/A'}
✅ *Aprovados:* ${results.passed || 'N/A'}
❌ *Falharam:* ${results.failed || 'N/A'}
⏱️ *Duração:* ${results.duration || 'N/A'}

${results.details ? `📝 *Detalhes:*\n\`\`\`\n${results.details}\n\`\`\`` : ''}`;

        await this.sendMessage(message);
    }

    /**
     * 🔥 Enviar notificação de deploy
     */
    async sendDeployNotification(environment, version, success = true) {
        const emoji = success ? '🚀' : '💥';
        const status = success ? 'DEPLOY REALIZADO' : 'DEPLOY FALHOU';
        
        const message = `${emoji} *${status}*

🌍 *Ambiente:* ${environment}
📦 *Versão:* \`${version}\`
⏰ *Timestamp:* ${new Date().toLocaleString('pt-BR')}

${success ? '✨ xCopilot atualizado com sucesso!' : '⚠️ Verificar logs para detalhes do erro.'}`;

        await this.sendMessage(message);
    }

    /**
     * 📈 Enviar métricas de desenvolvimento
     */
    async sendDevelopmentMetrics() {
        try {
            const stats = require('child_process').execSync('git log --oneline --since="1 week ago" | wc -l', { encoding: 'utf8' }).trim();
            const contributors = require('child_process').execSync('git shortlog -sn --since="1 week ago" | head -5', { encoding: 'utf8' }).trim();
            
            const message = `📈 *Métricas Semanais xCopilot*

📊 *Commits esta semana:* ${stats}
👥 *Top Contributors:*
\`\`\`
${contributors}
\`\`\`

🔥 *Progresso:*
• InlineCompletion em desenvolvimento
• Melhorias na UI/UX
• Otimizações de performance
• Documentação atualizada

⭐ *GitHub:* github\\.com/xr00tlabx/xCopilot`;

            await this.sendMessage(message);
            console.log('✅ Métricas enviadas com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao enviar métricas:', error.message);
        }
    }

    /**
     * 🌐 Fazer requisição HTTP
     */
    makeRequest(method, payload) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(payload);
            const url = new URL(`${this.baseUrl}/${method}`);
            
            const options = {
                hostname: url.hostname,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(responseData);
                        if (response.ok) {
                            resolve(response.result);
                        } else {
                            reject(new Error(`Telegram API Error: ${response.description}`));
                        }
                    } catch (error) {
                        reject(new Error(`Parse Error: ${error.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }
}

// 🎯 CLI Interface
async function main() {
    const notifier = new TelegramNotifier();
    const args = process.argv.slice(2);
    const command = args[0];
    
    try {
        switch (command) {
            case 'status':
                await notifier.sendProjectStatus();
                break;
                
            case 'test':
                const testResults = {
                    success: args[1] !== 'fail',
                    total: args[2] || '10',
                    passed: args[3] || '8',
                    failed: args[4] || '2',
                    duration: '15.2s'
                };
                await notifier.sendTestResults(testResults);
                break;
                
            case 'deploy':
                await notifier.sendDeployNotification(
                    args[1] || 'production', 
                    args[2] || '1.0.0', 
                    args[3] !== 'fail'
                );
                break;
                
            case 'metrics':
                await notifier.sendDevelopmentMetrics();
                break;
                
            case 'custom':
                const message = args.slice(1).join(' ') || 'Mensagem de teste do xCopilot! 🚀';
                await notifier.sendMessage(message);
                console.log('✅ Mensagem personalizada enviada!');
                break;
                
            default:
                console.log(`
🤖 xCopilot Telegram Bot

Comandos disponíveis:
  status    - Enviar status do projeto
  test      - Enviar resultados de teste [success|fail] [total] [passed] [failed]
  deploy    - Enviar notificação de deploy [env] [version] [success|fail]
  metrics   - Enviar métricas de desenvolvimento
  custom    - Enviar mensagem personalizada [mensagem]

Exemplos:
  node telegram-bot.js status
  node telegram-bot.js test success 10 8 2
  node telegram-bot.js deploy production 1.0.0 success
  node telegram-bot.js custom "Deploy realizado com sucesso! 🎉"
                `);
        }
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

// 🚀 Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = TelegramNotifier;
