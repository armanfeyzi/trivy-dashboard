package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
	PageSize     int
	FSOutputDir  string // Optional: write to local filesystem
}

// ReportResource defines the K8s resource to collect
type ReportResource struct {
	Name     string // e.g., "vulnerabilityreports"
	Kind     string // e.g., "VulnerabilityReport"
	FileName string // JSON filename prefix, e.g., "vulnerability-reports"
}

// List of resources to collect
// Note: SBOM reports (sbomreports, clustersbomreports) are disabled to reduce storage and improve performance
var reportResources = []ReportResource{
	{Name: "vulnerabilityreports", Kind: "VulnerabilityReport", FileName: "vulnerability-reports"},
	{Name: "configauditreports", Kind: "ConfigAuditReport", FileName: "config-audit-reports"},
	{Name: "clusterconfigauditreports", Kind: "ClusterConfigAuditReport", FileName: "cluster-config-audit-reports"},
	{Name: "clusterrbacassessmentreports", Kind: "ClusterRbacAssessmentReport", FileName: "cluster-rbac-assessment-reports"},
	{Name: "exposedsecretreports", Kind: "ExposedSecretReport", FileName: "exposed-secret-reports"},
	{Name: "clustercompliancereports", Kind: "ClusterComplianceReport", FileName: "cluster-compliance-reports"},
	{Name: "clustervulnerabilityreports", Kind: "ClusterVulnerabilityReport", FileName: "cluster-vulnerability-reports"},
	{Name: "rbacassessmentreports", Kind: "RbacAssessmentReport", FileName: "rbac-assessment-reports"},
}

// CollectionMetadata represents metadata about a collection run
type CollectionMetadata struct {
	Cluster         string      `json:"cluster"`
	Timestamp       string      `json:"timestamp"`
	CollectedAt     string      `json:"collectedAt"`
	ReportTypes     []string    `json:"reportTypes"`
	CollectionStats interface{} `json:"collectionStats"`
}

