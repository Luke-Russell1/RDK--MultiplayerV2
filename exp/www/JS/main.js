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

async function handleQueryParams() {
	const queryParams = new URLSearchParams(window.location.search);
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
	stage = stage;
	block = block;
	allowMessage = false;
	if (block === "sep") {
		loadSepInstructions("main", ws);
	} else if (block === "collab") {
		loadCollabInstructions("main", ws);
	}
}

class RDK {
	constructor(expConsts, state) {
		this.location = null;
		this.coherence = null;
		this.direction = null;
		this.canvas = null;
		this.ctx = null;
		this.dotDict = {};
		this.expConsts = expConsts;
		this.animating = true;
		this.lastFrameTime = null;
		this.divCurrentlyCompleting = null;
		this.allowMessage = false;
		this.currentlyCompleting = false;
		this.state = state;
		this.aniFrame = null;
		this.addKeyListeners = this.addKeyListeners.bind(this);
	}

	async setUp(divLoc, divID, coherence, direction, state, canvas) {
		try {
			this.state = state;
			this.divID = divID;
			this.div = document.getElementById(divID);
			this.div.style.display = "block";
			this.location = divLoc;
			this.coherence = coherence;
			this.direction = direction;
			this.canvas = canvas;
			this.ctx = this.canvas.getContext("2d");
			this.canvas.style.display = "block";
			await this.generateDotMotionAperture(this.direction, this.location);
			await this.addKeyListeners();
		} catch (error) {
			console.error("Error in setup", error);
		}
	}

	async stopAnimation() {
		try {
			if (this.aniFrame) {
				cancelAnimationFrame(this.aniFrame);
				this.canvas.style.display = "none";
			} else {
				return;
			}
		} catch {
			console.error("Error in cancelling animation frame");
		}
	}

	drawDot(x, y) {
		this.ctx.fillStyle = this.expConsts.dotColor;
		this.ctx.beginPath();
		this.ctx.arc(x, y, this.expConsts.dotRad, 0, Math.PI * 2, true);
		this.ctx.closePath();
		this.ctx.fill();
	}

	drawCircle(centerX, centerY, radius) {
		// Ensure the canvas is square, for example:

		// Draw the circle
		this.ctx.beginPath();
		this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
		this.ctx.fillStyle = "#808080";
		this.ctx.fill();
		this.ctx.strokeStyle = "black"; // Set border color
		this.ctx.lineWidth = 0.5; // Optionally, set the border width
		this.ctx.stroke();
		this.ctx.closePath();
	}

	drawManyDots(centerX, centerY, apertureRadius, ndots, coherence, direction) {
		// Calculate number of coherent dots
		const dotCoherence = Math.round(ndots * coherence);
		let dotDict = {};

		// Generate random directions for each dot
		for (let i = 0; i < ndots; i++) {
			let dotDirection;
			if (i > dotCoherence) {
				// Coherent dots move in the specified direction
				dotDirection = direction;
			} else {
				dotDirection = "random";
			}

			// Generate random positions within the aperture
			const randomAngle = Math.random() * 2 * Math.PI;
			const randomRadius = Math.random() * apertureRadius;

			// Calculate dot position relative to center
			let dotX = centerX + randomRadius * Math.cos(randomAngle);
			let dotY = centerY + randomRadius * Math.sin(randomAngle);

			dotDict[i] = {
				x: dotX,
				y: dotY,
				direction: dotDirection,
				alive: true,
				angle: randomAngle,
			};
		}

		return dotDict;
	}

	moveDots(dotDict, centerX, centerY, apertureRadius) {
		for (let dot in dotDict) {
			if (dotDict[dot].alive) {
				switch (dotDict[dot].direction) {
					case "random":
						dotDict[dot].x +=
							this.expConsts.dotSpeed * Math.cos(dotDict[dot].angle);
						dotDict[dot].y +=
							this.expConsts.dotSpeed * Math.sin(dotDict[dot].angle);
						break;
					case "left":
						dotDict[dot].x -= this.expConsts.dotSpeed;
						break;
					case "right":
						dotDict[dot].x += this.expConsts.dotSpeed;
						break;
				}

				// Check if the dot is outside the aperture and reset if necessary
				if (
					Math.sqrt(
						(dotDict[dot].x - centerX) ** 2 + (dotDict[dot].y - centerY) ** 2
					) > apertureRadius
				) {
					dotDict[dot] = this.killDots(
						dotDict[dot],
						centerX,
						centerY,
						apertureRadius
					);
				}
			}
		}
		return dotDict;
	}
	killDots(dot, centerX, centerY, apertureRadius) {
		const randomRadius = Math.random() * apertureRadius;
		const randomAngle = Math.random() * 2 * Math.PI;
		dot.x = centerX + randomRadius * Math.cos(randomAngle);
		dot.y = centerY + randomRadius * Math.sin(randomAngle);
		dot.angle = Math.random() * 2 * Math.PI;
		dot.alive = true;
		return dot;
	}

