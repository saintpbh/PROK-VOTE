const { io } = require('socket.io-client');
const axios = require('axios');

const API_URL = process.env.API_URL || 'https://prok-vote-backend-763218472939.asia-northeast3.run.app';
const SOCKET_URL = process.env.SOCKET_URL || 'https://prok-vote-backend-763218472939.asia-northeast3.run.app';
const TARGET_VOTERS = parseInt(process.env.VOTERS || '50', 10);
const SPREAD_SECONDS = parseFloat(process.env.SPREAD_SEC || '5'); // spread votes over X seconds

console.log(`====================================================`);
console.log(`🗳️  PROK Vote 2,000명 동시투표 부하 시뮬레이션`);
console.log(`  - 대상 서버: ${API_URL}`);
console.log(`  - 시뮬레이션 인원: ${TARGET_VOTERS}명`);
console.log(`  - 투표 집중 시간: ${SPREAD_SECONDS}초`);
console.log(`====================================================\n`);

async function runSimulation() {
    const stats = {
        authSuccess: 0,
        authFail: 0,
        socketConnected: 0,
        socketConnectFail: 0,
        stageChangedReceived: 0,
        voteSuccess: 0,
        voteFail: 0,
        voteLatencies: [],
        errors: {}
    };

    function recordError(type, msg) {
        stats.errors[type] = (stats.errors[type] || 0) + 1;
        if (stats.errors[type] <= 3) {
            console.error(`  [${type}] ${msg}`);
        }
    }

    try {
        // 1. Admin Login
        console.log(`[Step 1/6] 관리자 로그인 중...`);
        const loginRes = await axios.post(`${API_URL}/auth/admin/login`, {
            username: 'admin',
            password: 'prok7600'
        }, { timeout: 10000 });
        const adminToken = loginRes.data.accessToken;
        const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };
        console.log(`✅ 관리자 로그인 성공`);

        // 2. Create Isolated Test Session
        console.log(`\n[Step 2/6] 격리된 시뮬레이션 세션 생성 중...`);
        const sessionRes = await axios.post(`${API_URL}/sessions`, {
            name: `[부하검증] ${TARGET_VOTERS}명 동시투표 시뮬레이션`,
            description: `현장 총회 대비 2000명 동시 투표 부하 검증 (실행시간: ${new Date().toLocaleTimeString()})`,
            gpsEnabled: false
        }, { ...adminHeaders, timeout: 10000 });

        const session = sessionRes.data.session;
        console.log(`✅ 세션 생성 완료: ID = ${session.id} (접속코드: ${session.accessCode})`);

        // Update settings to GLOBAL_LINK
        await axios.put(`${API_URL}/sessions/${session.id}/settings`, {
            entryMode: 'GLOBAL_LINK',
            allowAnonymous: true
        }, { ...adminHeaders, timeout: 10000 });
        console.log(`✅ 세션 모드 설정 완료: GLOBAL_LINK`);

        // 3. Create Test Agenda
        console.log(`\n[Step 3/6] 테스트 안건 생성 중...`);
        const agendaRes = await axios.post(`${API_URL}/sessions/agendas`, {
            sessionId: session.id,
            title: `제1호 의안: ${TARGET_VOTERS}명 동시 투표 처리 능력 검증의 건`,
            description: `동시 ${TARGET_VOTERS}명 투표 시 DB 락 및 응답 지연 측정`,
            type: 'PROS_CONS',
            displayOrder: 1
        }, { ...adminHeaders, timeout: 10000 });

        const agenda = agendaRes.data.agenda;
        console.log(`✅ 안건 생성 완료: ID = ${agenda.id}`);

        // 4. Authenticate Voters in parallel batches
        console.log(`\n[Step 4/6] ${TARGET_VOTERS}명 총대 인증(토큰 발급) 진행 중...`);
        const startTimeAuth = Date.now();
        const voters = [];
        const BATCH_SIZE = 50;

        for (let i = 0; i < TARGET_VOTERS; i += BATCH_SIZE) {
            const batchPromises = [];
            const currentBatch = Math.min(BATCH_SIZE, TARGET_VOTERS - i);
            for (let j = 0; j < currentBatch; j++) {
                const idx = i + j;
                const p = axios.post(`${API_URL}/auth/global`, {
                    sessionId: session.id,
                    name: `총대-${(idx + 1).toString().padStart(4, '0')}`,
                    deviceFingerprint: `sim-mac-${idx}-${Date.now()}`,
                    accessCode: session.accessCode,
                    latitude: 37.5665,
                    longitude: 126.9780,
                    skipGPS: true
                }, { timeout: 15000 }).then(res => {
                    stats.authSuccess++;
                    voters.push({
                        idx,
                        token: res.data.accessToken,
                        voter: res.data.voter
                    });
                }).catch(err => {
                    stats.authFail++;
                    recordError('AUTH_ERROR', err.response?.data?.message || err.message);
                });
                batchPromises.push(p);
            }
            await Promise.all(batchPromises);
            process.stdout.write(`\r  인증 진행률: ${Math.min(i + BATCH_SIZE, TARGET_VOTERS)} / ${TARGET_VOTERS} (${Math.round((Math.min(i + BATCH_SIZE, TARGET_VOTERS) / TARGET_VOTERS) * 100)}%)`);
        }

        const authElapsed = (Date.now() - startTimeAuth) / 1000;
        console.log(`\n✅ 인증 완료: 성공 ${stats.authSuccess}명, 실패 ${stats.authFail}명 (소요시간: ${authElapsed.toFixed(2)}초, ${(stats.authSuccess / authElapsed).toFixed(1)} req/s)`);

        if (voters.length === 0) {
            throw new Error('인증된 유권자가 없어 시뮬레이션을 중단합니다.');
        }

        // 5. Connect Sockets & Join Room
        console.log(`\n[Step 5/6] ${voters.length}개 소켓 연결 및 대기실 입장...`);
        const startTimeSocket = Date.now();
        const sockets = [];

        const socketConnectPromises = voters.map((v) => {
            return new Promise((resolve) => {
                const s = io(SOCKET_URL, {
                    transports: ['websocket', 'polling'],
                    auth: { token: v.token },
                    timeout: 20000,
                    reconnection: false
                });

                let resolved = false;
                const timer = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        stats.socketConnectFail++;
                        resolve(null);
                    }
                }, 15000);

                s.on('connect', () => {
                    stats.socketConnected++;
                    s.emit('join:session', {
                        sessionId: session.id,
                        voterId: v.voter.id,
                        role: 'voter',
                        token: v.token
                    });

                    s.on('stage:changed', (data) => {
                        stats.stageChangedReceived++;
                    });

                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        sockets.push({ ...v, socket: s });
                        resolve(s);
                    }
                });

                s.on('connect_error', (err) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timer);
                        stats.socketConnectFail++;
                        recordError('SOCKET_CONNECT_ERROR', err.message);
                        resolve(null);
                    }
                });
            });
        });

        await Promise.all(socketConnectPromises);
        const socketElapsed = (Date.now() - startTimeSocket) / 1000;
        console.log(`✅ 소켓 연결 완료: 성공 ${stats.socketConnected}명, 실패 ${stats.socketConnectFail}명 (소요시간: ${socketElapsed.toFixed(2)}초)`);

        // 6. Admin triggers Stage = 'voting'
        console.log(`\n[Step 6/6] 관리자 안건 투표 개시 (stage = 'voting')...`);
        const stageStart = Date.now();
        await axios.put(`${API_URL}/sessions/agendas/${agenda.id}/stage`, {
            stage: 'voting'
        }, { ...adminHeaders, timeout: 10000 });
        console.log(`✅ 투표 개시 신호 전송 완료`);

        // Give a brief moment for socket propagation
        await new Promise(r => setTimeout(r, 1000));
        console.log(`📡 stage:changed 수신 총대 수: ${stats.stageChangedReceived} / ${sockets.length} (${((stats.stageChangedReceived / (sockets.length || 1)) * 100).toFixed(1)}%)`);

        // 7. Concurrent Vote Burst!
        console.log(`\n🚀 [투표 러시 시작] ${sockets.length}명이 ${SPREAD_SECONDS}초 이내에 동시 투표 제출...`);
        const choices = ['찬성', '찬성', '반대', '기권']; // realistic weighted choices
        const voteStartTime = Date.now();

        const votePromises = sockets.map((item, i) => {
            return new Promise((resolve) => {
                // Spread human delay between 0 and SPREAD_SECONDS
                const randomDelay = Math.random() * (SPREAD_SECONDS * 1000);
                setTimeout(() => {
                    const choice = choices[Math.floor(Math.random() * choices.length)];
                    const t0 = Date.now();

                    item.socket.emit('vote:cast', {
                        agendaId: agenda.id,
                        choice: choice,
                        voterId: item.voter.id,
                        token: item.token
                    });

                    let done = false;
                    const timeoutTimer = setTimeout(() => {
                        if (!done) {
                            done = true;
                            stats.voteFail++;
                            recordError('VOTE_TIMEOUT', `총대-${item.idx} 투표 응답 타임아웃 (10초 초과)`);
                            resolve({ success: false });
                        }
                    }, 10000);

                    item.socket.on('vote:confirmed', (resp) => {
                        if (!done) {
                            done = true;
                            clearTimeout(timeoutTimer);
                            const latency = Date.now() - t0;
                            stats.voteSuccess++;
                            stats.voteLatencies.push(latency);
                            resolve({ success: true, latency });
                        }
                    });

                    item.socket.on('error', (err) => {
                        if (!done) {
                            done = true;
                            clearTimeout(timeoutTimer);
                            stats.voteFail++;
                            recordError('VOTE_WS_ERROR', err?.message || JSON.stringify(err));
                            resolve({ success: false });
                        }
                    });
                }, randomDelay);
            });
        });

        await Promise.all(votePromises);
        const totalVoteDuration = (Date.now() - voteStartTime) / 1000;

        // 8. Fetch Final Statistics from DB to verify accuracy
        console.log(`\n📊 DB 집계 데이터 검증 중...`);
        await new Promise(r => setTimeout(r, 2000)); // wait 2s for backend to finalize any queue
        const statsRes = await axios.get(`${API_URL}/votes/stats/${agenda.id}`, { timeout: 10000 });
        const dbStats = statsRes.data.stats || statsRes.data;

        // Disconnect all sockets
        sockets.forEach(s => s.socket && s.socket.disconnect());

        // Calculate Percentiles
        stats.voteLatencies.sort((a, b) => a - b);
        const count = stats.voteLatencies.length;
        const p50 = count > 0 ? stats.voteLatencies[Math.floor(count * 0.5)] : 0;
        const p90 = count > 0 ? stats.voteLatencies[Math.floor(count * 0.9)] : 0;
        const p95 = count > 0 ? stats.voteLatencies[Math.floor(count * 0.95)] : 0;
        const p99 = count > 0 ? stats.voteLatencies[Math.floor(count * 0.99)] : 0;
        const avg = count > 0 ? Math.round(stats.voteLatencies.reduce((a, b) => a + b, 0) / count) : 0;
        const max = count > 0 ? stats.voteLatencies[count - 1] : 0;
        const min = count > 0 ? stats.voteLatencies[0] : 0;

        console.log(`\n====================================================`);
        console.log(`📋 [시뮬레이션 결과 요약]`);
        console.log(`====================================================`);
        console.log(`• 목표 인원: ${TARGET_VOTERS}명`);
        console.log(`• 인증 성공: ${stats.authSuccess}명 (${((stats.authSuccess / TARGET_VOTERS) * 100).toFixed(1)}%)`);
        console.log(`• 소켓 연결: ${stats.socketConnected}명 (${((stats.socketConnected / TARGET_VOTERS) * 100).toFixed(1)}%)`);
        console.log(`• 투표 성공 (vote:confirmed 수신): ${stats.voteSuccess}표`);
        console.log(`• 투표 실패/타임아웃: ${stats.voteFail}표`);
        console.log(`• DB 최종 기록 투표수: ${dbStats.totalVotes}표 (찬성: ${dbStats.approveCount}, 반대: ${dbStats.rejectCount}, 기권: ${dbStats.abstainCount})`);
        console.log(`• 투표 정합성 일치 여부: ${stats.voteSuccess === dbStats.totalVotes ? '✅ 100% 완전 일치' : `⚠️ 불일치 (소켓확인: ${stats.voteSuccess}, DB: ${dbStats.totalVotes})`}`);
        console.log(`----------------------------------------------------`);
        console.log(`⚡ [응답 지연 시간(Latency) 분석]`);
        console.log(`• 총 투표 소요시간: ${totalVoteDuration.toFixed(2)}초`);
        console.log(`• 처리량(Throughput): ${(stats.voteSuccess / (totalVoteDuration || 1)).toFixed(1)} TPS (초당 처리 표 수)`);
        console.log(`• 평균 응답 시간: ${avg} ms`);
        console.log(`• 최소 / 최대: ${min} ms / ${max} ms`);
        console.log(`• P50 (중간값): ${p50} ms`);
        console.log(`• P90: ${p90} ms`);
        console.log(`• P95: ${p95} ms`);
        console.log(`• P99: ${p99} ms`);
        console.log(`====================================================`);

        if (Object.keys(stats.errors).length > 0) {
            console.log(`\n⚠️ 발생한 에러 현황:`, JSON.stringify(stats.errors, null, 2));
        }

        return {
            target: TARGET_VOTERS,
            authSuccess: stats.authSuccess,
            socketConnected: stats.socketConnected,
            voteSuccess: stats.voteSuccess,
            voteFail: stats.voteFail,
            dbTotalVotes: dbStats.totalVotes,
            tps: (stats.voteSuccess / (totalVoteDuration || 1)).toFixed(1),
            avg,
            p50,
            p95,
            p99,
            max,
            isConsistent: stats.voteSuccess === dbStats.totalVotes
        };

    } catch (err) {
        console.error(`❌ 시뮬레이션 중단 오류:`, err.message);
        if (err.response) {
            console.error(`  상태 코드: ${err.response.status}`);
            console.error(`  응답 데이터:`, JSON.stringify(err.response.data));
        }
        return null;
    }
}

runSimulation().then(res => {
    process.exit(res && res.voteFail === 0 ? 0 : 1);
});
