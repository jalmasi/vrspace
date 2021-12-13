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
  /**
  Load or instantiate mesh of an object.
  @param obj VRObject to load
  @param callback function exectued on success
   */
  loadOrInstantiate(obj, callback) {
    if ( this.containers[obj.mesh] ) {
      // instantiate
      var container = this.containers[obj.mesh];
      container.numberOfInstances++;
      obj.instantiatedEntries = container.instantiateModelsToScene();

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
      // load
      var pos = obj.mesh.lastIndexOf('/');
      var path = obj.mesh.substring(0,pos+1);
      var file = obj.mesh.substring(pos+1);
      BABYLON.SceneLoader.LoadAssetContainerAsync(path, file, this.scene).then((container) =>
      {
        var mesh = container.createRootMesh();
        container.numberOfInstances = 1;
        this.containers[obj.mesh] = container;
        
        // Adds all elements to the scene
        mesh.VRObject = obj;
        mesh.name = obj.mesh;
        mesh.id = obj.className+" "+obj.id;
        
        container.addAllToScene();
  
        obj.container = container;
        
        this.log("Loaded "+obj.mesh);
        
        callback(mesh);
      }).catch(exception=>{
        if (obj._loadErrorHandler) {
          obj._loadErrorHandler(obj, exception);
          delete obj._loadErrorHandler;
        } else {
          console.log(exception);
        }
      });
    }
  }
  /**
  Remove a loaded VRObject from the scene.
  @param obj VRObject to remove
  @returns number of remaining instances
   */
  unload(obj) {
    if ( this.containers[obj.mesh] ) {
      // loaded by asset loader
      var container = this.containers[obj.mesh];
      container.numberOfInstances--;
      this.log("Removing an instance of "+obj.mesh+", "+container.numberOfInstances+" remaining");
      if ( obj.instantiatedEntries ) {
        obj.instantiatedEntries.rootNodes.forEach( node => node.dispose() );
      } else {
        // well we can't dispose of container just like that
        container.meshes[0].setEnabled(false);
      }
      if ( container.numberOfInstances == 0 ) {
        this.log("Unloaded "+obj.mesh);
        container.dispose();
        delete this.containers[obj.mesh];
      }
      return container.numberOfInstances;
    } else if ( obj.container ) {
      // TODO remove after refactoring
      // legacy, loaded by some other component (avatar.js)
      obj.container.dispose();
      return 0;
    }
  }
}