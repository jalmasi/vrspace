import {VRSPACE} from './vrspace.js';
import {Avatar} from './avatar.js';

/**
Script loader
 */
export class ScriptLoader {
  constructor() {
    // script url, loaded false/true
    this.scripts = {};
  }
  
  /** 
  Add a script to load path
  @param script url to load the script from
   */
  add(script) {
    if (typeof this.scripts[script] === 'undefined' ) {
      this.scripts[script] = false;
    }
    return this;
  }
  
  /**
  Load all scripts
  @param parallel default false - wait for each one to load before loading the next one
   */
  async load(parallel = false) {
    for ( var script in this.scripts ) {
      if ( ! this.scripts[script] ) {
        await this.loadScript(script, parallel);
      }
    }
  }
  
  async loadScript(path, parallel) {
    return new Promise( (resolve, reject) => {
      const script = document.createElement('script');
      script.src = path;
      if (parallel) {
        document.body.appendChild(script);
        this.scripts[path] = true;
        resolve();
      } else {
        script.async = true;
        document.body.appendChild(script);
        script.onload = () => { 
          this.scripts[path] = true;
          resolve(); 
        }
      }
    });
  }
}

/**
Main UI class, provides utility methods and basic UI elements.
@class
 */
export class VRSpaceUI {

  /** Creates UI with default LoadProgressIndicator */
  constructor( ) {
    /** babylon scene*/
    this.scene = null;
    /** vrspace.org logo mesh */
    this.logo = null;
    /** portal mesh */
    this.portal = null;
    /** debug output enabled */
    this.debug = false;
    /** frames per second */ 
    this.fps = 5; // CHECKME: reasonable default fps
    /** content base (prefix), default empty (same host) */
    this.contentBase = '';
    /** Pointer to function, defaults to this.loadProgressIndiciatorFactory */
    this.loadProgressIndicator = (scene, camera) => this.loadProgressIndicatorFactory(scene, camera);
    /** Script loader */
    this.scriptLoader = new ScriptLoader();
    /** @private */ 
    this.indicator = null;
    /** @private */ 
    this.initialized = false;
    /** @private */
    this.optimizingScene = false;
    /** reference to VRSpace singleton */
    this.VRSPACE = VRSPACE;
  }

  /** Preloads vrspace.org logo and portal for later use 
  @param scene
  */
  async init(scene) {
    if ( ! this.initialized || this.scene !== scene ) {
      this.scene = scene;
      // TODO figure out location of script
      var container = await BABYLON.SceneLoader.LoadAssetContainerAsync(this.contentBase+"/babylon/","logo.glb",this.scene);
      this.logo = container.meshes[0];
      for ( var i = 0; i < container.meshes; i++ ) {
        container.meshes[i].checkCollisions = false;
      }
      this.logo.name = "VRSpace.org Logo";
      await this.loadPortal(scene);
      this.initialized = true;
    }
    return this;
  }

  /** Creates default LoadProgressIndicator bound to given camera, if one does not already exist.
  @param scene
  @param camera
  @returns load progress indicator 
   */
  loadProgressIndicatorFactory(scene, camera) {
    if ( ! this.indicator ) {
      this.indicator = new LoadProgressIndicator(scene, camera);
    }
    return this.indicator;
  }
  
  /** Logs to js console if debug is enabled
  @param something to log
   */
  log( something ) {
    if ( this.debug ) {
      console.log( something );
    }
  }

  /** loads the portal 
  @param scene
  */
  async loadPortal(scene) {
    if ( ! this.portal ) {
      var container = await BABYLON.SceneLoader.LoadAssetContainerAsync(this.contentBase+"/babylon/portal/", "scene.gltf", scene)
      container.materials[0].albedoColor = BABYLON.Color3.FromHexString('#B3EEF3');
      container.materials[0].metallic = 0.85;
      
      this.portal = container.createRootMesh();
      this.portal.rotation = new BABYLON.Vector3(0,Math.PI/2,0);
      this.portal.name = 'Portal';
      //container.addAllToScene();
    }
    return this.portal;
  }