	animateDots(centerX, centerY, apertureRadius) {
		// Calculate the time elapsed since the last frame
		const now = performance.now();
		if (!this.lastFrameTime) {
			this.lastFrameTime = now;
		}
		const elapsed = now - this.lastFrameTime;

		// Limit to 60 FPS (16.67 ms per frame)
		const fpsLimit = 1000 / 60; // milliseconds

		if (elapsed < fpsLimit) {
			// If not enough time has passed, exit without drawing
			this.aniFrame = requestAnimationFrame(() =>
				this.animateDots(centerX, centerY, apertureRadius)
			);
			return;
		}

		// Update the last frame time
		this.lastFrameTime = now;

		// Clear the entire canvas before drawing
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Redraw aperture circle
		this.drawCircle(centerX, centerY, apertureRadius);

		// Move and redraw dots
		this.dotDict = this.moveDots(
			this.dotDict,
			centerX,
			centerY,
			apertureRadius
		);
		for (let dot in this.dotDict) {
			const { x, y, direction } = this.dotDict[dot];
			if (
				Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) <= apertureRadius
			) {
				this.drawDot(x, y);
			}
		}

		// Request next animation frame if still animating
		this.aniFrame = requestAnimationFrame(() =>
			this.animateDots(centerX, centerY, apertureRadius)
		);
	}

	// New Method: generateDotMotionAperture
	async generateDotMotionAperture(direction, divPos) {
		// Clear previous drawings
		try {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			const centerX = divPos.x;
			const centerY = divPos.y;
			const apertureRadius = this.expConsts.apertureRad;
			const nDots = this.expConsts.nDots;
			const coherence = this.coherence;

			// Generate initial dots
			this.dotDict = this.drawManyDots(
				centerX,
				centerY,
				apertureRadius,
				nDots,
				coherence,
				direction
			);

			// Start the animation loop
			this.dotStartTime = performance.now();
			this.animateDots(centerX, centerY, apertureRadius);
		} catch (error) {
			console.error("Error:", error);
		}
	}
	async addKeyListeners() {
		const keyListener = async (event) => {
			event.preventDefault();
			if ((event.key === "z") | (event.key === "x")) {
				document.removeEventListener("keyup", keyListener);
				const response = event.key === "z" ? "left" : "right";
				const correct = response === this.direction ? "correct" : "incorrect";
				this.handleResponse(correct);
			}
		};
		document.addEventListener("keyup", keyListener);
	}
	async handleResponse(response) {
		const message = {
			stage: stage,
			block: block,
			type: "response",
			response: response,
			direction: this.direction,
			rt: rt,
			id: this.divID,
		};
		utils.sendMessage(ws, message);
		if (response === "correct") {
			return;
		} else if (response === "incorrect") {
			this.handleIncorrectResponse();
		}
	}
	async handleIncorrectResponse() {
		this.direction = Math.random() < 0.5 ? "left" : "right";
		this.stopAnimation();
		setTimeout(() => {
			this.generateDotMotionAperture(this.direction);
		}, 0.5 * 1000);
	}
}

