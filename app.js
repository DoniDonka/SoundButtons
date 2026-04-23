import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, set, get, child, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAfCititqgz6H03Bg3W4bZbTDp4v-WpH6Y",
    authDomain: "soundbuttons-36b5c.firebaseapp.com",
    databaseURL: "https://soundbuttons-36b5c-default-rtdb.firebaseio.com",
    projectId: "soundbuttons-36b5c",
    storageBucket: "soundbuttons-36b5c.firebasestorage.app",
    messagingSenderId: "666242287540",
    appId: "1:666242287540:web:1677f3ae27b2210e7e14e1",
    measurementId: "G-M89D5FH56N"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let ytPlayer = null;
let audioUnlocked = false;
let currentVideoData = null;
let currentlyLoadedVideoId = null;
let pendingVideoData = null; // stores Firebase data received before audio unlocked

// ── YOUTUBE PLAYER SETUP ──
// The YT API script loaded in HTML will call this when ready.
// We expose it on window so the non-module script can reach it.
window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('player', {
        height: '1',
        width: '1',
        videoId: 'jNQXAC9IVRw', // "Me at the zoo" — tiny real video to unlock audio context
        playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            playsinline: 1,
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
        }
    });
};

function onPlayerReady() {
    // Player is ready — nothing to auto-play yet
}

function onPlayerStateChange(event) {
    // When a video ends (state = 0), auto-advance to the next in queue
    if (event.data === YT.PlayerState.ENDED) {
        advanceQueue();
    }
}

function advanceQueue() {
    get(child(ref(db), 'queue')).then((snapshot) => {
        if (snapshot.exists()) {
            const queueData = snapshot.val();
            const firstKey = Object.keys(queueData)[0];
            const nextItem = queueData[firstKey];
            set(ref(db, 'nowPlaying'), { videoId: nextItem.videoId, title: nextItem.title, state: 'playing' });
            remove(ref(db, `queue/${firstKey}`));
        } else {
            remove(ref(db, 'nowPlaying'));
        }
    });
}

// ── AUDIO UNLOCK ──
document.getElementById('join-btn').addEventListener('click', () => {
    if (!ytPlayer || typeof ytPlayer.playVideo !== 'function') {
        alert("YouTube API is still loading. Please wait a moment and try again.");
        return;
    }

    ytPlayer.unMute();
    ytPlayer.setVolume(100);
    ytPlayer.playVideo();

    // 600ms is enough to trigger the browser's audio context unlock
    setTimeout(() => {
        ytPlayer.stopVideo();
        audioUnlocked = true;

        // Fade out & hide overlay
        const overlay = document.getElementById('join-screen');
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.4s ease';
        setTimeout(() => { overlay.style.display = 'none'; }, 400);

        // If Firebase already sent us data while we were on the overlay, apply it now
        if (pendingVideoData) {
            applyVideoState(pendingVideoData);
            pendingVideoData = null;
        }
    }, 600);
});

// ── HELPERS ──
function extractVideoID(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11})/);
    return match ? match[1] : null;
}

async function getYouTubeTitle(videoId) {
    try {
        const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await res.json();
        return data.title || "Unknown Audio";
    } catch {
        return "Unknown Audio";
    }
}

// ── ADD TO QUEUE ──
document.getElementById('queue-btn').addEventListener('click', async () => {
    const input = document.getElementById('yt-link');
    const btn = document.getElementById('queue-btn');
    const videoId = extractVideoID(input.value.trim());

    if (!videoId) {
        input.style.borderColor = '#ff4757';
        setTimeout(() => { input.style.borderColor = ''; }, 1500);
        return;
    }

    btn.textContent = "Loading...";
    btn.disabled = true;

    const title = await getYouTubeTitle(videoId);

    const snapshot = await get(child(ref(db), 'nowPlaying'));
    if (!snapshot.exists()) {
        // Nothing playing — go straight to now playing
        await set(ref(db, 'nowPlaying'), { videoId, title, state: 'playing' });
    } else {
        // Something already playing — add to queue
        await push(ref(db, 'queue'), { videoId, title });
    }

    input.value = '';
    btn.textContent = "Add to Queue";
    btn.disabled = false;
});

// Allow Enter key to add to queue
document.getElementById('yt-link').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('queue-btn').click();
});

// ── GLOBAL CONTROLS ──
document.getElementById('public-play-pause').addEventListener('click', () => {
    if (!currentVideoData) return;
    const newState = currentVideoData.state === 'playing' ? 'paused' : 'playing';
    set(ref(db, 'nowPlaying'), { ...currentVideoData, state: newState });
});

document.getElementById('public-skip').addEventListener('click', () => {
    advanceQueue();
});

document.getElementById('public-stop').addEventListener('click', () => {
    remove(ref(db, 'nowPlaying'));
    remove(ref(db, 'queue'));
});

// ── VIDEO STATE APPLIER ──
function applyVideoState(data) {
    if (!ytPlayer || !audioUnlocked) return;

    const npTitle = document.getElementById('np-title');
    const ppBtn = document.getElementById('public-play-pause');

    if (data) {
        npTitle.textContent = data.title;

        if (currentlyLoadedVideoId !== data.videoId) {
            currentlyLoadedVideoId = data.videoId;
            ytPlayer.loadVideoById(data.videoId);
            // loadVideoById starts playing automatically — we'll pause below if needed
        }

        if (data.state === 'playing') {
            ytPlayer.playVideo();
            ppBtn.textContent = '⏸ Pause';
            ppBtn.classList.remove('paused');
        } else {
            ytPlayer.pauseVideo();
            ppBtn.textContent = '▶ Resume';
            ppBtn.classList.add('paused');
        }
    } else {
        // Nothing playing
        npTitle.textContent = 'Silence...';
        ppBtn.textContent = '⏸ Pause';
        ppBtn.classList.remove('paused');
        currentlyLoadedVideoId = null;
        ytPlayer.stopVideo();
    }
}

// ── FIREBASE REAL-TIME LISTENERS ──
onValue(ref(db, 'nowPlaying'), (snapshot) => {
    const data = snapshot.val();
    currentVideoData = data;

    if (audioUnlocked) {
        applyVideoState(data);
    } else {
        // Store it — we'll apply it once user hits "Connect Audio"
        pendingVideoData = data;
        // Still update the title on the (hidden) page
        if (data) document.getElementById('np-title').textContent = data.title;
    }
});

onValue(ref(db, 'queue'), (snapshot) => {
    const list = document.getElementById('queue-list');
    list.innerHTML = '';

    if (!snapshot.exists()) {
        list.innerHTML = '<li class="q-empty">Queue is empty</li>';
        return;
    }

    let i = 1;
    snapshot.forEach((child) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="q-num">${i}.</span>
            <span class="q-title">${child.val().title}</span>
        `;
        list.appendChild(li);
        i++;
    });
});
