import express from "express";
import fs from "node:fs";
import { WebSocketServer as WSServer } from "ws";
import { WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from 'url';
import * as utils from "./serverUtils";
import * as types from "./types";
import * as comms from "./communication"

/*

PATH TO EXP:
lukespirit.duckdns.org/lukespirit/
PATH TO DATA:
lukespirit.duckdns.org/data/
*/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let live = false;
const app = express();
const port = 3000;

// Remove CSP in development
app.use((req, res, next) => {
  if (!live) {
    // Don't set CSP in development
  }
  next();
});

// Serve static files from the 'client' directory (one level up from server folder)
app.use(express.static(path.join(__dirname, '../client')));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client', 'index.html'));
});

// Start the HTTP server
const server = app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});

// Set up the WebSocket server with the HTTP server
const wss = new WSServer({ server, path: "/coms" });

let connections: types.connection = {
  player1: null, 
  player2: null
}
const expValues = {
  trials: 60,
  trialLength: 60,
  coherence: [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9],
  directions: ["left", "right"],
  block: ["sep", "collab"],
  breakLength: 6,
  dataPath: "/data/",
  blockLength: 30,
  practiceTrials: 10,
  practiceLength1: 12,
  practiceLength2: 6,
  practiceBreak1: 12,
  practiceBreak2: 6,
  gameNoPath: "/data/gameNo.txt",
};
/*
REMEBER TO REMOVE OR CHANGE THIS
*/
const testConsts = {
  skipIntro: true,
};
/*
Base RDK is used to reset the state between trials and blocks.
*/
const baseRDK: types.rdk = {
  mostRecentChoice: "",
  choice: [],
  choiceTime: [0, 0, 0, 0, 0, 0, 0, 0],
  completed: [false, false, false, false, false, false, false, false],
  correct: [false, false, false, false, false, false, false, false],
  attempts: [0, 0, 0, 0, 0, 0, 0, 0],
  playerAttempts: [0, 0, 0, 0, 0, 0, 0, 0],
  player: [0, 0, 0, 0, 0, 0, 0, 0],
  coherence: expValues.coherence,
  direction: [],
  incorrectDirection: [[], [], [], [], [], [], [], []],
  completionTime: 0,
  reactionTime: [[], [], [], [], [], [], [], []],
  totalReactionTIme: [[], [], [], [], [], [], [], []],
  timeStamp: [0, 0, 0, 0, 0, 0, 0, 0],
};
let state: types.State = {
  startTime: "",
  endTime: "",
  gameNo: 0,
  stage: "waitingRoom",
  block: "sep",
  player1: {
    connectTime: "",
    id: "",
    age: 0,
    gender: "",
    consent: false,
    platform: "",
  },
  player2: {
    id: "",
    connectTime: "",
    age: 0,
    gender: "",
    consent: false,
    platform: "",
  },
  trialNo: 0,
  RDK: structuredClone(baseRDK),
  P1RDK: structuredClone(baseRDK),
  P2RDK: structuredClone(baseRDK),
};
let currentStage = {};
/*
Initialising variable we need ot track timestamps, arrays for data, and to control messaging for both players.
*/
let gameInProgress = false;
let usedIDS: Array<number> = [];
let dataArray: Array<types.State> = [];
let mouseArray: Array<any> = [];
let practiceTrialsDirections: Array<Array<string>> = [];
let trialsDirections: Array<Array<string>> = [];
let timeStamp = 0;
let trialTimeout: NodeJS.Timeout | null = null;
let breakTimeout: NodeJS.Timeout | null = null;
let blocks: Array<string> = [];
let trackingObject = {
  p1Ready: false,
  p2Ready: false,
  p1TrialReady: false,
  p2TrialReady: false,
  P1InstructionsFinished: false,
  P2InstructionsFinished: false,
  p1PracticeReady: false,
  p2PracticeReady: false,
  p1SkipReady: false,
  p2SkipReady: false,
  p1sepInstruction: false,
  p2sepInstruction: false,
  p1endPageReached: false,
  p2endPageReached: false,
};
let trackingObjectCopy = structuredClone(trackingObject);
let inactivityTimer: any;
let timeoutDuration = 30 * 1000;
/*
functions start below here
*/

function saveTrialData(state: types.State, block: string) {
  state.block = block;
  dataArray.push(state);
}

function chooseBlock(exp: string) {
  /*
  chooses the blocks for both practice and exp trials. this is called once and then the block is used for the rest of the trials.
  */
  if (exp === "exp") {
    let blockarray = ["sep", "collab"];
    let block = utils.randomChoice(blockarray);
    let blocks: Array<string> = [];
    if (block === "sep") {
      blocks = ["sep", "collab"];
    }
    if (block === "collab") {
      blocks = ["collab", "sep"];
    }
    return blocks;
  }
  if (exp === "collab") {
    let blocks: Array<string> = ["collab", "sep"];
    return blocks;
  }
  if (exp === "sep") {
    let blocks: Array<string> = ["sep", "collab"];
    return blocks;
  } else {
    return ["error"];
  }
}
function shuffle(arr: Array<any>) {
  let currentIndex = arr.length,
    randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [arr[currentIndex], arr[randomIndex]] = [
      arr[randomIndex],
      arr[currentIndex],
    ];
  }
  return arr;
}

