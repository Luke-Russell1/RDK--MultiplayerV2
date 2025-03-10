/*
This file contains the HTML for the instructions that are displayed to the user at the start of the experiment and during each block. 
MAY NEED TO ADD A REDIRECT FOR PROLIFIC OR SONA PARTICIPANTS AT THE END, DEPENDING ON HOW THE EXPERIMENT IS BEING RUN
*/
let instructionDiv;
let minInstructionTime = 2 * 1000;
async function addWaitingMessage(targetElement) {
	const waitingMessage = document.createElement("p");
	waitingMessage.innerText = "Waiting for other player...";
	waitingMessage.style.textAlign = "center";
	waitingMessage.style.fontSize = "16px";
	waitingMessage.style.color = "black";
	targetElement.appendChild(waitingMessage);
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

const instructionsHTML = `
<div style="text-align: center;">
<h1>Instructions</h1>
</div>

<div class = "instructions" align="center">
<p> In this experiment, you will be asked to select an image displaying a number of dots moving on the screen. Within this image, some of the dots will be moving in the same direction (either left or right)
 and others will be moving in a random direction. Your task is to identify the direction in which the majority of the dots are moving. This will vary from very easy, where many of the dots are moving
 in the same direction, to very difficult, where only a few dots are moving in the same direction, responding as quickly and accurately as you can.</p>
<p> There are two blocks consisting of 30 trials 6 seconds in length, 60 trials in total. In one block you will perform this by yourself, and in the other you will be paired with another participant. <br>
The experiment will take roughly 30 minutes to complete. </p>
<p> During the experiment you will encounter several instructions pages where you can take your time to read it, requiring your to press enter to continue. <br>
While we encourage you to take your time to read and understand these instructions, we also encourage you to consider the other person completing the experiment with you <br>
and respect their time.  </p>
<p> We appreciate your participation</p>
</div>
`;
async function loadInstructions(targetElementId, ws) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		targetElement.innerHTML = instructionsHTML;
		instructionDiv = targetElement.querySelector(".instructions");
		// Ensure the event listener is not attached more than once
		const keyPressHandler = async (event) => {
			if (event.key === "Enter") {
				document.removeEventListener("keyup", keyPressHandler);
				loadPracticeInstructions(targetElementId, ws);
			} else {
				return;
			}
		};

		// Add the event listener
		setTimeout(async () => {
			instructionDiv.innerHTML += `<p style="text-align: center;">Please press enter to continue to the next instructions page</p>`;
			document.addEventListener("keyup", keyPressHandler);
		}, minInstructionTime);
	} else {
		console.error(`Target element with ID '${targetElementId}' not found.`);
	}
}
const practiceInstructionsHTML = `
<div style="text-align: center;">
<h1>Practice Instructions</h1>
</div>
<div class = "practiceInstructions" align="center">
<p> In this block, you will complete 10 trials, 5 by yourself and 5 with your partner. You are free to select the order in which you complete the different dot motion difficulties. <br>
Initially, the trials will be 12 seconds with a 12 second break. Later it will switch to 6 second trials with a 6 second break, matching the experiment. <br>
Here, you will use the mouse to select a task by clicking on it, then responding with either "Z" for left or "X" for right when you think you know which direction the dots are moving. <br>
If you respond incorrectly, there will be a 500ms delay before you can respond again. Tasks you have completed, or that your partner have completed will be greyed out.<br> </p>
<p>
Please try and complete each task as quickly and accurately as possible. <br>
</p>
</div>
`;
let practiceInstructionsHandler;

async function loadPracticeInstructions(targetElementId, ws) {
	const targetElement = document.getElementById(targetElementId);
	if (!targetElement) {
		console.error(`Target element with ID '${targetElementId}' not found.`);
		return;
	}

	// Insert practice instructions HTML
	targetElement.innerHTML = practiceInstructionsHTML;
	instructionDiv = targetElement.querySelector(".practiceInstructions");
	// Define the event handler function
	practiceInstructionsHandler = async (event) => {
		if (event.key === "Enter") {
			// Remove the event listener after handling
			console.log("enter key pressed");
			document.removeEventListener("keyup", practiceInstructionsHandler);
			addWaitingMessage(targetElement);
			await handleStartExperiment(ws);
			// Resolve the promise
		}
	};
	// Add the event listener
	setTimeout(async () => {
		instructionDiv.innerHTML += `<p style="text-align: center;">Please press enter to continue to the practice trials</p>`;
		document.addEventListener("keyup", practiceInstructionsHandler);
	}, minInstructionTime * 1000);
}

