/*
[X] check and see if the block break info is actually shown or if it just jumps stright o instructions
[X] do one final check to see if everything switches and runs correctly all the way through.
*/

import {
	loadSepInstructions,
	loadCollabInstructions,
	loadEndGame,
	loadInstructions,
} from "../Content/Forms/instructions.js";
export default class Game {
	constructor(
		containerId,
		websocket,
		stage,
		block,
		id,
		platform,
		inProgress,
		currentStage,
		state
	) {
		/*
        Below setsup some of the initial variables for the game including the ids, 
        backgrounds colours and the canvas settings. 
        */
		this.ws = websocket;
		console.log("Game created");
		this.containerId = containerId;
		this.id = id;
		this.platform = platform;
		this.currentlyCompleting = false;
		this.allowMessage = false;
		console.log("Luke changes made 0409 1044am");
		this.container = document.getElementById(containerId);
		this.clearContainer();
		this.canvas = document.createElement("canvas");
		this.canvas.width = this.container.clientWidth;
		this.canvas.height = this.container.clientHeight;
		this.ctx = this.canvas.getContext("2d");
		this.setBackgroundColor("#808080"); // Initial background color
		this.container.appendChild(this.canvas);
		this.resizeCanvas();
		this.state = state;
		this.blockOrder = [];
		if (!inProgress) {
			this.stage = stage;
			this.block = block;
			this.ws.send(
				JSON.stringify({
					stage: this.stage,
					block: block,
					type: "instructionsComplete",
				})
			);
		} else if (inProgress) {
			switch (currentStage.stage) {
				case "practiceEnd":
					console.log("displaying instructions");
					this.stage = "game";
					this.block = currentStage.block;
					this.displayBlockInstructions(this.stage, currentStage.block);
					break;
				case "collabInstructions":
					console.log("displaying instructions");
					this.stage = "game";
					this.block = "collab";
					this.displayBlockInstructions(this.stage, this.block);
					break;
				case "sepInstructions":
					console.log("displaying instructions");
					this.stage = "game";
					this.block = "sep";
					this.displayBlockInstructions(this.stage, this.block);
					break;
				case "practice":
					this.stage = "practice";
					this.block = currentStage.block;
					this.breakdiv = this.handleReconnectMessage();
					break;
				case "game":
					this.stage = "game";
					this.block = currentStage.block;
					this.breakdiv = this.handleReconnectMessage();

					break;
			}
		}
		this.mouseOverHandler = this.mouseOverHandler.bind(this);
		this.mouseOutHandler = this.mouseOutHandler.bind(this);
		this.clickHandler = this.clickHandler.bind(this);
		this.handleKeyResponse = this.handleKeyResponse.bind(this);
		this.drawTimeout = null;
		this.generateDotMotionAperture = this.generateDotMotionAperture.bind(this);
		this.responseHandler = null;
		this.divCurrentlyCompleting = "";
		this.lastExecution = 0;
		this.throttleDelay = 25;
		this.expConsts = {
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
		// Reaction time vars below
		this.breakInfo = {
			p1Completed: 0,
			p2Completed: 0,
			completed: 0,
		};
		this.trialNo = 0;
		this.choiceTimestamp = Date.now();
		this.rtTimestamp = Date.now();
		this.totalRTTimestamp = Date.now();
		this.newDirectionTimeout = null;
		this.rAF;
		/*
        Below controls the images that are displayed on the canvas.
        This will be on a div that corresponds to a cetain difficulty level.
        */
		this.divs = {
			uncompleted: [],
			completed: [],
		};
		this.images = [
			"Content/Images/rdk_static1.png",
			"Content/Images/rdk_static2.png",
			"Content/Images/rdk_static3.png",
			"Content/Images/rdk_static4.png",
			"Content/Images/rdk_static1.png",
			"Content/Images/rdk_static2.png",
			"Content/Images/rdk_static3.png",
			"Content/Images/rdk_static4.png",
		];
		this.img = [];
		this.preloadImages(this.images, this.img);
		window.addEventListener("resize", () => this.resizeCanvas());

		this.coherenceDifficulties = {
			0.1: "Very Easy",
			0.2: "Easy",
			0.3: "Easy-Med",
			0.4: "Med",
			0.6: "Med-Hard",
			0.7: "Hard",
			0.8: "Very Hard",
			0.9: "Ext Hard",
		};

		/*
        Below is for recording and sending the mouse positions to the server. 
        This may then be displayed on the other persons screen. 
        */
		this.mousePos = {
			x: 0,
			y: 0,
		};

		document.addEventListener("keydown", this.handleKeyResponse);
		this.ws.onmessage = async (event) => {
			let data = JSON.parse(event.data);
			console.log(data);
			switch (data.stage) {
				case "practice":
					switch (data.type) {
						case "initialState":
							this.state = data.data;
							this.resetDivs();
							this.canvas = this.resetCanvas(this.canvas);
							this.ctx = this.canvas.getContext("2d");
							this.clearContainer();
							break;
						case "startTrial":
							this.state = this.updateState(data.data, data.block);
							this.choiceTimestamp = Date.now();
							this.trialNo += 1;
							this.createImages(this.img);
							this.handleDivInteraction(this.divs.uncompleted);
							break;
						case "load":
							this.totalRTTimestamp = Date.now();
							this.dotTimestamp = Date.now();
							this.currentlyCompleting = true;
							this.removeOtherDivs(
								this.divs.uncompleted,
								this.divs.completed,
								data.data
							);
							this.generateDotMotionAperture(
								data.data,
								this.divs.uncompleted,
								this.expConsts,
								this.state.RDK.direction[data.data]
							);
							break;
						case "completed":
							this.choiceTimestamp = Date.now();
							this.currentlyCompleting = false;
							this.stopAnimation();
							this.divs = await this.handleCompletedImages(
								data.data,
								this.divs
							);
							this.restoreImages(this.divs);
							break;
						case "newDirection":
							this.drawNewDirection(
								data.index,
								this.divs.uncompleted,
								this.expConsts,
								data.data
							);
							break;
						case "state":
							this.state = this.updateState(data.data, data.block);
							await this.checkUpdatedState(this.state);
							break;
						case "playerChoice":
							this.divs = this.handleCompletedImages(data.data, this.divs);
							break;
						case "break":
							if (this.drawTimeout) {
								clearTimeout(this.drawTimeout);
							}
							this.removeEventListeners(this.divs.uncompleted);
							this.stopAnimation();
							this.clearImageDivs();
							this.breakdiv = this.beginBreak(
								data.stage,
								data.block,
								data.data
							);
							break;
						case "alreadySelected":
							this.divs = await this.handleCompletedImages(
								data.data,
								this.divs
							);
							break;
						case "blockBreak":
							this.block = "collab";
							if (this.drawTimeout) {
								clearTimeout(this.drawTimeout);
							}
							this.breakdiv = this.displayBlockBreak(this.stage, this.block);
							break;
						case "practiceEnd":
							this.stage = "game";
							if (this.drawTimeout) {
								clearTimeout(this.drawTimeout);
							}
							this.displayBlockInstructions(this.stage, data.data);
							break;
					}
					break;
				case "game":
					switch (data.type) {
						case "initialState":
							this.trialNo = 0;
							this.state = data.data;
							this.clearContainer();
							this.canvas = this.resetCanvas(this.canvas);
							this.ctx = this.canvas.getContext("2d");
							this.resizeCanvas();
							this.resetDivs();
							break;
						case "startTrial":
							if (this.breakdiv) {
								this.breakdiv.remove();
							}
							this.choiceTimestamp = Date.now();
							this.trialNo += 1;
							this.state = this.updateState(data.data, data.block);
							this.createImages(this.img);
							this.handleDivInteraction(this.divs.uncompleted);
							break;
						case "load":
							this.totalRTTimestamp = Date.now();
							this.dotTimestamp = Date.now();
							this.currentlyCompleting = true;
							this.removeOtherDivs(
								this.divs.uncompleted,
								this.divs.completed,
								data.data
							);
							this.generateDotMotionAperture(
								data.data,
								this.divs.uncompleted,
								this.expConsts,
								this.state.RDK.direction[data.data]
							);

							break;
						case "completed":
							this.choiceTimestamp = Date.now();
							this.currentlyCompleting = false;
							this.stopAnimation();
							this.divs = await this.handleCompletedImages(
								data.data,
								this.divs
							);
							this.restoreImages(this.divs);
							break;
						case "newDirection":
							this.drawNewDirection(
								data.index,
								this.divs.uncompleted,
								this.expConsts,
								data.data
							);
							break;
						case "state":
							this.state = this.updateState(data.data, data.block);
							await this.checkUpdatedState(this.state);
							break;
						case "playerChoice":
							this.divs = await this.handleCompletedImages(
								data.data,
								this.divs
							);
							break;
						case "break":
							if (this.drawTimeout) {
								clearTimeout(this.drawTimeout);
							}
							this.removeEventListeners(this.divs.uncompleted);
							this.stopAnimation();
							this.clearImageDivs();
							this.breakdiv = this.beginBreak(
								data.stage,
								data.block,
								data.data
							);
							break;
						case "alreadySelected":
							this.divs = this.handleCompletedImages(data.data, this.divs);
							break;
						case "endBlock":
							if (this.drawTimeout) {
								clearTimeout(this.drawTimeout);
							}
							this.handleInstructionsBreak(data.stage, data.block, data.data);
							break;
					}
			}
		};
	}

	preloadImages(imageList, imgArray) {
		imageList.forEach((image) => {
			const img = new Image();
			img.src = image;
			imgArray.push(img);
		});
	}

	resetCanvas(canvas) {
		canvas.remove();
		let canvas2 = document.createElement("canvas");
		canvas2.width = this.container.clientWidth;
		canvas2.height = this.container.clientHeight;
		this.ctx = canvas2.getContext("2d");
		if (this.container) {
			this.container.appendChild(canvas2);
		} else {
			let container = document.getElementById(this.containerId);
			container.appendChild(canvas2);
		}
		return canvas2;
	}
	resizeCanvas() {
		this.canvas.width = this.container.clientWidth;
		this.canvas.height = this.container.clientHeight;
	}
	displayBlockInstructions(stage, block) {
		console.log("displaying block instructions");
		this.stage = stage;
		this.block = block;
		this.allowMessage = false;
		if (block === "sep") {
			loadSepInstructions("main", this.ws);
		} else if (block === "collab") {
			loadCollabInstructions("main", this.ws);
		}
	}
	createTimestamp(timestamp) {
		let newTime = Date.now();
		let diff = newTime - timestamp;
		return diff;
	}
	render() {
		// Clear canvas
		this.ctx.fillStyle = this.backgroundColor;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
	}
	clearContainer() {
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
	static loadContent(contentLoader, ...args) {
		contentLoader(...args);
	}
	handleReconnectMessage() {
		const breakDiv = document.createElement("div");
		let breakText = "";
		breakText = `<div align="center">
				<h1> Reconnected </h1>
				<p> 
				It appears you refreshed the page. Please wait for the next trial/break to start!
				</p>
				</div>`;
		breakDiv.className = "breakDiv";
		breakDiv.style.position = "absolute";
		breakDiv.style.top = "0";
		breakDiv.style.left = "0";
		breakDiv.style.width = "100%";
		breakDiv.style.height = "100%";
		breakDiv.style.display = "flex";
		breakDiv.style.justifyContent = "center"; // Center horizontally
		breakDiv.style.alignItems = "center"; // Center vertically
		breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
		breakDiv.innerHTML = breakText;

		// Append breakDiv to the document body or another parent element
		document.body.appendChild(breakDiv); // Example: Append to body

		// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
		return breakDiv;
	}
	resetDivs() {
		this.divs.completed = [];
		this.divs.uncompleted = [];
	}
	findKeyByValue(obj, value) {
		return Object.keys(obj).find((key) => obj[key] === value);
	}
	createImages(images) {
		if (this.breakdiv) {
			this.breakdiv.remove();
		}
		this.stopAnimation();
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas
		const pixelPos = [
			// Top Center
			[this.canvas.height / 8, this.canvas.width / 2],
			// Top Right
			[this.canvas.height / 4, (this.canvas.width / 4) * 3],
			// Right Center
			[this.canvas.height / 2, (this.canvas.width / 8) * 7],
			// Bottom Right
			[(this.canvas.height / 4) * 3, (this.canvas.width / 4) * 3],
			// Bottom Center
			[(this.canvas.height / 8) * 7, this.canvas.width / 2],
			// Bottom Left
			[(this.canvas.height / 4) * 3, this.canvas.width / 4],
			// Left Center
			[this.canvas.height / 2, this.canvas.width / 8],
			// Top Left
			[this.canvas.height / 4, this.canvas.width / 4],
		];
		for (let i = 0; i < Object.keys(this.coherenceDifficulties).length; i++) {
			const div = document.createElement("div");
			const img = images[i];

			let coherence = this.state.RDK.coherence[i];
			let difficulty = this.coherenceDifficulties[coherence];
			img.style.width = "75px"; // Set image width
			img.style.height = "75px"; // Set image height
			div.style.position = "absolute";
			div.style.width = "75px";
			div.style.height = "75px";
			div.style.left = `${pixelPos[i][1] - 37.5}px`; // Center the div horizontally
			div.style.top = `${pixelPos[i][0] - 37.5}px`; // Center the div vertically
			div.id = i;
			div.appendChild(img); // Append image to the div
			this.divs.uncompleted.push(div); // Store reference to the div
			this.displayDifficultyText(div, difficulty, i); // Display difficulty text
			this.container.appendChild(div);
		}
	}
	handleInstructionsBreak(stage, block, data) {
		if (this.breakdiv) {
			this.breakdiv.remove();
		}
		if (stage === "game") {
			switch (data) {
				case "endBlock":
					switch (block) {
						case "sep":
							this.block = "collab";
							this.displayBlockInstructions(stage, this.block);
							break;
						case "collab":
							this.block = "sep";
							this.displayBlockInstructions(stage, this.block);
					}
					break;
				case "endExp":
					loadEndGame("main", this.ws, this.id, this.platform);
					break;
			}
		}
	}
	beginBreak(blockType, block, data) {
		this.allowMessage = false;
		if (this.breakdiv) {
			this.breakdiv.remove();
		}
		if (blockType === "game") {
			if (block === "sep") {
				document.removeEventListener("keyup", this.responseHandler);
				// Create a div element for the break overlay
				const breakDiv = document.createElement("div");
				let breakText = "";
				breakText = `<div align="center">
				<h1> Break </h1>
				<p> 
				You have completed ${this.state.trialNo + 1} of ${
					this.expConsts.blockLength
				} trials in this block. Please take a 6 second break.
				</p>
				<p>
				You completed ${data.P1completed} out of 8 tasks in 6 seconds. <br>
				You will have 6 seconds to complete the next trial
				</p>
				</div>`;
				breakDiv.className = "breakDiv";
				breakDiv.style.position = "absolute";
				breakDiv.style.top = "0";
				breakDiv.style.left = "0";
				breakDiv.style.width = "100%";
				breakDiv.style.height = "100%";
				breakDiv.style.display = "flex";
				breakDiv.style.justifyContent = "center"; // Center horizontally
				breakDiv.style.alignItems = "center"; // Center vertically
				breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
				breakDiv.innerHTML = breakText;

				// Append breakDiv to the document body or another parent element
				document.body.appendChild(breakDiv); // Example: Append to body

				// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
				return breakDiv;
			} else if (block === "collab") {
				this.stopAnimation(); // Assuming this method stops some animation
				this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas
				this.clearImageDivs(); // Clear the image divs
				document.removeEventListener("keyup", this.responseHandler);
				let breakText = "";
				breakText = `<div align="center">
				<h1> Break </h1>
				<p> 
				You have completed ${this.state.trialNo + 1} of ${
					this.expConsts.blockLength
				} trials in this block. Please take a 6 second break.
				</p>
				<p>
				You completed ${data.P1completed} tasks and your partner completed ${
					data.P2completed
				} tasks out of 8 <br>
				in 6 seconds. <br>
				You will have 6 seconds to complete the next trial
				</p>
				</div>`;

				// Create a div element for the break overlay
				const breakDiv = document.createElement("div");
				breakDiv.className = "breakDiv";
				breakDiv.style.position = "absolute";
				breakDiv.style.top = "0";
				breakDiv.style.left = "0";
				breakDiv.style.width = "100%";
				breakDiv.style.height = "100%";
				breakDiv.style.display = "flex";
				breakDiv.style.justifyContent = "center"; // Center horizontally
				breakDiv.style.alignItems = "center"; // Center vertically
				breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
				breakDiv.innerHTML = breakText;

				// Append breakDiv to the document body or another parent element
				document.body.appendChild(breakDiv); // Example: Append to body

				// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
				return breakDiv;
			}
		} else if (blockType === "practice") {
			if (block === "sep") {
				this.stopAnimation(); // Assuming this method stops some animation
				this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas
				this.clearImageDivs(); // Clear the image divs
				document.removeEventListener("keyup", this.responseHandler);
				let breakText = "";

				breakText = `<div align="center">
				<h1> Break </h1>
				<p> 
				You have completed ${
					this.state.trialNo + 1
				} of 10 practice trials. Please take a 12 second break.
				</p>
				<p>
				You completed ${data.P1completed} out of 8 tasks in 12 seconds. <br>
				You will have 12 seconds to complete the next trial
				</p>
				</div>`;

				// Create a div element for the break overlay
				const breakDiv = document.createElement("div");
				breakDiv.className = "breakDiv";
				breakDiv.style.position = "absolute";
				breakDiv.style.top = "0";
				breakDiv.style.left = "0";
				breakDiv.style.width = "100%";
				breakDiv.style.height = "100%";
				breakDiv.style.display = "flex";
				breakDiv.style.justifyContent = "center"; // Center horizontally
				breakDiv.style.alignItems = "center"; // Center vertically
				breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
				breakDiv.innerHTML = breakText;

				// Append breakDiv to the document body or another parent element
				document.body.appendChild(breakDiv); // Example: Append to body

				// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
				return breakDiv;
			} else if (block === "collab") {
				if (this.trialNo === 7) {
					this.stopAnimation(); // Assuming this method stops some animation
					this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas
					this.clearImageDivs(); // Clear the image divs
					document.removeEventListener("keyup", this.responseHandler);
					let breakText = "";
					breakText = `<div align="center">
					<h1> Break </h1>
					<p> 
					You have completed ${this.trialNo} of 10 practice trials. Please take a 12 second break.
					</p>
					<p>
					You completed ${data.P1completed} tasks and your partner completed ${data.P2completed} tasks out of 8.
					</p>
					<p> 
					The next 3 trials will be completed the same as the experiment. The trial will last 6 seconds, with a 6 second break inbetween trials. 
					</p>
					</div>`;

					// Create a div element for the break overlay
					const breakDiv = document.createElement("div");
					breakDiv.className = "breakDiv";
					breakDiv.style.position = "absolute";
					breakDiv.style.top = "0";
					breakDiv.style.left = "0";
					breakDiv.style.width = "100%";
					breakDiv.style.height = "100%";
					breakDiv.style.display = "flex";
					breakDiv.style.justifyContent = "center"; // Center horizontally
					breakDiv.style.alignItems = "center"; // Center vertically
					breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
					breakDiv.innerHTML = breakText;

					// Append breakDiv to the document body or another parent element
					document.body.appendChild(breakDiv); // Example: Append to body

					// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
					return breakDiv;
				} else if (this.trialNo < 7) {
					this.stopAnimation(); // Assuming this method stops some animation
					this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas
					this.clearImageDivs(); // Clear the image divs
					document.removeEventListener("keyup", this.responseHandler);
					let breakText = "";
					breakText = `<div align="center">
					<h1> Break </h1>
					<p> 
					You have completed ${
						this.state.trialNo + 1
					} of 10 practice trials. Please take a 12 second break.
					</p>
					<p>
					You completed ${data.P1completed} tasks and your partner completed ${
						data.P2completed
					} tasks out of 8 in 12 seconds. <br>
					You will have 12 seconds to complete the next trial. 
					</p>
					</div>`;

					// Create a div element for the break overlay
					const breakDiv = document.createElement("div");
					breakDiv.className = "breakDiv";
					breakDiv.style.position = "absolute";
					breakDiv.style.top = "0";
					breakDiv.style.left = "0";
					breakDiv.style.width = "100%";
					breakDiv.style.height = "100%";
					breakDiv.style.display = "flex";
					breakDiv.style.justifyContent = "center"; // Center horizontally
					breakDiv.style.alignItems = "center"; // Center vertically
					breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
					breakDiv.innerHTML = breakText;

					// Append breakDiv to the document body or another parent element
					document.body.appendChild(breakDiv); // Example: Append to body

					// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
					return breakDiv;
				} else {
					this.stopAnimation(); // Assuming this method stops some animation
					this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the canvas
					this.clearImageDivs(); // Clear the image divs
					document.removeEventListener("keyup", this.responseHandler);
					let breakText = "";
					breakText = `<div align="center">
					<h1> Break </h1>
					<p> 
					You have completed ${
						this.state.trialNo + 1
					} of 10 practice trials. Please take a 6 second break.
					</p>
					<p>
					You completed ${data.P1completed} tasks and your partner completed ${
						data.P2completed
					} tasks out of 8 in 6 seconds. <br>
					You will have 6 seconds to complete the next trial. 
					</p>
					</div>`;

					// Create a div element for the break overlay
					const breakDiv = document.createElement("div");
					breakDiv.className = "breakDiv";
					breakDiv.style.position = "absolute";
					breakDiv.style.top = "0";
					breakDiv.style.left = "0";
					breakDiv.style.width = "100%";
					breakDiv.style.height = "100%";
					breakDiv.style.display = "flex";
					breakDiv.style.justifyContent = "center"; // Center horizontally
					breakDiv.style.alignItems = "center"; // Center vertically
					breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
					breakDiv.innerHTML = breakText;

					// Append breakDiv to the document body or another parent element
					document.body.appendChild(breakDiv); // Example: Append to body

					// Optionally, you might want to return breakDiv if you need to manipulate or remove it later
					return breakDiv;
				}
			}
		}
	}

	displayBlockBreak(stage, block) {
		this.allowMessage = false;
		if (stage === "practice") {
			this.stopAnimation();
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.clearImageDivs();
			document.removeEventListener("keyup", this.responseHandler);
			let breakText = "";
			breakText = `<div align="center">
			<h1> Break </h1>
			<p> 
			You have completed ${
				this.state.trialNo + 1
			} of 10 practice trials. Please take a short 20 second break.
			</p>
			<p>
			The next 5 trials will be completed with a partner. 
			</p>
			</div>`;
			const breakDiv = document.createElement("div");
			breakDiv.style.position = "absolute";
			breakDiv.style.top = "0";
			breakDiv.style.left = "0";
			breakDiv.style.width = "100%";
			breakDiv.style.height = "100%";
			breakDiv.style.display = "flex";
			breakDiv.style.justifyContent = "center"; // Center horizontally
			breakDiv.style.alignItems = "center"; // Center vertically
			breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background
			breakDiv.innerHTML = breakText;
			document.body.appendChild(breakDiv);
			setTimeout(() => {
				this.ws.send(
					JSON.stringify({
						stage: stage,
						block: block,
						type: "gameReady",
					})
				);
			}, this.expConsts.blockBreak * 1000);
			return breakDiv;
		} else if (stage === "game") {
			this.stopAnimation();
			document.removeEventListener("keyup", this.responseHandler);
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
			this.clearImageDivs();
			let breakText = "";
			breakText = `<div align="center">
				<p> 
				You have completed ${
					this.state.trialNo + 1
				} of 40 trials. You are now halfway through the Experiment! Please take a short 30 second break.
				</p>
				<p>
				You completed ${data.P1completed} tasks out of 8. <br>
				</p>
				</div>`;
			const breakDiv = document.createElement("div");
			breakDiv.style.position = "absolute";
			breakDiv.style.top = "0";
			breakDiv.style.left = "0";
			breakDiv.style.width = "100%";
			breakDiv.style.height = "100%";
			breakDiv.style.display = "flex";
			breakDiv.style.justifyContent = "center"; // Center horizontally
			breakDiv.style.alignItems = "center"; // Center vertically
			breakDiv.style.backgroundColor = "#808080"; // Semi-transparent black background

			const breakTextDiv = document.createElement("div");
			breakTextDiv.style.color = "#000000";
			breakTextDiv.style.fontSize = "24px";
			breakTextDiv.textContent = breakText;
			breakDiv.appendChild(breakTextDiv);
			document.body.appendChild(breakDiv);
			setTimeout(() => {
				this.ws.send(
					JSON.stringify({
						stage: stage,
						block: block,
						type: "gameReady",
					})
				);
			}, this.expConsts.blockBreak * 1000);
			return breakDiv;
		}
	}

	updateState(data, block) {
		let newState = data;
		return newState;
	}

	clearImageDivs() {
		if (this.divs && this.img) {
			for (let img of this.img) {
				img.style.display = "block";
			}
			// Remove completed divs
			this.divs.completed.forEach((div) => this.removeElement(div));
			// Remove uncompleted divs
			this.divs.uncompleted.forEach((div) => this.removeElement(div));

			// Reset imageDivs to empty arrays
			this.divs.completed = [];
			this.divs.uncompleted = [];
		}
	}
	removeElement(element) {
		if (element && element.parentNode) {
			element.parentNode.removeChild(element);
		}
	}

	mouseOverHandler(event) {
		event.currentTarget.style.border = "1px solid white";
	}

	mouseOutHandler(event) {
		event.currentTarget.style.border = "none";
	}

	clickHandler(event) {
		if (this.divs.uncompleted.includes(event.currentTarget)) {
			let choiceEndTime = this.createTimestamp(this.choiceTimestamp);
			event.currentTarget.style.border = "none";
			this.ws.send(
				JSON.stringify({
					stage: this.stage,
					block: this.block,
					type: "difficulty",
					difficulty: event.currentTarget.id,
					rt: choiceEndTime,
				})
			);
		} else {
			this.restoreImages(this.divs);
		}
	}
	handleKeyResponse(event) {
		event.preventDefault();
		if (!this.allowMessage) {
			return;
		}
		if (event.key === "x") {
			let dotRT = this.createTimestamp(this.dotTimestamp);
			let totalRT = this.createTimestamp(this.totalRTTimestamp);
			this.ws.send(
				JSON.stringify({
					stage: this.stage,
					block: this.block,
					type: "response",
					index: this.divCurrentlyCompleting,
					data: "right",
					rt: dotRT,
					totalRt: totalRT,
				})
			);
			this.allowMessage = false;
		} else if (event.key === "z") {
			let dotRT = this.createTimestamp(this.dotTimestamp);
			let totalRT = this.createTimestamp(this.totalRTTimestamp);
			this.ws.send(
				JSON.stringify({
					stage: this.stage,
					block: this.block,
					type: "response",
					index: this.divCurrentlyCompleting,
					data: "left",
					rt: dotRT,
					totalRt: totalRT,
				})
			);
			this.allowMessage = false;
		}
	}
	async checkUpdatedState(state, block) {
		if (block === "sep") {
			return;
		} else if (block === "collab") {
			if (!this.currentlyCompleting) {
				for (let choice in state.RDK.choice) {
					if (this.divs.uncompleted.includes(choice)) {
						this.divs = await this.handleCompletedImages(choice, this.divs);
						this.restoreImages(this.divs);
					}
				}
			}
		}
	}
	handleCompletedImages(ID, divObj) {
		// Check if the ID exists in divObj.uncompleted
		let completedDiv = divObj.uncompleted.find((div) => div.id === ID);
		if (!completedDiv) {
			return divObj; // Return the original divObj without any changes
		}

		// Add the completedDiv to divObj.completed
		divObj.completed.push(completedDiv);

		// Remove the completedDiv from divObj.uncompleted
		divObj.uncompleted = divObj.uncompleted.filter((div) => div.id !== ID);
		this.restoreCompletedImages(divObj);

		return divObj;
	}
	restoreCompletedImages(divObj) {
		for (let div of divObj.completed) {
			if (!div) {
				console.warn("Skipped null or undefined div.");
				continue;
			}
			this.removeEventListeners(div);

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
	restoreUncompletedImages(divObj) {
		for (let div of divObj.uncompleted) {
			div.style.opacity = 1;
			let difficultyText = div.querySelector("div");

			if (difficultyText) {
				difficultyText.style.display = "block";
			}
		}
		this.handleDivInteraction(divObj.uncompleted);
	}
	restoreImages(divObj) {
		if (this.currentlyCompleting) {
			return;
		} else {
			this.restoreCompletedImages(divObj);
			this.restoreUncompletedImages(divObj);
			this.choiceStartTime = performance.now();
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
		difficultyText.id = id;
		parentDiv.appendChild(difficultyText);
	}
	removeDiv(divList) {
		for (let div of divList) {
			div.style.opacity = "0.5";
			this.removeEventListeners(div);
		}
	}

	handleDivInteraction(divList) {
		for (let div of divList) {
			div.addEventListener("mouseover", this.mouseOverHandler);
			div.addEventListener("mouseout", this.mouseOutHandler);
			div.addEventListener("click", this.clickHandler);
		}
	}

	removeEventListeners(div) {
		document.removeEventListener("keyup", this.responseHandler);
		if (div && div.parentNode) {
			div.removeEventListener("mouseover", this.mouseOverHandler);
			div.removeEventListener("mouseout", this.mouseOutHandler);
			div.removeEventListener("click", this.clickHandler);
		}
	}

	removeOtherDivs(divList1, divList2, selectedDiv) {
		for (let div of divList1) {
			this.removeEventListeners(div);
			if (div.id !== selectedDiv) {
				div.style.opacity = "0.5";
			}
			if (div.id === selectedDiv) {
				this.removeEventListeners(div);
				let difficultyText = div.querySelector("div");
				if (difficultyText) {
					difficultyText.style.display = "none";
				}
			}
		}
		for (let div of divList2) {
			div.style.opacity = "0.5";
		}
	}
	drawNewDirection(Index, divlist, expConsts, direction) {
		this.stopAnimation();
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.allowMessage = false;
		this.drawTimeout = setTimeout(() => {
			this.dotTimestamp = Date.now();
			this.generateDotMotionAperture(Index, divlist, expConsts, direction);
		}, expConsts.pauseDuration);
	}
	drawDot(x, y) {
		this.ctx.fillStyle = this.expConsts.dotColor;
		this.ctx.beginPath();
		this.ctx.arc(x, y, this.expConsts.dotRad, 0, Math.PI * 2, true);
		this.ctx.closePath();
		this.ctx.fill();
	}
	drawCircle(centerX, centerY, radius) {
		// Adjust canvas size to cover the entire window
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;

		// Draw the circle
		this.ctx.beginPath();
		this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
		this.ctx.fillStyle = "#808080";
		this.ctx.fill();
		this.ctx.strokeStyle = "black"; // Set border color to the provided borderColor
		this.ctx.lineWidth = 1; // Optionally, set the border width
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
		if (!this.animating) return;

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
			this.rAF = requestAnimationFrame(() =>
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
			const color = direction === "random" ? "red" : "green";
			if (
				Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) <= apertureRadius
			) {
				this.drawDot(x, y, color);
			}
		}

		// Request next animation frame if still animating
		if (this.animating) {
			requestAnimationFrame(() =>
				this.animateDots(centerX, centerY, apertureRadius)
			);
		}
	}

	stopAnimation() {
		cancelAnimationFrame(this.rAF);
		this.animating = false;
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
	}
	generateDotMotionAperture(divID, divlist, expConsts, direction) {
		// Clear previous drawings
		this.divCurrentlyCompleting = divID;
		this.allowMessage = true;
		this.currentlyCompleting = true;
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.setzIndex = 1;
		let coherence = this.state.RDK.coherence[divID];

		// Find the correct div based on divID
		const selectedDiv = divlist.find((div) => div.id === divID);
		if (!selectedDiv) {
			this.restoreCompletedImages(this.divs);
			return;
		}
		const divImage = selectedDiv.querySelector("img");
		const divText = selectedDiv.querySelector("div");
		divImage.style.display = "none"; // Hide the image
		divText.style.display = "none"; // Hide the difficulty text
		if (selectedDiv) {
			const centerX = selectedDiv.offsetLeft + selectedDiv.clientWidth / 2;
			const centerY = selectedDiv.offsetTop + selectedDiv.clientHeight / 2;
			const apertureRadius = expConsts.apertureRad;
			const nDots = expConsts.nDots;
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
			this.animating = true;
			this.animateDots(centerX, centerY, apertureRadius);
		}
	}
	setBackgroundColor(color) {
		this.backgroundColor = color;
		this.render();
	}
	destroy() {
		// Clean up canvas and remove event listener
		this.canvas.remove();

		// Remove resize event listener
		window.removeEventListener("resize", this.resizeCanvas.bind(this));

		// Stop any ongoing animations
		this.animating = false;

		// Remove mouse event listeners if they were added to the canvas

		// Clear image divs
		this.clearImageDivs();

		// Remove mouse over, out, and click handlers for each div
		for (let div of this.divs.uncompleted.concat(this.divs.completed)) {
			this.removeEventListeners(div);
		}

		// Remove response handler if exists
		if (this.responseHandler) {
			document.removeEventListener("keyup", this.responseHandler);
		}
		document.removeEventListener("keyup", this.responseHandler);
		document.removeEventListener("mouseover", this.mouseOverHandler);
		document.removeEventListener("mouseout", this.mouseOutHandler);
		this.ws.send(
			JSON.stringify({
				stage: this.stage,
				block: this.block,
				type: "destroy",
			})
		);
	}
}
