const homeScreen = document.getElementById("homeScreen");
const lobbyScreen = document.getElementById("lobbyScreen");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");

const playerDialog = document.getElementById("playerDialog");
const playerForm = document.getElementById("playerForm");

const dialogTitle = document.getElementById("dialogTitle");
const dialogDescription = document.getElementById("dialogDescription");

const usernameInput = document.getElementById("username");
const roomCodeInput = document.getElementById("roomCode");

const roomCodeGroup = document.getElementById("roomCodeGroup");
const formError = document.getElementById("formError");

const playerList = document.getElementById("playerList");
const playerCount = document.getElementById("playerCount");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");

const submitBtn = document.getElementById("submitBtn");

let currentMode = null;
let currentRoomCode = null;
let currentPlayerId = null;
let socket = null;


// Show create game dialog

createBtn.addEventListener("click", () => {

    currentMode = "create";

    dialogTitle.textContent = "Create Game";

    dialogDescription.textContent =
        "Enter your username to create a new room.";

    roomCodeGroup.hidden = true;
    roomCodeInput.required = false;

    submitBtn.textContent = "Create Room";

    formError.textContent = "";

    playerForm.reset();

    playerDialog.showModal();

});


// Show join game dialog

joinBtn.addEventListener("click", () => {

    currentMode = "join";

    dialogTitle.textContent = "Join Game";

    dialogDescription.textContent =
        "Enter your username and the room code.";

    roomCodeGroup.hidden = false;
    roomCodeInput.required = true;

    submitBtn.textContent = "Join Room";

    formError.textContent = "";

    playerForm.reset();

    playerDialog.showModal();

});


// Close dialog

document.getElementById("closeDialog").addEventListener(
    "click",
    () => playerDialog.close()
);


// Join code formatting

roomCodeInput.addEventListener("input", () => {

    roomCodeInput.value = roomCodeInput.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

});


// Handle form submission

playerForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const username = usernameInput.value.trim();

    if (!username) {
        formError.textContent = "Please enter a username.";
        return;
    }

    submitBtn.disabled = true;
    formError.textContent = "";

    try {

        let endpoint;
        let payload;

        if (currentMode === "create") {

            endpoint = "/api/rooms/create";

            payload = {
                username: username
            };

        } else {

            endpoint = "/api/rooms/join";

            payload = {
                username: username,
                room_code: roomCodeInput.value.trim()
            };

        }


        const response = await fetch(endpoint, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)

        });


        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Something went wrong.");
        }


        // Successfully created or joined

        currentRoomCode = data.room_code;
        currentPlayerId = data.player_id;

        playerDialog.close();

        enterLobby(data.room);

    } catch (error) {

        formError.textContent = error.message;

    } finally {

        submitBtn.disabled = false;

    }

});


// Enter the waiting lobby

function enterLobby(room) {

    homeScreen.hidden = true;
    lobbyScreen.hidden = false;

    roomCodeDisplay.textContent = currentRoomCode;

    renderPlayers(room);

    connectWebSocket();

}


// Establish WebSocket connection

function connectWebSocket() {

    const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";

    const wsURL =
        `${protocol}//${window.location.host}/ws/${currentRoomCode}/${currentPlayerId}`;

    socket = new WebSocket(wsURL);


    socket.onopen = () => {

        console.log("Connected to game room:", currentRoomCode);

        socket.send("connected");

    };


    socket.onmessage = (event) => {

        const data = JSON.parse(event.data);

        console.log("WebSocket update:", data);

        if (data.type === "room_update") {

            renderPlayers(data.room);

        }

    };


    socket.onerror = (error) => {

        console.error("WebSocket error:", error);

    };


    socket.onclose = () => {

        console.log("Disconnected from room.");

    };

}


// Display all players

function renderPlayers(room) {

    playerList.innerHTML = "";

    playerCount.textContent =
        `${room.player_count} / ${room.maximum_players}`;


    room.players.forEach((player, index) => {

        const card = document.createElement("div");

        card.className = "player-card";


        const avatar = document.createElement("div");

        avatar.className = "player-avatar";

        avatar.textContent = ["👤", "🕵️", "🎭", "😎"][index % 4];


        const details = document.createElement("div");

        details.className = "player-details";


        const name = document.createElement("strong");

        name.textContent = player.username;


        const info = document.createElement("small");

        info.textContent = player.is_host ? "Host" : "Player";

        if (player.is_host) {
            info.className = "host-label";
        }


        const status = document.createElement("small");

        status.textContent = player.connected
            ? " ● Online"
            : " ○ Connecting / Offline";


        details.appendChild(name);
        details.appendChild(info);
        details.appendChild(status);

        card.appendChild(avatar);
        card.appendChild(details);

        playerList.appendChild(card);

    });

}


// Copy room code

document.getElementById("copyCodeBtn").addEventListener(
    "click",
    async () => {

        try {

            await navigator.clipboard.writeText(currentRoomCode);

            const button = document.getElementById("copyCodeBtn");

            button.textContent = "Copied!";

            setTimeout(() => {
                button.textContent = "Copy";
            }, 1500);

        } catch (error) {

            alert("Unable to copy. Please copy the room code manually.");

        }

    }
);


// Back to home

document.getElementById("leaveBtn").addEventListener(
    "click",
    () => {

        if (socket) {
            socket.close();
            socket = null;
        }

        currentRoomCode = null;
        currentPlayerId = null;

        lobbyScreen.hidden = true;
        homeScreen.hidden = false;

    }
);