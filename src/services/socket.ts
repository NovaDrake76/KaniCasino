import { io, Socket } from "socket.io-client";

class SocketConnection {
    private static instance: Socket;

    private constructor() {
        // Private constructor to prevent instantiation from outside
    }

    public static getInstance(): Socket {
        if (!SocketConnection.instance) {
            SocketConnection.instance = io(import.meta.env.VITE_BASE_URL, {
                // the token is re-read on every (re)connection so the handshake
                // always carries the current session
                auth: (cb) => cb({ token: localStorage.getItem("accessToken") || "" }),
            });
        }

        return SocketConnection.instance;
    }
}

export default SocketConnection;
