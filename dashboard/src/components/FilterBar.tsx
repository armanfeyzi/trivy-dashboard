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
}: FilterBarProps) {
    const hasActiveFilters = search || namespace || severity;

    return (
        <div className="controls-bar">
            <div className="search-wrapper">
                <Search size={16} />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search by name, container, or namespace..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            <div className="filter-group">
                <label className="filter-label">Namespace</label>
                <select
                    className="filter-select"
                    value={namespace}
                    onChange={(e) => onNamespaceChange(e.target.value)}
                >
                    <option value="">All Namespaces</option>
                    {namespaces.map((ns) => (
                        <option key={ns} value={ns}>
                            {ns}
                        </option>
                    ))}
                </select>
            </div>

            <div className="filter-group">
                <label className="filter-label">Severity</label>
                <select
                    className="filter-select"
                    value={severity}
                    onChange={(e) => onSeverityChange(e.target.value)}
                >
                    <option value="">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>

            {hasActiveFilters && (
                <button className="btn btn-ghost btn-sm" onClick={onClearFilters}>
                    <X size={14} />
                    Clear
                </button>
            )}
        </div>
    );
}
