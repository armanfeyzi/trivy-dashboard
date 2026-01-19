import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, FileText, ChevronDown, ChevronUp, Eye } from 'lucide-react';

interface GenericReportTableProps {
    reports: any[]; // Using any to be flexible with different report types
    type: string;
    isLoading?: boolean;
    onRowClick?: (report: any) => void;
}

type SortField = 'name' | 'namespace' | 'cluster' | 'count';
type SortConfig = {
    field: SortField;
    order: 'asc' | 'desc';
};

export function GenericReportTable({ reports, type, isLoading, onRowClick }: GenericReportTableProps) {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'name', order: 'asc' });
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const handleSort = (field: SortField) => {
        setSortConfig((prev) => ({
            field,
            order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
        }));
    };

    const getReportItems = (report: any): any[] => {
        // Extract the main list of items based on report type
        if (!report.report) return [];
        if (type === 'config-audit' || type === 'cluster-config-audit') return report.report.checks || [];
        if (type === 'exposed-secret') return report.report.secrets || [];
        if (type === 'rbac-assessment' || type === 'cluster-rbac-assessment') return report.report.checks || [];
        if (type === 'cluster-compliance') return report.report.compliances || []; // Hypothetical
        if (type === 'sbom' || type === 'cluster-sbom') return report.report.components || [];
        return [];
    };

    const sortedReports = useMemo(() => {
        const sorted = [...reports].sort((a, b) => {
            let aValue: number | string = '';
            let bValue: number | string = '';

            // Handle potential nested metadata structure from raw k8s items vs flattened
            const getName = (r: any) => r.metadata?.name || r.name || '';
            const getNamespace = (r: any) => r.metadata?.namespace || r.namespace || '';
            const getCluster = (r: any) => r.cluster || '';

            switch (sortConfig.field) {
                case 'name':
                    aValue = getName(a).toLowerCase();
                    bValue = getName(b).toLowerCase();
                    break;
                case 'namespace':
                    aValue = getNamespace(a).toLowerCase();
                    bValue = getNamespace(b).toLowerCase();
                    break;
                case 'cluster':
                    aValue = getCluster(a).toLowerCase();
                    bValue = getCluster(b).toLowerCase();
                    break;
                case 'count':
                    aValue = getReportItems(a).length;
                    bValue = getReportItems(b).length;
                    break;
            }

            if (aValue < bValue) return sortConfig.order === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.order === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [reports, sortConfig, type]);

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortConfig.field !== field) return <ArrowUpDown size={14} />;
        return sortConfig.order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
    };

    if (isLoading) {
        return (
            <div className="table-container">
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <span className="loading-text">Loading reports...</span>
                </div>
            </div>
        );
    }

    if (reports.length === 0) {
        return (
            <div className="table-container">
                <div className="empty-state">
                    <FileText className="empty-state-icon" />
                    <h3 className="empty-state-title">No Reports Found</h3>
                    <p className="empty-state-description">
                        No {type.replace('-', ' ')} reports found.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="table-container animate-fade-in">
            <table className="table">
                <thead>
                    <tr>
                        <th style={{ width: '40px' }}></th>
                        <th className="sortable" onClick={() => handleSort('name')}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Name <SortIcon field="name" />
                            </span>
                        </th>
                        <th className="sortable" onClick={() => handleSort('namespace')}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Namespace <SortIcon field="namespace" />
                            </span>
                        </th>
                        <th className="sortable" onClick={() => handleSort('cluster')}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Cluster <SortIcon field="cluster" />
                            </span>
                        </th>
                        <th className="sortable" onClick={() => handleSort('count')}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Items <SortIcon field="count" />
                            </span>
                        </th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedReports.map((report, idx) => {
                        // Handle generic report structure (k8s object)
                        const id = report.metadata?.uid || report.id || `report-${idx}`;
                        const name = report.metadata?.name || report.name;
                        const namespace = report.metadata?.namespace || report.namespace;
                        const cluster = report.cluster || 'Unknown';

                        const items = getReportItems(report);
                        const isExpanded = expandedRow === id;

                        return (
                            <>
                                <tr key={id}>
                                    <td style={{ width: '40px' }}>
                                        {items.length > 0 && (
                                            <button
                                                className="btn btn-icon btn-ghost"
                                                onClick={() => setExpandedRow(isExpanded ? null : id)}
                                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                            >
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                        )}
                                    </td>
                                    <td>
                                        <strong style={{ color: 'var(--color-text-primary)' }}>{name}</strong>
                                    </td>
                                    <td>
                                        <span className="badge badge-namespace">{namespace || 'N/A'}</span>
                                    </td>
                                    <td>
                                        <span className="badge badge-cluster">{cluster.toUpperCase()}</span>
                                    </td>
                                    <td>
                                        <div className="badge" style={{ background: 'var(--color-bg-tertiary)' }}>
                                            {items.length} items
                                        </div>
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => onRowClick?.(report)}
                                        >
                                            <Eye size={14} />
                                            View
                                        </button>
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr key={`${id}-expanded`}>
                                        <td colSpan={6} style={{ padding: 0 }}>
                                            <ExpandedReportItems items={items} type={type} />
                                        </td>
                                    </tr>
                                )}
                            </>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function ExpandedReportItems({ items, type }: { items: any[], type: string }) {
    return (
        <div style={{
            background: 'var(--color-bg-secondary)',
            padding: 'var(--space-4)',
            borderTop: '1px solid var(--color-border)',
            maxHeight: '400px',
            overflowY: 'auto'
        }}>
            {items.length === 0 ? (
                <div style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>No details available.</div>
            ) : (
                <table className="table" style={{ fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                        {/* Dynamic Headers based on type */}
                        {type.includes('config-audit') || type.includes('rbac') ? (
                            <tr>
                                <th>ID</th>
                                <th>Check</th>
                                <th>Severity</th>
                                <th>Success</th>
                            </tr>
                        ) : type.includes('exposed-secret') ? (
                            <tr>
                                <th>Rule</th>
                                <th>Target</th>
                                <th>Severity</th>
                            </tr>
                        ) : type.includes('sbom') ? (
                            <tr>
                                <th>Package</th>
                                <th>Version</th>
                                <th>License</th>
                            </tr>
                        ) : (
                            <tr><th>Details</th></tr>
                        )}
                    </thead>
                    <tbody>
                        {items.map((item, idx) => {
                            if (type.includes('config-audit') || type.includes('rbac')) {
                                return (
                                    <tr key={idx}>
                                        <td style={{ fontFamily: 'monospace' }}>{item.checkID || item.id}</td>
                                        <td>{item.title || item.message}</td>
                                        <td>
                                            <span className={`severity-tag ${item.severity?.toLowerCase()}`}>{item.severity}</span>
                                        </td>
                                        <td>
                                            {item.success ? (
                                                <span style={{ color: 'var(--color-success)' }}>PASS</span>
                                            ) : (
                                                <span style={{ color: 'var(--color-critical)' }}>FAIL</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            }
                            if (type.includes('exposed-secret')) {
                                return (
                                    <tr key={idx}>
                                        <td>{item.ruleID}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{item.target}</td>
                                        <td><span className={`severity-tag ${item.severity?.toLowerCase()}`}>{item.severity}</span></td>
                                    </tr>
                                );
                            }
                            if (type.includes('sbom')) {
                                return (
                                    <tr key={idx}>
                                        <td>{item.name}</td>
                                        <td>{item.version}</td>
                                        <td>{item.licenses ? item.licenses.join(', ') : 'N/A'}</td>
                                    </tr>
                                );
                            }
                            // Fallback
                            return (
                                <tr key={idx}>
                                    <td><pre style={{ margin: 0 }}>{JSON.stringify(item, null, 2)}</pre></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}
