var VRSPACE;

function showMessage(message) {
  var conversation = document.getElementById("conversation");
  var row = conversation.insertRow(0);
  var cell = row.insertCell(0);
  cell.innerHTML = message;
}

function setConnected(connected) {
  document.getElementById("connect").disabled = connected;
  document.getElementById("disconnect").disabled = !connected;
  document.getElementById("send").disabled = !connected;
  document.getElementById("add").disabled = !connected;
  var conversation = document.getElementById("conversation");
  if (!connected) {
    const rows = conversation.rows.length;
    for (var i = 0; i < rows; i++) {
      conversation.deleteRow(0);
    }
  }
}

function socketCallback(data) {
  showMessage(data);
  console.log(VRSPACE.getScene("Client").size + "/" + VRSPACE.getScene().size);
}

function sendMessage() {
  const message = document.getElementById("message").value;
  showMessage("> " + message);
  VRSPACE.send(message);
}

function addObject() {
  const className = document.getElementById("className").value;
  const message = '{"command":{"Add":{"objects":[{"' + className + '":{}}]}}}';
  document.getElementById("message").value = message;
  sendMessage();
}

var inspecting = null;
var original = null;
var inputFields = [];

function drawInspectForm(objectId, obj) {
  var row = document.getElementById(objectId);
  //var html = button.outerHTML;
  var html = row.innerHTML;
  html += '<div style="outline: 1px ridge #E0E0E0">'
  html += inspect(obj, '');
  //html += '<div><button class="btn btn-light" type="button" onclick="inspectSubmit()">Change</button></div>';
  //html += '<div><button class="btn btn-light" type="button" onclick="inspectCancel()">Cancel</button></div>';
  //html += '<div><button class="btn btn-light" type="button" onclick="inspectDelete()">Delete</button></div>';
  html += '<div><button class="btn btn-light" type="button" onclick="inspectSubmit()">Change</button>';
  html += '<button class="btn btn-light" type="button" onclick="inspectCancel()">Cancel</button>';
  html += '<button class="btn btn-light" type="button" onclick="inspectDelete()">Delete</button></div>';
  html += "</div>";
  row.cells[0].innerHTML = html;
}

function inspectObject(event) {
  var button = event.target;
  var objectId = button.innerHTML;
  var obj = VRSPACE.scene.get(objectId);
  if (inspecting == null) {
    inspecting = objectId;
    original = Object.assign({},obj);
    console.log("Inspect " + objectId + ":" + JSON.stringify(obj));
    drawInspectForm(objectId, obj);
  }
}

function createSceneButton(objectId) {
  var row = document.getElementById(objectId);
  row.cells[0].innerHTML = '<button class="btn btn-light" type="button" onclick="inspectObject(event)">'
      + objectId + '</button>';
}

function createField(event) {
  const fieldName = event.target.id;
  var obj = VRSPACE.scene.get(inspecting);
  VRSPACE.createField(inspecting.split(' ')[0], fieldName, function(val) {
    console.log("created "+val);
    obj[fieldName] = val;
    createSceneButton(inspecting);
    drawInspectForm(inspecting, obj);
  });
}

function inspectCancel() {
  createSceneButton(inspecting);
  inspecting = null;
  inputFields = [];
}

function inspectDelete() {
  const obj = VRSPACE.scene.get(inspecting);
  const className = inspecting.split(' ')[0];
  const message = '{"command":{"Remove":{"objects":[{"' + className + '":'+obj.id+'}]}}}';
	VRSPACE.send(message);
  createSceneButton(inspecting);
  inspecting = null;
}

function inspectSubmit() {
  var obj = VRSPACE.getScene().get(inspecting);
	var changed = false;
	var event = new VREvent(obj);
	for ( var i = 0; i < inputFields.length; i++ ) {
		var fieldId = inputFields[i];
    //var val = getField(fieldId,obj);
    var val = getField(fieldId,original);
    var entered = document.getElementById(fieldId).value;
    if ( typeof val === 'boolean' ) {
	    entered = (entered === 'true');
    }
    var fieldChanged = (val != entered);
    changed |= fieldChanged;
    console.log(fieldId+":"+val+" -> "+entered+" "+(val != entered));
    if ( fieldChanged ) {
      setField(fieldId,obj,entered);
      var topField = fieldId.split('.')[0];
      event.changes[topField]=obj[topField];
    }
	}
	if ( changed ) {
		console.log(JSON.stringify(obj));
		console.log(JSON.stringify(event));
		VRSPACE.send(JSON.stringify(event));
	}
  createSceneButton(inspecting);
  inspecting = null;
  inputFields = [];
}

function getField(path, obj) {
  return path.split('.').reduce(function(prev, curr) {
    return prev ? prev[curr] : null
  }, obj || self);
}

function setField(path, obj, val) {
  path.split('.').reduce(function(prev, curr, ind, arr) {
	  if ( ind == arr.length-1 ) {
		  prev[curr] = val;
	  }
    return prev ? prev[curr] : null
  }, obj || self);
}

function inspect(obj, prefix) {
  var ret = "";
  //console.log(prefix);
  for (field in obj) {
    var value = obj[field];
    if (typeof value === 'object') {
      ret += '<div>';
      ret += '<label>' + field + ': </label>';
	    if ( value == null ) {
        ret += '<button id="'+field+'" class="btn btn-light" onclick="createField(event)">Create</button>';
    	} else {
        ret += inspect(value, prefix + field + '.');
      }
      ret += '</div>';
    } else {
	    var fieldId = prefix + field;
      console.log(fieldId + ":" + value);
      if (!prefix) {
        ret += '<div>';
      }
      if ( fieldId != 'id' ) {
        ret += '<label>' + field + ': </label>';
        ret += '<input id="'+fieldId+'" type="text" size=3 value="' + value + '">';
        inputFields.push(fieldId);
      }
      if (!prefix) {
        ret += '</div>';
      }
    }
  }
  return ret;
}

function sceneChanged(e) {
  if (e.added != null) {
    console.log("ADDED " + e.objectId + " new size " + e.scene.size);
    var scene = document.getElementById("scene");
    var row = scene.insertRow(0);
    row.id = e.objectId;
    row.insertCell(0);
    createSceneButton(e.objectId);
  } else if (e.removed != null) {
    console.log("REMOVED " + e.objectId + " new size " + e.scene.size)
    var row = document.getElementById(e.objectId);
    row.remove();
  } else {
    console.log("ERROR: invalid scene event");
  }
  var header = document.getElementById("sceneHeader");
  header.innerHTML = "Scene size " + e.scene.size;
}

window.addEventListener('load', function() {
  import("/babylon/vrspace.js").then((module)=>{
    VRSPACE=module.VRSPACE;
    VRSPACE.addConnectionListener(setConnected);
    VRSPACE.addDataListener(socketCallback);
    VRSPACE.addSceneListener(sceneChanged);
    document.getElementById("connect").onclick = function() {
      VRSPACE.connect();
    };
    document.getElementById("disconnect").onclick = function() {
      VRSPACE.disconnect();
    };
    document.getElementById("send").onclick = sendMessage;
    // document.getElementById("message").onchange=function(){sendMessage();};
    document.getElementById("add").onclick = addObject;
  });
});
