#!/bin/sh
set -e

echo "🚀 Starting Trivy Dashboard..."

# Parse CLUSTERS env var (comma-separated, defaults to "dev,prod")
CLUSTERS=${CLUSTERS:-"dev,prod"}
# Replace commas with spaces
CLUSTER_LIST=$(echo $CLUSTERS | tr ',' ' ')

# Generate config.json for the frontend
echo "Generating public/config.json with clusters: $CLUSTERS"
# Create a JSON array string
JSON_CLUSTERS=$(echo $CLUSTER_LIST | awk '{ printf "["; for(i=1;i<=NF;i++) printf "\"%s\"%s", $i, (i==NF?"":","); printf "]" }')
echo "{\"clusters\": $JSON_CLUSTERS}" > /usr/share/nginx/html/config.json

# Sync data from S3 if configured
# Sync data from S3 if configured
if [ -n "$S3_BUCKET" ]; then
    echo "📥 Starting background S3 sync..."
    
    sync_data() {
        while true; do
            # echo "   Syncing reports..."
            for cluster in $CLUSTER_LIST; do
                # List of report files to sync
                # We expect them at S3_PREFIX/CLUSTER/filename.json
                # And we want them at /data/CLUSTER-filename.json
                
                # Vulnerability Reports (legacy name fallback supported by API, but we stick to new name)
                # Note: Exporter now uploads 'vulnerability-reports.json', not '-latest.json'
                aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/vulnerability-reports.json" "/usr/share/nginx/html/data/${cluster}-vulnerability-reports.json" 2>/dev/null || true
                # Fallback for old exporter
                aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/vulnerability-reports-latest.json" "/usr/share/nginx/html/data/${cluster}-reports.json" 2>/dev/null || true
                
                # New Reports
                aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/config-audit-reports.json" "/usr/share/nginx/html/data/${cluster}-config-audit-reports.json" 2>/dev/null || true
                aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/exposed-secret-reports.json" "/usr/share/nginx/html/data/${cluster}-exposed-secret-reports.json" 2>/dev/null || true
                aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/cluster-rbac-assessment-reports.json" "/usr/share/nginx/html/data/${cluster}-cluster-rbac-assessment-reports.json" 2>/dev/null || true
                aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/cluster-compliance-reports.json" "/usr/share/nginx/html/data/${cluster}-cluster-compliance-reports.json" 2>/dev/null || true
                aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/cluster-vulnerability-reports.json" "/usr/share/nginx/html/data/${cluster}-cluster-vulnerability-reports.json" 2>/dev/null || true
                aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/rbac-assessment-reports.json" "/usr/share/nginx/html/data/${cluster}-rbac-assessment-reports.json" 2>/dev/null || true
                aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/sbom-reports.json" "/usr/share/nginx/html/data/${cluster}-sbom-reports.json" 2>/dev/null || true
                aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/cluster-sbom-reports.json" "/usr/share/nginx/html/data/${cluster}-cluster-sbom-reports.json" 2>/dev/null || true
                aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/cluster-config-audit-reports.json" "/usr/share/nginx/html/data/${cluster}-cluster-config-audit-reports.json" 2>/dev/null || true
            done
            sleep 30
        done
    }
    
    sync_data &
fi

# Start nginx (using pid from nginx.conf)
exec nginx -g "daemon off;"
