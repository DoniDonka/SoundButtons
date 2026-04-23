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

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────
let ytPlayer = null;
let playerReady = false;
let audioUnlocked = false;
let currentVideoData = null;
let currentlyLoadedVideoId = null;
let pendingVideoData = null;
let delayTimer = null;
let delaySeconds = 0;
let delayEndTime = null;
let delayCountdownInterval = null;
let selectedDelaySeconds = 60; // default

// ─────────────────────────────────────────
// YOUTUBE PLAYER
// ─────────────────────────────────────────
window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('player', {
        height: '1',
        width: '1',
        // Silent placeholder: a real YouTube video the browser "sees" as audio
        // This is what tricks Edge/Chrome into showing the media bar
        videoId: 'jNQXAC9IVRw',
        playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            mute: 0,
        },
        events: {
            onReady: () => {
                playerReady = true;
                console.log('[YT] Player ready');
            },
            onStateChange: (event) => {
                // YT.PlayerState.ENDED = 0
                if (event.data === 0) {
                    advanceQueue();
                }
            },
            onError: (event) => {
                console.warn('[YT] Player error:', event.data);
                // Try to advance queue on error too
                advanceQueue();
            }
        }
    });
};

// ─────────────────────────────────────────
// AUDIO UNLOCK — THE KEY FIX
// The browser requires a synchronous user gesture to unlock audio.
// We play the placeholder video immediately on click (no setTimeout),
// then once it's playing we swap to the real queued video.
// ─────────────────────────────────────────
document.getElementById('join-btn').addEventListener('click', () => {
    const overlay = document.getElementById('join-screen');

    const dismissOverlay = () => {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 400);
    };

    audioUnlocked = true;

    if (playerReady && ytPlayer) {
        // Play immediately — this is the gesture that unlocks the audio context
        ytPlayer.unMute();
        ytPlayer.setVolume(100);
        ytPlayer.playVideo();

        // Register with Media Session API so Edge shows "Now Playing" bar
        updateMediaSession('Soundboard Supreme', 'Ready');

        dismissOverlay();

        // If something was already queued in Firebase while overlay was up, load it
        if (pendingVideoData) {
            const pd = pendingVideoData;
            pendingVideoData = null;
            // Small timeout to let the play() call settle before we swap videos
            setTimeout(() => applyVideoState(pd), 300);
        } else {
            // Nothing queued yet — stop the placeholder silently
            setTimeout(() => ytPlayer.stopVideo(), 300);
        }
    } else {
        // Player not ready yet — dismiss anyway, audio will work when player loads
        dismissOverlay();
        if (pendingVideoData) {
            pendingVideoData = null;
        }
    }
});

// ─────────────────────────────────────────
// MEDIA SESSION API
// This is what makes Edge (and Chrome) show the "Now Playing" bar
// ─────────────────────────────────────────
function updateMediaSession(title, artist = 'Soundboard Supreme') {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title,
            artist: artist,
            artwork: [{ src: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg', sizes: '480x360', type: 'image/jpeg' }]
        });

        navigator.mediaSession.setActionHandler('play', () => {
            if (currentVideoData) set(ref(db, 'nowPlaying'), { ...currentVideoData, state: 'playing' });
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            if (currentVideoData) set(ref(db, 'nowPlaying'), { ...currentVideoData, state: 'paused' });
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => advanceQueue());
        navigator.mediaSession.setActionHandler('stop', () => remove(ref(db, 'nowPlaying')));
    }
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function extractVideoID(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]{11})/);
    return match ? match[1] : null;
}

async function getYouTubeTitle(videoId) {
    try {
        const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await res.json();
        return data.title || 'Unknown Audio';
    } catch {
        return 'Unknown Audio';
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

// ─────────────────────────────────────────
// ADD TO QUEUE
// ─────────────────────────────────────────
document.getElementById('queue-btn').addEventListener('click', async () => {
    const input = document.getElementById('yt-link');
    const btn = document.getElementById('queue-btn');
    const videoId = extractVideoID(input.value.trim());

    if (!videoId) {
        input.style.borderColor = '#ff4757';
        setTimeout(() => { input.style.borderColor = ''; }, 1500);
        return;
    }

    btn.textContent = 'Loading...';
    btn.disabled = true;

    const title = await getYouTubeTitle(videoId);
    const snapshot = await get(child(ref(db), 'nowPlaying'));

    if (!snapshot.exists()) {
        await set(ref(db, 'nowPlaying'), { videoId, title, state: 'playing' });
    } else {
        await push(ref(db, 'queue'), { videoId, title });
    }

    input.value = '';
    btn.textContent = 'Add to Queue';
    btn.disabled = false;
});

document.getElementById('yt-link').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('queue-btn').click();
});

// ─────────────────────────────────────────
// PLAYBACK CONTROLS
// ─────────────────────────────────────────

// PLAY — if nothing is playing and there's something in queue, start it
document.getElementById('btn-play').addEventListener('click', () => {
    if (currentVideoData) {
        // Something exists but might be paused — resume it
        set(ref(db, 'nowPlaying'), { ...currentVideoData, state: 'playing' });
    } else {
        // Nothing playing — pull from queue
        advanceQueue();
    }
});

