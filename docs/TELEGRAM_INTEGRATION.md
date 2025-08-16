# 📱 Telegram Integration - xCopilot

Este guia mostra como configurar notificações automáticas do Telegram para o projeto xCopilot.

## 🚀 Configuração Rápida

### 1. Configurar GitHub Secrets

Vá em `Settings > Secrets and variables > Actions` no seu repositório GitHub e adicione:

```
TELEGRAM_BOT_TOKEN = 7635832623:AAHSEq2p5OFDPKLl_kztVh4kCVQQ_pGv8UI
TELEGRAM_CHAT_ID = -1002781291666
```

### 2. Testar Localmente

```bash
# Clonar e configurar
git clone https://github.com/xr00tlabx/xCopilot.git
cd xCopilot

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações

# Testar notificação
node scripts/telegram-bot.js status
```

## 🤖 Comandos do Bot

```bash
# Status do projeto
node scripts/telegram-bot.js status

# Resultados de teste
node scripts/telegram-bot.js test success 10 8 2

# Notificação de deploy
node scripts/telegram-bot.js deploy production 1.0.0 success

# Métricas de desenvolvimento
node scripts/telegram-bot.js metrics

# Mensagem personalizada
node scripts/telegram-bot.js custom "Deploy realizado! 🎉"
```

## 🔄 Workflows Automáticos

### Eventos que Triggam Notificações:

- ✅ **Push** para master/dev
- ✅ **Pull Request** aberto/fechado/merged
- ✅ **Release** publicada
- ✅ **Build Success/Failure**

### Mensagens Automáticas:

#### 🔥 Push Notification
```
🔥 NOVO PUSH no xCopilot!

🌿 Branch: `master`
👤 Author: xr00tlabx
🔗 Commit: `abc123`

📝 Mensagem:
Adicionar feature de inline completion

🔗 Ver no GitHub
```

#### 🎯 Pull Request
```
🎯 NOVO PULL REQUEST no xCopilot!

🆔 PR #29
👤 Author: xr00tlabx
🌿 Branch: `feature/inline-completion` → `master`

📝 Título:
Implementar sugestões de código em tempo real

🔗 Revisar PR
```

#### ✅ Merge Success
```
✅ PR MERGED no xCopilot!

🆔 PR #29
👤 Author: xr00tlabx
🌿 Branch: `feature/inline-completion` → `master`

📝 Título:
Implementar sugestões de código em tempo real

🎉 Status: MERGED com sucesso!
```

#### 🚀 Release
```
🚀 NOVA RELEASE do xCopilot!

🏷️ Versão: v1.0.0
👤 Author: xr00tlabx

📝 Nome:
xCopilot v1.0.0 - GitHub Copilot Level Features

🔗 Download Release
```

#### ✅ Build Success
```
✅ BUILD SUCCESS no xCopilot!

🔄 Workflow: Build and Test xCopilot
🌿 Branch: `master`
👤 Author: xr00tlabx

✨ Status: Compilação bem-sucedida!
```

#### ❌ Build Failure
```
❌ BUILD FAILED no xCopilot!

🔄 Workflow: Build and Test xCopilot
🌿 Branch: `feature/inline-completion`
👤 Author: xr00tlabx

⚠️ Status: Falha na compilação!
```

## 📊 Métricas de Desenvolvimento

O bot envia automaticamente métricas semanais:

```
📈 Métricas Semanais xCopilot

📊 Commits esta semana: 15
👥 Top Contributors:
     8  xr00tlabx
     4  copilot-agent
     3  contributor

🔥 Progresso:
• InlineCompletion em desenvolvimento
• Melhorias na UI/UX
• Otimizações de performance
• Documentação atualizada

⭐ GitHub: github.com/xr00tlabx/xCopilot
```

## 🛠️ Personalização

### Adicionar Novos Eventos

Edite `.github/workflows/telegram-notifications.yml`:

```yaml
on:
  issues:
    types: [opened, closed]
  # Adicione outros eventos aqui
```

### Customizar Mensagens

Modifique `scripts/telegram-bot.js` para adicionar novos tipos de notificação:

```javascript
async sendCustomNotification(type, data) {
    const message = `🎯 ${type.toUpperCase()}
    
📝 ${data.message}
⏰ ${new Date().toLocaleString('pt-BR')}`;
    
    await this.sendMessage(message);
}
```

## 🔐 Segurança

- ✅ Use GitHub Secrets para tokens em produção
- ✅ Nunca commite tokens no código
- ✅ Rotacione tokens periodicamente
- ✅ Use chat privado ou grupo fechado

## 🎯 Monitoramento

### Dashboard de Status

Crie um chat dedicado para monitoramento:

1. Crie um grupo/canal no Telegram
2. Adicione o bot como administrador
3. Configure TELEGRAM_CHAT_ID com o ID do grupo
4. Configure workflows para eventos específicos

### Alertas Críticos

Para eventos críticos (falhas de segurança, downtime), configure notificações urgentes:

```javascript
// Em scripts/telegram-bot.js
async sendCriticalAlert(message) {
    await this.sendMessage(`🚨 ALERTA CRÍTICO 🚨\n\n${message}`);
    // Opcionalmente, enviar para múltiplos chats
}
```

## 📞 Suporte

Se você encontrar problemas:

1. Verifique se o bot token está correto
2. Confirme se o chat ID está correto
3. Teste localmente primeiro
4. Verifique os logs do GitHub Actions
5. Abra uma issue no repositório

---

🤖 **Bot desenvolvido para xCopilot** - Bringing GitHub Copilot level features to VS Code!
