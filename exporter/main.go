package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
)

// Configuration from environment variables
type Config struct {
	ClusterName  string
	S3Bucket     string
	S3Prefix     string
	SyncInterval time.Duration
	AWSRegion    string
}

// ReportResource defines the K8s resource to collect
type ReportResource struct {
	Name     string // e.g., "vulnerabilityreports"
	Kind     string // e.g., "VulnerabilityReport"
	FileName string // JSON filename prefix, e.g., "vulnerability-reports"
}

// List of resources to collect
var reportResources = []ReportResource{
	{Name: "vulnerabilityreports", Kind: "VulnerabilityReport", FileName: "vulnerability-reports"},
	{Name: "configauditreports", Kind: "ConfigAuditReport", FileName: "config-audit-reports"},
	{Name: "clusterconfigauditreports", Kind: "ClusterConfigAuditReport", FileName: "cluster-config-audit-reports"}, // Added based on typical Trivy operator resources, checking user request
	{Name: "clusterrbacassessmentreports", Kind: "ClusterRbacAssessmentReport", FileName: "cluster-rbac-assessment-reports"},
	{Name: "exposedsecretreports", Kind: "ExposedSecretReport", FileName: "exposed-secret-reports"},
	{Name: "clustercompliancereports", Kind: "ClusterComplianceReport", FileName: "cluster-compliance-reports"},
	{Name: "clustervulnerabilityreports", Kind: "ClusterVulnerabilityReport", FileName: "cluster-vulnerability-reports"},
	{Name: "rbacassessmentreports", Kind: "RbacAssessmentReport", FileName: "rbac-assessment-reports"},
	{Name: "sbomreports", Kind: "SbomReport", FileName: "sbom-reports"},
	{Name: "clustersbomreports", Kind: "ClusterSbomReport", FileName: "cluster-sbom-reports"},
}

// Generic Response structure
type GenericReportsResponse struct {
	APIVersion string                      `json:"apiVersion"`
	Items      []unstructured.Unstructured `json:"items"`
	Metadata   map[string]interface{}      `json:"metadata,omitempty"`
}

// CollectionMetadata represents metadata about a collection run
type CollectionMetadata struct {
	Cluster         string      `json:"cluster"`
	Timestamp       string      `json:"timestamp"`
	CollectedAt     string      `json:"collectedAt"`
	ReportsCount    int         `json:"reportsCount"` // Total of all reports? Or per type? We'll make this generic or a map
	ReportTypes     []string    `json:"reportTypes"`
	CollectionStats interface{} `json:"collectionStats"`
}

func main() {
	log.Println("🚀 Starting Trivy Exporter...")

	// Load configuration
	cfg := loadConfig()
	log.Printf("📋 Configuration: cluster=%s, bucket=%s, interval=%v",
		cfg.ClusterName, cfg.S3Bucket, cfg.SyncInterval)

	// Create Kubernetes client
	k8sConfig, err := rest.InClusterConfig()
	if err != nil {
		log.Fatalf("❌ Failed to get in-cluster config: %v", err)
	}

	dynamicClient, err := dynamic.NewForConfig(k8sConfig)
	if err != nil {
		log.Fatalf("❌ Failed to create Kubernetes client: %v", err)
	}

	// Create AWS S3 client
	awsCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion(cfg.AWSRegion),
	)
	if err != nil {
		log.Fatalf("❌ Failed to load AWS config: %v", err)
	}
	s3Client := s3.NewFromConfig(awsCfg)

	// Set up signal handling for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Run initial collection
	log.Println("🔄 Running initial collection...")
	if err := collectAndUploadAll(ctx, dynamicClient, s3Client, cfg); err != nil {
		log.Printf("⚠️ Initial collection failed: %v", err)
	}

	// Start periodic collection
	ticker := time.NewTicker(cfg.SyncInterval)
	defer ticker.Stop()

	log.Printf("⏰ Starting periodic collection every %v", cfg.SyncInterval)

	for {
		select {
		case <-ticker.C:
			log.Println("🔄 Running scheduled collection...")
			if err := collectAndUploadAll(ctx, dynamicClient, s3Client, cfg); err != nil {
				log.Printf("⚠️ Collection failed: %v", err)
			}
		case sig := <-sigCh:
			log.Printf("📤 Received signal %v, shutting down...", sig)
			return
		case <-ctx.Done():
			log.Println("📤 Context cancelled, shutting down...")
			return
		}
	}
}

