import { Server } from 'lucide-react';

interface ClusterSelectorProps {
    clusters: string[];
    selectedCluster: string;
    onClusterChange: (cluster: string) => void;
}

export function ClusterSelector({ clusters, selectedCluster, onClusterChange }: ClusterSelectorProps) {
    return (
        <div className="cluster-tabs">
            <button
                className={`cluster-tab ${selectedCluster === 'all' ? 'active' : ''}`}
                onClick={() => onClusterChange('all')}
            >
                <span className="cluster-tab-dot" />
                All Clusters
            </button>
            {clusters.map((cluster) => (
                <button
                    key={cluster}
                    className={`cluster-tab ${selectedCluster === cluster ? 'active' : ''}`}
                    onClick={() => onClusterChange(cluster)}
                >
                    <Server size={14} />
                    {cluster.toUpperCase()}
                </button>
            ))}
        </div>
    );
}
