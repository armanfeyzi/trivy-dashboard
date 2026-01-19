// API client for fetching Trivy vulnerability reports from S3

import type {
    ClusterData,
    VulnerabilityReport,
    Vulnerability,
    S3ReportResponse,
    S3VulnerabilityReportItem,
    VulnerabilitySummary,
} from './types';

// Configuration - can be overridden via environment variables
interface Config {
    clusters: string[];
}

let loadedConfig: Config | null = null;

// Initial configuration with default
const API_CONFIG = {
    // Base path for data files (relative to the web root)
    dataPath: '/data',
    // Default clusters (fallback)
    clusters: ['dev', 'prod'],
    // Refresh interval in milliseconds
    refreshInterval: 30000,
};

// Map of report types to their filenames (must match backend)
const REPORT_FILES = {
    vulnerabilityReports: 'vulnerability-reports.json',
    configAuditReports: 'config-audit-reports.json',
    clusterRbacAssessmentReports: 'cluster-rbac-assessment-reports.json',
    exposedSecretReports: 'exposed-secret-reports.json',
    clusterComplianceReports: 'cluster-compliance-reports.json',
    clusterVulnerabilityReports: 'cluster-vulnerability-reports.json',
    rbacAssessmentReports: 'rbac-assessment-reports.json',
    sbomReports: 'sbom-reports.json',
    clusterSbomReports: 'cluster-sbom-reports.json',
};

async function loadConfig(): Promise<void> {
    if (loadedConfig) return;
    try {
        const response = await fetch('/config.json');
        if (response.ok) {
            loadedConfig = await response.json();
            if (loadedConfig?.clusters) {
                API_CONFIG.clusters = loadedConfig.clusters;
            }
        }
    } catch (e) {
        console.warn('Failed to load config.json, using defaults', e);
    }
}

/**
 * Fetches data for a specific cluster (all report types)
 */
export async function fetchClusterData(cluster: string): Promise<ClusterData> {
    const startTime = performance.now();

    try {
        // Fetch all report types in parallel
        const promises = Object.entries(REPORT_FILES).map(async ([key, filename]) => {
            try {
                // Construct URL: /data/cluster-filename.json
                let response = await fetch(`${API_CONFIG.dataPath}/${cluster}-${filename}`);

                // Fallback for vulnerabilityReports (backward compatibility)
                if (!response.ok && key === 'vulnerabilityReports') {
                    const fallbackUrl = `${API_CONFIG.dataPath}/${cluster}-reports.json`;
                    try {
                        const fallbackResponse = await fetch(fallbackUrl);
                        if (fallbackResponse.ok) {
                            console.log(`[API] Fallback to legacy report for ${cluster}`);
                            response = fallbackResponse;
                        }
                    } catch (e) {
                        console.warn(`[API] Legacy fallback failed for ${cluster}`, e);
                    }
                }

                if (!response.ok) return { key, data: [] };

                const json = await response.json();
                return { key, data: json };
            } catch (e) {
                console.warn(`Failed to fetch ${key} for ${cluster}:`, e);
                return { key, data: [] };
            }
        });

        const results = await Promise.all(promises);

        // Construct the cluster data object
        const clusterData: any = {
            cluster,
            lastUpdated: new Date().toISOString(),
            summary: { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
            reports: [], // For backward compatibility
            // Initialize with empty arrays
            vulnerabilityReports: [],
            configAuditReports: [],
            clusterRbacAssessmentReports: [],
            exposedSecretReports: [],
            clusterComplianceReports: [],
            clusterVulnerabilityReports: [],
            rbacAssessmentReports: [],
            sbomReports: [],
            clusterSbomReports: [],
        };

        // Process results
        results.forEach(({ key, data }) => {
            if (key === 'vulnerabilityReports' && data.items) {
                const processed = processRawReports(data as S3ReportResponse, cluster);
                clusterData.vulnerabilityReports = processed;
                clusterData.reports = processed; // Legacy support
            } else if (data.items) {
                // For now, store raw items or minimal processing until we have specific processors
                clusterData[key] = data.items;
            }
        });

        // Calculate aggregate summary (currently only based on vulnerability reports, 
        // but could be expanded to include other findings like ExposedSecrets)
        clusterData.summary = calculateAggregateSummary(clusterData.vulnerabilityReports);
        clusterData.reportsCount = clusterData.vulnerabilityReports.length;

        console.log(`[API] Fetched ${cluster} cluster data in ${(performance.now() - startTime).toFixed(0)}ms`);

        return clusterData as ClusterData;
    } catch (error) {
        console.error(`[API] Error fetching ${cluster} data:`, error);
        throw error;
    }
}

/**
 * Fetches data from all configured clusters
 */
export async function fetchAllClusters(): Promise<ClusterData[]> {
    await loadConfig();

    const results = await Promise.allSettled(
        API_CONFIG.clusters.map(cluster => fetchClusterData(cluster))
    );

    const successfulResults: ClusterData[] = [];

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            successfulResults.push(result.value);
        } else {
            console.warn(`[API] Failed to fetch ${API_CONFIG.clusters[index]}:`, result.reason);
            // Add empty data for failed clusters
            successfulResults.push(createEmptyClusterData(API_CONFIG.clusters[index]));
        }
    });

    return successfulResults;
}

