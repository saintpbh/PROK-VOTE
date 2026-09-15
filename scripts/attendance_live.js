/**
 * 기존 세션에 대해 재석인원 시뮬레이션 (전광판 확인용)
 * 세션: 742d2f9a-0db6-4ecf-9e44-abfc9a2ce2ad
 */
const axios = require('axios');
const crypto = require('crypto');

const API_URL = 'https://prok-vote-backend-763218472939.asia-northeast3.run.app';
const SESSION_ID = '742d2f9a-0db6-4ecf-9e44-abfc9a2ce2ad';
const TARGET_VOTERS = 2000;
const ROUNDS = 10;
const BURST_SEC = 5;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  재석인원 시뮬레이션 — 기존 세션 사용`);
    console.log(`  세션: ${SESSION_ID}`);
    console.log(`  ${TARGET_VOTERS}명 × ${ROUNDS}회`);
    console.log(`${'='.repeat(60)}\n`);

    // Admin login
    const login = await axios.post(`${API_URL}/auth/admin/login`, {
        username: 'admin', password: 'prok7600'
    }, { timeout: 10000 });
    const adminToken = login.data.accessToken;
    const adminH = { headers: { Authorization: `Bearer ${adminToken}` } };
    console.log(`  OK: 관리자 로그인`);

    // Get session info (access code)
    const sessRes = await axios.get(`${API_URL}/sessions/${SESSION_ID}`, { ...adminH, timeout: 10000 });
    const accessCode = sessRes.data.session?.accessCode || sessRes.data.accessCode;
    console.log(`  OK: 세션 접속코드 = ${accessCode}\n`);

    // Authenticate 2000 voters
    console.log(`  ${TARGET_VOTERS}명 투표자 인증 중...`);
    const voters = [];
    const BATCH = 100;
    for (let i = 0; i < TARGET_VOTERS; i += BATCH) {
        const batch = [];
        for (let j = 0; j < Math.min(BATCH, TARGET_VOTERS - i); j++) {
            const idx = i + j;
            batch.push(
                axios.post(`${API_URL}/auth/global`, {
                    sessionId: SESSION_ID,
                    name: `sim-${(idx+1).toString().padStart(4,'0')}`,
                    deviceFingerprint: crypto.randomBytes(32).toString('hex'),
                    accessCode: accessCode,
                    latitude: 37.5665, longitude: 126.9780, skipGPS: true
                }, { timeout: 15000 }).then(r => {
                    voters.push({ id: r.data.voter.id, token: r.data.accessToken });
                }).catch(e => {
                    if (voters.length === 0 && i === 0 && j === 0) {
                        console.log(`\n  AUTH ERROR: ${e.response?.status} ${JSON.stringify(e.response?.data).substring(0,100)}`);
                    }
                })
            );
        }
        await Promise.all(batch);
        process.stdout.write(`\r  인증: ${Math.min(i+BATCH, TARGET_VOTERS)}/${TARGET_VOTERS}`);
    }
    console.log(`\n  OK: ${voters.length}명 인증 완료\n`);

    if (voters.length === 0) {
        console.log('  ERROR: 인증된 투표자가 없습니다.');
        return;
    }

    console.log(`  ★ 전광판을 확인하세요! 5초 후 시작합니다...`);
    for (let i = 5; i > 0; i--) {
        process.stdout.write(`\r  ${i}초...`);
        await sleep(1000);
    }
    console.log(`\r  시작!   \n`);

    // 10 rounds
    for (let round = 1; round <= ROUNDS; round++) {
        console.log(`${'~'.repeat(60)}`);
        console.log(`  [${round}/${ROUNDS}] 재석 리셋 → ${voters.length}명 접속`);
        console.log(`${'~'.repeat(60)}`);

        // Reset
        await axios.delete(`${API_URL}/sessions/${SESSION_ID}/online-voters`, { ...adminH, timeout: 10000 });
        console.log(`  → 재석 0 리셋`);
        await sleep(2000);

        // Burst poll
        const t0 = Date.now();
        let done = 0;
        const promises = voters.map(v => new Promise(async resolve => {
            await sleep(Math.random() * BURST_SEC * 1000);
            try {
                await axios.get(`${API_URL}/sessions/${SESSION_ID}/voter-state`, {
                    params: { voterId: v.id }, timeout: 10000
                });
                done++;
            } catch(e) {}
            resolve(null);
        }));

        const prog = setInterval(() => {
            process.stdout.write(`\r  → ${((Date.now()-t0)/1000).toFixed(1)}초 | ${done}/${voters.length}명`);
        }, 200);

        await Promise.all(promises);
        clearInterval(prog);
        console.log(`\r  ✅ ${((Date.now()-t0)/1000).toFixed(1)}초에 ${done}/${voters.length}명 완료!`);

        if (round < ROUNDS) {
            console.log(`  ⏳ 8초 대기...\n`);
            await sleep(8000);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ✅ ${ROUNDS}회 시뮬레이션 완료!`);
    console.log(`${'='.repeat(60)}\n`);
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
