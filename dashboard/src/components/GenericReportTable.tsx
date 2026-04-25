import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, FileText, ChevronDown, ChevronUp, Eye } from 'lucide-react';

interface GenericReportTableProps {
    reports: any[];
    type: string;
    isLoading?: boolean;
    onRowClick?: (report: any) => void;
}

type SortField = 'name' | 'namespace' | 'cluster' | 'critical' | 'high' | 'medium' | 'low' | 'total';

function getSummary(report: any) {
    const s = report.summary ?? report.report?.summary ?? {};
    return {
        critical: s.criticalCount ?? 0,
        high: s.highCount ?? 0,
        medium: s.mediumCount ?? 0,
        low: s.lowCount ?? 0,
    };
}

function getResourceName(report: any): string {
    // Prefer the human-readable resource name stored in labels
    const labels = report.metadata?.labels ?? {};
    return (
        labels['trivy-operator.resource.name'] ||
        labels['trivy-operator.container.name'] ||
        report.metadata?.annotations?.['trivy-operator.resource.name'] ||
        report.metadata?.name ||
        report.name ||
        'unknown'
    );
}

function getNamespace(report: any): string {
    return (
        report.metadata?.labels?.['trivy-operator.resource.namespace'] ||
        report.metadata?.namespace ||
        report.namespace ||
        ''
    );
}

/** Extract the list of detail items depending on report kind */
function getDetailItems(report: any, type: string): any[] {
    const r = report.report ?? {};
    if (type === 'config-audit') return r.checks ?? [];
    if (type === 'rbac-assessment') return r.checks ?? [];
    if (type === 'cluster-rbac') return r.checks ?? [];
    if (type === 'exposed-secret') return r.secrets ?? [];
    if (type === 'cluster-vulnerability') return r.vulnerabilities ?? [];
    if (type === 'cluster-compliance') return r.checks ?? r.compliances ?? [];
    return [];
}

