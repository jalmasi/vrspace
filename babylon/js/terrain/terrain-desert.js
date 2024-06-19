import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Terrain } from './terrain.js';

/**
Dynamic terrain - desert
TODO refactor: generic randomized terrain
 */
export class Desert extends Terrain {
  constructor(world, terrainMaterial) {
    super(world, {material: terrainMaterial, xSize:200, zSize:200, visibility:100});
    this.checkCollisions = true;
    this.terrainObjects=[];
    this.seed = 0.3;                 // seed
    this.noiseScale = 0.03;         // noise frequency
    this.elevationScale = 1.0;
    noise.seed(this.seed);
  }

  createTerrain() {
    var world = this.world;
    
    world.indicator.add("../../plants/cactus_low_poly/");
    world.indicator.add("../../plants/cactus_1_downloadable/");
    world.indicator.add("../../plants/palm_tree/");
    world.indicator.add("../../plants/bush/");
    world.indicator.add("../../plants/hand_painted_bush/");

    VRSPACEUI.loadScriptsToDocument([ 
      VRSPACEUI.contentBase+"/babylon/js/lib/perlin.js",
      "https://cdn.rawgit.com/BabylonJS/Extensions/master/DynamicTerrain/dist/babylon.dynamicTerrain.min.js"
    ]).then(() => {

      // load all meshes and create terrain
      Promise.all([
          world.loadAsset("../../plants/cactus_low_poly/", "scene.gltf").then((container) => {
              var mesh = container.meshes[container.meshes.length-1];
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.RotationX(-Math.PI/2));
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.Scaling(.2,.2,.2));
              this.terrainObjects.push( mesh );
              world.indicator.remove("../../plants/cactus_low_poly/");
          })
          ,
          world.loadAsset("../../plants/cactus_1_downloadable/", "scene.gltf").then((container) => {
              var mesh = container.meshes[container.meshes.length-1];
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.RotationX(-Math.PI/2));
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.Scaling(.5,.5,.5));
              this.terrainObjects.push( mesh );
              world.indicator.remove("../../plants/cactus_1_downloadable/");
          })
          ,
          world.loadAsset("../../plants/palm_tree/", "palm.glb").then((container) => {
              var mesh = container.meshes[container.meshes.length-1];
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.Scaling(.001,.001,.001));
              container.materials[0].needDepthPrePass = true;
              this.terrainObjects.push( mesh );
              world.indicator.remove("../../plants/palm_tree/");
          })
          ,
          world.loadAsset("../../plants/bush/", "scene.gltf").then((container) => {
              var mesh = container.meshes[container.meshes.length-1];
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0,2,0));
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.RotationX(-Math.PI/2));
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.Scaling(.3,.3,.3));
              this.terrainObjects.push( mesh );
              world.indicator.remove("../../plants/bush/");
          })
          ,
          world.loadAsset("../../plants/hand_painted_bush/", "scene.gltf").then((container) => {
              var mesh = container.meshes[container.meshes.length-1];
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.RotationX(-Math.PI/2));
              this.terrainObjects.push( mesh );
              world.indicator.remove("../../plants/hand_painted_bush/");
          })
          /* too large model, 25k vertices
          ,
          world.loadAsset("../../plants/cactus_2_downloadable/", "scene.gltf", world.scene).then((container) => {
              //var mesh = container.createRootMesh();
              var mesh = container.meshes[container.meshes.length-1];
              mesh.scaling = new BABYLON.Vector3(.2,.2,.2);
              this.terrainObjects.push( mesh );
              container.addAllToScene();
          })
          ,
          world.loadAsset("../../plants/phoenix_palm_cities_skylines/", "scene.gltf", world.scene).then((container) => {
              var mesh = container.createRootMesh();
              mesh.scaling = new BABYLON.Vector3(.01,.01,.01);
              this.terrainObjects.push( mesh );
              container.addAllToScene();
          })
          */
      ]).then(() => {
        console.log("creating terrain");
        // SPMap with N object types
        this.spsMapData = [];
        for ( var i = 0; i < this.terrainObjects.length; i++ ) {
          this.spsMapData.push([]);
        }
        this.init(this.world.scene);
      });
      
    });

  }
  
  gridHeight(x,z, index, col, row) {
    var y = noise.simplex2(x * this.noiseScale, z * this.noiseScale);               // altitude
    y *= (0.5 + y) * y * this.elevationScale;
    
    // FIXME ugly way to build sps map data - implicit, should be explicit
    if (Math.random() > 0.998) {
      let xp = x;
      let yp = y;
      let zp = z;
  
      let ry = Math.random() * 3.6;
      //let sx = 0.75 + Math.random()/2;
      let sx = 1;
      let sy = 0.75 + Math.random()/2;
      //let sz = 0.75 + Math.random()/2;
      let sz = 1;
  
      let type = index % this.terrainObjects.length;
      this.spsMapData[index % this.terrainObjects.length].push(xp, yp, zp, 0, ry, 0, sx, sy, sz);
    }
    
    return y;
  }

  buildSPS() {
   this.sps = new BABYLON.SolidParticleSystem("sps", this.world.scene, {useModelMaterial: true});
   for ( var i = 0; i < this.terrainObjects.length; i++ ) {
     this.sps.addShape(this.terrainObjects[i], 100);
   }
   this.sps.buildMesh();
   this.params.SPmapData = this.spsMapData;
   this.params.sps = this.sps;
  }
}