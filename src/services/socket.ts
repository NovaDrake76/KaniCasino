import { io, Socket } from "socket.io-client";

class SocketConnection {
    private static instance: Socket;

    private constructor() {
        // Private constructor to prevent instantiation from outside
    }

    public static getInstance(): Socket {
        if (!SocketConnection.instance) {
            SocketConnection.instance = io(import.meta.env.VITE_BASE_URL);
        }

        return SocketConnection.instance;
    }
}

export default SocketConnection;
