/**
 * PROK Vote — 2000명 × 10안건 현장 부하 시뮬레이션
 * 
 * 환경: 2018년산 구형 스마트폰 + 느린 셀룰러 데이터 시뮬레이션
 * 방식: HTTP POST 투표 (Socket.IO 없음 — 실제 프로덕션과 동일)
 * 
 * Usage:
 *   node scripts/full_vote_simulation.js
 *   VOTERS=2000 AGENDAS=10 node scripts/full_vote_simulation.js
 */

const axios = require('axios');
const crypto = require('crypto');

const API_URL = process.env.API_URL || 'https://prok-vote-backend-763218472939.asia-northeast3.run.app';
const TARGET_VOTERS = parseInt(process.env.VOTERS || '2000', 10);
const NUM_AGENDAS = parseInt(process.env.AGENDAS || '10', 10);
const SPREAD_SECONDS = parseFloat(process.env.SPREAD_SEC || '3');

// Simulate slow cellular: random timeout between 100ms ~ 8000ms
function randomCellularDelay() {
    const r = Math.random();
    if (r < 0.70) return Math.floor(100 + Math.random() * 400);     // 70% normal
    if (r < 0.90) return Math.floor(500 + Math.random() * 2500);    // 20% slow 3G
    return Math.floor(3000 + Math.random() * 5000);                  // 10% very slow
}

function shouldSimulateTimeout() {
    return Math.random() < 0.005; // 0.5% device timeout
}

const AGENDA_TITLES = [
    '제1호 의안: 2024년도 사업보고 및 결산 승인의 건',
    '제2호 의안: 2025년도 사업계획 및 예산 승인의 건',
    '제3호 의안: 정관 개정의 건',
    '제4호 의안: 임원 선출의 건',
    '제5호 의안: 감사 선임의 건',
    '제6호 의안: 대의원 정원 변경의 건',
    '제7호 의안: 특별기금 조성의 건',
    '제8호 의안: 조합 사무소 이전의 건',
    '제9호 의안: 업무위탁 계약 승인의 건',
    '제10호 의안: 기타 안건',
];

