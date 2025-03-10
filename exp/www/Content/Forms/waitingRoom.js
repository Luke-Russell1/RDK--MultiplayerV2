const waiitingRoom = `
<div class = 'waitingRoom' style="text-align: center;">
    <h2>Waiting Room</h2>
    <p>
        We are currently waiting for another participant to join. The game will begin shortly. <br>
        <b> If you feel you have been sitting for a while, try refreshing the page! <b>
    </p>
    </div>
    `;

function loadWaitingRoom(targetElementId) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		targetElement.innerHTML = waiitingRoom;
	}
}

const waitingExpEndRoom = `

<div style="text-align: center;">
    <h2>Waiting Room</h2>
    <p>
    We are currently waiting for another experiment to finish. The experiment will begin shortly. <br>
    Please do not close this window.  
    </p>
    </div>
    `;
function loadWaitingExpEndRoom(targetElementId) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		targetElement.innerHTML = "";
		targetElement.innerHTML = waitingExpEndRoom;
	}
}
export { loadWaitingRoom, loadWaitingExpEndRoom };
