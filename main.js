// js/main.js

// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// YouTube IFrame API Setup
let player;
let isPlayerReady = false;

// Load the IFrame Player API code asynchronously.
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// This function creates an <iframe> (and YouTube player) after the API code downloads.
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '390',
        width: '640',
        videoId: '', // Start empty
        playerVars: {
            'playsinline': 1,
            'autoplay': 1, // Attempt to autoplay
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    isPlayerReady = true;
    console.log("Player is ready");
    // Start listening to Firebase now that the player is ready
    listenToPlaybackState();
    listenToQueue();
}

function onPlayerStateChange(event) {
    // Optional: handle events like ending a video to trigger the next in queue (mostly an admin task, but can be done here)
    if (event.data == YT.PlayerState.ENDED) {
        // We could move to next video if this client is allowed, but better to let Admin handle it or do it globally via Cloud Functions.
        // For simple setup, let's just let the first client that sees it end move the queue if needed, or leave it to admin.
        console.log("Video ended");
    }
}


// Firebase Listeners
function listenToPlaybackState() {
    db.collection("state").doc("playback").onSnapshot((doc) => {
        if (doc.exists && isPlayerReady) {
            const data = doc.data();
            
            // Sync Video ID
            if (data.videoId && data.videoId !== '') {
                // Check if it's a new video or just a state change
                const currentVideoUrl = player.getVideoUrl();
                const isDifferentVideo = currentVideoUrl.indexOf(data.videoId) === -1;
                
                if (isDifferentVideo) {
                    player.loadVideoById(data.videoId);
                }
            } else {
                player.stopVideo();
            }

            // Sync Play/Pause state
            if (data.status === 'playing') {
                player.playVideo();
            } else if (data.status === 'paused') {
                player.pauseVideo();
            } else if (data.status === 'stopped') {
                player.stopVideo();
            }
        }
    });
}

function listenToQueue() {
    const queueList = document.getElementById('queueList');
    
    db.collection("queue").orderBy("timestamp").onSnapshot((snapshot) => {
        queueList.innerHTML = ''; // Clear current list
        snapshot.forEach((doc) => {
            const item = doc.data();
            const li = document.createElement('li');
            li.textContent = item.url; // Or fetch and show title
            
            // Allow basic users to delete from queue
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Remove';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => {
                db.collection("queue").doc(doc.id).delete();
            };
            
            li.appendChild(deleteBtn);
            queueList.appendChild(li);
        });
    });
}


// UI Event Listeners
document.getElementById('queueBtn').addEventListener('click', () => {
    const linkInput = document.getElementById('youtubeLink');
    const url = linkInput.value.trim();
    if (url) {
        const videoId = extractVideoId(url);
        if (videoId) {
            db.collection("queue").add({
                videoId: videoId,
                url: url,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                linkInput.value = ''; // clear input
                console.log("Added to queue");
            }).catch(err => console.error("Error adding to queue: ", err));
        } else {
            alert("Invalid YouTube URL");
        }
    }
});

document.getElementById('delayBtn').addEventListener('click', () => {
    // Custom logic for delay. e.g., delaying the current video play by a few seconds.
    console.log("Delay button clicked - implement specific delay logic if needed.");
    alert("Delay feature placeholder.");
});

// Helper Function
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}