/**
 * Gets the list of available clusters
 */
export function getAvailableClusters(): string[] {
    return [...API_CONFIG.clusters];
}

/**
 * Processes raw S3/Kubernetes API response into our internal format
 */
function processRawReports(rawData: S3ReportResponse, cluster: string): VulnerabilityReport[] {
    const items = rawData.items || [];
    return items.map((item) => transformReportItem(item, cluster));
}

/**
 * Transforms a single report item from the API format to our internal format
 */
function transformReportItem(item: S3VulnerabilityReportItem, cluster: string): VulnerabilityReport {
    const metadata = item.metadata || {};
    const labels = metadata.labels || {};
    const reportData = item.report || {};
    const rawVulnerabilities = reportData.vulnerabilities || [];

    // Extract container/resource name from labels
    const containerName =
        labels['trivy-operator.container.name'] ||
        labels['trivy-operator.resource.name'] ||
        'unknown';

    // Process vulnerabilities - filter to only those with fixed versions
    const vulnerabilities = processVulnerabilities(rawVulnerabilities);

    // Recalculate summary based on filtered vulnerabilities
    const summary = calculateVulnerabilitySummary(vulnerabilities);

    return {
        id: metadata.name || `${cluster}-${Date.now()}`,
        cluster,
        namespace: metadata.namespace || 'unknown',
        name: metadata.name || 'unknown',
        containerName,
        imageRef: labels['trivy-operator.resource.name'],
        eosl: reportData.os?.eosl,
        summary,
        vulnerabilities,
        createdAt: metadata.creationTimestamp,
    };
}

/**
 * Processes raw vulnerabilities, filtering and deduplicating
 */
function processVulnerabilities(rawVulns: S3VulnerabilityReportItem['report']['vulnerabilities']): Vulnerability[] {
    if (!rawVulns) return [];

    const seen = new Set<string>();
    const processed: Vulnerability[] = [];

    for (const vuln of rawVulns) {
        // Skip if no fixed version (unfixable vulnerabilities)
        const fixedVersion = vuln.fixedVersion?.trim();
        if (!fixedVersion) continue;

        // Skip duplicates
        const vulnId = vuln.vulnerabilityID || `unknown-${Date.now()}`;
        if (seen.has(vulnId)) continue;
        seen.add(vulnId);

        processed.push({
            id: vulnId,
            severity: normalizeSeverity(vuln.severity),
            title: vuln.title || vuln.description || vulnId,
            description: vuln.description,
            primaryLink: vuln.primaryLink || generateCVELink(vulnId),
            fixedVersion,
            installedVersion: vuln.installedVersion,
            resource: vuln.resource,
            target: vuln.target,
            publishedDate: vuln.publishedDate,
        });
    }

    // Sort by severity (critical first)
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
    processed.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return processed;
}