async function chooseNewDirection(
  state: types.State,
  playerID: "player1" | "player2",
  index: any,
  stage: string,
  block: string,
) {
  /*
  Chooses a new direction for the RDK when the player makes an incorrect choice.
  It updates the state and sends the new direction to the player. In the collab condiiton
  it will send the new direction and updated state to both players.
  It randomly chooses the direction between "left" and "right"
  */
  switch (block) {
    case "collab":
      if (playerID === "player1") {
        let direction = utils.randomChoice(expValues.directions);
        state.P1RDK.direction[index] = direction;
        let message = JSON.stringify({
          stage: stage,
          block: block,
          type: "newDirection",
          data: direction,
          index: index,
        });
        await comms.sendMessage(connections.player1!, message);

        await comms.sendState(state, "player1", connections, stage, block);
        await comms.sendState(state, "player2", connections, stage, block);
      } else if (playerID === "player2") {
        let direction = utils.randomChoice(expValues.directions);
        state.P2RDK.direction[index] = direction;
        const message = JSON.stringify({
          stage: stage,
          block: block,
          type: "newDirection",
          data: direction,
          index: index,
        });
        await comms.sendMessage(connections.player2!, message);
        await comms.sendState(state, "player1", connections, stage, block);
        await comms.sendState(state, "player2", connections, stage, block);
      }
      break;
    case "sep":
      if (playerID === "player1") {
        let direction = utils.randomChoice(expValues.directions);
        state.P1RDK.direction[index] = direction;
        const message = JSON.stringify({
          stage: stage,
          block: block,
          type: "newDirection",
          data: direction,
          index: index,
        });
        await comms.sendMessage(connections.player1!, message);
        await comms.sendState(state, "player1", connections, stage, block);
      } else if (playerID === "player2") {
        let direction = utils.randomChoice(expValues.directions);
        state.P2RDK.direction[index] = direction;
        const message = JSON.stringify({
          stage: stage,
          block: block,
          type: "newDirection",
          data: direction,
          index: index,
        });
        await comms.sendMessage(connections.player2!, message);
        await comms.sendState(state, "player2", connections, stage, block);
      }
      break;
  }
}
// added change
async function beginGame(
  directions: Array<string>,
  state: types.State,
  stage: string,
  block: string,
) {
  /*
  Initialises the game. It sets the directions for the RDK and sends the state to the players.
  The directions are all preloaded, and selected based on the current trial number.
  */
  switch (block) {
    case "collab":
      state.RDK.direction = directions;
      const collabMessage = JSON.stringify({
        stage: stage,
        block: block,
        type: "initialState",
        data: state,
      });
      await Promise.all([
        comms.sendMessage(connections.player1!, collabMessage),
        comms.sendMessage(connections.player2!, collabMessage),
      ]);
      break;
    case "sep":
      state.RDK.direction = directions;
      state.P1RDK.direction = directions;
      state.P2RDK.direction = directions;
      const sepMessage = JSON.stringify({
        stage: stage,
        block: block,
        type: "initialState",
        data: state,
      });
      await Promise.all([
        comms.sendMessage(connections.player1!, sepMessage),
        comms.sendMessage(connections.player2!, sepMessage),
      ]);
  }
}
async function writeData(data: any, suffix: "A" | "B" | "C") {
  /*
    Function for writing the trial data to a file. File name will include the game number.
  */
  try {
    // Convert the data object to a JSON string
    const dataString = JSON.stringify(data, null, 2); // Indent JSON for readability

    // Define the filename and path using __dirname
    const platform = `${state.player1.platform}`;
    const dateString = returnDateString();
    const filename = `game${platform}${dateString}${suffix}.json`;
    const filePath = path.join(expValues.dataPath, filename);

    // Write the JSON string to a file
    fs.writeFileSync(filePath, dataString, "utf8");
  } catch (error) {
    // Handle errors (e.g., file system errors)
    console.error(`Failed to write data`, error);
  }
}
function returnDateString() {
  const now = new Date();

  // Get individual components
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are zero-based, so add 1
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const dateString = `${year}-${month}-${day}-${hours}:${minutes}:${seconds}`;
  return dateString;
}

