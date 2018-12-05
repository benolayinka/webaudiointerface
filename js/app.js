//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; 						//stream from getUserMedia()
var recorder; 						//WebAudioRecorder object
var input; 							//MediaStreamAudioSourceNode  we'll be recording
var encodingType; 					//holds selected encoding for resulting audio (file)
var encodeAfterRecord = true;       // when to encode

var sourceNode;
var analyserNode;
var javascriptNode;
var audioData = null;
var audioPlaying = false;
var sampleSize = 1024;  // number of samples to collect before analyzing data
var amplitudeArray;     // array to hold time domain data
var frequencyArray;     // array to hold freq domain data

var low; //EQ for realtime midi control of recording
var mid;
var high;
var filter;

var inputs;
var outputs; //midi

var db = -99; //hack
var smoothing = 0.95;
var smooth = 0;

var audioPlaying;

var canvasWidth  = 512;
var canvasHeight = 256;

var dbHeight = 50;
var dbWidth = 500;

window.requestAnimFrame = (function(){
              return  window.requestAnimationFrame       ||
                      window.webkitRequestAnimationFrame ||
                      window.mozRequestAnimationFrame    ||
                      function(callback, element){
                        window.setTimeout(callback, 1000 / 60);
                      };
            })();

// shim for AudioContext when it's not avb. 
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext; //new audio context to help us record

var ctx = document.getElementById("canvas").getContext("2d");
var ctx2 = document.getElementById("canvas2").getContext("2d");
var dbx = document.getElementById("db").getContext("2d");
var dbx2 = document.getElementById("db2").getContext("2d");

var encodingTypeSelect = document.getElementById("encodingTypeSelect");
var recordButton = document.getElementById("recordButton");
var stopButton = document.getElementById("stopButton");

//add events to those 2 buttons
recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

const audioInputSelect1 = document.querySelector('select#audioSource1');
const audioInputSelect2 = document.querySelector('select#audioSource2');
const selectors = [audioInputSelect1,audioInputSelect2];

audioInputSelect1.onchange = start;
audioInputSelect2.onchange = start;

window.onload = function() {

    /*
    	We're using the standard promise based getUserMedia() 
    	https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
	*/
	navigator.mediaDevices.enumerateDevices().then(gotDevices);

	navigator.requestMIDIAccess()
    .then(onMIDISuccess, onMIDIFailure);

	function onMIDISuccess(midiAccess) {
	    console.log(midiAccess);

	    inputs = midiAccess.inputs;
	    outputs = midiAccess.outputs;

	    for (var input of midiAccess.inputs.values())
        input.onmidimessage = getMIDIMessage;
	}

	function getMIDIMessage(midiMessage) {
    	console.log(midiMessage);
	}

	function onMIDIFailure() {
	    console.log('Could not access your MIDI devices.');
	}

};

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for(item in selectors){
	  for (let i = 0; i !== deviceInfos.length; ++i) {
	    const deviceInfo = deviceInfos[i];
	    const option = document.createElement('option');
	    option.value = deviceInfo.deviceId;
	    if (deviceInfo.kind === 'audioinput') {
	      option.text = deviceInfo.label || `microphone ${selectors[item].length + 1}`;
	      selectors[item].appendChild(option);
	    } else {
	      console.log('Some other kind of source/device: ', deviceInfo);
	    }
	}
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
}

function start() {
  if (window.stream) {
    window.stream.getTracks().forEach(track => {
      track.stop();
    });
  }
  const audioSource1 = audioInputSelect1.value;
  const constraints1 = {
    audio: {deviceId: audioSource1 ? {exact: audioSource1} : undefined},
    video: false
  };
  navigator.mediaDevices.getUserMedia(constraints1).then(function(stream) {
		__log("getUserMedia() success, stream created from source 1");

		/*
			create an audio context after getUserMedia is called
			sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
			the sampleRate defaults to the one set in your OS for your playback device

		*/
		audioContext = new AudioContext();

		//assign to gumStream for later use
		gumStream = stream;
		
		/* use the stream */
		input = audioContext.createMediaStreamSource(stream);
		
		//stop the input from playing back through the speakers
		//input.connect(audioContext.destination)
		audioPlaying = true;
		setupAudioNodes();
		
	    // setup the event handler that is triggered every time enough samples have been collected
	    // trigger the audio analysis and draw the results
	    javascriptNode.onaudioprocess = function () {
	        // get the Time Domain data for this sample
	        analyserNode.getFloatTimeDomainData(amplitudeArray);
	        analyserNode.getByteFrequencyData(frequencyArray);
	        // draw the display if the audio is playing
	        if (audioPlaying == true) {
	            requestAnimFrame(drawTimeDomain);
	            requestAnimFrame(drawdb);
	        }
	    }

	    }).catch(function(err) {
	  	//enable the record button if getUSerMedia() fails
	  	alert(err);
    	//recordButton.disabled = false;
    	//stopButton.disabled = true;

	});

	const audioSource2 = audioInputSelect2.value;
  	const constraints2 = {
    audio: {deviceId: audioSource2 ? {exact: audioSource2} : undefined},
    video: false
  		};

 	//reinier this is where you need to add some code :)

	navigator.mediaDevices.enumerateDevices().then(gotDevices);
}

