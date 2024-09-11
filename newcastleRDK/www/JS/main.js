import {
	loadWaitingRoom,
	loadWaitingExpEndRoom,
} from "../Content/Forms/waitingRoom.js";
import { loadConsentForm } from "../Content/Forms/consentForm.js";
import { loadInstructions } from "../Content/Forms/instructions.js";
import Game from "./Game.js";
const connectingHTML = `<div style="text-align: center;">
<h2>Connecting</h2>
<p>
	connecting......<br>
</p>
</div>
`;
let id = "";
let platform = "";
document.addEventListener("DOMContentLoaded", () => {
	let mainDiv = document.getElementById("main");
	mainDiv.innerHTML = connectingHTML;
	const wsURL = `ws://${window.location.host}${window.location.pathname}coms`;
	const ws = new WebSocket(wsURL);
	console.log("Connecting to the server...");
	let game = null;
	const defaultWsOnMessage = (event) => {
		let message = JSON.parse(event.data);
		console.log(message);
		switch (message.stage) {
			case "heartbeat":
				console.log("heartbeat");
				ws.send(JSON.stringify({ stage: "heartbeat" }));
			case "waitingRoom":
				loadWaitingRoom("main", ws);
				break;
			case "waitingExpEndRoom":
				loadWaitingExpEndRoom("main", ws);
				break;
			case "intro":
				switch (message.type) {
					case "consentForm":
						loadConsentForm("main", ws);
						break;
					case "instructions":
						loadInstructions("main", ws);
						break;
				}
				break;
			case "practice":
				game = new Game(
					"main",
					ws,
					"practice",
					"sep",
					id,
					origin,
					message.inProgress,
					message.progress,
					message.state
				);
				break;
			case "game":
				game = new Game("main", ws, "game", message.block);
				break;
		}
	};

	ws.onopen = () => {
		console.log("Connected to the server");
		const queryParams = new URLSearchParams(window.location.search);
		console.log(queryParams);
		if (queryParams.has("survey_code")) {
			id = queryParams.get("survey_code");
		} else {
			id = "";
		}
		if (queryParams.has("origin")) {
			origin = queryParams.get("origin");
		} else {
			origin = "";
		}
		let infoData = { id: id, origin: origin };
		ws.send(
			JSON.stringify({
				stage: "intro",
				type: "participantInfo",
				data: infoData,
			})
		);
	};

	ws.onmessage = defaultWsOnMessage;
});
