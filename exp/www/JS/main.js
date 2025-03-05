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
import * as utils from "./clientUtils.js";
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
	imgDim: "100px",
	imgDiam: 100,
};
let choiceTimestamp;
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
let img = utils.preloadImages(images);
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
let rAF;

// Server shit
let mainDiv = document.getElementById("main");
let canvas = document.getElementById("Canvas");
let contentDiv = document.getElementById("content");
const contentDivSpecs = {
	radius: Math.min(contentDiv.offsetWidth, contentDiv.offsetHeight) / 2.75,
	centerX: contentDiv.offsetWidth / 2,
	centerY: contentDiv.offsetHeight / 2,
};
let ctx = canvas.getContext("2d");
let breakdiv;
const wsURL = `ws://${window.location.host}${window.location.pathname}coms`;
const ws = new WebSocket(wsURL);

document.addEventListener("DOMContentLoaded", () => {
	contentDiv.innerHTML = connectingHTML;
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
				ws.send(JSON.stringify({ stage: "heartbeat" }));
				break;
			case "waitingRoom":
				loadWaitingRoom("content", ws);
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
					case "startTrial":
						state = message.data;
						console.log(state);
						utils.clearContainer(contentDiv);
						createImages(img, content);
						handleDivInteraction(divs.uncompleted);

						break;
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
	await utils.sendMessage(ws, message);
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
function displayBlockInstructions(stage, block) {
	console.log("displaying block instructions");
	stage = stage;
	block = block;
	allowMessage = false;
	if (block === "sep") {
		loadSepInstructions("main", ws);
	} else if (block === "collab") {
		loadCollabInstructions("main", ws);
	}
}
function stopAnimation() {
	cancelAnimationFrame(rAF);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
}
function createImages(images, container) {
	if (breakdiv) {
		breakdiv.remove();
	}
	stopAnimation();

	// Assuming contentDivSpecs contains radius, centerX, and centerY
	const { radius, centerX, centerY } = contentDivSpecs;

	// Update pixel positions to use polar coordinates for circular positioning
	for (let i = 0; i < Object.keys(coherenceDifficulties).length; i++) {
		const div = document.createElement("div");
		const img = images[i];

		let coherence = state.RDK.coherence[i];
		let difficulty = coherenceDifficulties[coherence];

		// Set image size
		img.style.width = expConsts.imgDim;
		img.style.height = expConsts.imgDim;

		// Set div to absolute positioning
		div.style.position = "absolute";
		div.style.width = expConsts.imgDim;
		div.style.height = expConsts.imgDim;

		// Polar coordinates for circular positioning
		const angle = (i / Object.keys(coherenceDifficulties).length) * 2 * Math.PI;
		const x = centerX + radius * Math.cos(angle) - expConsts.imgDiam / 2; // Subtract half image width to center it
		const y = centerY + radius * Math.sin(angle) - expConsts.imgDiam / 2; // Subtract half image height to center it

		// Position the div
		div.style.left = `${x}px`;
		div.style.top = `${y}px`;

		// Assign id, append image, and other functionality
		div.id = i;
		div.appendChild(img);
		divs.uncompleted.push(div); // Store reference to the div
		displayDifficultyText(div, difficulty, i); // Display difficulty text
		container.appendChild(div);
	}
}
function displayDifficultyText(parentDiv, difficulty, id) {
	const difficultyText = document.createElement("div");
	difficultyText.textContent = difficulty;
	difficultyText.style.position = "absolute";
	difficultyText.style.bottom = "-20px"; // Adjust to position under the image div
	difficultyText.style.width = "100%"; // Full width
	difficultyText.style.textAlign = "center"; // Center text horizontally
	difficultyText.style.fontSize = "18px";
	difficultyText.id = id;
	parentDiv.appendChild(difficultyText);
}
function handleDivInteraction(divList) {
	for (let div of divList) {
		div.addEventListener("mouseover", mouseOverHandler);
		div.addEventListener("mouseout", mouseOutHandler);
		div.addEventListener("click", clickHandler);
	}
}
function mouseOverHandler(event) {
	event.currentTarget.style.border = "1px solid white";
}

function mouseOutHandler(event) {
	event.currentTarget.style.border = "none";
}

function clickHandler(event) {
	if (divs.uncompleted.includes(event.currentTarget)) {
		let choiceEndTime = utils.createTimestamp(choiceTimestamp);
		event.currentTarget.style.border = "none";
		ws.send(
			JSON.stringify({
				stage: stage,
				block: block,
				type: "difficulty",
				difficulty: event.currentTarget.id,
				rt: choiceEndTime,
			})
		);
	} else {
		restoreImages(divs);
	}
}
function restoreImages(divObj) {
	if (currentlyCompleting) {
		return;
	} else {
		restoreCompletedImages(divObj);
		restoreUncompletedImages(divObj);
		choiceStartTime = performance.now();
	}
}
function restoreCompletedImages(divObj) {
	for (let div of divObj.completed) {
		if (!div) {
			console.warn("Skipped null or undefined div.");
			continue;
		}
		removeEventListeners(div);

		div.style.opacity = 0.5;

		const img = div.querySelector("img");
		if (img) {
			img.style.display = "block";
		} else {
			console.warn("Image element not found in div", div);
		}

		const difficultyText = div.querySelector("div");
		if (difficultyText) {
			difficultyText.style.display = "block";
		} else {
			console.warn("Difficulty text not found in div", div);
		}
	}
}
function restoreUncompletedImages(divObj) {
	for (let div of divObj.uncompleted) {
		div.style.opacity = 1;
		let difficultyText = div.querySelector("div");

		if (difficultyText) {
			difficultyText.style.display = "block";
		}
	}
	handleDivInteraction(divObj.uncompleted);
}
function removeEventListeners(div) {
	document.removeEventListener("keyup", responseHandler);
	if (div && div.parentNode) {
		div.removeEventListener("mouseover", mouseOverHandler);
		div.removeEventListener("mouseout", mouseOutHandler);
		div.removeEventListener("click", clickHandler);
	}
}
