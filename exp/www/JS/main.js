import {
	loadWaitingRoom,
	loadWaitingExpEndRoom,
} from "../Content/Forms/waitingRoom.js";
import { loadConsentForm } from "../Content/Forms/consentForm.js";
import {
	loadSepInstructions,
	loadCollabInstructions,
	loadEndGame,
	loadInstructions,
} from "../Content/Forms/instructions.js";
const connectingHTML = `<div style="text-align: center;">
<h2>Connecting</h2>
<p>
	connecting......<br>
</p>
</div>
`;
// for exp stimuli and relevant variables
const expConsts = {
	dotRad: 1.75,
	apertureRad: 50,
	dotColor: "rgb(255,255,255)",
	dotSpeed: 1.5,
	nDots: 100,
	coherence: [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9],
	directions: [0, 1],
	colourApertureSize: 30,
	pauseDuration: 500,
	blockBreak: 20,
	breakDuration: 10,
	blockLength: 30,
};

const images = [
	"Content/Images/rdk_static1.png",
	"Content/Images/rdk_static2.png",
	"Content/Images/rdk_static3.png",
	"Content/Images/rdk_static4.png",
	"Content/Images/rdk_static1.png",
	"Content/Images/rdk_static2.png",
	"Content/Images/rdk_static3.png",
	"Content/Images/rdk_static4.png",
];
// difficulty labels
const coherenceDifficulties = {
	0.1: "Very Easy",
	0.2: "Easy",
	0.3: "Easy-Med",
	0.4: "Med",
	0.6: "Med-Hard",
	0.7: "Hard",
	0.8: "Very Hard",
	0.9: "Ext Hard",
};

// for stimuli and images
let img = preloadImages(images);
let divs = {
	uncompleted: [],
	completed: [],
};
let breakInfo = {
	p1Completed: 0,
	p2Completed: 0,
	completed: 0,
};

// declaring variables
let id = "";
let platform = "";
let lastPing = "";
let GameTimeout;
let block;
let stage;
let blockOrder = [];
let infoData = {
	id: "",
	origin: "",
};
// for tracking normal state and mousepos state
let state;
let mousePos = {
	x: 0,
	y: 0,
};

// Server shit
let mainDiv = document.getElementById("main");
let canvas = document.getElementById("Canvas");
let ctx = canvas.getContext("2d");
const wsURL = `ws://${window.location.host}${window.location.pathname}coms`;
const ws = new WebSocket(wsURL);

document.addEventListener("DOMContentLoaded", () => {
	mainDiv.innerHTML = connectingHTML;
	console.log("Connecting to the server...");
});

ws.onopen = () => {
	handleQueryParams();
	ws.onmessage = (event) => {
		let message = JSON.parse(event.data);
		console.log(message);
		switch (message.stage) {
			case "ping":
				ws.send(JSON.stringify({ stage: "ping" }));
				break;
			case "heartbeat":
				this.ws.send(JSON.stringify({ stage: "heartbeat" }));
				break;
			case "waitingRoom":
				loadWaitingRoom("main", ws);
				break;
			case "waitingExpEndRoom":
				loadWaitingExpEndRoom("main", ws);
				break;
			case "intro":
				switch (message.type) {
					case "consentForm":
						GameTimeout = setTimeout(() => {
							handleIdlePlayer(ws, origin);
						}, 10 * 1000 * 60);
						loadConsentForm("main", ws);
						break;
					case "instructions":
						loadInstructions("main", ws);
						break;
				}
				break;
			case "practice":
				switch (message.type) {
					case "initialState":
						state = message.data;
				}
				break;
		}
	};
};
async function handleQueryParams() {
	const queryParams = new URLSearchParams(window.location.search);
	console.log(queryParams);
	if (queryParams.has("survey_code")) {
		infoData.id = queryParams.get("survey_code");
	} else {
		infoData.id = "NA";
	}
	if (queryParams.has("origin")) {
		infoData.origin = queryParams.get("origin");
	} else {
		infoData.origin = "NA";
	}
	let message = JSON.stringify({
		stage: "intro",
		type: "participantInfo",
		data: infoData,
	});
	await sendMessage(ws, message);
}
async function sendMessage(ws, message) {
	try {
		await retryMessage(ws, message);
		return true; // Return true if the message was sent successfully
	} catch (error) {
		// Log and rethrow the final error if retries are exhausted
		console.error("Final error sending message:", error);
		throw error;
	}
}
async function retryMessage(ws, message, maxRetries = 4, retryDelay = 1000) {
	let attempts = 0;

	while (attempts < maxRetries) {
		try {
			// Attempt to send the message
			await new Promise((resolve, reject) => {
				ws.send(message, (error) => {
					if (error) {
						reject(error); // Reject the promise if there's an error
					} else {
						resolve(); // Resolve the promise if successful
					}
				});
			});
			// If successful, return true
			return true;
		} catch (error) {
			attempts++;
			if (attempts >= maxRetries) {
				// If maximum attempts reached, throw the error
				console.error(
					`Failed to send message after ${maxRetries} attempts: ${error}`
				);
				throw error;
			}
			// Log the error and retry after a delay
			console.error(
				`Error sending message, retrying... (attempt ${attempts}/${maxRetries}): ${error}`
			);
			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}
	}

	// This line will never be reached due to the throw in the catch block
	return false;
}

function handleIdlePlayer(ws, origin) {
	if (origin === "Prolific") {
		window.location.replace(
			"https://app.prolific.com/submissions/complete?cc="
		);
	} else if (origin === "SONA") {
		window.location.replace(
			`https://newcastle.sona-systems.com/webstudy_credit.aspx?experiment_id=1754&credit_token=ae4e2ac4b9aa43e6ac66289fe0a48998&survey_code`
		);
	}
}
function preloadImages(imageList) {
	let imgArray = [];
	imageList.forEach((image) => {
		const img = new Image();
		img.src = image;
		imgArray.push(img);
	});
	return imgArray;
}
function clearContainer() {
	const container = document.getElementById(this.containerId);
	// Use Array.from to safely iterate over the NodeList
	Array.from(container.childNodes).forEach((child) => {
		// Check if the child is not a canvas
		if (child.nodeName != "CANVAS") {
			// Remove the child from the container
			container.removeChild(child);
		}
	});
}
function displayBlockInstructions(stage, block) {
	console.log("displaying block instructions");
	stage = stage;
	block = block;
	allowMessage = false;
	if (block === "sep") {
		loadSepInstructions("main", this.ws);
	} else if (block === "collab") {
		loadCollabInstructions("main", this.ws);
	}
}
