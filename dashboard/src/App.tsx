import { useState, useEffect, useCallback, useMemo } from 'react';
import { Shield, RefreshCw, Download, Sun, Moon } from 'lucide-react';
import { SummaryCards } from './components/SummaryCards';
import { ClusterSelector } from './components/ClusterSelector';
import { FilterBar } from './components/FilterBar';
import { VulnerabilityTable } from './components/VulnerabilityTable';
import { DetailDrawer } from './components/DetailDrawer';
import { SeverityChart } from './components/SeverityChart';
import {
    fetchAllClusters,
    getAvailableClusters,
    exportAsCSV,
} from './lib/api';
import type { ClusterData, VulnerabilitySummary, VulnerabilityReport } from './lib/types';

function App() {
    // Theme state
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('trivy-theme');
        return (saved as 'light' | 'dark') || 'dark';
    });

    // Apply theme to document
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('trivy-theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

    // State
    const [clusters, setClusters] = useState<ClusterData[]>([]);
    const [selectedCluster, setSelectedCluster] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Detail drawer state
    const [selectedReport, setSelectedReport] = useState<VulnerabilityReport | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [namespace, setNamespace] = useState('');
    const [severity, setSeverity] = useState('');

    // Fetch data
    const fetchData = useCallback(async (showRefreshIndicator = true) => {
        if (showRefreshIndicator) setIsRefreshing(true);
        setError(null);

        try {
            const data = await fetchAllClusters();
            setClusters(data);
            setLastRefresh(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch data');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchData(false);
    }, [fetchData]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchData(false);
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    // Get all reports based on selected cluster
    const allReports = useMemo(() => {
        if (selectedCluster === 'all') {
            return clusters.flatMap((c) => c.reports);
        }
        return clusters.find((c) => c.cluster === selectedCluster)?.reports || [];
    }, [clusters, selectedCluster]);

    // Filter reports
    const filteredReports = useMemo(() => {
        return allReports.filter((report) => {
            // Search filter
            if (search) {
                const searchLower = search.toLowerCase();
                const matchesSearch =
                    report.containerName.toLowerCase().includes(searchLower) ||
                    report.name.toLowerCase().includes(searchLower) ||
                    report.namespace.toLowerCase().includes(searchLower);
                if (!matchesSearch) return false;
            }

            // Namespace filter
            if (namespace && report.namespace !== namespace) {
                return false;
            }

            // Severity filter
            if (severity) {
                const severityMap: Record<string, keyof VulnerabilitySummary> = {
                    critical: 'criticalCount',
                    high: 'highCount',
                    medium: 'mediumCount',
                    low: 'lowCount',
                };
                const field = severityMap[severity];
                if (field && report.summary[field] === 0) {
                    return false;
                }
            }

            return true;
        });
    }, [allReports, search, namespace, severity]);

    // Get unique namespaces
    const namespaces = useMemo(() => {
        const ns = new Set(allReports.map((r) => r.namespace));
        return Array.from(ns).sort();
    }, [allReports]);

    // Calculate summary
    const summary = useMemo((): VulnerabilitySummary => {
        return filteredReports.reduce(
            (acc, report) => ({
                criticalCount: acc.criticalCount + report.summary.criticalCount,
                highCount: acc.highCount + report.summary.highCount,
                mediumCount: acc.mediumCount + report.summary.mediumCount,
                lowCount: acc.lowCount + report.summary.lowCount,
            }),
            { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 }
        );
    }, [filteredReports]);

    // Clear filters
    const clearFilters = useCallback(() => {
        setSearch('');
        setNamespace('');
        setSeverity('');
    }, []);

    // Export single report as HTML
    const handleExportReport = useCallback((report: VulnerabilityReport) => {
        const html = generateReportHTML(report);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `vulnerability-report-${report.containerName}-${report.namespace}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    // Handle row click to show detail drawer
    const handleRowClick = useCallback((report: VulnerabilityReport) => {
        setSelectedReport(report);
    }, []);

    return (
        <div className="app-container">
            {/* Header */}
            <header className="header">
                <div className="header-content">
                    <div className="header-left">
                        <div className="logo">
                            <div className="logo-icon">
                                <Shield />
                            </div>
                            <span className="logo-text">Trivy Dashboard</span>
                        </div>
                        <ClusterSelector
                            clusters={getAvailableClusters()}
                            selectedCluster={selectedCluster}
                            onClusterChange={setSelectedCluster}
                        />
                    </div>
                    <div className="header-right">
                        {lastRefresh && (
                            <div className="last-updated">
                                <span className="last-updated-dot" />
                                Updated {formatRelativeTime(lastRefresh)}
                            </div>
                        )}
                        <button
                            className="btn btn-icon btn-secondary"
                            onClick={toggleTheme}
                            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        >
                            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => fetchData(true)}
                            disabled={isRefreshing}
                        >
                            <RefreshCw size={16} className={isRefreshing ? 'spinning' : ''} />
                            Refresh
                        </button>
                        <div style={{ position: 'relative' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => exportAsCSV(filteredReports)}
                                disabled={filteredReports.length === 0}
                            >
                                <Download size={16} />
                                Export All
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="main-content">
                {/* Error State */}
                {error && (
                    <div className="error-container">
                        <div className="error-icon">
                            <Shield size={20} />
                        </div>
                        <div className="error-content">
                            <div className="error-title">Error Loading Data</div>
                            <div className="error-message">{error}</div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchData(true)}>
                            Retry
                        </button>
                    </div>
                )}

                {/* Summary Cards */}
                <SummaryCards
                    summary={summary}
                    totalReports={filteredReports.length}
                    isLoading={isLoading}
                />

                {/* Charts */}
                {!isLoading && clusters.length > 0 && (
                    <SeverityChart
                        clusters={clusters}
                        selectedCluster={selectedCluster}
                    />
                )}

                {/* Filters */}
                <FilterBar
                    search={search}
                    onSearchChange={setSearch}
                    namespace={namespace}
                    onNamespaceChange={setNamespace}
                    severity={severity}
                    onSeverityChange={setSeverity}
                    namespaces={namespaces}
                    onClearFilters={clearFilters}
                />

                {/* Table */}
                <VulnerabilityTable
                    reports={filteredReports}
                    isLoading={isLoading}
                    onExportReport={handleExportReport}
                    onRowClick={handleRowClick}
                />
            </main>

            {/* Detail Drawer */}
            <DetailDrawer
                report={selectedReport}
                onClose={() => setSelectedReport(null)}
            />
        </div>
    );
}

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return date.toLocaleDateString();
}

// Generate HTML report for a single vulnerability report
function generateReportHTML(report: VulnerabilityReport): string {
    const severityGroups: Record<string, typeof report.vulnerabilities> = {
        CRITICAL: [],
        HIGH: [],
        MEDIUM: [],
        LOW: [],
    };

    report.vulnerabilities.forEach((v) => {
        if (severityGroups[v.severity]) {
            severityGroups[v.severity].push(v);
        }
    });

    let vulnSections = '';
    (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).forEach((sev) => {
        if (severityGroups[sev].length > 0) {
            const color = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' }[sev];
            vulnSections += `
        <div class="severity-section">
          <h3 style="color: ${color}; border-left: 4px solid ${color}; padding-left: 12px;">
            ${sev} (${severityGroups[sev].length})
          </h3>
          <div class="vuln-list">
            ${severityGroups[sev].map((v) => `
              <div class="vuln-item">
                <strong>${v.id}</strong>
                ${v.title ? `<p>${v.title}</p>` : ''}
                ${v.fixedVersion ? `<span class="fixed">Fixed in: ${v.fixedVersion}</span>` : ''}
                ${v.primaryLink ? `<a href="${v.primaryLink}" target="_blank">View Details →</a>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
        }
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vulnerability Report - ${report.containerName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; color: #fff; padding: 2rem; }
    .container { max-width: 1000px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 2rem; border-radius: 1rem; margin-bottom: 2rem; }
    .header h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .header p { opacity: 0.9; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; background: #1a1a24; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 2rem; }
    .meta-item label { font-size: 0.75rem; color: #a0a0b0; text-transform: uppercase; }
    .meta-item p { font-weight: 600; }
    .severity-section { margin-bottom: 2rem; }
    .severity-section h3 { margin-bottom: 1rem; }
    .vuln-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .vuln-item { background: #1a1a24; padding: 1rem; border-radius: 0.5rem; }
    .vuln-item p { margin: 0.5rem 0; color: #a0a0b0; font-size: 0.875rem; }
    .vuln-item a { color: #6366f1; text-decoration: none; font-size: 0.875rem; }
    .vuln-item a:hover { text-decoration: underline; }
    .fixed { display: inline-block; background: rgba(34, 197, 94, 0.1); color: #22c55e; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-top: 0.5rem; }
    .footer { text-align: center; color: #6b6b7b; font-size: 0.75rem; margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #1a1a24; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ Vulnerability Report</h1>
      <p>${report.containerName} - ${report.namespace} (${report.cluster.toUpperCase()})</p>
    </div>
    <div class="meta">
      <div class="meta-item"><label>Container</label><p>${report.containerName}</p></div>
      <div class="meta-item"><label>Namespace</label><p>${report.namespace}</p></div>
      <div class="meta-item"><label>Cluster</label><p>${report.cluster.toUpperCase()}</p></div>
      <div class="meta-item"><label>Generated</label><p>${new Date().toLocaleString()}</p></div>
    </div>
    ${vulnSections || '<p style="text-align: center; color: #6b6b7b;">No vulnerabilities found.</p>'}
    <div class="footer">Generated by Trivy Dashboard</div>
  </div>
</body>
</html>`;
}

export default App;
