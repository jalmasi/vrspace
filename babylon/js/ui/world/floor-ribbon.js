import {VRSPACEUI} from '../vrspace-ui.js';

/** UI to create floors, see {@link https://www.youtube.com/watch?v=8RxToSgtoko|this youtube video}.
Start recording, then edit, then save, either as js or json.
UI Buttons are bound to current camera.
 */
export class FloorRibbon {
  /**
  @param world a World to show in
  @param size floor size, default 1 m
  */
  constructor( world, size ) {
    // parameters
    this.world = world;
    this.scene = world.scene;
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
    this.contentBase=VRSPACEUI.contentBase;
    // required for Scene.pointerMovePredicate, resizing the ribbon
    this.world.addSelectionPredicate(mesh=>this.isSelectableMesh(mesh));
  }
  cameraChanged() {
    console.log("Camera changed: "+this.scene.activeCamera.getClassName()+" new position "+this.scene.activeCamera.position);
    this.camera = this.scene.activeCamera;
    this.left.parent = this.camera;
    this.right.parent = this.camera;
  }

  /** Shows the UI */
  showUI() {
    this.recordButton = VRSPACEUI.hud.addButton("Start", this.contentBase+"/content/icons/play.png");
    this.recordButton.onPointerDownObservable.add( () => this.startStopCancel());

    this.editButton = VRSPACEUI.hud.addButton("Edit",this.contentBase+"/content/icons/edit.png");
    this.editButton.onPointerDownObservable.add( () => this.edit());

    this.jsonButton = VRSPACEUI.hud.addButton("JSON", this.contentBase+"/content/icons/download.png");
    this.jsonButton.onPointerDownObservable.add( () => this.saveJson());

    this.jsButton = VRSPACEUI.hud.addButton("JS", this.contentBase+"/content/icons/download.png");
    this.jsButton.onPointerDownObservable.add( () => this.saveJs());

    this.editButton.isVisible = false;
    this.jsonButton.isVisible = false;
    this.jsButton.isVisible = false;
  }
  startStopCancel() {
    if ( this.floorMesh ) {
      // cancel
      this.floorMesh.dispose();
      delete this.floorMesh;
      this.leftPath = [];
      this.rightPath = [];
      this.pathArray = [ this.leftPath, this.rightPath ];
      this.recordButton.text="Start";
    } else {
      this.recording = !this.recording;
      if ( this.recording ) {
        // start
        this.startRecording();
        this.recordButton.text="Pause";
      } else {
        // stop
        this.createPath();
        this.recordButton.text="Cancel";
      }
    }
    this.updateUI();
  }
  updateUI() {
    if ( this.recording ) {
      this.recordButton.imageUrl = this.contentBase+"/content/icons/pause.png";
    } else if ( this.floorMesh) {
      this.recordButton.imageUrl = this.contentBase+"/content/icons/undo.png";
    } else {
      this.recordButton.imageUrl = this.contentBase+"/content/icons/play.png";
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
  isSelectableMesh(mesh) {
    return mesh && this.floorMesh && this.floorMesh == mesh;
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
      this.editButton.imageUrl = this.contentBase+"/content/icons/edit.png";
      if ( this.edgeMesh ) {
        this.edgeMesh.dispose();
        delete this.edgeMesh;
      }
    } else if ( this.editing ) {
      this.editButton.imageUrl = this.contentBase+"/content/icons/back.png";
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
    VRSPACEUI.saveFile('FloorRibbon'+this.floorCount+'.json', json);
    this.clear();
  }
  saveJs() {
    var js = this.printJs();
    VRSPACEUI.saveFile('FloorRibbon'+this.floorCount+'.js', js);
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
}

