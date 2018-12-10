//Create audio context
var audioContext = new (window.AudioContext || window.webkitAudioContext)();

//specify gain to control the output level
var gainControl = audioContext.createGain();

//Define play function on input change events 
function PrepareAndPlay() {

	soundFile.onchange = function() {
		audio.pause();
		audio.load(); 
		audio.src = URL.createObjectURL(this.files[0]);
		audio.play(); 
	}
	audio.onloadedmetadata = function() {
		var elementSource = audioContext.createMediaElementSource(this);
		elementSource.connect(gainControl);
		audio.play();
	}
};

//Couple gain to have effect on output
function ConnectObjects() {
	gainControl.connect(audioContext.destination);
};
PrepareAndPlay();
ConnectObjects();