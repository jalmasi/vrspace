class ID {
  constructor(className,id) {
    this.className = className;
    this.id = id;
  }
  toString() {
    return this.className+" "+this.id;
  }
}

class Rotation {
  constructor(){
    this.x=0;
    this.y=1;
    this.z=0;
    this.angle=0;
  }
}

class Point {
  constructor(){
    this.x=0;
    this.y=0;
    this.z=0;
  }
}

class VRObject {
  constructor() {
    this.id = null;
    this.position = null;
    this.rotation = null;
    this.scale = null;
    this.permanent = false;
    //this.active = false; // CHECKME
    //this.children = []; // CHECKME
    //this.mesh = null;
    //this.script = null; // CHECKME
    //this.streamId = null;
    this.listeners = [];
  }
  
  addListener(listener) {
    this.listeners.push(listener);
  }
  
  removeListener(listener) {
    var pos = this.listeners.indexOf(listener);
    if ( pos > -1 ) {
      this.listeners.splice(pos,1);
    }
  }
  
  notifyListeners(changes) {
    for ( var i = 0; i < this.listeners.length; i++ ) {
      this.listeners[i](this,changes);
    }
  }
}

class SceneProperties{
  constructor() {
    this.range = 2000;
    this.resolution = 10;
    this.size = 1000;
    this.timeout = 30000;
  }
}

class Client extends VRObject {
  constructor() {
    super();
    this.name = null;
    this.sceneProperties = null; // CHECKME private - should be declared?
    this.leftArmPos = { x: null, y: null, z: null };
    this.rightArmPos = { x: null, y: null, z: null };
    this.leftArmRot = { x: null, y: null, z: null, w: null };
    this.rightArmRot = { x: null, y: null, z: null, w: null };
    this.userHeight = 1.8;
    this.token = null; // CHECKME: string, should be object?
  }
  hasAvatar() {
    return this.mesh && this.mesh.toLowerCase().endsWith('.gltf');
  }
}

class EventRecorder extends Client {
  constructor() {
    super();
  }
}

class VREvent {
  constructor(obj) {
    this.object=new Object();
    this.object[obj.constructor.name]=obj.id;
    this.changes=new Object();
  }
}

class SceneEvent {
  constructor(scene,className,objectId,added,removed) {
    this.className = className;
    this.objectId = objectId;
    this.added = added;
    this.removed = removed;
    this.scene = scene;
  }
}

const classes = { ID, Rotation, Point, VRObject, SceneProperties, Client, VREvent, SceneEvent, EventRecorder };

class VRSpace {
  constructor() {
    this.ws = null;
    this.me = null;
    this.scene = new Map();
    // this.classRegistry = new Map();
    this.connectionListeners = [];
    this.dataListeners = [];
    this.sceneListeners = [];
    this.welcomeListeners = [];
    this.errorListeners = [];
    this.responseListener = null;
    this.debug = false;
  }
  
  log( msg ) {
    if ( this.debug ) {
      console.log(msg);
    }
  }
  
  addListener(array, callback) {
    if ( typeof callback == 'function') {
      array.push(callback);
    }
  }
  
  removeListener(array, listener) {
    var pos = array.indexOf(listener);
    if ( pos > -1 ) {
      array.splice(pos,1);
    }
  }

  addConnectionListener(callback) {
    this.addListener( this.connectionListeners, callback);
  }
  
  addDataListener(callback) {
    this.addListener( this.dataListeners, callback);
  }
  
  addSceneListener(callback) {
    this.addListener( this.sceneListeners, callback);
  }

  addWelcomeListener(callback) {
    this.addListener( this.welcomeListeners, callback);
  }
  
  removeWelcomeListener(callback) {
    this.removeListener( this.welcomeListeners, callback);
  }

  addErrorListener(callback) {
    this.addListener( this.errorListeners, callback);
  }

  getScene( filter ) {
    // if ( typeof filter === 'function ') // TODO eval?
  // if ( typeof filter === 'object') // TODO instanceof?
  if ( typeof filter === 'undefined') {
    return this.scene;
  } else if ( typeof filter === 'string') {
      var ret = new Map();
      for ( const [key,value] of this.scene ) {
        if ( key.startsWith(filter) ) {
          ret.set(key,value);
        }
      }
      return ret;
    }
  }
  
