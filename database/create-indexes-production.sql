-- ============================================================
-- PROK Vote — 프로덕션 DB 성능 인덱스 생성 (무중단)
-- ============================================================
-- 실행 대상: Cloud SQL (prok-vote-db)
-- 실행 방법: gcloud sql connect prok-vote-db --project=prok-digital --user=prok_admin
--            또는 Cloud SQL Auth Proxy 경유
--
-- CONCURRENTLY 옵션: 테이블 락 없이 인덱스 생성 (운영 중 안전)
-- IF NOT EXISTS: 이미 존재하면 무시
-- ============================================================

-- 1. voters: 참여자 수 조회 (재석확인) 핵심 인덱스
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voters_session
  ON voters (session_id);

-- 2. tokens: QR 인증 시 세션별 토큰 조회
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_session
  ON tokens (session_id);

-- 3. tokens: 디바이스 중복 확인
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_fingerprint
  ON tokens (device_fingerprint);

-- 4. agendas: 세션별 안건 목록 조회
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agendas_session
  ON agendas (session_id);

-- 5. agendas: stage별 필터링 (pending/voting/ended)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agendas_stage
  ON agendas (stage);

-- 6. votes: 안건별 투표 통계 집계
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_agenda
  ON votes (agenda_id);

-- 7. votes: 투표자별 투표 이력 조회
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_voter
  ON votes (voter_id);

-- 8. audit_logs: 이벤트 타입별 필터링
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_event_type
  ON audit_logs (event_type);

-- 9. audit_logs: 시간순 로그 조회
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_created_at
  ON audit_logs (created_at);

-- ============================================================
-- 검증 쿼리: 생성된 인덱스 확인
-- ============================================================
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename IN ('voters', 'tokens', 'agendas', 'votes', 'audit_logs')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
