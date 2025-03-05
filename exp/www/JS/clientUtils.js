export async function sendMessage(ws, message) {
	try {
		await retryMessage(ws, message);
		return true; // Return true if the message was sent successfully
	} catch (error) {
		// Log and rethrow the final error if retries are exhausted
		console.error("Final error sending message:", error);
		throw error;
	}
}
export async function retryMessage(
	ws,
	message,
	maxRetries = 4,
	retryDelay = 1000
) {
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
export function clearContainer(containerID) {
	// Use Array.from to safely iterate over the NodeList
	Array.from(containerID.childNodes).forEach((child) => {
		containerID.removeChild(child);
	});
}
export function preloadImages(imageList) {
	let imgArray = [];
	imageList.forEach((image) => {
		const img = new Image();
		img.src = image;
		imgArray.push(img);
	});
	return imgArray;
}
export function createTimestamp(timestamp) {
	let newTime = Date.now();
	let diff = newTime - timestamp;
	return diff;
}
