import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, get, child } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Your exact Firebase configuration
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

// Admin Login
document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('control-panel').style.display = 'block';
            alert("Admin Access Granted.");
        })
        .catch((error) => alert(error.message));
});

// Stop All Sounds
document.getElementById('stop-all-btn').addEventListener('click', () => {
    remove(ref(db, 'nowPlaying'));
});

// Clear Queue
document.getElementById('clear-queue-btn').addEventListener('click', () => {
    remove(ref(db, 'queue'));
});

// Play Next In Queue
document.getElementById('play-next-btn').addEventListener('click', () => {
    get(child(ref(db), 'queue')).then((snapshot) => {
        if (snapshot.exists()) {
            const queueData = snapshot.val();
            const firstKey = Object.keys(queueData)[0]; 
            const nextVideoId = queueData[firstKey].videoId;

            set(ref(db, 'nowPlaying'), { videoId: nextVideoId });
            remove(ref(db, `queue/${firstKey}`));
        } else {
            alert("Queue is empty!");
        }
    });
});

// Display Queue with Delete Buttons
onValue(ref(db, 'queue'), (snapshot) => {
    const queueList = document.getElementById('admin-queue-list');
    queueList.innerHTML = '';
    snapshot.forEach((childSnapshot) => {
        const li = document.createElement('li');
        li.innerText = `Video ID: ${childSnapshot.val().videoId} `;
        
        const delBtn = document.createElement('button');
        delBtn.innerText = "Delete";
        delBtn.onclick = () => remove(ref(db, `queue/${childSnapshot.key}`));
        
        li.appendChild(delBtn);
        queueList.appendChild(li);
    });
});