  /** lists files on a server directory
  @param theUrl url to load from
  @param callback to call load, passing it XMLHttpRequest
  */
  listFiles(theUrl, callback){
    this.log("Fetching "+theUrl);
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.responseType = "document";
    xmlHttp.onreadystatechange = function() {
      if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
        callback(xmlHttp);
      }
    }
    xmlHttp.open("GET", theUrl, true); // true for asynchronous
    xmlHttp.send(null);
    return xmlHttp;
  }
  
  
  /** list folders with their jpg thumbnails (files ending with .jpg)
  @param dir directory to list
  @param callback to call
   */ 
  listThumbnails(dir, callback) {
    this.listMatchingFiles( dir, callback, '.jpg' )
  }

  /** list character folders and their fix files 
  @param dir directory to list
  @param callback to call
  */
  listCharacters(dir, callback) {
    this.listMatchingFiles( dir, callback, '-fixes.json' )
  }
  
  /**
  list server folders along with their matching files
  i.e. files with the same name, plus given suffix
  @param dir directory to list
  @param callback to call
  @param suffix of related file
   */
  listMatchingFiles(dir, callback, suffix) {
    if ( !dir.endsWith('/') ) {
      dir += '/';
    }
    var ui = this;
    return this.listFiles(dir, (xmlHttp) => {
      var links = xmlHttp.responseXML.links;
      var files = [];
      var fixes = [];
      
      // first pass:
      // iterate all links, collect avatar directories and fixes
      for ( var i = 0; i < links.length; i++ ) {
        var link = links[i];
        var href = link.href;
        if ( href.indexOf('?') > 0 ) {
          continue;
        }
        if ( link.baseURI.length > link.href.length ) {
          continue;
        }
        if ( link.href.endsWith(suffix) ) {
          fixes.push(href.substring(link.baseURI.length));
          continue;
        }
        if ( ! link.href.endsWith('/') ) {
          continue;
        }
        href = href.substring(link.baseURI.length);
        href = href.substring(0,href.indexOf('/'));
        ui.log(link.baseURI+' '+href);
        files.push(href);
      }

      // second pass: match folders with related files
      var folders = [];
      for ( var i = 0; i < files.length; i++ ) {
        var fix = null;
        var fixName = files[i]+suffix;
        var index = fixes.indexOf(fixName);
        if ( index >= 0) {
          fix = fixes[index];
        }
        folders.push(new ServerFolder( dir, files[i], fix ));
      }
      
      ui.log(folders);
      callback(folders);
    });
  }
  
  /**
  Utility method, should a node and its children receive shadows.
  @param node a babylonjs node
  @param shadows true ofr false
   */
  receiveShadows( node, shadows ) {
    node.receiveShadows = shadows;
    if ( node.material ) {
      if ( node.material.getClassName() == "PBRMaterial" ) {
        // something to do with inverse square root of physical material
        node.material.usePhysicalLightFalloff = false;
      }
    }
    var children = node.getChildren();
    for ( var i = 0; i < children.length; i++ ) {
      this.receiveShadows(children[i], shadows);
    }
  }

  /**
  Utility method to instantiate if possible, or otherwise clone a mesh, including all children recursivelly.
  @param mesh to instantiate/clone
  @param parent optional, copy will have this parent
  @param replaceParent optional
  @returns copied mesh
   */
  copyMesh(mesh, parent, replaceParent) {
    if ( mesh.geometry ) {
      var copy = mesh.createInstance(mesh.name+"-copy");
      copy.parent = parent;
    } else if (replaceParent && parent) {
      copy = parent;
    } else {
      var copy = mesh.clone( mesh.name+"-copy", parent, true, false );
      copy.parent = parent;
    }
    var children = mesh.getChildren();
    for ( var i = 0; i < children.length; i++ ) {
      this.copyMesh(children[i], copy, replaceParent);
    }
    return copy;
  }

  /**
  Utility method - create x,y,z animation of a mesh field.
  @param mesh to animate
  @param field name of field to animate, e.g. "position" or "rotation"
  @param fps frames per second, defaults to fps field value
  @returns babylonjs AnimationGroup
   */
  createAnimation(mesh, field, fps) {
    if ( ! fps ) {
      fps = this.fps;
    }
    var group = new BABYLON.AnimationGroup(field+" "+mesh.id);
    
    var xAnim = new BABYLON.Animation("xAnim "+mesh.id, field+".x", fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    var xKeys = []; 
    xKeys.push({frame:0, value: 0});
    xKeys.push({frame:1, value: 0});
    xAnim.setKeys(xKeys);
    
    var yAnim = new BABYLON.Animation("yAnim "+mesh.id, field+".y", fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    var yKeys = []; 
    yKeys.push({frame:0, value: 0});
    yKeys.push({frame:1, value: 0});
    yAnim.setKeys(yKeys);

    var zAnim = new BABYLON.Animation("zAnim "+mesh.id, field+".z", fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    var zKeys = []; 
    zKeys.push({frame:0, value: 0});
    zKeys.push({frame:1, value: 0});
    zAnim.setKeys(zKeys);

    group.addTargetedAnimation(xAnim, mesh);
    group.addTargetedAnimation(yAnim, mesh);
    group.addTargetedAnimation(zAnim, mesh);

    return group;
  }
  
  /**
  Utility method - update x,y,z animation of a mesh field.
  If the animation group is playing, it is stopped first. After the update, starts to play, not looping.
  @param group AnimationGroup to update
  @param from Vector3
  @param to Vector3
   */
  updateAnimation(group, from, to) {
    if ( group.isPlaying ) {
      group.stop();
    }
    var xAnim = group.targetedAnimations[0].animation;
    xAnim.getKeys()[0].value = from.x;
    xAnim.getKeys()[1].value = to.x;
    var yAnim = group.targetedAnimations[1].animation;
    yAnim.getKeys()[0].value = from.y;
    yAnim.getKeys()[1].value = to.y;
    var zAnim = group.targetedAnimations[2].animation;
    zAnim.getKeys()[0].value = from.z;
    zAnim.getKeys()[1].value = to.z;
    group.play(false);
  }
 
  /**
  Utility method - create quaternion animation of a mesh field
  @param mesh to animate
  @param field name of field to animate, e.g. "rotationQuaternion"
  @param fps frames per second, defaults to fps field value
  @returns babylonjs AnimationGroup
   */
  createQuaternionAnimation(mesh, field, fps) {
    if ( ! fps ) {
      fps = this.fps;
    }
    var group = new BABYLON.AnimationGroup(field+" "+mesh.id);
    
    var anim = new BABYLON.Animation("qAnim "+mesh.id, field, fps, BABYLON.Animation.ANIMATIONTYPE_QUATERNION, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    var keys = []; 
    keys.push({frame:0, value: 0});
    keys.push({frame:1, value: 0});
    anim.setKeys(keys);
    
    group.addTargetedAnimation(anim, mesh);

    return group;
  }
  
  /**
  Utility method - update quaternion animation of a mesh field around Y axis.  
  @param group AnimationGroup to update
  @param from Vector3
  @param to Vector3
   */
  updateQuaternionAnimation(group, from, to) {
    if ( group.isPlaying ) {
      group.stop();
    }
    // 'to' is a Vector3, 'from' is current rotationQuaternion
    // we have to rotate around to.y axis
    var dest = new BABYLON.Quaternion.FromEulerAngles(0,to.y,0);
    var anim = group.targetedAnimations[0].animation;
    anim.getKeys()[0].value = from;
    anim.getKeys()[1].value = dest;
    group.play(false);
  }
  
  /** Optimize the scene for better frame rate */
  optimizeScene(scene) {
    if ( ! this.optimizingScene ) {
      this.optimizingScene = true;
      console.log("Running scene optimizer...")
      BABYLON.SceneOptimizer.OptimizeAsync(scene, 
        //BABYLON.SceneOptimizerOptions.ModerateDegradationAllowed(),
        BABYLON.SceneOptimizerOptions.HighDegradationAllowed(),
        () => {
          this.optimizingScene = false;
          console.log("Scene optimized");
        }, () => {
          this.optimizingScene = false;
          console.log("Scene optimization unsuccessfull");
      });
    }
  }
  
  /** 
  Utility method - load a script and append it to document head
  @param urls array containing URLs of scripts
  @param parallel optionally load in parallel
  */
  async loadScriptsToDocument(urls, parallel) {
    // TODO remember loaded scripts, do not load twice
    if ( Array.isArray(urls) ) {
      urls.forEach((url) => this.scriptLoader.add(url));
    } else {
      this.scriptLoader.add(urls);
    }
    return this.scriptLoader.load(parallel);
  }
  
  /**
  Utility method - returns the top parent node in hierarchy
   */
  findRootNode(mesh) {
    var parent = mesh;
    while ( parent && parent.parent ) {
      parent = parent.parent;
    }
    return parent;
  }

}

// this does not ensure singleton in the browser
// world scripts may be loaded from different contexts
//export const VRSPACEUI = new VRSpaceUI();

export let VRSPACEUI;

if (window.VRSPACEUI === undefined) {
  VRSPACEUI = new VRSpaceUI();
  window.VRSPACEUI=VRSPACEUI;
} else {
  VRSPACEUI = window.VRSPACEUI;
}

/** 
Room with vrspace.org logo as floor and invisible cylinder walls, as used on vrspace.org demo site.
*/
export class LogoRoom {
  /**
  @param scene babylonjs scene
   */
  constructor( scene ) {
    this.scene = scene;
    this.diameter = 20;
    this.shadows = true;
  }
  /**
  Creates VRSpaceUI, and displays the logo as floor mesh and creates walls.
   */
  async load() {
    this.floorGroup = new BABYLON.TransformNode("Floor");
    // ground, used for teleportation/pointer
    this.ground = BABYLON.MeshBuilder.CreateDisc("ground", {}, this.scene);
    this.ground.rotation = new BABYLON.Vector3( Math.PI/2, 0, 0 );
    this.ground.position = new BABYLON.Vector3( 0, 0.1, 0 );
    this.ground.parent = this.floorGroup;
    this.ground.isVisible = false;
    this.ground.checkCollisions = true;

    // mesh that we display as floor
    await VRSPACEUI.init(this.scene); // wait for logo to load
    VRSPACEUI.receiveShadows( VRSPACEUI.logo, this.shadows );
    VRSPACEUI.copyMesh(VRSPACEUI.logo, this.floorGroup, true);

    // walls, used for collisions, to limit the movement
    var walls = BABYLON.MeshBuilder.CreateCylinder("FloorWalls", {height:4,diameter:1,sideOrientation:BABYLON.Mesh.BACKSIDE}, this.scene);
    walls.checkCollisions = true;
    walls.isVisible = false;
    walls.position = new BABYLON.Vector3(0,2,0);
    walls.parent = this.floorGroup;

    this.setDiameter(this.diameter);
    this.floorGroup.position = new BABYLON.Vector3( 0, -0.05, 0 );
    this.scene.addTransformNode(this.floorGroup);
    
    return this;
  }
  /** disposes of instantiated geometry */
  dispose() {
    this.floorGroup.dispose();
  }
  /** set room diameter and rescale */
  setDiameter( diameter ) {
    this.diameter = diameter;
    this.floorGroup.scaling = new BABYLON.Vector3(this.diameter,2,this.diameter);
  }
  /** get current diameter */
  getDiameter() {
    return this.diameter;
  }
}

/**
Portal is an entrance to other worlds, disabled by default.
 */
export class Portal {
  /** Create a portal
  @param scene babylonjs scene
  @param serverFolder containing world class and content
  @param callback to execute when portal is activated (clicked, tapped)
  @param shadowGenerator optionally, portal can cast shadows
   */
  constructor( scene, serverFolder, callback, shadowGenerator ) {
    this.scene = scene;
    this.serverFolder = serverFolder;
    this.callback = callback;
    this.name = serverFolder.name;
    if ( serverFolder.relatedUrl() ) {
      this.thumbnail = new BABYLON.Texture(serverFolder.relatedUrl());
    }
    this.shadowGenerator = shadowGenerator;
    this.isEnabled = false;
    // used in dispose:
    this.controls = [];
    this.textures = [];
    this.materials = [];
  }
  /** handy, returns base url and folder name */
  worldUrl() {
    return this.serverFolder.baseUrl+this.serverFolder.name;
  }
  /** dispose of everything */
  dispose() {
    this.group.dispose();
    if (this.thumbnail) {
      this.thumbnail.dispose();
    }
    this.material.dispose();
    for ( var i = 0; i < this.controls.length; i++ ) {
      // CHECKME doesn's seem required
      this.controls[i].dispose();
    }
    for ( var i = 0; i < this.textures.length; i++ ) {
      this.textures[i].dispose();
    }
    for ( var i = 0; i < this.materials.length; i++ ) {
      this.materials[i].dispose();
    }
  }
  /** Load and display portal at given coordinates. Copies existing portal mesh to new coordinates and angle.
  @param x
  @param y
  @param z
  @param angle
   */
  async loadAt(x,y,z,angle) {
    this.group = new BABYLON.TransformNode('Portal:'+this.name);
    this.group.position = new BABYLON.Vector3(x,y,z);
    this.group.rotationQuaternion = new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,angle);

    if (this.shadowGenerator) {
      var clone = VRSPACEUI.portal.clone();
      clone.parent = this.group;
      var meshes = clone.getChildMeshes();
      for ( var i = 0; i < meshes.length; i++ ) {
        this.shadowGenerator.getShadowMap().renderList.push(meshes[i]);
      }
    } else {
      VRSPACEUI.copyMesh(VRSPACEUI.portal, this.group);
    }

    var plane = BABYLON.Mesh.CreatePlane("PortalEntrance:"+this.name, 1.60, this.scene);
    plane.parent = this.group;
    plane.position = new BABYLON.Vector3(0,1.32,0);
    var observable = (e) => {
      if(e.type == BABYLON.PointerEventTypes.POINTERDOWN){
        var p = e.pickInfo;
        if ( p.pickedMesh == plane ) {
          if ( this.isEnabled ) {
            console.log("Entering "+this.name);
            this.scene.onPointerObservable.clear();
            this.enter();
          } else {
            console.log("Not entering "+this.name+" - disabled");
          }
        }
      }
    };
    this.scene.onPointerObservable.add(observable);

    this.material = new BABYLON.StandardMaterial(this.name+"-noise", this.scene);
    plane.material = this.material;

    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
    var noiseTexture = new BABYLON.NoiseProceduralTexture(this.name+"-perlin", 256, this.scene);
    this.material.lightmapTexture = noiseTexture;
    noiseTexture.octaves = 4;
    noiseTexture.persistence = 1.2;
    noiseTexture.animationSpeedFactor = 2;
    plane.visibility = 0.85;
    this.textures.push( noiseTexture );

    this.title = BABYLON.MeshBuilder.CreatePlane("Text:"+this.name, {height:1,width:2}, this.scene);
    this.title.parent = this.group;
    this.title.position = new BABYLON.Vector3(0,2.5,0);
    this.title.isVisible = false;

    var titleTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.title, 128,128);
    this.materials.push(this.title.material);
    
    var titleText = new BABYLON.GUI.TextBlock();
    titleText.text = this.name;
    titleText.color = "white";

    titleTexture.addControl(titleText);
    //this.controls.push(titleText); // CHECKME doesn's seem required
    this.textures.push(titleTexture);
    
    return this;
  }
  /** Enables or disables the portal
  @param enable
   */
  enabled(enable) {
    if ( enable ) {
      this.material.emissiveTexture = this.thumbnail;
    } else {
      this.material.emissiveTexture = null;
    }
    this.title.isVisible = enable;
    this.isEnabled = enable;
  }
  /** Executes callback on entry */
  enter() {
    if ( this.callback ) {
      this.callback(this);
    }
  }
}

/**
A folder with a related file (e.g. thumbnail). 
 */
export class ServerFolder {
  /**
  @param baseUrl parent folder
  @param name folder name
  @param related name of related file
   */
  constructor( baseUrl, name, related ) {
    /** base url */
    this.baseUrl = baseUrl;
    /** folder name*/
    this.name = name;
    /** related file name */
    this.related = related;
  }
  /** returns full path of the folder */
  url() {
    return this.baseUrl+this.name;
  }
  /** returns full path of related file */
  relatedUrl() {
    if ( this.related ) {
      return this.baseUrl+this.related;
    }
    return null;
  }
}

/**
Default progress indicator: rotating vrspace.org logo, 30 cm ahead, 5 cm below camera.
Always bounds to active camera, to ensure same look and function on PC, mobile and VR devices.
 */
export class LoadProgressIndicator {
  /** Initializes VRSpaceUI, loading logo geometry so it can be reused.
  Installs active camera listener on the scene.
  @param scene
  @param camera current camera to bind to
   */
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.mesh = null;
    this.totalItems = 0;
    this.currentItem = 0;
    this.zeroRotation = null;
    this.angle = Math.PI;
    /** Debug log flag */
    this.debug = false;
    /** Whether progress of individual items should be tracked.
    Default true rotates the logo only when an item loads.
    False results in continous rotation.
    */
    this.trackItems = true;
    var indicator = this;
    VRSPACEUI.init(scene).then( (ui) => {
        indicator.mesh = ui.logo.clone("LoadingProgressIndicator");
        indicator.mesh.scaling.scaleInPlace(0.05);
        indicator.attachTo( indicator.camera );
        indicator.zeroRotation = new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X,-Math.PI/2);
        indicator.mesh.rotationQuaternion = indicator.zeroRotation;
        indicator.mesh.setEnabled(indicator.totalItems > indicator.currentItem);
        indicator.log("Loaded logo, current progress "+indicator.currentItem+"/"+indicator.totalItems);
    });
    this.scene.onActiveCameraChanged.add( () => {
      if ( this.scene.activeCamera ) {
        console.log("Camera changed: "+this.scene.activeCamera.getClassName());
        this.attachTo(camera); // FIXME undefined
      }
    });
  }
  _init() {
    this.totalItems = 0;
    this.currentItem = 0;
    this.angle = Math.PI;
  }
  attachTo(camera) { // FIXME not used
    this.camera = this.scene.activeCamera;
    if ( this.mesh ) {
      this.mesh.parent = this.scene.activeCamera;
      // VRDeviceOrientationFreeCamera
      // WebXRCamera
      if ( this.scene.activeCamera.getClassName() == 'WebXRCamera' ) {
        this.mesh.position = new BABYLON.Vector3(0,-0.2,0.5);
      } else {
        this.mesh.position = new BABYLON.Vector3(0,-0.1,0.5);
      }
    }
  }
  /** Add an item to be tracked. First item added shows the indicator and starts the animation.
  @param item an item to track
   */
  add(item) {
    if ( this.mesh && ! this.mesh.isEnabled() ) {
      this.mesh.setEnabled(true);
    }
    this.totalItems++;
    this.log("Added "+this.currentItem+"/"+this.totalItems);
    this._update();
  }
  /** Remove an item, e.g. loaded file. Last item removed stops the animation and hides the indicator.
  @param item to remove
   */
  remove(item) {
    this.currentItem++;
    this._update();
    this.log("Finished "+this.currentItem+"/"+this.totalItems);
    if ( this.totalItems <= this.currentItem && this.mesh ) {
      this.mesh.setEnabled(false);
      if ( this.animation ) {
        this.scene.unregisterBeforeRender(this.animation);
        delete this.animation;
      }
      this._init();
    }
  }
  /** Stops tracking individual items and runs contionous animation */
  animate() {
    this.trackItems = false;
    this.animation = () => { this._update() };
    this.scene.registerBeforeRender( this.animation );
  }
  /** 
  Call on load progress event.
  @param evt progress event
  @param item related item 
  */
  progress(evt, item) {
    this.trackItems = false;
    if (evt.lengthComputable) {
      var loaded = evt.loaded / evt.total;
      this.log("Loaded "+(loaded*100)+"%");
      if ( this.mesh && this.zeroRotation ) {
        this.angle += 0.01;
        this.mesh.rotationQuaternion = this.zeroRotation.multiply( new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,this.angle) );
      }
    } else {
      var dlCount = evt.loaded / (1024 * 1024);
      this.log("Loaded "+dlCount+" MB" );
    }
  }
  _update() {
    if ( this.mesh && this.zeroRotation ) {
      if ( this.trackItems ) {
        this.angle = Math.PI*(1+this.currentItem/this.totalItems);
      } else {
        this.angle += 0.01;
      }
      this.mesh.rotationQuaternion = this.zeroRotation.multiply( new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,this.angle) );
    }
  }
  log(something) {
    if ( this.debug ) {
      console.log(something);
    }
  }
}

/**
Event Recorder is server-side component.
This UI sends commands to the server that control recording and playback.
UI buttons (record, stop, play) are bound to current camera.
*/
export class RecorderUI {
  /** @param scene babylonjs scene */
  constructor( scene ) {
    // parameters
    this.scene = scene;
    this.recorder = null;
    // state variables
    scene.onActiveCameraChanged.add( (s) => this.cameraChanged() );
  }
  cameraChanged() {
    console.log("Camera changed: "+this.scene.activeCamera.getClassName()+" new position "+this.scene.activeCamera.position);
    this.camera = this.scene.activeCamera;
    this.recordButton.mesh.parent = this.camera;
    this.stopButton.mesh.parent = this.camera;
    this.playButton.mesh.parent = this.camera;
  }
  /** Shows the UI */
  showUI() {
    this.camera = this.scene.activeCamera;

    var manager = new BABYLON.GUI.GUI3DManager(this.scene);

    this.recordButton = new BABYLON.GUI.HolographicButton("RecordEvents");
    manager.addControl(this.recordButton);
    this.recordButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Dot.png"; // FIXME: cdn
    this.recordButton.text="REC";
    this.recordButton.position = new BABYLON.Vector3(-0.1,-0.1,.5);
    this.recordButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.recordButton.onPointerDownObservable.add( () => this.record());
    this.recordButton.mesh.parent = this.camera;
    
    this.stopButton = new BABYLON.GUI.HolographicButton("StopRecording");
    this.stopButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Pause.png"; // FIXME: cdn
    this.stopButton.text="Stop";
    manager.addControl(this.stopButton);
    this.stopButton.position = new BABYLON.Vector3(0,-0.1,.5);
    this.stopButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.stopButton.onPointerDownObservable.add( () => this.stop());
    this.stopButton.mesh.parent = this.camera;
    this.stopButton.isVisible = false;

    this.playButton = new BABYLON.GUI.HolographicButton("StartPlaying");
    this.playButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Play.png"; // FIXME: cdn
    manager.addControl(this.playButton);
    this.playButton.text="Play";
    this.playButton.position = new BABYLON.Vector3(0.1,-0.1,.5);
    this.playButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.playButton.onPointerDownObservable.add( () => this.play());
    this.playButton.mesh.parent = this.camera;
    this.playButton.isVisible = false;
  }
  
