import { useMemo } from 'react';
import { X, ExternalLink, Package, CheckCircle, Clock, Shield, AlertTriangle } from 'lucide-react';
import type { Vulnerability } from '@/lib/types';

// Accept any report type — VulnerabilityReport or raw K8s generic report
interface DetailDrawerProps {
    report: any | null;
    onClose: () => void;
}

// Derive a human-readable title from any report object
function getTitle(report: any): string {
    const labels = report.metadata?.labels ?? {};
    return (
        report.containerName ||
        labels['trivy-operator.resource.name'] ||
        labels['trivy-operator.container.name'] ||
        report.metadata?.annotations?.['trivy-operator.resource.name'] ||
        report.metadata?.name ||
        report.name ||
        'Report'
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

function getSummary(report: any) {
    const s = report.summary ?? report.report?.summary ?? {};
    return {
        criticalCount: s.criticalCount ?? 0,
        highCount: s.highCount ?? 0,
        mediumCount: s.mediumCount ?? 0,
        lowCount: s.lowCount ?? 0,
    };
}

/** Detect the report kind from the raw object */
function getKind(report: any): string {
    return (report.kind ?? report.metadata?.labels?.['trivy-operator.resource.kind'] ?? '').toLowerCase();
}

export function DetailDrawer({ report, onClose }: DetailDrawerProps) {
    if (!report) return null;

    const title = getTitle(report);
    const ns = getNamespace(report);
    const cluster = report.cluster ?? '';
    const summary = getSummary(report);
    const total = summary.criticalCount + summary.highCount + summary.mediumCount + summary.lowCount;
    const kind = getKind(report);
    const rawReport = report.report ?? {};

    // Vulnerability reports have a .vulnerabilities[] field
    const isVulnReport = Array.isArray(report.vulnerabilities) && report.vulnerabilities.length >= 0;

    const groupedVulns = useMemo(() => {
        const groups: Record<string, Vulnerability[]> = {
            CRITICAL: [],
            HIGH: [],
            MEDIUM: [],
            LOW: [],
        };
        (report.vulnerabilities ?? []).forEach((v: Vulnerability) => {
            if (groups[v.severity]) groups[v.severity].push(v);
        });
        return groups;
    }, [report.vulnerabilities]);

    // Generic checks (config-audit, rbac-assessment)
    const checks: any[] = rawReport.checks ?? [];
    // Exposed secrets
    const secrets: any[] = rawReport.secrets ?? [];

    return (
        <>
            {/* Backdrop */}
            <div
                className="drawer-backdrop"
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 1000,
                }}
            />

            {/* Drawer panel */}
            <div
                className="drawer animate-slide-in"
                style={{
                    position: 'fixed',
                    top: 0, right: 0, bottom: 0,
                    width: 'min(1000px, 90vw)',
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
                                {title}
                            </h2>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                                {ns && <span className="badge badge-namespace">{ns}</span>}
                                {cluster && <span className="badge badge-cluster">{cluster.toUpperCase()}</span>}
                                {kind && (
                                    <span className="badge" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                                        {kind}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button className="btn btn-icon btn-ghost" onClick={onClose} style={{ marginTop: '-4px' }}>
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
                        <StatBox label="Critical" value={summary.criticalCount} severity="critical" />
                        <StatBox label="High" value={summary.highCount} severity="high" />
                        <StatBox label="Medium" value={summary.mediumCount} severity="medium" />
                        <StatBox label="Low" value={summary.lowCount} severity="low" />
                        <StatBox label="Total" value={total} severity="total" />
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-6)' }}>
                    {/* Metadata */}
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
                            <InfoItem icon={Package} label="Resource Name" value={report.metadata?.name ?? report.name ?? '—'} />
                            <InfoItem
                                icon={Clock}
                                label="Created At"
                                value={report.metadata?.creationTimestamp || report.createdAt
                                    ? new Date(report.metadata?.creationTimestamp ?? report.createdAt).toLocaleString()
                                    : 'N/A'}
                            />
                            {(report.imageRef || rawReport.artifact?.repository) && (
                                <InfoItem icon={Shield} label="Image" value={report.imageRef ?? rawReport.artifact?.repository} />
                            )}
                            {rawReport.scanner?.name && (
                                <InfoItem icon={Shield} label="Scanner" value={`${rawReport.scanner.name} ${rawReport.scanner.version ?? ''}`} />
                            )}
                        </div>
                    </div>

                    {/* === Vulnerability report: grouped by severity === */}
                    {isVulnReport && (
                        <>
                            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) =>
                                groupedVulns[sev].length > 0 && (
                                    <VulnerabilityTableSection
                                        key={sev}
                                        severity={sev}
                                        vulnerabilities={groupedVulns[sev]}
                                    />
                                )
                            )}
                            {total === 0 && (
                                <EmptyState message="No vulnerabilities with available fixes." />
                            )}
                        </>
                    )}

                    {/* === Config-audit / RBAC: checks list === */}
                    {!isVulnReport && checks.length > 0 && (
                        <ChecksSection checks={checks} />
                    )}

                    {/* === Exposed secrets === */}
                    {!isVulnReport && secrets.length > 0 && (
                        <SecretsSection secrets={secrets} />
                    )}

                    {/* === Nothing to show === */}
                    {!isVulnReport && checks.length === 0 && secrets.length === 0 && (
                        <EmptyState message="No findings — this resource is clean." />
                    )}
                </div>
            </div>
        </>
    );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value, severity }: { label: string; value: number; severity: string }) {
    const colorVar = severity === 'total' ? 'var(--color-text-primary)' : `var(--color-${severity})`;
    return (
        <div style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2) var(--space-3)',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: colorVar }}>{value}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{label}</div>
        </div>
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
            <Icon size={16} style={{ color: 'var(--color-text-tertiary)', marginTop: '2px', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</div>
            </div>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-tertiary)' }}>
            <CheckCircle size={48} style={{ marginBottom: 'var(--space-4)', opacity: 0.5 }} />
            <p>{message}</p>
        </div>
    );
}