async function handleStartExperiment(ws) {
	try {
		console.log("Sending start practice instruction");
		const message = JSON.stringify({
			stage: "intro",
			type: "completedInstructions",
		});
		await sendMessage(ws, message);
	} catch (error) {
		console.error("Unable to send start practice instruction:", error);
	}
}

const sepInstructionsHTML = `
<div style="text-align: center;">
<h1>Instructions</h1>
</div>
<div class = "sepInstructions align="center">
<p> 
In this block, you will complete the 30 trials by yourself. You are free to select the order in which you complete the different dot motion difficulties. 
Each trial will last 6 seconds, with a 6 second break inbetween trials. <br>
Remember to select the difficulty by clicking, and responding with "Z" for left and "X" for right. Be careful of the 500ms incorrect penalty!
</p>
<p>
Please try and complete each trial as quickly and accurately as possible. <br>
 Please press enter to begin the block
</p>
</div>
`;
let sepInstructionsHandler = null;

async function loadSepInstructions(targetElementId, ws, messageHandler) {
	const targetElement = document.getElementById(targetElementId);

	if (!targetElement) {
		console.error(`Target element with ID '${targetElementId}' not found.`);
		return;
	}
	console.log("loading sep instructions");
	// Insert SEP instructions HTML
	targetElement.innerHTML = sepInstructionsHTML;

	// Remove any existing event listener for keyup
	if (typeof sepInstructionsHandler !== "undefined") {
		document.removeEventListener("keyup", sepInstructionsHandler);
	}

	// Define the event handler function
	const enterKeyPromise = new Promise((resolve) => {
		const sepInstructionsHandler = async (event) => {
			if (event.key === "Enter") {
				// Remove the event listener
				document.removeEventListener("keyup", sepInstructionsHandler);
				// Resolve the promise
				resolve();
			}
		};
		// Add the event listener
		document.addEventListener("keyup", sepInstructionsHandler);
	});

	// Timer promise to handle timeout
	const timerPromise = new Promise((resolve) => {
		setTimeout(() => {
			console.log("timer expired");
			resolve();
		}, 30 * 1000); // 30 seconds
	});

	try {
		await Promise.race([enterKeyPromise, timerPromise]);

		// Handle SEP instructions completion
		await addWaitingMessage(targetElement);
		await handleSepInstructions(ws);
		// Display waiting message
	} catch (error) {
		console.error("An error occurred:", error);
	}
}

async function handleSepInstructions(ws) {
	console.log("Sending SEP instructions message");
	try {
		const message = JSON.stringify({
			stage: "game",
			block: "sep",
			type: "instructionsComplete",
		});
		await sendMessage(ws, message);
	} catch (error) {
		console.error("Unable to send SEP instructions message:", error);
	}
}

const collabInstructionsHTML = `
<div style="text-align: center;">
<h1>Instructions</h1>
</div>
<div class = "collabInstructions" align="center">
<p> In this block, you will complete 30 trials paired with another participant. You are free to select the order in which you complete the different dot motion difficulties, although you cannot complete one that your partner is completing, 
or has already completed. Each trial will last 6 seconds, with a 6 second break inbetween trials. <br> 
Remember to select the difficulty by clicking, and responding with "Z" for left and "X" for right. Be careful of the 500ms incorrect penalty! </p>
<p> Please try and complete each trial as quickly and accurately as possible. </p> 
<p> Please press enter to begin the block </p>
`;
let collabInstructionsHandler;