// PAUSE
document.getElementById('btn-pause').addEventListener('click', () => {
    if (currentVideoData) {
        set(ref(db, 'nowPlaying'), { ...currentVideoData, state: 'paused' });
    }
});

// RESUME
document.getElementById('btn-resume').addEventListener('click', () => {
    if (currentVideoData) {
        set(ref(db, 'nowPlaying'), { ...currentVideoData, state: 'playing' });
    }
});

// SKIP
document.getElementById('btn-skip').addEventListener('click', () => {
    advanceQueue();
});

// STOP — clears now playing but keeps queue
document.getElementById('btn-stop').addEventListener('click', () => {
    remove(ref(db, 'nowPlaying'));
});

// ─────────────────────────────────────────
// DELAY SYSTEM
// ─────────────────────────────────────────
const delayModal = document.getElementById('delay-modal');
const delayCountdownEl = document.getElementById('delay-countdown');
const delayBtn = document.getElementById('btn-delay');

document.getElementById('btn-delay').addEventListener('click', () => {
    if (delayTimer) {
        // Cancel active delay
        clearTimeout(delayTimer);
        clearInterval(delayCountdownInterval);
        delayTimer = null;
        delayBtn.textContent = '⏱ Delay';
        delayBtn.classList.remove('active');
        delayCountdownEl.style.display = 'none';
        return;
    }
    delayModal.classList.add('open');
});

// Preset buttons
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedDelaySeconds = parseInt(btn.dataset.seconds);
        document.getElementById('custom-delay-input').value = '';
        document.querySelectorAll('.preset-btn').forEach(b => b.style.borderColor = '');
        btn.style.borderColor = 'var(--accent)';
        btn.style.color = 'var(--accent)';
    });
});

document.getElementById('delay-cancel').addEventListener('click', () => {
    delayModal.classList.remove('open');
});

document.getElementById('delay-confirm').addEventListener('click', () => {
    const customVal = parseInt(document.getElementById('custom-delay-input').value);
    const seconds = !isNaN(customVal) && customVal > 0 ? customVal : selectedDelaySeconds;

    delayModal.classList.remove('open');
    startDelay(seconds);
});

function startDelay(seconds) {
    // Pause whatever is playing
    if (currentVideoData) {
        set(ref(db, 'nowPlaying'), { ...currentVideoData, state: 'paused' });
    }

    delayEndTime = Date.now() + seconds * 1000;
    delayBtn.textContent = '⏱ Cancel Delay';
    delayBtn.classList.add('active');
    delayCountdownEl.style.display = 'block';

    // Countdown display
    const tick = () => {
        const remaining = Math.max(0, Math.ceil((delayEndTime - Date.now()) / 1000));
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        delayCountdownEl.textContent = `▶ Playing in ${mins > 0 ? mins + 'm ' : ''}${secs}s...`;
    };
    tick();
    delayCountdownInterval = setInterval(tick, 500);

    delayTimer = setTimeout(() => {
        clearInterval(delayCountdownInterval);
        delayTimer = null;
        delayBtn.textContent = '⏱ Delay';
        delayBtn.classList.remove('active');
        delayCountdownEl.style.display = 'none';

        // Resume / advance
        if (currentVideoData) {
            set(ref(db, 'nowPlaying'), { ...currentVideoData, state: 'playing' });
        } else {
            advanceQueue();
        }
    }, seconds * 1000);
}

// ─────────────────────────────────────────
// APPLY VIDEO STATE TO PLAYER
// ─────────────────────────────────────────
function applyVideoState(data) {
    if (!ytPlayer || !audioUnlocked) {
        pendingVideoData = data;
        return;
    }

    const npTitle = document.getElementById('np-title');

    if (data) {
        npTitle.textContent = data.title;
        updateMediaSession(data.title);

        if (currentlyLoadedVideoId !== data.videoId) {
            currentlyLoadedVideoId = data.videoId;
            // cueVideoById loads the video WITHOUT auto-playing
            // then we manually play/pause based on state
            ytPlayer.cueVideoById(data.videoId);
        }

        if (data.state === 'playing') {
            ytPlayer.playVideo();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        } else {
            ytPlayer.pauseVideo();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        }
    } else {
        npTitle.textContent = 'Silence...';
        currentlyLoadedVideoId = null;
        ytPlayer.stopVideo();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    }
}

// ─────────────────────────────────────────
// FIREBASE LISTENERS
// ─────────────────────────────────────────
onValue(ref(db, 'nowPlaying'), (snapshot) => {
    const data = snapshot.val();
    currentVideoData = data;

    // Always update the title display
    const npTitle = document.getElementById('np-title');
    if (data) npTitle.textContent = data.title;
    else npTitle.textContent = 'Silence...';

    if (audioUnlocked) {
        applyVideoState(data);
    } else {
        pendingVideoData = data;
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
    snapshot.forEach((childSnap) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="q-num">${i}.</span>
            <span class="q-title">${childSnap.val().title}</span>
        `;
        list.appendChild(li);
        i++;
    });
});
