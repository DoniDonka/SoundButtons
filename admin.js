import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, get, child } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
const auth = getAuth(app);

// Authentication
document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('control-panel').style.display = 'block';
        })
        .catch((error) => alert(error.message));
});

// Helper Function for Titles
async function getYouTubeTitle(videoId) {
    try {
        const response = await fetch(`https://noembed.com/embed?dataType=json&url=https://www.youtube.com/watch?v=${videoId}`);
        const data = await response.json();
        return data.title || "Unknown Title";
    } catch (e) { return "Unknown Title"; }
}

function extractVideoID(url) {
    const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Global Controls
document.getElementById('stop-all-btn').onclick = () => remove(ref(db, 'nowPlaying'));
document.getElementById('clear-queue-btn').onclick = () => remove(ref(db, 'queue'));

let currentVideoData = null;

// Track what is currently playing for Pause/Resume logic
onValue(ref(db, 'nowPlaying'), (snapshot) => {
    currentVideoData = snapshot.val();
    document.getElementById('admin-np').innerText = currentVideoData ? currentVideoData.title : "None";
});

document.getElementById('pause-btn').onclick = () => {
    if(currentVideoData) set(ref(db, 'nowPlaying'), { ...currentVideoData, state: 'paused' });
};

document.getElementById('resume-btn').onclick = () => {
    if(currentVideoData) set(ref(db, 'nowPlaying'), { ...currentVideoData, state: 'playing' });
};

// Play Next Button
document.getElementById('play-next-btn').onclick = () => {
    get(child(ref(db), 'queue')).then((snapshot) => {
        if (snapshot.exists()) {
            const queueData = snapshot.val();
            const firstKey = Object.keys(queueData)[0]; 
            const nextItem = queueData[firstKey];
            
            set(ref(db, 'nowPlaying'), { videoId: nextItem.videoId, title: nextItem.title, state: 'playing' });
            remove(ref(db, `queue/${firstKey}`));
        } else {
            alert("Queue is empty!");
            remove(ref(db, 'nowPlaying'));
        }
    });
};

// Instant Override Button
document.getElementById('override-btn').onclick = async () => {
    const link = document.getElementById('override-link').value;
    const videoId = extractVideoID(link);
    if (videoId) {
        const title = await getYouTubeTitle(videoId);
        set(ref(db, 'nowPlaying'), { videoId: videoId, title: title, state: 'playing' });
        document.getElementById('override-link').value = '';
    } else {
        alert("Invalid Link");
    }
};

// Advanced Queue Management
onValue(ref(db, 'queue'), (snapshot) => {
    const queueList = document.getElementById('admin-queue-list');
    queueList.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
        const li = document.createElement('li');
        li.innerText = childSnapshot.val().title;
        
        const delBtn = document.createElement('button');
        delBtn.innerText = "X";
        delBtn.className = "danger";
        delBtn.style.padding = "5px 10px";
        delBtn.onclick = () => remove(ref(db, `queue/${childSnapshot.key}`));
        
        li.appendChild(delBtn);
        queueList.appendChild(li);
    });
});