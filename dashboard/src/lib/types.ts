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

// Generic report interface to handle common fields
export interface BaseReport {
    id: string;
    cluster: string;
    namespace: string;
    name: string;
    summary: VulnerabilitySummary; // Or generic Summary if other reports have different summaries
    createdAt?: string;
}

export interface VulnerabilityReport extends BaseReport {
    containerName: string;
    imageRef?: string;
    eosl?: boolean;
    vulnerabilities: Vulnerability[];
}

// TODO: Define specific structures for other reports as we discover them or based on CRD specs.
// For now, we'll use a generic structure or reuse VulnerabilityReport where applicable but ideally we should be specific.
// Assuming similar structure for now for simplicity, but fields will likely differ.

export interface ConfigAuditReport extends BaseReport {
    // Add specific fields
    description?: string;
    scanner?: string;
    checks?: any[]; // Placeholder
}

// ... other report types placeholders

export interface ClusterData {
    cluster: string;
    lastUpdated: string;
    reportsCount: number;
    summary: VulnerabilitySummary;
    // Map report types to their data
    vulnerabilityReports: VulnerabilityReport[];
    configAuditReports: any[]; // Using any for now to get piping working, will refine
    clusterRbacAssessmentReports: any[];
    exposedSecretReports: any[];
    clusterComplianceReports: any[];
    clusterVulnerabilityReports: any[];
    rbacAssessmentReports: any[];
    // Note: SBOM reports disabled to reduce storage and improve performance

    // Legacy support (optional, or we can just map 'reports' to vulnerabilityReports for backward compat)
    reports: VulnerabilityReport[];
}

export interface ClusterIndex {
    cluster: string;
    lastUpdated: string;
    collectionStats: Record<string, number>;
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
export interface GenericReportsResponse {
    apiVersion: string;
    items: any[]; // Unstructured items
    metadata?: {
        continue?: string;
        resourceVersion?: string;
    };
}

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
        os?: {
            eosl?: boolean;
            [key: string]: any;
        };
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
