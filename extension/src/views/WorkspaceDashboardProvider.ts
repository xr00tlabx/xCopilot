import * as vscode from 'vscode';
import { WorkspaceAnalysisService, WorkspaceAnalysisReport } from '../services/WorkspaceAnalysisService';
import { Logger } from '../utils/Logger';

/**
 * Provider para o dashboard de análise do workspace
 */
export class WorkspaceDashboardProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'xcopilot.workspaceDashboard';

    private _view?: vscode.WebviewView;
    private workspaceAnalysisService: WorkspaceAnalysisService;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        workspaceAnalysisService: WorkspaceAnalysisService
    ) {
        this.workspaceAnalysisService = workspaceAnalysisService;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this.getInitialWebviewContent(webviewView.webview);

        // Manipular mensagens da webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'runAnalysis':
                    await this.runWorkspaceAnalysis();
                    break;
                case 'runQuickAnalysis':
                    await this.runQuickAnalysis();
                    break;
                case 'clearCache':
                    this.workspaceAnalysisService.clearCache();
                    vscode.window.showInformationMessage('Cache de análise limpo!');
                    break;
                case 'refresh':
                    await this.runWorkspaceAnalysis();
                    break;
            }
        });

        // Executar análise inicial
        this.runQuickAnalysis();
    }

    /**
     * Executa análise completa do workspace
     */
    private async runWorkspaceAnalysis(): Promise<void> {
        if (!this._view) return;

        try {
            this._view.webview.postMessage({ type: 'analysisStarted' });
            
            const report = await this.workspaceAnalysisService.analyzeWorkspace();
            
            this._view.webview.postMessage({ 
                type: 'analysisComplete', 
                report 
            });

            Logger.info('Análise completa do workspace enviada para dashboard');
        } catch (error) {
            Logger.error('Erro na análise do workspace:', error);
            this._view.webview.postMessage({ 
                type: 'analysisError', 
                error: error instanceof Error ? error.message : 'Erro desconhecido' 
            });
        }
    }

    /**
     * Executa análise rápida
     */
    private async runQuickAnalysis(): Promise<void> {
        if (!this._view) return;

        try {
            this._view.webview.postMessage({ type: 'quickAnalysisStarted' });
            
            const report = await this.workspaceAnalysisService.quickAnalysis();
            
            this._view.webview.postMessage({ 
                type: 'quickAnalysisComplete', 
                report 
            });

            Logger.info('Análise rápida do workspace enviada para dashboard');
        } catch (error) {
            Logger.error('Erro na análise rápida:', error);
            this._view.webview.postMessage({ 
                type: 'analysisError', 
                error: error instanceof Error ? error.message : 'Erro na análise rápida' 
            });
        }
    }

    /**
     * Atualiza dashboard com novos dados
     */
    public updateDashboard(report: WorkspaceAnalysisReport): void {
        if (this._view) {
            this._view.webview.postMessage({ 
                type: 'updateDashboard', 
                report 
            });
        }
    }

    /**
     * Gera o conteúdo HTML inicial da webview
     */
    private getInitialWebviewContent(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workspace Intelligence Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 16px;
            line-height: 1.5;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header h1 {
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
        }

        .header-actions {
            display: flex;
            gap: 8px;
        }

        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .spinner {
            border: 2px solid var(--vscode-progressBar-background);
            border-top: 2px solid var(--vscode-progressBar-foreground);
            border-radius: 50%;
            width: 20px;
            height: 20px;
            animation: spin 1s linear infinite;
            margin-right: 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .dashboard {
            display: none;
        }

        .dashboard.visible {
            display: block;
        }

        .overview-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
        }

        .score-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .overall-score {
            font-size: 32px;
            font-weight: 700;
            color: var(--vscode-charts-green);
        }

        .score-label {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .project-info {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }

        .metric-card {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 12px;
            text-align: center;
        }

        .metric-value {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 4px;
        }

        .metric-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .metric-good { color: var(--vscode-charts-green); }
        .metric-warning { color: var(--vscode-charts-yellow); }
        .metric-error { color: var(--vscode-charts-red); }

        .section {
            margin-bottom: 20px;
        }

        .section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .insights-list, .recommendations-list {
            list-style: none;
        }

        .insights-list li, .recommendations-list li {
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-charts-blue);
            padding: 8px 12px;
            margin-bottom: 6px;
            border-radius: 0 4px 4px 0;
            font-size: 12px;
            line-height: 1.4;
        }

        .recommendations-list li {
            border-left-color: var(--vscode-charts-orange);
        }

        .details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 16px;
        }

        .detail-card {
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 12px;
        }

        .detail-card h4 {
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground);
        }

        .detail-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
            font-size: 11px;
        }

        .error-message {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-errorForeground);
            padding: 12px;
            border-radius: 4px;
            margin: 16px 0;
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .empty-state h3 {
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground);
        }

        .timestamp {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            text-align: right;
            margin-top: 16px;
        }

        .quick-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
            flex-wrap: wrap;
        }

        .btn-small {
            padding: 4px 8px;
            font-size: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔬 Workspace Intelligence</h1>
        <div class="header-actions">
            <button class="btn btn-secondary btn-small" onclick="runQuickAnalysis()">⚡ Rápida</button>
            <button class="btn btn-small" onclick="runFullAnalysis()">🔍 Completa</button>
            <button class="btn btn-secondary btn-small" onclick="clearCache()">🗑️ Limpar Cache</button>
            <button class="btn btn-secondary btn-small" onclick="refresh()">🔄 Atualizar</button>
        </div>
    </div>

    <div id="loading" class="loading">
        <div class="spinner"></div>
        Analisando workspace...
    </div>

    <div id="dashboard" class="dashboard">
        <div class="overview-card">
            <div class="score-container">
                <div>
                    <div id="overallScore" class="overall-score">--</div>
                    <div class="score-label">Score Geral</div>
                </div>
                <div class="project-info">
                    <div><strong id="projectName">--</strong></div>
                    <div id="timestamp" class="timestamp">--</div>
                </div>
            </div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div id="codeQualityScore" class="metric-value metric-good">--</div>
                <div class="metric-label">Qualidade</div>
            </div>
            <div class="metric-card">
                <div id="securityScore" class="metric-value metric-good">--</div>
                <div class="metric-label">Segurança</div>
            </div>
            <div class="metric-card">
                <div id="performanceScore" class="metric-value metric-good">--</div>
                <div class="metric-label">Performance</div>
            </div>
            <div class="metric-card">
                <div id="docCoverage" class="metric-value metric-good">--</div>
                <div class="metric-label">Documentação</div>
            </div>
            <div class="metric-card">
                <div id="totalPackages" class="metric-value">--</div>
                <div class="metric-label">Dependências</div>
            </div>
            <div class="metric-card">
                <div id="vulnerabilities" class="metric-value">--</div>
                <div class="metric-label">Vulnerabilidades</div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">💡 Insights Automáticos</div>
            <ul id="insightsList" class="insights-list">
                <li>Execute uma análise completa para ver insights personalizados</li>
            </ul>
        </div>

        <div class="section">
            <div class="section-title">🎯 Recomendações</div>
            <ul id="recommendationsList" class="recommendations-list">
                <li>Execute uma análise completa para ver recomendações de melhoria</li>
            </ul>
        </div>

        <div id="detailsSection" class="details-grid" style="display: none;">
            <div class="detail-card">
                <h4>🏗️ Arquitetura</h4>
                <div class="detail-item">
                    <span>Padrão:</span>
                    <span id="architecturePattern">--</span>
                </div>
                <div class="detail-item">
                    <span>Confiança:</span>
                    <span id="architectureConfidence">--</span>
                </div>
                <div class="detail-item">
                    <span>Acoplamento:</span>
                    <span id="coupling">--</span>
                </div>
            </div>

            <div class="detail-card">
                <h4>📊 Métricas de Código</h4>
                <div class="detail-item">
                    <span>Complexidade:</span>
                    <span id="complexity">--</span>
                </div>
                <div class="detail-item">
                    <span>Duplicação:</span>
                    <span id="duplication">--</span>
                </div>
                <div class="detail-item">
                    <span>Manutenibilidade:</span>
                    <span id="maintainability">--</span>
                </div>
            </div>

            <div class="detail-card">
                <h4>⚡ Performance</h4>
                <div class="detail-item">
                    <span>Bundle Size:</span>
                    <span id="bundleSize">--</span>
                </div>
                <div class="detail-item">
                    <span>Load Time:</span>
                    <span id="loadTime">--</span>
                </div>
            </div>

            <div class="detail-card">
                <h4>📦 Dependencies</h4>
                <div class="detail-item">
                    <span>Total:</span>
                    <span id="depTotal">--</span>
                </div>
                <div class="detail-item">
                    <span>Desatualizadas:</span>
                    <span id="depOutdated">--</span>
                </div>
                <div class="detail-item">
                    <span>Bundle:</span>
                    <span id="depBundleSize">--</span>
                </div>
            </div>
        </div>

        <div class="quick-actions">
            <button class="btn btn-secondary btn-small" onclick="exportReport()">📄 Exportar Relatório</button>
            <button class="btn btn-secondary btn-small" onclick="showTechnicalDebt()">⚠️ Technical Debt</button>
        </div>
    </div>

    <div id="error" class="error-message" style="display: none;"></div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentReport = null;

        // Event listeners
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.type) {
                case 'analysisStarted':
                    showLoading('Executando análise completa...');
                    break;
                case 'quickAnalysisStarted':
                    showLoading('Executando análise rápida...');
                    break;
                case 'analysisComplete':
                case 'quickAnalysisComplete':
                    hideLoading();
                    updateDashboard(message.report);
                    break;
                case 'analysisError':
                    hideLoading();
                    showError(message.error);
                    break;
                case 'updateDashboard':
                    updateDashboard(message.report);
                    break;
            }
        });

        function showLoading(message = 'Analisando...') {
            document.getElementById('loading').style.display = 'flex';
            document.getElementById('loading').innerHTML = \`
                <div class="spinner"></div>
                \${message}
            \`;
            document.getElementById('dashboard').classList.remove('visible');
            document.getElementById('error').style.display = 'none';
        }

        function hideLoading() {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('dashboard').classList.add('visible');
        }

        function showError(error) {
            const errorEl = document.getElementById('error');
            errorEl.textContent = \`Erro na análise: \${error}\`;
            errorEl.style.display = 'block';
        }

        function updateDashboard(report) {
            if (!report) return;
            
            currentReport = report;

            // Atualizar informações básicas
            document.getElementById('projectName').textContent = report.projectName || 'Projeto';
            document.getElementById('timestamp').textContent = report.timestamp ? 
                new Date(report.timestamp).toLocaleString() : '';

            // Score geral
            const overallScore = report.overallScore || 0;
            const scoreEl = document.getElementById('overallScore');
            scoreEl.textContent = overallScore;
            scoreEl.className = \`overall-score \${getScoreClass(overallScore)}\`;

            // Métricas básicas
            if (report.codeQuality) {
                updateMetric('codeQualityScore', report.codeQuality.score);
            }

            if (report.security) {
                updateMetric('securityScore', report.security.score);
                updateMetric('vulnerabilities', report.security.vulnerabilities, 'count');
            }

            if (report.performance) {
                updateMetric('performanceScore', report.performance.score);
            }

            if (report.documentation) {
                updateMetric('docCoverage', report.documentation.coverage, 'percentage');
            }

            if (report.dependencies) {
                updateMetric('totalPackages', report.dependencies.totalPackages, 'count');
            }

            // Insights e recomendações
            if (report.insights && report.insights.length > 0) {
                updateList('insightsList', report.insights);
            }

            if (report.recommendations && report.recommendations.length > 0) {
                updateList('recommendationsList', report.recommendations);
            }

            // Detalhes (apenas para análise completa)
            if (report.architecture && report.performance && report.dependencies) {
                updateDetails(report);
                document.getElementById('detailsSection').style.display = 'grid';
            }
        }

        function updateMetric(elementId, value, type = 'score') {
            const element = document.getElementById(elementId);
            if (!element) return;

            let displayValue = '--';
            let className = 'metric-value';

            if (value !== undefined && value !== null) {
                if (type === 'percentage') {
                    displayValue = \`\${value}%\`;
                } else if (type === 'count') {
                    displayValue = value.toString();
                } else {
                    displayValue = value.toString();
                }

                if (type === 'score' || type === 'percentage') {
                    className += \` \${getScoreClass(value)}\`;
                } else if (type === 'count' && elementId === 'vulnerabilities') {
                    className += value > 0 ? ' metric-error' : ' metric-good';
                }
            }

            element.textContent = displayValue;
            element.className = className;
        }

        function updateList(listId, items) {
            const list = document.getElementById(listId);
            if (!list || !items || items.length === 0) return;

            list.innerHTML = items.slice(0, 5).map(item => 
                \`<li>\${item}</li>\`
            ).join('');
        }

        function updateDetails(report) {
            // Arquitetura
            if (report.architecture) {
                setText('architecturePattern', report.architecture.pattern);
                setText('architectureConfidence', \`\${report.architecture.confidence}%\`);
                setText('coupling', report.architecture.coupling);
            }

            // Métricas de código
            if (report.codeQuality) {
                setText('complexity', report.codeQuality.complexity);
                setText('duplication', \`\${report.codeQuality.duplication}%\`);
                setText('maintainability', report.codeQuality.maintainabilityIndex);
            }

            // Performance
            if (report.performance) {
                setText('bundleSize', \`\${report.performance.bundleSize}MB\`);
                setText('loadTime', \`\${report.performance.loadTime}s\`);
            }

            // Dependencies
            if (report.dependencies) {
                setText('depTotal', report.dependencies.totalPackages);
                setText('depOutdated', report.dependencies.outdatedPackages);
                setText('depBundleSize', report.dependencies.bundleSize);
            }
        }

        function setText(elementId, value) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = value || '--';
            }
        }

        function getScoreClass(score) {
            if (score >= 80) return 'metric-good';
            if (score >= 60) return 'metric-warning';
            return 'metric-error';
        }

        // Action functions
        function runFullAnalysis() {
            vscode.postMessage({ type: 'runAnalysis' });
        }

        function runQuickAnalysis() {
            vscode.postMessage({ type: 'runQuickAnalysis' });
        }

        function clearCache() {
            vscode.postMessage({ type: 'clearCache' });
        }

        function refresh() {
            vscode.postMessage({ type: 'refresh' });
        }

        function exportReport() {
            if (currentReport) {
                // Em uma implementação real, enviaria para o backend
                console.log('Export report:', currentReport);
                vscode.postMessage({ type: 'exportReport', report: currentReport });
            }
        }

        function showTechnicalDebt() {
            if (currentReport && currentReport.codeQuality && currentReport.codeQuality.technicalDebt) {
                const debt = currentReport.codeQuality.technicalDebt;
                updateList('recommendationsList', debt);
            }
        }

        // Inicialização
        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
    }
}