  /** Start recording */
  record() {
    console.log("Recording...");
    if ( ! this.recorder ) {
      // create recorder on the server
      VRSPACE.send('{"command":{"Recording":{"action":"record"}}}');
    }
    this.stopButton.isVisible = true;
    this.playButton.isVisible = false;
  }
  /** Stop recording */
  stop() {
    console.log('Stopped');
    VRSPACE.send('{"command":{"Recording":{"action":"stop"}}}');
    this.recordButton.isVisible = true;
    this.playButton.isVisible = true;
    this.stopButton.isVisible = false;
  }
  /** Start playing */
  play() {
    console.log('Playing...');
    VRSPACE.send('{"command":{"Recording":{"action":"play"}}}');
    this.recordButton.isVisible = false;
    this.stopButton.isVisible = true;
  }
  
}

/** UI to create floors, see {@link https://www.youtube.com/watch?v=8RxToSgtoko|this youtube video}.
Start recording, then edit, then save, either as js or json.
UI Buttons are bound to current camera.
 */
export class FloorRibbon {
  /**
  @param scene
  @param size floor size, default 1 m
  */
  constructor( scene, size ) {
    // parameters
    this.scene = scene;
    if ( size ) {
      this.size = size;
    } else {
      this.size = 1;
    }
    this.decimals = 2;
    this.floorMaterial = new BABYLON.StandardMaterial("floorMaterial", this.scene);
    this.floorMaterial.diffuseColor = new BABYLON.Color3(.5, 1, .5);
    this.floorMaterial.backFaceCulling = false;
    this.floorMaterial.alpha = 0.5;
    // state variables
    this.leftPath = [];
    this.rightPath = [];
    this.pathArray = [this.leftPath, this.rightPath];
    this.left = BABYLON.MeshBuilder.CreateSphere("leftSphere", {diameter: 1}, scene);
    this.right = BABYLON.MeshBuilder.CreateSphere("rightSphere", {diameter: 1}, scene);
    this.left.isVisible = false;
    this.right.isVisible = false;
    scene.onActiveCameraChanged.add( (s) => this.cameraChanged() );
    this.recording = false;
    this.editing = false;
    this.resizing = false;
    this.floorCount = 0;
  }
  cameraChanged() {
    console.log("Camera changed: "+this.scene.activeCamera.getClassName()+" new position "+this.scene.activeCamera.position);
    this.camera = this.scene.activeCamera;
    this.left.parent = this.camera;
    this.right.parent = this.camera;
    this.recordButton.mesh.parent = this.camera;
    this.editButton.mesh.parent = this.camera;
    this.jsonButton.mesh.parent = this.camera;
    this.jsButton.mesh.parent = this.camera;
  }
  /** Shows the UI */
  showUI() {
    this.camera = this.scene.activeCamera;

    var manager = new BABYLON.GUI.GUI3DManager(this.scene);

    this.recordButton = new BABYLON.GUI.HolographicButton("RecordPath");
    manager.addControl(this.recordButton);
    this.recordButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Play.png"; // FIXME: cdn
    this.recordButton.position = new BABYLON.Vector3(-0.1,-0.1,.5);
    this.recordButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.recordButton.onPointerDownObservable.add( () => this.startStopCancel());

    this.editButton = new BABYLON.GUI.HolographicButton("EditPath");
    this.editButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Edit.png"; // FIXME: cdn
    manager.addControl(this.editButton);
    this.editButton.position = new BABYLON.Vector3(0,-0.1,.5);
    this.editButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.editButton.onPointerDownObservable.add( () => this.edit());

    this.jsonButton = new BABYLON.GUI.HolographicButton("SavePathJson");
    this.jsonButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Download.png"; // FIXME: cdn
    manager.addControl(this.jsonButton);
    this.jsonButton.text="JSON";
    this.jsonButton.position = new BABYLON.Vector3(0.1,-0.1,.5);
    this.jsonButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.jsonButton.onPointerDownObservable.add( () => this.saveJson());

    this.jsButton = new BABYLON.GUI.HolographicButton("SavePathJs");
    this.jsButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Download.png"; // FIXME: cdn
    manager.addControl(this.jsButton);
    this.jsButton.text="JS";
    this.jsButton.position = new BABYLON.Vector3(0.2,-0.1,.5);
    this.jsButton.scaling = new BABYLON.Vector3( .05, .05, .05 );
    this.jsButton.onPointerDownObservable.add( () => this.saveJs());

    this.editButton.isVisible = false;
    this.jsonButton.isVisible = false;
    this.jsButton.isVisible = false;

    this.recordButton.mesh.parent = this.camera;
    this.editButton.mesh.parent = this.camera;
    this.jsonButton.mesh.parent = this.camera;
    this.jsButton.mesh.parent = this.camera;
  }
  startStopCancel() {
    if ( this.floorMesh ) {
      // cancel
      this.floorMesh.dispose();
      delete this.floorMesh;
      this.leftPath = [];
      this.rightPath = [];
      this.pathArray = [ this.leftPath, this.rightPath ];
    } else {
      this.recording = !this.recording;
      if ( this.recording ) {
        // start
        this.startRecording();
      } else {
        // stop
        this.createPath();
      }
    }
    this.updateUI();
  }
  updateUI() {
    if ( this.recording ) {
      this.recordButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Pause.png"; // FIXME: cdn
    } else if ( this.floorMesh) {
      this.recordButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Undo.png"; // FIXME: cdn
    } else {
      this.recordButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Play.png"; // FIXME: cdn
    }
    this.editButton.isVisible = !this.recording && this.floorMesh;
    this.jsonButton.isVisible = !this.recording && this.floorMesh;
    this.jsButton.isVisible = !this.recording && this.floorMesh;
  }
  trackActiveCamera() {
    var camera = this.scene.activeCamera;
    if ( camera ) {
      this.trackCamera(camera);
    }
  }
  startRecording() {
    this.leftPath = [];
    this.rightPath = [];
    this.pathArray = [ this.leftPath, this.rightPath ];
    this.trackActiveCamera();
  }
  trackCamera(camera) {
    console.log("Tracking camera");
    if ( camera ) {
      this.camera = camera;
    }
    this.lastX = this.camera.position.x;
    this.lastZ = this.camera.position.z;
    this.observer = this.camera.onViewMatrixChangedObservable.add((c) => this.viewChanged(c));

    this.left.parent = camera;
    this.right.parent = camera;
    var height = camera.ellipsoid.y*2;
    if ( this.camera.getClassName() == 'WebXRCamera' ) {
      var height = this.camera.realWorldHeight;
    }
    this.left.position = new BABYLON.Vector3(-1, -height, 0);
    this.right.position = new BABYLON.Vector3(1, -height, 0);
  }
  viewChanged(camera) {
    if (
      camera.position.x > this.lastX + this.size ||
      camera.position.x < this.lastX - this.size ||
      camera.position.z > this.lastZ + this.size ||
      camera.position.z < this.lastZ - this.size
    ) {
      //console.log("Pos: "+camera.position);
      //console.log("Pos left: "+this.left.absolutePosition+" right: "+this.right.absolutePosition);
      this.lastX = camera.position.x;
      this.lastZ = camera.position.z;
      if ( this.recording ) {
        this.leftPath.push( this.left.absolutePosition.clone() );
        this.rightPath.push( this.right.absolutePosition.clone() );
      }
    }
  }
  createPath() {
    if ( this.leftPath.length > 1 ) {
      this.addToScene();
    }
    this.camera.onViewMatrixChangedObservable.remove(this.observer);
    delete this.observer;
  }
  addToScene() {
    //var floorGroup = new BABYLON.TransformNode("floorGroup");
    //this.scene.addTransformNode( floorGroup );

    this.floorCount++;
    var floorMesh = BABYLON.MeshBuilder.CreateRibbon( "FloorRibbon"+this.floorCount, {pathArray: this.pathArray, updatable: true}, this.scene );
    floorMesh.material = this.floorMaterial;
    floorMesh.checkCollisions = false;
    this.floorMesh = floorMesh;
  }
  clear(){
    delete this.floorMesh;
    this.leftPath = [];
    this.rightPath = [];
    this.pathArray = [ this.leftPath, this.rightPath ];
    this.updateUI();
  }
  edit() {
    if ( ! this.floorMesh ) {
      return;
    }
    this.recordButton.isVisible = this.editing;
    this.jsonButton.isVisible = this.editing;
    this.jsButton.isVisible = this.editing;
    this.editing = !this.editing;
    if ( this.resizing ) {
      this.scene.onPointerObservable.remove( this.observer );
      this.resizing = false;
      delete this.observer;
      delete this.pathPoints;
      delete this.point1;
      delete this.point2;
      this.editButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Edit.png"; // FIXME: cdn
      if ( this.edgeMesh ) {
        this.edgeMesh.dispose();
        delete this.edgeMesh;
      }
    } else if ( this.editing ) {
      this.editButton.imageUrl = "//www.babylonjs-playground.com/textures/icons/Back.png"; // FIXME: cdn
      this.editButton.text = "Pick 1";
      this.resizing = true;
      this.observer = this.scene.onPointerObservable.add((pointerInfo) => {
        switch (pointerInfo.type) {
          case BABYLON.PointerEventTypes.POINTERDOWN:
            if(pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh == this.floorMesh) {
              if ( ! this.point1 ) {
                this.point1 = this.pickClosest(pointerInfo.pickInfo);
                this.editButton.text = "Pick 2";
              } else if ( ! this.point2 ) {
                this.point2 = this.pickClosest(pointerInfo.pickInfo);
                this.selectEdge();
                this.editButton.text = "Drag";
              } else {
                this.pickedPoint = this.pickClosest(pointerInfo.pickInfo);
                this.editButton.imageUrl = "/content/icons/tick.png";
                this.editButton.text = null;
              }
            }
            break;
          case BABYLON.PointerEventTypes.POINTERUP:
            delete this.pickedPoint;
            break;
          case BABYLON.PointerEventTypes.POINTERMOVE:
            if ( this.pickedPoint && pointerInfo.pickInfo.pickedMesh == this.floorMesh ) {
              this.resizeRibbon( pointerInfo.pickInfo.pickedPoint );
            }
            break;
          }
      });
    } else if ( this.observer ) {
      this.editButton.text = null;
      this.scene.onPointerObservable.remove( this.observer );
    }
  }
  pickClosest( pickInfo ) {
    var pickedIndex = 0;
    var pickedLeft = false;
    var path;
    var pathPoint;
    var min = 100000;
    for ( var i = 0; i < this.leftPath.length; i++ ) {
      var leftDistance = pickInfo.pickedPoint.subtract( this.leftPath[i] ).length();
      var rightDistance = pickInfo.pickedPoint.subtract( this.rightPath[i] ).length();
      if ( leftDistance < min ) {
        min = leftDistance;
        pickedLeft = true;
        pickedIndex = i;
        path = this.leftPath;
        pathPoint = this.leftPath[i];
      }
      if ( rightDistance < min ) {
        min = rightDistance;
        pickedLeft = false;
        pickedIndex = i;
        path = this.rightPath;
        pathPoint = this.rightPath[i];
      }
    }
    var ret = {
      index: pickedIndex,
      path: path,
      left: pickedLeft,
      pathPoint: pathPoint,
      point: pickInfo.pickedPoint.clone()
    };
    console.log("Picked left: "+pickedLeft+" index: "+pickedIndex+"/"+path.length+" distance: "+min);
    return ret;
  }
  selectEdge() {
    if ( this.point1.index > this.point2.index ) {
      var tmp = this.point2;
      this.point2 = this.point1;
      this.point1 = tmp;
    }
    var points = []
    for ( var i = this.point1.index; i <= this.point2.index; i++ ) {
      if ( this.point1.left ) {
        points.push( this.leftPath[i] );
      } else {
        points.push( this.rightPath[i] );
      }
    }
    this.pathPoints = points;
    if ( this.pathPoints.length > 1 ) {
      this.edgeMesh = BABYLON.MeshBuilder.CreateLines("FloorEdge", {points: points, updatable: true}, this.scene );
    } else {
      this.edgeMesh = BABYLON.MeshBuilder.CreateSphere("FloorEdge", {diameter:0.1}, this.scene);
      this.edgeMesh.position = this.pathPoints[0];
    }
  }
  resizeRibbon(point) {
    var diff = point.subtract(this.pickedPoint.point);
    for (var i = 0; i < this.pathPoints.length; i++ ) {
      this.pathPoints[i].addInPlace(diff);
    }
    this.pickedPoint.point = point.clone();
    // update the ribbon
    // seems buggy:
    //BABYLON.MeshBuilder.CreateRibbon( "FloorRibbon"+this.floorCount, {pathArray: this.pathArray, instance: this.floorMesh});
    var floorMesh = BABYLON.MeshBuilder.CreateRibbon( "FloorRibbon"+this.floorCount, {pathArray: this.pathArray, updatable: true}, this.scene );
    floorMesh.material = this.floorMaterial;
    floorMesh.checkCollisions = false;
    this.floorMesh.dispose();
    this.floorMesh = floorMesh;
    // update the edge
    if ( this.pathPoints.length > 1 ) {
      BABYLON.MeshBuilder.CreateLines("FloorEdge", {points: this.pathPoints, instance: this.edgeMesh} );
    }
  }
  saveJson() {
    var json = this.printJson();
    this.saveFile('FloorRibbon'+this.floorCount+'.json', json);
    this.clear();
  }
  saveJs() {
    var js = this.printJs();
    this.saveFile('FloorRibbon'+this.floorCount+'.js', js);
    this.clear();
  }
  printJson() {
    var ret = '{"pathArray":\n';
    ret += "[\n";
    ret += this.printPathJson(this.leftPath);
    ret += "\n],[\n";
    ret += this.printPathJson(this.rightPath);
    ret += "\n]}";
    console.log(ret);
    return ret;
  }
  printJs() {
    var ret = "BABYLON.MeshBuilder.CreateRibbon( 'FloorRibbon"+this.floorCount+"', {pathArray: \n";
    ret += "[[\n";
    ret += this.printPathJs(this.leftPath);
    ret += "\n],[\n";
    ret += this.printPathJs(this.rightPath);
    ret += "\n]]}, scene );";
    console.log(ret);
    return ret;
  }
  printPathJs(path) {
    var ret = "";
    for ( var i = 0; i < path.length-1; i++ ) {
      ret += "new BABYLON.Vector3("+path[i].x.toFixed(this.decimals)+","+path[i].y.toFixed(this.decimals)+","+path[i].z.toFixed(this.decimals)+"),";
    }
    ret += "new BABYLON.Vector3("+path[path.length-1].x.toFixed(this.decimals)+","+path[path.length-1].y.toFixed(this.decimals)+","+path[path.length-1].z.toFixed(this.decimals)+")";
    return ret;
  }
  printPathJson(path) {
    var ret = "";
    for ( var i = 0; i < path.length-1; i++ ) {
      ret += "["+path[i].x.toFixed(this.decimals)+","+path[i].y.toFixed(this.decimals)+","+path[i].z.toFixed(this.decimals)+"],";
    }
    ret += "["+path[path.length-1].x.toFixed(this.decimals)+","+path[path.length-1].y.toFixed(this.decimals)+","+path[path.length-1].z.toFixed(this.decimals)+"]";
    return ret;
  }
  saveFile(filename, content) {
    var a = document.createElement('a');
    var blob = new Blob([content], {'type':'application/octet-stream'});
    a.href = window.URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }
}