async function loadCollabInstructions(targetElementId, ws) {
	/* 
	Do I really need to have the promise.race condition here? I wonder if I can get around that
	by removing the {once} tag on the event listener it should just fire fine? 

	Maybe I should add a part where there is an overall timeout to protect against people just waiting there 
	at the start and being a dick
	*/
	const targetElement = document.getElementById(targetElementId);
	if (!targetElement) {
		console.error(`Target element with ID '${targetElementId}' not found.`);
		return;
	}
	console.log("loading collab instructions");

	// Insert collaboration instructions HTML
	targetElement.innerHTML = collabInstructionsHTML;

	// Define the event handler function
	const enterKeyPromise = new Promise((resolve) => {
		collabInstructionsHandler = async (event) => {
			if (event.key === "Enter") {
				console.log("enter key pressed");
				// Remove the event listener after handling
				document.removeEventListener("keydown", collabInstructionsHandler);
				// Resolve the promise
				resolve();
			}
		};
		// Add the event listener
		document.addEventListener("keydown", collabInstructionsHandler);
	});

	// Timer promise to handle timeout
	const timerPromise = new Promise((resolve) => {
		setTimeout(() => {
			console.log("timer expired");
			resolve();
		}, 30 * 1000); // 30 seconds
	});

	try {
		await Promise.race([enterKeyPromise, timerPromise]);
		// Handle collaboration instructions completion
		addWaitingMessage(targetElement);
		await handleCollabInstructions(ws);
		// Create and insert the "waiting for other player" message
	} catch (error) {
		console.error("An error occurred:", error);
	}
}

async function handleCollabInstructions(ws) {
	try {
		console.log("Sending collaboration message");
		const message = JSON.stringify({
			stage: "game",
			block: "collab",
			type: "instructionsComplete",
		});
		await sendMessage(ws, message);
	} catch (error) {
		console.error("Unable to send collaboration instructions message:", error);
	}
}

const endGameHTML = `
<div style="text-align: center;">
<h1>End of Experiment</h1>
</div>
<div class = "end-of-experiment" align="center">
<p> Congratulations! You have now completed the experiment, we appreciate your participation. </p>
<p> Your participation in this experiment is fascilitating an invesitgation into how people make decisions and schedule tasks 
both by themselves and in a team environment. We aim to investigate how and why people deviate from the "optimal" decision making process. 
For example, in the task you just completed, the optimal strategy to get the most reward for time invested was to complete each task from easiest to hardest.
Why do people deviate from this strategy, and how do they progress to this strategy (or something close to it) as the task continues? How is this process
different for those operating by themselves versus with a partner? These are the questions and processes we wish to investigate. <br>
If you would like more information or have any questions, please contact Luke Russell at: 
 LRussell1@uon.edu.au </p>
<p> Thank you for your time and participation. This connection will close in 2 minutes, and you will be redirected. </p>
<p> Or, press enter to complete the experiment and return to either Prolific or SONA</p>
</div>`;

let endGameHandler = null;
function loadEndGame(targetElementId, ws, id, platform) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		targetElement.innerHTML = endGameHTML;
		if (endGameHandler) {
			document.removeEventListener("keydown", endGameHandler);
		}
		endGameHandler = function (event) {
			if (event.key === "Enter") {
				handleRedirect(ws, platform, id);
			}
		};
		document.addEventListener("keydown", endGameHandler);
		setTimeout(() => {
			handleRedirect(ws, platform, id);
		}, 2 * 60 * 1000);
	} else {
		console.error(`Target element with ID '${targetElementId}' not found.`);
	}
}
function handleRedirect(ws, platform, id) {
	if (platform === "Prolific") {
		window.location.replace(
			"https://app.prolific.com/submissions/complete?cc=CHVSXHS4"
		);
	} else if (platform === "SONA") {
		window.location.replace(
			`https://newcastle.sona-systems.com/webstudy_credit.aspx?experiment_id=1754&credit_token=ae4e2ac4b9aa43e6ac66289fe0a48998&survey_code=${id}`
		);
	} else if (platform === "") {
		const queryParams = new URLSearchParams(window.location.search);
		const urlPlatform = queryParams.get(origin);
		const urlID = queryParams.get(survey_code);
		if (urlPlatform === "Prolific" || urlPlatform === "prolific") {
			window.location.replace(
				"https://app.prolific.com/submissions/complete?cc=CHVSXHS4"
			);
		} else if (urlPlatform === "SONA") {
			window.location.replace(
				`https://newcastle.sona-systems.com/webstudy_credit.aspx?experiment_id=1754&credit_token=ae4e2ac4b9aa43e6ac66289fe0a48998&survey_code=${urlID}`
			);
		}
	}
}
export {
	loadInstructions,
	loadSepInstructions,
	loadCollabInstructions,
	loadEndGame,
	sendMessage,
};