export function GenericReportTable({ reports, type, isLoading, onRowClick }: GenericReportTableProps) {
    const [sortConfig, setSortConfig] = useState<{ field: SortField; order: 'asc' | 'desc' }>({
        field: 'critical',
        order: 'desc',
    });
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const handleSort = (field: SortField) => {
        setSortConfig((prev) => ({
            field,
            order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc',
        }));
    };

    const sortedReports = useMemo(() => {
        return [...reports].sort((a, b) => {
            const aSum = getSummary(a);
            const bSum = getSummary(b);

            let av: string | number = '';
            let bv: string | number = '';

            switch (sortConfig.field) {
                case 'name':
                    av = getResourceName(a).toLowerCase();
                    bv = getResourceName(b).toLowerCase();
                    break;
                case 'namespace':
                    av = getNamespace(a).toLowerCase();
                    bv = getNamespace(b).toLowerCase();
                    break;
                case 'cluster':
                    av = (a.cluster ?? '').toLowerCase();
                    bv = (b.cluster ?? '').toLowerCase();
                    break;
                case 'critical':
                    av = aSum.critical;
                    bv = bSum.critical;
                    break;
                case 'high':
                    av = aSum.high;
                    bv = bSum.high;
                    break;
                case 'medium':
                    av = aSum.medium;
                    bv = bSum.medium;
                    break;
                case 'low':
                    av = aSum.low;
                    bv = bSum.low;
                    break;
                case 'total':
                    av = aSum.critical + aSum.high + aSum.medium + aSum.low;
                    bv = bSum.critical + bSum.high + bSum.medium + bSum.low;
                    break;
            }

            if (av < bv) return sortConfig.order === 'asc' ? -1 : 1;
            if (av > bv) return sortConfig.order === 'asc' ? 1 : -1;
            return 0;
        });
    }, [reports, sortConfig]);

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
                        No {type.replace(/-/g, ' ')} reports match your current filters.
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
                        <th style={{ width: '40px' }} />
                        <th className="sortable" onClick={() => handleSort('name')}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Resource <SortIcon field="name" />
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
                        <th className="sortable" onClick={() => handleSort('critical')}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-critical)' }}>
                                Critical <SortIcon field="critical" />
                            </span>
                        </th>
                        <th className="sortable" onClick={() => handleSort('high')}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-high)' }}>
                                High <SortIcon field="high" />
                            </span>
                        </th>
                        <th className="sortable" onClick={() => handleSort('medium')}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-medium)' }}>
                                Medium <SortIcon field="medium" />
                            </span>
                        </th>
                        <th className="sortable" onClick={() => handleSort('low')}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-low)' }}>
                                Low <SortIcon field="low" />
                            </span>
                        </th>
                        <th className="sortable" onClick={() => handleSort('total')}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Total <SortIcon field="total" />
                            </span>
                        </th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedReports.map((report, idx) => {
                        const id = report.metadata?.uid ?? report.id ?? `report-${idx}`;
                        const name = getResourceName(report);
                        const ns = getNamespace(report);
                        const cluster = report.cluster ?? 'Unknown';
                        const sum = getSummary(report);
                        const total = sum.critical + sum.high + sum.medium + sum.low;
                        const items = getDetailItems(report, type);
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
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                                            {report.metadata?.name}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge badge-namespace">{ns || 'cluster-wide'}</span>
                                    </td>
                                    <td>
                                        <span className="badge badge-cluster">{cluster.toUpperCase()}</span>
                                    </td>
                                    <td>
                                        {sum.critical > 0 ? (
                                            <span className="severity-count critical">{sum.critical}</span>
                                        ) : (
                                            <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        {sum.high > 0 ? (
                                            <span className="severity-count high">{sum.high}</span>
                                        ) : (
                                            <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        {sum.medium > 0 ? (
                                            <span className="severity-count medium">{sum.medium}</span>
                                        ) : (
                                            <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        {sum.low > 0 ? (
                                            <span className="severity-count low">{sum.low}</span>
                                        ) : (
                                            <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                                        )}
                                    </td>
                                    <td>
                                        <strong>{total}</strong>
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => onRowClick?.(report)}
                                            title="View Details"
                                        >
                                            <Eye size={14} />
                                            View
                                        </button>
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr key={`${id}-expanded`}>
                                        <td colSpan={10} style={{ padding: 0 }}>
                                            <ExpandedItems items={items} type={type} />
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

// ─── Expanded row detail panel ────────────────────────────────────────────────

function ExpandedItems({ items, type }: { items: any[]; type: string }) {
    const isChecks = type.includes('config-audit') || type.includes('rbac');
    const isSecret = type.includes('exposed-secret');
    const isVuln = type.includes('cluster-vulnerability');

    return (
        <div
            style={{
                background: 'var(--color-bg-secondary)',
                padding: 'var(--space-4)',
                borderTop: '1px solid var(--color-border)',
                maxHeight: '400px',
                overflowY: 'auto',
            }}
        >
            {items.length === 0 ? (
                <div style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                    No findings — this resource is clean.
                </div>
            ) : (
                <table className="table" style={{ fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                        {isChecks && (
                            <tr>
                                <th>ID</th>
                                <th>Title</th>
                                <th>Severity</th>
                                <th>Result</th>
                            </tr>
                        )}
                        {isSecret && (
                            <tr>
                                <th>Rule</th>
                                <th>Title</th>
                                <th>Target</th>
                                <th>Severity</th>
                            </tr>
                        )}
                        {isVuln && (
                            <tr>
                                <th>CVE</th>
                                <th>Severity</th>
                                <th>Resource</th>
                                <th>Fixed In</th>
                            </tr>
                        )}
                        {!isChecks && !isSecret && !isVuln && (
                            <tr>
                                <th>Details</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {items.map((item, idx) => {
                            if (isChecks) {
                                return (
                                    <tr key={idx}>
                                        <td style={{ fontFamily: 'monospace' }}>{item.checkID ?? item.id ?? '—'}</td>
                                        <td>{item.title ?? item.message ?? '—'}</td>
                                        <td>
                                            <span className={`severity-tag ${item.severity?.toLowerCase()}`}>
                                                {item.severity ?? '—'}
                                            </span>
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
                            if (isSecret) {
                                return (
                                    <tr key={idx}>
                                        <td style={{ fontFamily: 'monospace' }}>{item.ruleID ?? '—'}</td>
                                        <td>{item.title ?? '—'}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.target ?? '—'}</td>
                                        <td>
                                            <span className={`severity-tag ${item.severity?.toLowerCase()}`}>
                                                {item.severity ?? '—'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            }
                            if (isVuln) {
                                return (
                                    <tr key={idx}>
                                        <td style={{ fontFamily: 'monospace' }}>
                                            {item.primaryLink ? (
                                                <a href={item.primaryLink} target="_blank" rel="noopener noreferrer">
                                                    {item.vulnerabilityID ?? item.id ?? '—'}
                                                </a>
                                            ) : (
                                                item.vulnerabilityID ?? item.id ?? '—'
                                            )}
                                        </td>
                                        <td>
                                            <span className={`severity-tag ${item.severity?.toLowerCase()}`}>
                                                {item.severity ?? '—'}
                                            </span>
                                        </td>
                                        <td>{item.resource ?? '—'}</td>
                                        <td>{item.fixedVersion ?? '—'}</td>
                                    </tr>
                                );
                            }
                            // Generic fallback
                            return (
                                <tr key={idx}>
                                    <td>
                                        <pre style={{ margin: 0, fontSize: '11px' }}>
                                            {JSON.stringify(item, null, 2)}
                                        </pre>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}