/** Menu consisting of vertical buttons in 3D space and associated labels.
 */
export class Buttons {
  /**
  @param scene
  @param title string displayed above the menu
  @param options array of options, string labels or objects
  @param callback executed when button is activated
  @param property optional, if options are object, this specifies string property to display as label
   */
  constructor(scene,title,options,callback,property) {
    this.scene = scene;
    this.title = title;
    this.options = options;
    this.callback = callback;
    this.property = property;
    this.buttonHeight = 1;
    this.color = "white";
    this.addBackground = false; // experimental
    this.group = new BABYLON.TransformNode("ButtonGroup:"+this.title, scene);
    this.groupWidth = 0;
    this.buttons = [];
    this.selectedOption = -1;
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.turOff = false;
    this.controls = [];
    this.textures = [];
    this.materials = [];
    this.display();
  }

  /** Dispose of everything */
  dispose() {
    delete this.selectedMaterial;
    delete this.unselectedMaterial;
    this.group.dispose();
    for ( var i = 0; i < this.controls.length; i++ ) {
      this.controls[i].dispose();
    }
    for ( var i = 0; i < this.textures.length; i++ ) {
      this.textures[i].dispose();
    }
    for ( var i = 0; i < this.materials.length; i++ ) {
      this.materials[i].dispose();
    }
    console.log("Disposed of buttons "+this.title);
  }

  /** Set the height, rescales the menu */
  setHeight(height) {
    var scale = height/this.options.length;
    this.group.scaling = new BABYLON.Vector3(scale, scale, scale);
  }

  /** Display the menu, adds a pointer observable */
  display() {
    var buttonHeight = 1;
    var spacing = 1.1;

    // CHECKME: better use emissive color?
    this.selectedMaterial = new BABYLON.StandardMaterial("selectedButtonMaterial", this.scene);
    this.selectedMaterial.diffuseColor = new BABYLON.Color3(0,0,0);
    this.selectedMaterial.emissiveColor = new BABYLON.Color3(.4,.8,.4);
    this.selectedMaterial.disableLighting = true;
    this.materials.push(this.selectedMaterial);
    this.unselectedMaterial = new BABYLON.StandardMaterial("unselectedButtonMaterial", this.scene);
    this.unselectedMaterial.diffuseColor = new BABYLON.Color3(0,0,0);
    this.unselectedMaterial.emissiveColor = new BABYLON.Color3(.2,.2,.2);
    this.unselectedMaterial.disableLighting = true;
    this.materials.push(this.unselectedMaterial);

    if ( this.title && this.title.length > 0 ) {
      var titleText = new BABYLON.GUI.TextBlock();
      titleText.text = this.title;
      titleText.textHorizontalAlignment = this.horizontalAlignment;
      titleText.textVerticalAlignment = this.verticalAlignment;
      titleText.color = this.color;

      var titlePlane = BABYLON.MeshBuilder.CreatePlane("Text"+this.title, {height:2,width:this.title.length*2}, this.scene);
      titlePlane.parent = this.group;
      titlePlane.position = new BABYLON.Vector3(this.title.length,spacing*2,0);

      var titleTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
        titlePlane,
        titleText.fontSizeInPixels * titleText.text.length,
        titleText.fontSizeInPixels,
        false // mouse events disabled
      );
      titleTexture.addControl(titleText);
      this.controls.push(titleText);
      this.textures.push(titleTexture);
      this.materials.push(titlePlane.material);
    }

    for ( var i = 0; i < this.options.length; i ++ ) {
      if ( this.property ) {
        var option = this.options[i][this.property];
      } else {
        var option = this.options[i];
      }
      this.groupWidth = Math.max( this.groupWidth, option.length);
      var buttonText = new BABYLON.GUI.TextBlock();
      buttonText.text = option;
      buttonText.textHorizontalAlignment = this.horizontalAlignment;
      buttonText.textVerticalAlignment = this.verticalAlignment;

      var buttonWidth = buttonText.text.length;
      var buttonPlane = BABYLON.MeshBuilder.CreatePlane("Text"+option, {height:1,width:buttonWidth}, this.scene);
      buttonPlane.position = new BABYLON.Vector3(buttonWidth/2+buttonHeight,-i*spacing,0);
      buttonText.color = this.color;
      buttonPlane.parent = this.group;

      var aTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
        buttonPlane,
        buttonText.fontSizeInPixels*buttonText.text.length, // CHECKME: this is about twice the size of the text
        buttonText.fontSizeInPixels+2, // CHECKME: padding or something?
        false // mouse events disabled
      );
      //aTexture.background="black";
      aTexture.addControl(buttonText);
      this.controls.push(buttonText);
      this.textures.push(aTexture);
      // buttonPlane.material.needDepthPrePass = true; // trying to get proper transparency
      buttonPlane.material.alphaMode = 5; // ALPHA_MAXIMIZED
      this.materials.push(buttonPlane.material);

      var button = BABYLON.MeshBuilder.CreateCylinder("Button"+option, {height:.1, diameter:buttonHeight*.8}, this.scene);
      button.material = this.unselectedMaterial;
      button.rotation = new BABYLON.Vector3(Math.PI/2, 0, 0);
      button.position = new BABYLON.Vector3(buttonHeight/2, -i*spacing, 0);
      button.parent = this.group;
      this.buttons.push(button);
    }

    this.scene.onPointerObservable.add( (e) => {
      if(e.type == BABYLON.PointerEventTypes.POINTERDOWN){
        var p = e.pickInfo;
        for ( var i = 0; i < this.options.length; i++ ) {
          if ( p.pickedMesh == this.buttons[i] ) {
            // CHECKME we may want to handle double click somehow
            if ( i != this.selectedOption || this.turnOff) {
              this.select(i);
            }
            break;
          }
        }
      }
    });

    // paints background plane, can't be semi-transparent though
    if ( this.addBackground ) {
      console.log("Group width: "+this.groupWidth);
      var backgroundWidth = this.groupWidth/1.8;
      var backgroundHeight = this.options.length*spacing;
      var backgroundOffset = buttonHeight*.8; // same as button cylinder diameter
      var backPlane = BABYLON.MeshBuilder.CreatePlane("ButtonBackground:"+this.title, {height:backgroundHeight,width:backgroundWidth}, this.scene);
      backPlane.position = new BABYLON.Vector3(backgroundWidth/2+backgroundOffset,-backgroundHeight/2+spacing/2,.2);
      backPlane.parent = this.group;
      var backgroundMaterial = new BABYLON.StandardMaterial("unselectedButtonMaterial", this.scene);
      backgroundMaterial.disableLighting = true;
      //backgroundMaterial.alpha = 0.5; // produces weird transparency effects
      this.materials.push(backgroundMaterial);
      backPlane.material = backgroundMaterial;
    }
  }
  
  /** Select an option, executed when a button is pressed.
  Executes the callback passing selected option as parameter.
   */
  select(i) {
    console.log("Selected: "+this.options[i].name);
    if ( this.callback ) {
      this.callback(this.options[i]);
    }
    this.buttons[i].material = this.selectedMaterial;
    if ( this.selectedOption > -1 ) {
      this.buttons[this.selectedOption].material = this.unselectedMaterial;
    }
    if ( i != this.selectedOption ) {
      this.selectedOption = i;
    } else {
      this.selectedOption = -1;
    }
  }
  
  // CHECKME: not used so far
  hide() {
    this.group.isEnabled = false;
  }

  show() {
    this.group.isEnabled = true;
  }
}

/** 
Wrapper around BabylonJS XR/VR classes, whatever is available in current browser, if any.
Attached to a World, uses World floor meshes and camera.
 */
export class VRHelper {
  /**
  @param world attaches the control to the World
   */
  async initXR(world) {
    this.world = world;
    var xrHelper = this.vrHelper;
    if ( this.vrHelper ) {
      console.log("VR helper already intialized");
      this.addFloors();
    } else {
      try {
        xrHelper = await this.world.scene.createDefaultXRExperienceAsync({floorMeshes: this.world.getFloorMeshes()});        
      } catch ( err ) {
        console.log("Can't init XR:"+err);
      }
    }

    if (xrHelper && xrHelper.baseExperience) {
      console.log("Using XR helper");
      this.vrHelper = xrHelper;

      // updating terrain after teleport
      if ( this.movementObserver ) {
        // remove existing teleportation observer
        xrHelper.baseExperience.sessionManager.onXRReferenceSpaceChanged.remove( this.movementObserver );
      }
      this.movementObserver = () => { this.afterTeleportation() };
      xrHelper.baseExperience.sessionManager.onXRReferenceSpaceChanged.add( this.movementObserver );

      if ( !this.initialPoseObserver ) {
        this.initialPoseObserver = (xrCamera) => {
          // TODO restore this after exit VR
          xrCamera.position.y = this.world.camera.position.y - this.world.camera.ellipsoid.y*2;
        };
        xrHelper.baseExperience.onInitialXRPoseSetObservable.add( this.initialPoseObserver ); 
      }

      if ( this.tracker ) {
        this.stopTracking();
      }
      this.tracker = () => this.trackXrDevices();
      
      if ( !this.stateChangeObserver ) {
        this.stateChangeObserver = (state) => {
          console.log( "State: "+state );
          switch (state) {
            case BABYLON.WebXRState.IN_XR:
              // XR is initialized and already submitted one frame
              console.log( "Entered VR" );
              this.userHeight = this.camera().realWorldHeight;
              this.startTracking();
              // Workaround for teleporation/selection bug
              xrHelper.teleportation.setSelectionFeature(null);
              this.world.inXR = true;
              break;
            case BABYLON.WebXRState.ENTERING_XR:
              // xr is being initialized, enter XR request was made
              console.log( "Entering VR" );
              this.world.collisions(false);
              break;
            case BABYLON.WebXRState.EXITING_XR:
              console.log( "Exiting VR" );
              this.stopTracking();
              this.world.camera.position = this.camera().position.clone();
              this.world.camera.rotation = this.camera().rotation.clone();
              // doesn't do anything
              //camera.position.y = xrHelper.baseExperience.camera.position.y + 3; //camera.ellipsoid.y*2;
              this.world.collisions(this.world.collisionsEnabled);
              this.world.inXR = false;
              break;
            case BABYLON.WebXRState.NOT_IN_XR:
              console.log( "Not in VR" );
              this.world.attachControl();
              this.world.scene.activeCamera = this.world.camera;
              // self explanatory - either out or not yet in XR
              break;
          }
        };
        xrHelper.baseExperience.onStateChangedObservable.add(this.stateChangeObserver);
      }

      // CHECKME: really ugly way to make it work
      this.world.scene.pointerMovePredicate = (mesh) => {
        return this.world.isSelectableMesh(mesh);
      };
      xrHelper.pointerSelection.raySelectionPredicate = (mesh) => {
        return this.world.isSelectableMesh(mesh);
      };

      xrHelper.teleportation.rotationEnabled = false; // CHECKME
      //xrHelper.teleportation.parabolicRayEnabled = false; // CHECKME

      if ( !this.controllerObserver ) {
        this.controllerObserver = (xrController) => {
          console.log("Controller added: "+xrController.grip.name+" "+xrController.grip.name);
          console.log(xrController);
          if ( xrController.grip.id.toLowerCase().indexOf("left") >= 0 || xrController.grip.name.toLowerCase().indexOf("left") >=0 ) {
            this.leftController = xrController;
          } else if (xrController.grip.id.toLowerCase().indexOf("right") >= 0 || xrController.grip.name.toLowerCase().indexOf("right") >= 0) {
            this.rightController = xrController;
          } else {
            log("ERROR: don't know how to handle controller");
          }
        };
        xrHelper.input.onControllerAddedObservable.add(this.controllerObserver);
      }
      
      
    } else {
      // obsolete and unsupported TODO REMOVEME
      this.vrHelper = this.world.scene.createDefaultVRExperience({createDeviceOrientationCamera: false });
      //vrHelper.enableInteractions();
      this.vrHelper.webVRCamera.ellipsoid = new BABYLON.Vector3(.5, 1.8, .5);
      this.vrHelper.onEnteringVRObservable.add(()=>{this.world.collisions(false)});
      this.vrHelper.onExitingVRObservable.add(()=>{this.world.collisions(this.world.collisionsEnabled);});

      this.vrHelper.enableTeleportation({floorMeshes: this.world.getFloorMeshes(this.world.scene)});
      this.vrHelper.raySelectionPredicate = (mesh) => {
        return this.world.isSelectableMesh(mesh);
      };
      
      this.vrHelper.onBeforeCameraTeleport.add((targetPosition) => {
        this.world.camera.globalPosition.x = targetPosition.x;
        this.world.camera.globalPosition.y = targetPosition.y;
        this.world.camera.globalPosition.z = targetPosition.z;
        if ( this.world.terrain ) {
          this.world.terrain.update(true);
        }
      });
      
    }
    
    console.log("VRHelper initialized", this.vrHelper);
  }
  
