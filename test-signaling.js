const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const ROOM = 'test-room';

const client1 = io(SERVER_URL);
const client2 = io(SERVER_URL);

let c1Ready = false;
let c2Ready = false;

client1.on('connect', () => {
    console.log('Client 1 connected');
    client1.emit('join-session', ROOM);
});

client2.on('connect', () => {
    console.log('Client 2 connected');
    client2.emit('join-session', ROOM);
});

client1.on('ready', () => {
    console.log('Client 1 received ready (should not happen as C1 joined first)');
});

client2.on('ready', () => {
    console.log('Client 2 received ready. Room is full. Emitting test signal from C2.');
    client2.emit('signal', { sessionId: ROOM, signal: { type: 'offer', sdp: 'test-sdp' } });
});

client1.on('signal', (data) => {
    console.log('Client 1 received signal:', data);
    if (data.signal.type === 'offer') {
        console.log('Test PASSED: Signaling relayed successfully.');
        client1.disconnect();
        client2.disconnect();
        process.exit(0);
    }
});

setTimeout(() => {
    console.error('Test FAILED: Timeout waiting for signal');
    client1.disconnect();
    client2.disconnect();
    process.exit(1);
}, 5000);
