import {VRSPACE} from '../client/vrspace.js';
import {ScriptLoader} from '../core/script-loader.js';
import {AssetLoader} from '../core/asset-loader.js';
import {LoadProgressIndicator} from './load-progress-indicator.js';
import {HUD} from './hud.js';
import {ServerFolder} from '../core/server-folder.js';

/**
Main UI class, provides utility methods and basic UI elements.
@class
 */
export class VRSpaceUI {

  /** Creates UI with default LoadProgressIndicator */
  constructor( ) {
    /** babylon scene*/
    this.scene = null;
    /** content base (prefix), default empty (same host) */
    this.contentBase = '';
    /** Path to logo, null defaults to contentBase+/babylon (vrspace.org logo)*/
    this.logoPath = null;
    /** Logo file name, defaults to logo.glb */
    this.logoFile = "logo.glb";
    /** vrspace.org logo mesh */
    this.logo = null;
    /** Path to logo, null defaults to contentBase+/babylon/portal */
    this.portalPath = null;
    /** Portal file name, defaults to scene.gltf */
    this.portalFile = "scene.gltf";
    /** portal mesh */
    this.portal = null;
    /** debug output enabled */
    this.debug = false;
    /** frames per second */ 
    this.fps = 5; // CHECKME: reasonable default fps
    /** Pointer to function, defaults to this.loadProgressIndiciatorFactory */
    this.loadProgressIndicator = (scene, camera) => this.loadProgressIndicatorFactory(scene, camera);
    /** Head-up display */
    this.hud = null;
    /** babylon GUI manager - multiple instances may cause issues with transparency */
    this.guiManager = null;
    /** Script loader */
    this.scriptLoader = new ScriptLoader();
    /** VR availability */
    this.canVR = null;
    /** AR availability */
    this.canAR = null;
    /** @private */ 
    this.indicator = null;
    /** @private */ 
    this.initialized = false;
    /** @private */
    this.optimizingScene = false;
    /** reference to VRSpace singleton */
    this.VRSPACE = VRSPACE;
    /** reference to AssetLoader singleton */
    this.assetLoader = null;
  }

  /** 
   * Creates asset loader, preloads vrspace.org logo and portal for later use. 
  @param scene babylon.js scene to operate with.
  */
  async init(scene) {
    if ( ! this.initialized || this.scene !== scene ) {
      this.scene = scene;
      try {
        if ( ! this.hud ) {
          this.hud = new HUD(scene);
          this.guiManager = this.hud.guiManager;
        }
      } catch ( exception ) {
        console.log( "WARNING: Can't create HUD - make sure to load babylon.gui.min.js", exception);
      }
      this.assetLoader = new AssetLoader(this.scene);
      this.canVR = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync("immersive-vr");
      this.canAR = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync("immersive-ar");
      
      // TODO figure out location of script
      var container = await BABYLON.SceneLoader.LoadAssetContainerAsync(this.logoDir(),this.logoFile,this.scene);
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

  /** Used in init, return logPath if exists, or default path to vrspace.org logo */
  logoDir() {
    if ( this.logoPath ) {
      return this.logoPath;
    }
    return this.contentBase+"/babylon/";
  }
  
  /** Returns portalPath if exists, defaults to contentBase+/babylon/portal */
  portalDir() {
    if ( this.portalPath ) {
      return this.portalPath;
    }
    return this.contentBase+"/babylon/portal/";
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
      var container = await BABYLON.SceneLoader.LoadAssetContainerAsync(this.portalDir(), this.portalFile, scene)
      container.materials[0].albedoColor = BABYLON.Color3.FromHexString('#B3EEF3');
      container.materials[0].metallic = 0.85;
      
      this.portal = container.createRootMesh();
      this.portal.rotation = new BABYLON.Vector3(0,Math.PI/2,0);
      this.portal.name = 'Portal';
      //container.addAllToScene();
    }
    return this.portal;
  }

  /** 
  lists files on a server directory
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

  /** 
  lists files on a server directory
  @param theUrl url to load from
  @returns Promise with XMLHttpRequest
  */
  async listFilesAsync(theUrl){
    return new Promise( (resolve, reject) => {
      this.log("Fetching "+theUrl);
      var xmlHttp = new XMLHttpRequest();
      xmlHttp.responseType = "document";
      xmlHttp.onreadystatechange = () => {
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
          resolve(xmlHttp);
        }
        // TODO error handling
      }
      xmlHttp.open("GET", theUrl, true); // true for asynchronous
      xmlHttp.send(null);
    });
  }

  /** list folders with their jpg thumbnails (files ending with .jpg)
  @param dir directory to list
  @param callback to call
   */ 
  listThumbnails(dir, callback) {
    this.listMatchingFiles( dir, callback, '.jpg' );
  }

  /** list character folders and their fix files 
  @param dir directory to list
  @param callback to call
  */
  listCharacters(dir, callback) {
    this.listMatchingFiles( dir, callback, '-fixes.json' );
  }

