import { useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

const CoinFlip = () => {
  useEffect(() => {
    socket.on("coinFlip:start", () => {
      console.log("Coin Flip game started");
    });

    socket.on("coinFlip:result", (result) => {
      console.log("Coin Flip result:", result);
    });

    return () => {
      // Clean up listeners when the component is unmounted
      socket.off("coinFlip:start");
      socket.off("coinFlip:result");
    };
  }, []);

  // Render the CoinFlip component here
  return <div>{/* Coin Flip game UI goes here */}</div>;
};

export default CoinFlip;
