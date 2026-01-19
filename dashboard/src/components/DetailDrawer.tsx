import { useMemo } from 'react';
import { X, ExternalLink, Package, CheckCircle, Clock, Shield, AlertTriangle } from 'lucide-react';
import type { VulnerabilityReport, Vulnerability } from '@/lib/types';

interface DetailDrawerProps {
    report: VulnerabilityReport | null;
    onClose: () => void;
}

export function DetailDrawer({ report, onClose }: DetailDrawerProps) {
    if (!report) return null;

    const total = report.summary.criticalCount + report.summary.highCount +
        report.summary.mediumCount + report.summary.lowCount;

    const groupedVulns = useMemo(() => {
        const groups: Record<string, Vulnerability[]> = {
            CRITICAL: [],
            HIGH: [],
            MEDIUM: [],
            LOW: [],
        };
        report.vulnerabilities.forEach((v) => {
            if (groups[v.severity]) {
                groups[v.severity].push(v);
            }
        });
        return groups;
    }, [report.vulnerabilities]);

    return (
        <>
            {/* Backdrop */}
            <div
                className="drawer-backdrop"
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 1000,
                }}
            />

            {/* Drawer */}
            <div
                className="drawer animate-slide-in"
                style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: 'min(1000px, 90vw)', // WIDENED
                    background: 'var(--color-bg-secondary)',
                    borderLeft: '1px solid var(--color-border)',
                    zIndex: 1001,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: 'var(--space-5) var(--space-6)',
                    borderBottom: '1px solid var(--color-border)',
                    background: 'var(--color-bg-tertiary)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                                {report.containerName}
                            </h2>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                                <span className="badge badge-namespace">{report.namespace}</span>
                                <span className="badge badge-cluster">{report.cluster.toUpperCase()}</span>
                            </div>
                        </div>
                        <button
                            className="btn btn-icon btn-ghost"
                            onClick={onClose}
                            style={{ marginTop: '-4px' }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Quick Stats */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: 'var(--space-3)',
                        marginTop: 'var(--space-4)',
                    }}>
                        <StatBox label="Critical" value={report.summary.criticalCount} severity="critical" />
                        <StatBox label="High" value={report.summary.highCount} severity="high" />
                        <StatBox label="Medium" value={report.summary.mediumCount} severity="medium" />
                        <StatBox label="Low" value={report.summary.lowCount} severity="low" />
                        <StatBox label="Total" value={total} severity="total" />
                    </div>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: 'var(--space-6)',
                }}>
                    {/* Metadata Section */}
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <div style={{
                            background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-4)',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 'var(--space-4)',
                        }}>
                            <InfoItem icon={Package} label="Resource Name" value={report.name} />
                            <InfoItem icon={Clock} label="Created At" value={report.createdAt ? new Date(report.createdAt).toLocaleString() : 'N/A'} />
                            {report.imageRef && (
                                <InfoItem icon={Shield} label="Image" value={report.imageRef} />
                            )}
                        </div>
                    </div>

                    {/* Vulnerabilities by Severity (Table View) */}
                    {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((severity) => (
                        groupedVulns[severity].length > 0 && (
                            <VulnerabilityTableSection
                                key={severity}
                                severity={severity}
                                vulnerabilities={groupedVulns[severity]}
                            />
                        )
                    ))}

                    {total === 0 && (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-12)',
                            color: 'var(--color-text-tertiary)',
                        }}>
                            <CheckCircle size={48} style={{ marginBottom: 'var(--space-4)', opacity: 0.5 }} />
                            <p>No vulnerabilities with available fixes.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

function StatBox({ label, value, severity }: { label: string; value: number; severity: string }) {
    const colorVar = severity === 'total'
        ? 'var(--color-text-primary)'
        : `var(--color-${severity})`;

    return (
        <div style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)', // Compact padding
            textAlign: 'center',
        }}>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: colorVar }}>
                {value}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                {label}
            </div>
        </div>
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <Icon size={16} style={{ color: 'var(--color-text-tertiary)', marginTop: '2px', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: '2px' }}>
                    {label}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {value}
                </div>
            </div>
        </div>
    );
}


function VulnerabilityTableSection({ severity, vulnerabilities }: { severity: string; vulnerabilities: Vulnerability[] }) {
    const colorVar = `var(--color-${severity.toLowerCase()})`;
    // const bgVar = `var(--color-${severity.toLowerCase()}-bg)`;

    return (
        <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                color: colorVar,
                marginBottom: 'var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
            }}>
                <AlertTriangle size={16} />
                {severity} ({vulnerabilities.length})
            </h3>

            <div style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                background: 'var(--color-bg-card)',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-bg-tertiary)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '140px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CVE ID</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '150px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Resource</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '120px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Installed</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '120px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Fixed</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Title</th>
                            <th style={{ padding: 'var(--space-3)', width: '40px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {vulnerabilities.map((vuln) => (
                            <VulnerabilityRow key={vuln.id} vulnerability={vuln} severity={severity} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function VulnerabilityRow({ vulnerability, severity }: { vulnerability: Vulnerability; severity: string }) {
    const bgVar = `var(--color-${severity.toLowerCase()}-bg)`;
    const textVar = `var(--color-${severity.toLowerCase()})`;

    return (
        <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            {/* ID */}
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top' }}>
                <span style={{
                    display: 'inline-block',
                    background: bgVar,
                    color: textVar,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600
                }}>
                    {vulnerability.id}
                </span>
            </td>

            {/* Resource */}
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {vulnerability.resource}
            </td>

            {/* Installed */}
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>
                {vulnerability.installedVersion}
            </td>

            {/* Fixed */}
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top', fontFamily: 'monospace', color: 'var(--color-success)' }}>
                {vulnerability.fixedVersion}
            </td>

            {/* Title */}
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                {vulnerability.title || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>No description available</span>}
            </td>

            {/* Action */}
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top', textAlign: 'right' }}>
                {vulnerability.primaryLink && (
                    <a
                        href={vulnerability.primaryLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-icon btn-ghost btn-sm"
                        title="View CVE Details"
                        style={{ color: 'var(--color-text-tertiary)' }}
                    >
                        <ExternalLink size={16} />
                    </a>
                )}
            </td>
        </tr>
    );
}