  /** list character folders and their fix files 
  @param dir directory to list
  */
  async listCharactersAsync(dir) {
    return this.listMatchingFilesAsync( dir, '-fixes.json' );
  }

  /**
  List files in a server folder
  @param dir directory to list
  @param callback receives string array with urls
  @param suffix optional suffix of listed files
   */
  listDirectory(dir, callback, suffix) {
    // TODO we need sync version of this
    if ( !dir.endsWith('/') ) {
      dir += '/';
    }
    var ui = this;
    return this.listFiles(dir, (xmlHttp) => {
      var links = xmlHttp.responseXML.links;
      var files = [];
      
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
        if ( link.href.endsWith('/') ) {
          continue;
        }
        if ( ! suffix || href.endsWith(suffix)) {
          ui.log(link.baseURI+' '+href);
          files.push(href);
        }
      }

      callback(files);
    });
  }
  
  
  /**
  list server folders along with their matching files
  i.e. files with the same name, plus given suffix
  @param dir directory to list
  @param callback to call, receives ServerFolder array as argument
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
  list server folders along with their matching files
  i.e. files with the same name, plus given suffix
  @param dir directory to list
  @param suffix of related file
  @returns Promise with ServerFolder array
   */
  async listMatchingFilesAsync(dir, suffix) {
    if ( !dir.endsWith('/') ) {
      dir += '/';
    }

    return this.listFilesAsync(dir).then( xmlHttp => {
        var links = xmlHttp.responseXML.links;
        var files = [];
        var fixes = [];

        // first pass:
        // iterate all links, collect avatar directories and fixes
        for ( var i = 0; i < links.length; i++ ) {
          let link = links[i];
          let href = link.href;
          let baseUri = link.baseURI;
          if ( href.indexOf('?') > 0 ) {
            continue;
          }
          if ( baseUri.length > link.href.length ) {
            continue;
          }
          if ( link.href.endsWith(suffix) ) {
            fixes.push(href.substring(baseUri.length));
            continue;
          }
          if ( ! link.href.endsWith('/') ) {
            continue;
          }
          href = href.substring(baseUri.length);
          href = href.substring(0,href.indexOf('/'));
          this.log(baseUri+' '+href);
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
        
        this.log(folders);
        return folders;

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
  Both instance and clone use the same material, but only the clone has own lightning effects (e.g. shadows, environment).
  @param mesh to instantiate/clone
  @param parent optional, copy will have this parent
  @param replaceParent optional
  @returns copied mesh
   */
  copyMesh(mesh, parent, replaceParent) {
    if ( mesh.geometry ) {
      var copy = mesh.createInstance(mesh.name+"-instance");
      //var copy = mesh.clone( mesh.name+"-clone", parent, true, false );
      copy.parent = parent;
    } else if (replaceParent && parent) {
      copy = parent;
    } else {
      var copy = mesh.clone( mesh.name+"-clone", parent, true, false );
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
  updateQuaternionAnimationFromVec(group, from, to) {
    // 'to' is a Vector3, 'from' is current rotationQuaternion
    // we have to rotate around to.y axis
    let dest = new BABYLON.Quaternion.FromEulerAngles(0,to.y,0);
    return this.updateQuaternionAnimation(group, from, dest);
  }

  /**
  Utility method - update quaternion animation of a mesh field around Y axis.  
  @param group AnimationGroup to update
  @param from Quaternion
  @param to Quaternion
   */
  updateQuaternionAnimation(group, from, to) {
    if ( group.isPlaying ) {
      group.stop();
    }
    var anim = group.targetedAnimations[0].animation;
    anim.getKeys()[0].value = from;
    anim.getKeys()[1].value = to;
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
    if ( Array.isArray(urls) ) {
      urls.forEach((url) => this.addScript(url));
    } else {
      this.addScript(urls);
    }
    return this.scriptLoader.load(parallel);
  }
  addScript(url) {
    if ( url.startsWith('/') && this.contentBase ) {
      url = this.contentBase+url;
    }
    this.scriptLoader.add(url);
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

  /**
  Utility method to save a file with given name and file content.
  @param filename to save
  @param content of the file, typically some JSON string
   */
  saveFile(filename, content) {
    var a = document.createElement('a');
    var blob = new Blob([content], {'type':'application/octet-stream'});
    a.href = window.URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }
  
}

// this does not ensure singleton in the browser
// world scripts may be loaded from different contexts
//export const VRSPACEUI = new VRSpaceUI();

export let VRSPACEUI;

if ( typeof window !== 'undefined' ) {
  if (window.VRSPACEUI === undefined) {
    VRSPACEUI = new VRSpaceUI();
    window.VRSPACEUI=VRSPACEUI;
  } else {
    VRSPACEUI = window.VRSPACEUI;
  }
}