/**
 * Normalizes severity string to our standard format
 */
function normalizeSeverity(severity?: string): Vulnerability['severity'] {
    const normalized = severity?.toUpperCase() || 'UNKNOWN';
    if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(normalized)) {
        return normalized as Vulnerability['severity'];
    }
    return 'UNKNOWN';
}

/**
 * Generates a CVE link for known vulnerability ID formats
 */
function generateCVELink(vulnId: string): string | undefined {
    if (vulnId.startsWith('CVE-')) {
        return `https://nvd.nist.gov/vuln/detail/${vulnId}`;
    }
    if (vulnId.startsWith('GHSA-')) {
        return `https://github.com/advisories/${vulnId}`;
    }
    // Fallback to Google search for other formats (RUSTSEC, ALAS, etc.)
    return `https://www.google.com/search?q=${encodeURIComponent(vulnId + ' vulnerability')}`;
}

/**
 * Calculates vulnerability summary from a list of vulnerabilities
 */
function calculateVulnerabilitySummary(vulnerabilities: Vulnerability[]): VulnerabilitySummary {
    return vulnerabilities.reduce(
        (acc, vuln) => {
            switch (vuln.severity) {
                case 'CRITICAL':
                    acc.criticalCount++;
                    break;
                case 'HIGH':
                    acc.highCount++;
                    break;
                case 'MEDIUM':
                    acc.mediumCount++;
                    break;
                case 'LOW':
                    acc.lowCount++;
                    break;
                default:
                    acc.unknownCount = (acc.unknownCount || 0) + 1;
            }
            return acc;
        },
        { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, unknownCount: 0 }
    );
}

/**
 * Calculates aggregate summary from multiple reports
 */
function calculateAggregateSummary(reports: VulnerabilityReport[]): VulnerabilitySummary {
    return reports.reduce(
        (acc, report) => ({
            criticalCount: acc.criticalCount + report.summary.criticalCount,
            highCount: acc.highCount + report.summary.highCount,
            mediumCount: acc.mediumCount + report.summary.mediumCount,
            lowCount: acc.lowCount + report.summary.lowCount,
        }),
        { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 }
    );
}

/**
 * Creates empty cluster data for when no reports are available
 */
function createEmptyClusterData(cluster: string): ClusterData {
    return {
        cluster,
        lastUpdated: new Date().toISOString(),
        reportsCount: 0,
        summary: { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 },
        reports: [],
        vulnerabilityReports: [],
        configAuditReports: [],
        clusterRbacAssessmentReports: [],
        exposedSecretReports: [],
        clusterComplianceReports: [],
        clusterVulnerabilityReports: [],
        rbacAssessmentReports: [],
        sbomReports: [],
        clusterSbomReports: [],
    };
}

/**
 * Export report data as JSON
 */
export function exportAsJSON(data: VulnerabilityReport[], filename?: string): void {
    const exportData = {
        exportedAt: new Date().toISOString(),
        totalReports: data.length,
        reports: data,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `trivy-reports-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Export report data as CSV
 */
export function exportAsCSV(data: VulnerabilityReport[], filename?: string): void {
    const headers = ['Cluster', 'Namespace', 'Name', 'Container', 'Critical', 'High', 'Medium', 'Low', 'Total'];

    const rows = data.map(report => [
        report.cluster,
        report.namespace,
        report.name,
        report.containerName,
        report.summary.criticalCount,
        report.summary.highCount,
        report.summary.mediumCount,
        report.summary.lowCount,
        report.summary.criticalCount + report.summary.highCount + report.summary.mediumCount + report.summary.lowCount,
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `trivy-reports-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
