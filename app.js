// We added set, get, child, and remove to the imports so regular users can control the player
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

let ytPlayer;
let isAudioEnabled = false;
let currentVideoId = null;
let currentVideoData = null; // Store this globally for the play/pause button

window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('player', {
        height: '1', width: '1', videoId: '',
        playerVars: { 'autoplay': 1, 'controls': 0 },
    });
};

function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

async function getYouTubeTitle(videoId) {
    try {
        const response = await fetch(`https://noembed.com/embed?dataType=json&url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await response.json();
        return data.title || "Unknown Audio Track";
    } catch (e) {
        return "Unknown Audio Track";
    }
}

// Enable Audio
document.getElementById('join-btn').addEventListener('click', () => {
    isAudioEnabled = true;
    document.getElementById('join-screen').style.display = 'none';
    if (ytPlayer && currentVideoId) ytPlayer.playVideo();
});

// Local Volume Control
document.getElementById('vol-slider').addEventListener('input', (e) => {
    if (ytPlayer) ytPlayer.setVolume(e.target.value);
});

// Queue Button
document.getElementById('queue-btn').addEventListener('click', async () => {
    const link = document.getElementById('yt-link').value;
    const videoId = extractVideoID(link);
    const btn = document.getElementById('queue-btn');

    if (videoId) {
        btn.innerText = "Loading...";
        btn.disabled = true;

        const title = await getYouTubeTitle(videoId);
        push(ref(db, 'queue'), { videoId: videoId, title: title });

        document.getElementById('yt-link').value = '';
        btn.innerText = "Queue Audio";
        btn.disabled = false;
    } else {
        alert("Please enter a valid YouTube URL.");
    }
});

// --- NEW PUBLIC CONTROLS LOGIC ---

// Play/Pause Toggle for regular users
document.getElementById('user-play-pause-btn').addEventListener('click', () => {
    if (currentVideoData) {
        const newState = currentVideoData.state === 'playing' ? 'paused' : 'playing';
        set(ref(db, 'nowPlaying'), { ...currentVideoData, state: newState });
    }
});

// Skip Next for regular users
document.getElementById('user-skip-btn').addEventListener('click', () => {
    get(child(ref(db), 'queue')).then((snapshot) => {
        if (snapshot.exists()) {
            const queueData = snapshot.val();
            const firstKey = Object.keys(queueData)[0];
            const nextItem = queueData[firstKey];

            // Push next song to nowPlaying
            set(ref(db, 'nowPlaying'), { videoId: nextItem.videoId, title: nextItem.title, state: 'playing' });
            // Remove it from the queue
            remove(ref(db, `queue/${firstKey}`));
        } else {
            // If queue is empty, stop the music
            remove(ref(db, 'nowPlaying'));
        }
    });
});


// --- SYNC LOGIC ---

// Sync Now Playing (Fixed the restart bug!)
onValue(ref(db, 'nowPlaying'), (snapshot) => {
    const data = snapshot.val();
    currentVideoData = data;
    const npTitle = document.getElementById('np-title');
    const ppBtn = document.getElementById('user-play-pause-btn');

    if (data && isAudioEnabled && ytPlayer) {
        npTitle.innerText = data.title;

        // Update the button text
        ppBtn.innerText = data.state === 'paused' ? '▶️ Play' : '⏸️ Pause';

        // Only load a new video if the ID actually changed
        if (currentVideoId !== data.videoId) {
            currentVideoId = data.videoId;
            ytPlayer.loadVideoById(data.videoId);
        }

        // Handle Play/Pause without restarting the song
        if (data.state === 'playing') {
            ytPlayer.playVideo();
        } else if (data.state === 'paused') {
            ytPlayer.pauseVideo();
        }

    } else if (!data) {
        npTitle.innerText = "Waiting for audio...";
        ppBtn.innerText = '⏸️ Pause';
        currentVideoId = null;
        if (ytPlayer) ytPlayer.stopVideo();
    }
});

// Sync Queue UI
onValue(ref(db, 'queue'), (snapshot) => {
    const queueList = document.getElementById('queue-list');
    queueList.innerHTML = '';

    if (!snapshot.exists()) {
        queueList.innerHTML = '<li style="color: #666; justify-content: center;">Queue is empty</li>';
        return;
    }

    snapshot.forEach((childSnapshot) => {
        const li = document.createElement('li');
        li.innerText = childSnapshot.val().title;
        queueList.appendChild(li);
    });
});