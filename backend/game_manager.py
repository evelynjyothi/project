import secrets
import string
import uuid


# Stores all active game rooms
rooms = {}

MAX_PLAYERS = 8
MIN_PLAYERS = 3
WORDS = (
    "airport",
    "beach",
    "bicycle",
    "chocolate",
    "dinosaur",
    "firefighter",
    "guitar",
    "hospital",
    "library",
    "mountain",
    "pancake",
    "spaceship",
    "telescope",
    "waterfall",
)


def generate_room_code():
    """Generate a unique four-character room code."""

    characters = string.ascii_uppercase + string.digits

    while True:
        code = "".join(
            secrets.choice(characters) for _ in range(4)
        )

        if code not in rooms:
            return code


def create_room(username):
    """Create a new room and register its host."""

    room_code = generate_room_code()

    player_id = str(uuid.uuid4())

    player = {
        "player_id": player_id,
        "username": username,
        "is_host": True,
        "connected": False
    }

    rooms[room_code] = {
        "room_code": room_code,
        "status": "waiting",
        "host_id": player_id,
        "players": [player],
        "game": None
    }

    return room_code, player_id


def join_room(room_code, username):
    """Allow a player to join an existing room."""

    room_code = room_code.upper()

    if room_code not in rooms:
        raise ValueError("Room does not exist.")

    room = rooms[room_code]

    if room["status"] != "waiting":
        raise ValueError("This game has already started.")

    if len(room["players"]) >= MAX_PLAYERS:
        raise ValueError("Room is full. Maximum 8 players allowed.")

    # Prevent duplicate usernames in the same room
    for player in room["players"]:
        if player["username"].casefold() == username.casefold():
            raise ValueError("This username is already taken.")

    player_id = str(uuid.uuid4())

    player = {
        "player_id": player_id,
        "username": username,
        "is_host": False,
        "connected": False
    }

    room["players"].append(player)

    return player_id


def get_player(room_code, player_id):
    """Find a player inside a room."""

    room = rooms.get(room_code)

    if not room:
        return None

    for player in room["players"]:
        if player["player_id"] == player_id:
            return player

    return None


def get_room_state(room_code):
    """Return room information safe to share with players."""

    room = rooms.get(room_code)

    if not room:
        return None

    return {
        "room_code": room["room_code"],
        "status": room["status"],
        "host_id": room["host_id"],
        "player_count": len(room["players"]),
        "minimum_players": MIN_PLAYERS,
        "maximum_players": MAX_PLAYERS,
        "game_phase": room["game"]["phase"] if room["game"] else None,
        "chat_messages": room["game"]["chat_messages"] if room["game"] else [],
        "votes_cast": len(room["game"]["votes"]) if room["game"] else 0,
        "vote_result": room["game"].get("vote_result") if room["game"] else None,
        "players": [
            {
                "player_id": player["player_id"],
                "username": player["username"],
                "is_host": player["is_host"],
                "connected": player["connected"]
            }
            for player in room["players"]
        ]
    }


def set_player_connection(room_code, player_id, connected):
    """Update a player's connection status."""

    player = get_player(room_code, player_id)

    if player:
        player["connected"] = connected

        return True

    return False


def start_game(room_code, player_id):
    """Start a waiting room and privately assign roles."""

    room = rooms.get(room_code.upper())

    if not room:
        raise ValueError("Room does not exist.")

    if room["host_id"] != player_id:
        raise ValueError("Only the host can start the game.")

    if room["status"] != "waiting":
        raise ValueError("This game has already started.")

    if len(room["players"]) < MIN_PLAYERS:
        raise ValueError(f"At least {MIN_PLAYERS} players are required to start.")

    room["status"] = "started"
    room["game"] = {
        "imposter_id": secrets.choice(room["players"])["player_id"],
        "word": secrets.choice(WORDS),
        "phase": "clues",
        "chat_messages": [],
        "votes": {},
        "vote_result": None,
    }


