
import {
    FileText,
    ShieldAlert,
    Lock,
    CheckSquare,
    Server,
    FileJson,
    Database
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
        { id: 'exposed-secret', label: 'Exposed Secrets', icon: Lock, countKey: 'exposedSecretReports' }, // Key icon might be better but Lock is ok
        { id: 'cluster-compliance', label: 'Cluster Compliance', icon: CheckSquare, countKey: 'clusterComplianceReports' },
        { id: 'cluster-vulnerability', label: 'Cluster Vulnerability', icon: Server, countKey: 'clusterVulnerabilityReports' },
        { id: 'cluster-rbac', label: 'Cluster RBAC', icon: Lock, countKey: 'clusterRbacAssessmentReports' },
        { id: 'sbom', label: 'SBOM', icon: FileJson, countKey: 'sbomReports' },
        { id: 'cluster-sbom', label: 'Cluster SBOM', icon: Database, countKey: 'clusterSbomReports' },
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
