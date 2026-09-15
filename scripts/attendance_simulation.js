/**
 * PROK Vote — 재석인원 0→2000 시각 확인 시뮬레이션 (10회)
 * 
 * 전광판(stadium)을 열어두고 실행하면 재석인원이
 * 0에서 2000으로 올라가는 것을 10번 반복해서 볼 수 있습니다.
 */
const axios = require('axios');
const crypto = require('crypto');

const API_URL = process.env.API_URL || 'https://prok-vote-backend-763218472939.asia-northeast3.run.app';
const TARGET_VOTERS = parseInt(process.env.VOTERS || '2000', 10);
const ROUNDS = parseInt(process.env.ROUNDS || '10', 10);
const BURST_SECONDS = parseFloat(process.env.BURST_SEC || '5');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  재석인원 시뮬레이션 — ${TARGET_VOTERS}명 × ${ROUNDS}회`);
    console.log(`  5초 내 전원 접속 → 재석인원 0→${TARGET_VOTERS} 상승 확인`);
    console.log(`${'='.repeat(60)}\n`);

    // Admin login
    const login = await axios.post(`${API_URL}/auth/admin/login`, {
        username: 'admin', password: 'prok7600'
    }, { timeout: 10000 });
    const adminToken = login.data.accessToken;
    const adminH = { headers: { Authorization: `Bearer ${adminToken}` } };
    console.log(`  OK: 관리자 로그인\n`);

    // Create session
    const sess = await axios.post(`${API_URL}/sessions`, {
        name: `[재석인원 테스트] ${TARGET_VOTERS}명 × ${ROUNDS}회`,
        gpsEnabled: false
    }, { ...adminH, timeout: 10000 });
    const session = sess.data.session;
    await axios.put(`${API_URL}/sessions/${session.id}/settings`, {
        entryMode: 'GLOBAL_LINK', allowAnonymous: true
    }, { ...adminH, timeout: 10000 });
    
    console.log(`  ★★★ 전광판에서 이 세션을 열어주세요 ★★★`);
    console.log(`  세션 ID: ${session.id}`);
    console.log(`  접속 코드: ${session.accessCode}`);
    console.log(`  전광판 URL: https://prok-vote-frontend-763218472939.asia-northeast3.run.app/stadium\n`);

    // Create one agenda (needed for session to be active)
    await axios.post(`${API_URL}/sessions/agendas`, {
        sessionId: session.id,
        title: '재석인원 확인용 안건',
        type: 'PROS_CONS',
        displayOrder: 1
    }, { ...adminH, timeout: 10000 });

    // Authenticate voters
    console.log(`  ${TARGET_VOTERS}명 투표자 인증 중...`);
    const voters = [];
    const BATCH = 100;
    for (let i = 0; i < TARGET_VOTERS; i += BATCH) {
        const batch = [];
        for (let j = 0; j < Math.min(BATCH, TARGET_VOTERS - i); j++) {
            const idx = i + j;
            batch.push(
                axios.post(`${API_URL}/auth/global`, {
                    sessionId: session.id,
                    name: `voter-${(idx+1).toString().padStart(4,'0')}`,
                    deviceFingerprint: crypto.randomBytes(32).toString('hex'),
                    accessCode: session.accessCode,
                    latitude: 37.5665, longitude: 126.9780, skipGPS: true
                }, { timeout: 15000 }).then(r => {
                    voters.push({ id: r.data.voter.id, token: r.data.accessToken });
                }).catch(() => {})
            );
        }
        await Promise.all(batch);
        process.stdout.write(`\r  인증: ${Math.min(i+BATCH, TARGET_VOTERS)}/${TARGET_VOTERS}`);
    }
    console.log(`\n  OK: ${voters.length}명 인증 완료\n`);

    // Wait for user to open stadium
    console.log(`  ⏳ 10초 후 시뮬레이션 시작합니다... 전광판을 확인하세요!`);
    for (let i = 10; i > 0; i--) {
        process.stdout.write(`\r  ${i}초...`);
        await sleep(1000);
    }
    console.log(`\r  시작!        \n`);

    // Run 10 rounds
    for (let round = 1; round <= ROUNDS; round++) {
        console.log(`${'~'.repeat(60)}`);
        console.log(`  [${round}/${ROUNDS}] 재석인원 리셋 → ${TARGET_VOTERS}명 접속 시작`);
        console.log(`${'~'.repeat(60)}`);

        // Reset online count
        await axios.delete(`${API_URL}/sessions/${session.id}/online-voters`, {
            ...adminH, timeout: 10000
        });
        console.log(`  → 재석인원 0으로 리셋 완료`);
        await sleep(2000); // 2초 대기 — 전광판에서 0 확인

        // Burst: all voters poll voter-state within BURST_SECONDS
        const startTime = Date.now();
        let registered = 0;

        const promises = voters.map((v, i) => {
            return new Promise(async (resolve) => {
                const delay = Math.random() * (BURST_SECONDS * 1000);
                await sleep(delay);
                try {
                    await axios.get(`${API_URL}/sessions/${session.id}/voter-state`, {
                        params: { voterId: v.id },
                        timeout: 10000
                    });
                    registered++;
                } catch(e) {}
                resolve(null);
            });
        });

        // Progress tracking
        const progressInterval = setInterval(() => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            process.stdout.write(`\r  → ${elapsed}초 경과 | 폴링 완료: ${registered}/${voters.length}`);
        }, 200);

        await Promise.all(promises);
        clearInterval(progressInterval);

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\r  ✅ ${totalTime}초 만에 ${registered}/${voters.length}명 폴링 완료 — 전광판에서 재석인원 확인!`);
        
        // Wait between rounds for visual confirmation
        if (round < ROUNDS) {
            console.log(`  ⏳ 8초 후 다음 라운드...\n`);
            await sleep(8000);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ✅ ${ROUNDS}회 시뮬레이션 완료!`);
    console.log(`${'='.repeat(60)}\n`);
}

run().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
