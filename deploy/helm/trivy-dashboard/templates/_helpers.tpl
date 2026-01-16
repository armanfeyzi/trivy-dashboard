{{/*
Expand the name of the chart.
*/}}
{{- define "trivy-dashboard.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "trivy-dashboard.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "trivy-dashboard.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "trivy-dashboard.labels" -}}
helm.sh/chart: {{ include "trivy-dashboard.chart" . }}
{{ include "trivy-dashboard.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "trivy-dashboard.selectorLabels" -}}
app.kubernetes.io/name: {{ include "trivy-dashboard.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Dashboard selector labels
*/}}
{{- define "trivy-dashboard.dashboard.selectorLabels" -}}
{{ include "trivy-dashboard.selectorLabels" . }}
app.kubernetes.io/component: dashboard
{{- end }}

{{/*
Exporter selector labels
*/}}
{{- define "trivy-dashboard.exporter.selectorLabels" -}}
{{ include "trivy-dashboard.selectorLabels" . }}
app.kubernetes.io/component: exporter
{{- end }}

{{/*
S3 Secret name
*/}}
{{- define "trivy-dashboard.secretName" -}}
{{- if .Values.s3.existingSecret }}
{{- .Values.s3.existingSecret }}
{{- else }}
{{- include "trivy-dashboard.fullname" . }}-s3
{{- end }}
{{- end }}

{{/*
Namespace
*/}}
{{- define "trivy-dashboard.namespace" -}}
{{- .Values.namespace.name | default .Release.Namespace }}
{{- end }}
