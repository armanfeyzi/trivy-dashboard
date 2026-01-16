# Kubernetes Manifests Deployment

Deploy Trivy Dashboard using plain Kubernetes manifests.

## Prerequisites

- Kubernetes cluster with [Trivy Operator](https://aquasecurity.github.io/trivy-operator/) installed
- S3 bucket for storing vulnerability reports
- kubectl configured for your cluster

## Quick Start

### 1. Create Namespace and RBAC

```bash
kubectl apply -f namespace.yaml
kubectl apply -f rbac.yaml
```

### 2. Configure S3 Credentials

```bash
# Copy the example and fill in your values
cp secret.yaml.example secret.yaml
# Edit secret.yaml with your S3 credentials
kubectl apply -f secret.yaml
```

### 3. Deploy Exporter

**Important:** Set your cluster name before deploying:

```bash
# Edit exporter-deployment.yaml and change CLUSTER_NAME value
# Or use kubectl after applying:
kubectl apply -f exporter-deployment.yaml
kubectl set env deployment/trivy-exporter -n trivy-dashboard CLUSTER_NAME=your-cluster-name
```

### 4. Deploy Dashboard

```bash
kubectl apply -f dashboard-deployment.yaml
kubectl apply -f dashboard-service.yaml
```

### 5. (Optional) Configure Ingress

```bash
cp ingress.yaml.example ingress.yaml
# Edit ingress.yaml with your domain
kubectl apply -f ingress.yaml
```

## Multi-Cluster Setup

For multi-cluster environments:

1. **Deploy Exporter** in each cluster with a unique `CLUSTER_NAME`
2. **Deploy Dashboard** in only one cluster (or centrally)
3. All exporters push to the same S3 bucket
4. Dashboard reads from all cluster data in S3

```
Cluster A (CLUSTER_NAME=prod-us)     ──┐
Cluster B (CLUSTER_NAME=prod-eu)     ──┼──► S3 Bucket ◄── Dashboard
Cluster C (CLUSTER_NAME=staging)     ──┘
```

## Configuration

### Environment Variables

| Variable | Component | Description |
|----------|-----------|-------------|
| `CLUSTER_NAME` | Exporter | Unique name for this cluster |
| `S3_BUCKET` | Both | S3 bucket name |
| `S3_PREFIX` | Both | Optional prefix in bucket |
| `AWS_REGION` | Both | AWS region |
| `SYNC_INTERVAL` | Exporter | Sync interval in seconds (default: 300) |

## Verify Deployment

```bash
# Check pods
kubectl get pods -n trivy-dashboard

# Check dashboard logs
kubectl logs -n trivy-dashboard -l app.kubernetes.io/component=dashboard

# Check exporter logs
kubectl logs -n trivy-dashboard -l app.kubernetes.io/component=exporter
```
