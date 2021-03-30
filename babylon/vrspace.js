/**
Object ID, consisting of class name and number.
 */
class ID {
  constructor(className,id) {
    /** Class name */
    this.className = className;
    /** Identifier (number) */
    this.id = id;
  }
  /** class name + ' ' + id */
  toString() {
    return this.className+" "+this.id;
  }
}

/**
Rotation, FIXME: not used
 */
class Rotation {
  constructor(){
    this.x=0;
    this.y=1;
    this.z=0;
    this.angle=0;
  }
}

/**
Point in space, x, y, z
 */
class Point {
  constructor(){
    this.x=0;
    this.y=0;
    this.z=0;
  }
}

/**
Basic VRObject, has the same properties as server counterpart.
 */
class VRObject {
  constructor() {
    /** Id, equal on server and all instances */
    this.id = null;
    /** Position, Point */
    this.position = null;
    /** Rotation, Point */
    this.rotation = null;
    /** Scale, Point */
    this.scale = null;
    /** default false */
    this.permanent = false;
    //this.active = false; // CHECKME
    //this.children = []; // CHECKME
    //this.mesh = null;
    //this.script = null; // CHECKME
    //this.streamId = null;
    this.listeners = [];
  }

  /**
  Add a change listener to the object.
   */  
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
  Remove the listener.
  */
  removeListener(listener) {
    var pos = this.listeners.indexOf(listener);
    if ( pos > -1 ) {
      this.listeners.splice(pos,1);
    }
  }
  
  /**
  Called when server sends notification that the object has changed. 
  Notifies all listeners of object and changes.
   */
  notifyListeners(changes) {
    for ( var i = 0; i < this.listeners.length; i++ ) {
      this.listeners[i](this,changes);
    }
  }
}

/**
Scene properties, same as server counterpart.
 */
class SceneProperties{
  constructor() {
    /** Visibility range, default 2000 */
    this.range = 2000;
    /** Movement resolution, default 10 */
    this.resolution = 10;
    /** Maximum size, default 1000 */
    this.size = 1000;
    /** Invalidation timeout in ms, default 30000 */
    this.timeout = 30000;
  }
}

/**
Representation of a client (user).
@extends VRObject
 */
class Client extends VRObject {
  constructor() {
    super();
    /** Client name, must be unique */
    this.name = null;
    /** Scene properties */
    this.sceneProperties = null; // CHECKME private - should be declared?
    /** Left arm position */
    this.leftArmPos = { x: null, y: null, z: null };
    /** Right arm position */
    this.rightArmPos = { x: null, y: null, z: null };
    /** Left arm rotation, quaternion */
    this.leftArmRot = { x: null, y: null, z: null, w: null };
    /** Right arm rotation, quaternion */
    this.rightArmRot = { x: null, y: null, z: null, w: null };
    /** User height, default 1.8 */
    this.userHeight = 1.8;
    /** Streaming token */
    this.token = null; // CHECKME: string, should be object?
  }
  /** true if the client has avatar */
  hasAvatar() {
    return this.mesh && this.mesh.toLowerCase().endsWith('.gltf');
  }
}

/**
See server side counterpart.
@extends Client
 */
class EventRecorder extends Client {
  constructor() {
    super();
  }
}

/**
An event that happened to an object.
 */
class VREvent {
  constructor(obj) {
    /** VRObject that has changed */
    this.object=new Object();
    this.object[obj.constructor.name]=obj.id;
    /** Changes to the object */
    this.changes=new Object();
  }
}

/**
A scene event - addition or removal of some objects, typically users.
An object is either added or removed, the other value is null.
 */
class SceneEvent {
  constructor(scene,className,objectId,added,removed) {
    /** Class name of object added/removed */
    this.className = className;
    /** Id of added/removed object */
    this.objectId = objectId;
    /** Added object */
    this.added = added;
    /** Removed object */
    this.removed = removed;
    /** New scene */
    this.scene = scene;
  }
}

const classes = { ID, Rotation, Point, VRObject, SceneProperties, Client, VREvent, SceneEvent, EventRecorder };

/**
Main client API class, no external dependencies.
Provides send methods to send messages to the server, to be distributed to other clients.
Listeners receive remote events.
 */
class VRSpace {
  constructor() {
    /** Underlying websocket */
    this.ws = null;
    /** Representation of own Client, available once connection is established */
    this.me = null;
    /** Map containing all objects in the scene */
    this.scene = new Map();
    /** Debug logging, default false */
    this.debug = false;
    this.connectionListeners = [];
    this.dataListeners = [];
    this.sceneListeners = [];
    this.welcomeListeners = [];
    this.errorListeners = [];
    this.responseListener = null;
  }
  
  log( msg ) {
    if ( this.debug ) {
      console.log(msg);
    }
  }

