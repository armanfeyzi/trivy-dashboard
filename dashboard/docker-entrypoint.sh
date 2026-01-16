#!/bin/sh
set -e

echo "🚀 Starting Trivy Dashboard..."

# Sync data from S3 if configured
if [ -n "$S3_BUCKET" ]; then
    echo "📥 Syncing vulnerability reports from S3..."
    
    # Sync each cluster's data
    aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/dev/vulnerability-reports-latest.json" /usr/share/nginx/html/data/dev-reports.json 2>/dev/null || true
    aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX:-vuln}/prod/vulnerability-reports-latest.json" /usr/share/nginx/html/data/prod-reports.json 2>/dev/null || true
    
    echo "✅ Data sync complete!"
fi

# Start nginx with custom PID file location
exec nginx -g "daemon off; pid /tmp/nginx.pid;"
