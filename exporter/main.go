package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
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
	ClusterName    string
	S3Bucket       string
	S3Prefix       string
	SyncInterval   time.Duration
	AWSRegion      string
}

// VulnerabilityReportsResponse represents the API response structure
type VulnerabilityReportsResponse struct {
	APIVersion string                     `json:"apiVersion"`
	Items      []unstructured.Unstructured `json:"items"`
	Metadata   map[string]interface{}     `json:"metadata,omitempty"`
}

// CollectionMetadata represents metadata about a collection run
type CollectionMetadata struct {
	Cluster         string            `json:"cluster"`
	Timestamp       string            `json:"timestamp"`
	CollectedAt     string            `json:"collectedAt"`
	ReportsCount    int               `json:"reportsCount"`
	NamespacesCount int               `json:"namespacesCount"`
	Summary         VulnerabilitySummary `json:"summary"`
}

// VulnerabilitySummary contains aggregate vulnerability counts
type VulnerabilitySummary struct {
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
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
	if err := collectAndUpload(ctx, dynamicClient, s3Client, cfg); err != nil {
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
			if err := collectAndUpload(ctx, dynamicClient, s3Client, cfg); err != nil {
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

func collectAndUpload(ctx context.Context, k8s dynamic.Interface, s3Client *s3.Client, cfg Config) error {
	startTime := time.Now()
	log.Printf("📥 Fetching VulnerabilityReports from cluster %s...", cfg.ClusterName)

	// Define the GVR for VulnerabilityReports
	gvr := schema.GroupVersionResource{
		Group:    "aquasecurity.github.io",
		Version:  "v1alpha1",
		Resource: "vulnerabilityreports",
	}

	// List all VulnerabilityReports across all namespaces
	reports, err := k8s.Resource(gvr).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list VulnerabilityReports: %w", err)
	}

	log.Printf("✅ Found %d VulnerabilityReports", len(reports.Items))

	// Calculate summary
	summary, namespaces := calculateSummary(reports.Items)
	
	// Prepare the response structure
	response := VulnerabilityReportsResponse{
		APIVersion: "aquasecurity.github.io/v1alpha1",
		Items:      reports.Items,
	}

	// Serialize to JSON
	reportsJSON, err := json.MarshalIndent(response, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal reports: %w", err)
	}

	// Create metadata
	timestamp := time.Now().UTC().Format("20060102-150405")
	metadata := CollectionMetadata{
		Cluster:         cfg.ClusterName,
		Timestamp:       timestamp,
		CollectedAt:     time.Now().UTC().Format(time.RFC3339),
		ReportsCount:    len(reports.Items),
		NamespacesCount: len(namespaces),
		Summary:         summary,
	}

	metadataJSON, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	// Upload to S3
	s3Path := fmt.Sprintf("%s/%s", cfg.S3Prefix, cfg.ClusterName)

	// Upload latest report
	latestKey := fmt.Sprintf("%s/vulnerability-reports-latest.json", s3Path)
	if err := uploadToS3(ctx, s3Client, cfg.S3Bucket, latestKey, reportsJSON); err != nil {
		return fmt.Errorf("failed to upload latest report: %w", err)
	}
	log.Printf("⬆️ Uploaded latest report to s3://%s/%s", cfg.S3Bucket, latestKey)

	// Upload timestamped report
	timestampKey := fmt.Sprintf("%s/reports/%s/vulnerability-reports.json", s3Path, timestamp)
	if err := uploadToS3(ctx, s3Client, cfg.S3Bucket, timestampKey, reportsJSON); err != nil {
		return fmt.Errorf("failed to upload timestamped report: %w", err)
	}

	// Upload metadata
	metadataKey := fmt.Sprintf("%s/reports/%s/metadata.json", s3Path, timestamp)
	if err := uploadToS3(ctx, s3Client, cfg.S3Bucket, metadataKey, metadataJSON); err != nil {
		return fmt.Errorf("failed to upload metadata: %w", err)
	}

	// Upload cluster index
	indexKey := fmt.Sprintf("%s/index.json", s3Path)
	indexData := map[string]interface{}{
		"cluster":     cfg.ClusterName,
		"lastUpdated": time.Now().UTC().Format(time.RFC3339),
		"latestReport": latestKey,
		"collectionSummary": map[string]interface{}{
			"totalReports":    len(reports.Items),
			"totalNamespaces": len(namespaces),
			"vulnerabilities": summary,
		},
	}
	indexJSON, _ := json.MarshalIndent(indexData, "", "  ")
	if err := uploadToS3(ctx, s3Client, cfg.S3Bucket, indexKey, indexJSON); err != nil {
		return fmt.Errorf("failed to upload index: %w", err)
	}

	duration := time.Since(startTime)
	log.Printf("🎉 Collection complete in %v!", duration)
	log.Printf("📊 Summary: %d reports, %d namespaces, Critical=%d, High=%d, Medium=%d, Low=%d",
		len(reports.Items), len(namespaces), summary.Critical, summary.High, summary.Medium, summary.Low)

	return nil
}

func calculateSummary(items []unstructured.Unstructured) (VulnerabilitySummary, map[string]bool) {
	summary := VulnerabilitySummary{}
	namespaces := make(map[string]bool)

	for _, item := range items {
		// Extract namespace
		if ns, found, _ := unstructured.NestedString(item.Object, "metadata", "namespace"); found {
			namespaces[ns] = true
		}

		// Extract summary counts
		if critical, found, _ := unstructured.NestedInt64(item.Object, "report", "summary", "criticalCount"); found {
			summary.Critical += int(critical)
		}
		if high, found, _ := unstructured.NestedInt64(item.Object, "report", "summary", "highCount"); found {
			summary.High += int(high)
		}
		if medium, found, _ := unstructured.NestedInt64(item.Object, "report", "summary", "mediumCount"); found {
			summary.Medium += int(medium)
		}
		if low, found, _ := unstructured.NestedInt64(item.Object, "report", "summary", "lowCount"); found {
			summary.Low += int(low)
		}
	}

	return summary, namespaces
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
