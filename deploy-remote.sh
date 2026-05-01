#!/bin/bash

# ============================================================
# PROK Vote — IDC 서버 원격 배포 스크립트
# ============================================================
# 로컬에서 실행: IDC 서버에 SSH로 접속하여 자동 배포
#
# 사용법:
#   ./deploy-remote.sh <서버IP> <SSH사용자>
#   예: ./deploy-remote.sh 203.0.113.50 root
#
# 사전 조건:
#   - IDC 서버에 SSH 접속 가능
#   - IDC 서버에 Ubuntu 22.04+ 또는 유사 Linux
# ============================================================

set -e

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ──────────────────────────────────────────────
# 인자 확인
# ──────────────────────────────────────────────
SERVER_IP="${1:?Usage: $0 <server-ip> <ssh-user>}"
SSH_USER="${2:-root}"
DOMAIN_VOTE="${3:-vote.prok.org}"
DOMAIN_API="${4:-vote-api.prok.org}"

SSH_CMD="ssh ${SSH_USER}@${SERVER_IP}"

echo ""
echo "🗳️  PROK Vote — IDC 서버 원격 배포"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  서버:    ${SSH_USER}@${SERVER_IP}"
echo "  도메인:  ${DOMAIN_VOTE} / ${DOMAIN_API}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ──────────────────────────────────────────────
# Step 1: SSH 연결 테스트
# ──────────────────────────────────────────────
log "1/7 SSH 연결 테스트..."
${SSH_CMD} "echo 'SSH OK'" || error "SSH 연결 실패. 서버 IP와 계정을 확인하세요."
log "✅ SSH 연결 성공"

# ──────────────────────────────────────────────
# Step 2: 서버 기본 패키지 설치
# ──────────────────────────────────────────────
log "2/7 서버 기본 패키지 설치..."
${SSH_CMD} << 'REMOTE_SETUP'
set -e

# Docker 설치 (이미 있으면 건너뜀)
if ! command -v docker &> /dev/null; then
    echo "📦 Docker 설치 중..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker 설치 완료"
else
    echo "✅ Docker 이미 설치됨: $(docker --version)"
fi

# Docker Compose V2 확인
if ! docker compose version &> /dev/null; then
    echo "📦 Docker Compose 플러그인 설치 중..."
    apt-get update && apt-get install -y docker-compose-plugin
fi
echo "✅ Docker Compose: $(docker compose version --short)"

# Git 설치
if ! command -v git &> /dev/null; then
    apt-get update && apt-get install -y git
fi
echo "✅ Git: $(git --version)"

# 방화벽 설정
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo "✅ 방화벽: SSH(22), HTTP(80), HTTPS(443) 허용"
fi
REMOTE_SETUP
log "✅ 서버 기본 설정 완료"

# ──────────────────────────────────────────────
# Step 3: 프로젝트 클론/업데이트
# ──────────────────────────────────────────────
log "3/7 프로젝트 배포..."
${SSH_CMD} << 'REMOTE_CLONE'
set -e
DEPLOY_DIR="/opt/prok-vote"

if [ -d "$DEPLOY_DIR" ]; then
    echo "📁 기존 프로젝트 업데이트..."
    cd "$DEPLOY_DIR"
    git pull origin main
else
    echo "📁 프로젝트 클론..."
    git clone https://github.com/saintpbh/PROK-VOTE.git "$DEPLOY_DIR"
    cd "$DEPLOY_DIR"
fi

# 백업 디렉토리 생성
mkdir -p database/backups
echo "✅ 프로젝트 준비 완료: $DEPLOY_DIR"
REMOTE_CLONE
log "✅ 프로젝트 배포 완료"

# ──────────────────────────────────────────────
# Step 4: 환경변수 생성
# ──────────────────────────────────────────────
log "4/7 환경변수 설정..."

# 로컬에서 시크릿 생성
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n/+=')
ADMIN_PASSWORD="ProKV0t3!Adm1n#$(date +%Y)\$Secure"

