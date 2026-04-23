import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, set, get, child, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// YOUR CONFIG
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

let ytPlayer;
let audioUnlocked = false;
let currentVideoData = null;

// The trick: Load a tiny, real video (Me at the zoo) silently to unlock the audio context
window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('player', {
        height: '200',
        width: '200',
        videoId: 'jNQXAC9IVRw',
        playerVars: { 'autoplay': 0, 'controls': 0, 'disablekb': 1 },
    });
};

// URL Parser
function extractVideoID(url) {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Title Fetcher
async function getYouTubeTitle(videoId) {
    try {
        const response = await fetch(`https://noembed.com/embed?dataType=json&url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await response.json();
        return data.title || "Unknown Audio";
    } catch (e) { return "Unknown Audio"; }
}

// THE AUDIO UNLOCKER
document.getElementById('join-btn').addEventListener('click', () => {
    if (ytPlayer && ytPlayer.playVideo) {
        ytPlayer.unMute();
        ytPlayer.setVolume(100);
        ytPlayer.playVideo(); // Force play

        // Pause it 500ms later so they don't actually hear "Me at the zoo"
        setTimeout(() => {
            ytPlayer.pauseVideo();
            audioUnlocked = true;
            document.getElementById('join-screen').style.opacity = '0';
            setTimeout(() => document.getElementById('join-screen').style.display = 'none', 300);
        }, 500);
    } else {
        alert("YouTube API is still loading or is blocked by your network/firewall.");
    }
});

// ADD TO QUEUE
document.getElementById('queue-btn').addEventListener('click', async () => {
    const link = document.getElementById('yt-link').value;
    const videoId = extractVideoID(link);
    const btn = document.getElementById('queue-btn');

    if (videoId) {
        btn.innerText = "Loading...";
        const title = await getYouTubeTitle(videoId);

        // If nothing is playing, play immediately instead of queuing
        get(child(ref(db), 'nowPlaying')).then((snapshot) => {
            if (!snapshot.exists()) {
                set(ref(db, 'nowPlaying'), { videoId: videoId, title: title, state: 'playing' });
            } else {
                push(ref(db, 'queue'), { videoId: videoId, title: title });
            }
        });

        document.getElementById('yt-link').value = '';
        btn.innerText = "Add to Queue";
    } else {
        alert("Invalid YouTube Link!");
    }
});

// --- GLOBAL CONTROLS FOR ALL USERS ---

document.getElementById('public-play-pause').addEventListener('click', () => {
    if (currentVideoData) {
        const newState = currentVideoData.state === 'playing' ? 'paused' : 'playing';
        set(ref(db, 'nowPlaying'), { ...currentVideoData, state: newState });
    }
});

document.getElementById('public-stop').addEventListener('click', () => {
    remove(ref(db, 'nowPlaying'));
});

document.getElementById('public-skip').addEventListener('click', () => {
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
});

// --- REAL-TIME SYNC LOGIC ---

let currentlyLoadedVideoId = null;

onValue(ref(db, 'nowPlaying'), (snapshot) => {
    const data = snapshot.val();
    currentVideoData = data;
    const npTitle = document.getElementById('np-title');
    const ppBtn = document.getElementById('public-play-pause');

    if (data && audioUnlocked) {
        npTitle.innerText = data.title;

        // Load new video only if it changed
        if (currentlyLoadedVideoId !== data.videoId) {
            currentlyLoadedVideoId = data.videoId;
            ytPlayer.loadVideoById(data.videoId);
        }

        // Handle State Sync
        if (data.state === 'playing') {
            ytPlayer.playVideo();
            ppBtn.innerText = '⏸️ Pause Global';
            ppBtn.classList.remove('active-pause');
        } else {
            ytPlayer.pauseVideo();
            ppBtn.innerText = '▶️ Global Paused';
            ppBtn.classList.add('active-pause');
        }

    } else if (!data) {
        npTitle.innerText = "Silence...";
        ppBtn.innerText = '⏸️ Pause Global';
        currentlyLoadedVideoId = null;
        if (ytPlayer && audioUnlocked) ytPlayer.stopVideo();
    }
});

onValue(ref(db, 'queue'), (snapshot) => {
    const queueList = document.getElementById('queue-list');
    queueList.innerHTML = '';

    if (!snapshot.exists()) {
        queueList.innerHTML = '<li style="justify-content: center; color: #555;">The queue is currently empty.</li>';
        return;
    }

    let index = 1;
    snapshot.forEach((childSnapshot) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="q-number">${index}.</span> <span class="q-title">${childSnapshot.val().title}</span>`;
        queueList.appendChild(li);
        index++;
    });
});