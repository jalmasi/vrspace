/**
Object ID, consisting of class name and number.
 */
export class ID {
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
export class Rotation {
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
export class Point {
  constructor(){
    this.x=0;
    this.y=0;
    this.z=0;
  }
}

/**
Currently active animation of an object.
 */
export class Animation {
  constructor() {
    this.name=null;
    this.loop=false;
  }
}

/**
Welcome message received from the server when entering a world.
 */
export class Welcome {
  constructor() {
    this.client = null;
    this.permanents = [];
  }
}
/**
Basic VRObject, has the same properties as server counterpart.
 */
export class VRObject {
  constructor() {
    /** Id, equal on server and all instances */
    this.id = null;
    /** Position, Point */
    this.position = null;
    /** Rotation, Point */
    this.rotation = null;
    /** Scale, Point */
    this.scale = null;
    /** Default false, permanent objects remain in the scene forever */
    this.permanent = false;
    /** Everything created by guest client is by default temporary */
    this.temporary = null;
    /** URL of 3D mesh */
    this.mesh = null;
    /** Active i.e. online users */
    this.active = false;
    /** Active animation */
    this.animation = null;
    /** URL of dynamically loaded script TODO */
    this.script = null;
    /** Custom properties of an object - shared transient object*/
    this.properties = null; 
    //this.children = []; // CHECKME
    this.listeners = [];
    /** Handy reference to VRSpace instance */
    this.VRSPACE = null;
    /** Server-side class name */
    this.className = 'VRObject';
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
  
  /** Publish the object to the server. Can be used only on new objects. */
  publish() {
    if ( ! this.VRSPACE ) {
      throw "the object is not shared yet";
    }
    let event = new VREvent( this );
    for ( var key in this ) {
      if ( key !== 'id' && key !== 'VRSPACE' ) {
        event.changes[key] = this[key];
      }
    }
    // FIXME: TypeError: cyclic object value
    let json = JSON.stringify(event);
    this.VRSPACE.log(json);
    this.VRSPACE.send(json);
  }
  
  getID() {
    return new ID(this.className, this.id);
  }
}

/**
Scene properties, same as server counterpart.
 */
export class SceneProperties{
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
Representation of a client (user, bot, remote server...).
@extends VRObject
 */
export class Client extends VRObject {
  constructor() {
    super();
    /** Client name, must be unique */
    this.name = null;
    /** Scene properties */
    this.sceneProperties = null; // CHECKME private - should be declared?
    /** Private tokens */
    this.tokens = null;
    /** Server-side class name */
    this.className = 'Client';
    this.hasAvatar = true;
  }
}

/**
Representation of a user.
@extends Client
 */
export class User extends Client {
  constructor() {
    super();
    /** Does this client have humanoid avatar, default true */
    this.humanoid = true;
    /** Does this client have video avatar, default false */
    this.video = false;
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
    /** Server-side class name */
    this.className = 'User';
    /** true if the client has avatar */
  }
}

export class RemoteServer extends Client {
  constructor() {
    super();
    this.url = null;
    this.thumbnail = null;
    this.humanoid = false;
    this.hasAvatar = false;
    this.className = 'RemoteServer';
  }
}

/**
See server side counterpart.
@extends Client
 */
export class EventRecorder extends User {
  constructor() {
    super();
    /** Server-side class name */
    this.className = 'EventRecorder';
  }
}

/**
Robot base class, useful for chatbots.
@extends User
 */
export class Bot extends User {
  constructor() {
    super();
    this.gender = null;
    this.lang = null;
    /** Server-side class name */
    this.className = 'Bot';
  }
}
export class BotLibre extends Bot {
  constructor() {
    super();
    /** Server-side class name */
    this.className = 'BotLibre';
  }
}

export class Terrain extends VRObject {
  constructor() {
    super();
    this.className = 'Terrain';
  }
}

export class VRFile extends VRObject {
  constructor() {
    super();
    this.className = 'VRFile';
    /** Content object contains fileName, contentType, length */    
    this.content = null;
  }
}

/**
An event that happened to an object.
@param obj VRObject instance
@param changes optional object encapsulating changes to the object (field:value)
 */
export class VREvent {
  constructor(obj, changes) {
    /** VRObject that has changed */
    this.object=new Object();
    // obufscators get in the way of this:
    //this.object[obj.constructor.name]=obj.id;
    this.object[obj.className]=obj.id;
    /** Changes to the object */
    if ( changes ) {
      this.changes = changes;
    } else {
      this.changes=new Object();
    }
  }
}

/**
A scene event - addition or removal of some objects, typically users.
An object is either added or removed, the other value is null.
 */
export class SceneEvent {
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

/**
Main client API class, no external dependencies.
Provides send methods to send messages to the server, to be distributed to other clients.
Listeners receive remote events.
 */
export class VRSpace {
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
    /** Listener to response to a command. */
    this.responseListener = null;
    this.sharedClasses = { ID, Rotation, Point, VRObject, SceneProperties, Client, User, RemoteServer, VREvent, SceneEvent, EventRecorder, Bot, BotLibre, Terrain, VRFile };
    //this.pingTimerId = 0;
    // exposing each class
    for( var c in this.sharedClasses ) {
      this[c] = this.sharedClasses[c];
    }
  }
  
