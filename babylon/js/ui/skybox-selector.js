export class SkyboxSelector {
  constructor(world) {
    this.world = world;
    this.boxes=[];
    // add own selection predicate to the world
    this.selectionPredicate = (mesh) => this.isSelectableMesh(mesh);
    world.addSelectionPredicate(this.selectionPredicate);
  }
  
  makeSkyBox( dir,name ) {
    var skybox = BABYLON.Mesh.CreateBox("skyBox-"+name, 1, this.scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox-"+name, this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    //skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(dir, this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  
  show() {
    var skyboxes = new Set();
    var anchor = new BABYLON.TransformNode("anchor");
    var forwardDirection = VRSPACEUI.hud.camera.getForwardRay(6).direction;
    anchor.position = VRSPACEUI.hud.camera.position.add(forwardDirection);
    anchor.rotation = new BABYLON.Vector3(VRSPACEUI.hud.camera.rotation.x,VRSPACEUI.hud.camera.rotation.y,VRSPACEUI.hud.camera.rotation.z);
    //console.log("Anchor position: ", anchor.position);
    // TODO: this often causes UI elements being below ground level
    // we could cast a ray down and calc position to put the panel on top of ground or whatever is below it
    
    this.panel = new BABYLON.GUI.CylinderPanel();
    this.panel.margin = .2;
    var manager = VRSPACEUI.guiManager;
    manager.addControl(this.panel);
    this.panel.linkToTransformNode(anchor);

    VRSPACEUI.listMatchingFiles(VRSPACEUI.contentBase+"/content/skybox/", list => {
      // list is ServerFolder array
      list.forEach( sf => {
        // sf is ServerFolder object
        VRSPACEUI.listDirectory(sf.url(), skyboxDir => {
          skyboxDir.forEach( f => {
            // f is an individual file
            // name is directoryUrl+skyboxName+_axis+.jpg
            var skyboxName = f.substring( f.lastIndexOf("/")+1, f.lastIndexOf("_") );
            // images not ending with _px, _nx etc (panoramic) do not parse well here, e.g.
            // https://localhost/content/skybox/eso_milkyway/eso0932a.jpg
            // and we get wrong name, e.g. _milkyway/ so just skip them
            if ( ! skyboxName.startsWith("_") ) {
              // and this is what we need to create cubeTexture:
              var skyboxDir = f.substring( 0, f.lastIndexOf("_") );
              //console.log(f, skyboxName, skyboxDir);
              if ( ! skyboxes.has(skyboxDir)) {
                skyboxes.add(skyboxDir);
                var box = this.makeSkyBox(skyboxDir,skyboxName);
                //box.position = new BABYLON.Vector3(skyboxes.size*2, 1, 0);
                var button = new BABYLON.GUI.MeshButton3D(box, "pushButton-"+skyboxName);
                button.onPointerDownObservable.add(() => {
                  this.world.skyBox.material.reflectionTexture = box.material.reflectionTexture;
                });
                this.boxes.push(box);
                this.panel.addControl(button);
              }
            }
          });
        }, ".jpg");
      }); 
    });
    
  }
  
  hide() {
    this.panel.dispose();
    this.boxes = [];
  }

  dispose() {
    this.hide();
    this.world.removeSelectionPredicate(this.selectionPredicate);    
  }  
  
  isSelectableMesh(mesh) {
    return this.boxes.includes(mesh);
  }
  
}