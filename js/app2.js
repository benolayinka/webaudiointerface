var selectors;

window.onload = function() {

	var e = document.createElement("div");

	var track1 = new Track("track1", e);

	navigator.requestMIDIAccess()
	    .then(onMIDISuccess, onMIDIFailure);

	track1.start();

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