  log( msg ) {
    if ( this.debug ) {
      console.log(msg);
    }
  }

  /* Used internally to add a listener */  
  addListener(array, callback) {
    if ( typeof callback == 'function' || typeof callback == 'object') {
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
  Remove a scene listener. 
  */
  removeSceneListener(callback) {
    this.removeListener( this.sceneListeners, callback );
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
  @param filter string to match current members, usually class name, or function that takes VRObject as argument
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
    } else if ( typeof filter === 'function') {
      var ret = new Map();
      for ( const [key,value] of this.scene ) {
        if ( filter(value) ) {
          ret.set(key,value);
        }
      }
      return ret;
    }
  }
  
  /**
  Connect to the server, attach listeners.
  @param url optional websocket url, defaults to /vrspace/client on the same server
   */
  connect(url) {
    if ( ! url ) {
      url = window.location.href; // http://localhost:8080/console.html
      this.log("This href "+url);
      let start = url.indexOf('/');
      let protocol = url.substring(0,start);
      let webSocketProtocol = 'ws';
      if ( protocol == 'https:' ) {
        webSocketProtocol = 'wss';
      }
      let end = url.indexOf('/', start+2);
      url = webSocketProtocol+':'+url.substring(start,end)+'/vrspace/client'; // ws://localhost:8080/vrspace
    }
    this.log("Connecting to "+url);
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.connectionListeners.forEach((listener)=>listener(true));
      /*
      this.pingTimerId = setInterval(() => {
        this.sendCommand("Ping");
      }, 20000);
      */
    }
    this.ws.onclose = () => {
      this.connectionListeners.forEach((listener)=>listener(false));
      //clearInterval(this.pingTimerId);
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

  /** Convert a key/value pair to json string.
  FIXME improperly stringifies objects having properties x, _x, or w. Properties other than x,y,z,w will be ignored.
  See stringifyVector and stringifyQuaternion. 
  This is essentially workaround for bablyon types, e.g. Vector3, that have _x, _y, _z properties.  
  @param field name of the field
  @param value string, object or number to convert
   */
  stringifyPair( field, value ) {
    if ( typeof value == "string") {
      return '"'+field+'":"'+value+'"';
    } else if ( typeof value == 'object') {
      if ( value == null ) {
        return '"'+field+'":null';
      } else if (
        (value.hasOwnProperty('x') || value.hasOwnProperty('_x')) &&
        (value.hasOwnProperty('y') || value.hasOwnProperty('_y')) &&
        (value.hasOwnProperty('z') || value.hasOwnProperty('_z'))
      ) {
        if(value.hasOwnProperty('w')) {
          return '"'+field+'":'+this.stringifyQuaternion(value);
        } else {
          return '"'+field+'":'+this.stringifyVector(value);
        }
      } else {
        // assuming custom object
        return '"'+field+'":'+JSON.stringify(value);
      }
    } else if ( typeof value == 'number') {
      return '"'+field+'":'+value;
    } else if ( typeof value == 'boolean') {
      return '"'+field+'":'+value;
    } else {
      console.log("Unsupported datatype "+typeof value+", ignored user event "+field+"="+value);
      return '';
    }
  }
  
  /** Create a local field of an object existing on the server FIXME Obsolete */
  createField(className, fieldName, callback) {
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
            ret = new this.newInstance(className);
          }
          break;
        }
      }
      callback(ret);
    });
  }

  /**
  Common code for createSharedObject and createScriptedObject
  @param command either Add or Share
  @param obj the new VRObject, containing all properties
  @param className optional class name to create, defaults to obj.className if exists, otherwise VRObjects
  @returns Promise with the created VRObject instance
   */
  async _createSharedObject( command, obj, className ) {
    if ( ! className ) {
      if ( obj.className ) {
        className = obj.className;
      } else {
        className = 'VRObject';
      }
    }
    let json = JSON.stringify(obj);
    this.log(json);
    return new Promise( (resolve, reject) => {
      // response to command contains object ID
      this.call('{"command":{"'+command+'":{"objects":[{"' + className + '":'+json+'}]}}}', (response) => {
        this.log("Response:", response);
        var objectId = response.response[0][className];
        const id = new ID(className,objectId);
        this.log("Created object:"+ objectId);
        // by now the object is already in the scene, since Add message preceeded the response
        var ret = this.scene.get(id.toString());
        resolve(ret);
      });
    });
  }

