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
const lobbyTitle = document.getElementById("lobbyTitle");
const lobbyDescription = document.getElementById("lobbyDescription");
const waitingMessage = document.getElementById("waitingMessage");
const minimumInfo = document.getElementById("minimumInfo");
const startBtn = document.getElementById("startBtn");
const startError = document.getElementById("startError");
const gamePanel = document.getElementById("gamePanel");
const revealRoleBtn = document.getElementById("revealRoleBtn");
const roleDetails = document.getElementById("roleDetails");
const roleName = document.getElementById("roleName");
const secretWord = document.getElementById("secretWord");
const chatPanel = document.getElementById("chatPanel");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");
const phaseMessage = document.getElementById("phaseMessage");
const startVotingBtn = document.getElementById("startVotingBtn");
const votingPanel = document.getElementById("votingPanel");
const voteStatus = document.getElementById("voteStatus");
const voteOptions = document.getElementById("voteOptions");
const voteResult = document.getElementById("voteResult");
const voteResultTitle = document.getElementById("voteResultTitle");
const voteResultDetails = document.getElementById("voteResultDetails");
const voteTally = document.getElementById("voteTally");
const playAgainBtn = document.getElementById("playAgainBtn");
const playAgainMessage = document.getElementById("playAgainMessage");

const submitBtn = document.getElementById("submitBtn");

let currentMode = null;
let currentRoomCode = null;
let currentPlayerId = null;
let socket = null;
let currentRoom = null;
let currentRole = null;
let hasVoted = false;


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

    renderRoom(room);

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

        updateStartButton();

    };


    socket.onmessage = (event) => {

        const data = JSON.parse(event.data);

        console.log("WebSocket update:", data);

        if (data.type === "room_update") {

            renderRoom(data.room);

        } else if (data.type === "chat_message") {

            appendChatMessage(data.message);

        } else if (data.type === "private_role") {

            currentRole = data;
            hasVoted = false;
            roleDetails.hidden = true;
            revealRoleBtn.hidden = false;
            revealRoleBtn.textContent = "Reveal My Role";
            renderRoom(currentRoom);

        } else if (data.type === "game_started") {

            startError.textContent = "";
            currentRole = null;
            hasVoted = false;
            roleDetails.hidden = true;
            gamePanel.hidden = true;

        } else if (data.type === "error") {

            startError.textContent = data.message;

        } else if (data.type === "vote_received") {

            hasVoted = true;
            renderRoom(currentRoom);

        }

    };


    socket.onerror = (error) => {

        console.error("WebSocket error:", error);

    };


    socket.onclose = () => {

        console.log("Disconnected from room.");

    };

}

startBtn.addEventListener("click", () => {

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        startError.textContent = "Connecting to the room. Please try again in a moment.";
        return;
    }

    startError.textContent = "";
    socket.send(JSON.stringify({ type: "start_game" }));

});

chatForm.addEventListener("submit", (event) => {

    event.preventDefault();
    const text = chatInput.value.trim();

    if (!text || !socket || socket.readyState !== WebSocket.OPEN) {
        return;
    }

    socket.send(JSON.stringify({ type: "chat_message", text }));
    chatInput.value = "";

});

startVotingBtn.addEventListener("click", () => {

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        startError.textContent = "Connection lost. Reconnect before starting the vote.";
        return;
    }

    startError.textContent = "";
    socket.send(JSON.stringify({ type: "start_voting" }));

});

function sendVote(targetId) {

    if (!socket || socket.readyState !== WebSocket.OPEN || hasVoted) {
        return;
    }

    startError.textContent = "";
    socket.send(JSON.stringify({ type: "vote", target_id: targetId }));

}

playAgainBtn.addEventListener("click", () => {

    if (!socket || socket.readyState !== WebSocket.OPEN) {
        startError.textContent = "Connection lost. Reconnect before starting another round.";
        return;
    }

    startError.textContent = "";
    socket.send(JSON.stringify({ type: "play_again" }));

});

revealRoleBtn.addEventListener("click", () => {

    if (!currentRole) {
        return;
    }

    const isImposter = currentRole.role === "imposter";
    roleName.textContent = isImposter
        ? "You are the IMPOSTER."
        : "You are a player.";
    secretWord.textContent = isImposter
        ? "You do not have the secret word. Listen carefully and blend in."
        : `The secret word is: ${currentRole.word}`;
    roleDetails.hidden = false;
    revealRoleBtn.hidden = true;

});


// Display all players

