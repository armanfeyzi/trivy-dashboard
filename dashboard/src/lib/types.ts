// Trivy Dashboard Types

export interface Vulnerability {
    id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
    title: string;
    description?: string;
    primaryLink?: string;
    fixedVersion?: string;
    installedVersion?: string;
    resource?: string;
    target?: string;
    publishedDate?: string;
}

export interface VulnerabilitySummary {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    unknownCount?: number;
}

export interface VulnerabilityReport {
    id: string;
    cluster: string;
    namespace: string;
    name: string;
    containerName: string;
    imageRef?: string;
    eosl?: boolean;
    summary: VulnerabilitySummary;
    vulnerabilities: Vulnerability[];
    createdAt?: string;
    updatedAt?: string;
}

export interface ClusterData {
    cluster: string;
    lastUpdated: string;
    reportsCount: number;
    summary: VulnerabilitySummary;
    reports: VulnerabilityReport[];
}

export interface ClusterIndex {
    cluster: string;
    lastUpdated: string;
    latestReport: string;
    collectionSummary: {
        totalReports: number;
        totalNamespaces: number;
        vulnerabilities: VulnerabilitySummary;
    };
}

export interface DashboardState {
    clusters: ClusterData[];
    selectedCluster: string | 'all';
    isLoading: boolean;
    error: string | null;
    lastRefresh: Date | null;
}

export interface FilterState {
    search: string;
    namespace: string;
    severity: string;
    sortBy: SortField;
    sortOrder: 'asc' | 'desc';
}

export type SortField = 'name' | 'namespace' | 'critical' | 'high' | 'medium' | 'low' | 'total';

export interface ProcessedReport extends VulnerabilityReport {
    total: number;
    topVulnerabilities: {
        critical: Vulnerability[];
        high: Vulnerability[];
        medium: Vulnerability[];
        low: Vulnerability[];
    };
}

// API Response types
export interface S3ReportResponse {
    items: S3VulnerabilityReportItem[];
    metadata?: {
        continue?: string;
        resourceVersion?: string;
    };
}

export interface S3VulnerabilityReportItem {
    apiVersion: string;
    kind: string;
    metadata: {
        name: string;
        namespace: string;
        labels?: Record<string, string>;
        creationTimestamp?: string;
    };
    report: {
        summary: {
            criticalCount?: number;
            highCount?: number;
            mediumCount?: number;
            lowCount?: number;
        };
        eosl?: boolean;
        vulnerabilities?: Array<{
            vulnerabilityID: string;
            severity: string;
            title?: string;
            description?: string;
            primaryLink?: string;
            fixedVersion?: string;
            installedVersion?: string;
            resource?: string;
            target?: string;
            publishedDate?: string;
        }>;
    };
}
