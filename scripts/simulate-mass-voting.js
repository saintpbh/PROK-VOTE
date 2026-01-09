const { io } = require('socket.io-client');
const axios = require('axios');

const API_URL = 'http://172.30.1.15:3011';
const SOCKET_URL = 'http://172.30.1.15:3011';

async function simulate() {
    console.log('🚀 Starting Mass Voting Simulation (JS)...');

    try {
        // 0. Login as admin to get session list
        const adminLoginRes = await axios.post(`${API_URL}/auth/admin/login`, { password: 'admin123' });
        const adminToken = adminLoginRes.data.accessToken;
        const adminConfig = { headers: { Authorization: `Bearer ${adminToken}` } };

        // 1. Get an active session and agenda
        const sessionsRes = await axios.get(`${API_URL}/sessions`, adminConfig);
        const sessions = sessionsRes.data.sessions;
        if (!sessions || sessions.length === 0) {
            console.error('❌ No sessions found. Please create a session first.');
            return;
        }

        const session = sessions[0];
        const agendasRes = await axios.get(`${API_URL}/sessions/${session.id}/agendas`);
        const agendas = agendasRes.data.agendas;
        const votingAgenda = agendas.find((a) => a.stage === 'voting');

        if (!votingAgenda) {
            console.error('❌ No agenda in "voting" stage found. Please start voting on an agenda first.');
            return;
        }

        console.log(`📍 Targeting Session: ${session.name} (${session.id})`);
        console.log(`📍 Targeting Agenda: ${votingAgenda.title} (${votingAgenda.id})`);

        // 2. Simulate 50 concurrent voters
        const voterCount = 50;
        console.log(`👥 Simulating ${voterCount} concurrent voters...`);

        const votes = ['찬성', '반대', '기권'];

        for (let i = 0; i < voterCount; i++) {
            const name = `Simulated Voter ${i + 1}`;

            // Authenticate globally
            const authRes = await axios.post(`${API_URL}/auth/global`, {
                sessionId: session.id,
                name: name,
                deviceFingerprint: `sim-device-fingerprint-${i.toString().padStart(3, '0')}`,
                latitude: 37.5665,
                longitude: 126.9780,
                accessCode: session.accessCode,
                skipGPS: true
            });

            const { accessToken, voter } = authRes.data;
            const socket = io(SOCKET_URL, {
                auth: { token: accessToken }
            });

            socket.on('connect', () => {
                socket.emit('join:session', {
                    sessionId: session.id,
                    voterId: voter.id,
                    role: 'voter'
                });

                setTimeout(() => {
                    const choice = votes[Math.floor(Math.random() * votes.length)];
                    socket.emit('vote:cast', {
                        agendaId: votingAgenda.id,
                        choice: choice,
                        voterId: voter.id
                    });

                    console.log(`✅ [${name}] Voted: ${choice}`);

                    setTimeout(() => socket.disconnect(), 1000);
                }, Math.random() * 2000);
            });
        }

    } catch (error) {
        if (error.response) {
            console.error('❌ Simulation failed:', error.response.status, JSON.stringify(error.response.data));
        } else {
            console.error('❌ Simulation failed:', error.message);
        }
    }
}

simulate();