func loadConfig() Config {
	cfg := Config{
		ClusterName:  getEnv("CLUSTER_NAME", "dev"),
		S3Bucket:     getEnv("S3_BUCKET", ""),
		S3Prefix:     getEnv("S3_PREFIX", "vuln"),
		AWSRegion:    getEnv("AWS_REGION", "eu-west-1"),
		SyncInterval: parseDuration(getEnv("SYNC_INTERVAL", "5m")),
	}

	if cfg.S3Bucket == "" {
		log.Fatal("❌ S3_BUCKET environment variable is required")
	}

	return cfg
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		log.Printf("⚠️ Invalid duration %q, using default 5m", s)
		return 5 * time.Minute
	}
	return d
}

func collectAndUploadAll(ctx context.Context, k8s dynamic.Interface, s3Client *s3.Client, cfg Config) error {
	startTime := time.Now()
	timestamp := time.Now().UTC().Format("20060102-150405")
	s3Path := fmt.Sprintf("%s/%s", cfg.S3Prefix, cfg.ClusterName)
	
	collectionStats := make(map[string]int)

	// Collect each report type
	for _, resource := range reportResources {
		log.Printf("📥 Fetching %s...", resource.Name)
		count, err := collectResource(ctx, k8s, s3Client, cfg, resource, s3Path, timestamp)
		if err != nil {
			log.Printf("⚠️ Failed to collect %s: %v", resource.Name, err)
			// Continue with other resources instead of failing completely
			continue
		}
		collectionStats[resource.Name] = count
	}

	// Upload metadata/index for the whole collection
	metadata := CollectionMetadata{
		Cluster:         cfg.ClusterName,
		Timestamp:       timestamp,
		CollectedAt:     time.Now().UTC().Format(time.RFC3339),
		ReportTypes:     getReportTypeNames(),
		CollectionStats: collectionStats,
	}

	metadataJSON, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Upload main metadata
	if err := uploadToS3(ctx, s3Client, cfg.S3Bucket, fmt.Sprintf("%s/reports/%s/metadata.json", s3Path, timestamp), metadataJSON); err != nil {
		log.Printf("⚠️ Failed to upload metadata: %v", err)
	}

	// Update cluster index (generic)
	indexKey := fmt.Sprintf("%s/index.json", s3Path)
	indexData := map[string]interface{}{
		"cluster":         cfg.ClusterName,
		"lastUpdated":     time.Now().UTC().Format(time.RFC3339),
		"collectionStats": collectionStats,
	}
	indexJSON, _ := json.MarshalIndent(indexData, "", "  ")
	if err := uploadToS3(ctx, s3Client, cfg.S3Bucket, indexKey, indexJSON); err != nil {
		log.Printf("⚠️ Failed to upload index: %v", err)
	}

	duration := time.Since(startTime)
	log.Printf("🎉 Collection cycle complete in %v!", duration)
	return nil
}

func getReportTypeNames() []string {
	names := make([]string, len(reportResources))
	for i, r := range reportResources {
		names[i] = r.Name
	}
	return names
}

func collectResource(ctx context.Context, k8s dynamic.Interface, s3Client *s3.Client, cfg Config, resource ReportResource, s3Path, timestamp string) (int, error) {
	gvr := schema.GroupVersionResource{
		Group:    "aquasecurity.github.io",
		Version:  "v1alpha1",
		Resource: resource.Name,
	}

	list, err := k8s.Resource(gvr).List(ctx, metav1.ListOptions{})
	if err != nil {
		// If resource type doesn't exist (e.g. CRD not installed), just log and return 0
		if strings.Contains(err.Error(), "could not find the requested resource") {
			log.Printf("ℹ️ Resource %s not found in cluster (CRD missing?)", resource.Name)
			return 0, nil
		}
		return 0, err
	}

	log.Printf("✅ Found %d %s", len(list.Items), resource.Name)

	response := GenericReportsResponse{
		APIVersion: "aquasecurity.github.io/v1alpha1",
		Items:      list.Items,
	}

	dataJSON, err := json.MarshalIndent(response, "", "  ")
	if err != nil {
		return 0, fmt.Errorf("failed to marshal %s: %w", resource.Name, err)
	}

	// Upload 'latest' version
	latestKey := fmt.Sprintf("%s/%s.json", s3Path, resource.FileName)
	if err := uploadToS3(ctx, s3Client, cfg.S3Bucket, latestKey, dataJSON); err != nil {
		return 0, fmt.Errorf("failed to upload latest %s: %w", resource.Name, err)
	}

	// Upload timestamped version
	timestampKey := fmt.Sprintf("%s/reports/%s/%s.json", s3Path, timestamp, resource.FileName)
	if err := uploadToS3(ctx, s3Client, cfg.S3Bucket, timestampKey, dataJSON); err != nil {
		return 0, fmt.Errorf("failed to upload timestamped %s: %w", resource.Name, err)
	}

	return len(list.Items), nil
}

func uploadToS3(ctx context.Context, client *s3.Client, bucket, key string, data []byte) error {
	_, err := client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String("application/json"),
	})
	return err
}

