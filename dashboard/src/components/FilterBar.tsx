import { Search, X, Server } from 'lucide-react';

interface FilterBarProps {
    search: string;
    onSearchChange: (value: string) => void;
    namespace: string;
    onNamespaceChange: (value: string) => void;
    severity: string;
    onSeverityChange: (value: string) => void;
    namespaces: string[];
    onClearFilters: () => void;
    clusters: string[];
    selectedCluster: string;
    onClusterChange: (value: string) => void;
}

export function FilterBar({
    search,
    onSearchChange,
    namespace,
    onNamespaceChange,
    severity,
    onSeverityChange,
    namespaces,
    onClearFilters,
    clusters,
    selectedCluster,
    onClusterChange,
}: FilterBarProps) {
    const hasActiveFilters = search || namespace || severity;

    return (
        <div className="card" style={{
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            gap: 'var(--space-4)',
            alignItems: 'center',
            flexWrap: 'wrap' // Allow wrapping on small screens
        }}>

            {/* Cluster Selector */}
            <div className="input-group" style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                padding: '0 var(--space-3)',
                border: '1px solid var(--color-border)',
                minWidth: '200px'
            }}>
                <Server size={16} style={{ color: 'var(--color-text-secondary)', marginRight: 'var(--space-3)' }} />
                <select
                    value={selectedCluster}
                    onChange={(e) => onClusterChange(e.target.value)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 'var(--space-2) 0',
                        width: '100%',
                        color: 'var(--color-text-primary)',
                        fontWeight: 500,
                        outline: 'none',
                        fontSize: 'var(--font-size-sm)'
                    }}
                >
                    <option value="all">All Clusters</option>
                    {clusters.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
            </div>

            {/* Separator */}
            <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', display: 'none' }} className="desktop-only" />

            {/* Namespace Filter */}
            <select
                className="filter-select-v2"
                value={namespace}
                onChange={(e) => onNamespaceChange(e.target.value)}
                style={{
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-sm)',
                    maxWidth: '180px',
                    height: '38px' // Match input height
                }}
            >
                <option value="">Namespace: All</option>
                {namespaces.map((ns) => (
                    <option key={ns} value={ns}>{ns}</option>
                ))}
            </select>

            {/* Severity Filter */}
            <select
                className="filter-select-v2"
                value={severity}
                onChange={(e) => onSeverityChange(e.target.value)}
                style={{
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-sm)',
                    maxWidth: '150px',
                    height: '38px'
                }}
            >
                <option value="">Severity: All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
            </select>

            {/* Search Bar - Grows to fill space */}
            <div className="input-group" style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                padding: '0 var(--space-3)',
                border: '1px solid var(--color-border)',
                flex: 1,
                minWidth: '200px'
            }}>
                <Search size={16} style={{ color: 'var(--color-text-secondary)', marginRight: 'var(--space-3)' }} />
                <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 'var(--space-2) 0',
                        width: '100%',
                        color: 'var(--color-text-primary)',
                        outline: 'none',
                        fontSize: 'var(--font-size-sm)'
                    }}
                />
                {search && (
                    <button onClick={() => onSearchChange('')} className="btn btn-ghost btn-icon btn-sm" style={{ padding: 0, width: '20px', height: '20px', marginLeft: 'var(--space-2)' }}>
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Clear Button */}
            {hasActiveFilters && (
                <button
                    className="btn btn-ghost btn-icon"
                    onClick={onClearFilters}
                    title="Reset All Filters"
                    style={{ height: '38px', width: '38px' }}
                >
                    <X size={18} />
                </button>
            )}
        </div>
    );
}
