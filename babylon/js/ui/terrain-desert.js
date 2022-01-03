import { VRSPACEUI } from './vrspace-ui.js';

export class Desert {
  constructor(world, terrainMaterial) {
    this.world = world;
    this.terrainMaterial = terrainMaterial;
    this.checkCollisions = true;
    this.terrainObjects=[];
  }

  enabled( flag ) {
    this.terrain.mesh.setEnabled(flag);
    this.sps.mesh.setEnabled(flag);
  }
  
  isCreated() {
    return this.terrain && this.terrain.mesh;
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
        this._createTerrain();
      });
      
    });

    
  }
  
  //this is only safe to call after all resources have been loaded:
  //terrain script and plant meshes
  _createTerrain() {
   // Map data creation
   // The map is a flat array of successive 3D coordinates (x, y, z).
   // It's defined by a number of points on its width : mapSubX
   // and a number of points on its height : mapSubZ
  
   var mapSubX = 200;             // point number on X axis
   var mapSubZ = 200;              // point number on Z axis
   var seed = 0.3;                 // seed
   var noiseScale = 0.03;         // noise frequency
   var elevationScale = 1.0;
   noise.seed(seed);
   var mapData = new Float32Array(mapSubX * mapSubZ * 3); // x3 float values per point : x, y and z
  
   // SPMap with 3 object types
   var SPmapData = [];
   for ( var i = 0; i < this.terrainObjects.length; i++ ) {
     SPmapData.push([]);
   }
  
   for (var l = 0; l < mapSubZ; l++) {
     for (var w = 0; w < mapSubX; w++) {
       var x = (w - mapSubX * 0.5) * 2.0;
       var z = (l - mapSubZ * 0.5) * 2.0;
       var y = noise.simplex2(x * noiseScale, z * noiseScale);               // altitude
       y *= (0.5 + y) * y * elevationScale;
       // objects of the map
       let index = l * mapSubX + w;
       // let's populate randomly
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
         SPmapData[index % this.terrainObjects.length].push(xp, yp, zp, 0, ry, 0, sx, sy, sz);
       }
  
       mapData[3 *(l * mapSubX + w)] = x;
       mapData[3 * (l * mapSubX + w) + 1] = y;
       mapData[3 * (l * mapSubX + w) + 2] = z;
  
     }
   }
  
   this.sps = new BABYLON.SolidParticleSystem("sps", this.world.scene, {useModelMaterial: true});
   for ( var i = 0; i < this.terrainObjects.length; i++ ) {
     this.sps.addShape(this.terrainObjects[i], 100);
   }
   this.sps.buildMesh();
  
   // Dynamic Terrain
   // ===============
   var terrainSub = 100;             // 100 terrain subdivisions
   var params = {
     mapData: mapData,               // data map declaration : what data to use ?
     mapSubX: mapSubX,               // how are these data stored by rows and columns
     mapSubZ: mapSubZ,
     terrainSub: terrainSub,         // how many terrain subdivisions wanted
     SPmapData: SPmapData,           // Object map
     sps: this.sps
   }
   this.terrain = new BABYLON.DynamicTerrain("terrain", params, this.world.scene);
   this.terrain.mesh.material = this.terrainMaterial;
   // https://www.html5gamedevs.com/topic/35066-babylonjs-dynamic-terrain-collision-fps-issue/
   // the most efficient way to check collisions with a dynamic terrain or any BJS Ground objects
   // (although they aren't the same) keeps to use the methods
   // getHeightAtCoordinates(x, z) and getNormalAtCoordinates(x, z)
   // or getHeithFromMap(x, z) and getNormalFromMap(x, z)
   // depending on the object class
   this.terrain.mesh.checkCollisions = this.checkCollisions;
  
   this.terrain.update(true);
   console.log('Terrain created');
  }
  update(force) {
    if (this.isCreated()) {
      this.terrain.update(force);
    } else {
      console.log('Terrain.update called before creation');
    }
  }
}