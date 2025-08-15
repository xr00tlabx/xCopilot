// Script simples para testar SSE manualmente
const http = require('http');

const prompt = process.argv.slice(2).join(' ') || 'teste sse demo';
const data = JSON.stringify({ prompt });

const req = http.request({
    method: 'POST',
    hostname: 'localhost',
    port: process.env.PORT || 3000,
    path: '/openai/stream',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Content-Length': Buffer.byteLength(data)
    }
}, res => {
    console.log('Status:', res.statusCode);
    res.setEncoding('utf8');
    res.on('data', chunk => {
        process.stdout.write(chunk);
    });
    res.on('end', () => {
        console.log('\n[FIM SSE]');
    });
});

req.on('error', err => {
    console.error('Erro req:', err);
});

req.write(data);
req.end();
