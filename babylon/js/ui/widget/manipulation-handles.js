import { VRSPACEUI } from "../vrspace-ui.js";

/**
 * Plane manipulation UI: adds handles around a plane, and installs pointer drag observable to the scene.
 * Top and bottom handles are used to move the plane around, with 6DOF.
 * Left and right handles resize the plane.
 * If this.canMinimize is set, also adds a top-right box that disables plane's parent and all of it's children, 
 * except ones specified in dontMinimize.
 * Material and parent are taken from the plane.
 * While initially intended to be used for manipulation of a plane, this can be used to manipulate any mesh.
 */
export class ManipulationHandles {
  /**
   * Create the control.
   * @param plane mesh to manipulate
   * @param width mesh width, determines how wide are handles
   * @param height mesh height, how far up and down are handles
   * @param scene babylon scene
   */
  constructor(plane, width, height, scene) {
    this.plane = plane;
    this.material = plane.material;
    this.width = width;
    this.height = height;
    this.group = plane.parent;
    this.scene = scene;
    this.segments = 8;
    this.canMinimize = true;
    this.minimized = false;
    this.dontMinimize = [];
    this.sizeCallback = null;
    this.positionCallback = null;
    
    this.selectedMaterial = new BABYLON.StandardMaterial("selectedMaterial", this.scene);
    this.selectedMaterial.alpha = this.material.alpha;
    this.selectedMaterial.diffuseColor = new BABYLON.Color3(.2,.5,.2);
  
    this.alertMaterial = new BABYLON.StandardMaterial("alertMaterial", this.scene);
    this.alertMaterial.alpha = this.material.alpha;
    this.alertMaterial.diffuseColor = new BABYLON.Color3(.3, 0, 0);
    /** Callback on area minimized/maximized, passed a minimized/hidden flag */
    this.onMinMax = null;
  }
  /**
   * Creates manipulation handles. 
   * Left and right handle resize, and top and bottom move it, optional box disables/reenables everything.
   */
  show() {
    let handleWidth = this.height/25;
    this.leftHandle = BABYLON.MeshBuilder.CreateSphere("leftHandle",{segments:this.segments},this.scene);
    this.leftHandle.scaling = new BABYLON.Vector3(handleWidth,this.height,handleWidth);
    this.leftHandle.position = new BABYLON.Vector3(-this.width/2-this.width/20, 0, 0);
    this.leftHandle.parent = this.group;
    this.leftHandle.material = this.material;
  
    this.rightHandle = BABYLON.MeshBuilder.CreateSphere("rightHandle",{segments:this.segments},this.scene);
    this.rightHandle.scaling = new BABYLON.Vector3(handleWidth,this.height,handleWidth);
    this.rightHandle.position = new BABYLON.Vector3(this.width/2+this.width/20, 0, 0);
    this.rightHandle.parent = this.group;
    this.rightHandle.material = this.material;
  
    this.topHandle = BABYLON.MeshBuilder.CreateSphere("topHandle",{segments:this.segments},this.scene);
    this.topHandle.scaling = new BABYLON.Vector3(this.height,handleWidth,handleWidth);
    this.topHandle.position = new BABYLON.Vector3(0, this.height/2+this.height/20, 0);
    this.topHandle.parent = this.group;
    this.topHandle.material = this.material;
  
    this.bottomHandle = BABYLON.MeshBuilder.CreateSphere("bottomHandle",{segments:this.segments},this.scene);
    this.bottomHandle.scaling = new BABYLON.Vector3(this.height,handleWidth,handleWidth);
    this.bottomHandle.position = new BABYLON.Vector3(0, -this.height/2-this.height/20, 0);
    this.bottomHandle.parent = this.group;
    this.bottomHandle.material = this.material;

    if ( this.canMinimize ) {
      //this.box = BABYLON.MeshBuilder.CreateBox("MinMaxBox",{size:1},this.scene);
      this.box = BABYLON.MeshBuilder.CreatePlane("MinMaxButon", {width:1,height:1}, this.scene);
      this.box.scaling = new BABYLON.Vector3(handleWidth,handleWidth,this.height/100);
      this.box.position = new BABYLON.Vector3(-this.width/2-this.width/20, -this.height/2-this.height/20, 0);
      this.box.parent = this.group;
      this.box.material = this.material.clone();
      this.box.material.diffuseTexture = new BABYLON.Texture(VRSPACEUI.contentBase+"/content/icons/minimize.png", this.scene);
      this.box.material.diffuseTexture.hasAlpha = true;
      this.box.material.emissiveColor = BABYLON.Color3.White();
    }

    this.bottomHandle.opposite = this.topHandle;
    this.topHandle.opposite = this.bottomHandle;
    this.leftHandle.opposite = this.rightHandle;
    this.rightHandle.opposite = this.leftHandle;
  
    this.handles = [ this.leftHandle, this.topHandle, this.rightHandle, this.bottomHandle ];

    this.resizeHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN ) {
        //if ( pointerInfo.pickInfo.hit && this.handles.includes(pointerInfo.pickInfo.pickedMesh) ) {
        if ( pointerInfo.pickInfo.hit ) {
          if (pointerInfo.pickInfo.pickedMesh == this.bottomHandle || pointerInfo.pickInfo.pickedMesh == this.topHandle) {
            // moving around
            if ( ! this.behavior ) {
              this.behavior = this.createBehavior();
              // does not work if group.parent is camera
              this.group.addBehavior(this.behavior);
              pointerInfo.pickInfo.pickedMesh.material = this.selectedMaterial;
              this.selectedHandle = pointerInfo.pickInfo.pickedMesh;
            }
          } else if (pointerInfo.pickInfo.pickedMesh == this.leftHandle || pointerInfo.pickInfo.pickedMesh == this.rightHandle) {
            // scaling
            if ( ! this.selectedHandle ) {
              this.selectedHandle = pointerInfo.pickInfo.pickedMesh;
              this.point = pointerInfo.pickInfo.pickedPoint;
              pointerInfo.pickInfo.pickedMesh.material = this.selectedMaterial;
            }
          } else if ( pointerInfo.pickInfo.pickedMesh == this.box ) {
            // minimizing/maximizing (hiding/showing)
            this.hide(!this.minimized);
          }
        } else if ( this.selectedHandle) {
          this.selectedHandle.material = this.material;
          this.selectedHandle = null;
          if ( this.behavior ) {
            this.group.removeBehavior(this.behavior);
            this.behavior = null;
          }
        }
      }
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERUP && this.selectedHandle) {
        if ( pointerInfo.pickInfo.hit && (pointerInfo.pickInfo.pickedMesh == this.leftHandle || pointerInfo.pickInfo.pickedMesh == this.rightHandle) ) {
          let diff = pointerInfo.pickInfo.pickedPoint.y - this.point.y;
          let scale = (this.height + diff)/this.height;
          this.group.scaling = this.group.scaling.scale(scale);
          if ( this.sizeCallback ) {
            this.sizeCallback(this.group.scaling);
          }
        }
        if ( this.selectedHandle ) {
          this.selectedHandle.material = this.material;
          this.selectedHandle = null;
          if ( this.behavior ) {
            this.group.removeBehavior(this.behavior);
            this.behavior = null;
            if ( this.positionCallback ) {
              this.positionCallback(this.group.position, this.group.rotationQuaternion.toEulerAngles());
              //this.positionCallback(this.group.position, this.group.rotationQuaternion);
            }
          }
        }
      }
    });
    
  }
  
  createBehavior() {
    if ( this.group.billboardMode == BABYLON.Mesh.BILLBOARDMODE_Y ) {
      return new BABYLON.PointerDragBehavior({ dragAxis: new BABYLON.Vector3(0, 1, 0) });
    }
    return new BABYLON.SixDofDragBehavior();
  }
  
  /**
   * Minimize or maximize (hide or show all children of this.group)
   * @param flag boolean indicating whether to hide or show children
   */
  hide(flag) {
    if ( this.canMinimize ) {
      //console.log("Hiding handles: "+flag);
      this.group.getChildMeshes().forEach( h => {
        if ( h !== this.box && !this.dontMinimize.includes(h)) {
          h.setEnabled(!flag);
        }
      });
      this.minimized = flag;
      if ( this.minimized ) {
        this.box.material.diffuseTexture = new BABYLON.Texture(VRSPACEUI.contentBase+"/content/icons/maximize.png", this.scene);
      } else {
        this.box.material.diffuseTexture = new BABYLON.Texture(VRSPACEUI.contentBase+"/content/icons/minimize.png", this.scene);
      }
      if ( this.onMinMax ) {
        this.onMinMax(this.minimized);
      }
    }
  }
  /**
   * Clean up
   */
  dispose() {
    this.scene.onPointerObservable.remove(this.resizeHandler);
    this.handles.forEach(h=>h.dispose());
    if ( this.box ) {
      this.box.dispose();
    }
    this.selectedMaterial.dispose();
    this.alertMaterial.dispose();
 } 
}