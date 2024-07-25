class AssetSync {
  constructor(url, scene) {
    this.url = url;
    this.scene = scene;
    this.container = null;
    this.numberOfInstances = 0;
    this.info = null;
  }
  load(callback,failure,progress) {
    this.loadAsset(callback,failure,progress);
    return this.promise;
  }
  async loadAsset(callback,failure,progress) {
    if ( this.promise ) {
      await this.promise;
      this.numberOfInstances++;
      this.instantiate(callback);
      return this.promise;
    }
    this.promise = new Promise( (resolve, reject) => {
      if ( this.container ) {
        resolve();
      } else {
        this.numberOfInstances++;
        console.log('loading sync '+this.url+" "+this.numberOfInstances);
        // load
        var path = "";
        var file = this.url;
        var pos = this.url.lastIndexOf('/');
        if ( pos >= 0 ) {
          path = this.url.substring(0,pos+1);
          file = this.url.substring(pos+1);
        }
        var plugin = BABYLON.SceneLoader.LoadAssetContainer(path, file, this.scene, (container) =>
          {
            console.log("Loaded asset "+this.url);
            //var root = container.createRootMesh();
            this.container = container;
            //container.addAllToScene();
            if ( callback ) {
              try {
                callback(this.url, container, this.info);                
              } catch ( err ) {
                console.log( "Error in callback for "+this.url, err);
              }
            }
            resolve(container);
          },
          (evt, name) => {if ( progress ) progress(evt, name)}, 
          (scene, message, exception)=>{
            if ( failure ) {
              failure(exception);
            } else {
              console.log(message, exception);
            }
            reject(exception);
          }
        );
        plugin.onParsedObservable.add(gltfBabylon => {
            var manifest = gltfBabylon.json;
            this.info = manifest.asset.extras;
            console.log("Asset extra info: ",this.info);
        });
      }
    });
    return this.promise;
  }
  instantiate(callback) {
    console.log('instantiating '+this.numberOfInstances+" of "+this.url);
    // instantiate
    // make sure to enable before instantiating, or we may get invisible copy
    var isEnabled = this.container.meshes[0].isEnabled();
    this.container.meshes.forEach(mesh=>mesh.setEnabled(true));
    var instances = this.container.instantiateModelsToScene();
    this.container.meshes[0].setEnabled(isEnabled);
    console.log("Instantiated "+this.numberOfInstances+" of "+this.url);
    try {
      callback(this.url, this.container, this.info, instances);
    } catch ( err ) {
      console.log( "Error in callback for "+this.url, err);
    }
  }
}

/** 
Loads assets from GLTF files and keeps references, creates clones of already loaded assets.
 */
export class AssetLoader {
  constructor(scene) {
    this.scene=scene;
    // contains asset containers - name and number of used instances
    this.containers={};
    this.debug=true;
  }
  /**
   * Load or instantiate an AssetContainer from given URL. Used to load avatars, all heavy lifting is done elsewhere.
   * @param url URL to load from
   * @param callback optional callback to be executed after successfull load; takes url, AssetContainer and GLTF metadata parameters
   * @param failure optional callback to be called with exception
   * @param progress optional ProgressIndicator instance
   * @returns promise 
   */
  async loadAsset( url, callback, failure, progress ) {
    await this.createAsset(url);
    return this.containers[url].load(callback, failure, progress);
  }
  /** Internal */
  async createAsset(url) {
    if ( !this.containers[url] ) {
      console.log("Creating asset "+url);
      this.containers[url] = new AssetSync(url, this.scene);
    }
  }
  /**
  Load or instantiate mesh of a VRObject: if loaded, create a container root and add all objects to scene;
  if already loaded, instantiate.
  Utility method that calls this.loadAsset() and post-processes the result to match VRObject and Mesh.
  Called from WorldManager for pretty everything except avatars.
  @param obj VRObject to load
  @param callback function executed on success
  @param failure function executed on failure
   */
  loadObject(obj, callback, failure, progress) {
    this.loadAsset(
      obj.mesh, 
      (loadedUrl, container, info, instantiatedEntries) => {
        if ( instantiatedEntries ) {
          obj.instantiatedEntries = instantiatedEntries;
    
          // Adds all elements to the scene
          var mesh = obj.instantiatedEntries.rootNodes[0];
          mesh.VRObject = obj;
          mesh.name = obj.mesh;
          mesh.scaling = new BABYLON.Vector3(1,1,1);
          mesh.refreshBoundingInfo();
          mesh.id = obj.className+" "+obj.id;
    
          console.log("Instantiated "+this.numberOfInstances+" of "+obj.mesh, obj);
    
          callback(mesh);
    
        } else {
          var mesh = container.createRootMesh();
          container.addAllToScene();
          
          // Adds all elements to the scene
          mesh.VRObject = obj;
          mesh.name = obj.mesh;
          mesh.id = obj.className+" "+obj.id;
          
          obj.container = container;
          
          console.log("Loaded "+obj.mesh);
          
          callback(mesh);
        }
      },
      failure,
      progress
    );
  }
  
