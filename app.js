// We use these specific links so the browser can read them directly
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// Your exact Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAfCititqgz6H03Bg3W4bZbTDp4v-WpH6Y",
  authDomain: "soundbuttons-36b5c.firebaseapp.com",
  databaseURL: "https://soundbuttons-36b5c-default-rtdb.firebaseio.com", // Added this for Realtime Database
  projectId: "soundbuttons-36b5c",
  storageBucket: "soundbuttons-36b5c.firebasestorage.app",
  messagingSenderId: "666242287540",
  appId: "1:666242287540:web:1677f3ae27b2210e7e14e1",
  measurementId: "G-M89D5FH56N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let ytPlayer;
let isAudioEnabled = false;

// YouTube API Initialization
window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('player', {
        height: '1',
        width: '1',
        videoId: '',
        playerVars: { 'autoplay': 1, 'controls': 0 },
        events: { 'onReady': onPlayerReady }
    });
};

function onPlayerReady(event) {
    console.log("YouTube Player Ready");
}

// Extract Video ID from URL
function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Unlock Audio & Hide Join Screen
document.getElementById('join-btn').addEventListener('click', () => {
    isAudioEnabled = true;
    document.getElementById('join-screen').style.display = 'none';
    if(ytPlayer) ytPlayer.playVideo(); 
});

// Add to Queue
document.getElementById('queue-btn').addEventListener('click', () => {
    const link = document.getElementById('yt-link').value;
    const videoId = extractVideoID(link);
    if (videoId) {
        push(ref(db, 'queue'), { videoId: videoId });
        document.getElementById('yt-link').value = '';
    } else {
        alert("Invalid YouTube Link!");
    }
});

// Listen to "Now Playing"
onValue(ref(db, 'nowPlaying'), (snapshot) => {
    const data = snapshot.val();
    if (data && isAudioEnabled && ytPlayer) {
        ytPlayer.loadVideoById(data.videoId);
    } else if (!data && ytPlayer) {
        ytPlayer.stopVideo();
    }
});

// Display Queue
onValue(ref(db, 'queue'), (snapshot) => {
    const queueList = document.getElementById('queue-list');
    queueList.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
        const li = document.createElement('li');
        li.innerText = `Video ID: ${childSnapshot.val().videoId}`;
        queueList.appendChild(li);
    });
});
