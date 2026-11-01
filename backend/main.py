from pathlib import Path

from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    HTTPException
)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.game_manager import (
    create_room,
    join_room,
    get_room_state,
    get_player,
    set_player_connection,
    start_game,
    get_player_game_info,
    add_chat_message,
    start_voting,
    cast_vote,
    has_player_voted,
    start_next_round
)

from backend.websocket_manager import manager


app = FastAPI(title="Secret Imposter")


# Frontend directory
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


app.mount(
    "/static",
    StaticFiles(directory=FRONTEND_DIR),
    name="static"
)


# Request models
class CreateRoomRequest(BaseModel):
    username: str


class JoinRoomRequest(BaseModel):
    username: str
    room_code: str


def validate_username(username):

    username = username.strip()

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Username cannot be empty."
        )

    if len(username) > 20:
        raise HTTPException(
            status_code=400,
            detail="Username must be 20 characters or fewer."
        )

    return username


# Home page
@app.get("/")
async def home():

    return FileResponse(
        FRONTEND_DIR / "index.html"
    )


# Health check
@app.get("/health")
async def health_check():

    return {
        "status": "success",
        "message": "Secret Imposter backend is running!"
    }


# Create room
@app.post("/api/rooms/create")
async def create_game(request: CreateRoomRequest):

    username = validate_username(request.username)

    room_code, player_id = create_room(username)

    return {
        "message": "Room created successfully!",
        "room_code": room_code,
        "player_id": player_id,
        "room": get_room_state(room_code)
    }


# Join room
@app.post("/api/rooms/join")
async def join_game(request: JoinRoomRequest):

    username = validate_username(request.username)

    room_code = request.room_code.strip().upper()

    try:

        player_id = join_room(
            room_code,
            username
        )

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    return {
        "message": "Joined room successfully!",
        "room_code": room_code,
        "player_id": player_id,
        "room": get_room_state(room_code)
    }


# WebSocket connection
@app.websocket("/ws/{room_code}/{player_id}")
async def room_websocket(
    websocket: WebSocket,
    room_code: str,
    player_id: str
):

    room_code = room_code.upper()

    player = get_player(room_code, player_id)

    if not player:
        await websocket.close(code=1008)
        return

    await manager.connect(
        room_code,
        player_id,
        websocket
    )

    set_player_connection(
        room_code,
        player_id,
        True
    )

    # Notify everyone that a player is connected
    await manager.broadcast(
        room_code,
        {
            "type": "room_update",
            "room": get_room_state(room_code)
        }
    )

    game_info = get_player_game_info(room_code, player_id)
    if game_info:
        await manager.send_to_player(
            room_code,
            player_id,
            {"type": "private_role", **game_info}
        )
    if has_player_voted(room_code, player_id):
        await manager.send_to_player(
            room_code,
            player_id,
            {"type": "vote_received"}
        )

    try:

        while True:

            message = await websocket.receive_json()

            if not isinstance(message, dict):
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid message."
                })
                continue

            action = message.get("type")
            try:
                if action == "start_game":
                    start_game(room_code, player_id)
                elif action == "chat_message":
                    chat_message = add_chat_message(
                        room_code,
                        player_id,
                        message.get("text", "")
                        if isinstance(message.get("text"), str)
                        else ""
                    )
                    await manager.broadcast(
                        room_code,
                        {"type": "chat_message", "message": chat_message}
                    )
                    continue
                elif action == "start_voting":
                    start_voting(room_code, player_id)
                elif action == "play_again":
                    start_next_round(room_code, player_id)
                elif action == "vote":
                    cast_vote(room_code, player_id, message.get("target_id"))
                    await manager.send_to_player(
                        room_code,
                        player_id,
                        {"type": "vote_received"}
                    )
                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Unknown game action."
                    })
                    continue
            except ValueError as error:
                await websocket.send_json({
                    "type": "error",
                    "message": str(error)
                })
                continue

            await manager.broadcast(
                room_code,
                {
                    "type": "room_update",
                    "room": get_room_state(room_code)
                }
            )

            if action in ("start_game", "play_again"):
                await manager.broadcast(
                    room_code,
                    {"type": "game_started"}
                )
                room = get_room_state(room_code)
                for room_player in room["players"]:
                    game_info = get_player_game_info(
                        room_code,
                        room_player["player_id"]
                    )
                    if game_info:
                        await manager.send_to_player(
                            room_code,
                            room_player["player_id"],
                            {"type": "private_role", **game_info}
                        )

    except WebSocketDisconnect:

        manager.disconnect(
            room_code,
            player_id
        )

        set_player_connection(
            room_code,
            player_id,
            False
        )

        # Notify remaining players
        await manager.broadcast(
            room_code,
            {
                "type": "room_update",
                "room": get_room_state(room_code)
            }
        )