  /**
  Remove a loaded VRObject from the scene.
  @param obj VRObject to remove
  @returns number of remaining instances
   */
  unloadObject(obj) {
    if ( this.containers[obj.mesh] ) {
      // loaded by asset loader
      console.log("Unloading object ",obj);
      var container = this.containers[obj.mesh];
      this.unloadAsset(obj.mesh, obj.instantiatedEntries);
      return container.numberOfInstances;
    } else if ( obj.container ) {
      // TODO remove after refactoring
      // legacy, loaded by some other component (avatar.js)
      console.log("FIXME: disposing of "+obj.id);
      this.disposeOfContainer(obj.container);
      return 0;
    }
  }
  unloadAsset(url, instantiatedEntries) {
    if ( this.containers[url] ) {
      // loaded by asset loader
      var asset = this.containers[url];
      var container = this.containers[url].container;
      asset.numberOfInstances--;
      if ( instantiatedEntries ) {
        console.log("Removing an instance of "+url+", "+asset.numberOfInstances+" remaining");
        instantiatedEntries.rootNodes.forEach( node => node.dispose() );
        instantiatedEntries.skeletons.forEach( node => node.dispose() );
        instantiatedEntries.animationGroups.forEach( node => node.dispose() );
      } else {
        console.log("Disabling main instance of "+url+", "+asset.numberOfInstances+" remaining");
      // well we can't dispose of container just like that
        container.meshes[0].setEnabled(false);
      }
      if ( asset.numberOfInstances == 0 ) {
        console.log("Unloaded "+url);
        this.disposeOfContainer(container);
        delete this.containers[url];
      }
    }
    // TODO else error
  }
  // workaround for https://forum.babylonjs.com/t/assetcontainer-dispose-throws-typeerror-r-metadata-is-null/30360
  disposeOfContainer(container) {
    try {
      container.dispose();
    } catch ( error ) {
      console.log("Failed to dispose of container", error);
    }
  }
  /** 
  Returns all assets currently loaded from the server, with spatial coordinates of all instances.
  Note that this does not return object loaded before joining the server, e.g. in world.js, user's own avatar, etc. 
   */
  dump() {
    let dump = {};
    this.scene.rootNodes.forEach( (node) => {
      let url = node.name;
      // CHECKME: do we want also to return user avatars? (starts with Client)
      if ( node.id.startsWith("VRObject") && this.containers[url] ) {
        if ( ! dump[url] ) {
          dump[url] = {
            info: this.containers[url].info,
            numberOfInstances: this.containers[url].numberOfInstances,
            instances: []
          };
        } 
        var vrObject = node.VRObject;
        var obj = {
          id: vrObject.id,
          position: vrObject.position,
          rotation: vrObject.rotation,
          scale: vrObject.scale
        };
        dump[url].instances.push(obj);
      }
    });
    return dump;
  }
  /**
   * Returns object containing information about all assets loaded by this AssetLoader.
   * Object contains one field that is asset (relative) url, and the value is info object.
   * That's manifest.asset.extras of GLTF file, present in Sketchfab models.
   * Contains author, license, source, and title fields.
   */
  assetInfos() {
    let infos = {};
    for ( let url in this.containers ) {
      infos[url]=this.containers[url].info;
    };
    return infos;
  }
}