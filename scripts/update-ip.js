const os = require('os');
const fs = require('fs');
const path = require('path');

// 1. Get Local IP Address
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (127.0.0.1) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const localIp = getLocalIp();
console.log(`📍 Detected Local IP: ${localIp}`);

// 2. Update Frontend .env.local
const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env.local');
const frontendEnvContent = `NEXT_PUBLIC_API_URL=http://${localIp}:3011
NEXT_PUBLIC_WS_URL=http://${localIp}:3011
NEXT_PUBLIC_BASE_URL=http://${localIp}:3010

# Application Configuration
NEXT_PUBLIC_APP_NAME=PROK Vote
NEXT_PUBLIC_APP_VERSION=1.0.0
`;

try {
    fs.writeFileSync(frontendEnvPath, frontendEnvContent);
    console.log(`✅ Updated frontend/.env.local with IP: ${localIp}`);
} catch (error) {
    console.error(`❌ Failed to update frontend/.env.local: ${error.message}`);
}

// 3. Update Backend .env
const backendEnvPath = path.join(__dirname, '..', 'backend', '.env');
try {
    if (fs.existsSync(backendEnvPath)) {
        let content = fs.readFileSync(backendEnvPath, 'utf8');
        // Replace FRONTEND_URL line
        content = content.replace(/^FRONTEND_URL=.*$/m, `FRONTEND_URL=http://${localIp}:3010`);
        fs.writeFileSync(backendEnvPath, content);
        console.log(`✅ Updated backend/.env with FRONTEND_URL: http://${localIp}:3010`);
    }
} catch (error) {
    console.error(`❌ Failed to update backend/.env: ${error.message}`);
}

// 4. Update Backend CORS in main.ts
const backendMainPath = path.join(__dirname, '..', 'backend', 'src', 'main.ts');
try {
    let content = fs.readFileSync(backendMainPath, 'utf8');

    // Regex to match the allowedOrigins array content or the specific lines
    // We look for the previous IP (e.g. 192.168.x.x or 172.30.x.x) and replace it
    // Or simpler: We just look for the block and rewrite the array items for the IP

    // Strategy: Regex to find the lines with IP-based URLs and replace them
    // Matches http://<IP>:3010 and http://<IP>:3011
    const ipRegex = /'http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:(3010|3011)'/g;

    if (content.match(ipRegex)) {
        content = content.replace(/'http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:3010'/g, `'http://${localIp}:3010'`);
        content = content.replace(/'http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:3011'/g, `'http://${localIp}:3011'`);
        fs.writeFileSync(backendMainPath, content);
        console.log(`✅ Updated backend/src/main.ts with IP: ${localIp}`);
    } else {
        console.log(`⚠️  Could not find IP pattern in backend/src/main.ts. Please check manually.`);
    }
} catch (error) {
    console.error(`❌ Failed to update backend/src/main.ts: ${error.message}`);
}

// 4. Update Backend CORS in voting.gateway.ts
const votingGatewayPath = path.join(__dirname, '..', 'backend', 'src', 'voting', 'voting.gateway.ts');
try {
    let content = fs.readFileSync(votingGatewayPath, 'utf8');

    // Same regex strategy
    if (content.match(/'http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:(3010|3011)'/)) {
        content = content.replace(/'http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:3010'/g, `'http://${localIp}:3010'`);
        content = content.replace(/'http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:3011'/g, `'http://${localIp}:3011'`);
        fs.writeFileSync(votingGatewayPath, content);
        console.log(`✅ Updated backend/src/voting/voting.gateway.ts with IP: ${localIp}`);
    } else {
        console.log(`⚠️  Could not find IP pattern in backend/src/voting/voting.gateway.ts. Please check manually.`);
    }
} catch (error) {
    console.error(`❌ Failed to update backend/src/voting/voting.gateway.ts: ${error.message}`);
}

console.log(`\n🎉 IP configurations updated! You may need to restart your servers.`);
console.log(`\nAdmin/Voter URL: http://${localIp}:3010`);
console.log(`Stadium Display: http://${localIp}:3010/stadium?session=YOUR_SESSION_ID\n`);