  /**
  Share an object.
  @param obj the new VRObject, containing all properties
  @param className optional class name to create, defaults to obj.className if exists, otherwise VRObjects
  @returns Promise with the created VRObject instance
   */
  async createSharedObject( obj, className ) {
    return this._createSharedObject("Add", obj, className);
  }
  
  /**
  Create a shared scripted object. 
  The server determines which scripts are allowed, so this sends different command than createSharedObject.
  @param obj the new VRObject, containing all properties
  @param callback called when shared object is received
  @param className optional class name to create, defaults to obj.className if exists, otherwise VRObjects
  @returns Promise with the created VRObject instance
   */
  async createScriptedObject( obj, className ) {
    return this._createSharedObject("Share", obj, className);
  }
  
  /**
  Delete a shared object.
  @param obj to be removed from the server
  @param callback optional, called after removal from the server
   */
  deleteSharedObject( obj, callback ) {
    this.call('{"command":{"Remove":{"objects":[{"' + obj.className + '":'+obj.id+'}]}}}', (response) => {
      if ( callback ) {
        callback(obj);
      }
    });
  }
  /** 
  Send notification of own property changes
  @param field name of member variable that has changed
  @param value new field value
   */
  sendMy(field,value) {
    if ( this.me != null) {
      this.send('{"object":{"'+this.me.className+'":'+this.me.id+'},"changes":{'+this.stringifyPair(field,value)+'}}');
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
   * Set a client token e.g. required to enter a world
   * @param name token name
   * @param value token value
   */
  setToken( name, value ) {
    this.sendCommand( "SetToken", {name:name, value:value});
  }

  /**
  Send changes to an object
  @param obj VRObject that changes
  @param changes array containing field/value pairs
   */
  sendChanges(obj, changes) {
    if ( ! changes || changes.length == 0 ) {
      return;
    }
    var index = 0;
    var msg = '{"object":{"'+obj.className+'":'+obj.id+'},"changes":{';
    changes.forEach((change) => {
      msg += this.stringifyPair(change.field,change.value);
      index++;
      if ( index < changes.length ) {
        msg += ',';
      }
    });
    msg += '}}';
    this.send(msg);
  }

  /**
  Send changes to an object
  @param obj VRObject that changes
  @param changes object containing changed fields
   */
  sendEvent(obj, changes) {
    if ( ! changes || changes.length == 0 ) {
      return;
    }
    var index = 0;
    var msg = '{"object":{"'+obj.className+'":'+obj.id+'},"changes":{';
    for ( var change in changes ){
      msg += this.stringifyPair(change,changes[change]);
      index++;
      msg += ',';
    };
    msg = msg.substring(0,msg.length-1)+'}}';
    this.send(msg);
  }

  /**
  Send changes to own avatar
  @param changes array with field/value pairs
   */
  sendMyChanges(changes) {
    if ( this.me != null) {
      this.sendChanges(this.me, changes);
    } else {
      this.log("No my ID yet, user event ignored:");
      this.log(changes);
      throw "No my ID yet, user event ignored:";
    }
  }

  /**
  Send changes to own avatar
  @param changes object containing changed field(s)
   */
  sendMyEvent(changes) {
    if ( this.me != null) {
      this.sendEvent(this.me, changes);
    } else {
      this.log("No my ID yet, user event ignored:");
      this.log(changes);
      throw "No my ID yet, user event ignored:";
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
  
  /** 
  Factory method
  @param className shared class name
  @returns new shared object instance
   */
  newInstance(className) {
    if ( this.sharedClasses[className] ) {
      return new this.sharedClasses[className];
    } else {
      console.log("Unknown object type: "+className);
      return null;
    }
  }

  /* Add an object to the scene, used internally */  
  addToScene(className, object) {
    var classInstance = this.newInstance(className);
    if ( classInstance ) {
      Object.assign(classInstance,object);
      classInstance.VRSPACE = this;
      var id = new ID(className,object.id);
      this.scene.set(id.toString(), classInstance);
      // notify listeners
      const e = new SceneEvent(this.scene, className, id, classInstance, null);
      this.sceneListeners.forEach((listener) => listener(e));        
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
      if ( ! this.me ) {
        // FIXME: Uncaught TypeError: Cannot assign to read only property of function class
        let client = new User();
        this.me = Object.assign(client,welcome.client.User);
      }
      this.welcomeListeners.forEach((listener)=>listener(welcome));
      if ( welcome.permanents ) {
        welcome.permanents.forEach( o => this.addObject(o));
      }
    } else if ("response" in obj) {
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