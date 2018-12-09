var recorder; 						//WebAudioRecorder object
var input; 							//MediaStreamAudioSourceNode  we'll be recording
var encodingType; 					//holds selected encoding for resulting audio (file)
var encodeAfterRecord = true;       // when to encode
var track1;
var track2;
var master;

window.onload = function() {

	var encodingTypeSelect = document.getElementById("encodingTypeSelect");
	var recordButton = document.getElementById("recordButton");
	var stopButton = document.getElementById("stopButton");

	//add events to those 2 buttons
	recordButton.addEventListener("click", startRecording);
	stopButton.addEventListener("click", stopRecording);

	track1 = new Track("track1", document.getElementById("track1"));
	track2 = new Track("track2", document.getElementById("track2"));

	track1.start();
	track2.start();

	navigator.requestMIDIAccess()
	    .then(onMIDISuccess, onMIDIFailure);

}

function onMIDISuccess(midiAccess) {
	    //console.log(midiAccess);

	    inputs = midiAccess.inputs;
	    outputs = midiAccess.outputs;

	    for (var input of midiAccess.inputs.values())
        input.onmidimessage = getMIDIMessage;
}

function getMIDIMessage(message) {
	var device = message.data[0];
    var button = message.data[1];
    var position = (message.data.length > 2) ? message.data[2] : 0; // a velocity value might not be included with a noteOff command
    switch (button) {
        case 8: // noteOn
            $(".track1dialLow").val(position).trigger('change');
            break;
        case 9:
            $(".track1dialMid").val(position).trigger('change');
            break;
        case 10:
            $(".track1dialHigh").val(position).trigger('change');
            break;
        case 12:
            $(".track2dialLow").val(position).trigger('change');
            break;
        case 13:
            $(".track2dialMid").val(position).trigger('change');
            break;
        case 14:
            $(".track2dialHigh").val(position).trigger('change');
            break;
        }
}

function onMIDIFailure() {
    console.log('Could not access your MIDI devices.');
}

function startRecording() {
	console.log("startRecording() called");

		//update the format 
		document.getElementById("formats").innerHTML="Format: 2 channel "+encodingTypeSelect.options[encodingTypeSelect.selectedIndex].value+" @ 44.1 kHz"

		//get the encoding 
		encodingType = encodingTypeSelect.options[encodingTypeSelect.selectedIndex].value;
		
		//disable the encoding selector
		encodingTypeSelect.disabled = true;

		//ben recording output of audio context
		recorder = new WebAudioRecorder(master, {
		  workerDir: "js/", // must end with slash
		  encoding: encodingType,
		  numChannels:2, //2 is the default, mp3 encoding supports only 2
		  onEncoderLoading: function(recorder, encoding) {
		    // show "loading encoder..." display
		    __log("Loading "+encoding+" encoder...");
		  },
		  onEncoderLoaded: function(recorder, encoding) {
		    // hide "loading encoder..." display
		    __log(encoding+" encoder loaded");
		  }
		});

		recorder.onComplete = function(recorder, blob) { 
			__log("Encoding complete");
			createDownloadLink(blob,recorder.encoding);
			encodingTypeSelect.disabled = false;
		}

		recorder.setOptions({
		  timeLimit:120,
		  encodeAfterRecord:encodeAfterRecord,
	      ogg: {quality: 0.5},
	      mp3: {bitRate: 160}
	    });

		//start the recording process
		recorder.startRecording();

		 __log("Recording started");

	//disable the record button
    recordButton.disabled = true;
    stopButton.disabled = false;
}

function stopRecording() {
	console.log("stopRecording() called");

	//disable the stop button
	stopButton.disabled = true;
	recordButton.disabled = false;
	
	//tell the recorder to finish the recording (stop recording + encode the recorded audio)
	recorder.finishRecording();

	__log('Recording stopped');
}

function createDownloadLink(blob,encoding) {
	
	var url = URL.createObjectURL(blob);
	var au = document.createElement('audio');
	var li = document.createElement('li');
	var link = document.createElement('a');

	//add controls to the <audio> element
	au.controls = true;
	au.src = url;

	//link the a element to the blob
	link.href = url;
	link.download = new Date().toISOString() + '.'+encoding;
	link.innerHTML = link.download;

	//add the new audio and a elements to the li element
	li.appendChild(au);
	li.appendChild(link);

	//add the li element to the ordered list
	recordingsList.appendChild(li);
}

//helper function
function __log(e, data) {
	log.innerHTML += "\n" + e + " " + (data || '');
}