function createTrials(state: types.State, blockType: string) {
  /*
  This creates the trials for the experiments, assigning directions for each
  coherence value for each trial. This is pushes to trialsDirectionArray
  which is then split into subarrays for each coherence value
  */
  if (blockType === "exp") {
    let trials = expValues.trials;
    let choices = expValues.directions;
    let coherences = expValues.coherence;
    let trialsDirectionArray = [];
    // Initialize an object to store trials

    for (let i = 0; i < trials; i++) {
      for (let j = 0; j < coherences.length; j++) {
        let direction = utils.randomChoice(choices);
        trialsDirectionArray.push(direction);
      }
    }
    let trialsDirections = utils.splitIntoSubarrays(
      trialsDirectionArray,
      coherences.length,
    );
    return trialsDirections;
  } else if (blockType === "practice") {
    let trials = 10;
    let choices = expValues.directions;
    let coherences = expValues.coherence;
    let trialsDirectionArray = [];
    // Initialize an object to store trials

    for (let i = 0; i < trials; i++) {
      for (let j = 0; j < coherences.length; j++) {
        let direction = utils.randomChoice(choices);
        trialsDirectionArray.push(direction);
      }
    }
    let trialsDirections = utils.splitIntoSubarrays(
      trialsDirectionArray,
      coherences.length,
    );
    return trialsDirections;
  } else {
    return [["error"]];
  }
}
function hasBeenSelected(state: types.State, data: any) {
  if (state.RDK.choice.includes(data)) {
    return true;
  } else {
    return false;
  }
}
async function handleRDKSelection(
  player: "player1" | "player2",
  data: any,
  rt: any,
  state: types.State,
  stage: string,
  block: string,
) {
  /*
  more or less handles selection of the RDK. It updates the state with the choice, the time of the choice, and the timestamp.
  Really only need to worry about checking selection in the collab condition, as the sep condition is handled in the checkResponse function.
  */
  switch (block) {
    case "collab":
      if (!hasBeenSelected(state, data)) {
        state.RDK.choice.push(data);
        if (player === "player1") {
          state.RDK.player[data] = 1;
          state.P1RDK.choice.push(data);
          state.P1RDK.mostRecentChoice = data;
          state.P1RDK.choiceTime[data] = rt;
          state.RDK.timeStamp[data] = utils.createTimestamp(timeStamp);
          state.P1RDK.timeStamp[data] = utils.createTimestamp(timeStamp);
          const loadMessage = JSON.stringify({
            stage: stage,
            type: "load",
            data: data,
          });
          const choiceMessage = JSON.stringify({
            stage: stage,
            type: "playerChoice",
            data: data,
          });
          await comms.sendMessage(connections.player2!, choiceMessage);
          await comms.sendMessage(connections.player1!, loadMessage);
          await Promise.all([
            comms.sendState(state, "player1", connections, stage, block),
            comms.sendState(state, "player2", connections, stage, block),
          ]);
        } else if (player === "player2") {
          state.RDK.player[data] = 2;
          state.P2RDK.choice.push(data);
          state.P2RDK.choiceTime[data] = rt;
          state.P2RDK.mostRecentChoice = data;
          state.RDK.timeStamp[data] = utils.createTimestamp(timeStamp);
          state.P2RDK.timeStamp[data] = utils.createTimestamp(timeStamp);
          const loadMessage = JSON.stringify({
            stage: stage,
            type: "load",
            data: data,
          });
          const choiceMessage = JSON.stringify({
            stage: stage,
            type: "playerChoice",
            data: data,
          });
          await comms.sendMessage(connections.player1!, choiceMessage);
          await comms.sendMessage(connections.player2!, loadMessage);
          await Promise.all([
            comms.sendState(state, "player1", connections, stage, block),
            comms.sendState(state, "player2", connections, stage, block),
          ]);
        }
      } else {
        if (player === "player1") {
          const message = JSON.stringify({
            stage: stage,
            block: block,
            type: "alreadySelected",
            data: data,
          });
          await comms.sendMessage(connections.player1!, message);
        } else if (player === "player2") {
          const message = JSON.stringify({
            stage: stage,
            block: block,
            type: "alreadySelected",
            data: data,
          });
          await comms.sendMessage(connections.player2!, message);
        }
      }
      break;
    case "sep":
      if (player === "player1") {
        state.P1RDK.choice.push(data);
        state.P1RDK.choiceTime[data] = rt;
        state.P1RDK.timeStamp[data] = utils.createTimestamp(timeStamp);
        state.P1RDK.mostRecentChoice = data;
        const message = JSON.stringify({
          stage: stage,
          type: "load",
          data: data,
        });
        await comms.sendMessage(connections.player1!, message);
        await comms.sendState(state, "player1", connections, stage, block);
      } else if (player === "player2") {
        state.P2RDK.choiceTime[data] = rt;
        state.P2RDK.choice.push(data);
        state.P2RDK.timeStamp[data] = utils.createTimestamp(timeStamp);
        state.P2RDK.mostRecentChoice = data;
        const message = JSON.stringify({
          stage: stage,
          type: "load",
          data: data,
        });
        await comms.sendMessage(connections.player2!, message);
        await comms.sendState(state, "player2", connections, stage, block);
      }
      break;
  }
}
function updateCollabStateOnResponse(
  state: types.State,
  player: "player1" | "player2",
  correct: boolean,
  id: any,
  rt: number,
  totalRt: number,
) {
  /*
  This is used to update the state of the RDK type when the player makes a response. if it is correct a bunch of things are updated,
  if incorrect it is mostly attempts, reaction time and the incorrect direction. This is used in the CHECKRESPONSE function.
  */

  if (correct == true) {
    if (player === "player1") {
      state.RDK.totalReactionTIme[id].push(totalRt);
      state.P1RDK.totalReactionTIme[id].push(totalRt);
      state.RDK.correct[id] = true;
      state.RDK.reactionTime[id].push(rt);
      state.P1RDK.reactionTime[id].push(rt);
      state.RDK.completed[id] = true;
      state.P1RDK.completed[id] = true;
      state.P1RDK.correct[id] = true;
      state.P1RDK.attempts[id] += 1;
      state.RDK.player[id] = 1;
    } else if (player === "player2") {
      state.RDK.totalReactionTIme[id].push(totalRt);
      state.P2RDK.totalReactionTIme[id].push(totalRt);
      state.P2RDK.reactionTime[id].push(rt);
      state.RDK.correct[id] = true;
      state.RDK.reactionTime[id].push(rt);
      state.RDK.completed[id] = true;
      state.P2RDK.completed[id] = true;
      state.P2RDK.correct[id] = true;
      state.P2RDK.attempts[id] += 1;
      state.RDK.player[id] = 2;
    }
  } else if (correct == false) {
    if (player === "player1") {
      state.P1RDK.attempts[id] += 1;
      state.P1RDK.reactionTime[id].push(rt);
      state.P1RDK.totalReactionTIme[id].push(totalRt);
      state.P1RDK.incorrectDirection[id].push(state.P1RDK.direction[id]);
    } else if (player === "player2") {
      state.P2RDK.attempts[id] += 1;
      state.P2RDK.reactionTime[id].push(rt);
      state.P2RDK.totalReactionTIme[id].push(totalRt);
      state.P2RDK.incorrectDirection[id].push(state.P2RDK.direction[id]);
    }
  }
}