  afterTeleportation() {
    var targetPosition = this.vrHelper.baseExperience.camera.position;
    this.world.camera.globalPosition.x = targetPosition.x;
    this.world.camera.globalPosition.y = targetPosition.y;
    this.world.camera.globalPosition.z = targetPosition.z;
    if ( this.world.terrain ) {
      this.world.terrain.update(false);
    }
    // TODO we can modify camera y here, adding terrain height on top of ground height
  }
  trackXrDevices() {
    // user height has to be tracked here due to
    //XRFrame access outside the callback that produced it is invalid
    this.userHeight = this.camera().realWorldHeight;
    this.world.trackXrDevices();
  }
  startTracking() {
    this.world.scene.registerBeforeRender(this.tracker);
  }
  stopTracking() {
    this.world.scene.unregisterBeforeRender(this.tracker);
  }
  leftArmPos() {
    return this.leftController.grip.absolutePosition;
  }
  rightArmPos() {
    return this.rightController.grip.absolutePosition;
  }
  leftArmRot() {
    return this.leftController.pointer.rotationQuaternion;
  }
  rightArmRot() {
    return this.rightController.pointer.rotationQuaternion;
  }
  realWorldHeight() {
    return this.userHeight;
  }
  camera() {
    return this.vrHelper.input.xrCamera;
  }
  addFloorMesh(mesh) {
    if ( this.vrHelper && this.vrHelper.teleportation && mesh) {
      // do not add a floor twice
      this.vrHelper.teleportation.removeFloorMesh(mesh);
      this.vrHelper.teleportation.addFloorMesh(mesh);
    }
  }
  removeFloorMesh(mesh) {
    if ( this.vrHelper && this.vrHelper.teleportation) {
      this.vrHelper.teleportation.removeFloorMesh(mesh);
    }
  }
  raySelectionPredicate(predicate) {
    var ret = this.vrHelper.pointerSelection.raySelectionPredicate;
    if ( predicate ) {
      this.vrHelper.pointerSelection.raySelectionPredicate = predicate;
    }
    return ret;
  }
  clearFloors() {
    for ( var i = 0; i < this.world.getFloorMeshes().length; i++ ) {
      this.removeFloorMesh(this.world.getFloorMeshes()[i]);
    }
  }
  addFloors() {
    for ( var i = 0; i < this.world.getFloorMeshes().length; i++ ) {
      this.addFloorMesh(this.world.getFloorMeshes()[i]);
    }
  }
}

/**
Basic world, intended to be overridden.
Provides function placeholders for implementations, and safe implementation of basic functions, 
like loading of world file(s) and XR support.
There is no constructor, so subclasses are free to add any world specifics to their own constructors.
A world can also define defaults in the constructor, like baseUrl or file.
@abstract
 */
export class World {
  constructor() {
    this.VRSPACEUI = VRSPACEUI;
  }
  /** Create, load and and show the world.
  Enables gravity and collisions, then executes createScene method, optionally creates load indicator,
  registers render loop, crates terrain, and finally, executes load method. Every method executed can be overridden.
  @param engine babylonjs engine
  @param name world name
  @param scene babylonjs scene, optional
  @param callback to execute after the world has loaded
  @param baseUrl folder to load scene from, default "", used only if not defined in constructor
  @param file scene file to load, default scene.gltf, used only if not defined in constructor
  @returns final scene
  */
  async init(engine, name, scene, callback, baseUrl, file) {
    this.canvas = engine.getInputElement();
    this.engine = engine;
    this.name = name;
    this.scene = scene;
    this.vrHelper = null;
    if ( !this.file ) {
      if ( file ) {
        this.file = file;
      } else {
        this.file = "scene.gltf";
      }
    }
    if ( !this.baseUrl ){
      if ( baseUrl ) {
        this.baseUrl = baseUrl;
      } else {
        this.baseUrl = "";
      }
    }
    this.gravityEnabled = true;
    this.collisionsEnabled = true;
    await this.createScene(engine);
    if ( ! this.onProgress ) {
      this.indicator = VRSPACEUI.loadProgressIndicator(this.scene, this.camera);
      this.onProgress = (evt, name) => this.indicator.progress( evt, name )
    }
    this.registerRenderLoop();
    this.createTerrain();
    this.load(callback);
    return this.scene;
  }
  /**
  Called from init.
  If the scene does not exist, creates the scene first.
  Then calls methods in this order: 
  createCamera, attachControl, createLights, createShadows, createSkybox, createGround, createEffects, createPhysics.
  */
  async createScene(engine) {
    if ( ! this.scene ) {
      this.scene = new BABYLON.Scene(engine);
    }
    // TODO dispose of old camera(s)
    var camera = await this.createCamera();
    if ( camera ) {
      this.camera = camera;
    }
    this.attachControl();
    // TODO dispose of old lights
    var light = await this.createLights();
    if ( light ) {
      this.light = light;
    }
    // TODO dispose of old shadow generator
    var shadowGenerator = await this.createShadows();
    if ( shadowGenerator ) {
      this.shadowGenerator = shadowGenerator;
    }
    // TODO dispose of old skybox
    var skyBox = await this.createSkyBox();
    if ( skyBox ) {
      this.skyBox = skyBox;
    }
    // TODO dispose of old ground
    var ground = await this.createGround();
    if ( ground ) {
      this.ground = ground;
    }
    await this.createEffects();
    await this.createPhysics();
  }
  /** An implementation must override this method and define at least one camera */
  async createCamera() {
    alert( 'Please override createCamera() method')
  }
  /** Optional, empty implementation, called from createScene. May return a Light */
  async createLights() {}
  /** Optional, empty implementation, called from createScene. Should return a ShadowGenerator. */
  async createShadows() {}
  /** Optional, empty implementation, called from createScene. Should return a sky Box. */
  async createSkyBox() {}
  /** Optional, empty implementation, called from createScene. Should return a mesh. */
  async createGround() {}
  /** Optional, empty implementation, called from createScene */
  async createEffects() {};
  /** Optional, empty implementation, called from createScene */
  async createPhysics() {};
  /** Optional, empty implementation, called from createScene */
  async createTerrain() {}
  /** Attach the control to the camera, called from createScene. */
  attachControl() {
    this.camera.attachControl(this.canvas, true);
  }
  /**
  Optional, empty implementation, notification that the user has entered a multiuser world.
   */
  async entered(welcome) {
  }
  /**  */
  /**
  Utility method, creates a UniversalCamera and sets defaults: gravity, collisions, ellipsoid, keys.
  @param pos Vector3 to position camera at
  @param name optional camera name, default UniversalCamera
   */
  universalCamera(pos, name) {
    if ( !name ) {
      name = "UniversalCamera";
    } 
    var camera = new BABYLON.UniversalCamera(name, pos, this.scene);
    camera.maxZ = 100000;
    camera.minZ = 0;
    camera.applyGravity = true;
    camera.speed = 0.2;
    // 1.8 m high:
    camera.ellipsoid = new BABYLON.Vector3(.5, .9, .5);
    // eyes at 1.6 m:
    camera.ellipsoidOffset = new BABYLON.Vector3(0, .2, 0);
    camera.checkCollisions = true;
    
    camera.keysDown = [40, 83]; // down, S
    camera.keysLeft = [37, 65]; // left, A
    camera.keysRight = [39, 68]; // right, D
    camera.keysUp = [38, 87]; // up, W
    camera.keysUpward = [36, 33, 32]; // home, pgup, space
    
    camera.touchAngularSensitivity = 5000;
    
    return camera;    
  }
  
  /**
  Disposes of all objects returned by createLights, createCamera, createShadows, createSkybox
   */
  async dispose() {
    if ( this.camera ) {
      this.camera.dispose();
      this.camera = null;    
    }
    if ( this.skyBox ) {
      this.skyBox.dispose();
      this.skyBox.material.dispose();
      this.skyBox = null;    
    }
    if ( this.light ) {
      this.light.dispose();
      this.light = null;
    }
    if ( this.shadowGenerator ) {
      this.shadowGenerator.dispose();
      this.shadowGenerator = null;    
    }
  }

  /** Creates a VRHelper if needed, and initializes it with the current world.
  Normally called after world is loaded.
  @param vrHelper optional existing vrHelper
   */
  initXR(vrHelper) {
    if ( vrHelper ) {
      this.vrHelper = vrHelper;
    }
    if ( ! this.vrHelper ) {
      this.vrHelper = new VRHelper();
    }
    this.vrHelper.initXR(this);
  }
  trackXrDevices() {
  }
  
  /**
  Used in mesh selection predicate. Default implementation returns true for members of this.floorMeshes.
   */
  isSelectableMesh(mesh) {
    return this.floorMeshes && this.floorMeshes.includes(mesh);
  }

  /**
  Returns this.floorMeshes or this.ground if exist, or empty array.
   */
  getFloorMeshes() {
    if ( this.floorMeshes ) {
      return this.floorMeshes;      
    } else if ( this.ground ) {
      return [ this.ground ];
    }
    return [];
  }
  
  /**
  Enables or disables collisions in the world. This includes floorMeshes, sceneMeshes, and also applying gravity to camera.
  @param state true or false
   */
  collisions(state) {
    this._collisions( this.floorMeshes, this.collisionsEnabled && state );
    this._collisions( this.sceneMeshes, this.collisionsEnabled && state );
    this.camera.applyGravity = this.gravityEnabled && state;
    this.camera._needMoveForGravity = this.gravityEnabled && state;
  }
  
  /**
  Utility method, enables or disables collisions on the given set of meshes.
  @param meshes array of meshes
  @param state true or false
   */
  _collisions( meshes, state ) {
    if ( meshes ) {
      for ( var i=0; i<meshes.length; i++ ) {
        this.setMeshCollisions( meshes[i], state );
      }
    }
  }
  
  /**
  Enable or disable collisions for a mesh. Override to fine-tune collisions.
  @param mesh
  @param state
   */
  setMeshCollisions(mesh, state) {
    mesh.checkCollisions = state;    
  }
  
  /**
  Called on loading progress, executes whatever this.onProgress contains, by default LoadProgressListener.
  @param evt
  @param name
   */
  loadProgress( evt, name ) {
    if ( this.onProgress ) {
      this.onProgress( evt, name );
    }
  }
  /**
  Called when loading starts. Calls this.indicator.add if available.
  @param name
   */
  loadingStart(name) {
    if ( this.indicator ) {
      this.indicator.add(name);
    }
  }
  /**
  Called when loading finishes. Calls this.indicator.remove if available.
  @param name
   */
  loadingStop(name) {
    if ( this.indicator ) {
      this.indicator.remove(name);
    }
  }
  
  /** Load the world, then execute given callback passing self as argument.
  Loads an AssetContainer, and adds it to the scene. Takes care of loading progress.
  Calls loadingStart, loaded, loadingStop, collisions, optimizeScene - each may be overridden.
  @param callback to execute after the content has loaded
   */
  load(callback) {
    this.loadingStart(this.name);

    BABYLON.SceneLoader.LoadAssetContainer(this.baseUrl,
      this.file,
      this.scene,
      // onSuccess:
      (container) => {
        this.sceneMeshes = container.meshes;
        this.container = container;

        // Adds all elements to the scene
        var mesh = container.createRootMesh();
        mesh.name = this.name;
        container.addAllToScene();
      
        this.loaded( this.file, mesh );
        
        // do something with the scene
        VRSPACEUI.log("World loaded");
        this.loadingStop(this.name);
        //floor = new FloorRibbon(this.scene);
        //floor.showUI();
        this.collisions(this.collisionsEnabled);
        // FIXME throws too much exceptions
        //this.optimizeScene();
        if ( callback ) {
          callback(this);
        }
      },
      // onProgress:
      (evt) => { this.loadProgress(evt, name) }
    );
    
    return this;
  }
  
