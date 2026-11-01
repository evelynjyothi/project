class ConnectionManager:

    def __init__(self):
        # {room_code: {player_id: websocket}}
        self.active_connections = {}

    async def connect(self, room_code, player_id, websocket):

        await websocket.accept()

        if room_code not in self.active_connections:
            self.active_connections[room_code] = {}

        self.active_connections[room_code][player_id] = websocket

    def disconnect(self, room_code, player_id):

        if room_code in self.active_connections:

            self.active_connections[room_code].pop(
                player_id, None
            )

            if not self.active_connections[room_code]:
                del self.active_connections[room_code]

    async def broadcast(self, room_code, message):

        connections = self.active_connections.get(
            room_code, {}
        )

        disconnected_players = []

        for player_id, websocket in list(connections.items()):

            try:
                await websocket.send_json(message)

            except Exception:
                disconnected_players.append(player_id)

        for player_id in disconnected_players:
            self.disconnect(room_code, player_id)

    async def send_to_player(self, room_code, player_id, message):

        websocket = self.active_connections.get(room_code, {}).get(player_id)

        if websocket is None:
            return False

        try:
            await websocket.send_json(message)
            return True

        except Exception:
            self.disconnect(room_code, player_id)
            return False


# Create one shared connection manager
manager = ConnectionManager()