function renderRoom(room) {

    currentRoom = room;

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

    const gameStarted = room.status === "started";
    const isHost = room.host_id === currentPlayerId;
    const phase = room.game_phase;

    lobbyTitle.textContent = !gameStarted
        ? "Waiting for Players"
        : phase === "voting"
            ? "Vote for the Imposter"
            : phase === "results"
                ? "Vote Results"
                : "Clue and Discussion";
    lobbyDescription.textContent = !gameStarted
        ? "Share your room code with friends so they can join."
        : phase === "voting"
            ? "Choose who you think the imposter is. Your vote stays private until everyone has voted."
            : phase === "results"
                ? "The votes are in. Check the tally below to see who was identified."
                : "Reveal your role privately, then share clues and discuss them in the room chat.";
    waitingMessage.hidden = gameStarted;
    minimumInfo.hidden = gameStarted;
    gamePanel.hidden = !gameStarted || !currentRole;
    startBtn.hidden = gameStarted || !isHost;
    startError.textContent = "";
    chatPanel.hidden = !gameStarted || phase !== "clues";
    chatInput.disabled = phase !== "clues";
    sendChatBtn.disabled = phase !== "clues";
    renderChatMessages(room.chat_messages || []);
    startVotingBtn.hidden = !gameStarted || phase !== "clues" || !isHost;
    votingPanel.hidden = !gameStarted || phase !== "voting";
    voteResult.hidden = !gameStarted || phase !== "results";
    playAgainBtn.hidden = !gameStarted || phase !== "results" || !isHost;
    playAgainMessage.textContent = phase === "results" && !isHost
        ? "The host can start another round for everyone."
        : "";

    if (phase === "clues") {
        phaseMessage.textContent = "Clue and discussion phase. Share your clues in the room chat.";
    } else if (phase === "voting") {
        phaseMessage.textContent = `Voting is open. ${room.votes_cast} of ${room.player_count} players have voted.`;
        renderVoteOptions(room);
    } else if (phase === "results") {
        phaseMessage.textContent = "The vote is complete.";
        renderVoteResult(room.vote_result);
    } else {
        phaseMessage.textContent = "";
    }

    updateStartButton();

}

function renderChatMessages(messages) {

    chatMessages.replaceChildren();
    messages.forEach(appendChatMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;

}

function appendChatMessage(message) {

    const entry = document.createElement("p");
    entry.className = "chat-entry";

    const sender = document.createElement("strong");
    sender.textContent = `${message.username}: `;

    const text = document.createElement("span");
    text.textContent = message.text;

    entry.append(sender, text);
    chatMessages.appendChild(entry);
    chatMessages.scrollTop = chatMessages.scrollHeight;

}

function renderVoteOptions(room) {

    voteOptions.replaceChildren();
    voteStatus.textContent = hasVoted
        ? "Your vote is locked in. Waiting for the other players..."
        : "Choose one player. Your choice stays private until everyone votes.";

    if (hasVoted) {
        return;
    }

    room.players
        .filter((player) => player.player_id !== currentPlayerId)
        .forEach((player) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "secondary-btn vote-btn";
            button.textContent = `Vote for ${player.username}`;
            button.addEventListener("click", () => sendVote(player.player_id));
            voteOptions.appendChild(button);
        });

}

function renderVoteResult(result) {

    if (!result) {
        return;
    }

    voteResultTitle.textContent = result.imposter_caught
        ? "The imposter was caught!"
        : result.tie
            ? "The vote ended in a tie."
            : "The group voted for the wrong player.";
    voteResultDetails.textContent = `The imposter was ${result.imposter_username}. Most votes: ${result.most_voted.join(", ")}.`;
    voteTally.replaceChildren();
    result.vote_counts.forEach((entry) => {
        const item = document.createElement("li");
        item.textContent = `${entry.username}: ${entry.votes} ${entry.votes === 1 ? "vote" : "votes"}`;
        voteTally.appendChild(item);
    });

}

function updateStartButton() {

    if (!currentRoom || currentRoom.status !== "waiting") {
        startBtn.disabled = true;
        return;
    }

    const enoughPlayers = currentRoom.player_count >= currentRoom.minimum_players;
    const connected = socket && socket.readyState === WebSocket.OPEN;

    startBtn.disabled = !enoughPlayers || !connected;
    startBtn.textContent = enoughPlayers
        ? (connected ? "Start Game" : "Connecting...")
        : `Need ${currentRoom.minimum_players} Players to Start`;

}


// Copy room code

async function copyToClipboard(text) {

    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();

    const copied = document.execCommand("copy");
    textArea.remove();

    if (!copied) {
        throw new Error("Clipboard access is unavailable.");
    }

}

document.getElementById("copyCodeBtn").addEventListener(
    "click",
    async () => {

        try {

            await copyToClipboard(currentRoomCode);

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

document.getElementById("copyInviteBtn").addEventListener(
    "click",
    async () => {

        const inviteURL = new URL(window.location.href);
        inviteURL.searchParams.set("room", currentRoomCode);

        try {

            await copyToClipboard(inviteURL.toString());

            const button = document.getElementById("copyInviteBtn");
            button.textContent = "Link Copied!";

            setTimeout(() => {
                button.textContent = "Copy Invite Link";
            }, 1500);

        } catch (error) {

            startError.textContent = "Unable to copy the invite link. Please copy the page address and room code.";

        }

    }
);

const invitedRoomCode = new URLSearchParams(window.location.search)
    .get("room");

if (invitedRoomCode) {
    joinBtn.click();
    roomCodeInput.value = invitedRoomCode
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4);
}


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
        currentRoom = null;
        currentRole = null;
        hasVoted = false;

        lobbyScreen.hidden = true;
        homeScreen.hidden = false;

    }
);