async function checkResponse(
  player: "player1" | "player2",
  data: string,
  id: any,
  state: types.State,
  rt: number,
  totalRt: number,
  stage: string,
  block: string,
) {
  /*
  This function checks the response of the player. If the player has already made a response, it will not do anything. If the response does not match the most recently selected one,
  it also does nothing (this solves a bug i was having). If the response is correct, it updates the state and sends the new state to the players.
  The sep condition has everything update here as opposed to it's own function.

  */
  switch (block) {
    case "collab":
      if (player === "player1") {
        if (state.P1RDK.mostRecentChoice !== id) {
          break;
        } else {
          if (state.RDK.direction[id] === data) {
            const message = JSON.stringify({
              stage: stage,
              block: block,
              type: "completed",
              data: id,
            });
            await comms.sendMessage(connections.player1!, message);
            updateCollabStateOnResponse(
              state,
              "player1",
              true,
              id,
              rt,
              totalRt,
            );
            await comms.sendState(state, "player1", connections, stage, block);
            await comms.sendState(state, "player2", connections, stage, block);
          } else if (state.RDK.direction[id] !== data) {
            await chooseNewDirection(state, "player1", id, stage, block);
            updateCollabStateOnResponse(
              state,
              "player1",
              false,
              id,
              rt,
              totalRt,
            );
          }
        }
      } else if (player === "player2") {
        if (state.P2RDK.mostRecentChoice !== id) {
          break;
        } else {
          if (state.RDK.direction[id] === data) {
            const message = JSON.stringify({
              stage: stage,
              block: block,
              type: "completed",
              data: id,
            });
            await comms.sendMessage(connections.player2!, message);
            updateCollabStateOnResponse(
              state,
              "player2",
              true,
              id,
              rt,
              totalRt,
            );
            await comms.sendState(state, "player1", connections, stage, block);
            await comms.sendState(state, "player2", connections, stage, block);
          } else if (state.RDK.direction[id] !== data) {
            await chooseNewDirection(state, "player2", id, stage, block);
            updateCollabStateOnResponse(
              state,
              "player2",
              false,
              id,
              rt,
              totalRt,
            );
          }
        }
      }
      break;
    case "sep":
      if (player === "player1") {
        if (state.P1RDK.mostRecentChoice !== id) {
        } else {
          if (state.P1RDK.direction[id] === data) {
            const message = JSON.stringify({
              stage: stage,
              block: block,
              type: "completed",
              data: id,
            });
            await comms.sendMessage(connections.player1!, message);
            state.P1RDK.totalReactionTIme[id].push(totalRt);
            state.P1RDK.reactionTime[id].push(rt);
            state.P1RDK.completed[id] = true;
            state.P1RDK.attempts[id] += 1;
            await comms.sendState(state, "player1", connections, stage, block);
          } else if (state.RDK.direction[id] !== data) {
            await chooseNewDirection(state, "player1", id, stage, block);
            state.P1RDK.attempts[id] += 1;
            state.P1RDK.reactionTime[id].push(rt);
            state.P1RDK.totalReactionTIme[id].push(totalRt);
            state.P1RDK.incorrectDirection[id].push(state.P1RDK.direction[id]);
            await comms.sendState(state, "player1", connections, stage, block);
          }
        }
      }
      if (player === "player2") {
        if (state.P2RDK.mostRecentChoice !== id) {
        } else {
          if (state.P2RDK.direction[id] === data) {
            const message = JSON.stringify({
              stage: stage,
              block: block,
              type: "completed",
              data: id,
            });
            await comms.sendMessage(connections.player2!, message);
            state.P2RDK.totalReactionTIme[id].push(totalRt);
            state.P2RDK.reactionTime[id].push(rt);
            state.P2RDK.completed[id] = true;
            state.P2RDK.attempts[id] += 1;
            await comms.sendState(state, "player2", connections, stage, block);
          } else if (state.RDK.direction[id] !== data) {
            await chooseNewDirection(state, "player2", id, stage, block);
            state.P2RDK.attempts[id] += 1;
            state.P2RDK.reactionTime[id].push(rt);
            state.P2RDK.totalReactionTIme[id].push(totalRt);
            state.P2RDK.incorrectDirection[id].push(state.P2RDK.direction[id]);
            await comms.sendState(state, "player2", connections, stage, block);
          }
        }
      }
      break;
  }
}

function resetState(state: types.State, baseRDK: types.rdk, newBlock: boolean) {
  /*
  Used to reset the state between trials and blocks.
  */
  if (newBlock === true) {
    let newState = Object.assign({}, state);
    newState.RDK = structuredClone(baseRDK);
    newState.P1RDK = structuredClone(baseRDK);
    newState.P2RDK = structuredClone(baseRDK);
    newState.trialNo = 0;
    return newState;
  } else {
    let newState = Object.assign({}, state);
    newState.RDK = structuredClone(baseRDK);
    newState.P1RDK = structuredClone(baseRDK);
    newState.P2RDK = structuredClone(baseRDK);
    return newState;
  }
}

function checkCompleted(
  state: types.State,
  block: string,
  player: "player1" | "player2" | null,
) {
  if (block === "sep") {
    if (player === "player1") {
      if (state.P1RDK.completed.includes(false)) {
        return true;
      } else {
        return false;
      }
    }
  } else if (player === "player2") {
    if (state.P2RDK.completed.includes(false)) {
      return true;
    } else {
      return false;
    }
  }
  if (block === "collab") {
    if (state.RDK.completed.includes(false)) {
      return false;
    } else {
      return true;
    }
  }
}
async function checkBlockCompleted(
  state: types.State,
  block: string,
  blocks: Array<string>,
) {
  /*
  Checks if the block is completed. If it is, it will send the endBlock message to the players. This is called during the trial handling functions,
  where if false they continue, but if true they exit and send the appropriate message.
  */
  if (block === blocks[0]) {
    if (state.trialNo === expValues.blockLength) {
      const message = JSON.stringify({
        stage: "game",
        block: block,
        type: "endBlock",
        data: "endBlock",
      });
      currentStage = { stage: `${block}Instructions`, block: block };
      await Promise.all([
        comms.sendMessage(connections.player1!, message),
        comms.sendMessage(connections.player2!, message),
      ]);
      await writeData(dataArray, "A");
      state.block = blocks[1];
      return true;
    } else {
      return false;
    }
  }
  if (block === blocks[1]) {
    if (state.trialNo === expValues.blockLength) {
      let endTime = new Date();
      state.endTime = endTime.toISOString();
      await writeData(dataArray, "B");
      const p1Message = JSON.stringify({
        stage: "game",
        block: block,
        type: "endBlock",
        data: "endExp",
        platform: state.player1.platform,
      });
      const p2Message = JSON.stringify({
        stage: "game",
        block: block,
        type: "endBlock",
        data: "endExp",
        platform: state.player2.platform,
      });
      await Promise.all([
        comms.sendMessage(connections.player1!, p1Message),
        comms.sendMessage(connections.player2!, p2Message),
      ]);
      await closeConnections();
      return true;
    } else {
      return false;
    }
  }
}

