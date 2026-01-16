# Trivy Dashboard Helm Chart

A Helm chart for deploying Trivy Dashboard - a multi-cluster vulnerability dashboard.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- [Trivy Operator](https://aquasecurity.github.io/trivy-operator/) installed
- S3 bucket for storing vulnerability reports

## Installation

### Add the repository (if published)

```bash
helm repo add trivy-dashboard https://armanfeyzi.github.io/trivy-dashboard
helm repo update
```

### Install from local chart

```bash
helm install trivy-dashboard ./deploy/helm/trivy-dashboard \
  --namespace trivy-dashboard \
  --create-namespace \
  --set clusterName=my-cluster \
  --set s3.bucket=my-trivy-reports \
  --set s3.accessKeyId=AKIAXXXXXXXX \
  --set s3.secretAccessKey=xxxxx
```

### Using a values file

```bash
# Create your values file
cat > my-values.yaml << EOF
clusterName: production

s3:
  bucket: my-trivy-reports
  region: eu-west-1
  accessKeyId: AKIAXXXXXXXX
  secretAccessKey: xxxxx

ingress:
  enabled: true
  hosts:
    - host: trivy.example.com
      paths:
        - path: /
          pathType: Prefix
EOF

# Install
helm install trivy-dashboard ./deploy/helm/trivy-dashboard \
  --namespace trivy-dashboard \
  --create-namespace \
  -f my-values.yaml
```

## Multi-Cluster Setup

For monitoring multiple clusters:

1. **Cluster A** (production):
   ```bash
   helm install trivy-dashboard ./deploy/helm/trivy-dashboard \
     --set clusterName=production \
     --set dashboard.enabled=true \
     --set exporter.enabled=true \
     --set s3.bucket=shared-trivy-bucket
   ```

2. **Cluster B** (staging) - exporter only:
   ```bash
   helm install trivy-exporter ./deploy/helm/trivy-dashboard \
     --set clusterName=staging \
     --set dashboard.enabled=false \
     --set exporter.enabled=true \
     --set s3.bucket=shared-trivy-bucket
   ```

All exporters push to the same S3 bucket, and one dashboard reads all data.

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `clusterName` | Unique name for this cluster | `"my-cluster"` |
| `namespace.create` | Create namespace | `true` |
| `namespace.name` | Namespace name | `"trivy-dashboard"` |
| `dashboard.enabled` | Deploy dashboard | `true` |
| `dashboard.image.repository` | Dashboard image | `armanfeyzi/trivy-dashboard` |
| `dashboard.image.tag` | Dashboard image tag | `v1.1.0` |
| `exporter.enabled` | Deploy exporter | `true` |
| `exporter.image.repository` | Exporter image | `armanfeyzi/trivy-exporter` |
| `exporter.syncInterval` | Sync interval (seconds) | `300` |
| `s3.bucket` | S3 bucket name | `""` |
| `s3.region` | AWS region | `"eu-west-1"` |
| `s3.prefix` | S3 prefix | `"trivy-reports"` |
| `s3.existingSecret` | Use existing secret | `""` |
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.hosts` | Ingress hosts | `[]` |

## Uninstall

```bash
helm uninstall trivy-dashboard -n trivy-dashboard
```
