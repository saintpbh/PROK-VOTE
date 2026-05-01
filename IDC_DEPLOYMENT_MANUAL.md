# 🗳️ PROK Vote — IDC 서버 이전 매뉴얼

> **문서 버전**: 1.0  
> **작성일**: 2026-05-01  
> **대상**: 총회 IT 담당자 / 서버 관리자

---

## 목차

1. [사전 준비물](#1-사전-준비물)
2. [IDC 서버 초기 설정](#2-idc-서버-초기-설정)
3. [PROK Vote 배포](#3-prok-vote-배포)
4. [DNS 설정](#4-dns-설정)
5. [SSL 인증서 확인](#5-ssl-인증서-확인)
6. [관리자 계정 설정](#6-관리자-계정-설정)
7. [동작 확인 테스트](#7-동작-확인-테스트)
8. [노회 매니저 계정 생성](#8-노회-매니저-계정-생성)
9. [일상 운영 가이드](#9-일상-운영-가이드)
10. [장애 대응](#10-장애-대응)
11. [부록: 서버 사양 및 아키텍처](#부록-서버-사양-및-아키텍처)

---

## 1. 사전 준비물

### 필수 항목

| # | 항목 | 설명 | 확인 |
|---|------|------|------|
| 1 | **IDC 서버 접속 정보** | IP 주소, SSH 계정, 비밀번호 (또는 SSH 키) | ☐ |
| 2 | **도메인** | `vote.prok.org`, `vote-api.prok.org` (또는 사용할 도메인) | ☐ |
| 3 | **DNS 관리 권한** | 도메인의 A 레코드를 수정할 수 있는 권한 | ☐ |
| 4 | **로컬 Mac** | 이 저장소가 클론된 맥 (배포 스크립트 실행용) | ☐ |
| 5 | **인터넷 연결** | IDC 서버가 외부 인터넷에 접근 가능 (Docker 이미지 다운로드) | ☐ |

### IDC 서버 최소 사양

| 항목 | 최소 | 권장 |
|------|------|------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| CPU | 4코어 | 8코어 |
| RAM | 16 GB | 32 GB |
| Storage | 256 GB SSD | 512 GB NVMe SSD |
| 네트워크 | 100 Mbps | 1 Gbps |
| 포트 개방 | 22 (SSH), 80 (HTTP), 443 (HTTPS) | 동일 |

---

## 2. IDC 서버 초기 설정

### 2-1. SSH 접속

```bash
# 로컬 Mac 터미널에서 실행
ssh root@<IDC서버IP>
# 예: ssh root@203.0.113.50
```

> 접속이 안 되면 IDC 업체에 SSH(22번 포트) 개방 요청

### 2-2. 시스템 업데이트

```bash
# IDC 서버에서 실행
apt update && apt upgrade -y
```

### 2-3. Docker 설치

```bash
# Docker 설치 (원커맨드)
curl -fsSL https://get.docker.com | sh

# Docker 자동 시작 설정
systemctl enable docker
systemctl start docker

# 설치 확인
docker --version
# 예상 출력: Docker version 27.x.x

docker compose version
# 예상 출력: Docker Compose version v2.x.x
```

> Docker Compose V2가 없으면:
> ```bash
> apt install -y docker-compose-plugin
> ```

### 2-4. 방화벽 설정

```bash
# UFW 방화벽 활성화
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (SSL 리다이렉트용)
ufw allow 443/tcp   # HTTPS
ufw --force enable

# 확인
ufw status
```

**예상 출력:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

> ⚠️ **주의**: PostgreSQL(5432), Redis(6379)는 외부에 열지 마세요. 보안 위험!

### 2-5. 작업 디렉토리 생성

```bash
mkdir -p /opt/prok-vote
```

---

## 3. PROK Vote 배포

### 방법 A: 자동 배포 (권장) ⭐

로컬 Mac에서 **한 줄**로 전체 배포:

```bash
# 로컬 Mac의 PROK Vote 디렉토리에서 실행
cd "/Users/bongpark/PROK Vote"

./deploy-remote.sh <IDC서버IP> root
# 예: ./deploy-remote.sh 203.0.113.50 root
```

이 스크립트가 자동으로:
1. ✅ Docker/Git 설치 확인
2. ✅ GitHub에서 코드 클론
3. ✅ JWT/DB 비밀번호 자동 생성
4. ✅ 방화벽 설정
5. ✅ 전체 Docker 서비스 빌드 & 시작
6. ✅ 헬스 체크

**스크립트 완료 후 화면에 표시되는 Admin 비밀번호를 반드시 기록하세요!**

→ 자동 배포 성공 시 **[4. DNS 설정](#4-dns-설정)**으로 건너뛰기

---

### 방법 B: 수동 배포

자동 배포가 실패하거나, 단계별로 진행하고 싶을 때:

#### B-1. 프로젝트 클론

```bash
# IDC 서버에서 실행
cd /opt/prok-vote
git clone https://github.com/saintpbh/PROK-VOTE.git .
```

> 이미 클론되어 있다면:
> ```bash
> git pull origin main
> ```

#### B-2. 환경변수 파일 생성

```bash
# 템플릿 복사
cp .env.production.example .env.production

# JWT 시크릿 자동 생성
JWT=$(openssl rand -base64 64 | tr -d '\n')

# DB 비밀번호 자동 생성
DBPW=$(openssl rand -base64 32 | tr -d '\n/+=')

# 환경변수 파일 편집
nano .env.production
```

**`.env.production` 편집 — 반드시 변경할 항목:**

```env
# ━━━━ 반드시 변경 ━━━━
DATABASE_PASSWORD=<위에서 생성한 DBPW 붙여넣기>
JWT_SECRET=<위에서 생성한 JWT 붙여넣기>
SUPER_ADMIN_PASSWORD=<강력한 관리자 비밀번호>

# ━━━━ 도메인에 맞게 변경 ━━━━
FRONTEND_URL=https://vote.prok.org
PRODUCTION_URL=https://vote.prok.org
NEXT_PUBLIC_API_URL=https://vote-api.prok.org
NEXT_PUBLIC_WS_URL=https://vote-api.prok.org
NEXT_PUBLIC_BASE_URL=https://vote.prok.org
```

> 💡 **Tip**: `nano`에서 저장 = `Ctrl+O` → `Enter`, 종료 = `Ctrl+X`

#### B-3. 도메인 설정 (Caddyfile)

기본값이 `vote.prok.org`입니다. 다른 도메인을 사용한다면:

```bash
nano Caddyfile
# vote.prok.org → 사용할 도메인으로 변경
# vote-api.prok.org → 사용할 API 도메인으로 변경
```

#### B-4. 백업 디렉토리 생성

```bash
mkdir -p database/backups
```

#### B-5. 서비스 시작

```bash
# 환경변수 로드
export $(grep -v '^#' .env.production | xargs)

# Docker 빌드 및 시작 (첫 실행 시 5-10분 소요)
docker compose -f docker-compose.production.yml up -d --build
```

#### B-6. 시작 확인

```bash
# 30초 대기 후 상태 확인
sleep 30
docker compose -f docker-compose.production.yml ps
```

**정상 출력 예시:**
```
NAME                  STATUS                    PORTS
prok-proxy            Up 2 minutes              0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
prok-vote-backend     Up 2 minutes              3001/tcp
prok-vote-frontend    Up 2 minutes              3000/tcp
prok-db               Up 2 minutes (healthy)    127.0.0.1:5432->5432/tcp
prok-redis            Up 2 minutes (healthy)    127.0.0.1:6379->6379/tcp
prok-db-backup        Up 2 minutes
prok-watchtower       Up 2 minutes
```

> ⚠️ 컨테이너가 `Restarting`이면 로그 확인:
> ```bash
> docker compose -f docker-compose.production.yml logs vote-backend
> ```

---

## 4. DNS 설정

도메인 관리 사이트(가비아, 카페24, Route53 등)에서 A 레코드 추가:

| 호스트 | 타입 | 값 | TTL |
|--------|------|-----|-----|
| `vote` | A | `<IDC서버IP>` | 300 |
| `vote-api` | A | `<IDC서버IP>` | 300 |

**예시 (prok.org 도메인 기준):**
```
vote.prok.org       →  A  →  203.0.113.50
vote-api.prok.org   →  A  →  203.0.113.50
```

### DNS 전파 확인

```bash
# 로컬 Mac에서 확인
nslookup vote.prok.org
nslookup vote-api.prok.org
```

**정상이면 IDC 서버 IP가 표시됩니다.**

> DNS 전파는 보통 5분~1시간 소요. 최대 48시간.

---

## 5. SSL 인증서 확인

DNS가 전파되면 Caddy가 **자동으로** Let's Encrypt SSL 인증서를 발급합니다.

```bash
# IDC 서버에서 확인
docker logs prok-proxy 2>&1 | grep -i "certificate"
```

**정상 출력:**
```
successfully obtained certificate for vote.prok.org
successfully obtained certificate for vote-api.prok.org
```

### SSL 확인 (로컬 Mac에서)

```bash
curl -I https://vote.prok.org
# HTTP/2 200 이 나오면 성공
```

> ⚠️ DNS가 아직 전파되지 않았으면 SSL 발급이 실패합니다.
> DNS 전파 후 Caddy 재시작:
> ```bash
> cd /opt/prok-vote
> docker compose -f docker-compose.production.yml restart caddy
> ```

---

## 6. 관리자 계정 설정

### 6-1. Super Admin 로그인

1. 브라우저에서 `https://vote.prok.org/admin/login` 접속
2. 아래 정보로 로그인:

| 항목 | 값 |
|------|-----|
| 사용자명 | `super_admin` |
| 비밀번호 | `.env.production`의 `SUPER_ADMIN_PASSWORD` 값 |

> 자동 배포 시 화면에 표시된 비밀번호 사용

### 6-2. Admin 페이지 접속 확인

로그인 성공 후 다음 메뉴가 보여야 합니다:
- ✅ 세션 관리 (투표 세션 생성/관리)
- ✅ 사용자 관리 (매니저 계정 생성)
- ✅ 시스템 설정 (쿼터, GPS 등)
- ✅ 시스템 모니터 (서버 상태)

---

## 7. 동작 확인 테스트

### 체크리스트

| # | 테스트 항목 | 방법 | 확인 |
|---|-----------|------|------|
| 1 | 프론트엔드 접속 | `https://vote.prok.org` 브라우저 접속 | ☐ |
| 2 | Admin 로그인 | `/admin/login` → Super Admin 로그인 | ☐ |
| 3 | 세션 생성 | Admin → 새 투표 세션 생성 | ☐ |
| 4 | 안건 추가 | 생성한 세션에 테스트 안건 추가 | ☐ |
| 5 | QR 코드 생성 | 세션 상세 → QR 코드 생성 확인 | ☐ |
| 6 | 투표 참여 | 다른 기기(휴대폰)에서 QR 스캔 → 투표 참여 | ☐ |
| 7 | 실시간 집계 | 투표 시 Admin 화면에 실시간 반영 확인 | ☐ |
| 8 | 결과 발표 | 투표 종료 → 결과 발표 브로드캐스트 확인 | ☐ |
| 9 | 스타디움 디스플레이 | `/stadium` 페이지에서 전광판 표시 확인 | ☐ |
| 10 | API 응답 | `curl https://vote-api.prok.org/settings` → JSON 응답 | ☐ |
| 11 | WebSocket | 두 기기에서 동시 접속 → 실시간 동기화 확인 | ☐ |
| 12 | HTTPS | 브라우저 주소창 🔒 자물쇠 표시 확인 | ☐ |

### 빠른 API 테스트 (터미널)

```bash
# 서버 응답 확인
curl -s https://vote-api.prok.org/settings | head -c 200

# WebSocket 연결 확인 (3초 후 자동 종료)
timeout 3 curl -s -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test123" \
  https://vote-api.prok.org/socket.io/ 2>&1 && echo "WebSocket OK"
```

---

## 8. 노회 매니저 계정 생성

### 8-1. 매니저 계정 생성

1. `https://vote.prok.org/admin` → **사용자 관리** 메뉴
2. **+ 새 사용자** 클릭
3. 정보 입력:

| 필드 | 입력 예시 |
|------|----------|
| 사용자명 | `seoul_east` (서울동노회) |
| 비밀번호 | 각 노회별 고유 비밀번호 |
| 역할 | `VOTE_MANAGER` |
| 표시 이름 | `서울동노회 관리자` |

4. 저장

### 8-2. 매니저 쿼터 설정

시스템 설정에서 각 매니저의 제한을 조절:

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `maxSessions` | 5 | 매니저당 최대 세션 수 |
| `maxAgendasPerSession` | 20 | 세션당 최대 안건 수 |
| `maxVotersPerSession` | 500 | 세션당 최대 투표자 수 |

### 8-3. 노회에 전달할 안내문 (예시)

```
[PROK 투표 시스템 안내]

접속 주소: https://vote.prok.org
관리자 로그인: https://vote.prok.org/admin/login
  - 사용자명: (배정된 ID)
  - 비밀번호: (배정된 PW)

투표 진행 순서:
  1. 관리자 로그인
  2. 투표 세션 생성
  3. 안건 등록
  4. QR 코드 생성 → 참석자 배포
  5. 투표 시작 → 실시간 집계 → 결과 발표

문의: 총회 IT 담당 (연락처)
```

---

## 9. 일상 운영 가이드

### 서비스 관리 명령어

IDC 서버에 SSH 접속 후:

```bash
cd /opt/prok-vote
```

| 작업 | 명령어 |
|------|--------|
| **상태 확인** | `./deploy-production.sh status` |
| **서비스 시작** | `./deploy-production.sh start` |
| **서비스 중지** | `./deploy-production.sh stop` |
| **서비스 재시작** | `./deploy-production.sh restart` |
| **로그 확인 (전체)** | `./deploy-production.sh logs` |
| **로그 확인 (백엔드만)** | `./deploy-production.sh logs vote-backend` |
| **수동 백업** | `./deploy-production.sh backup` |

### 코드 업데이트 배포

```bash
# IDC 서버에서
cd /opt/prok-vote
git pull origin main
./deploy-production.sh restart
```

### 자동 백업 확인

백업은 **24시간마다 자동 실행**, 30일 보관:

```bash
# 백업 파일 확인
ls -lh database/backups/

# 최근 백업 확인
ls -1t database/backups/*.dump | head -5
```

### 백업 복원 (필요 시)

```bash
# 1. 복원할 백업 파일 선택
ls database/backups/

# 2. 복원 실행
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_restore -U prok_admin -d prok_vote --clean --if-exists \
  < database/backups/<선택한_파일명>.dump
```

### 디스크 정리 (월 1회 권장)

```bash
# 사용하지 않는 Docker 이미지/캐시 정리
docker system prune -af

# 디스크 사용량 확인
df -h
```

---

## 10. 장애 대응

### 증상별 대응

#### 🔴 사이트에 접속이 안 됨

```bash
# 1. 컨테이너 상태 확인
cd /opt/prok-vote
docker compose -f docker-compose.production.yml ps

# 2. Restarting 또는 Exit인 컨테이너가 있으면 로그 확인
docker compose -f docker-compose.production.yml logs --tail=50 <컨테이너명>

# 3. 전체 재시작
./deploy-production.sh restart
```

#### 🔴 투표가 실시간으로 반영이 안 됨

```bash
# WebSocket 연결 확인
docker compose -f docker-compose.production.yml logs vote-backend | grep -i "socket\|connection"

# Redis 상태 확인
docker exec prok-redis redis-cli ping
# 정상: PONG
```

#### 🔴 DB 연결 오류

```bash
# PostgreSQL 상태 확인
docker exec prok-db pg_isready -U prok_admin
# 정상: accepting connections

# DB 로그 확인
docker compose -f docker-compose.production.yml logs postgres --tail=30
```

#### 🔴 SSL 인증서 오류 (HTTPS 접속 불가)

```bash
# Caddy 로그 확인
docker logs prok-proxy 2>&1 | tail -20

# DNS 확인
nslookup vote.prok.org

# Caddy 재시작 (SSL 재발급 시도)
docker compose -f docker-compose.production.yml restart caddy
```

#### 🔴 서버 메모리/CPU 부족

```bash
# 리소스 사용량 확인
docker stats --no-stream

# 특정 컨테이너 메모리 초과 시 재시작
docker restart prok-vote-backend
```

### 긴급 연락처

| 상황 | 담당 |
|------|------|
| 서버 하드웨어 장애 | IDC 업체 기술지원 |
| 네트워크/방화벽 문제 | IDC 업체 기술지원 |
| 애플리케이션 오류 | 총회 IT 개발팀 |
| 도메인/DNS 문제 | 도메인 등록 업체 |

---

## 부록: 서버 사양 및 아키텍처

### 전체 구성도

```
                    인터넷 (HTTPS)
                        │
                  ┌─────┴─────┐
                  │ vote.prok.org │ ← DNS A 레코드
                  │ vote-api.prok.org │
                  └─────┬─────┘
                        │
              ┌─────────┴─────────┐
              │   IDC 서버          │
              │                   │
              │  ┌──────────────┐ │
              │  │  Caddy       │ │  ← :80, :443 (SSL 자동)
              │  └──────┬───────┘ │
              │         │         │
              │    ┌────┴────┐    │
              │    │         │    │
              │    ▼         ▼    │
              │ Frontend  Backend │
              │ (Next.js) (NestJS)│
              │  :3000    :3001   │
              │            │      │
              │    ┌───────┤      │
              │    │       │      │
              │    ▼       ▼      │
              │ PostgreSQL Redis  │
              │  :5432    :6379   │
              │ (내부만)  (내부만)  │
              └───────────────────┘
```

### Docker 컨테이너 목록

| 컨테이너 | 이미지 | 포트 | 역할 |
|----------|--------|------|------|
| `prok-proxy` | caddy:2-alpine | 80, 443 | 리버스 프록시 + SSL |
| `prok-vote-backend` | 자체 빌드 | 3001 (내부) | API + WebSocket |
| `prok-vote-frontend` | 자체 빌드 | 3000 (내부) | 웹 UI |
| `prok-db` | postgres:16-alpine | 5432 (로컬) | 데이터베이스 |
| `prok-redis` | redis:7-alpine | 6379 (로컬) | 캐시 |
| `prok-db-backup` | postgres:16-alpine | - | 자동 백업 (24시간) |
| `prok-watchtower` | watchtower | - | 이미지 자동 업데이트 |

### 영구 데이터 (Docker Volumes)

| 볼륨 | 용도 | 백업 필요 |
|------|------|----------|
| `postgres_data` | DB 데이터 | ✅ (자동 백업 중) |
| `redis_data` | 캐시 데이터 | ❌ |
| `uploads_data` | 로고 이미지 | ⚠️ (수동 백업 권장) |
| `caddy_data` | SSL 인증서 | ❌ (자동 재발급) |

### 주요 파일 위치 (IDC 서버)

```
/opt/prok-vote/
├── docker-compose.production.yml   ← Docker 서비스 정의
├── Caddyfile                       ← 리버스 프록시 설정
├── .env.production                 ← 환경변수 (비밀번호 포함)
├── deploy-production.sh            ← 서비스 관리 스크립트
├── backend/                        ← NestJS 백엔드 소스
├── frontend/                       ← Next.js 프론트엔드 소스
└── database/
    ├── schema.sql                  ← DB 스키마
    └── backups/                    ← 자동 백업 파일 (.dump)
```

---

> 📌 **이 문서는 프로젝트 저장소에 포함되어 있습니다.**  
> 최신 버전: `https://github.com/saintpbh/PROK-VOTE/blob/main/IDC_DEPLOYMENT_MANUAL.md`