function calculateBreakInfo(state: types.State, player: "player1" | "player2") {
  /*
  Calculates info to display on the break screen, switching it to show the correct info for each player.
  */
  let P1counts = 0;
  let P2counts = 0;

  if (player === "player1") {
    P1counts = utils.count(state.P1RDK.completed, true);
    P2counts = utils.count(state.P2RDK.completed, true);
  } else if (player === "player2") {
    P1counts = utils.count(state.P2RDK.completed, true);
    P2counts = utils.count(state.P1RDK.completed, true);
  }

  let teamCompleted = P1counts + P2counts;

  let breakInfo = {
    P1completed: P1counts,
    P2completed: P2counts,
    teamCompleted: teamCompleted,
  };

  return breakInfo;
}

async function startTrials(block: string) {
  /*
  Timestamp is used to calculate the time different messages arrive compared to the beginning of the trial.
  creates a timeout to track time for each trial, and calls the startBreak function whestaten the trial is over.
  */
  timeStamp = Date.now();
  state = resetState(state, baseRDK, false);
  state.RDK.direction = trialsDirections[state.trialNo];
  state.P1RDK.direction = trialsDirections[state.trialNo];
  state.P2RDK.direction = trialsDirections[state.trialNo];
  try {
    const message = JSON.stringify({
      stage: "game",
      block: block,
      type: "startTrial",
      data: state,
    });
    await Promise.all([
      comms.sendMessage(connections.player1!, message),
      comms.sendMessage(connections.player2!, message),
    ]);

    trialTimeout = setTimeout(() => {
      startBreak(block);
    }, expValues.trialLength * 1000);
  } catch (error) {
    trialTimeout = setTimeout(() => {
      startBreak(block);
    }, expValues.trialLength * 1000);
  }
}

async function startBreak(block: string) {
  /*
  Saves trial data and increments the trial number. If the block is not completed, it will calculate the break info and send it to the players.
  Calls start trial assumming checkBlock doesn't return true.
  */
  state.RDK.completionTime = utils.createTimestamp(Date.now());
  state.P1RDK.completionTime = utils.createTimestamp(Date.now());
  state.P2RDK.completionTime = utils.createTimestamp(Date.now());
  saveTrialData(state, block);
  state.trialNo += 1;
  try {
    let completed = await checkBlockCompleted(state, block, blocks);
    if (!completed) {
      let p1BreakInfo = calculateBreakInfo(state, "player1");
      let p2BreakInfo = calculateBreakInfo(state, "player2");
      const message1 = JSON.stringify({
        stage: "game",
        block: block,
        type: "break",
        data: p1BreakInfo,
      });
      const message2 = JSON.stringify({
        stage: "game",
        block: block,
        type: "break",
        data: p2BreakInfo,
      });
      await Promise.all([
        comms.sendMessage(connections.player1!, message1),
        comms.sendMessage(connections.player2!, message2),
      ]);
      breakTimeout = setTimeout(() => {
        startTrials(block);
      }, expValues.breakLength * 1000);
    } else {
      return;
    }
  } catch (error) {
    breakTimeout = setTimeout(() => {
      startTrials(block);
    }, expValues.breakLength * 1000);
  }
}

async function handlePracticeTrials(
  directions: Array<Array<string>>,
  block: string,
) {
  /*
  Same as startTrials but for the practice trials.
  */
  try {
    state = resetState(state, baseRDK, false);
    timeStamp = Date.now();
    state.P1RDK.direction = directions[state.trialNo];
    state.P2RDK.direction = directions[state.trialNo];
    state.RDK.direction = directions[state.trialNo];
    const message = JSON.stringify({
      stage: "practice",
      block: block,
      type: "startTrial",
      data: state,
    });
    await Promise.all([
      comms.sendMessage(connections.player1!, message),
      comms.sendMessage(connections.player2!, message),
    ]);
    if (state.trialNo < 7) {
      trialTimeout = setTimeout(() => {
        startPracticeBreak(block);
      }, expValues.practiceLength1 * 1000);
    } else {
      trialTimeout = setTimeout(() => {
        startPracticeBreak(block);
      }, expValues.practiceLength2 * 1000);
    }
  } catch {
    if (state.trialNo < 7) {
      trialTimeout = setTimeout(() => {
        startPracticeBreak(block);
      }, expValues.practiceLength1 * 1000);
    } else {
      trialTimeout = setTimeout(() => {
        startPracticeBreak(block);
      }, expValues.practiceLength2 * 1000);
    }
  }
}