function startRecording() {
	console.log("startRecording() called");

		//update the format 
		document.getElementById("formats").innerHTML="Format: 2 channel "+encodingTypeSelect.options[encodingTypeSelect.selectedIndex].value+" @ "+audioContext.sampleRate/1000+"kHz"

		//get the encoding 
		encodingType = encodingTypeSelect.options[encodingTypeSelect.selectedIndex].value;
		
		//disable the encoding selector
		encodingTypeSelect.disabled = true;

		recorder = new WebAudioRecorder(input, {
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
	
	//stop microphone access
	gumStream.getAudioTracks()[0].stop();

	//ben
	audioPlaying = false;

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

function setupAudioNodes() {
	low = audioContext.createBiquadFilter();
	low.type = "lowshelf";
	low.frequency.value = 320.0;
	low.gain.value = 0.0;

	mid = audioContext.createBiquadFilter();
	mid.type = "peaking";
	mid.frequency.value = 1000.0;
	mid.Q.value = 0.5;
	mid.gain.value = 0.0;

	high = audioContext.createBiquadFilter();
	high.type = "highshelf";
	high.frequency.value = 3200.0;
	high.gain.value = 0.0;

	filter = audioContext.createBiquadFilter();
	filter.frequency.value = 20000.0;
	filter.type = this.filter.LOWPASS;

    analyserNode   = audioContext.createAnalyser();
    javascriptNode = audioContext.createScriptProcessor(sampleSize, 1, 1);
    // Create the array for the data values
    amplitudeArray = new Float32Array(analyserNode.frequencyBinCount);
    frequencyArray = new Uint8Array(analyserNode.frequencyBinCount);
    // Now connect the nodes together
    input.connect(low); //ben added source
    low.connect(mid);
    mid.connect(high);
    high.connect(filter);
    filter.connect(analyserNode);
    analyserNode.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);
}

function drawTimeDomain() {
    clearCanvas();
    clearCanvas2();

    for (var i = 0; i < amplitudeArray.length; i++) {
        var value = amplitudeArray[i]/2 + 0.5; //convert [-1 1] float to [0 to 1]
        var y = canvasHeight - (canvasHeight * value) - 1;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(i, y, 1, 1);
        ctx2.fillStyle = '#ffffff';
        ctx2.fillRect(i, y, 1, 1);
    	}
}
function clearCanvas() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
}
function clearCanvas2() {
    ctx2.clearRect(0, 0, canvasWidth, canvasHeight);
}

function drawdb() {
	cleardb();
	cleardb2();
	var sum = 0;
	var value = 0;
	for (var i = 0; i < amplitudeArray.length; i++) {
        value = amplitudeArray[i];
        sum += value * value;
    	}

    // ... then take the square root of the sum.
    var rms =  Math.sqrt(sum / amplitudeArray.length);
    smooth = Math.max(rms, smoothing*smooth);
    db = Math.log10(smooth);
    dbx.fillStyle = '#ffffff';
    dbx.fillRect(0, 0, dbWidth+db*dbWidth, dbHeight);
    dbx2.fillStyle = '#ffffff';
    dbx2.fillRect(0, 0, dbWidth+db*dbWidth, dbHeight);
}
function cleardb() {
    dbx.clearRect(0, 0, dbWidth, dbHeight);
}
function cleardb2() {
    dbx2.clearRect(0, 0, dbWidth, dbHeight);
}
//helper function
function __log(e, data) {
	log.innerHTML += "\n" + e + " " + (data || '');
}