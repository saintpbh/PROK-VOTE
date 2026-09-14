# 제111회 총회 실시간 전자투표 안정화 버전 (v1.1.0-stable-20260914)

- **배포 및 기록 일시**: 2026-09-14 17:21 KST
- **Git Commit**: `c303aa9`
- **Git Tag**: `v1.1.0-stable-20260914`
- **GitHub Repository**: `https://github.com/saintpbh/PROK-VOTE.git` (main)
- **로컬 백업 파일**: `/Users/bongpark/PROK_Vote_backups/PROK_Vote_20260914_stable_v1.1.0.tar.gz`

---

## 1. 주요 변경 및 안정화 내역

### 1.1 인프라 및 소켓 400 Bad Request 해결
- Cloud Run 인스턴스 단일 고정 (`minScale=1, maxScale=1, containerConcurrency=1000`)
- 소켓 연결 세션 고정(`sessionAffinity=true`)을 통해 인스턴스 간 Socket.IO HTTP Polling 400 에러 및 연결 끊김 완벽 차단

### 1.2 부하 테스트 및 수용 능력 실측
- **2,000명 동시 투표 E2E 검증 완료**:
  - 2,000명 × 10건 안건 (총 20,000표) 무유실 100% 처리
  - 평균 처리 속도: 안건당 5.1초 ~ 10.2초
  - 초당 트랜잭션: 300 ~ 400 TPS (평균 응답 지연 200~400ms)

### 1.3 전광판 상정 화면 UI 고도화 (`/stadium`)
- 안건 상정(`submitted`) 대기 상태에서 총대들에게 사전 안내 제공:
  - 투표 방식 뱃지: **`🗳️ 투표 방식 : 1개 선택`** / **`🗳️ 투표 방식 : 찬반 투표`** / **`🗳️ 투표 방식 : 복수 선택 가능`**
  - 대형 선택지 시각화 카드 (찬성/반대/기권 3카드, 다지선다 번호별 항목 카드)
  - 📋 안건 제안 설명 및 의결 사항 전용 패널
  - 500ms Trailing Throttling으로 실시간 카운트 집계 시 전광판 버벅임 방지
