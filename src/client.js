import SimplePeer from 'simple-peer';
import { extractFiles } from './extract.js';
import { processImage } from './imageProcessor.js';

console.log('App started');

function sendPagesInChunks(peer, pagesArray) {
    if (!peer || !peer.connected) return;

    pagesArray.forEach((pageData, index) => {
        // SimplePeer handles chunking under the hood for data up to ~16-64KB, but large data urls might still fail.
        // We'll send one page at a time. If it still fails, we might need a library like `peerjs` chunking or chunking the base64 string manually.
        // But sending an array of hundreds of images is what caused the size limit error. Sending one page per message should be okay for moderate images.
        const isLast = (index === pagesArray.length - 1);
        try {
            peer.send(JSON.stringify({
                type: 'page-chunk',
                chunkIndex: index,
                pageData: pageData,
                isLast: isLast
            }));
        } catch (e) {
            console.error("Failed to send page chunk", index, e);
        }
    });
}

const fileInput = document.getElementById('file-input');
const comicPage = document.getElementById('comic-page');

const socket = io();
let peer = null;
let sessionId = null;
let role = 'left';

let pages = [];
let currentPageIndex = 0;

function updateDisplay(index) {
    if (index < 0 || index >= pages.length) return;

    // Hide instructions and show comic page when a page is loaded
    const instructions = document.getElementById('instructions');
    if (instructions) instructions.style.display = 'none';
    comicPage.style.display = 'block';

    currentPageIndex = index;
    comicPage.src = pages[currentPageIndex];
    document.getElementById('status').innerText = `Page ${currentPageIndex + 1} of ${pages.length}`;

    // Buffer next and previous pages
    const preloadIndexes = [index - 1, index + 1, index - 2, index + 2];
    preloadIndexes.forEach(idx => {
        if (idx >= 0 && idx < pages.length) {
            const img = new Image();
            img.src = pages[idx];
        }
    });
}

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        console.log(`Extracting ${file.name}...`);
        document.getElementById('status').innerText = 'Status: Extracting...';

        const extractedFiles = await extractFiles(file);
        console.log(`Extracted ${extractedFiles.length} files.`);
        document.getElementById('status').innerText = `Status: Processing images...`;

        pages = [];
        for (const f of extractedFiles) {
            try {
                const newPages = await processImage(f.buffer);
                pages.push(...newPages);
            } catch (err) {
                console.warn(`Failed to process ${f.filename}`, err);
            }
        }

        console.log(`Processed ${pages.length} total pages.`);
        document.getElementById('status').innerText = `Status: Ready (${pages.length} pages)`;

        if (pages.length > 0) {
            // Send pages to peer in chunks
            if (peer && peer.connected) {
                console.log('Sending pages to peer...');
                sendPagesInChunks(peer, pages);
                peer.send(JSON.stringify({ type: 'sync', index: 0 }));
            }

            // Display immediately (This overwrites "Ready" so the user can see the page number)
            updateDisplay(role === 'left' ? 0 : 1);
        }

    } catch (err) {
        console.error('Extraction failed:', err);
        document.getElementById('status').innerText = 'Status: Extraction Error';
    }
});

// UI Controls
document.getElementById('join-btn').addEventListener('click', () => {
    sessionId = document.getElementById('session-id').value.trim();
    if (!sessionId) {
        alert("Enter a session ID");
        return;
    }

    role = document.getElementById('role-select').value;

    // Enable file input
    document.getElementById('file-input').disabled = false;
    document.getElementById('status').innerText = `Joining ${sessionId}...`;

    socket.emit('join-session', sessionId);
});

// Navigation
function turnPage(direction) {
    if (pages.length === 0) return;

    let newIndex = currentPageIndex;
    if (direction === 'next') {
        newIndex = Math.min(pages.length - 1, currentPageIndex + 2);
    } else if (direction === 'prev') {
        newIndex = Math.max(0, currentPageIndex - 2);
    }

    if (newIndex !== currentPageIndex) {
        // If I am right page, my currentPageIndex is already +1 from the real sync index.
        // Let's normalize to the "left" base index to send the command.
        let baseIndex = (role === 'left') ? newIndex : newIndex - 1;
        baseIndex = Math.max(0, baseIndex);

        // Update my own display
        updateDisplay(role === 'left' ? baseIndex : baseIndex + 1);

        if (peer && peer.connected) {
            peer.send(JSON.stringify({ type: 'sync', index: baseIndex }));
        }
    }
}

document.getElementById('nav-left').addEventListener('click', () => turnPage('prev'));
document.getElementById('nav-right').addEventListener('click', () => turnPage('next'));

// Socket & PeerJS Logic
socket.on('room-full', () => {
    alert("Session is full (max 2 devices).");
    document.getElementById('status').innerText = "Session Full";
});

socket.on('ready', (data) => {
    // Check our socket ID. It seems socket.id may not be correctly populated if we use `const socket = io();`
    // but the object itself has an `id` property.
    const isInitiator = (socket.id === data.initiatorSocketId);

    // Room is ready with 2 people. The designated person initiates the WebRTC connection.
    console.log(`Room ready. Am I initiator? ${isInitiator} (my id: ${socket.id}, initiator id: ${data.initiatorSocketId})`);

    if (peer) {
        // Destroy existing peer if we're reconnecting
        peer.destroy();
        peer = null;
    }

    if (isInitiator) {
        console.log('Initiating peer connection...');
        peer = new SimplePeer({
            initiator: true,
            trickle: false
        });
        setupPeerListeners(peer);
    }
});

socket.on('signal', (data) => {
    if (!peer) {
        console.log('Received signal, creating answering peer...');
        peer = new SimplePeer({
            initiator: false,
            trickle: false
        });
        setupPeerListeners(peer);
    }
    peer.signal(data.signal);
});

function setupPeerListeners(p) {
    p.on('signal', (signal) => {
        socket.emit('signal', { sessionId, signal });
    });

    p.on('connect', () => {
        console.log('Peer connected!');
        document.getElementById('status').innerText = "Status: Peer Connected";

        // If we already loaded pages, send them over in chunks
        if (pages.length > 0) {
            sendPagesInChunks(p, pages);
            // Default sync to base index 0
            p.send(JSON.stringify({ type: 'sync', index: role === 'left' ? currentPageIndex : currentPageIndex - 1 }));
        }
    });

    p.on('data', (data) => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'page-chunk') {
                // Collect page chunk
                console.log(`Received page chunk ${msg.chunkIndex}`);
                pages[msg.chunkIndex] = msg.pageData;

                if (msg.isLast) {
                    console.log('Received all pages from peer');
                    // Ensure the status text exactly includes "Received" as expected by the tests.
                    document.getElementById('status').innerText = `Received ${pages.length} pages`;
                    // Assume sync comes separately, or just update based on role
                    if (pages[0]) {
                         updateDisplay(role === 'left' ? 0 : 1);
                    }
                }
            } else if (msg.type === 'sync') {
                const peerIndex = msg.index;
                // If I am left page, I should show the index.
                // If I am right page, I should show index + 1 (unless it's the last page)
                if (role === 'left') {
                    updateDisplay(peerIndex);
                } else if (role === 'right') {
                    const myIndex = Math.min(peerIndex + 1, pages.length - 1);
                    updateDisplay(myIndex);
                }
            }
        } catch (e) {
            console.error('Failed to parse peer message', e);
        }
    });

    p.on('error', (err) => {
        console.error('Peer error:', err);
    });

    p.on('close', () => {
        console.log('Peer closed');
        peer = null;
        document.getElementById('status').innerText = "Status: Peer Disconnected";
    });
}