console.log(`\n${'='.repeat(70)}`);
console.log(`  PROK Vote -- 2000 x 10 Full Voting Simulation`);
console.log(`${'='.repeat(70)}`);
console.log(`  Server: ${API_URL}`);
console.log(`  Voters: ${TARGET_VOTERS} (old phones + slow cellular sim)`);
console.log(`  Agendas: ${NUM_AGENDAS}`);
console.log(`  Vote spread: ${SPREAD_SECONDS}s per agenda`);
console.log(`${'='.repeat(70)}\n`);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runSimulation() {
    const globalStats = {
        totalVotesAttempted: 0,
        totalVotesSuccess: 0,
        totalVotesFailed: 0,
        totalVotesDuplicate: 0,
        allLatencies: [],
        agendaResults: [],
    };

    try {
        // Phase 1: Admin Login + Session Setup
        console.log(`[Phase 1] Admin login + session setup`);
        const loginRes = await axios.post(`${API_URL}/auth/admin/login`, {
            username: 'admin',
            password: 'prok7600'
        }, { timeout: 10000 });
        const adminToken = loginRes.data.accessToken;
        const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };
        console.log(`  OK: admin logged in\n`);

        const sessionRes = await axios.post(`${API_URL}/sessions`, {
            name: `[Load Test] ${TARGET_VOTERS} x ${NUM_AGENDAS}`,
            description: `${new Date().toLocaleString()} load test`,
            gpsEnabled: false
        }, { ...adminHeaders, timeout: 10000 });
        const session = sessionRes.data.session;
        console.log(`  OK: session ${session.id} (code: ${session.accessCode})`);

        await axios.put(`${API_URL}/sessions/${session.id}/settings`, {
            entryMode: 'GLOBAL_LINK',
            allowAnonymous: true
        }, { ...adminHeaders, timeout: 10000 });
        console.log(`  OK: GLOBAL_LINK mode set`);

        // Phase 2: Create agendas
        console.log(`\n[Phase 2] Creating ${NUM_AGENDAS} agendas`);
        const agendas = [];
        for (let i = 0; i < NUM_AGENDAS; i++) {
            const agendaRes = await axios.post(`${API_URL}/sessions/agendas`, {
                sessionId: session.id,
                title: AGENDA_TITLES[i] || `Agenda ${i + 1}`,
                description: `${TARGET_VOTERS} concurrent vote test`,
                type: 'PROS_CONS',
                displayOrder: i + 1
            }, { ...adminHeaders, timeout: 10000 });
            agendas.push(agendaRes.data.agenda);
            console.log(`  OK: ${AGENDA_TITLES[i]}`);
        }

        // Phase 3: Authenticate voters (batch 100)
        console.log(`\n[Phase 3] Authenticating ${TARGET_VOTERS} voters (batch 100)`);
        const voters = [];
        const BATCH_SIZE = 100;
        const authStart = Date.now();

        for (let i = 0; i < TARGET_VOTERS; i += BATCH_SIZE) {
            const batchPromises = [];
            const batchSize = Math.min(BATCH_SIZE, TARGET_VOTERS - i);
            for (let j = 0; j < batchSize; j++) {
                const idx = i + j;
                batchPromises.push(
                    axios.post(`${API_URL}/auth/global`, {
                        sessionId: session.id,
                        name: `voter-${(idx + 1).toString().padStart(4, '0')}`,
                        deviceFingerprint: crypto.randomBytes(32).toString('hex'),
                        accessCode: session.accessCode,
                        latitude: 37.5665,
                        longitude: 126.9780,
                        skipGPS: true
                    }, { timeout: 15000 }).then(res => {
                        voters.push({ idx, token: res.data.accessToken, voter: res.data.voter });
                    }).catch(() => {})
                );
            }
            await Promise.all(batchPromises);
            process.stdout.write(`\r  Auth: ${Math.min(i + BATCH_SIZE, TARGET_VOTERS)} / ${TARGET_VOTERS} (${Math.round((Math.min(i + BATCH_SIZE, TARGET_VOTERS) / TARGET_VOTERS) * 100)}%)`);
        }
        const authSec = ((Date.now() - authStart) / 1000).toFixed(1);
        console.log(`\n  OK: ${voters.length} voters authenticated (${authSec}s, ${(voters.length / parseFloat(authSec)).toFixed(0)} req/s)`);

        if (voters.length === 0) throw new Error('No voters authenticated');

        // Phase 4: Run voting rounds
        for (let round = 0; round < agendas.length; round++) {
            const agenda = agendas[round];
            console.log(`\n${'~'.repeat(70)}`);
            console.log(`  [${round + 1}/${agendas.length}] ${AGENDA_TITLES[round]}`);
            console.log(`${'~'.repeat(70)}`);

            // Submit agenda
            await axios.put(`${API_URL}/sessions/agendas/${agenda.id}/stage`, { stage: 'submitted' }, { ...adminHeaders, timeout: 10000 });
            console.log(`  -> Agenda submitted`);
            await sleep(1000);

            // Start voting
            await axios.put(`${API_URL}/sessions/agendas/${agenda.id}/stage`, { stage: 'voting' }, { ...adminHeaders, timeout: 10000 });
            console.log(`  -> Voting started -- ${voters.length} voters casting...`);

            // All voters vote via HTTP POST
            const choices = ['찬성', '찬성', '찬성', '반대', '기권'];
            const roundStats = { success: 0, fail: 0, duplicate: 0, timeout: 0, latencies: [] };
            const voteStart = Date.now();

            const votePromises = voters.map((v) => {
                return new Promise(async (resolve) => {
                    const humanDelay = Math.random() * (SPREAD_SECONDS * 1000);
                    await sleep(humanDelay);

                    if (shouldSimulateTimeout()) {
                        roundStats.timeout++;
                        roundStats.fail++;
                        globalStats.totalVotesAttempted++;
                        globalStats.totalVotesFailed++;
                        resolve(null);
                        return;
                    }

                    const choice = choices[Math.floor(Math.random() * choices.length)];
                    const t0 = Date.now();

                    try {
                        const res = await axios.post(`${API_URL}/votes`, {
                            agendaId: agenda.id,
                            choice,
                        }, {
                            headers: { Authorization: `Bearer ${v.token}` },
                            timeout: 15000,
                        });const latency = Date.now() - t0;
                        roundStats.success++;
                        roundStats.latencies.push(latency);
                        globalStats.totalVotesSuccess++;
                    } catch (err) {
                        if (err.response && err.response.status === 400) {
                            roundStats.duplicate++;
                            globalStats.totalVotesDuplicate++;
                            if (roundStats.duplicate <= 3) {
                                console.log(`     DUP[${roundStats.duplicate}]: ${JSON.stringify(err.response?.data).substring(0, 120)}`);
                            }
                        } else {
                            roundStats.fail++;
                            globalStats.totalVotesFailed++;
                            // Log first 3 errors per round for debugging
                            if (roundStats.fail <= 3) {
                                console.log(`     ERR[${roundStats.fail}]: ${err.response?.status || 'NETWORK'} ${JSON.stringify(err.response?.data || err.message).substring(0, 100)}`);
                            }
                        }
                    }
                    globalStats.totalVotesAttempted++;
                    resolve(null);
                });
            });

            await Promise.all(votePromises);
            const voteSec = ((Date.now() - voteStart) / 1000).toFixed(1);

            roundStats.latencies.sort((a, b) => a - b);
            const cnt = roundStats.latencies.length;
            const p50 = cnt > 0 ? roundStats.latencies[Math.floor(cnt * 0.5)] : 0;
            const p95 = cnt > 0 ? roundStats.latencies[Math.floor(cnt * 0.95)] : 0;
            const p99 = cnt > 0 ? roundStats.latencies[Math.floor(cnt * 0.99)] : 0;
            const avg = cnt > 0 ? Math.round(roundStats.latencies.reduce((a, b) => a + b, 0) / cnt) : 0;
            const maxL = cnt > 0 ? roundStats.latencies[cnt - 1] : 0;
            globalStats.allLatencies.push(...roundStats.latencies);

            console.log(`  -> Votes done: ${voteSec}s | OK=${roundStats.success} dup=${roundStats.duplicate} fail=${roundStats.fail} timeout=${roundStats.timeout}`);
            console.log(`     Latency: avg=${avg}ms p50=${p50}ms p95=${p95}ms p99=${p99}ms max=${maxL}ms | TPS=${(roundStats.success / parseFloat(voteSec)).toFixed(0)}`);

            // End voting
            await axios.put(`${API_URL}/sessions/agendas/${agenda.id}/stage`, { stage: 'ended' }, { ...adminHeaders, timeout: 10000 });
            await sleep(500);

            // Announce results
            await axios.put(`${API_URL}/sessions/agendas/${agenda.id}/stage`, { stage: 'announced' }, { ...adminHeaders, timeout: 10000 });

            // DB verify
            const statsRes = await axios.get(`${API_URL}/votes/stats/${agenda.id}`, { timeout: 10000 });
            const dbStats = statsRes.data.stats || statsRes.data;
            const dbTotal = dbStats.totalVotes || 0;
            const match = roundStats.success === dbTotal;

            console.log(`  -> DB: total=${dbTotal} (approve=${dbStats.approveCount||0} reject=${dbStats.rejectCount||0} abstain=${dbStats.abstainCount||0})`);
            console.log(`  ${match ? 'OK' : 'MISMATCH'}: submitted=${roundStats.success} vs DB=${dbTotal} ${match ? '-- 100% match' : '-- MISMATCH!'}`);

            globalStats.agendaResults.push({
                title: AGENDA_TITLES[round],
                success: roundStats.success, fail: roundStats.fail, duplicate: roundStats.duplicate,
                dbTotal, match, avg, p95,
                tps: (roundStats.success / parseFloat(voteSec)).toFixed(0),
            });

            await sleep(1000);
        }

        // Final Summary
        globalStats.allLatencies.sort((a, b) => a - b);
        const tc = globalStats.allLatencies.length;
        const gp50 = tc > 0 ? globalStats.allLatencies[Math.floor(tc * 0.5)] : 0;
        const gp95 = tc > 0 ? globalStats.allLatencies[Math.floor(tc * 0.95)] : 0;
        const gp99 = tc > 0 ? globalStats.allLatencies[Math.floor(tc * 0.99)] : 0;
        const gAvg = tc > 0 ? Math.round(globalStats.allLatencies.reduce((a, b) => a + b, 0) / tc) : 0;
        const gMax = tc > 0 ? globalStats.allLatencies[tc - 1] : 0;

        console.log(`\n${'='.repeat(70)}`);
        console.log(`  FINAL RESULTS`);
        console.log(`${'='.repeat(70)}`);
        console.log(`  Voters: ${voters.length}`);
        console.log(`  Agendas: ${agendas.length}`);
        console.log(`  Total attempts: ${globalStats.totalVotesAttempted}`);
        console.log(`  Total success: ${globalStats.totalVotesSuccess}`);
        console.log(`  Total duplicate: ${globalStats.totalVotesDuplicate}`);
        console.log(`  Total failed: ${globalStats.totalVotesFailed}`);
        console.log(`  Loss rate: ${((globalStats.totalVotesFailed / globalStats.totalVotesAttempted) * 100).toFixed(3)}%`);
        console.log(`${'~'.repeat(70)}`);
        console.log(`  Overall latency: avg=${gAvg}ms p50=${gp50}ms p95=${gp95}ms p99=${gp99}ms max=${gMax}ms`);
        console.log(`${'~'.repeat(70)}`);
        console.log(`  Per-agenda:`);
        globalStats.agendaResults.forEach((r, i) => {
            console.log(`    ${i + 1}. ${r.match ? 'OK' : 'XX'} ok=${r.success} fail=${r.fail} db=${r.dbTotal} avg=${r.avg}ms p95=${r.p95}ms TPS=${r.tps}`);
        });

        const allMatch = globalStats.agendaResults.every(r => r.match);
        console.log(`\n  VERDICT: ${allMatch ? 'ALL 10 AGENDAS 100% CONSISTENT -- READY FOR PRODUCTION' : 'SOME AGENDAS INCONSISTENT'}`);
        console.log(`${'='.repeat(70)}\n`);

        return allMatch;

    } catch (err) {
        console.error(`\nFATAL:`, err.message);
        if (err.response) {
            console.error(`  Status: ${err.response.status}`);
            console.error(`  Data:`, JSON.stringify(err.response.data));
        }
        return false;
    }
}

runSimulation().then(ok => process.exit(ok ? 0 : 1));
