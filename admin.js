// js/admin.js

// TODO: Replace with your actual Firebase project configuration (same as main.js)
const firebaseConfig = {
  apiKey: "AIzaSyAfCititqgz6H03Bg3W4bZbTDp4v-WpH6Y",
  authDomain: "soundbuttons-36b5c.firebaseapp.com",
  projectId: "soundbuttons-36b5c",
  storageBucket: "soundbuttons-36b5c.firebasestorage.app",
  messagingSenderId: "666242287540",
  appId: "1:666242287540:web:1677f3ae27b2210e7e14e1",
  measurementId: "G-M89D5FH56N"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// UI Elements
const loginSection = document.getElementById('loginSection');
const adminControls = document.getElementById('adminControls');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const adminQueueList = document.getElementById('adminQueueList');

// Auth State Listener
auth.onAuthStateChanged(user => {
    if (user) {
        // User is signed in
        loginSection.style.display = 'none';
        adminControls.style.display = 'block';
        listenToAdminQueue();
    } else {
        // User is signed out
        loginSection.style.display = 'block';
        adminControls.style.display = 'none';
    }
});

// Login Logic
loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            console.log("Logged in successfully");
        })
        .catch(error => {
            alert("Error: " + error.message);
        });
});

// Admin Controls Logic
document.getElementById('pauseBtn').addEventListener('click', () => {
    db.collection("state").doc("playback").set({ status: 'paused' }, { merge: true });
});

document.getElementById('playBtn').addEventListener('click', () => {
    db.collection("state").doc("playback").set({ status: 'playing' }, { merge: true });
});

document.getElementById('stopBtn').addEventListener('click', () => {
    db.collection("state").doc("playback").set({ status: 'stopped', videoId: '' }, { merge: true });
});

document.getElementById('skipBtn').addEventListener('click', async () => {
    // Logic to get the next item from the queue, play it, and remove it from the queue
    const snapshot = await db.collection("queue").orderBy("timestamp").limit(1).get();
    
    if (!snapshot.empty) {
        const nextVideoDoc = snapshot.docs[0];
        const nextVideoData = nextVideoDoc.data();
        
        // Set new video to play
        await db.collection("state").doc("playback").set({
            videoId: nextVideoData.videoId,
            status: 'playing'
        });
        
        // Remove from queue
        await db.collection("queue").doc(nextVideoDoc.id).delete();
    } else {
        console.log("Queue is empty");
        db.collection("state").doc("playback").set({ status: 'stopped', videoId: '' });
    }
});

// Listen to Queue for Admin
function listenToAdminQueue() {
    db.collection("queue").orderBy("timestamp").onSnapshot((snapshot) => {
        adminQueueList.innerHTML = ''; // Clear current list
        snapshot.forEach((doc) => {
            const item = doc.data();
            const li = document.createElement('li');
            li.textContent = item.url;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Force Remove';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => {
                db.collection("queue").doc(doc.id).delete();
            };
            
            li.appendChild(deleteBtn);
            adminQueueList.appendChild(li);
        });
    });
}
