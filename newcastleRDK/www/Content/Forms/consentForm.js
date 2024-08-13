const consentFormHTML = `
<div class = "consent" style="text-align: center;">
<div style="text-align: center;">
    <h2>PROJECT TITLE: <b>Team Scheduling, Decision Making and Behvaiour</b></h2>
    <p>
        <b> Luke Russell </b> Email: LRussell1@uon.edu.au <br>
        <b> Khalid Abdullahi </b> Email: Khalid.Abdullahi@uon.edu.au <br>
        <b> Prof Ami Eidels </b> Email: ami.eidels@newcastle.edu.au <br>
    </p>
    <p>
        <b> For further information about this project, please direct questions to either Luke Russell or Khalid Abdullahi. <br>
        This research is permitted by the University of Newcastle under Human Research Ethics Protocol H-2017-0192</b>
    </p>
</div>
<div  align="left">
<p>
In this task, you will be asked to complete 50 trials of a computer-based task. This will involve repeated decisions between two options. The task will take approximately 10 minutes to complete.
You are free to stop the study at any time, and your data will not be used if you choose to do so with no penalty. If you have any concerns that arise from the 
task, please email the Principal Researcher Luke Russell at: LRussell1@uon.edu.au. <br>
<b> Please do not refresh or resize the browser during the experiment, doing so will cause a loss of progress and invalidate the data. </b> <br>
Please read the following statements before proceeding.
</p>
<p>1. I consent to participate in this project. The purpose of this research is to integrate the findings between response-time based methodologies and experimental measures of decision making.</p>
<p>2. I understand that this project is for research purposes only and not for treatment.</p>
<p>3. In this project, I will be required to complete a computer-based task. The details of this have been explained in the Participant Information Statement which I can request to be emailed to by emailing the Principal Researcher.</p>
<p>4. My participation is voluntary, and I am free to withdraw from the project at any time without explanation or prejudice and to withdraw any unprocessed data I have provided. </p>
<p> 

<input type="checkbox" id="consent_checkbox" />
    I agree to take part in this study.
<button type="button" id="start">Start Experiment</button>
</div>
    
</div>

`;

const participantInfoHTML = `
 <div class = "participantInfo" align = "center"> 
		<h2>Participant Information</h2>
        <p> Please provide your age, gender and platform before proceeding. Please consider your response carefully </p>
        <form id="participantForm">
            <label for="age">Age:</label>    
            <input type="number" id="age" placeholder="Age" required/> <br>    
            <label for="gender">Gender:</label>
            <select name="gender" id="gender">
			  <option value="" selected disabled hidden>Choose here</option> 
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
            </select> <br>
			<label for = "platform"> Platform: </label>
			<select name = "platform" id = "platform">
				<option value = "" selected disabled hidden> Choose here </option>
				<option value = "SONA"> SONA </option>
				<option value = "Prolific"> Prolific </option>
            </p>
            <button type="submit" class = "submit">Submit</button>
        </form>
    </div>
	`;
let data = {};

function loadConsentForm(targetElementId, ws) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		targetElement.innerHTML = consentFormHTML;

		const checkbox = document.getElementById("consent_checkbox");
		const startButton = document.getElementById("start");

		startButton.addEventListener("click", () => {
			if (checkbox.checked) {
				// Load participant information form
				targetElement.innerHTML = participantInfoHTML;

				// Call the function to handle the participant information form
				displayInfoHTML(targetElementId, ws);
			} else {
				console.log("Please check the consent checkbox before proceeding.");
			}
		});

		// Initially disable the start button if the checkbox is not checked
		startButton.disabled = !checkbox.checked;

		checkbox.addEventListener("change", () => {
			startButton.disabled = !checkbox.checked;
		});
	} else {
		console.error(`Target element with ID '${targetElementId}' not found.`);
	}
}
function displayInfoHTML(targetElementId, ws) {
	const targetElement = document.getElementById(targetElementId);
	if (targetElement) {
		const ageInput = document.getElementById("age");
		const genderSelect = document.getElementById("gender");
		const plaform = document.getElementById("platform");
		const submitButton = document.querySelector(
			"#participantForm button[type='submit']"
		);

		const validateFields = () => {
			const isAgeValid = ageInput && ageInput.value.trim() !== "";
			const isGenderSelected = genderSelect && genderSelect.value.trim() !== "";
			const isPlatformSelected = platform && platform.value.trim() !== "";
			submitButton.disabled = !(
				isAgeValid &&
				isGenderSelected &&
				isPlatformSelected
			);
		};
		ageInput.addEventListener("input", validateFields);
		genderSelect.addEventListener("change", validateFields);
		platform.addEventListener("change", validateFields);

		submitButton.addEventListener("click", (event) => {
			event.preventDefault(); // Prevent the default form submission

			if (
				ageInput.value.trim() !== "" &&
				genderSelect.value.trim() !== "" &&
				platform.value.trim() !== ""
			) {
				data = {
					age: ageInput.value,
					gender: genderSelect.value,
					platform: platform.value,
				};
				console.log(data);
				handleStartExperiment(ws, data);
			} else {
				console.log("Please complete all fields before submitting.");
			}
		});

		// Initially disable the submit button if the fields are empty
		validateFields();
	} else {
		console.error(`Target element with ID '${targetElementId}' not found.`);
	}
}
function handleStartExperiment(ws, data) {
	console.log("Start Experiment button clicked");
	if (ws && typeof ws.send === "function") {
		ws.send(JSON.stringify({ stage: "intro", type: "consent", data: data }));
	} else {
		console.error("WebSocket connection (ws) is invalid or not available.");
	}
}

export { loadConsentForm };