// Vulnerability report sections

function VulnerabilityTableSection({ severity, vulnerabilities }: { severity: string; vulnerabilities: Vulnerability[] }) {
    const colorVar = `var(--color-${severity.toLowerCase()})`;
    return (
        <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{
                fontSize: 'var(--font-size-sm)', fontWeight: 600, color: colorVar,
                marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            }}>
                <AlertTriangle size={16} />
                {severity} ({vulnerabilities.length})
            </h3>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--color-bg-card)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-bg-tertiary)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '200px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>CVE ID</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '150px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Resource</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '120px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Installed</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '120px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Fixed</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Title</th>
                            <th style={{ padding: 'var(--space-3)', width: '40px' }} />
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
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top' }}>
                <span style={{ display: 'inline-block', background: bgVar, color: textVar, padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                    {vulnerability.id}
                </span>
            </td>
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top', fontFamily: 'monospace', wordBreak: 'break-all' }}>{vulnerability.resource}</td>
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top', fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{vulnerability.installedVersion}</td>
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top', fontFamily: 'monospace', color: 'var(--color-success)' }}>{vulnerability.fixedVersion}</td>
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                {vulnerability.title || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>No description available</span>}
            </td>
            <td style={{ padding: 'var(--space-3)', verticalAlign: 'top', textAlign: 'right' }}>
                {vulnerability.primaryLink && (
                    <a href={vulnerability.primaryLink} target="_blank" rel="noopener noreferrer"
                        className="btn btn-icon btn-ghost btn-sm" title="View CVE Details"
                        style={{ color: 'var(--color-text-tertiary)' }}>
                        <ExternalLink size={16} />
                    </a>
                )}
            </td>
        </tr>
    );
}

// Config-audit / RBAC checks section

function ChecksSection({ checks }: { checks: any[] }) {
    const failed = checks.filter((c) => !c.success);
    const passed = checks.filter((c) => c.success);

    return (
        <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
                Checks — {failed.length} failed / {passed.length} passed
            </h3>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--color-bg-card)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-bg-tertiary)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '120px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ID</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Title</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '100px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Severity</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'center', width: '80px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...failed, ...passed].map((check, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: 'var(--space-3)', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                                    {check.checkID ?? check.id ?? '—'}
                                </td>
                                <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)' }}>
                                    <div>{check.title ?? '—'}</div>
                                    {check.messages?.[0] && (
                                        <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
                                            {check.messages[0]}
                                        </div>
                                    )}
                                </td>
                                <td style={{ padding: 'var(--space-3)' }}>
                                    <span className={`severity-tag ${check.severity?.toLowerCase()}`}>
                                        {check.severity ?? '—'}
                                    </span>
                                </td>
                                <td style={{ padding: 'var(--space-3)', textAlign: 'center' }}>
                                    {check.success ? (
                                        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>PASS</span>
                                    ) : (
                                        <span style={{ color: 'var(--color-critical)', fontWeight: 600 }}>FAIL</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// Exposed secrets section

function SecretsSection({ secrets }: { secrets: any[] }) {
    return (
        <div style={{ marginBottom: 'var(--space-6)' }}>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-critical)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <AlertTriangle size={16} />
                Exposed Secrets ({secrets.length})
            </h3>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--color-bg-card)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                    <thead>
                        <tr style={{ background: 'var(--color-bg-tertiary)', borderBottom: '1px solid var(--color-border)' }}>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '180px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Rule</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Title</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Target File</th>
                            <th style={{ padding: 'var(--space-3)', textAlign: 'left', width: '100px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Severity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {secrets.map((secret, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                <td style={{ padding: 'var(--space-3)', fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}>
                                    {secret.ruleID ?? '—'}
                                </td>
                                <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)' }}>
                                    {secret.title ?? secret.category ?? '—'}
                                </td>
                                <td style={{ padding: 'var(--space-3)', fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-text-tertiary)', wordBreak: 'break-all' }}>
                                    {secret.target ?? '—'}
                                </td>
                                <td style={{ padding: 'var(--space-3)' }}>
                                    <span className={`severity-tag ${secret.severity?.toLowerCase()}`}>
                                        {secret.severity ?? '—'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
