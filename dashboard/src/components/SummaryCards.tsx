import { Shield, AlertTriangle, AlertCircle, Info, FileBarChart } from 'lucide-react';
import type { VulnerabilitySummary } from '@/lib/types';

interface SummaryCardsProps {
    summary: VulnerabilitySummary;
    totalReports: number;
    isLoading?: boolean;
}

export function SummaryCards({ summary, totalReports, isLoading }: SummaryCardsProps) {
    const cards = [
        {
            label: 'Total Reports',
            value: totalReports,
            type: 'total' as const,
            icon: FileBarChart,
        },
        {
            label: 'Critical',
            value: summary.criticalCount,
            type: 'critical' as const,
            icon: Shield,
        },
        {
            label: 'High',
            value: summary.highCount,
            type: 'high' as const,
            icon: AlertTriangle,
        },
        {
            label: 'Medium',
            value: summary.mediumCount,
            type: 'medium' as const,
            icon: AlertCircle,
        },
        {
            label: 'Low',
            value: summary.lowCount,
            type: 'low' as const,
            icon: Info,
        },
    ];

    return (
        <div className="summary-grid">
            {cards.map((card, index) => (
                <div
                    key={card.type}
                    className={`summary-card ${card.type} animate-slide-up`}
                    style={{ animationDelay: `${index * 50}ms` }}
                >
                    <div className="summary-card-icon">
                        <card.icon size={24} />
                    </div>
                    <div className="summary-card-value">
                        {isLoading ? (
                            <span className="loading-placeholder">—</span>
                        ) : (
                            card.value.toLocaleString()
                        )}
                    </div>
                    <div className="summary-card-label">{card.label}</div>
                </div>
            ))}
        </div>
    );
}