class imageDivs {
	/*
	This assumes feeding in some kind of object with images, 
	and the constants file too. 

	NEED TO ADD BACK CHOICE TIMR HANDLERS
	*/
	constructor(
		imgs,
		consts,
		divSpecs,
		container,
		difficulties,
		choiceStartTime
	) {
		this.images = this.preloadImages(imgs);
		this.divs = {
			uncompleted: [],
			completed: [],
		};
		this.container = container;
		this.contentDivSpecs = divSpecs;
		this.experimentConsts = consts;
		this.difficulties = difficulties;
		this.coherences = Object.keys(this.difficulties);
		this.choiceStartTime = performance.now();
		this.mouseOverHandler = this.mouseOverHandler.bind(this);
		this.mouseOutHandler = this.mouseOutHandler.bind(this);
		this.clickHandler = this.clickHandler.bind(this);
	}
	preloadImages(imageList) {
		let imgArray = [];
		imageList.forEach((image) => {
			const img = new Image();
			img.src = image;
			img.id = "img";
			imgArray.push(img);
		});
		return imgArray;
	}
	createImages() {
		// Assuming contentDivSpecs contains radius, centerX, and centerY
		contentDiv.style.display = "none";
		const { radius, centerX, centerY } = contentDivSpecs;

		// Update pixel positions to use polar coordinates for circular positioning
		for (let i = 0; i < Object.keys(this.difficulties).length; i++) {
			const div = document.getElementById(i); // Get pre-made div by ID
			if (!div || !div.classList.contains("imgDiv")) {
				console.error(`Div with ID ${i} and class "imgDiv" not found.`);
				continue;
			}

			const img = this.images[i];
			let coherence = this.coherences[i];
			let difficulty = this.difficulties[coherence];

			// Set image size
			img.style.width = expConsts.imgWidth;
			img.style.height = expConsts.imgHeight;

			// Polar coordinates for circular positioning
			const angle = (i / Object.keys(this.difficulties).length) * 2 * Math.PI;
			const x = centerX + radius * Math.cos(angle) - expConsts.imgDiam / 2; // Subtract half image width to center it
			const y = centerY + radius * Math.sin(angle) - expConsts.imgDiam / 2; // Subtract half image height to center it

			// Dynamically set the div size based on the image size
			div.style.width = expConsts.imgWidth;
			div.style.height = expConsts.imgHeight;
			div.style.position = "absolute";
			div.style.left = `${x}px`;
			div.style.top = `${y}px`;

			// Append image and other functionality
			div.appendChild(img);
			this.divs.uncompleted.push(div); // Store reference to the div
			this.displayDifficultyText(div, difficulty, i); // Display difficulty text
		}
	}
	displayDifficultyText(parentDiv, difficulty, id) {
		const difficultyText = document.createElement("div");
		difficultyText.textContent = difficulty;
		difficultyText.style.position = "absolute";
		difficultyText.style.bottom = "-20px"; // Adjust to position under the image div
		difficultyText.style.width = "100%"; // Full width
		difficultyText.style.textAlign = "center"; // Center text horizontally
		difficultyText.style.fontSize = "18px";
		difficultyText.id = "text";
		parentDiv.appendChild(difficultyText);
	}
	mouseOverHandler(event) {
		event.currentTarget.style.border = "1px solid white";
	}

	mouseOutHandler(event) {
		event.currentTarget.style.border = "none";
	}

	clickHandler(event) {
		if (this.divs.uncompleted.includes(event.currentTarget)) {
			let choiceEndTime = utils.createTimestamp(this.choiceStartTime);
			event.currentTarget.style.border = "none";
			ws.send(
				JSON.stringify({
					stage: state.stage,
					block: state.block,
					type: "difficulty",
					difficulty: event.currentTarget.id,
					rt: choiceEndTime,
				})
			);
		} else {
			this.restoreImages(this.divs);
		}
	}
	async restoreImages(divObj) {
		this.canvas.style.display = "none";
		await restoreCompletedImages(divObj);
		await restoreUncompletedImages(divObj);
	}
	async restoreCompletedImages(divObj) {
		for (let div of divObj.completed) {
			if (!div) {
				console.warn("Skipped null or undefined div.");
				continue;
			}
			removeEventListeners(div);

			div.style.opacity = 0.5;
		}
	}
	async restoreUncompletedImages(divObj) {
		divObj.uncompleted.forEach(async (div) => {
			await this.handleDivInteraction();
		});
	}
	async handleDivInteraction() {
		for (let div of this.divs.uncompleted) {
			try {
				div.addEventListener("mouseover", this.mouseOverHandler);
				div.addEventListener("mouseout", this.mouseOutHandler);
				div.addEventListener("click", this.clickHandler);
			} catch (error) {
				console.error("error in attaching events to div", error);
			}
		}
	}
	removeEventListeners(div) {
		if (div && div.parentNode) {
			div.removeEventListener("mouseover", this.mouseOverHandler);
			div.removeEventListener("mouseout", this.mouseOutHandler);
			div.removeEventListener("click", this.clickHandler);
		}
	}
	async startTrial(coherences) {
		try {
			divHandler.coherences = coherences;
			divHandler.choiceStartTime = performance.now();
			divHandler.createImages();
			divHandler.handleDivInteraction();
		} catch {
			console.error("Issue in starting trial");
		}
	}
	getDivPos(divID) {
		const completedDiv = this.divs.completed.find((div) => div.id === divID);
		if (completedDiv) {
			console.error("RDK has already been completed");
			return null;
		}

		const uncompletedDiv = this.divs.uncompleted.find(
			(div) => div.id === divID
		);
		if (!uncompletedDiv) {
			console.error("Div not found");
			return null;
		}
		this.hideAllDivs();
		const left = uncompletedDiv.getBoundingClientRect().left;
		const top = uncompletedDiv.getBoundingClientRect().top;
		const width = this.experimentConsts.imgDiam / 2;

		// Convert screen-space to canvas-space
		const pos = {
			x: left + width,
			y: top + width,
		};
		return pos;
	}
	async hideDiv(divID) {
		try {
			const neededDiv = this.divs.uncompleted.find((div) => div.id === divID);
			if (neededDiv) {
				let img = neededDiv.querySelector("#img");
				let text = neededDiv.querySelector("#text");
				img.style.display = "none";
				text.style.display = "none";
			}
		} catch (error) {
			console.error("error in hiding divs", error);
		}
	}
	async hideAllDivs() {
		try {
			this.divs.uncompleted.forEach((div) => {
				this.removeEventListeners(div);
				div.style.opacity = ".5";
			});
		} catch (error) {
			console.error("erroring in changing opacity", error);
		}
	}
}
async function updateState(newState) {
	try {
		state = newState;
		stage = newState.stage;
		block = newState.block;
	} catch {
		console.error("state is missing variables");
	}
}
function updateExpConsts() {
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;

	// Scale the image size as a percentage of the smaller viewport dimension
	const baseSize = viewportHeight * 0.15; // 10% of the smaller dimension

	expConsts.imgWidth = `${baseSize}px`;
	expConsts.imgHeight = `${baseSize}px`;
	expConsts.imgDiam = baseSize; // Diameter is the same as the width/height
	// Optionally, scale other constants if needed
	expConsts.apertureRad = expConsts.imgDiam * 0.5; // Example: aperture radius is 40% of the image size
	expConsts.dotRad = baseSize * 0.01; // Example: dot radius is 2% of the image size
	canvas.width = mainDiv.clientWidth;
	canvas.height = mainDiv.clientHeight;
	console.log(
		canvas.width,
		canvas.height,
		mainDiv.clientWidth,
		mainDiv.clientHeight
	);

	console.log("Updated expConsts:", expConsts);
}
let mainDiv = document.getElementById("main");
let canvas = document.getElementById("Canvas");
let contentDiv = document.getElementById("content");
const contentDivSpecs = {
	radius: Math.min(window.innerWidth, window.innerHeight) / 2.75,
	centerX: contentDiv.clientWidth / 2,
	centerY: contentDiv.clientHeight / 2,
};
let ctx = canvas.getContext("2d");
// Update expConsts on page load
window.addEventListener("load", updateExpConsts);

