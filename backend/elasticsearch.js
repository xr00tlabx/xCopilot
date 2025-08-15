// Cliente Elasticsearch centralizado
const { Client } = require('@elastic/elasticsearch');

function buildEsClient() {
    const node = process.env.ELASTICSEARCH_NODE;
    if (!node) throw new Error('ELASTICSEARCH_NODE não definido');
    const auth = process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD
        ? { username: process.env.ELASTICSEARCH_USERNAME, password: process.env.ELASTICSEARCH_PASSWORD }
        : undefined;
    const sniffOnStart = process.env.ELASTICSEARCH_SNIFF_ON_START === 'true';
    const maxRetries = parseInt(process.env.ELASTICSEARCH_MAX_RETRIES || '3', 10);
    const requestTimeout = parseInt(process.env.ELASTICSEARCH_REQUEST_TIMEOUT || '60000', 10);
    const pingTimeout = parseInt(process.env.ELASTICSEARCH_PING_TIMEOUT || '10000', 10);
    const tlsRejectUnauthorized = process.env.ELASTICSEARCH_TLS_REJECT_UNAUTHORIZED !== 'false';

    return new Client({
        node,
        auth,
        sniffOnStart,
        maxRetries,
        requestTimeout,
        pingTimeout,
        tls: { rejectUnauthorized: tlsRejectUnauthorized }
    });
}

let client;
function getEsClient() {
    if (!client) client = buildEsClient();
    return client;
}

async function ensureIndex(index) {
    const es = getEsClient();
    const exists = await es.indices.exists({ index });
    if (!exists) {
        await es.indices.create({ index });
    }
}

async function indexSnippet({ id, content, language }) {
    const es = getEsClient();
    const index = process.env.ELASTICSEARCH_INDEX || 'xcopilot-snippets';
    await ensureIndex(index);
    await es.index({
        index,
        id,
        document: { content, language, ts: new Date().toISOString() }
    });
    await es.indices.refresh({ index });
}

async function searchSnippets(query) {
    const es = getEsClient();
    const index = process.env.ELASTICSEARCH_INDEX || 'xcopilot-snippets';
    try {
        // Garante que o índice exista; se não existir será criado vazio
        await ensureIndex(index);
        const { hits } = await es.search({
            index,
            query: { match: { content: query } },
            size: 5
        });
        return hits.hits.map(h => ({ id: h._id, score: h._score, ...h._source }));
    } catch (err) {
        // Se ainda assim der index_not_found, retorna lista vazia
        if (err?.meta?.body?.error?.type === 'index_not_found_exception') {
            return [];
        }
        throw err;
    }
}

module.exports = { indexSnippet, searchSnippets };
