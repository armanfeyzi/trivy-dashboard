import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import type { ClusterData } from '@/lib/types';

interface SeverityChartProps {
    clusters: ClusterData[];
    selectedCluster: string;
}

const SEVERITY_COLORS = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
};

export function SeverityChart({ clusters, selectedCluster }: SeverityChartProps) {
    const pieData = useMemo(() => {
        const summary = clusters.reduce((acc, cluster) => {
            if (selectedCluster === 'all' || cluster.cluster === selectedCluster) {
                acc.critical += cluster.summary.criticalCount;
                acc.high += cluster.summary.highCount;
                acc.medium += cluster.summary.mediumCount;
                acc.low += cluster.summary.lowCount;
            }
            return acc;
        }, { critical: 0, high: 0, medium: 0, low: 0 });

        return [
            { name: 'Critical', value: summary.critical, color: SEVERITY_COLORS.critical },
            { name: 'High', value: summary.high, color: SEVERITY_COLORS.high },
            { name: 'Medium', value: summary.medium, color: SEVERITY_COLORS.medium },
            { name: 'Low', value: summary.low, color: SEVERITY_COLORS.low },
        ].filter(d => d.value > 0);
    }, [clusters, selectedCluster]);

    const barData = useMemo(() => {
        return clusters.map(cluster => ({
            name: cluster.cluster.toUpperCase(),
            Critical: cluster.summary.criticalCount,
            High: cluster.summary.highCount,
            Medium: cluster.summary.mediumCount,
            Low: cluster.summary.lowCount,
        }));
    }, [clusters]);

    const total = pieData.reduce((sum, d) => sum + d.value, 0);

    if (total === 0) {
        return null;
    }

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--space-5)',
            marginBottom: 'var(--space-6)',
        }}>
            {/* Pie Chart - Severity Distribution */}
            <div className="card" style={{ padding: 'var(--space-5)' }}>
                <h3 style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                    marginBottom: 'var(--space-4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}>
                    Severity Distribution
                </h3>
                <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    background: 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--color-text-primary)',
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 'var(--space-4)',
                    marginTop: 'var(--space-3)',
                    flexWrap: 'wrap',
                }}>
                    {pieData.map((d) => (
                        <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div style={{
                                width: 12,
                                height: 12,
                                borderRadius: 'var(--radius-sm)',
                                background: d.color,
                            }} />
                            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                                {d.name}: {d.value}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bar Chart - Cluster Comparison (only show if all clusters) */}
            {selectedCluster === 'all' && clusters.length > 1 && (
                <div className="card" style={{ padding: 'var(--space-5)' }}>
                    <h3 style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--space-4)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}>
                        Cluster Comparison
                    </h3>
                    <div style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                                <XAxis
                                    dataKey="name"
                                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                                    axisLine={{ stroke: 'var(--color-border)' }}
                                />
                                <YAxis
                                    tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                                    axisLine={{ stroke: 'var(--color-border)' }}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--color-bg-tertiary)',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-md)',
                                        color: 'var(--color-text-primary)',
                                    }}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: 12 }}
                                />
                                <Bar dataKey="Critical" stackId="a" fill={SEVERITY_COLORS.critical} />
                                <Bar dataKey="High" stackId="a" fill={SEVERITY_COLORS.high} />
                                <Bar dataKey="Medium" stackId="a" fill={SEVERITY_COLORS.medium} />
                                <Bar dataKey="Low" stackId="a" fill={SEVERITY_COLORS.low} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
