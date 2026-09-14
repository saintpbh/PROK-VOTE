#!/bin/bash
# ==============================================================================
# PROK Vote - 인프라 원복 스크립트 (Standby 절전 모드 복귀)
# 실행 대상: Cloud Run (prok-vote-backend), Cloud SQL (prok-vote-db)
# ==============================================================================

set -e

PROJECT_ID="prok-digital"
REGION="asia-northeast3"
LOG_FILE="$(dirname "$0")/restore.log"

echo "==========================================" | tee -a "$LOG_FILE"
echo "🕒 [$(date '+%Y-%m-%d %H:%M:%S')] 인프라 원복(절전 모드) 작업 시작" | tee -a "$LOG_FILE"
echo "==========================================" | tee -a "$LOG_FILE"

# 1. Cloud Run 백엔드 원복 (최소 인스턴스 0대, 2 CPU, 1Gi)
echo "▶ 1/2. Cloud Run [prok-vote-backend] 절전 모드 전환 중..." | tee -a "$LOG_FILE"
/opt/homebrew/bin/gcloud run services update prok-vote-backend \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --min-instances=0 \
  --max-instances=20 \
  --cpu=2 \
  --memory=1Gi \
  --concurrency=200 \
  --no-session-affinity \
  --quiet | tee -a "$LOG_FILE"

echo "✅ Cloud Run 절전 모드 전환 완료!" | tee -a "$LOG_FILE"

# 2. Cloud SQL 데이터베이스 원복 (db-g1-small 기본 사양)
echo "▶ 2/2. Cloud SQL [prok-vote-db] 기본 사양(db-g1-small)으로 축소 중..." | tee -a "$LOG_FILE"
/opt/homebrew/bin/gcloud sql instances patch prok-vote-db \
  --project="$PROJECT_ID" \
  --tier=db-g1-small \
  --quiet | tee -a "$LOG_FILE"

echo "✅ Cloud SQL 원복 완료!" | tee -a "$LOG_FILE"
echo "🎉 [$(date '+%Y-%m-%d %H:%M:%S')] 모든 리소스가 절전 모드로 정상 복귀되었습니다." | tee -a "$LOG_FILE"