  connect() {
    var url = window.location.href; // http://localhost:8080/console.html
    this.log("This href "+url);
    var start = url.indexOf('/');
    var protocol = url.substring(0,start);
    var webSocketProtocol = 'ws';
    if ( protocol == 'https:' ) {
      webSocketProtocol = 'wss';
    }
    //var end = url.lastIndexOf('/'); // localhost:8080/babylon/vrspace
    var end = url.indexOf('/', start+2); // localhost:8080/vrspace
    url = webSocketProtocol+':'+url.substring(start,end)+'/vrspace'; // ws://localhost:8080/vrspace
    this.log("Connecting to "+url);
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.connectionListeners.forEach((listener)=>listener(true));
    }
    this.ws.close = () => {
      this.connectionListeners.forEach((listener)=>listener(false));
    }
    this.ws.onmessage = (data) => {
      this.receive(data.data);
      this.dataListeners.forEach((listener)=>listener(data.data)); 
    }
    this.log("Connected!")
  }
  
  disconnect() {
    if (this.ws != null) {
      this.ws.close();
    }
    this.connectionListeners.forEach((listener)=>listener(false));
    this.log("Disconnected");
  }
  
  stringifyVector(vec) {
    return '{"x":'+vec.x+',"y":'+vec.y+',"z":'+vec.z+'}';
  }
  
  stringifyQuaternion(quat) {
    return '{"x":'+quat.x+',"y":'+quat.y+',"z":'+quat.z+',"w":'+quat.w+'}';
  }

  stringifyPair( field, value ) {
    if ( typeof value == "string") {
      return '"'+field+'":"'+value+'"';
    } else if ( typeof value == 'object') {
      if(value.hasOwnProperty('w')) {
        return '"'+field+'":'+this.stringifyQuaternion(value);
      } else if (value.hasOwnProperty('x') || value.hasOwnProperty('_x')) {
        return '"'+field+'":'+this.stringifyVector(value);
      } else {
        // assuming custom object
        return '"'+field+'":'+JSON.stringify(value);
      }
    } else if ( typeof value == 'number') {
      return '"'+field+'":'+value;
    } else {
      console.log("Unsupported datatype "+typeof value+", ignored user event "+field+"="+value);
      return '';
    }
  }
  
  create(className, fieldName, callback) {
    // TODO: use class metadata
    this.call('{"command":{"Describe":{"className":"'+className+'"}}}',(obj) => {
      var ret = null;
      for ( var field in obj.response ) {
        if ( field === fieldName ) {
          var javaType = obj.response[field];
          if ( javaType === 'String' ) {
            ret = '';
          } else if ( javaType == 'Long' ) {
            ret = 0;
          } else if ( javaType == 'Double' ) {
            ret = 0.0;
          } else {
            //ret = (Function('return new ' + javaType))();
            ret = new classes[className];
          }
          break;
        }
      }
      callback(ret);
    });
  }
  
  sendMy(field,value) {
    if ( this.me != null) {
      this.send('{"object":{"Client":'+this.me.id+'},"changes":{'+this.stringifyPair(field,value)+'}}');
    } else {
      this.log("No my ID yet, ignored user event "+field+"="+value);
    }
  }
  
  sendCommand( command, args ) {
    if ( args ) {
      this.send('{"command":{"'+command+'":'+JSON.stringify(args)+'}}');      
    } else {
      this.send('{"command":{"'+command+'":{}}}');      
    }
  }

  sendMyChanges(changes) {
    if ( ! changes || changes.length == 0 ) {
      return;
    }
    if ( this.me != null) {
      var index = 0;
      var msg = '{"object":{"Client":'+this.me.id+'},"changes":{';
      changes.forEach((change) => {
        msg += this.stringifyPair(change.field,change.value);
        index++;
        if ( index < changes.length ) {
          msg += ',';
        }
      });
      msg += '}}';
      this.send(msg);
    } else {
      this.log("No my ID yet, user event ignored:");
      this.log(changes);
    }
  }

  send(message) {
    this.log("Sending message: "+message);
    this.ws.send(message);
  }
  
  call( message, callback ) {
    this.responseListener = callback;
    this.send(message);
  }
  
  addToScene(className, object) {
    //var classInstance = (Function('return new ' + className))();
    if ( classes[className] ) {
      var classInstance = new classes[className];
      Object.assign(classInstance,object);
      var id = new ID(className,object.id);
      this.scene.set(id.toString(), classInstance);
      // notify listeners
      const e = new SceneEvent(this.scene, className, id, classInstance, null);
      this.sceneListeners.forEach((listener) => listener(e));
    } else {
      console.log("Unknown object type: "+className);
    }
  }
  
  addObject(obj) {
    var className = Object.keys(obj)[0];
    var object = Object.values(obj)[0];
    this.addToScene(className, object);
  }
  
  removeObject(objectId) {
    const id = new ID(Object.keys(objectId)[0],Object.values(objectId)[0]);
    const obj = this.scene.get(id.toString());
    const deleted = this.scene.delete(id.toString());
    this.log("deleted "+this.scene.size+" "+id+":"+deleted);
  // notify listeners
    const e = new SceneEvent(this.scene, id.className, id, null, obj);
    this.sceneListeners.forEach((listener) => listener(e));
  }
  
  processEvent(obj,changes) {
    var id = new ID(Object.keys(obj)[0],Object.values(obj)[0]);
    this.log("processing changes on "+id);
    if ( this.scene.has(id.toString())) {
      var object = this.scene.get(id.toString());
      Object.assign(object,changes);
      // TODO: route event to mesh/script
      // TODO: notify listeners
      object.notifyListeners(changes);
    } else {
      this.log("Unknown object "+id);
    }
  }
  
  receive(message) {
    this.log("Received: "+message);
    var obj = JSON.parse(message);
    if ("object" in obj){
      this.processEvent(obj.object,obj.changes);
    } else if ("Add" in obj ) {
      for ( i=0; i< obj.Add.objects.length; i++ ) {
        // this.log("adding "+i+":"+obj);
        this.addObject(obj.Add.objects[i]);
      }
      this.log("added "+obj.Add.objects.length+" scene size "+this.scene.size);
    } else if ("Remove" in obj) {
      for ( var i=0; i< obj.Remove.objects.length; i++ ) {
        this.removeObject(obj.Remove.objects[i]);
      }
    } else if ("ERROR" in obj){
      // TODO: error listener(s)
      this.log(obj.ERROR);
      this.errorListeners.forEach((listener)=>listener(obj.ERROR));
    } else if ( "Welcome" in obj) {
      var welcome = obj.Welcome;
      this.log("welcome "+welcome.client.id);
      if ( ! this.me ) {
        // FIXME: Uncaught TypeError: Cannot assign to read only property of function class
        this.me = Object.assign(Client,welcome.client);        
      }
      this.welcomeListeners.forEach((listener)=>listener(welcome));
    } else if ( "response" in obj) {
      this.log("Response to command");
      if ( typeof this.responseListener === 'function') {
        var callback = this.responseListener;
        this.responseListener = null;
        callback(obj);
      }
    } else {
      this.log("ERROR: unknown message type");
    }
  }
  
}

export const VRSPACE = new VRSpace();