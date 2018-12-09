var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext; //new audio context to help us record

window.requestAnimFrame = (function(){
              return  window.requestAnimationFrame       ||
                      window.webkitRequestAnimationFrame ||
                      window.mozRequestAnimationFrame    ||
                      function(callback, element){
                        window.setTimeout(callback, 1000 / 60);
                      };
            })();

var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = new AudioContext(); //new audio context to help us record

function Track(name, element) {

  	this.name = name;
    this.element = element;
  	this.dbs = -99; //hack
	this.smoothing = 0.95;
	this.smooth = 0;
	this.sampleSize = 1024;


	//var e = document.createElement("div");
	var e = this.element
	e.track = this;

	var label = document.createElement("label");
	label.innerText = "Audio input source: ";
	e.appendChild(label)

	var source = document.createElement("select");
	this.source = source;
	source.onchange = this.start.bind(this);
	e.appendChild(source);

	var graph = document.createElement("select");
	var option = document.createElement('option');
	option.value = "Time";
	graph.appendChild(option);
	option = document.createElement('option');
	option.value = "Frequency";
	graph.appendChild(option);
	e.appendChild(graph);

	var canvas = document.createElement("canvas");
	canvas.className = "visualizer";
	canvas.width = 512;
	canvas.height = 256;
	this.canvas = canvas;
	this.ctx = canvas.getContext("2d");
	e.appendChild(canvas);

	e.appendChild(document.createElement("br"));

	var db = document.createElement("canvas");
	db.className = "db";
	db.width = 512;
	db.height = 50;
	this.db = db;
	this.dbx = db.getContext("2d");
	e.appendChild(db);

	var dialLow = document.createElement("input");
	dialLow.type = "text";
	dialLow.classList.add('dialLow');
	
	e.appendChild(dialLow);


	document.getElementById( "trackContainer" ).appendChild(e);
	this.trackElement = e;

	navigator.mediaDevices.enumerateDevices().then(this.gotDevices.bind(this));

	$(".dialLow").knob();
	//navigator.mediaDevices.enumerateDevices().then(function(devices){(devices) => this.gotDevices(devices)});

}

Track.prototype.start = function() {
	if (window.stream) {
    window.stream.getTracks().forEach(track => {
      track.stop();
    });
  }

  const audioSource1 = this.source.value;
  const constraints1 = {
    audio: {deviceId: audioSource1 ? {exact: audioSource1} : undefined},
    video: false
  };

  navigator.mediaDevices.getUserMedia(constraints1).then(this.startStream.bind(this));
}

Track.prototype.startStream = function(stream) {
		console.log("getUserMedia() success, stream created from source");

		/*
			create an audio context after getUserMedia is called
			sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
			the sampleRate defaults to the one set in your OS for your playback device

		*/

		//assign to gumStream for later use
		this.gumStream = stream;
		
		/* use the stream */
		this.input = audioContext.createMediaStreamSource(stream);
		
		//stop the input from playing back through the speakers
		this.input.connect(audioContext.destination)
		this.audioPlaying = true;
		this.setupAudioNodes();

	    var onaudio = function (track) {
	        // get the Time Domain data for this sample
	        this.analyserNode.getFloatTimeDomainData(this.amplitudeArray);
	        this.analyserNode.getByteFrequencyData(this.frequencyArray);
	        // draw the display if the audio is playing
	        if (this.audioPlaying == true) {
	            requestAnimFrame(this.drawTimeDomain.bind(this));
	            requestAnimFrame(this.drawdb.bind(this));
	        }
	    }

	    // setup the event handler that is triggered every time enough samples have been collected
	    // trigger the audio analysis and draw the results
	    this.javascriptNode.onaudioprocess = onaudio.bind(this);
	}

Track.prototype.setupAudioNodes = function() {
	this.low = audioContext.createBiquadFilter();
	this.low.type = "lowshelf";
	this.low.frequency.value = 320.0;
	this.low.gain.value = 0.0;

	this.mid = audioContext.createBiquadFilter();
	this.mid.type = "peaking";
	this.mid.frequency.value = 1000.0;
	this.mid.Q.value = 0.5;
	this.mid.gain.value = 0.0;

	this.high = audioContext.createBiquadFilter();
	this.high.type = "highshelf";
	this.high.frequency.value = 3200.0;
	this.high.gain.value = 0.0;

	this.filter = audioContext.createBiquadFilter();
	this.filter.frequency.value = 20000.0;
	this.filter.type = this.filter.LOWPASS;

    this.analyserNode   = audioContext.createAnalyser();
    this.javascriptNode = audioContext.createScriptProcessor(this.sampleSize, 1, 1);
    // Create the array for the data values
    this.amplitudeArray = new Float32Array(this.analyserNode.frequencyBinCount);
    this.frequencyArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    // Now connect the nodes together
    this.input.connect(this.low); //ben added source
    this.low.connect(this.mid);
    this.mid.connect(this.high);
    this.high.connect(this.filter);
    this.filter.connect(this.analyserNode);
    this.analyserNode.connect(this.javascriptNode);
    this.javascriptNode.connect(audioContext.destination);
}

Track.prototype.gotDevices = function(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const selectors = [this.source]
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

Track.prototype.clearCanvas = function() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
}

Track.prototype.drawTimeDomain = function() {
	this.clearCanvas();
	for (var i = 0; i < this.amplitudeArray.length; i++) {
        var value = this.amplitudeArray[i]/2 + 0.5; //convert [-1 1] float to [0 to 1]
        var y = this.canvas.height - (this.canvas.height * value) - 1;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(i, y, 1, 1);
    }
}

Track.prototype.cleardb = function() {
    this.dbx.clearRect(0, 0, this.db.width, this.db.height);
}


Track.prototype.drawdb = function() {
	this.cleardb();
	var sum = 0;
	var value = 0;
	for (var i = 0; i < this.amplitudeArray.length; i++) {
        value = this.amplitudeArray[i];
        sum += value * value;
    	}

    // ... then take the square root of the sum.
    var rms =  Math.sqrt(sum / this.amplitudeArray.length);
    this.smooth = Math.max(rms, this.smoothing*this.smooth);
    dbs = Math.log10(this.smooth);
    var gradient=this.dbx.createLinearGradient(0,0,600,0);
	gradient.addColorStop(0,"green");
	gradient.addColorStop(0.6,"orange");
	gradient.addColorStop(0.8,"red");
    this.dbx.fillStyle = gradient;
    this.dbx.fillRect(0, 0, this.db.width+dbs*this.db.width, this.db.height);
}

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