func main() {
	log.Println("🚀 Starting Trivy Exporter (Optimized v3 - PVC)...")

	// Load configuration
	cfg := loadConfig()
	log.Printf("📋 Configuration: cluster=%s, bucket=%s, interval=%v, pageSize=%d, fsDir=%s",
		cfg.ClusterName, cfg.S3Bucket, cfg.SyncInterval, cfg.PageSize, cfg.FSOutputDir)

	// Create Kubernetes client
	k8sConfig, err := rest.InClusterConfig()
	if err != nil {
		log.Fatalf("❌ Failed to get in-cluster config: %v", err)
	}

	dynamicClient, err := dynamic.NewForConfig(k8sConfig)
	if err != nil {
		log.Fatalf("❌ Failed to create Kubernetes client: %v", err)
	}

	// Create AWS S3 client only if Bucket is provided
	var s3Client *s3.Client
	if cfg.S3Bucket != "" {
		awsCfg, err := config.LoadDefaultConfig(context.Background(),
			config.WithRegion(cfg.AWSRegion),
		)
		if err != nil {
			log.Fatalf("❌ Failed to load AWS config: %v", err)
		}
		s3Client = s3.NewFromConfig(awsCfg)
	} else {
		log.Println("ℹ️ S3_BUCKET not set. S3 upload disabled.")
	}

	// Prepare output directory if needed
	if cfg.FSOutputDir != "" {
		if err := os.MkdirAll(fmt.Sprintf("%s/%s", cfg.FSOutputDir, cfg.ClusterName), 0755); err != nil {
			log.Fatalf("❌ Failed to create output directory: %v", err)
		}
	}

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
		PageSize:     parseInt(getEnv("PAGE_SIZE", "20"), 20),
		FSOutputDir:  getEnv("FS_OUTPUT_DIR", ""),
	}

	if cfg.S3Bucket == "" && cfg.FSOutputDir == "" {
		log.Fatal("❌ Either S3_BUCKET or FS_OUTPUT_DIR environment variable is required")
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

func parseInt(s string, defaultVal int) int {
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

func collectAndUploadAll(ctx context.Context, k8s dynamic.Interface, s3Client *s3.Client, cfg Config) error {
	startTime := time.Now()
	timestamp := time.Now().UTC().Format("20060102-150405")
	s3Path := fmt.Sprintf("%s/%s", cfg.S3Prefix, cfg.ClusterName)

	collectionStats := make(map[string]int)

	// Collect each report type
	for _, resource := range reportResources {
		log.Printf("📥 Fetching %s...", resource.Name)
		count, err := collectResourcePaged(ctx, k8s, s3Client, cfg, resource, s3Path, timestamp)
		if err != nil {
			log.Printf("⚠️ Failed to collect %s: %v", resource.Name, err)
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

	// Note: Metadata is now only stored locally if FS output is enabled
	// S3 only contains latest reports (no timestamped snapshots)
	_ = metadataJSON // Suppress unused variable warning

	// Update cluster index (generic)
	indexData := map[string]interface{}{
		"cluster":         cfg.ClusterName,
		"lastUpdated":     time.Now().UTC().Format(time.RFC3339),
		"collectionStats": collectionStats,
	}
	indexJSON, _ := json.MarshalIndent(indexData, "", "  ")

	if s3Client != nil {
		indexKey := fmt.Sprintf("%s/index.json", s3Path)
		if err := uploadBufferToS3(ctx, s3Client, cfg.S3Bucket, indexKey, indexJSON); err != nil {
			log.Printf("⚠️ Failed to upload index to S3: %v", err)
		}
	}

	// Write to FS if enabled
	if cfg.FSOutputDir != "" {
		// Just write main cluster index locally as "index.json" or similar?
		// Usually dashboard expects <cluster>-<report>.json.
		// Actually, we probably don't need the metadata/index files locally for the dashboard,
		// as it iterates known report types. But let's write index.json anyway for completeness.
		fsClusterDir := fmt.Sprintf("%s/%s", cfg.FSOutputDir, cfg.ClusterName)
		if err := os.WriteFile(fmt.Sprintf("%s/index.json", fsClusterDir), indexJSON, 0644); err != nil {
			log.Printf("⚠️ Failed to write index to FS: %v", err)
		}
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

// collectResourcePaged uses pagination and streaming to temp file to reduce memory usage
func collectResourcePaged(ctx context.Context, k8s dynamic.Interface, s3Client *s3.Client, cfg Config, resource ReportResource, s3Path, timestamp string) (int, error) {
	// ... (setup GVR and temp file) ...
	// RE-IMPLEMENTING START OF FUNCTION DUE TO TOOL LIMITATIONS - KEEPING CONTEXT
	gvr := schema.GroupVersionResource{
		Group:    "aquasecurity.github.io",
		Version:  "v1alpha1",
		Resource: resource.Name,
	}

	// Create temp file
	tmpFile, err := os.CreateTemp("", fmt.Sprintf("%s-*.json", resource.FileName))
	if err != nil {
		return 0, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer func() {
		tmpFile.Close()
		os.Remove(tmpFile.Name()) // Remove temp file after uploading/copying
	}()

	// Write JSON header
	_, err = tmpFile.WriteString(fmt.Sprintf(`{
  "apiVersion": "aquasecurity.github.io/v1alpha1",
  "items": [
`))
	if err != nil {
		return 0, fmt.Errorf("failed to write header: %w", err)
	}

	// ... Pagination Logic (Keep existing logic) ...
	limit := int64(cfg.PageSize)
	if limit <= 0 {
		limit = 20
	}
	continueToken := ""
	totalCount := 0
	firstItem := true

	encoder := json.NewEncoder(tmpFile)

	for {
		listOpts := metav1.ListOptions{
			Limit:    limit,
			Continue: continueToken,
		}

		list, err := k8s.Resource(gvr).List(ctx, listOpts)
		if err != nil {
			if strings.Contains(err.Error(), "could not find the requested resource") {
				log.Printf("ℹ️ Resource %s not found in cluster (CRD missing?)", resource.Name)
				return 0, nil
			}
			return 0, fmt.Errorf("failed to list %s: %w", resource.Name, err)
		}

		for _, item := range list.Items {
			if !firstItem {
				if _, err := tmpFile.WriteString(","); err != nil {
					return 0, err
				}
			}
			if err := encoder.Encode(item.Object); err != nil {
				log.Printf("⚠️ Failed to encode item: %v", err)
				continue
			}
			firstItem = false
			totalCount++
		}

		continueToken = list.GetContinue()
		list = nil
		runtime.GC()

		if continueToken == "" {
			break
		}
	}

	// Write JSON footer
	_, err = tmpFile.WriteString(`
  ]
}`)
	if err != nil {
		return 0, fmt.Errorf("failed to write footer: %w", err)
	}

	log.Printf("✅ Found %d %s", totalCount, resource.Name)

	// Reset file pointer for reading
	if _, err := tmpFile.Seek(0, 0); err != nil {
		return 0, fmt.Errorf("failed to seek temp file: %w", err)
	}

	// Upload to S3 if enabled
	if s3Client != nil {
		// latest
		latestKey := fmt.Sprintf("%s/%s.json", s3Path, resource.FileName)
		if err := uploadFileToS3(ctx, s3Client, cfg.S3Bucket, latestKey, tmpFile); err != nil {
			return 0, fmt.Errorf("failed to upload latest %s: %w", resource.Name, err)
		}

		// Note: Timestamped snapshots disabled - only latest reports are stored
	}

	// Write to FS if enabled
	if cfg.FSOutputDir != "" {
		// Reset file pointer
		if _, err := tmpFile.Seek(0, 0); err != nil {
			return 0, err
		}

		// Destination path: /output/cluster-name/report-filename.json
		// Note: Dashboard expects <cluster>-<report>.json in its data dir.
		// If we mount /data in dashboard, we should write directly to /data/<cluster>-<report>.json
		// OR write to /data/<cluster>/<report>.json and update dashboard to look there.
		// Current dashboard expects: /data/<cluster>-<report>.json.
		// Let's stick to that flat structure in the output dir if we want minimal dashboard changes?
		// Actually, the `FSOutputDir` logic above created a subdirectory `cfg.ClusterName`.
		// Let's adjust to match existing dashboard expectations.

		destPath := fmt.Sprintf("%s/%s-%s.json", cfg.FSOutputDir, cfg.ClusterName, resource.FileName)

		outFile, err := os.Create(destPath)
		if err != nil {
			return 0, fmt.Errorf("failed to create FS output file: %w", err)
		}
		defer outFile.Close()

		if _, err := io.Copy(outFile, tmpFile); err != nil {
			return 0, fmt.Errorf("failed to write FS output: %w", err)
		}
		log.Printf("💾 Saved to %s", destPath)
	}

	return totalCount, nil
}

func uploadFileToS3(ctx context.Context, client *s3.Client, bucket, key string, file *os.File) error {
	// PutObject with os.File automatically handles content length
	_, err := client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        file,
		ContentType: aws.String("application/json"),
	})
	return err
}

func uploadBufferToS3(ctx context.Context, client *s3.Client, bucket, key string, data []byte) error {
	_, err := client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String("application/json"),
	})
	return err
}
