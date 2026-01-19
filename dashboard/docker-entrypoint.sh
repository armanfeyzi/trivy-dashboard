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
if [ -n "$S3_BUCKET" ]; then
    echo "📥 Syncing vulnerability reports from S3..."
    
    for cluster in $CLUSTER_LIST; do
        echo "   Syncing $cluster..."
        aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/$cluster/vulnerability-reports-latest.json" "/usr/share/nginx/html/data/${cluster}-reports.json" 2>/dev/null || true
    done
    
    echo "✅ Data sync complete!"
fi

# Start nginx (using pid from nginx.conf)
exec nginx -g "daemon off;"
