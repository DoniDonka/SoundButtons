import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, get, child, push } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

let currentVideoData = null;

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
        return data.title || "Unknown Title";
    } catch {
        return "Unknown Title";
    }
}

function showError(msg) {
    const el = document.getElementById('error-msg');
    if (el) el.textContent = msg;
}

// ── AUTH STATE ──
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('control-panel').style.display = 'flex';
        document.getElementById('control-panel').style.flexDirection = 'column';
        document.getElementById('control-panel').style.gap = '20px';
    } else {
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('control-panel').style.display = 'none';
    }
});

// ── LOGIN ──
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    showError('');

    if (!email || !password) {
        showError('Please enter your email and password.');
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
        showError(err.message);
    }
});

// Allow Enter key on password field
document.getElementById('password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
});

// ── LOGOUT ──
document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth);
});

// ── PLAYBACK CONTROLS ──
document.getElementById('stop-all-btn').onclick = () => {
    remove(ref(db, 'nowPlaying'));
};

document.getElementById('clear-queue-btn').onclick = () => {
    if (confirm('Clear the entire queue?')) remove(ref(db, 'queue'));
};

document.getElementById('pause-btn').onclick = () => {
    if (currentVideoData) {
        set(ref(db, 'nowPlaying'), { ...currentVideoData, state: 'paused' });
    }
};

document.getElementById('resume-btn').onclick = () => {
    if (currentVideoData) {
        set(ref(db, 'nowPlaying'), { ...currentVideoData, state: 'playing' });
    }
};

document.getElementById('play-next-btn').onclick = () => {
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
};

// ── EMERGENCY OVERRIDE ──
document.getElementById('override-btn').onclick = async () => {
    const link = document.getElementById('override-link').value.trim();
    const videoId = extractVideoID(link);

    if (!videoId) {
        alert("Invalid YouTube link.");
        return;
    }

    const btn = document.getElementById('override-btn');
    btn.textContent = "Loading...";
    btn.disabled = true;

    const title = await getYouTubeTitle(videoId);
    await set(ref(db, 'nowPlaying'), { videoId, title, state: 'playing' });

    document.getElementById('override-link').value = '';
    btn.textContent = "▶ Play Now";
    btn.disabled = false;
};

document.getElementById('override-link').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('override-btn').click();
});

// ── REAL-TIME LISTENERS ──
onValue(ref(db, 'nowPlaying'), (snapshot) => {
    currentVideoData = snapshot.val();
    const np = document.getElementById('admin-np');
    if (np) {
        np.textContent = currentVideoData ? currentVideoData.title : 'Nothing playing';
    }
});

onValue(ref(db, 'queue'), (snapshot) => {
    const list = document.getElementById('admin-queue-list');
    if (!list) return;
    list.innerHTML = '';

    if (!snapshot.exists()) {
        list.innerHTML = '<li class="q-empty">Queue is empty</li>';
        return;
    }

    snapshot.forEach((childSnapshot) => {
        const li = document.createElement('li');

        const title = document.createElement('span');
        title.className = 'q-title';
        title.textContent = childSnapshot.val().title;

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Remove';
        delBtn.className = 'del-btn';
        delBtn.onclick = () => remove(ref(db, `queue/${childSnapshot.key}`));

        li.appendChild(title);
        li.appendChild(delBtn);
        list.appendChild(li);
    });
});
