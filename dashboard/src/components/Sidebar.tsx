
import {
    FileText,
    ShieldAlert,
    Lock,
    CheckSquare,
    Server
} from 'lucide-react';

interface SidebarProps {
    activeView: string;
    onViewChange: (view: string) => void;
    counts: Record<string, number>;
}

export function Sidebar({ activeView, onViewChange, counts }: SidebarProps) {
    const menuItems = [
        { id: 'vulnerability', label: 'Vulnerabilities', icon: ShieldAlert, countKey: 'vulnerabilityReports' },
        { id: 'config-audit', label: 'Config Audit', icon: FileText, countKey: 'configAuditReports' },
        { id: 'rbac-assessment', label: 'RBAC Assessment', icon: Lock, countKey: 'rbacAssessmentReports' },
        { id: 'exposed-secret', label: 'Exposed Secrets', icon: Lock, countKey: 'exposedSecretReports' },
        { id: 'cluster-compliance', label: 'Cluster Compliance', icon: CheckSquare, countKey: 'clusterComplianceReports' },
        { id: 'cluster-vulnerability', label: 'Cluster Vulnerability', icon: Server, countKey: 'clusterVulnerabilityReports' },
        { id: 'cluster-rbac', label: 'Cluster RBAC', icon: Lock, countKey: 'clusterRbacAssessmentReports' },
        // Note: SBOM reports disabled to reduce storage and improve performance
    ];

    return (
        <aside className="sidebar">
            <nav className="sidebar-nav">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            className={`sidebar-item ${activeView === item.id ? 'active' : ''}`}
                            onClick={() => onViewChange(item.id)}
                        >
                            <div className="sidebar-item-content">
                                <Icon size={18} />
                                <span>{item.label}</span>
                            </div>
                            {counts[item.countKey] > 0 && (
                                <span className="sidebar-badge">{counts[item.countKey]}</span>
                            )}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}
