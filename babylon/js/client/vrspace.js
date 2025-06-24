/**
Object ID, consisting of class name and number.
 */
export class ID {
  constructor(className,id) {
    /** Class name 
     * @type {string}
     */
    this.className = className;
    /** Identifier (number) 
     * @type {number}
     */
    this.id = id;
  }
  /** class name + ' ' + id 
   * @returns {string}
   */
  toString() {
    return this.className+" "+this.id;
  }
}

/**
 * Rotation
 * @typedef {Object} Rotation
 * @prop {number} [x=0]
 * @prop {number} [y=1]
 * @prop {number} [z=0]
 */
export class Rotation {
  constructor(){
    this.x=0;
    this.y=1;
    this.z=0;
  }
}

/**
 * Quaternion
 * @typedef {Object} Quaternion
 * @prop {number|null} [x]
 * @prop {number|null} [y]
 * @prop {number|null} [z]
 * @prop {number|null} [w]
 */
export class Quaternion {
  constructor(){
    this.x=null;
    this.y=null;
    this.z=null;
    this.w=null;
  }
}

/**
Point in space, x, y, z
 */
export class Point {
  constructor(){
    /** @type {number} */    
    this.x=0;
    /** @type {number} */    
    this.y=0;
    /** @type {number} */    
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
    /** TODO classname first, e.g. client.User.fields */
    this.client = null;
    /** @type {Array.<VRObject>} */
    this.permanents = [];
  }
}
/**
Basic VRObject, has the same properties as server counterpart.
 */
export class VRObject extends ID {
  constructor() {
    super();
    /** Id, equal on server and all instances
     * @type {number} 
     */
    this.id = null;
    /** Position, Point  
     * @type {Point} 
     */
    this.position = null;
    /** Rotation 
     * @type {Rotation|null} 
     */
    this.rotation = null;
    /** Scale, Point 
     * @type {Point|null} 
     */
    this.scale = null;
    /** Default false, permanent objects remain in the scene forever
     * @type {boolean} 
     */
    this.permanent = false;
    /** Everything created by guest client is by default temporary 
     * @type {boolean} 
     */
    this.temporary = null;
    /** URL of 3D mesh
     * @type {string|null}
     */
    this.mesh = null;
    /** Active i.e. online users
     * @type {boolean} 
     */
    this.active = false;
    /** Name of the animation that is currently active 
     * @type {string|null} 
     */
    this.animation = null;
    /** URL of dynamically loaded script
     * @type {string|null} 
     */
    this.script = null;
    /** Custom properties of an object - shared transient object
     * @type {Object}
     */
    this.properties = null;
    //this.children = []; // CHECKME
    /** Event listeners. Typically world manager listens to changes, and moves objects around. */
    this.listeners = [];
    /** Load listeners, functions that trigger after the mesh or script is loaded. Managed by WorldManager. CHECKME SoC */
    this.loadListeners = [];
    /** Internal, set by WorldManager after the mesh/script has loaded. */
    this._isLoaded = false;
    /** Handy reference to VRSpace instance */
    this.VRSPACE = null;
    /** Server-side class name 
     * @type {string} 
     */
    this.className = 'VRObject';
  }

