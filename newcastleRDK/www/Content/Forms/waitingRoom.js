const waiitingRoom = `
<div style="text-align: center;">
    <h2>Waiting Room</h2>
    <p>
        We are currently waiting for another participant to join. The game will begin shortly. 
    </p>
    </div>
    `;

function loadWaitingRoom(targetElementId) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		targetElement.innerHTML = waiitingRoom;
	}
}
export { loadWaitingRoom };
