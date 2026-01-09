const axios = require('axios');

const API_URL = 'http://localhost:3011';

async function setupSimulation() {
    try {
        console.log('🚀 Starting Simulation Setup...');

        // 1. Create Session
        console.log('1. Creating Session...');
        const sessionRes = await axios.post(`${API_URL}/sessions`, {
            name: 'Simulation Vote 2026',
            description: 'Automated testing session',
            gpsEnabled: false
        });
        const session = sessionRes.data.session;
        console.log(`✅ Session Created: ${session.id} (Access Code: ${session.accessCode})`);

        // 2. Create Agenda
        console.log('2. Creating Agenda...');
        const agendaRes = await axios.post(`${API_URL}/sessions/agendas`, {
            sessionId: session.id,
            title: 'Do you approve this simulation?',
            description: 'Vote Yes or No',
            displayOrder: 1
        });
        const agenda = agendaRes.data.agenda;
        console.log(`✅ Agenda Created: ${agenda.id}`);

        // 3. Generate Token
        console.log('3. Generating Token...');
        const tokensRes = await axios.post(`${API_URL}/auth/generate-tokens`, {
            sessionId: session.id,
            count: 1
        });
        const token = tokensRes.data.tokens[0]; // Logic checked in next step, but assuming structure for now
        console.log(`✅ Token Generated: ${token}`);

        // 4. Set Stage to Voting
        console.log('4. Starting Voting Stage...');
        try {
            await axios.put(`${API_URL}/sessions/agendas/${agenda.id}/stage`, {
                stage: 'voting'
            });
            console.log('✅ Stage set to VOTING');
        } catch (err) {
            console.error('⚠️ Failed to set stage (might need socket connection or simple update):', err.message);
        }

        const simData = {
            sessionId: session.id,
            agendaId: agenda.id,
            token: token,
            accessCode: session.accessCode,
            adminUrl: `http://localhost:3010/admin`,
            voterUrl: `http://localhost:3010/vote/${token}`,
            stadiumUrl: `http://localhost:3010/stadium`
        };

        console.log('\n--- SIMULATION DATA ---');
        console.log(JSON.stringify(simData));

    } catch (error) {
        console.error('❌ Setup Failed:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data));
        }
    }
}

setupSimulation();
