#!/bin/bash

# 🚀 xCopilot Environment Setup Script
# Este script configura o ambiente de desenvolvimento completo

echo "🚀 Configurando ambiente xCopilot..."

# 📁 Criar estrutura de diretórios
echo "📁 Criando estrutura de diretórios..."
mkdir -p logs
mkdir -p temp
mkdir -p .vscode

# 📋 Copiar arquivo de ambiente
if [ ! -f .env ]; then
    echo "📋 Copiando arquivo .env.example para .env..."
    cp .env.example .env
    echo "⚠️  LEMBRE-SE: Configure suas chaves de API no arquivo .env"
fi

# 📦 Instalar dependências do backend
echo "📦 Instalando dependências do backend..."
cd backend || exit
npm install
cd ..

# 📦 Instalar dependências da extensão
echo "📦 Instalando dependências da extensão..."
cd extension || exit
npm install
cd ..

# 🔧 Configurar Git Hooks (opcional)
echo "🔧 Configurando Git Hooks..."
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# xCopilot Pre-commit Hook

echo "🔍 Executando verificações pré-commit..."

# Verificar sintaxe TypeScript
cd extension
npm run compile
if [ $? -ne 0 ]; then
    echo "❌ Erro na compilação TypeScript!"
    exit 1
fi
cd ..

# Verificar backend
cd backend
node -c index.js
if [ $? -ne 0 ]; then
    echo "❌ Erro na sintaxe do backend!"
    exit 1
fi
cd ..

echo "✅ Verificações pré-commit aprovadas!"
EOF

chmod +x .git/hooks/pre-commit

# 🎯 Configurar VS Code settings
echo "🎯 Configurando VS Code settings..."
cat > .vscode/settings.json << 'EOF'
{
    "typescript.preferences.includePackageJsonAutoImports": "on",
    "typescript.suggest.autoImports": true,
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll": true
    },
    "files.exclude": {
        "**/node_modules": true,
        "**/out": true,
        "**/.git": true
    },
    "search.exclude": {
        "**/node_modules": true,
        "**/out": true
    }
}
EOF

# 🚀 Configurar tarefas do VS Code
cat > .vscode/tasks.json << 'EOF'
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "🚀 Start Backend",
            "type": "shell",
            "command": "npm run dev",
            "options": {
                "cwd": "${workspaceFolder}/backend"
            },
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "presentation": {
                "echo": true,
                "reveal": "always",
                "focus": false,
                "panel": "new"
            },
            "problemMatcher": []
        },
        {
            "label": "🔨 Compile Extension",
            "type": "shell",
            "command": "npm run compile",
            "options": {
                "cwd": "${workspaceFolder}/extension"
            },
            "group": "build",
            "presentation": {
                "echo": true,
                "reveal": "silent",
                "focus": false,
                "panel": "shared"
            },
            "problemMatcher": "$tsc"
        },
        {
            "label": "📦 Package Extension",
            "type": "shell",
            "command": "vsce package",
            "options": {
                "cwd": "${workspaceFolder}/extension"
            },
            "group": "build",
            "dependsOn": "🔨 Compile Extension"
        },
        {
            "label": "📱 Test Telegram Bot",
            "type": "shell",
            "command": "node scripts/telegram-bot.js status",
            "group": "test",
            "presentation": {
                "echo": true,
                "reveal": "always",
                "focus": false,
                "panel": "new"
            }
        }
    ]
}
EOF

# 🎯 Configurar launch.json para debugging
cat > .vscode/launch.json << 'EOF'
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "🐛 Debug Extension",
            "type": "extensionHost",
            "request": "launch",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}/extension"
            ],
            "outFiles": [
                "${workspaceFolder}/extension/out/**/*.js"
            ],
            "preLaunchTask": "🔨 Compile Extension"
        },
        {
            "name": "🐛 Debug Backend",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/backend/index.js",
            "env": {
                "NODE_ENV": "development"
            },
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen"
        }
    ]
}
EOF

echo ""
echo "✅ Configuração concluída com sucesso!"
echo ""
echo "🎯 Próximos passos:"
echo "1. Configure as chaves de API no arquivo .env"
echo "2. Execute 'npm run dev' no diretório backend"
echo "3. Pressione F5 para testar a extensão"
echo "4. Use 'node scripts/telegram-bot.js status' para testar o Telegram"
echo ""
echo "📱 Para configurar GitHub Secrets:"
echo "   - TELEGRAM_BOT_TOKEN: 7635832623:AAHSEq2p5OFDPKLl_kztVh4kCVQQ_pGv8UI"
echo "   - TELEGRAM_BOT_TOKEN: <sua_token_aqui>"
echo "   - TELEGRAM_CHAT_ID: <seu_chat_id_aqui>"
echo ""
