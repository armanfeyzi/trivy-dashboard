import { Search, X } from 'lucide-react';

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
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Cluster Selector */}
            <div style={{ display: 'flex', background: 'var(--color-bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                <button
                    className={`btn btn-sm ${selectedCluster === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => onClusterChange('all')}
                    style={{ borderRadius: 'var(--radius-sm)' }}
                >
                    All Clusters
                </button>
                {clusters.map((c) => (
                    <button
                        key={c}
                        className={`btn btn-sm ${selectedCluster === c ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => onClusterChange(c)}
                        style={{ borderRadius: 'var(--radius-sm)', textTransform: 'uppercase' }}
                    >
                        {c}
                    </button>
                ))}
            </div>

            <div style={{ width: '1px', height: '24px', background: 'var(--color-border)' }} />

            {/* Search */}
            <div className="search-wrapper" style={{ flex: 1, minWidth: '200px' }}>
                <Search size={16} />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    style={{ background: 'transparent', border: 'none', padding: 0 }}
                />
            </div>

            {/* Selects */}
            <select
                className="filter-select"
                value={namespace}
                onChange={(e) => onNamespaceChange(e.target.value)}
                style={{ minWidth: '140px' }}
            >
                <option value="">Namespace: All</option>
                {namespaces.map((ns) => (
                    <option key={ns} value={ns}>
                        {ns}
                    </option>
                ))}
            </select>

            <select
                className="filter-select"
                value={severity}
                onChange={(e) => onSeverityChange(e.target.value)}
                style={{ minWidth: '120px' }}
            >
                <option value="">Severity: All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
            </select>

            {hasActiveFilters && (
                <button className="btn btn-ghost btn-icon" onClick={onClearFilters} title="Clear Filters">
                    <X size={16} />
                </button>
            )}
        </div>
    );
}
