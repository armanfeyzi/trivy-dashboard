#!/bin/sh
set -e

echo "🚀 Starting Trivy Dashboard..."

# Function to sync data from S3
sync_data() {
    if [ -n "$S3_BUCKET" ]; then
        echo "📥 Syncing vulnerability reports from S3..."
        
        # Sync dev cluster data
        aws s3 cp "s3://${S3_BUCKET}/vuln/dev/vulnerability-reports-latest.json" \
            /usr/share/nginx/html/data/dev-reports.json 2>/dev/null || \
            echo '{"items":[]}' > /usr/share/nginx/html/data/dev-reports.json
        
        # Sync prod cluster data
        aws s3 cp "s3://${S3_BUCKET}/vuln/prod/vulnerability-reports-latest.json" \
            /usr/share/nginx/html/data/prod-reports.json 2>/dev/null || \
            echo '{"items":[]}' > /usr/share/nginx/html/data/prod-reports.json
        
        echo "✅ Data sync complete!"
    else
        echo "⚠️ S3_BUCKET not set, using local data files"
    fi
}

# Initial sync
sync_data

# Start background sync (every 5 minutes)
if [ -n "$S3_BUCKET" ]; then
    (
        while true; do
            sleep 300
            echo "🔄 Running scheduled data sync..."
            sync_data
        done
    ) &
fi

# Start nginx
exec "$@"