  /* Used internally to add a listener */  
  addListener(array, callback) {
    if ( typeof callback == 'function') {
      array.push(callback);
    }
  }
  
  /* Used internally to remove a listener */  
  removeListener(array, listener) {
    var pos = array.indexOf(listener);
    if ( pos > -1 ) {
      array.splice(pos,1);
    }
  }

  /** 
  Add a connection listener that gets notified when connection is activated/broken.
  Callback is passed boolean argument indicating connection state.
   */
  addConnectionListener(callback) {
    this.addListener( this.connectionListeners, callback);
  }
  
  /** Add a data listener that receives everything from the server (JSON string argument) */
  addDataListener(callback) {
    this.addListener( this.dataListeners, callback);
  }
  
  /** 
  Add a scene listener that gets notified when the scene is changed. 
  Scene listeners receive SceneEvent argument for each change. 
  */
  addSceneListener(callback) {
    this.addListener( this.sceneListeners, callback );
  }

  /** 
  Add a Welcome listener, notified when entering a world. 
  The listener receives Welcome object.
  */
  addWelcomeListener(callback) {
    this.addListener( this.welcomeListeners, callback);
  }
  
  /** 
  Remove welcome listener
  @param callback listener to remove 
  */
  removeWelcomeListener(callback) {
    this.removeListener( this.welcomeListeners, callback);
  }

  /** 
  Add error listener, notified when server sends error notifications. 
  Error listener is passed the string containing the server error message, e.g. java exception.
  */
  addErrorListener(callback) {
    this.addListener( this.errorListeners, callback);
  }

  /**
  Return the current scene, optionally filtered
  @param filter string to match current members, usually class name
   */
  getScene( filter ) {
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
  
  /**
  Connect to the server, attach listeners.
   */
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

  /** Disconnect, notify connection listeners */  
  disconnect() {
    if (this.ws != null) {
      this.ws.close();
    }
    this.connectionListeners.forEach((listener)=>listener(false));
    this.log("Disconnected");
  }
  
  /** Convert a vector to json string
  @param vec object having x,y,z properties
   */
  stringifyVector(vec) {
    return '{"x":'+vec.x+',"y":'+vec.y+',"z":'+vec.z+'}';
  }
  
  /** Convert a quaternion to json string
  @param vec object having x,y,z,w properties
   */
  stringifyQuaternion(quat) {
    return '{"x":'+quat.x+',"y":'+quat.y+',"z":'+quat.z+',"w":'+quat.w+'}';
  }

  /** Convert a key/value pair to json string
  @param field name of the field
  @param value string, object or number to convert
   */
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
  
  /** Create an object on the server */
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
  
  /** 
  Send notification of own property changes
  @param field name of member variable that has changed
  @param value new field value
   */
  sendMy(field,value) {
    if ( this.me != null) {
      this.send('{"object":{"Client":'+this.me.id+'},"changes":{'+this.stringifyPair(field,value)+'}}');
    } else {
      this.log("No my ID yet, ignored user event "+field+"="+value);
    }
  }
  
  /**
  Send a command to the server
  @param command to execute
  @param args optional object with command arguments
   */
  sendCommand( command, args ) {
    if ( args ) {
      this.send('{"command":{"'+command+'":'+JSON.stringify(args)+'}}');      
    } else {
      this.send('{"command":{"'+command+'":{}}}');      
    }
  }

  /**
  Send changes to own avatar
  @param changes object with field/value pairs
   */
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

  /*
  Send a message, internally called from other send methods
   */
  send(message) {
    this.log("Sending message: "+message);
    this.ws.send(message);
  }
  
  /**
  Perform a synchronous call.
  @param message JSON string to send
  @param callback function to execute upon receiving the response
   */
  call( message, callback ) {
    this.responseListener = callback;
    this.send(message);
  }

  /* Add an object to the scene, used internally */  
  addToScene(className, object) {
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
  
  /* Add the object, used internally */
  addObject(obj) {
    var className = Object.keys(obj)[0];
    var object = Object.values(obj)[0];
    this.addToScene(className, object);
  }
  
  /* Remove object, used internally */
  removeObject(objectId) {
    const id = new ID(Object.keys(objectId)[0],Object.values(objectId)[0]);
    const obj = this.scene.get(id.toString());
    const deleted = this.scene.delete(id.toString());
    this.log("deleted "+this.scene.size+" "+id+":"+deleted);
    // notify listeners
    const e = new SceneEvent(this.scene, id.className, id, null, obj);
    this.sceneListeners.forEach((listener) => listener(e));
  }
  
  /* process changes to the object, used internally */
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
  
  /**
  Called when a message is received from the server. JSON message is converted to an object, 
  then depending on object type, handled as one of: 
  message to an object in the scene,
  add an object message,
  remove an object,
  error message,
  response to a command
   */
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