  /**
  Called after assets are loaded. By default calls initXR().
  Subclasses typically override this with some spatial manipulations, e.g. scaling the world.
  Subclasses may, but are not required, call super.loaded()
  @param file world file that has loaded
  @param mesh root mesh of the world
   */
  loaded( file, mesh ) {
    this.initXR();
  }
  
  /**  Optimize the scene */
  optimizeScene() {
    VRSPACEUI.optimizeScene(this.scene);    
  }
  
  /** Register render loop. */
  registerRenderLoop() {
    // Register a render loop to repeatedly render the scene
    var loop = () => {
      if ( this.scene ) {
        this.scene.render();
      } else {
        this.engine.stopRenderLoop(loop);
      }
    }
    this.engine.runRenderLoop(loop);
  }

  /**
  Utility method to fix the path and load the file, executes LoadAssetContainerAsync.
  @param relativePath path relative to current world directory
  @param file file name to load
  @param scene
   */
  async loadAsset(relativePath, file, scene) {
    return BABYLON.SceneLoader.LoadAssetContainerAsync(this.assetPath(relativePath), file, scene);
  }
  
  /**
  Utility method, returns baseUrl+relativePath
  @param relativePath path relative to current world directory
   */
  assetPath(relativePath) {
    return this.baseUrl+relativePath;
  }
  
}

/**
Manages world events: tracks local user events and sends them to the server, 
and tracks network events and applies them to local scene.
Loads avatars of other users and maps network events to their avatars, 
including user video and audio streams.
 */
export class WorldManager {
  /** Creates world manager with default values and connection, scene, camera listeners.
  @param world
  @param fps network framerate, default 5 (send up to 5 events per second)
   */
  constructor(world, fps) {
    /** the world */
    this.world = world;
    /** the scene */
    this.scene = world.scene;
    /** Movement resolution, default 1 cm/3.6 deg. Any movement less than this will be ignored.*/
    this.resolution = 0.01; // 1 cm/3.6 deg
    /** Create animations for movement of avatars, default true. Recommended for low fps.*/
    this.createAnimations = true;
    /** Custom avatar options, applied to avatars after loading. Currently video avatars only */
    this.customOptions = null;
    /** Whether to track user rotation, default true. */
    this.trackRotation = true;
    /** Used in 3rd person view */
    this.mesh = null;
    /** This is set once we connect to streaming server */
    this.mediaStreams = null;
    /** Optionally called after own avatar property has changed */
    this.changeCallback = null;
    /** Change listeners receive changes applied to all shared objects */
    this.changeListeners = [];
    /** Optionally called after an avatar has loaded. Callback is passed VRObject and avatar object as parameters.
    Avatar object can be either Avatar or VideoAvatar instance, or an AssetContainer.
    */
    this.loadCallback = null;
    /** Avatar factory, default this.createAvatar */
    this.avatarFactory = this.createAvatar;
    /** Default position applied after an avatar loads */
    this.defaultPosition = new BABYLON.Vector3( 1000, 1000, 1000 );
    /** Default rotation applied after an avatar loads */
    this.defaultRotation = new BABYLON.Vector3( 0, 0, 0 );
    if ( ! this.scene.activeCamera ) {
      console.log("Undefined camera in WorldManager, tracking disabled")
    } else {
      this.trackCamera();
    }
    this.scene.onActiveCameraChanged.add( () => { this.trackCamera() } );
    this.VRSPACE = VRSPACE;
    /** Network frames per second, default 5 */
    this.fps = 5;
    if ( fps ) {
      this.fps = fps
    }
    /** Current position */
    this.pos = { x: null, y: null, z: null };
    /** Current rotation */
    this.rot = { x: null, y: null, z: null };
    /** Current left arm position */
    this.leftArmPos = { x: null, y: null, z: null };
    /** Current right arm position */
    this.rightArmPos = { x: null, y: null, z: null };
    /** Current left arm rotation */
    this.leftArmRot = { x: null, y: null, z: null, w: null };
    /** Current right arm rotation */
    this.rightArmRot = { x: null, y: null, z: null, w: null };
    /** User height in real world, default 1.8 */
    this.userHeight = 1.8;
    this.interval = null;
    VRSPACE.addWelcomeListener((welcome) => this.setSessionStatus(true));
    VRSPACE.addSceneListener((e) => this.sceneChanged(e));
    /** Enable debug output */
    this.debug = false;
    this.world.worldManager = this;
  }

  /** Publish and subscribe */
  pubSub( client, autoPublishVideo ) {
    this.log("Subscribing as client "+client.id+" with token "+client.token);
    if ( client.token && this.mediaStreams ) {
      // obtain token and start pub/sub voices
      if ( autoPublishVideo ) {
        this.mediaStreams.startVideo = true;
        this.mediaStreams.videoSource = undefined;
      }
      this.mediaStreams.connect(client.token).then(() => this.mediaStreams.publish());
    }
  }

  /** Optionally log something */
  log( what ) {
    if (this.debug) {
      console.log(what);
    }
  }
  
  /** Track a mesh, used in 3rd person view */
  trackMesh(mesh) {
    if ( mesh ) {
      this.log("Tracking mesh "+mesh.id);
    } else if ( this.mesh ) {
      this.log("Stopped tracking mesh "+this.mesh.id);
    }
    this.mesh = mesh;
  }
  
  /** Tracks active camera */
  trackCamera(camera) {
    if ( ! camera ) {
      camera = this.scene.activeCamera;
    }
    if ( camera ) {
      this.log("Tracking camera "+camera.getClassName())
      this.camera = camera;
    }
  }
  
  /** Called when connection to the server is established (connection listener)*/
  setSessionStatus(active) {
    this.log("Session status: "+active);
    if ( active ) {
      if ( ! this.interval ) {
        this.interval = setInterval(() => this.trackChanges(), 1000/this.fps);        
      }
    } else if ( this.interval ) {
      clearInterval( this.interval );
      this.interval = null;
    }
  }
  
  /** Returns true if connected to the server and session is active*/
  isOnline() {
    return this.interval != null;
  }

  /** Callend when scene has changed (scene listener). 
  If an object was added, calls either loadAvatar, loadStream or loadMesh, as appropriate.
  If an object was removed, calls removeMesh.
  @param e SceneEvent containing the change
  */
  sceneChanged(e) {
    if (e.added != null) {
      this.log("ADDED " + e.objectId + " new size " + e.scene.size);
      this.log(e);
      // FIXME: need better way to determine avatar type
      if ( e.added.hasAvatar && e.added.hasAvatar()) {
        this.loadAvatar( e.added );
      } else if ("video" === e.added.mesh) {
        this.loadStream( e.added );
      } else if (e.added.mesh) {
        this.loadMesh(e.added);
      } else {
        // TODO server needs to ensure that mesh exists
        // in the meantime we define default behavior here
        console.log("WARNING: can't load "+e.objectId+" - no mesh")
      }
    } else if (e.removed != null) {
      this.log("REMOVED " + e.objectId + " new size " + e.scene.size)
      this.removeMesh( e.removed );
    } else {
      this.log("ERROR: invalid scene event");
    }
  }

  /** Default video avatar factory method */
  createAvatar(obj) {
    return new VideoAvatar(this.scene, null, this.customOptions);
  }
  
  /**
  Load a video avatar, attach a listener to it.
   */
  loadStream( obj ) {
    this.log("loading stream for "+obj.id);
    
    var video = this.avatarFactory(obj);
    video.autoStart = false;
    video.autoAttach = false;
    if ( obj.name ) {
      video.altText = obj.name;    
    } else {
      video.altText = "u"+obj.id;
    }
    video.show();
    video.mesh.name = obj.mesh;
    // obfuscators get in the way 
    //video.mesh.id = obj.constructor.name+" "+obj.id;
    video.mesh.id = obj.className+" "+obj.id;
    obj.video = video;
    
    var parent = new BABYLON.TransformNode("Root of "+video.mesh.id, this.scene);
    video.mesh.parent = parent;
    parent.VRObject = obj;
          
    this.log("Added stream "+obj.id);
    
    if ( obj.position.x == 0 && obj.position.y == 0 && obj.position.z == 0) {
      // avatar position has not yet been initialized, use default
      parent.position = new BABYLON.Vector3(this.defaultPosition.x,this.defaultPosition.y,this.defaultPosition.z); 
      obj.position = this.defaultPosition;
      var initialPosition = { position: {} };
      this.changeObject( obj, initialPosition, parent );
    } else {
      // apply known position
      parent.position = new BABYLON.Vector3(obj.position.x, obj.position.y, obj.position.z)
    }
    
    if ( obj.rotation ) {
      if ( obj.rotation.x == 0 && obj.rotation.y == 0 && obj.rotation.z == 0) {
        // avatar rotation has not yet been initialized, use default
        parent.rotation = new BABYLON.Vector3(this.defaultRotation.x,this.defaultRotation.y,this.defaultRotation.z); 
        obj.rotation = this.defaultRotation;
        var initialRotation = { rotation: {} };
        this.changeObject( obj, initialRotation, parent );
      } else {
        // apply known rotation
        parent.rotation = new BABYLON.Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z)
      }
    }
    
