/*
Standard types that we use for tracking data and player connections
*/
export type connection = {
  player1: import("ws").WebSocket | null, 
  player2: import("ws").WebSocket | null
}
export type Player = {
  connectTime: any;
  id: any;
  age: number;
  gender: string;
  consent: boolean;
  platform: string;
};
export type mousePos = {
  trialNo: number;
  x: number;
  y: number;
  stage: string;
  block: string;
  timestamp: number;
};
export type screen = {
  width: number;
  height: number;
};

export type mouseTracking = {
  p1Screen: screen;
  p2Screen: screen;
  player1: mousePos;
  player2: mousePos;
};
export type State = {
  startTime: string;
  endTime: string;
  gameNo: number;
  stage: "waitingRoom" | "intro" | "practice" | "game" | "end";
  block: string;
  player1: Player;
  player2: Player;
  RDK: rdk;
  P1RDK: rdk;
  P2RDK: rdk;
  trialNo: number;
};
export type rdk = {
  mostRecentChoice: string;
  choice: Array<number>;
  choiceTime: Array<number>;
  completed: Array<boolean>;
  totalReactionTIme: Array<Array<number>>;
  correct: Array<boolean>;
  attempts: Array<number>;
  player: Array<number>;
  playerAttempts: Array<number>;
  coherence: Array<number>;
  direction: Array<any>;
  incorrectDirection: Array<Array<string>>;
  completionTime: number;
  reactionTime: Array<Array<number>>;
  timeStamp: Array<number>;
};
