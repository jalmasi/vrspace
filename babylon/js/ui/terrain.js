/**
Wrapper around babylonjs dynamic terrain.
See https://github.com/BabylonJS/Extensions/blob/b16eb03254c90438e8f6ea0ff5b3406f52035cd0/DynamicTerrain/src/babylon.dynamicTerrain.ts
 */
export class Terrain {
  constructor( world, params = {xSize:1000, zSize:1000, visibility:100, material:null }) {
    this.world = world;
    this.xSize = params.xSize;
    this.zSize = params.zSize;
    this.visibility = params.visibility;
    this.terrainMaterial = params.material;
    this.checkCollisions = true;
    this.enabled=true;
  }
  buildGrid() {
    this.mapData = new Float32Array(this.xSize * this.zSize * 3);
    for (var col = 0; col < this.zSize; col++) {
      for (var row = 0; row < this.xSize; row++) {
        var x = (row - this.xSize* 0.5) * 2.0;
        var z = (col - this.zSize* 0.5) * 2.0;
        let index = col * this.xSize + row;
        var y = this.gridHeight(x, z, index, col, row);
        this.mapData[3 *(col * this.xSize + row)] = x;
        this.mapData[3 * (col * this.xSize + row) + 1] = y;
        this.mapData[3 * (col * this.xSize + row) + 2] = z;
      }
    }

    this.params = { 
      mapSubX: this.xSize, 
      mapSubZ: this.zSize,
      mapData: this.mapData,
      terrainSub: this.visibility
    }
  }

  /** Height function used in constructor, intended to be overridden by subclasses
  @param x coordinate of current grid element
  @param y coordinate of current grid element
  @param index index of of current element in mapData array
  @param col current column
  @param row current row
  @returns 0
   */
  gridHeight(x,z,index,col,row) {
    return 0;
  }
  mesh() {
    if ( ! this.isCreated() ) {
      throw Error("Terrain has not been created yet");
    }
    return this.terrain.mesh;
  }
  init(scene) {
    this.scene = scene;
    this.buildGrid();
    this.buildSPS();
    this.terrain = new BABYLON.DynamicTerrain("terrain", this.params, this.scene);
    this.terrain.createUVMap();
    //this.terrain.LODLimits = [1, 2, 3, 4];
    //this.terrain.LODLimits = [10];
    this.terrain.mesh.material = this.terrainMaterial;
    // https://www.html5gamedevs.com/topic/35066-babylonjs-dynamic-terrain-collision-fps-issue/
    // the most efficient way to check collisions with a dynamic terrain or any BJS Ground objects
    // (although they aren't the same) keeps to use the methods
    // getHeightAtCoordinates(x, z) and getNormalAtCoordinates(x, z)
    // or getHeithFromMap(x, z) and getNormalFromMap(x, z)
    // depending on the object class
    this.terrain.mesh.checkCollisions = this.checkCollisions;

    this.terrain.update(true);
    this.scene.onActiveCameraChanged.add( () => {
      if ( this.scene.activeCamera ) {
        console.log("Terain tracking new camera: "+this.scene.activeCamera.getClassName());
        this.terrain.camera = this.scene.activeCamera;
      }
    });
    this.terrain.mesh.setEnabled(this.enabled);
    console.log('Terrain created');
  }
  
  setEnabled( flag ) {
    this.enabled = flag;
    this.terrain.mesh.setEnabled(flag && !this.world.inAR);
    if ( this.sps && this.sps.mesh ) {
      this.sps.mesh.setEnabled(flag && !this.world.inAR);
    }
  }
  
  /** Returns true if both this terrain and terrain mesh exist, i.e. safe to use */
  isCreated() {
    return this.terrain && this.terrain.mesh;
  }
  /** 
  Build Solid Particle System, e.g. trees and other objects seeded over the terrain.
  Called during initialization, before the terrain is created.
  This implementation does nothing.  
  */
  buildSPS() {
  }

  /** 
  Returns index in mapData containing point closest to given x,y. 
  Mapdata then contains x of the point on returned index, y at index+1 and z at index+2.
  */
  findIndex(x, z) {
    // mostly copied from DynamicTerrain source
    let mapSizeX = Math.abs(this.terrain.mapData[(this.xSize - 1) * 3] - this.terrain.mapData[0]);
    let mapSizeZ = Math.abs(this.terrain.mapData[(this.zSize - 1) * this.xSize* 3 + 2] - this.terrain.mapData[2]);
    
    let x0 = this.terrain.mapData[0];
    let z0 = this.terrain.mapData[2];

    // reset x and z in the map space so they are between 0 and the map size
    x = x - Math.floor((x - x0) / mapSizeX) * mapSizeX;
    z = z - Math.floor((z - z0) / mapSizeZ) * mapSizeZ;

    let col1 = Math.floor((x - x0) * this.xSize / mapSizeX);
    let row1 = Math.floor((z - z0) * this.zSize / mapSizeZ);
    //let col2 = (col1 + 1) % this.xSize;
    //let row2 = (row1 + 1) % this.zSize;

    // so idx is x, idx + 1 is y, +2 is z
    let idx = 3 * (row1 * this.xSize + col1);
    return idx;
  }
  /**
  Update a grid element at index to given coordinates.
   */
  update(index,x,y,z) {
    this.terrain.mapData[index]=x;
    this.terrain.mapData[index+1]=y;
    this.terrain.mapData[index+2]=z;
  }
  /**
  Set height at given coordinates
  @param x coordinate
  @param y coordinate
  @param height new height
  @param refresh default true, triggers terrain update and renders the change
   */
  setHeight(x,z,height,refresh=true) {
    var index = this.findIndex(x,z);
    this.terrain.mapData[index+1]=height;
    this.refresh(refresh);
    return index;
  }
  /**
  Set height at given coordinates
  @param x coordinate
  @param y coordinate
  @param height how much to raise
  @param refresh default true, triggers terrain update and renders the change
   */
  raise(x,z,height,refresh=true) {
    var index = this.findIndex(x,z);
    this.terrain.mapData[index+1]+=height;
    this.refresh(refresh);
    return index;
  }
  /**
  Set height at given coordinates
  @param x coordinate
  @param y coordinate
  @param depth how deep to dig
  @param refresh default true, triggers terrain update and renders the change
   */
  dig(x,z,depth,refresh=true) {
    return this.raise(x,z,-depth,refresh);
  }
  /** 
  Refresh (compute normals, update and render) the terrain.
  Normally terrain only updates when moving around, update needs to be forced after grid data (e.g. height) changes.
  @param force default true
   */
  refresh(force=true) {
    if (this.isCreated()) {
      this.terrain.computeNormals = force;
      this.terrain.update(force);
    } else {
      console.log('Terrain.update called before creation');
    }
  }
  point(index) {
    return { x: this.terrain.mapData[index], y: this.terrain.mapData[index+1], z: this.terrain.mapData[index+2]}
  }
}