/**
Wrapper around babylonjs dynamic terrain.
See https://github.com/BabylonJS/Extensions/blob/b16eb03254c90438e8f6ea0ff5b3406f52035cd0/DynamicTerrain/src/babylon.dynamicTerrain.ts
 */
export class Terrain {
  constructor( xSize = 1000, zSize = 1000, visibility = 100 ) {
    this.xSize = xSize;
    this.zSize = zSize;
    this.visibility = visibility;
    this.mapData = new Float32Array(this.xSize * this.zSize * 3);
    for (var col = 0; col < this.zSize; col++) {
      for (var row = 0; row < this.xSize; row++) {
        var x = (row - this.xSize* 0.5) * 2.0;
        var z = (col - this.zSize* 0.5) * 2.0;
        var y = this.gridHeight(x,z);
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
  gridHeight(x,z) {
    return 0;
  }
  mesh() {
    return this.terrain.mesh;
  }
  init(scene) {
    this.scene = scene;
    this.terrain = new BABYLON.DynamicTerrain("terrain", this.params, this.scene);
    this.terrain.createUVMap();
    //this.terrain.LODLimits = [1, 2, 3, 4];
    this.terrain.LODLimits = [10];
    this.terrain.mesh.material = this.terrainMaterial;
    this.terrain.mesh.checkCollisions = this.checkCollisions;

    this.terrain.update(true);    
  }
  /** 
  Returns index in mapData containing point closest to given x,y. 
  Mapdata then contains x of the point on returned index, y at index+1 and z at index+2.
  */
  findIndex(x, z) {
    // mostly copied from DynamicTerrain source
    let mapSizeX = Math.abs(this.mapData[(this.xSize - 1) * 3] - this.mapData[0]);
    let mapSizeZ = Math.abs(this.mapData[(this.zSize - 1) * this.xSize* 3 + 2] - this.mapData[2]);
    
    let x0 = this.mapData[0];
    let z0 = this.mapData[2];

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
  setHeight(x,z,height,refresh=true) {
    var index = this.findIndex(x,z);
    this.terrain.mapData[index+1]=height;
    this.refresh(refresh);
  }
  raise(x,z,height,refresh=true) {
    var index = this.findIndex(x,z);
    this.terrain.mapData[index+1]+=height;
    this.refresh(refresh);
  }
  dig(x,z,depth,refresh=true) {
    this.raise(x,z,-depth,refresh);
  }
  refresh(force=true) {
    this.terrain.computeNormals = force;
    this.terrain.update(force);
    //this.terrain.computeNormals = false;
  }
}