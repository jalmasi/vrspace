import { World } from '../../world/world.js';

/**
 * Helper component that displays the grid on y=0 plane.
 * GridMaterial: https://doc.babylonjs.com/toolsAndResources/assetLibraries/materialsLibrary/gridMat/ 
 */
export class GroundGrid {
  /**
   * @param {World} world 
   */
  constructor(world) {
    /** @type {World} */
    this.world = world;
    this.scene = world.scene;
    this.active = false;
    this.ground = null;
    this.originalGround = null;
  }
  
  /**
   * Show the grid
   * @returns ground mesh
   */
  show() {
    if ( this.active ) {
      return;
    }
    this.active = true;
    this.ground = BABYLON.MeshBuilder.CreateDisc("groundGrid", {radius:1000}, this.scene);
    this.ground.rotation = new BABYLON.Vector3( Math.PI/2, 0, 0 );
    this.ground.position = new BABYLON.Vector3( 0, -0.05, 0 );
    //this.ground.isVisible = false;
    this.ground.checkCollisions = false;
    
    // handy material
    this.ground.material = new BABYLON.GridMaterial("groundMaterial", this.scene);
    this.ground.material.opacity = 0.999;
    this.ground.material.backFaceCulling = false;
    this.ground.material.alphaMode = BABYLON.Constants.ALPHA_PREMULTIPLIED;
    //this.ground.material.alphaMode = BABYLON.Constants.ALPHA_ONEONE; // also fine
    return this.ground;
  }

  /**
   * Hide the grid, disposes of the mesh
   */  
  hide() {
    if ( !this.active ) {
      return;
    }
    this.active = false;
    this.ground.dispose();
    this.ground = null;
    this.originalGround = null;
  }

  /**
   * Replace world ground with the created grid. Shows the grid if not shown already.
   */
  replace() {
    if ( this.originalGround ) {
      return;
    }
    this.originalGround = this.world.ground;
    if ( !this.active ) {
      this.show();
    }
    this.world.ground = this.ground;
  }

  /**
   * Restores the original world ground, and closes the grid.
   */  
  restore() {
    if ( !this.active ) {
      return;
    }
    this.world.ground = this.originalGround;
    this.hide();
  }
}