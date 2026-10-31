import secrets
import string
import uuid


# Stores all active game rooms
rooms = {}

MAX_PLAYERS = 8
MIN_PLAYERS = 3


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
        "players": [player]
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