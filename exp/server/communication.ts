import * as types from "./types";
import * as utils from "./serverUtils"
import {WebSocket} from "ws";

export async function sendMessage(
  connection: import("ws").WebSocket,
  message: string,
  maxRetries: number = 10,
  retryDelay: number = 100,
): Promise<boolean> {
  let attempt = 0;
  let sent = false
  while ((attempt < maxRetries) || (sent == false)) {
    try {
      // Wrap the send operation in a promise
      await new Promise<void>((resolve, reject) => {
        connection.send(message);
      });
      // If send is successful, return true
      return true;
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        // If maximum attempts reached, reject the promise
        throw new Error(
          `Failed to send message after ${maxRetries} attempts: ${error}`,
        );
      }
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  // This line will never be reached due to the throw in the catch block
  return false;
}
export async function sendState(
  state: types.State,
  playerID: "player1" | "player2",
  connection: types.connection, 
  stage: string,
  block: string,
) {
  /*
  Sends the state to both players. On the client side both players are P1, so if the ws matches P1 it will send the state to the player.
  If it matches P2 it will switch the state to so P2 appears as P1 and then sends that transformed state.
  */
 const socket =  connection[playerID]
 let message: string
 if (!socket) throw new Error(`No Connection for ${playerID}`)
  if (playerID === "player1") {
    message = JSON.stringify({
      stage: stage,
      block: block,
      type: "state",
      data: state,
    });
    await sendMessage(socket, message);

  } else if (playerID === "player2") {
    let newState = structuredClone(state);
    newState.P1RDK = state.P2RDK;
    newState.P2RDK = state.P1RDK;
    message = JSON.stringify({
      stage: stage,
      block: block,
      type: "state",
      data: newState,
    });
    await sendMessage(socket, message);
  }

}

