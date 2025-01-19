/*
Includes a number of utility functions, nothing major
*/
export function createTimestamp(timestamp: number) {
	let newTimestamp = Date.now();
	let time = newTimestamp - timestamp;
	return time;
}
export function randomChoice(arr: Array<any>) {
	let choicesArray = [];
	let choice = arr[Math.floor(Math.random() * arr.length)];
	choicesArray.push(choice);
	return choice;
}
export function splitIntoSubarrays(arr: Array<string>, subarrayLength: number) {
	let result = [];
	for (let i = 0; i < arr.length; i += subarrayLength) {
		result.push(arr.slice(i, i + subarrayLength));
	}
	return result;
}
export function count(array: Array<any>, value: any) {
	return array.filter((a) => a === value).length;
}
export function resetDataArray(data: Array<any>) {
	let newData: Array<any> = [];
	return newData;
}
export function deepCopy(obj: any) {
	return JSON.parse(JSON.stringify(obj));
}
/*
Standard types that we use for tracking data and player connections
*/
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
