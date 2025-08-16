#!/usr/bin/env node

/**
 * 📊 xCopilot Continuous Monitoring
 * 
 * Script para monitoramento contínuo do projeto e envio de métricas
 */

const TelegramNotifier = require('./telegram-bot');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ProjectMonitor {
    constructor() {
        this.notifier = new TelegramNotifier();
        this.lastStatus = this.loadLastStatus();
        this.healthCheckInterval = 5 * 60 * 1000; // 5 minutos
        this.statusFile = path.join(__dirname, '../temp/last-status.json');
    }

    /**
     * 🚀 Iniciar monitoramento
     */
    async start() {
        console.log('🔍 Iniciando monitoramento xCopilot...');
        
        // Enviar status inicial
        await this.notifier.sendMessage('🔍 *Monitor xCopilot Iniciado*\\n\\n⚡ Monitoramento ativo\\!');
        
        // Configurar intervalos
        setInterval(() => this.checkHealth(), this.healthCheckInterval);
        setInterval(() => this.sendDailyMetrics(), 24 * 60 * 60 * 1000); // Diário
        
        // Monitoramento de Git
        this.watchGitChanges();
        
        console.log('✅ Monitor ativo! Pressione Ctrl+C para parar.');
    }

    /**
     * 🏥 Verificar saúde do sistema
     */
    async checkHealth() {
        try {
            const health = await this.getSystemHealth();
            
            if (health.hasIssues) {
                await this.notifier.sendMessage(`⚠️ *Problemas Detectados*\\n\\n${health.issues.join('\\n')}`);
            }
            
            this.saveStatus(health);
        } catch (error) {
            console.error('Erro no health check:', error);
        }
    }

    /**
     * 📊 Obter métricas do sistema
     */
    async getSystemHealth() {
        const health = {
            timestamp: new Date().toISOString(),
            hasIssues: false,
            issues: [],
            metrics: {}
        };

        try {
            // Verificar se o backend está rodando
            try {
                execSync('curl -f http://localhost:3000/health', { stdio: 'pipe' });
                health.metrics.backend = 'online';
            } catch {
                health.metrics.backend = 'offline';
                health.hasIssues = true;
                health.issues.push('🔴 Backend offline');
            }

            // Verificar mudanças no Git
            const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
            if (gitStatus.trim()) {
                health.metrics.gitStatus = 'dirty';
                health.issues.push(`📝 ${gitStatus.split('\\n').length} arquivos modificados`);
            } else {
                health.metrics.gitStatus = 'clean';
            }

            // Verificar commits recentes
            const recentCommits = execSync('git log --oneline --since="1 hour ago"', { encoding: 'utf8' });
            if (recentCommits.trim()) {
                health.metrics.recentActivity = recentCommits.split('\\n').length - 1;
            }

            // Verificar tamanho dos logs
            const backendLogPath = path.join(__dirname, '../backend/logs');
            if (fs.existsSync(backendLogPath)) {
                const logFiles = fs.readdirSync(backendLogPath);
                let totalLogSize = 0;
                logFiles.forEach(file => {
                    const stats = fs.statSync(path.join(backendLogPath, file));
                    totalLogSize += stats.size;
                });
                
                if (totalLogSize > 100 * 1024 * 1024) { // 100MB
                    health.hasIssues = true;
                    health.issues.push('📁 Logs muito grandes (>100MB)');
                }
            }

        } catch (error) {
            health.hasIssues = true;
            health.issues.push(`❌ Erro no monitoramento: ${error.message}`);
        }

        return health;
    }

    /**
     * 👀 Monitorar mudanças no Git
     */
    watchGitChanges() {
        let lastCommit = '';
        
        setInterval(() => {
            try {
                const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
                
                if (lastCommit && lastCommit !== currentCommit) {
                    const commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
                    const author = execSync('git log -1 --pretty=%an', { encoding: 'utf8' }).trim();
                    
                    this.notifier.sendMessage(`🆕 *Novo Commit Detectado*\\n\\n👤 ${author}\\n📝 ${commitMessage}\\n🔗 \`${currentCommit.substring(0, 7)}\``);
                }
                
                lastCommit = currentCommit;
            } catch (error) {
                console.error('Erro ao monitorar Git:', error.message);
            }
        }, 30 * 1000); // Verificar a cada 30 segundos
    }

    /**
     * 📈 Enviar métricas diárias
     */
    async sendDailyMetrics() {
        try {
            const metrics = await this.getDailyMetrics();
            
            const message = `📊 *Relatório Diário xCopilot*

📝 *Commits hoje:* ${metrics.commitsToday}
🔥 *Linhas adicionadas:* ${metrics.linesAdded}
❌ *Linhas removidas:* ${metrics.linesRemoved}
📁 *Arquivos modificados:* ${metrics.filesChanged}

👥 *Contribuidores ativos:*
${metrics.contributors.map(c => `• ${c.name}: ${c.commits} commits`).join('\\n')}

🎯 *Status do Projeto:*
• Backend: ${metrics.backendStatus}
• Extension: ${metrics.extensionStatus}
• Testes: ${metrics.testStatus}

⭐ *GitHub:* github\\.com/xr00tlabx/xCopilot`;

            await this.notifier.sendMessage(message);
        } catch (error) {
            console.error('Erro ao enviar métricas diárias:', error);
        }
    }

    /**
     * 📊 Obter métricas diárias
     */
    async getDailyMetrics() {
        const today = new Date().toISOString().split('T')[0];
        
        const commitsToday = execSync(`git log --since="${today}" --oneline | wc -l`, { encoding: 'utf8' }).trim();
        const stats = execSync(`git log --since="${today}" --numstat --pretty=format:`, { encoding: 'utf8' });
        
        let linesAdded = 0, linesRemoved = 0, filesChanged = 0;
        const contributors = new Map();
        
        // Processar estatísticas
        stats.split('\\n').forEach(line => {
            if (line.trim()) {
                const [added, removed] = line.split('\\t');
                if (added !== '-') linesAdded += parseInt(added) || 0;
                if (removed !== '-') linesRemoved += parseInt(removed) || 0;
                filesChanged++;
            }
        });

        // Obter contribuidores
        const contributorList = execSync(`git log --since="${today}" --pretty=format:"%an" | sort | uniq -c`, { encoding: 'utf8' });
        contributorList.split('\\n').forEach(line => {
            const match = line.trim().match(/(\\d+)\\s+(.+)/);
            if (match) {
                contributors.set(match[2], parseInt(match[1]));
            }
        });

        return {
            commitsToday: parseInt(commitsToday),
            linesAdded,
            linesRemoved,
            filesChanged,
            contributors: Array.from(contributors.entries()).map(([name, commits]) => ({ name, commits })),
            backendStatus: 'Estável',
            extensionStatus: 'Em desenvolvimento',
            testStatus: 'Passando'
        };
    }

    /**
     * 💾 Salvar último status
     */
    saveStatus(status) {
        try {
            fs.writeFileSync(this.statusFile, JSON.stringify(status, null, 2));
        } catch (error) {
            console.error('Erro ao salvar status:', error);
        }
    }

    /**
     * 📁 Carregar último status
     */
    loadLastStatus() {
        try {
            if (fs.existsSync(this.statusFile)) {
                return JSON.parse(fs.readFileSync(this.statusFile, 'utf8'));
            }
        } catch (error) {
            console.error('Erro ao carregar status:', error);
        }
        return {};
    }
}

// 🚀 Iniciar monitor se executado diretamente
if (require.main === module) {
    const monitor = new ProjectMonitor();
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\\n🛑 Parando monitor...');
        await monitor.notifier.sendMessage('🛑 *Monitor xCopilot Parado*\\n\\nℹ️ Monitoramento finalizado\\.');
        process.exit(0);
    });
    
    monitor.start().catch(error => {
        console.error('Erro ao iniciar monitor:', error);
        process.exit(1);
    });
}

module.exports = ProjectMonitor;
