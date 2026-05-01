#!/bin/bash

# ============================================================
# PROK 총회 — IDC 서버 프로덕션 배포 스크립트
# ============================================================
# 사용법: ./deploy-production.sh [setup|start|stop|restart|status|logs|backup]
# ============================================================

set -e

COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"

# 색상
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[PROK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ──────────────────────────────────────────────
# 초기 설정
# ──────────────────────────────────────────────
setup() {
    log "🏗️  PROK 총회 서버 초기 설정"
    echo ""

    # Docker 확인
    if ! command -v docker &> /dev/null; then
        error "Docker가 설치되지 않았습니다."
        echo "  설치: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    log "✅ Docker $(docker --version | awk '{print $3}')"

    # Docker Compose 확인
    if ! docker compose version &> /dev/null; then
        error "Docker Compose V2가 설치되지 않았습니다."
        exit 1
    fi
    log "✅ Docker Compose $(docker compose version --short)"

    # 환경변수 파일 확인
    if [ ! -f "$ENV_FILE" ]; then
        warn "📝 .env.production 파일이 없습니다. 템플릿에서 생성합니다..."
        cp .env.production.example "$ENV_FILE"
        
        # 자동으로 JWT_SECRET 생성
        JWT=$(openssl rand -base64 64 | tr -d '\n')
        sed -i.bak "s|CHANGE_ME_TO_RANDOM_64_BYTES_BASE64|$JWT|" "$ENV_FILE"
        rm -f "${ENV_FILE}.bak"
        
        # 자동으로 DB 비밀번호 생성
        DB_PASS=$(openssl rand -base64 32 | tr -d '\n/+=')
        sed -i.bak "s|CHANGE_ME_TO_STRONG_PASSWORD|$DB_PASS|" "$ENV_FILE"
        rm -f "${ENV_FILE}.bak"
        
        echo ""
        warn "⚠️  $ENV_FILE 파일을 열어 다음 항목을 확인하세요:"
        warn "  - SUPER_ADMIN_PASSWORD (관리자 비밀번호)"
        warn "  - FRONTEND_URL / PRODUCTION_URL (도메인)"
        warn "  - NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL (API 도메인)"
        echo ""
        log "JWT_SECRET과 DATABASE_PASSWORD는 자동 생성되었습니다."
    else
        log "✅ .env.production 파일 존재"
    fi

    # 백업 디렉토리 생성
    mkdir -p database/backups
    log "✅ 백업 디렉토리 준비됨"

    echo ""
    log "🎉 초기 설정 완료!"
    log "  다음 단계: $ENV_FILE 파일 편집 후 './deploy-production.sh start' 실행"
}

# ──────────────────────────────────────────────
# 서비스 시작
# ──────────────────────────────────────────────
start() {
    log "🚀 PROK 서비스 시작 중..."

    if [ ! -f "$ENV_FILE" ]; then
        error "$ENV_FILE 파일이 없습니다. 먼저 './deploy-production.sh setup' 을 실행하세요."
        exit 1
    fi

    # 환경변수 로드
    export $(grep -v '^#' "$ENV_FILE" | xargs)

    docker compose -f "$COMPOSE_FILE" up -d --build

    echo ""
    log "⏳ 서비스 상태 확인 중..."
    sleep 10

    status

    echo ""
    log "📍 접속 주소:"
    log "  - 프론트엔드: https://vote.prok.org"
    log "  - API:       https://vote-api.prok.org"
    log "  - DB 관리:   localhost:5432 (서버 내부만)"
}

# ──────────────────────────────────────────────
# 서비스 중지
# ──────────────────────────────────────────────
stop() {
    warn "🛑 PROK 서비스 중지 중..."
    docker compose -f "$COMPOSE_FILE" down
    log "✅ 모든 서비스 중지됨"
}

# ──────────────────────────────────────────────
# 서비스 재시작
# ──────────────────────────────────────────────
restart() {
    warn "🔄 PROK 서비스 재시작 중..."
    export $(grep -v '^#' "$ENV_FILE" | xargs)
    docker compose -f "$COMPOSE_FILE" down
    docker compose -f "$COMPOSE_FILE" up -d --build
    sleep 10
    status
}

# ──────────────────────────────────────────────
# 상태 확인
# ──────────────────────────────────────────────
status() {
    log "📊 서비스 상태:"
    echo ""
    docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    # 디스크 사용량
    log "💾 디스크 사용량:"
    docker system df --format "table {{.Type}}\t{{.TotalCount}}\t{{.Size}}\t{{.Reclaimable}}"
    echo ""
    
    # 백업 현황
    BACKUP_COUNT=$(find database/backups -name "*.dump" 2>/dev/null | wc -l | tr -d ' ')
    LATEST_BACKUP=$(ls -1t database/backups/*.dump 2>/dev/null | head -1)
    log "📦 백업: ${BACKUP_COUNT}개"
    if [ -n "$LATEST_BACKUP" ]; then
        log "  최근: $(basename $LATEST_BACKUP)"
    fi
}

# ──────────────────────────────────────────────
# 로그 확인
# ──────────────────────────────────────────────
logs() {
    SERVICE=${2:-""}
    if [ -n "$SERVICE" ]; then
        docker compose -f "$COMPOSE_FILE" logs -f --tail=100 "$SERVICE"
    else
        docker compose -f "$COMPOSE_FILE" logs -f --tail=100
    fi
}

# ──────────────────────────────────────────────
# 수동 백업
# ──────────────────────────────────────────────
backup() {
    log "📦 수동 백업 시작..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        pg_dump -U "${DATABASE_USER:-prok_admin}" -Fc "${DATABASE_NAME:-prok_vote}" \
        > "database/backups/manual_${TIMESTAMP}.dump"
    
    log "✅ 백업 완료: database/backups/manual_${TIMESTAMP}.dump"
    ls -lh "database/backups/manual_${TIMESTAMP}.dump"
}

# ──────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────
case "${1:-help}" in
    setup)    setup ;;
    start)    start ;;
    stop)     stop ;;
    restart)  restart ;;
    status)   status ;;
    logs)     logs "$@" ;;
    backup)   backup ;;
    *)
        echo ""
        echo "🗳️  PROK 총회 서버 관리 도구"
        echo ""
        echo "사용법: $0 <명령>"
        echo ""
        echo "  setup     초기 설정 (환경변수 생성, Docker 확인)"
        echo "  start     서비스 시작"
        echo "  stop      서비스 중지"
        echo "  restart   서비스 재시작"
        echo "  status    상태 확인"
        echo "  logs      로그 확인 (예: $0 logs vote-backend)"
        echo "  backup    수동 DB 백업"
        echo ""
        ;;
esac
