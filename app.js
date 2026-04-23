import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// YOUR FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyAfCititqgz6H03Bg3W4bZbTDp4v-WpH6Y",
    authDomain: "soundbuttons-36b5c.firebaseapp.com",
    databaseURL: "https://soundbuttons-36b5c-default-rtdb.firebaseio.com",
    projectId: "soundbuttons-36b5c",
    storageBucket: "soundbuttons-36b5c.firebasestorage.app",
    messagingSenderId: "666242287540",
    appId: "1:666242287540:web:1677f3ae27b2210e7e14e1"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let ytPlayer;
let isAudioEnabled = false;

// UI & Theming Logic
const themeSelector = document.getElementById('theme-selector');
themeSelector.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
    localStorage.setItem('savedTheme', e.target.value);
});

// Load saved theme
const savedTheme = localStorage.getItem('savedTheme');
if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeSelector.value = savedTheme;
}

// Modal Logic
document.getElementById('open-settings').addEventListener('click', () => document.getElementById('settings-modal').classList.add('active'));
document.getElementById('close-settings').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('active'));

window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('player', { height: '1', width: '1', videoId: '', playerVars: { 'autoplay': 1, 'controls': 0 } });
};

function extractVideoID(url) {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

async function getYouTubeTitle(videoId) {
    try {
        const res = await fetch(`https://noembed.com/embed?dataType=json&url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await res.json();
        return data.title || "Unknown Signal";
    } catch (e) { return "Unknown Signal"; }
}

document.getElementById('join-btn').addEventListener('click', () => {
    isAudioEnabled = true;
    document.getElementById('join-modal').classList.remove('active');
    if (ytPlayer) ytPlayer.playVideo();
});

document.getElementById('queue-btn').addEventListener('click', async () => {
    const link = document.getElementById('yt-link').value;
    const videoId = extractVideoID(link);
    const btn = document.getElementById('queue-btn');

    if (videoId) {
        btn.innerText = "Processing..."; btn.disabled = true;
        const title = await getYouTubeTitle(videoId);
        push(ref(db, 'queue'), { videoId: videoId, title: title });

        document.getElementById('yt-link').value = '';
        btn.innerText = "Transmit ⚡"; btn.disabled = false;
    } else {
        alert("Invalid Signal URL!");
    }
});

// Real-time Display Logic
onValue(ref(db, 'nowPlaying'), (snapshot) => {
    const data = snapshot.val();
    const npTitle = document.getElementById('np-title');
    const statusBox = document.getElementById('status-box');

    if (data && isAudioEnabled && ytPlayer) {
        npTitle.innerText = data.title;
        statusBox.classList.add('is-playing');
        if (data.state === 'playing') ytPlayer.loadVideoById(data.videoId);
        else if (data.state === 'paused') ytPlayer.pauseVideo();
    } else if (!data) {
        npTitle.innerText = "Awaiting Input...";
        statusBox.classList.remove('is-playing');
        if (ytPlayer) ytPlayer.stopVideo();
    }
});

onValue(ref(db, 'queue'), (snapshot) => {
    const queueList = document.getElementById('queue-list');
    queueList.innerHTML = '';
    snapshot.forEach((child) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${child.val().title}</span> <span style="color: var(--text-muted); font-size: 0.8rem;">[QUEUED]</span>`;
        queueList.appendChild(li);
    });
});