async function startPracticeBreak(block: string) {
  /*
  Same as startBreak but for the practice trials.
  */
  saveTrialData(state, block);
  state.trialNo += 1; // Increment trial number here
  if (
    (block === "sep" && state.trialNo < 5) ||
    (block === "collab" && state.trialNo < 10)
  ) {
    try {
      // Calculate break info for each player
      let p1BreakInfo = calculateBreakInfo(state, "player1");
      let p2BreakInfo = calculateBreakInfo(state, "player2");
      const p1Message = JSON.stringify({
        stage: "practice",
        block: block,
        type: "break",
        data: p1BreakInfo,
      });
      const p2Message = JSON.stringify({
        stage: "practice",
        block: block,
        type: "break",
        data: p2BreakInfo,
      });

      // Send break message after incrementing trialNo and scheduling next trial
      await Promise.all([
        comms.sendMessage(connections.player1!, p1Message),
        comms.sendMessage(connections.player2!, p2Message),
      ]);

      if (state.trialNo <= 7) {
        breakTimeout = setTimeout(() => {
          handlePracticeTrials(practiceTrialsDirections, block);
        }, expValues.practiceBreak1 * 1000);
      } else {
        breakTimeout = setTimeout(() => {
          handlePracticeTrials(practiceTrialsDirections, block);
        }, expValues.practiceBreak2 * 1000);
      }
    } catch {
      if (state.trialNo <= 7) {
        breakTimeout = setTimeout(() => {
          handlePracticeTrials(practiceTrialsDirections, block);
        }, expValues.practiceBreak1 * 1000);
      } else {
        breakTimeout = setTimeout(() => {
          handlePracticeTrials(practiceTrialsDirections, block);
        }, expValues.practiceBreak2 * 1000);
      }
    }
  }
  if (block === "sep" && state.trialNo === 5) {
    const message = JSON.stringify({
      stage: "practice",
      type: "blockBreak",
      data: state,
    });
    await Promise.all([
      comms.sendMessage(connections.player1!, message),
      comms.sendMessage(connections.player2!, message),
    ]);
    state.block = "collab";
  } else if (block === "collab" && state.trialNo === 10) {
    const message = JSON.stringify({
      stage: "practice",
      type: "practiceEnd",
      data: blocks[0],
    });
    currentStage = { stage: `practiceEnd`, block: blocks[0] };
    await Promise.all([
      comms.sendMessage(connections.player1!, message),
      comms.sendMessage(connections.player2!, message),
    ]);
    state.stage = "game";
    state.block = blocks[0];
  }
}

function skipToBlock(stage: string, block: string) {
  /*
  Helper function to skip to a block. This is used in the introduction messaging to skip to the practice trials, or to the game section.
  IF wanting to start practice use "practice" as the stage, and either "sep" as the block. If wanting either sep or collab, use "game" as the stage.
  */
  if (stage === "game") {
    if (block === "sep") {
      state.stage = "game";
      state.block = "sep";
      state.trialNo = 0;
      blocks = ["sep", "collab"];
      practiceTrialsDirections = createTrials(state, "practice");
      trialsDirections = createTrials(state, "exp");
      connections.player1?.send(
        JSON.stringify({
          stage: "game",
          block: "sep",
          message: "instructions",
        }),
      );
      connections.player2?.send(
        JSON.stringify({
          stage: "game",
          block: "sep",
          message: "instructions",
        }),
      );
    }
    if (block === "collab") {
      state.stage = "game";
      state.block = "collab";
      blocks = ["collab", "sep"];
      state.trialNo = 0;
      practiceTrialsDirections = createTrials(state, "practice");
      trialsDirections = createTrials(state, "exp");
      connections.player1?.send(
        JSON.stringify({
          stage: "game",
          block: "collab",
          message: "instructions",
        }),
      );
      connections.player2?.send(
        JSON.stringify({
          stage: "game",
          block: "collab",
          message: "instructions",
        }),
      );
    }
  } else if (stage === "practice") {
    blocks = chooseBlock("exp");
    if (block === "sep") {
      state.stage = "practice";
      state.block = "sep";
      state.trialNo = 0;

      practiceTrialsDirections = createTrials(state, "practice");
      trialsDirections = createTrials(state, "exp");
      connections.player1?.send(
        JSON.stringify({
          stage: "practice",
          block: "sep",
          message: "instructions",
        }),
      );
      connections.player2?.send(
        JSON.stringify({
          stage: "practice",
          block: "sep",
          message: "instructions",
        }),
      );
    }
    if (block === "collab") {
      state.stage = "practice";
      state.block = "collab";
      state.trialNo = 0;
      practiceTrialsDirections = createTrials(state, "practice");
      trialsDirections = createTrials(state, "exp");
      connections.player1?.send(
        JSON.stringify({
          stage: "practice",
          block: "collab",
          message: "instructions",
        }),
      );
      connections.player2?.send(
        JSON.stringify({
          stage: "practice",
          block: "collab",
          message: "instructions",
        }),
      );
    }
  }
}

