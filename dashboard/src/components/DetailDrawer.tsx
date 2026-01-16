import { useMemo } from 'react';
import { X, ExternalLink, Package, AlertTriangle, CheckCircle, Clock, Shield } from 'lucide-react';
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
                    width: 'min(700px, 90vw)',
                    background: 'var(--color-bg-secondary)',
                    borderLeft: '1px solid var(--color-border)',
                    zIndex: 1001,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
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
                        <h3 style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            color: 'var(--color-text-secondary)',
                            marginBottom: 'var(--space-3)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            Report Details
                        </h3>
                        <div style={{
                            background: 'var(--color-bg-card)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--space-4)',
                        }}>
                            <InfoRow icon={Package} label="Resource Name" value={report.name} />
                            <InfoRow icon={Clock} label="Created At" value={report.createdAt ? new Date(report.createdAt).toLocaleString() : 'N/A'} />
                            {report.imageRef && (
                                <InfoRow icon={Shield} label="Image" value={report.imageRef} />
                            )}
                        </div>
                    </div>

                    {/* Vulnerabilities by Severity */}
                    {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((severity) => (
                        groupedVulns[severity].length > 0 && (
                            <VulnerabilitySection
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
            padding: 'var(--space-3)',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: colorVar }}>
                {value}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                {label}
            </div>
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-2) 0',
            borderBottom: '1px solid var(--color-border)',
        }}>
            <Icon size={16} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <span style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                minWidth: '100px',
            }}>
                {label}
            </span>
            <span style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-primary)',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
            }}>
                {value}
            </span>
        </div>
    );
}

function VulnerabilitySection({ severity, vulnerabilities }: { severity: string; vulnerabilities: Vulnerability[] }) {
    const colorVar = `var(--color-${severity.toLowerCase()})`;
    const bgVar = `var(--color-${severity.toLowerCase()}-bg)`;

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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {vulnerabilities.map((vuln) => (
                    <VulnerabilityCard key={vuln.id} vulnerability={vuln} bgColor={bgVar} />
                ))}
            </div>
        </div>
    );
}

function VulnerabilityCard({ vulnerability, bgColor }: { vulnerability: Vulnerability; bgColor: string }) {
    return (
        <div style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
        }}>
            {/* Header - CVE ID only */}
            <div style={{
                background: bgColor,
                padding: 'var(--space-3) var(--space-4)',
            }}>
                <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    fontSize: 'var(--font-size-sm)',
                }}>
                    {vulnerability.id}
                </span>
            </div>

            {/* Content */}
            <div style={{ padding: 'var(--space-4)' }}>
                {vulnerability.title && (
                    <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--space-3)',
                        lineHeight: 1.5,
                    }}>
                        {vulnerability.title}
                    </p>
                )}

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 'var(--space-3)',
                }}>
                    {vulnerability.resource && (
                        <DetailItem label="Resource" value={vulnerability.resource} />
                    )}
                    {vulnerability.target && (
                        <DetailItem label="Target" value={vulnerability.target} />
                    )}
                    {vulnerability.installedVersion && (
                        <DetailItem
                            label="Installed Version"
                            value={vulnerability.installedVersion}
                            highlight="danger"
                        />
                    )}
                    {vulnerability.fixedVersion && (
                        <DetailItem
                            label="Fixed Version"
                            value={vulnerability.fixedVersion}
                            highlight="success"
                        />
                    )}
                    {vulnerability.publishedDate && (
                        <DetailItem
                            label="Published"
                            value={new Date(vulnerability.publishedDate).toLocaleDateString()}
                        />
                    )}
                </div>

                {/* CVE Link - moved into detail area */}
                {vulnerability.primaryLink && (
                    <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                        <a
                            href={vulnerability.primaryLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', gap: 'var(--space-2)' }}
                        >
                            <ExternalLink size={14} />
                            View CVE Details
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: 'success' | 'danger' }) {
    const valueColor = highlight === 'success'
        ? 'var(--color-success)'
        : highlight === 'danger'
            ? 'var(--color-error)'
            : 'var(--color-text-primary)';

    return (
        <div>
            <div style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                marginBottom: '2px',
            }}>
                {label}
            </div>
            <div style={{
                fontSize: 'var(--font-size-sm)',
                color: valueColor,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
            }}>
                {value}
            </div>
        </div>
    );
}
