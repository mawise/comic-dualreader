const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join-session', (sessionId) => {
        const room = io.sockets.adapter.rooms.get(sessionId);
        if (room && room.size >= 2) {
            socket.emit('room-full');
            return;
        }

        socket.join(sessionId);
        console.log(`Socket ${socket.id} joined session ${sessionId}`);

        // If this is the second person joining, tell them to initiate connection
        // We have to query the room AFTER the socket has joined because room size includes the new socket.
        const currentRoom = io.sockets.adapter.rooms.get(sessionId);
        if (currentRoom && currentRoom.size === 2) {
            // Tell the room that it is ready, but specifically designate the second socket as the initiator
            io.to(sessionId).emit('ready', { initiatorSocketId: socket.id });
        }
    });

    socket.on('signal', (data) => {
        // Relay signaling data to the other peer in the room
        socket.to(data.sessionId).emit('signal', {
            signal: data.signal,
            from: socket.id
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