async function handleIntroductionMessaging(
  type: string,
  ws: WebSocket,
  connections: types.connection,
  data: any,
) {
  switch (type) {
    case "consent":
      if (connections.player1 === ws) {
        state.player1.consent = true;
        state.player1.age = Number(data.age);
        state.player1.gender = data.gender;
        connections.player1.send(
          JSON.stringify({ stage: "intro", type: "instructions" }),
        );
      } else if (ws === connections.player2) {
        state.player2.consent = true;
        state.player2.age = Number(data.age);
        state.player2.gender = data.gender;
        connections.player2.send(
          JSON.stringify({ stage: "intro", type: "instructions" }),
        );
      }
      break;
    case "participantInfo":
      if (connections.player1 === ws) {
        state.player1.id = data.id;
        state.player1.platform = data.origin;
      } else if (connections.player2 === ws) {
        state.player2.id = data.id;
        state.player2.platform = data.origin;
      }
      break;
    case "completedInstructions":
      if (connections.player1 === ws) {
        trackingObject.P1InstructionsFinished = true;
      }
      if (connections.player2 === ws) {
        trackingObject.P2InstructionsFinished = true;
      }
      if (
        trackingObject.P1InstructionsFinished &&
        trackingObject.P2InstructionsFinished
      ) {
        state.stage = "practice";
        state.block = "sep";
        practiceTrialsDirections = createTrials(state, "practice");
        trialsDirections = createTrials(state, "exp");
        blocks = chooseBlock("exp");
        handlePracticeTrials(practiceTrialsDirections, "sep");
      }
      break;
  }
}
async function practiceSepMessaging(
  data: any,
  ws: WebSocket,
  connections: types.connection,
) {
  const player: "player1"|"player2" = ws === connections.player1 ? "player1":"player2"
  switch (data.type) {
    case "instructionsComplete":
      if (connections.player1 === ws) {
        trackingObject.p1PracticeReady = true;
      } else if (connections.player2 === ws) {
        trackingObject.p2PracticeReady = true;
      }
      if (trackingObject.p1PracticeReady && trackingObject.p2PracticeReady) {
        state.stage = "practice";
        practiceTrialsDirections = createTrials(state, "practice");
        trialsDirections = createTrials(state, "exp");
        blocks = chooseBlock("exp");
        beginGame(
          practiceTrialsDirections[state.trialNo],
          state,
          data.stage,
          data.block,
        );
        currentStage = { stage: "practice", block: "sep" };
        trackingObject.p1PracticeReady = false;
        trackingObject.p2PracticeReady = false;
      }
      break;
    case "difficulty":
        handleRDKSelection(
          player,
          data.difficulty,
          data.rt,
          state,
          data.stage,
          data.block)    
      break;
    case "response":
      checkResponse(
          player,
          data.data,
          data.index,
          state,
          data.rt,
          data.totalRt,
          data.stage,
          data.block,
        );
        checkCompleted(state, data.block, player);
      break;
  }
}
async function practiceCollabMessaging(
  data: any,
  ws: WebSocket,
  connections: types.connection,
) {
  const player: "player1"|"player2" = ws === connections.player1 ? "player1":"player2"
  switch (data.type) {
    case "gameReady":
      if (connections.player1 === ws) {
        trackingObject.p1PracticeReady = true;
      } else if (connections.player2 === ws) {
        trackingObject.p2PracticeReady = true;
      }
      if (trackingObject.p1PracticeReady && trackingObject.p2PracticeReady) {
        beginGame(
          practiceTrialsDirections[state.trialNo],
          state,
          data.stage,
          data.block,
        );
        handlePracticeTrials(practiceTrialsDirections, "collab");
        currentStage = { stage: "practice", block: "collab" };
      }
      break;
    case "difficulty":
      handleRDKSelection(
          player,
          data.difficulty,
          data.rt,
          state,
          data.stage,
          data.block,
        );
      break;
    case "response":
      checkResponse(
          player,
          data.data,
          data.index,
          state,
          data.rt,
          data.totalRt,
          data.stage,
          data.block,
        );
      break;
    case "destroy":
      const message = JSON.stringify({
          stage: "game",
          block: blocks[0],
          message: "instructions",
        })
      comms.sendMessage(connections.player1!, message)
      comms.sendMessage(connections.player1!, message)
      state = resetState(state, baseRDK, true);
      state.stage = "game";
      state.block = blocks[0];
      break;
  }
}
async function gameCollabMessaging(data: any, ws: WebSocket, connections: types.connection) {
  const player: "player1"|"player2" = ws === connections.player1 ? "player1":"player2"
  switch (data.type) {
    case "instructionsComplete":
      connections.player1 === ws ? trackingObject.p1TrialReady = true : trackingObject.p2TrialReady = true;
      if (trackingObject.p1TrialReady && trackingObject.p2TrialReady) {
        state = resetState(state, baseRDK, true);
        await beginGame(
          trialsDirections[state.trialNo],
          state,
          data.stage,
          data.block,
        );
        currentStage = { stage: "game", block: "collab" };
        startTrials(data.block);
        trackingObject.p1TrialReady = false;
        trackingObject.p2TrialReady = false;
      }
      break;
    case "difficulty":
       handleRDKSelection(
          player,
          data.difficulty,
          data.rt,
          state,
          data.stage,
          data.block,
        );
      break;
    case "response":
      await checkResponse(
          player,
          data.data,
          data.index,
          state,
          data.rt,
          data.totalRt,
          data.stage,
          data.block,
        );
      break;
  }
}
function gameSepMessaging(data: any, ws: WebSocket, connections: types.connection) {
  const player: "player1"|"player2" = ws === connections.player1 ? "player1":"player2"
  switch (data.type) {
    case "instructionsComplete":
      if (connections.player1 === ws) {
        trackingObject.p1sepInstruction = true;
      }
      if (connections.player2 === ws) {
        trackingObject.p2sepInstruction = true;
      }
      if (trackingObject.p1sepInstruction && trackingObject.p2sepInstruction) {
        state = resetState(state, baseRDK, true);
        state.stage = "game";
        state.block = "sep";
        beginGame(
          trialsDirections[state.trialNo],
          state,
          data.stage,
          data.block,
        );
        currentStage = { stage: "game", block: "sep" };
        startTrials(data.block);
      }
      break;
    case "difficulty":
      handleRDKSelection(
          player,
          data.difficulty,
          data.rt,
          state,
          data.stage,
          data.block,
        );
      break;
    case "response":
      checkResponse(
          player,
          data.data,
          data.index,
          state,
          data.rt,
          data.totalRt,
          data.stage,
          data.block,
        );
        checkCompleted(state, data.block, player);
      break;
  }
}
async function handleExpStart(state: types.State, dataArray: any) {
  /*
  Handles the start of the experiment. This is called when the players have completed the practice trials.
  */
  let startTime = new Date();
  state.startTime = startTime.toISOString();
  state.stage = "intro";
  state.block = "consentForm";
  state.RDK.coherence = shuffle(expValues.coherence);
  dataArray = utils.resetDataArray(dataArray);
  const message = JSON.stringify({ stage: "intro", type: "consentForm" });
  await Promise.all([
    comms.sendMessage(connections.player1!, message),
    comms.sendMessage(connections.player2!, message),
  ]);
  return { state, dataArray, trackingObject };
}
async function handleInitialConnection(
  player: "player1" | "player2",
  ws: WebSocket,
) {
  /*
  Handles the initial connection of the player. This is called when the player connects to the server.
  */
  let message = JSON.stringify({ stage: "waitingRoom" });
  if (player === "player1") {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    connections.player1 = ws;
    await comms.sendMessage(connections.player1, message);
    comms.ping(ws);
    dataArray.push(state);
  } else if (player === "player2") {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
    connections.player2 = ws;
    await comms.sendMessage(connections.player2, message);
    comms.ping(ws);
  }
}
async function handleReconnect(
  /* 
  THIS NEEDS TO BE PROPERLY IMPROVED. THIS IS A SHIT VERSION OF IT. 
  */
  ws: WebSocket,
  player: "player1" | "player2",
  message: any,
) {
  if (player === "player1") {
    connections.player1 = ws;
    await comms.sendMessage(connections.player1, message);
  } else if (player === "player2") {
    connections.player2 = ws;
    await comms.sendMessage(connections.player2, message);
  }
}
function closeConnections() {
  connections.player1?.close();
  connections.player1 = null;
  connections.player2?.close();
  connections.player2 = null;
}
  // Set a new timeout to kill the process
