# xCopilot Extension - Arquitetura

Este documento descreve a nova arquitetura modular da extensão xCopilot.

## Estrutura do Projeto

```
src/
├── extension.ts              # Ponto de entrada principal
├── ExtensionManager.ts       # Gerenciador principal da extensão
├── commands/                 # Comandos da extensão
│   ├── index.ts
│   └── ChatCommands.ts      # Comandos relacionados ao chat
├── services/                # Serviços de negócio
│   ├── index.ts
│   ├── BackendService.ts    # Comunicação com backend
│   └── ConfigurationService.ts # Gerenciamento de configurações
├── views/                   # Componentes de interface
│   ├── index.ts
│   ├── ChatWebviewProvider.ts # Provider da webview do chat
│   └── WebviewHtml.ts       # HTML/CSS da interface
├── types/                   # Tipos e interfaces
│   └── index.ts            # Definições de tipos TypeScript
└── utils/                   # Utilitários
    ├── index.ts
    └── Logger.ts           # Sistema de logging
```

## Componentes Principais

### 1. ExtensionManager
- **Responsabilidade**: Orquestrar a inicialização e configuração da extensão
- **Funcionalidades**:
  - Inicialização do sistema de logging
  - Registro do provider da webview
  - Configuração de comandos
  - Monitoramento de mudanças de configuração

### 2. Services

#### BackendService
- **Responsabilidade**: Comunicação com o backend da aplicação
- **Funcionalidades**:
  - Envio de perguntas para o backend
  - Tratamento de erros de rede
  - Teste de conectividade

#### ConfigurationService
- **Responsabilidade**: Gerenciamento das configurações da extensão
- **Funcionalidades**:
  - Leitura de configurações do workspace
  - Normalização de URLs do backend
  - Monitoramento de mudanças de configuração

### 3. Views

#### ChatWebviewProvider
- **Responsabilidade**: Gerenciar a webview do chat
- **Funcionalidades**:
  - Configuração da webview
  - Tratamento de mensagens entre webview e extensão
  - Interface programática para envio de perguntas

#### WebviewHtml
- **Responsabilidade**: Fornecer o HTML/CSS da interface
- **Funcionalidades**:
  - Interface de chat estilizada com tema hacker
  - JavaScript para interação com a extensão

### 4. Commands

#### ChatCommands
- **Responsabilidade**: Implementar comandos da extensão
- **Funcionalidades**:
  - Comando `xcopilot.ask` - Pergunta via input box
  - Comando `xcopilot.test` - Teste de funcionamento
  - Comando `xcopilot.openChat` - Abrir interface do chat

### 5. Utils

#### Logger
- **Responsabilidade**: Sistema de logging centralizado
- **Funcionalidades**:
  - Logs em console e output channel
  - Diferentes níveis de log (info, error, warn, debug)

## Padrões de Design Utilizados

### 1. Singleton Pattern
- **ConfigurationService**: Garante uma única instância de configuração
- **BackendService**: Garante uma única instância para comunicação

### 2. Provider Pattern
- **ChatWebviewProvider**: Implementa o padrão provider do VS Code

### 3. Separation of Concerns
- Cada módulo tem uma responsabilidade específica
- Interface separada da lógica de negócio
- Configuração isolada dos serviços

## Benefícios da Nova Arquitetura

### 1. Modularidade
- Código organizado em módulos com responsabilidades claras
- Facilita manutenção e evolução

### 2. Testabilidade
- Componentes isolados podem ser testados independentemente
- Injeção de dependências facilita mocking

### 3. Reutilização
- Serviços podem ser reutilizados em diferentes partes da extensão
- Facilita extensão de funcionalidades

### 4. Manutenibilidade
- Estrutura clara facilita localização de código
- Mudanças em um módulo não afetam outros

## Como Adicionar Novas Funcionalidades

### 1. Novo Comando
1. Adicionar método em `ChatCommands.ts`
2. Registrar comando em `registerCommands()`
3. Atualizar package.json se necessário

### 2. Novo Serviço
1. Criar arquivo em `src/services/`
2. Implementar padrão singleton se necessário
3. Exportar em `src/services/index.ts`
4. Integrar com `ExtensionManager.ts`

### 3. Nova View
1. Criar componente em `src/views/`
2. Implementar provider se necessário
3. Exportar em `src/views/index.ts`
4. Registrar em `ExtensionManager.ts`

## Configuração de Desenvolvimento

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run dev
```

### Package
```bash
npm run package
```