    obj.addListener((obj, changes) => this.changeObject(obj, changes, parent));
    if ( this.mediaStreams ) {
      this.mediaStreams.streamToMesh(obj, video.mesh);
    } else {
      console.log("WARNING: unable to stream to "+obj.id+" - no MediaStreams")
    }
    this.notifyLoadListeners(obj,video);
  }
  
  /** Load a 3D avatar, attach a listener to it */
  loadAvatar(obj) {
    this.log("loading avatar "+obj.mesh);
    var pos = obj.mesh.lastIndexOf('/');
    var path = obj.mesh.substring(0,pos);
    var file = obj.mesh.substring(pos+1);
    // FIXME really bad way to parse path and create ServerFolder
    pos = path.lastIndexOf('/');
    var baseUrl = path.substring(0,pos+1);
    var dir = path.substring(pos+1);
    var fix = null; //TODO find if fix file exist
    var dir = new ServerFolder( baseUrl, dir, fix );
    var avatar = new Avatar(this.scene, dir);
    avatar.fps = this.fps;
    avatar.userHeight = obj.userHeight;
    avatar.animateArms = this.createAnimations;
    avatar.debug = true;
    avatar.load( (avatar) => {
      // FIXME: this is not container but avatar
      obj.container = avatar;
      avatar.VRObject = obj;
      // GLTF characters are facing the user when loaded, turn it around
      // CHECKME do it somewhere in Avatar class
      avatar.rootMesh.rotationQuaternion = avatar.rootMesh.rotationQuaternion.multiply(BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,Math.PI));
      // apply current name, position and rotation
      this.changeAvatar(obj, { name: obj.name, position: obj.position });
      if ( obj.rotation ) {
        // FIXME rotation can be null sometimes (offline users?)
        this.changeAvatar(obj, { rotation: obj.rotation });
      }
      // TODO also apply other properties here (name?)
      // add listener to process changes
      obj.addListener((obj, changes) => this.changeAvatar(obj, changes));
      // subscribe to media stream here if available
      if ( this.mediaStreams ) {
        this.mediaStreams.streamToMesh(obj, obj.container.parentMesh);        
      }
      this.notifyLoadListeners(obj, avatar);
    });
  }
  
  notifyLoadListeners(obj, avatar) {
    if ( this.loadCallback ) {
      this.loadCallback(obj, avatar);
    }
  }
  
  /** Apply remote changes to an avatar (VRObject listener) */
  changeAvatar(obj,changes) {
    this.log( 'Processing changes on avatar' );
    this.log(changes);
    var avatar = obj.container;
    for ( var field in changes ) {
      var node = avatar.parentMesh;
      // TODO introduce event handler functions
      if ( 'position' === field ) {
        if ( ! obj.translate ) {
          obj.translate = VRSPACEUI.createAnimation(node, "position", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.translate, node.position, obj.position);
      } else if ( 'rotation' === field ) {
        if ( ! obj.rotate ) {
          obj.rotate = VRSPACEUI.createQuaternionAnimation(node, "rotationQuaternion", this.fps);
        }
        VRSPACEUI.updateQuaternionAnimation(obj.rotate, node.rotationQuaternion, obj.rotation);
      } else if ( 'leftArmPos' === field ) {
        var pos = new BABYLON.Vector3(obj.leftArmPos.x, obj.leftArmPos.y, obj.leftArmPos.z);
        avatar.reachFor(avatar.body.rightArm, pos);
      } else if ( 'rightArmPos' === field ) {
        var pos = new BABYLON.Vector3(obj.rightArmPos.x, obj.rightArmPos.y, obj.rightArmPos.z);
        avatar.reachFor(avatar.body.leftArm, pos);
      } else if ( 'leftArmRot' === field ) {
        avatar.body.leftArm.pointerQuat = new BABYLON.Quaternion(obj.rightArmRot.x, obj.rightArmRot.y, obj.rightArmRot.z, obj.rightArmRot.w)
      } else if ( 'rightArmRot' === field ) {
        avatar.body.rightArm.pointerQuat = new BABYLON.Quaternion(obj.leftArmRot.x, obj.leftArmRot.y, obj.leftArmRot.z, obj.leftArmRot.w)
      } else if ( 'name' === field ) {
        avatar.setName(obj.name);
      } else if ( 'userHeight' === field ) {
        avatar.trackHeight(obj.userHeight);
      } else {
        this.routeEvent(obj,field,node);
      }
      this.notifyListeners( obj, field, node);
    }
  }

  notifyListeners(obj, field, node) {
    this.changeListeners.forEach( (l) => l(obj,field,node) );
  }
  
  /**
  Load an object and attach a listener.
   */
  loadMesh(obj) {
    this.log("Loading object "+obj.mesh);
    if ( ! obj.mesh ) {
      console.log("Null mesh of client "+obj.id);
      return;
    }
    var pos = obj.mesh.lastIndexOf('/');
    var path = obj.mesh.substring(0,pos+1);
    var file = obj.mesh.substring(pos+1);
    BABYLON.SceneLoader.LoadAssetContainerAsync(path, file, this.scene).then((container) => {
      this.log("loaded "+obj.mesh);
      var bbox = this.boundingBox(container);
      
      // Adds all elements to the scene
      var mesh = container.createRootMesh();
      mesh.VRObject = obj;
      mesh.name = obj.mesh;
      // obfuscator gets in the way 
      //mesh.id = obj.constructor.name+" "+obj.id;
      mesh.id = obj.className+" "+obj.id;
      
      container.addAllToScene();

      obj.container = container;
      
      this.log("Added "+obj.mesh);
      
      var initialPosition = { position: {} };
      this.changeObject( obj, initialPosition );

      // add listener to process changes
      obj.addListener((obj, changes) => this.changeObject(obj, changes));
      // subscribe to media stream here if available
      if ( this.mediaStreams ) {
        this.mediaStreams.streamToMesh(obj, mesh);        
      }
      this.notifyLoadListeners(obj, container);
    });
  }

  /**
  Utility method, calculates bounding box for an AssetContainer.
  @returns Vector3 bounding box
   */
  boundingBox(container) {
    var maxSize = new BABYLON.Vector3(0,0,0);
    for ( var i = 0; i < container.meshes.length; i++ ) {
      // have to recompute after scaling
      //container.meshes[i].computeWorldMatrix(true);
      container.meshes[i].refreshBoundingInfo();
      var boundingInfo = container.meshes[i].getBoundingInfo().boundingBox;
      console.log("max: "+boundingInfo.maximumWorld+" min: "+boundingInfo.minimumWorld);
      var size = new BABYLON.Vector3(
        boundingInfo.maximumWorld.x - boundingInfo.minimumWorld.x,
        boundingInfo.maximumWorld.y - boundingInfo.minimumWorld.y,
        boundingInfo.maximumWorld.z - boundingInfo.minimumWorld.z
        );
      maxSize.x = Math.max(maxSize.x,size.x);
      maxSize.y = Math.max(maxSize.y,size.y);
      maxSize.z = Math.max(maxSize.z,size.z);
      //if (shadows) {
        //shadowGenerator.getShadowMap().renderList.push(container.meshes[i]);
      //}
    }
    console.log("BBoxMax: "+maxSize);
    return maxSize;
  }
  
  /** Apply remote changes to an object. */
  changeObject(obj,changes, node) {
    this.log("Changes on "+obj.id+": "+JSON.stringify(changes));
    if ( ! node ) {
      node = obj.container.meshes[0];      
    }
    for ( var field in changes ) {
      if ( 'position' === field ) {
        if ( ! obj.translate ) {
          obj.translate = VRSPACEUI.createAnimation(node, "position", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.translate, node.position, obj.position);
      } else if ( 'rotation' === field ) {
        if ( ! obj.rotate ) {
          obj.rotate = VRSPACEUI.createAnimation(node, "rotation", this.fps);
        }
        VRSPACEUI.updateAnimation(obj.rotate, node.rotation, obj.rotation);
      } else {
        this.routeEvent( obj, field, node );
      }
      this.notifyListeners( obj, field, node);
    }
  }
  
  /** Called when applying changes other than rotation and translation:
  executes a method if such a method exists, passing it a current instance of associated VRObject.
  @param obj VRObject to apply change to
  @param field member field to set or method to execute 
   */
  routeEvent(obj, field, node) {
    var object = obj;
    if ( obj.container ) {
      object = obj.container;
    } else if ( obj.video ) {
      object = obj.video;
    } else {
      console.log("Ignoring unknown event "+field+" to object "+obj.id);
      return;      
    }
    if (typeof object[field] === 'function') {
      object[field](obj);
    } else if (typeof obj[field+'Changed'] === 'function') {
      obj[field+'Changed'](obj);
    //} else if (object.hasOwnProperty(field)) {
    } else {
      console.log("Ignoring unknown event to "+obj+": "+field);
    }
  }

  /** Remove a mesh from the scene (scene listener), and dispose of everything.
  */
  removeMesh(obj) {
    if ( this.mediaStreams ) {
      this.mediaStreams.removeClient(obj);
    }
    if ( obj.container ) {
      obj.container.dispose();
      obj.container = null;
    }
    if ( obj.video ) {
      obj.video.dispose();
      obj.video = null;
    }
    if ( obj.translate ) {
      obj.translate.dispose();
      obj.translate = null;
    }
    if ( obj.rotate ) {
      obj.rotate.dispose();
      obj.rotate = null;
    }
    if ( obj.streamToMesh ) {
      obj.streamToMesh.dispose();
      obj.streamToMesh = null;
    }
    // TODO also remove object (avatar) from internal arrays
  }

  /**
  Periodically executed, as specified by fps. 
  Tracks changes to camera and XR controllers. 
  Calls checkChange, and if anything has changed, changes are sent to server.
  Optionally, changeCallback is executed. 
   */
  trackChanges() {
    var changes = [];
    if ( this.mesh ) {
      // tracking mesh (3rd person view)
      var pos = this.mesh.position;
      if ( this.mesh.ellipsoid ) {
        var height = this.mesh.position.y - this.mesh.ellipsoid.y;
        pos = new BABYLON.Vector3(this.mesh.position.x, height, this.mesh.position.z);
      }
      this.checkChange("position", this.pos, pos, changes);
      this.checkChange("rotation", this.rot, this.mesh.rotation, changes);
    } else {
      // tracking camera (1st person view)
      if ( ! this.camera ) {
        return;
      }
      // track camera movements
      if ( this.camera.ellipsoid ) {
        var height = this.camera.globalPosition.y - this.camera.ellipsoid.y*2;
        if ( this.camera.ellipsoidOffset ) {
          height += this.camera.ellipsoidOffset.y;
        }
        this.checkChange("position", this.pos, new BABYLON.Vector3(this.camera.globalPosition.x, height, this.camera.globalPosition.z), changes);
      } else {
        this.checkChange("position", this.pos, this.camera.globalPosition, changes);
      }
      if ( this.trackRotation ) {
        var cameraRotation = this.camera.rotation;
        if ( this.camera.getClassName() == 'WebXRCamera' ) {
          // CHECKME do other cameras require this?
          cameraRotation = this.camera.rotationQuaternion.toEulerAngles();
        }
        this.checkChange("rotation", this.rot, cameraRotation, changes);
      }
      
      // and now track controllers
      var vrHelper = this.world.vrHelper;
      if ( vrHelper ) {
        if ( vrHelper.leftController ) {
          this.checkChange( 'leftArmPos', this.leftArmPos, vrHelper.leftArmPos(), changes );
          this.checkChange( 'leftArmRot', this.leftArmRot, vrHelper.leftArmRot(), changes );
        }
        if ( vrHelper.rightController ) {
          this.checkChange( 'rightArmPos', this.rightArmPos, vrHelper.rightArmPos(), changes );
          this.checkChange( 'rightArmRot', this.rightArmRot, vrHelper.rightArmRot(), changes );
        }
        // track and transmit userHeight in VR
        if ( this.isChanged( this.userHeight, vrHelper.realWorldHeight(), this.resolution)) {
          this.userHeight = vrHelper.realWorldHeight();
          changes.push({field: 'userHeight', value: this.userHeight});
        }
      }
    }
    if ( changes.length > 0 ) {
      VRSPACE.sendMyChanges(changes);
      if ( this.changeCallback ) {
        this.changeCallback(changes);
      }
    }

  }
  
  /**
  Check if a value has changed, and update change array if so.
   */
  checkChange( field, obj, pos, changes ) {
    if ( this.isChanged(obj.x, pos.x, this.resolution) || 
        this.isChanged(obj.y, pos.y, this.resolution) || 
        this.isChanged(obj.z, pos.z, this.resolution) ) {
      this.log( Date.now()+": "+field + " changed, sending "+pos);
      obj.x = pos.x;
      obj.y = pos.y;
      obj.z = pos.z;
      changes.push({ field: field, value: pos});
    }
  }
  /**
  Return true if a value is ouside of given range.
   */
  isChanged( old, val, range ) {
    return val < old - range || val > old + range;
  }
  
  /**
  Enter the world specified by world.name. If not already connected, 
  first connect to world.serverUrl and set own properties, then start the session. 
  @param properties own properties to set before starting the session
  @return Welcome promise
   */
  async enter( properties ) {
    VRSPACE.addErrorListener((e)=>{
      console.log("Server error:"+e);
      this.error = e;
    });
    return new Promise( (resolve, reject) => {
      var afterEnter = (welcome) => {
        VRSPACE.removeWelcomeListener(afterEnter);
        this.world.entered(welcome)
        resolve(welcome);
      };
      var afterConnect = (welcome) => {
        VRSPACE.removeWelcomeListener(afterConnect);
        if ( properties ) {
          for ( var prop in properties ) {
            VRSPACE.sendMy(prop, properties[prop]);
          }
        }
        // FIXME for the time being, Enter first, then Session
        if ( this.world.name ) {
          VRSPACE.addWelcomeListener(afterEnter);
          VRSPACE.sendCommand("Enter",{world:this.world.name});
          VRSPACE.sendCommand("Session");
        } else {
          VRSPACE.sendCommand("Session");
          this.world.entered(welcome)
          resolve(welcome);
        }
      };
      if ( ! this.isOnline() ) {
        VRSPACE.addWelcomeListener(afterConnect);
        VRSPACE.connect(this.world.serverUrl);
        VRSPACE.addConnectionListener((connected)=>{
          this.log('connected:'+connected);
          if ( ! connected ) {
            reject(this);
          }
        });
      } else if ( this.world.name ){
        VRSPACE.addWelcomeListener(afterEnter);
        VRSPACE.sendCommand("Enter",{world:this.world.name});
      }
    });
  }
  
  /** 
  Send own event.
  @param obj object containing changes to be sent, i.e. name-value pair(s).
   */
  sendMy( obj ) {
    VRSPACE.sendMyEvent(obj);
  }
  
}

/**
WebRTC video/audio streaming support. Implements OpenVidu streaming, subclasses may provide different implementations.
WorldManager manages all clients and their streams.
 */
export class MediaStreams {
  /**
  @param scene
  @param htmlElementName
   */
  constructor(scene, htmlElementName) {
    this.scene = scene;
    // CHECKME null check that element?
    this.htmlElementName = htmlElementName;
    /** function to play video of a client */
    this.playStream = ( client, mediaStream ) => this.unknownStream( client, mediaStream );
    this.startAudio = true;
    this.startVideo = false;
    this.audioSource = undefined; // use default
    this.videoSource = false;     // disabled
    this.publisher = null;
    // this is to track/match clients and streams:
    this.clients = [];
    this.subscribers = [];    
  }
  
  /**
  Initialize streaming and attach event listeners.
  This implementation initializes OpenVidu session.
  @param callback executed when new subscriber starts playing the stream
   */
  async init( callback ) {
    throw "implement me!";
  }

  /**
  Connect to server with given parameters, calls init.
  @param token whatever is needed to connect and initialize the session
   */  
  async connect(token) {
    token = token.replaceAll('&amp;','&');
    console.log('token: '+token);
    await this.init((subscriber) => this.streamingStart(subscriber));
    return this.session.connect(token);
  }
  
  /**
  Start publishing local video/audio
  @param htmlElement needed only for local feedback (testing)
   */
  publish(htmlElementName) {
    this.publisher = this.OV.initPublisher(htmlElementName, {
      videoSource: this.videoSource,     // The source of video. If undefined default video input
      audioSource: this.audioSource,     // The source of audio. If undefined default audio input
      publishAudio: this.startAudio,   // Whether to start publishing with your audio unmuted or not
      publishVideo: this.startVideo    // Should publish video?
    });
    
    // this is only triggered if htmlElement is specified
    this.publisher.on('videoElementCreated', e => {
      console.log("Video element created:");
      console.log(e.element);
      e.element.muted = true; // mute altogether
    });

    // in test mode subscribe to remote stream that we're sending
    if ( htmlElementName ) {
      this.publisher.subscribeToRemote(); 
    }
    // publish own sound
    this.session.publish(this.publisher);
    // id of this connection can be used to match the stream with the avatar
    console.log("Publishing to connection "+this.publisher.stream.connection.connectionId);
    console.log(this.publisher);
  }

  async shareScreen(endCallback) {
    var screenPublisher = this.OV.initPublisher(this.htmlElementName, 
    { videoSource: "screen", audioSource: this.audioSource, publishAudio: this.publishAudio });
    
    return new Promise( (resolve, reject) => {
    
      screenPublisher.once('accessAllowed', (event) => {
          screenPublisher.stream.getMediaStream().getVideoTracks()[0].addEventListener('ended', () => {
              console.log('User pressed the "Stop sharing" button');
              if ( endCallback ) {
                endCallback();
              }
          });
          this.session.unpublish(this.publisher);
          this.publisher = screenPublisher;
          this.publisher.on('videoElementCreated', e => {
            resolve(this.publisher.stream.getMediaStream());
          });
          this.session.publish(this.publisher);
      });
  
      screenPublisher.once('accessDenied', (event) => {
          console.warn('ScreenShare: Access Denied');
          reject(event);
      });
    
    });
  }
  
  stopSharingScreen() {
    this.session.unpublish(this.publisher);
    this.publish();
  }
  
  /**
  Enable/disable video
   */
  publishVideo(enabled) {
    if ( this.publisher ) {
      console.log("Publishing video: "+enabled);
      this.publisher.publishVideo(enabled);
    }
  }

  /**
  Enable/disable (mute) audio
   */
  publishAudio(enabled) {
    if ( this.publisher ) {
      console.log("Publishing audio: "+enabled);
      this.publisher.publishAudio(enabled);
    }
  }
  
  /**
  Retrieve VRSpace Client id from WebRTC subscriber data
   */
  getClientId(subscriber) {
    return parseInt(subscriber.stream.connection.data,10);
  }
  
  /**
  Retrieve MediaStream from subscriber data
   */
  getStream(subscriber) {
    return subscriber.stream.getMediaStream();
  }

  /** Remove a client, called when client leaves the space */
  removeClient( client ) {
    for ( var i = 0; i < this.clients.length; i++) {
      if ( this.clients[i].id == client.id ) {
        this.clients.splice(i,1);
        console.log("Removed client "+client.id);
        break;
      }
    }
    var oldSize = this.subscribers.length;
    // one client can have multiple subscribers, remove them all
    this.subscribers = this.subscribers.filter(subscriber => this.getClientId(subscriber) != client.id);
    console.log("Removed "+(oldSize-this.subscribers.length)+" subscribers, new size "+this.subscribers.length);
  }
  
  /** 
  Called when a new stream is received. 
  Tries to find an existing client, and if found, calls attachAudioStream and attachVideoStream.
   */
  streamingStart( subscriber ) {
    var id = this.getClientId(subscriber);
    console.log("Stream started for client "+id)
    for ( var i = 0; i < this.clients.length; i++) {
      var client = this.clients[i];
      if ( client.id == id ) {
        // matched
        this.attachAudioStream(client.streamToMesh, this.getStream(subscriber));
        //this.clients.splice(i,1); // too eager, we may need to keep it for another stream
        console.log("Audio/video stream started for avatar of client "+id)
        this.attachVideoStream(client, subscriber);
        break;
      }
    }
    this.subscribers.push(subscriber);
  }
  
  /** 
  Called when a new client enters the space. 
  Tries to find an existing stream, and if found, calls attachAudioStream and attachVideoStream.
   */
  streamToMesh(client, mesh) {
    console.log("Loaded avatar of client "+client.id)
    client.streamToMesh = mesh;
    for ( var i = 0; i < this.subscribers.length; i++) {
      var subscriber = this.subscribers[i];
      var id = this.getClientId(subscriber);
      if ( client.id == id ) {
        // matched
        this.attachAudioStream(mesh, this.getStream(subscriber));
        this.attachVideoStream(client, subscriber);
        //this.subscribers.splice(i,1);
        console.log("Audio/video stream connected to avatar of client "+id)
        //break; // don't break, there may be multiple streams
      }
    }
    this.clients.push(client);
  }

  /**
  Attaches an audio stream to a mesh (e.g. avatar)
   */
  attachAudioStream(mesh, mediaStream) {
    var audioTracks = mediaStream.getAudioTracks();
    if ( audioTracks && audioTracks.length > 0 ) {
      console.log("Attaching audio stream to mesh "+mesh.id);
      // see details of
      // https://forum.babylonjs.com/t/sound-created-with-a-remote-webrtc-stream-track-does-not-seem-to-work/7047/6
      var voice = new BABYLON.Sound(
        "voice",
        mediaStream,
        this.scene, null, {
          loop: false,
          autoplay: true,
          spatialSound: true,
          streaming: true,
          distanceModel: "linear",
          maxDistance: 50, // default 100, used only when linear
          panningModel: "equalpower" // or "HRTF"
        });
      voice.attachToMesh(mesh);
      
      var ctx = voice._inputAudioNode.context;
      var gainNode = voice.getSoundGain();
      voice._streamingSource.connect(voice._soundPanner);
      voice._soundPanner.connect(gainNode);
      gainNode.connect(ctx.destination);      
    }
  }
  
  /**
  Attaches a videoStream to a VideoAvatar
   */
  attachVideoStream(client, subscriber) {
    var mediaStream = subscriber.stream.getMediaStream();
    if ( client.video ) {
      // optional: also stream video as diffuseTexture
      if ( subscriber.stream.hasVideo && subscriber.stream.videoActive) {
        console.log("Streaming video texture")
        client.video.displayStream(mediaStream);
      }
      subscriber.on('streamPropertyChanged', event => {
        // "videoActive", "audioActive", "videoDimensions" or "filter"
        console.log('Stream property changed: ');
        console.log(event);
        if ( event.changedProperty === 'videoActive') {
          if ( event.newValue && event.stream.hasVideo ) {
            client.video.displayStream(mediaStream);
          } else {
            client.video.displayAlt();
          }
        }
      });
    } else {
      this.playStream(client, mediaStream );
    }
  }
  
  unknownStream( client, mediaStream ) {
    console.log("Can't attach video stream to "+client.id+" - not a video avatar");
  }
  
}

export class OpenViduStreams extends MediaStreams {
  async init(callback) {
    // CHECKME: utilize CDN
    //await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/openvidu-browser@2.17.0/lib/index.min.js');
    await import(/* webpackIgnore: true */ './openvidu-browser-2.17.0.min.js');
    this.OV = new OpenVidu();
    this.session = this.OV.initSession();
    this.session.on('streamCreated', (event) => {
      // client id can be used to match the stream with the avatar
      // server sets the client id as connection user data
      console.log("New stream "+event.stream.connection.connectionId+" for "+event.stream.connection.data)
      console.log(event);
      var subscriber = this.session.subscribe(event.stream, this.htmlElementName);
      subscriber.on('videoElementCreated', e => {
        console.log("Video element created:");
        console.log(e.element);
        e.element.muted = true; // mute altogether
      });
      subscriber.on('streamPlaying', event => {
        console.log('remote stream playing');
        console.log(event);
        if ( callback ) {
          callback( subscriber );
        }
      });
    });
  
    // On every new Stream destroyed...
    this.session.on('streamDestroyed', (event) => {
      // TODO remove from the scene
      console.log("Stream destroyed!")
      console.log(event);
    });
  }  
}

/**
A cylinder that shows video stream. Until streaming starts, altText is displayed on the cylinder.
It can be extended, and new class provided to WorldManager factory.
*/
export class VideoAvatar {
  constructor( scene, callback, customOptions ) {
    this.scene = scene;
    this.callback = callback;
    this.deviceId = null;
    this.radius = 1;
    this.altText = "N/A";
    this.altImage = null;
    this.textStyle = "bold 64px monospace";
    this.textColor = "black";
    this.backColor = "white";
    this.maxWidth = 640;
    this.maxHeight = 640;
    this.autoStart = true;
    this.autoAttach = true;
    this.attached = false;
    if ( customOptions ) {
      for(var c of Object.keys(customOptions)) {
        this[c] = customOptions[c];
      }
    }
  }
  /**
  Show the avatar. Used for both own and remote avatars.
   */
  async show() {
    if ( ! this.mesh ) {
      if ( this.autoAttach ) {
        this.cameraTracker = () => this.cameraChanged();        
      }
      this.mesh = BABYLON.MeshBuilder.CreateDisc("VideoAvatar", {radius:this.radius}, this.scene);
      //mesh.visibility = 0.95;
      this.mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      this.mesh.position = new BABYLON.Vector3( 0, this.radius, 0);
      this.mesh.material = new BABYLON.StandardMaterial("WebCamMat", this.scene);
      this.mesh.material.emissiveColor = new BABYLON.Color3.White();
      this.mesh.material.specularColor = new BABYLON.Color3.Black();
 
      // used for collision detection (3rd person view)
      this.mesh.ellipsoid = new BABYLON.Vector3(this.radius, this.radius, this.radius);

      // glow layer may make the texture invisible, needd to turn of glow for the mesh
      if ( this.scene.effectLayers ) {
        this.scene.effectLayers.forEach( (layer) => {
          if ( 'GlowLayer' === layer.getClassName() ) {
            layer.addExcludedMesh(this.mesh);
          }
        });
      }     
      // display alt text before video texture loads:
      this.displayAlt();
    
      if ( this.autoStart ) {
        await this.displayVideo();
      }
    }
  }

  /** dispose of everything */  
  dispose() {
    if ( this.mesh.parent ) {
      this.mesh.parent.dispose();
    }
    if ( this.mesh.material ) {
      if ( this.mesh.material.diffuseTexture ) {
        this.mesh.material.diffuseTexture.dispose();
      }
      this.mesh.material.dispose();
    }
    if ( this.mesh ) {
      this.mesh.dispose();
      delete this.mesh;
    }
  }
  
  /**
  Display and optionally set altText.
   */
  displayText(text) {
    if ( text ) {
      this.altText = text;
    }
    if ( this.mesh.material.diffuseTexture ) {
       this.mesh.material.diffuseTexture.dispose();
    }
    this.mesh.material.diffuseTexture = new BABYLON.DynamicTexture("WebCamTexture", {width:128, height:128}, this.scene);
    this.mesh.material.diffuseTexture.drawText(this.altText, null, null, this.textStyle, this.textColor, this.backColor, false, true);    
  }
  
  /**
  Display and optionally set altImage
  @param image path to the image file
   */
  displayImage(image) {
    if ( image ) {
      this.altImage = image;
    }
    if ( this.mesh.material.diffuseTexture ) {
       this.mesh.material.diffuseTexture.dispose();
    }
    this.mesh.material.diffuseTexture = new BABYLON.Texture(this.altImage, this.scene, null, false);    
  }
  
  /** Displays altImage if available, altText otherwise  */
  displayAlt() {
    if ( this.altImage ) {
      this.displayImage();
    } else {
      this.displayText();
    }
  }
  
  /** 
  Display video from given device, used for own avatar.
   */
  async displayVideo( deviceId ) {
    if ( deviceId ) {
      this.deviceId = deviceId;
    }
    if ( ! this.deviceId ) {
      var devices = await navigator.mediaDevices.enumerateDevices();
      for (var idx = 0; idx < devices.length; ++idx) {
        if (devices[idx].kind === "videoinput") {
          console.log(devices[idx]);
          this.deviceId = devices[idx].deviceId;
          break;
        }
      }
    }
    if ( this.deviceId ) {
      BABYLON.VideoTexture.CreateFromWebCamAsync(this.scene, { maxWidth: this.maxWidth, maxHeight: this.maxHeight, deviceId: this.deviceId }).then( (texture) => {
        if ( this.mesh.material.diffuseTexture ) {
           this.mesh.material.diffuseTexture.dispose();
        }
        this.mesh.material.diffuseTexture = texture;
        if ( this.callback ) {
          this.callback();
        }
      });
    }
  }
  
  /**
  Create and display VideoTexture from given MediaStream.
   */
  displayStream( mediaStream ) {
    BABYLON.VideoTexture.CreateFromStreamAsync(this.scene, mediaStream).then( (texture) => {
      if ( this.mesh.material.diffuseTexture ) {
         this.mesh.material.diffuseTexture.dispose();
      }
      this.mesh.material.diffuseTexture = texture;
    });
  }
  
  /**
  Rescale own avatar and attach to current camera, 35cm ahead, 5cm below.
   */
  attachToCamera( position ) {
    this.mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
    this.mesh.parent = this.camera;
    if ( position ) {
      this.mesh.position = position;
    } else {
      // 5cm below, 30 cm ahead of eyes
      this.mesh.position = new BABYLON.Vector3( 0, -.05, .35 );
      var scale = (this.radius/2)/20; // 5cm size
      this.mesh.scaling = new BABYLON.Vector3(scale, scale, scale);
    }
    this.cameraChanged();
    this.attached = true;
    this.scene.onActiveCameraChanged.add( this.cameraTracker );
  }
  
  /** Rescale own avatar and detach from camera */
  detachFromCamera() {
    if ( this.attached ) {
      this.mesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
      this.mesh.position = this.camera.position; // CHECKME: must be the same
      console.log("Mesh position: "+this.mesh.position);
      this.mesh.scaling = new BABYLON.Vector3(1, 1, 1);
      this.scene.onActiveCameraChanged.remove( this.cameraTracker );
      this.mesh.parent = null;
      this.attached = false;
    }
  }
 
  /** Called when active camera changes/avatar attaches to camera */ 
  cameraChanged() {
    if ( this.autoAttach ) {
      console.log("Camera changed: "+this.scene.activeCamera.getClassName()+" new position "+this.scene.activeCamera.position);
      this.camera = this.scene.activeCamera;
      this.attached = true;
      this.mesh.parent = this.camera;
    }
  }
    
}