wss.on("connection", async function (ws) {
  if (connections.player1 === null) {
    if (gameInProgress === false) {
      await handleInitialConnection("player1", ws);
    } else {
      const message = JSON.stringify({
        stage: "practice",
        inProgress: gameInProgress,
        progress: currentStage,
        state: state,
      });
      await handleReconnect(ws, "player1", message);
    }
  } else if (connections.player2 === null) {
    if (gameInProgress === false) {
      await handleInitialConnection("player2", ws);
    } else {
      const message = JSON.stringify({
        stage: "practice",
        inProgress: gameInProgress,
        progress: currentStage,
        state: state,
      });
      await handleReconnect(ws, "player2", message);
    }
  }
  if (connections.player1 && connections.player2) {
    if (!testConsts.skipIntro) {
      if (!gameInProgress) {
        let returnData = await handleExpStart(state, dataArray);
        state = returnData.state;
        dataArray = returnData.dataArray;
        trackingObject = returnData.trackingObject;
      }
    } else if (testConsts.skipIntro) {
      trackingObject.p1SkipReady = true;
      trackingObject.p2SkipReady = true;
      if (trackingObject.p1SkipReady && trackingObject.p2SkipReady) {
        state.stage = "practice";
        state.block = "sep";
        practiceTrialsDirections = createTrials(state, "practice");
        trialsDirections = createTrials(state, "exp");
        blocks = chooseBlock("exp");
        handlePracticeTrials(practiceTrialsDirections, "sep");
      }
    }
  }
  ws.on("pong", () => {
    console.log("connection alive");
  });
  ws.on("message", async function message(m) {
    const data = JSON.parse(m.toString("utf-8"));
    console.log(data);
    if (data.type === "heartbeat") {
      console.log("connection alive");
    }
    switch (data.stage) {
      case "intro":
        handleIntroductionMessaging(data.type, ws, connections, data.data);
        break;
      case "practice":
        switch (data.block) {
          case "sep":
            practiceSepMessaging(data, ws, connections);
            break;
          case "collab":
            practiceCollabMessaging(data, ws, connections);
            break;
        }
        break;
      case "game":
        switch (data.block) {
          case "collab":
            gameCollabMessaging(data, ws, connections);
            break;
          case "sep":
            gameSepMessaging(data, ws, connections);
            break;
        }
        break;
      case "end":
        switch (data.type) {
          case "pageReached":
            if (ws === connections.player1) {
              trackingObject.p1endPageReached = true;
            } else if (ws === connections.player2) {
              trackingObject.p2endPageReached = true;
            }
            if (
              trackingObject.p1endPageReached &&
              trackingObject.p2endPageReached
            ) {
              setTimeout(() => {
                // Check if player1 connection is still valid and open
                if (connections.player1) {
                  try {
                    connections.player1.close();
                  } catch (e) {
                    console.error("Error closing player1 connection:", e);
                  } finally {
                    connections.player1 = null;
                  }
                }

                // Check if player2 connection is still valid and open
                if (connections.player2) {
                  try {
                    connections.player2.close();
                  } catch (e) {
                    console.error("Error closing player2 connection:", e);
                  } finally {
                    connections.player2 = null;
                  }
                }
              }, 300000); // 5 minutes
            }
            break;
          case "redirect":
            if (ws === connections.player1) {
              if (connections.player1 !== null) {
                connections.player1.close();
                connections.player1 = null;
              } else {
                connections.player1 = null;
              }
            } else if (ws === connections.player2) {
              if (connections.player2 !== null) {
                connections.player2.close();
                connections.player2 = null;
              } else {
                connections.player2 = null;
              }
            }
        }
    }
  });

  ws.on("close", async () => {
    const player: "player1"|"player2" = connections.player1 === ws ? "player1":"player2"
    comms.removeConnection(connections, player)
    if (connections.player1 === null && connections.player2 === null) {
      dataArray.push(state);
    }
  });
  ws.on("error", console.error)});