  /**
  Add a change listener to the object.
   */  
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
  Add a load listener function to the object. Triggers immediatelly if mesh/script has already loaded (_isLoaded is true).
   */  
  addLoadListener(listener) {
    this.loadListeners.push(listener);
    if ( this._isLoaded ) {
      listener(this);
    }
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
  Remove a load listener.
  */
  removeLoadListener(listener) {
    var pos = this.loadListeners.indexOf(listener);
    if ( pos > -1 ) {
      this.loadListeners.splice(pos,1);
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

  /** Triggers all load listeners */
  notifyLoadListeners() {
    this._isLoaded = true;
    this.loadListeners.forEach(l=>l(this));
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
    /** Visibility range, default 2000
     * @type {number}
     */
    this.range = 2000;
    /** Movement resolution, default 10
     * @type {number} 
     */
    this.resolution = 10;
    /** Maximum size, default 1000 
     * @type {number} 
     */
    this.size = 1000;
    /** Invalidation timeout in ms, default 30000 
     * @type {number} 
     */
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
    /** Client name, must be unique
     * @type {string} 
     */
    this.name = null;
    /** Scene properties
     * @type {SceneProperties} 
     */
    this.sceneProperties = null; // CHECKME private - should be declared?
    /** Private tokens, map of strings */
    this.tokens = null;
    /** Server-side class name
     * @type {string} 
     */
    this.className = 'Client';
    /** true if the client has an avatar
     * @type {boolean} 
     */
    this.hasAvatar = true;
    /** avatar picture url
     * @type {string|null} 
     */
    this.picture = null;
  }
  
  /** Handy function, returns name if not null, else class and id */
  getNameOrId() {
    if ( this.name ) {
      return this.name;
    }
    return this.className+" "+this.id;
  }
}

/**
Representation of a user.
@extends Client
 */
export class User extends Client {
  constructor() {
    super();
    /** Does this client have humanoid avatar, default true
     * @type {boolean} 
     */
    this.humanoid = true;
    /** Does this client have video avatar, default false
     * @type {boolean} 
     */
    this.video = false;
    /** Left arm position
     * @type {Point} 
     */
    this.leftArmPos = { x: null, y: null, z: null };
    /** Right arm position
     * @type {Point} 
     */
    this.rightArmPos = { x: null, y: null, z: null };
    /** Left arm rotation, quaternion
     * @type {Quaternion} 
     */
    this.leftArmRot = { x: null, y: null, z: null, w: null };
    /** Right arm rotation, quaternion
     * @type {Quaternion} 
     */
    this.rightArmRot = { x: null, y: null, z: null, w: null };
    /** User height, default 1.8
     * @type {number} 
     */
    this.userHeight = 1.8;
    /** Server-side class name
     * @type {string} 
     */
    this.className = 'User';
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

export class Background extends VRObject {
  constructor() {
    super();
    this.className = 'Background';
    this.texture = null;
    this.ambientIntensity = 0;
  }
}


export class Game extends VRObject {
  constructor() {
    super();
    this.className = 'Game';
    this.name = null;
    this.numberOfPlayers=0;
    this.status=null;
    this.players=[];
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
    /** Class name of object added/removed 
     * @type {string}
     */
    this.className = className;
    /** Id of added/removed object 
     * @type {ID}
    */
    this.objectId = objectId;
    /** Added object
     * @type {VRObject|null}
     */
    this.added = added;
    /** Removed object
     * @type {VRObject|null}
     */
    this.removed = removed;
    /** New scene
     * @type {Map<String, Object>}
     */
    this.scene = scene;
  }
}

/**
 * Streaming session data, used to match the client avatar or other mesh to the video/audio stream.
 */
export class SessionData {
  /**
   * @param {String} json string representation of this object (passed along connection as user data) 
   */
  constructor(json) {
    /** Client id, long
     * @type {number} 
     */
    this.clientId = null;
    /** Session name, matches either world name for public world, or world token for private world
     * @type {string} 
     */
    this.name = null;
    /** Session type - 'main' or 'screen'
     * @type {string} 
     */
    this.type = null;
    JSON.parse(json, (key,value)=>{
      this[key] = value;
      return value;
    });
  }
}

export class UserGroup {
  constructor() {
    this.id = null;
    this.name = null;
    this.isPublic = null;    
  }
}

export class GroupMember {
  constructor() {
    this.id = null;
    /** @type {UserGroup} */
    this.group = null;
    /** @type {Client} */
    this.client = null;
    this.pendingInvite = null;
    this.pendingRequest = null;
    /** @type {Client} */
    this.sponsor = null;
    this.lastUpdate = null;
  }
}

export class GroupMessage {
  constructor() {
    /** @type {Client} */
    this.from = null;
    /** @type {UserGroup} */
    this.group = null;
    this.content = null;
    this.link = null;
    this.local = null;
  }
}

/** Notification from a UserGroup */
export class GroupEvent {
  constructor() {
    /** @type {GroupMessage} */
    this.message = null;
    /** @type {GroupMember} */
    this.invite = null;
    /** @type {GroupMember} */
    this.ask = null;
    /** @type {GroupMember} */
    this.allowed = null;
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
    /** Representation of own Client, available once the connection is established
     * @type {User} 
     */
    this.me = null;
    /** Map containing all objects in the scene
     * @type {Map<String, VRObject>}
     */
    this.scene = new Map();
    /** Debug logging, default false */
    this.debug = false;
    this.connectionListeners = [];
    this.dataListeners = [];
    this.sceneListeners = [];
    this.welcomeListeners = [];
    this.errorListeners = [];
    this.groupListeners = [];
    /** Listener to response to a command. */
    this.responseListener = null;
    this.sharedClasses = { ID, Rotation, Point, VRObject, SceneProperties, Client, User, RemoteServer, VREvent, SceneEvent, EventRecorder, Bot, BotLibre, Terrain, VRFile, Game, Background };
    //this.pingTimerId = 0;
    // exposing each class
    for( var c in this.sharedClasses ) {
      this[c] = this.sharedClasses[c];
    }
    this.messageHandlers = {
      object:message=>this.handleEvent(message),
      Add:message=>this.handleAdd(message.Add),
      Remove:message=>this.handleRemove(message.Remove),
      ERROR:message=>this.handleError(message.ERROR),
      Welcome:message=>this.handleWelcome(message.Welcome),
      response:message=>this.handleResponse(message.response),
      GroupEvent:message=>this.handleGroupEvent(message)
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
      if ( array.includes(callback) ) {
        console.error("Listener already added");
      } else {
        array.push(callback);
      }
    }
    return callback;
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
    return this.addListener( this.connectionListeners, callback);
  }
  
  /** Add a data listener that receives everything from the server (JSON string argument) */
  addDataListener(callback) {
    return this.addListener( this.dataListeners, callback);
  }

  /**
   * @callback sceneCallback
   * @param {SceneEvent} event
  */
   
  /** 
  Add a scene listener that gets notified when the scene is changed. 
  Scene listeners receive SceneEvent argument for each change.
  @param {sceneCallback} callback 
  */
  addSceneListener(callback) {
    return this.addListener( this.sceneListeners, callback );
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
    return this.addListener( this.welcomeListeners, callback);
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
    return this.addListener( this.errorListeners, callback);
  }

  /** 
  Remove error listener
  @param callback listener to remove 
  */
  removeErrorListener(callback) {
    this.removeListener( this.errorListeners, callback);
  }

  /** 
  Add a group listener, notified when entering a world. 
  The listener receives Welcome object.
  @param {function(GroupEvent)} callback 
  */
  addGroupListener(callback) {
    return this.addListener( this.groupListeners, callback);
  }

  /** 
  Remove group listener
  @param callback listener to remove 
  */
  removeGroupListener(callback) {
    this.removeListener( this.groupListeners, callback);
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
   * @private
   */
  defaultWebsocketUrl() {
    let url = window.location.href;
    this.log("This href "+url);
    let start = url.indexOf('/');
    let protocol = url.substring(0,start);
    let webSocketProtocol = 'ws';
    if ( protocol == 'https:' ) {
      webSocketProtocol = 'wss';
    }
    let end = url.indexOf('/', start+2);
    url = webSocketProtocol+':'+url.substring(start,end)+'/vrspace/client'; // ws://localhost:8080/vrspace
    return url;
  }  
  /**
  Connect to the server, attach connection listeners and data listeners to the websocket.
  @param {string} [url] optional websocket url, defaults to /vrspace/client on the same server
  @returns {Promise} promise resolved once the connection is successful
   */
  connect(url) {
    if ( ! url ) {
      url = this.defaultWebsocketUrl(url);
    }
    this.log("Connecting to "+url);
    this.ws = new WebSocket(url);
    return new Promise( (resolve, reject) => {
      this.ws.onopen = () => {
        this.connectionListeners.forEach((listener)=>listener(true));
        resolve();
      }
      this.ws.onclose = () => {
        // TODO handle websocket error codes, reconnect if possible
        // https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close_event
        // https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
        this.connectionListeners.forEach((listener)=>listener(false));
      }
      this.ws.onmessage = (data) => {
        this.receive(data.data);
        this.dataListeners.forEach((listener)=>listener(data.data)); 
      }    
    });
  }

  /** Disconnect, notify connection listeners */  
  disconnect() {
    if (this.ws != null) {
      this.ws.close();
    }
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
    this.call('{"command":{"Describe":{"className":"'+className+'"}}}',(response) => {
      var ret = null;
      for ( var field in response ) {
        if ( field === fieldName ) {
          var javaType = response[field];
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
  @param {string} command either Add or Share
  @param {VRObject} obj the new VRObject, containing all properties
  @param {string} className optional class name to create, defaults to obj.className if exists, otherwise VRObject
  @param {boolean} [temporary] create temporary object 
  @returns Promise with the created VRObject instance
  @private
   */
  async _createSharedObject( command, obj, className, temporary ) {
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
        var objectId = response[0][className];
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
  @param {VRObject} obj the new VRObject, containing all properties
  @param {string|undefined} [className] optional class name to create, defaults to obj.className if exists, otherwise VRObject
  @returns {Promise<VRObject>} Promise with the created VRObject instance
   */
  async createSharedObject( obj, className ) {
    return this._createSharedObject("Add", obj, className);
  }
  
  /**
  Create a shared scripted object. 
  The server determines which scripts are allowed, so this sends different command than createSharedObject.
  @param {VRObject} obj the new VRObject, containing all properties
  @param {string|undefined} [className] optional class name to create, defaults to obj.className if exists, otherwise VRObject
  @returns {Promise<VRObject>} Promise with the created VRObject instance
   */
  async createScriptedObject( obj, className ) {
    return this._createSharedObject("Share", obj, className, true);
  }
  
  /**
  Delete a shared object.
  @param {ID} obj to be removed from the server
  @param {*} [callback] optional, called after removal from the server
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
  @param {string} field name of member variable that has changed
  @param {*} value new field value
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
  @param {string} command to execute
  @param {Object} args optional object with command arguments
   */
  sendCommand( command, args ) {
    if ( args ) {
      this.send('{"command":{"'+command+'":'+JSON.stringify(args)+'}}');      
    } else {
      this.send('{"command":{"'+command+'":{}}}');
    }
  }

  /**
  Send a command to the server
  @param {string} command to execute
  @param callback function that's called with command return value
   */
  callCommand( command, callback ) {
    this.call('{"command":{"'+command+'":{}}}', callback);
  }


  /**
  Send a command to the server
  @param {string} command to execute
   */
  async callCommandAsync( command ) {
    return this.callAsync('{"command":{"'+command+'":{}}}');
  }



  /**
   * Set a client token e.g. required to enter a world
   * @param {string} name token name
   * @param {string} value token value
   */
  setToken( name, value ) {
    this.sendCommand( "SetToken", {name:name, value:value});
  }

  /**
   * Enter a world, optionally with a token (that may be required for private worlds).
   * The server sends Welcome message, that's supposed to be processed with Welcome listeners.
   * 
   * @param {string} world Name of the world to enter
   * @param {string} [token] optional token value
   */
  enter( world, token ) {
    if ( token ) {
      this.sendCommand("Enter", { world: world, token: token });    
    } else {
      this.sendCommand("Enter", { world: world });      
    }
  }

  /**
   * Enter a world, optionally with a token (that may be required for private worlds).
   * The servers sends back Welcome response message, that is resolved in Promise.
   * 
   * @param {string} world Name of the world to enter
   * @param {string} [token] optional token value
   * @returns {Promise<Welcome>} promise with the welcome message 
   */
  enterAsync( world, token ) {
    let command = '{"command":{"Enter":{"async":false, "world":"'+world+'"}}}';
    if ( token ) {
      command = '{"command":{"Enter":{"async":false, "world":"'+world+'", "token":"'+token+'"}}}';
    }
    return new Promise( (resolve, reject) => {
      this.call(command, (response) => {
        resolve(response);
      });
    });
  }

  /**
   * Start the session: sends Session command to the server
   * @returns {Promise} resolves when server responds 
   */
  async sessionStart() {
    return this.callCommandAsync("Session");
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
  @param {ID} obj VRObject that changes
  @param {Object} changes object containing changed fields
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
  @param {Object} changes object containing changed fields
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
  @param {string} message JSON string to send
  @param {*} callback function to execute upon receiving the response
   */
  call( message, callback ) {
    this.responseListener = callback;
    this.send(message);
  }
  
  /**
   * Perfom a synchronous call.
   * @param {string} message JSON string to send
   * @returns {Promise} resolves with response from the server
   */
  callAsync(message) {
    return new Promise((resolve,reject)=>this.call(message, (response)=>resolve(response)));
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
  
  /**
  Called when a message is received from the server. JSON message is converted to an object, 
  then depending on object type, forwarded to one of this.messageHandlers.
  @param {String} message text message from the server over the websocket  
   */
  receive(message) {
    this.log("Received: "+message);
    let obj = JSON.parse(message);
    let handlerName = Object.keys(obj)[0];
    try {
      if ( Object.hasOwn(this.messageHandlers,handlerName) ) {
        this.messageHandlers[handlerName](obj);
      } else {
        console.error("ERROR: unknown message type", message);
      }
    } catch (exception) {
      console.error("ERROR processing message ", message, exception);
    }
  }

  /**
   * Handle event of a shared VRObject: find the object in the scene, apply changes, notify listeners.
   * @param {VREvent} message containing object id and changes  
   */  
  handleEvent(message){
    var id = new ID(Object.keys(message.object)[0],Object.values(message.object)[0]);
    this.log("processing changes on "+id);
    if ( this.scene.has(id.toString())) {
      var object = this.scene.get(id.toString());
      Object.assign(object,message.changes);
      object.notifyListeners(message.changes);
    } else {
      this.log("Unknown object "+id);
    }
  }
  /**
   * Handle Add message: add every object to the scene, and notify listeners. Calls addObject.
   * @param {Add} add Add command containing addedd objects
   */
  handleAdd(add){
    for ( let i=0; i< add.objects.length; i++ ) {
      // this.log("adding "+i+":"+obj);
      this.addObject(add.objects[i]);
    }
    this.log("added "+add.objects.length+" scene size "+this.scene.size);
  }
  /**
   * Handle Remove message: remove every object from the scene, and notify listeners. Calls removeObject.
   * @param {Remove} remove Remove command containing list of object IDs to remove
   */
  handleRemove(remove){
    for ( let i=0; i< remove.objects.length; i++ ) {
      this.removeObject(remove.objects[i]);
    }
  }
  /**
   * Handle server error: log the error, and notify error listeners.
   * @param {object} error object containing error message received from the server
   */
  handleError(error){
    this.log(error);
    this.errorListeners.forEach((listener)=>listener(error));
  }
  /**
   * Handle Welcome message: create own user object, and notify welcome listeners. Adds all permanent objects to the scene.
   * @param {Welcome} welcome the Welcome message. 
   */
  handleWelcome(welcome){
    if ( ! this.me ) {
      // FIXME: Uncaught TypeError: Cannot assign to read only property of function class
      let client = new User();
      this.me = Object.assign(client,welcome.client.User);
    }
    this.welcomeListeners.forEach((listener)=>listener(welcome));
    if ( welcome.permanents ) {
      welcome.permanents.forEach( o => this.addObject(o));
    }
  }
  /**
   * Handle response to command: if responseListener is installed, execute it with the message, ignore otherwise.
   * @param {object} response object containing response to the command, can be anything, depending on the command. 
   */
  handleResponse(response){
    this.log("Response to command");
    if ( typeof this.responseListener === 'function') {
      var callback = this.responseListener;
      this.responseListener = null;
      callback(response);
    }
  }
  
  /**
   * Handle a group event, simply forward the event to all groupListeners.
   * @param {GroupEvent} event 
   */
  handleGroupEvent(event) {
    this.groupListeners.forEach(l=>l(event.GroupEvent));
  }

  /**
   * Experimental. Executes StreamingSession start command on the server that returns session token,
   * the executes callback, passing the token to it 
   */
  async startStreaming( callback ) {
    return new Promise( (resolve, reject) => {
      this.call('{"command":{"StreamingSession":{"action":"start"}}}', (response) => {
        resolve(response);
        if ( callback ) {
          callback(response);
        }
      });
    });
  }

  /**
   * Experimental. Executes StreamingSession stop command on the server. 
   * CHECKME Since the server manages streaming sessions anyway, this may not be needed at all.
   */
  stopStreaming() {
    this.sendCommand("StreamingSession", {action:"stop"});
  }
  
}

export const VRSPACE = new VRSpace();