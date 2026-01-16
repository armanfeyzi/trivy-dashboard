# Trivy Dashboard

A modern, multi-cluster dashboard for visualizing Trivy vulnerability reports across Kubernetes clusters.

## Features

- 🌐 **Multi-cluster support** - View vulnerability reports from multiple clusters
- 🎨 **Modern UI** - Light/dark theme with glassmorphism design
- 🔄 **Auto-refresh** - Data updates every 30 seconds
- 🔍 **Advanced filtering** - Filter by cluster, namespace, and severity
- 📊 **Sortable table** - Sort by any column
- 📤 **Export** - Export reports as CSV, JSON, or HTML
- 📈 **Charts** - Severity distribution and cluster comparison

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Kubernetes Clusters                         │
├──────────────────────┬──────────────────────┬───────────────────┤
│   Cluster A          │   Cluster B          │   Cluster C       │
│  ┌────────────────┐  │  ┌────────────────┐  │  ┌────────────────┐│
│  │ Trivy Operator │  │  │ Trivy Operator │  │  │ Trivy Operator ││
│  └───────┬────────┘  │  └───────┬────────┘  │  └───────┬────────┘│
│  ┌───────▼────────┐  │  ┌───────▼────────┐  │  ┌───────▼────────┐│
│  │ Trivy Exporter │  │  │ Trivy Exporter │  │  │ Trivy Exporter ││
│  └───────┬────────┘  │  └───────┬────────┘  │  └───────┬────────┘│
└──────────┼───────────┴──────────┼───────────┴──────────┼────────┘
           └──────────────────────┼──────────────────────┘
                                  ▼
                           ┌──────────────┐
                           │  S3 Bucket   │
                           └──────┬───────┘
                                  ▼
                           ┌──────────────┐
                           │  Dashboard   │
                           └──────────────┘
```

## Quick Start

### Prerequisites

- Kubernetes cluster with [Trivy Operator](https://aquasecurity.github.io/trivy-operator/) installed
- S3 bucket for storing vulnerability reports
- AWS credentials with S3 access

### Option 1: Kubernetes Manifests

```bash
cd deploy/k8s

# 1. Create namespace and RBAC
kubectl apply -f namespace.yaml
kubectl apply -f rbac.yaml

# 2. Configure S3 credentials
cp secret.yaml.example secret.yaml
# Edit secret.yaml with your values
kubectl apply -f secret.yaml

# 3. Deploy exporter (set your cluster name)
kubectl apply -f exporter-deployment.yaml
kubectl set env deployment/trivy-exporter -n trivy-dashboard CLUSTER_NAME=my-cluster

# 4. Deploy dashboard
kubectl apply -f dashboard-deployment.yaml
kubectl apply -f dashboard-service.yaml

# 5. (Optional) Configure ingress
cp ingress.yaml.example ingress.yaml
kubectl apply -f ingress.yaml
```

See [deploy/k8s/README.md](deploy/k8s/README.md) for details.

### Option 2: Helm Chart

```bash
helm install trivy-dashboard ./deploy/helm/trivy-dashboard \
  --namespace trivy-dashboard \
  --create-namespace \
  --set clusterName=my-cluster \
  --set s3.bucket=my-trivy-reports \
  --set s3.accessKeyId=AKIAXXXXXXXX \
  --set s3.secretAccessKey=xxxxx
```

See [deploy/helm/trivy-dashboard/README.md](deploy/helm/trivy-dashboard/README.md) for details.

## Multi-Cluster Setup

Deploy the **exporter** in each cluster with a unique `CLUSTER_NAME`:

```bash
# Cluster A
helm install trivy ./deploy/helm/trivy-dashboard \
  --set clusterName=production \
  --set s3.bucket=shared-bucket

# Cluster B (exporter only)
helm install trivy ./deploy/helm/trivy-dashboard \
  --set clusterName=staging \
  --set dashboard.enabled=false \
  --set s3.bucket=shared-bucket
```

All exporters push to the same S3 bucket, and one dashboard reads all data.

## Components

### Dashboard (`dashboard/`)

React/TypeScript web application with Vite.

```bash
cd dashboard
npm install
npm run dev     # http://localhost:5173
npm run build   # Production build
```

### Exporter (`exporter/`)

Go application that watches Trivy CRDs and pushes to S3.

```bash
cd exporter
go build -o trivy-exporter .
```

## Docker Images

```bash
# Dashboard
docker pull armanfeyzi/trivy-dashboard:v1.1.0

# Exporter
docker pull armanfeyzi/trivy-exporter:latest
```

## Configuration

| Variable | Component | Description |
|----------|-----------|-------------|
| `CLUSTER_NAME` | Exporter | Unique name for this cluster |
| `S3_BUCKET` | Both | S3 bucket name |
| `S3_PREFIX` | Both | Prefix in bucket (default: `trivy-reports`) |
| `AWS_REGION` | Both | AWS region |
| `SYNC_INTERVAL` | Exporter | Sync interval in seconds (default: 300) |

## License

MIT