// Update expConsts on window resize
window.addEventListener("resize", updateExpConsts);
let breakdiv;
// connecting stuff
const connectingHTML = `<div style="text-align: center;">
<h2>Connecting</h2>
<p>
	connecting......<br>
</p>
</div>
`;
const expConsts = {
	dotRad: 2,
	apertureRad: 60,
	dotColor: "rgb(255,255,255)",
	dotSpeed: 2.5,
	nDots: 100,
	coherence: [0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9],
	directions: [0, 1],
	pauseDuration: 500,
	blockBreak: 20,
	breakDuration: 10,
	blockLength: 30,
	imgWidth: `${150}px`,
	imgHeight: `${150}px`,
	imgDiam: 150,
};
let choiceTimestamp;
const images = [
	"Content/Images/rdk_static1_cropped.png",
	"Content/Images/rdk_static2_cropped.png",
	"Content/Images/rdk_static3_cropped.png",
	"Content/Images/rdk_static4_cropped.png",
	"Content/Images/rdk_static1_cropped.png",
	"Content/Images/rdk_static2_cropped.png",
	"Content/Images/rdk_static3_cropped.png",
	"Content/Images/rdk_static4_cropped.png",
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
let divHandler = new imageDivs(
	images,
	expConsts,
	contentDivSpecs,
	contentDiv,
	coherenceDifficulties,
	choiceTimestamp
);
let RDKHandler = new RDK(expConsts, state);

// Server shit

const wsURL = `ws://${window.location.host}${window.location.pathname}coms`;
const ws = new WebSocket(wsURL);

document.addEventListener("DOMContentLoaded", () => {
	contentDiv.innerHTML = connectingHTML;
	console.log("Connecting to the server...");
});

ws.onopen = () => {
	handleQueryParams();
	ws.onmessage = async (event) => {
		let message = JSON.parse(event.data);
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
			case "info":
				break;
			case "practice":
				switch (message.type) {
					case "startTrial":
						await RDKHandler.stopAnimation();
						await updateState(message.data, state);
						utils.clearContainer(contentDiv);
						await divHandler.startTrial(state.RDK.coherence);

						break;
					case "state":
						await updateState(message.data, state);
						break;
					case "load":
						let divID = message.data;
						await RDKHandler.setUp(
							divHandler.getDivPos(divID),
							divID,
							state.RDK.coherence[divID],
							state.RDK.direction[divID],
							state,
							canvas
						);
				}
				break;
		}
	};
};
