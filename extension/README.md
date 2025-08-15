# xCopilot - VS Code Extension

🤖 **Assistente de AI integrado ao VS Code para desenvolvimento com arquitetura hacker-style.**

## ✨ Características

- **Interface Cyberpunk**: Design futurista com tema hacker
- **Chat Integrado**: Converse com a AI diretamente no VS Code
- **Backend Customizável**: Configure seu próprio endpoint de AI
- **Arquitetura Modular**: Código limpo e extensível
- **Logging Avançado**: Sistema de logs completo

## 🚀 Instalação

### Via Marketplace (em breve)
```bash
code --install-extension xr00tlabx.xcopilot-extension
```

### Via VSIX (desenvolvimento)
1. Baixe o arquivo `.vsix` do projeto
2. Abra VS Code
3. `Ctrl+Shift+P` → "Extensions: Install from VSIX..."
4. Selecione o arquivo baixado

## ⚙️ Configuração

1. **Configure o Backend URL**:
   - `File > Preferences > Settings`
   - Procure por "xCopilot"
   - Defina `xcopilot.backendUrl` (padrão: `http://localhost:3000/openai`)

2. **Inicie o Backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

## 🎯 Como Usar

### Método 1: Interface Gráfica
1. Clique no ícone ⚡ **xCopilot** na barra lateral
2. Digite sua pergunta no chat
3. Pressione Enter ou clique em ▶

### Método 2: Comando Rápido
1. `Ctrl+Shift+P`
2. Digite "xCopilot: Perguntar"
3. Digite sua pergunta

### Método 3: Atalho de Teclado
- Configure um atalho personalizado para `xcopilot.ask`

## 🔧 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `xcopilot.ask` | Fazer pergunta via input box |
| `xcopilot.test` | Testar funcionamento da extensão |
| `xcopilot.openChat` | Abrir interface do chat |

## 🏗️ Arquitetura

```
src/
├── extension.ts              # Ponto de entrada
├── ExtensionManager.ts       # Gerenciador principal
├── commands/                 # Comandos da extensão
├── services/                 # Lógica de negócio
├── views/                    # Interface do usuário
├── types/                    # Definições TypeScript
└── utils/                    # Utilitários
```

## 🧪 Desenvolvimento

### Build Local
```bash
npm install
npm run build
```

### Watch Mode
```bash
npm run dev
```

### Empacotar
```bash
npm run package
```

### Testes
```bash
npm test
```

## 🐛 Resolução de Problemas

### Backend não conecta
- Verifique se o backend está rodando na porta correta
- Confirme a URL em Settings > xCopilot
- Verifique os logs no Output Channel "xCopilot"

### Extensão não carrega
- Recarregue o VS Code (`Ctrl+Shift+P` → "Developer: Reload Window")
- Verifique se há erros no Developer Console (`Help > Toggle Developer Tools`)

## 📝 Changelog

### v0.1.0
- ✨ Interface de chat com tema cyberpunk
- 🔧 Arquitetura modular e extensível
- 🚀 Integração com backend customizável
- 📊 Sistema de logging avançado

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

## 👥 Autores

- **xr00tlabx** - *Trabalho inicial* - [GitHub](https://github.com/xr00tlabx)

## 🙏 Agradecimentos

- VS Code Extension API
- OpenAI pela inspiração
- Comunidade open source
