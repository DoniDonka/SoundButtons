// js/main.js

// TODO: Replace with your actual Firebase project configuration
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
    if (event.data == YT.PlayerState.ENDED) {
        console.log("Video ended, checking for next in queue...");
        playNextInQueue();
    }
}

async function playNextInQueue() {
    // Use a basic lock so multiple clients don't trigger the same queue item delete simultaneously
    // For a simple app, we'll just query the first item and try to play it.
    const snapshot = await db.collection("queue").orderBy("timestamp").limit(1).get();
    
    if (!snapshot.empty) {
        const nextVideoDoc = snapshot.docs[0];
        const nextVideoData = nextVideoDoc.data();
        
        await db.collection("state").doc("playback").set({
            videoId: nextVideoData.videoId,
            status: 'playing'
        });
        
        await db.collection("queue").doc(nextVideoDoc.id).delete();
    } else {
        db.collection("state").doc("playback").set({ status: 'stopped', videoId: '' });
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
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = item.title || item.url;
            li.appendChild(titleSpan);
            
            const btnContainer = document.createElement('div');
            
            const playBtn = document.createElement('button');
            playBtn.textContent = 'Play';
            playBtn.style.backgroundColor = '#28a745'; // Green for play
            playBtn.onclick = async () => {
                // Play this immediately and remove it from the queue
                await db.collection("state").doc("playback").set({
                    videoId: item.videoId,
                    status: 'playing'
                });
                db.collection("queue").doc(doc.id).delete();
            };
            
            // Allow basic users to delete from queue
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Remove';
            deleteBtn.className = 'delete-btn';
            deleteBtn.onclick = () => {
                db.collection("queue").doc(doc.id).delete();
            };
            
            btnContainer.appendChild(playBtn);
            btnContainer.appendChild(deleteBtn);
            li.appendChild(btnContainer);
            queueList.appendChild(li);
        });
    });
}


// UI Event Listeners
document.getElementById('queueBtn').addEventListener('click', async () => {
    const linkInput = document.getElementById('youtubeLink');
    const url = linkInput.value.trim();
    if (url) {
        const videoId = extractVideoId(url);
        if (videoId) {
            // Attempt to get the video title
            let title = url;
            try {
                const response = await fetch(`https://noembed.com/embed?url=${url}`);
                const data = await response.json();
                if (data.title) {
                    title = data.title;
                }
            } catch (e) {
                console.error("Could not fetch title", e);
            }

            db.collection("queue").add({
                videoId: videoId,
                url: url,
                title: title,
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

document.getElementById('playNowBtn').addEventListener('click', async () => {
    const linkInput = document.getElementById('youtubeLink');
    const url = linkInput.value.trim();
    if (url) {
        const videoId = extractVideoId(url);
        if (videoId) {
            db.collection("state").doc("playback").set({
                videoId: videoId,
                status: 'playing'
            }).then(() => {
                linkInput.value = '';
            });
        } else {
            alert("Invalid YouTube URL");
        }
    } else {
        // If input is empty, just send a play command to resume current video
        db.collection("state").doc("playback").set({ status: 'playing' }, { merge: true });
    }
});

document.getElementById('stopMainBtn').addEventListener('click', () => {
    db.collection("state").doc("playback").set({ status: 'stopped', videoId: '' }, { merge: true });
});

// Helper Function
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}