${SSH_CMD} "cat > /opt/prok-vote/.env.production << 'ENVEOF'
# ━━━━ PROK Vote Production Environment ━━━━
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

# Database
DATABASE_USER=prok_admin
DATABASE_PASSWORD=${DB_PASSWORD}
DATABASE_NAME=prok_vote

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRATION=2h

# URLs
FRONTEND_URL=https://${DOMAIN_VOTE}
PRODUCTION_URL=https://${DOMAIN_VOTE}
NEXT_PUBLIC_API_URL=https://${DOMAIN_API}
NEXT_PUBLIC_WS_URL=https://${DOMAIN_API}
NEXT_PUBLIC_BASE_URL=https://${DOMAIN_VOTE}

# GPS
DEFAULT_GPS_RADIUS=100

# Access Code
ACCESS_CODE_TTL=3600

# Admin
SUPER_ADMIN_PASSWORD=${ADMIN_PASSWORD}
ENVEOF"

log "✅ 환경변수 생성 완료"
warn "📋 Super Admin 비밀번호: ${ADMIN_PASSWORD}"
warn "📋 위 비밀번호를 안전한 곳에 기록하세요!"

# ──────────────────────────────────────────────
# Step 5: Caddyfile 도메인 적용
# ──────────────────────────────────────────────
log "5/7 Caddy 도메인 설정..."

# 도메인이 prok.org가 아닌 경우 (IP 직접 접속용) Caddyfile 수정
if [ "${DOMAIN_VOTE}" != "vote.prok.org" ]; then
    ${SSH_CMD} "cd /opt/prok-vote && sed -i 's/vote.prok.org/${DOMAIN_VOTE}/g; s/vote-api.prok.org/${DOMAIN_API}/g' Caddyfile"
    log "✅ 도메인 변경: ${DOMAIN_VOTE} / ${DOMAIN_API}"
else
    log "✅ 기본 도메인 사용: vote.prok.org / vote-api.prok.org"
fi

# ──────────────────────────────────────────────
# Step 6: Docker 빌드 & 시작
# ──────────────────────────────────────────────
log "6/7 Docker 서비스 빌드 및 시작 (3-5분 소요)..."
${SSH_CMD} << 'REMOTE_START'
set -e
cd /opt/prok-vote

# 환경변수 로드
export $(grep -v '^#' .env.production | xargs)

# 빌드 및 시작
docker compose -f docker-compose.production.yml up -d --build

echo ""
echo "⏳ 서비스 시작 대기 (30초)..."
sleep 30

echo ""
echo "📊 서비스 상태:"
docker compose -f docker-compose.production.yml ps
REMOTE_START
log "✅ Docker 서비스 시작 완료"

# ──────────────────────────────────────────────
# Step 7: 헬스 체크
# ──────────────────────────────────────────────
log "7/7 헬스 체크..."
echo ""

# HTTPS 체크 (SSL이 아직 발급 안 됐을 수 있으므로 HTTP로도 체크)
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_IP}:80" 2>/dev/null || echo "000")
log "  HTTP 응답: ${HTTP_STATUS}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log "🎉 배포 완료!"
echo ""
echo "  📍 접속 주소:"
echo "     프론트엔드:  https://${DOMAIN_VOTE}"
echo "     API:        https://${DOMAIN_API}"
echo ""
echo "  🔐 Admin 로그인:"
echo "     URL:        https://${DOMAIN_VOTE}/admin/login"
echo "     비밀번호:    ${ADMIN_PASSWORD}"
echo ""
echo "  📊 서버 관리:"
echo "     ${SSH_CMD}"
echo "     cd /opt/prok-vote"
echo "     ./deploy-production.sh status"
echo "     ./deploy-production.sh logs vote-backend"
echo ""
echo "  ⚠️  DNS 설정 필요:"
echo "     ${DOMAIN_VOTE}     → A 레코드 → ${SERVER_IP}"
echo "     ${DOMAIN_API}  → A 레코드 → ${SERVER_IP}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
