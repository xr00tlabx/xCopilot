# Testes Backend xCopilot

## Como executar
1. Inicie o servidor: `npm run dev` (na pasta backend)
2. Use os arquivos `.http` neste diretório para testar endpoints.

## Endpoints
- `GET /health` - Verifica status do servidor
- `GET /config` - Verifica se variáveis de ambiente estão carregadas
- `POST /openai` - Gera resposta via OpenAI (necessita OPENAI_API_KEY)

### Exemplo (POST /openai)
Body:
```json
{ "prompt": "Explique o que é Node.js" }
```
