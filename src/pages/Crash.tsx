import { useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

const CoinFlip = () => {
  useEffect(() => {
    socket.on("crash:start", () => {
      console.log("Crash game started");
    });

    socket.on("crash:crash", (result) => {
      console.log("Crash result:", result);
    });

    return () => {
      // Clean up listeners when the component is unmounted
      socket.off("crash:start");
      socket.off("crash:crash");
    };
  }, []);

  // Render the CoinFlip component here
  return <div>{/* Coin Flip game UI goes here */}</div>;
};

export default CoinFlip;
