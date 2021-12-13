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
  log(something) {
    if ( this.debug ) {
      console.log(something);
    }
  }
  loadAsset( url, callback, failure ) {
    if ( this.containers[url] ) {
      // instantiate
      var container = this.containers[url];
      container.numberOfInstances++;
      var instances = container.instantiateModelsToScene();

      this.log("Instantiated "+container.numberOfInstances+" of "+url);

      callback(container, instances);
    } else {
      // load
      var pos = url.lastIndexOf('/');
      var path = url.substring(0,pos+1);
      var file = url.substring(pos+1);
      var plugin = BABYLON.SceneLoader.LoadAssetContainer(path, file, this.scene, (container) =>
        {
          //var root = container.createRootMesh();
          container.numberOfInstances = 1;
          this.containers[url] = container;
          container.addAllToScene();

          this.log("Loaded asset "+url);

          callback(container);
        }, null, (scene, message, exception)=>{
          if ( failure ) {
            failure(exception);
          } else {
            console.log(message, exception);
          }
        }
      );
      return plugin;
    }
  }
  /**
  Load or instantiate mesh of a VRObject.
  @param obj VRObject to load
  @param callback function executed on success
  @param failure function executed on failure
   */
  loadObject(obj, callback, failure) {
    this.loadAsset(
      obj.mesh, 
      (container, instantiatedEntries) => {
        if ( instantiatedEntries ) {
          obj.instantiatedEntries = instantiatedEntries;
    
          // Adds all elements to the scene
          var mesh = obj.instantiatedEntries.rootNodes[0];
          mesh.VRObject = obj;
          mesh.name = obj.mesh;
          mesh.scaling = new BABYLON.Vector3(1,1,1);
          mesh.refreshBoundingInfo();
          mesh.id = obj.className+" "+obj.id;
    
          this.log("Instantiated "+container.numberOfInstances+" of "+obj.mesh);
    
          callback(mesh);
    
        } else {
          var mesh = container.createRootMesh();
          
          // Adds all elements to the scene
          mesh.VRObject = obj;
          mesh.name = obj.mesh;
          mesh.id = obj.className+" "+obj.id;
          
          obj.container = container;
          
          this.log("Loaded "+obj.mesh);
          
          callback(mesh);
        }
      }, 
      failure 
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
      var container = this.containers[obj.mesh];
      if ( obj.instantiatedEntries ) {
        obj.instantiatedEntries.rootNodes.forEach( node => node.dispose() );
      } else {
        // well we can't dispose of container just like that
        container.meshes[0].setEnabled(false);
      }
      this.unloadAsset(obj.mesh);
      return container.numberOfInstances;
    } else if ( obj.container ) {
      // TODO remove after refactoring
      // legacy, loaded by some other component (avatar.js)
      console.log("FIXME: disposing of "+obj.id);
      obj.container.dispose();
      return 0;
    }
  }
  unloadAsset(url) {
    if ( this.containers[url] ) {
      // loaded by asset loader
      var container = this.containers[url];
      container.numberOfInstances--;
      this.log("Removing an instance of "+url+", "+container.numberOfInstances+" remaining");
      if ( container.numberOfInstances == 0 ) {
        this.log("Unloaded "+url);
        container.dispose();
        delete this.containers[url];
      }
    }
    // TODO else error
  }
}