def add_chat_message(room_code, player_id, text):
    """Add a validated discussion message to a game room."""

    room = rooms.get(room_code.upper())
    if not room or room["status"] != "started" or not room["game"]:
        raise ValueError("The game has not started.")

    if room["game"]["phase"] != "clues":
        raise ValueError("Chat is closed while players are voting.")

    player = get_player(room_code, player_id)
    if not player:
        raise ValueError("Player is not in this room.")

    text = text.strip()
    if not text:
        raise ValueError("Message cannot be empty.")
    if len(text) > 500:
        raise ValueError("Message must be 500 characters or fewer.")

    message = {
        "username": player["username"],
        "text": text,
    }
    room["game"]["chat_messages"].append(message)
    room["game"]["chat_messages"] = room["game"]["chat_messages"][-100:]
    return message


def start_voting(room_code, player_id):
    """Move a game from clue discussion into its voting phase."""

    room = rooms.get(room_code.upper())
    if not room or room["status"] != "started" or not room["game"]:
        raise ValueError("The game has not started.")

    if room["host_id"] != player_id:
        raise ValueError("Only the host can start voting.")

    if room["game"]["phase"] != "clues":
        raise ValueError("Voting has already started.")

    room["game"]["phase"] = "voting"


def start_next_round(room_code, player_id):
    """Start a fresh round in a finished game using the same players."""

    room = rooms.get(room_code.upper())
    if not room or room["status"] != "started" or not room["game"]:
        raise ValueError("There is no finished game to replay.")

    if room["host_id"] != player_id:
        raise ValueError("Only the host can start another round.")

    if room["game"]["phase"] != "results":
        raise ValueError("Finish voting before starting another round.")

    if len(room["players"]) < MIN_PLAYERS:
        raise ValueError(f"At least {MIN_PLAYERS} players are required to start.")

    room["game"] = {
        "imposter_id": secrets.choice(room["players"])["player_id"],
        "word": secrets.choice(WORDS),
        "phase": "clues",
        "chat_messages": [],
        "votes": {},
        "vote_result": None,
    }


def has_player_voted(room_code, player_id):
    room = rooms.get(room_code.upper())
    return bool(
        room
        and room["game"]
        and player_id in room["game"]["votes"]
    )


def cast_vote(room_code, player_id, target_id):
    """Record one private vote and finish when every player has voted."""

    room = rooms.get(room_code.upper())
    if not room or room["status"] != "started" or not room["game"]:
        raise ValueError("The game has not started.")

    if room["game"]["phase"] != "voting":
        raise ValueError("Voting is not open.")

    if not get_player(room_code, player_id):
        raise ValueError("Player is not in this room.")

    if player_id in room["game"]["votes"]:
        raise ValueError("You have already voted.")

    if target_id == player_id or not get_player(room_code, target_id):
        raise ValueError("Choose another player in this room.")

    room["game"]["votes"][player_id] = target_id

    if len(room["game"]["votes"]) == len(room["players"]):
        counts = {player["player_id"]: 0 for player in room["players"]}
        for voted_player_id in room["game"]["votes"].values():
            counts[voted_player_id] += 1

        highest_count = max(counts.values())
        most_voted_ids = [
            voted_player_id
            for voted_player_id, count in counts.items()
            if count == highest_count
        ]
        players_by_id = {
            player["player_id"]: player for player in room["players"]
        }
        imposter_id = room["game"]["imposter_id"]
        room["game"]["phase"] = "results"
        room["game"]["vote_result"] = {
            "imposter_username": players_by_id[imposter_id]["username"],
            "most_voted": [
                players_by_id[voted_player_id]["username"]
                for voted_player_id in most_voted_ids
            ],
            "vote_counts": [
                {
                    "username": players_by_id[voted_player_id]["username"],
                    "votes": count,
                }
                for voted_player_id, count in counts.items()
            ],
            "imposter_caught": (
                len(most_voted_ids) == 1 and most_voted_ids[0] == imposter_id
            ),
            "tie": len(most_voted_ids) > 1,
        }

    return len(room["game"]["votes"])


def get_player_game_info(room_code, player_id):
    """Return only the requesting player's private role and word."""

    room = rooms.get(room_code.upper())

    if not room or room["status"] != "started" or not room["game"]:
        return None

    if not get_player(room_code, player_id):
        return None

    is_imposter = room["game"]["imposter_id"] == player_id
    return {
        "role": "imposter" if is_imposter else "player",
        "word": None if is_imposter else room["game"]["word"],
    }