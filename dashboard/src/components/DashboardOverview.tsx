import { useMemo } from 'react';
import { Shield, AlertTriangle, AlertCircle, Info, FileBarChart, Server } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { VulnerabilitySummary, ClusterData } from '@/lib/types';

interface DashboardOverviewProps {
    summary: VulnerabilitySummary;
    totalReports: number;
    clusters: ClusterData[];
    selectedCluster: string;
    isLoading?: boolean;
}

const SEVERITY_COLORS = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
};

export function DashboardOverview({ summary, totalReports, clusters, selectedCluster, isLoading }: DashboardOverviewProps) {
    const pieData = useMemo(() => {
        return [
            { name: 'Critical', value: summary.criticalCount, color: SEVERITY_COLORS.critical },
            { name: 'High', value: summary.highCount, color: SEVERITY_COLORS.high },
            { name: 'Medium', value: summary.mediumCount, color: SEVERITY_COLORS.medium },
            { name: 'Low', value: summary.lowCount, color: SEVERITY_COLORS.low },
        ].filter(d => d.value > 0);
    }, [summary]);

    const barData = useMemo(() => {
        return clusters.map(cluster => ({
            name: cluster.cluster,
            Critical: cluster.summary.criticalCount,
            High: cluster.summary.highCount,
            Medium: cluster.summary.mediumCount,
            Low: cluster.summary.lowCount,
        }));
    }, [clusters]);

    const stats = [
        { label: 'Total Reports', value: totalReports, icon: FileBarChart, color: 'var(--color-text-primary)' },
        { label: 'Critical', value: summary.criticalCount, icon: Shield, color: 'var(--color-critical)' },
        { label: 'High', value: summary.highCount, icon: AlertTriangle, color: 'var(--color-high)' },
        { label: 'Medium', value: summary.mediumCount, icon: AlertCircle, color: 'var(--color-medium)' },
        { label: 'Low', value: summary.lowCount, icon: Info, color: 'var(--color-low)' },
    ];

    if (isLoading) {
        return <div className="animate-pulse" style={{ height: '300px', background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)' }} />;
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
            {/* Left: Summary Stats */}
            <div className="card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Server size={20} className="text-primary" />
                    Overview
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
                    {stats.map((stat, i) => (
                        <div key={stat.label} style={{
                            background: 'var(--color-bg-tertiary)',
                            padding: 'var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            position: 'relative',
                            overflow: 'hidden',
                            gridColumn: i === 0 ? '1 / -1' : 'auto' // Make Total span full width
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-1)' }}>{stat.label}</div>
                                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: stat.color }}>
                                        {stat.value.toLocaleString()}
                                    </div>
                                </div>
                                <stat.icon size={20} style={{ color: stat.color, opacity: 0.8 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Charts */}
            <div className="card" style={{ padding: 'var(--space-6)' }}>
                <div style={{ height: '300px' }}>
                    {selectedCluster === 'all' && clusters.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                                <XAxis dataKey="name" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--color-border)' }} />
                                <YAxis tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--color-border)' }} />
                                <Tooltip contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="Critical" stackId="a" fill={SEVERITY_COLORS.critical} radius={[0, 0, 4, 4]} />
                                <Bar dataKey="High" stackId="a" fill={SEVERITY_COLORS.high} />
                                <Bar dataKey="Medium" stackId="a" fill={SEVERITY_COLORS.medium} />
                                <Bar dataKey="Low" stackId="a" fill={SEVERITY_COLORS.low} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)' }} />
                                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}
