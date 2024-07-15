import {VRSPACEUI} from '../vrspace-ui.js';

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
    // CHECKME: true - why and why not? Shadows!
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
    
    this.floorGroup.getChildMeshes().forEach(child=>{
      if (child.name && child.name.indexOf("-instance") > 0 && child.material.getClassName() == "PBRMaterial") {
        child.material.clearCoat.isEnabled = true;
        child.material.metalic = 0.4;
        child.material.roughness = 0.6;
      }
    });
    
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