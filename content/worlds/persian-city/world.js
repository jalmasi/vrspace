import { World } from '../../../babylon/vrspace-ui.js';

var terrain;
var sps; // solid particle system
var terrainObjects=[];

var url = "https://cdn.rawgit.com/BabylonJS/Extensions/master/DynamicTerrain/dist/babylon.dynamicTerrain.min.js";
var terrainScript = document.createElement("script");
terrainScript.src = url;
document.head.appendChild(terrainScript);

export class PersianCity extends World {
  async createScene(engine) {
    // Create the scene space
    var scene = new BABYLON.Scene(engine);
    scene.gravity = new BABYLON.Vector3(0, -9.81, 0);
    scene.collisionsEnabled = true;

    //Ground
    this.ground = BABYLON.Mesh.CreatePlane("ground", 10000.0, scene);
    this.ground.material = new BABYLON.StandardMaterial("groundMat", scene);
    this.ground.material.diffuseColor = new BABYLON.Color3(.5, 1, .5);
    this.ground.material.backFaceCulling = false;
    this.ground.material.alpha = 0;
    this.ground.position = new BABYLON.Vector3(-40, 0.4, -20);
    this.ground.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    this.ground.checkCollisions = true;

    this.terrainMaterial = new BABYLON.StandardMaterial("terrainMaterial", scene)
    var terrainTexture = new BABYLON.Texture(this.assetPath("textures/LoamWalls0012_2_S_1_1_baseColor.jpeg"), scene);
    this.terrainMaterial.ambientTexture = terrainTexture;
    this.terrainMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    terrainTexture.uScale = 4.0;
    terrainTexture.vScale = terrainTexture.uScale;

    // box to fix ground texture flickering
    var box = BABYLON.MeshBuilder.CreateBox("fixBox", {width:1000, depth:1000,height:.10}, scene); // default box
    box.position = new BABYLON.Vector3(-40,0,-20);
    box.material = this.terrainMaterial;
    box.checkCollisions = true;

    // Add a camera to the scene and attach it to the canvas
    this.camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(60, 23, -54), scene);
    this.camera.maxZ = 100000;
    this.camera.minZ = 0;
    this.camera.setTarget(new BABYLON.Vector3(-50,-10,-50));
    this.camera.attachControl(canvas, true);
    this.camera.applyGravity = true;
    this.camera.speed = 0.5;
    //Set the ellipsoid around the camera (e.g. your player's size)
    this.camera.ellipsoid = new BABYLON.Vector3(.5, 1, .5);
    this.camera.checkCollisions = true;

    // Add lights to the scene
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(-1, -1, 0), scene);
    light.intensity = 2;
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), scene);

    var skybox = BABYLON.Mesh.CreateBox("skyBox", 10000, scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(this.assetPath("../../skybox/hw_sahara/sahara"), scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

    return scene;

  }

  isSelectableMesh(mesh) {
    return mesh.name == "ground";
  }
  
  getFloorMeshes() {
    return [ this.ground ];
  }

  collisions(state) {
    if ( this.sceneMeshes ) {
      console.log("collisions: "+state);
      for ( var i=0; i<this.sceneMeshes.length; i++ ) {
        if ( this.sceneMeshes[i].material &&
          ( this.sceneMeshes[i].material.id.startsWith("LoamWalls") || this.sceneMeshes[i].material.id.startsWith("Brick") )) {
          this.sceneMeshes[i].checkCollisions = state;
        }
      }
    }
    //terrain.mesh.checkCollisions = state;
    //ground.checkCollisions = state;
  }

  loaded( file, mesh ) {
    console.log('Loaded '+file);
    mesh.scaling = new BABYLON.Vector3(0.05,0.05,0.05);
    mesh.position.y = .2;
    // TODO FIXME: remove this node from the model
    this.scene.getNodeByID('node4').setEnabled(false);
  }
  
  registerRenderLoop() {
    // Register a render loop to repeatedly render the scene
    var camera = this.camera;
    this.engine.runRenderLoop(() => {
      if ( terrain && terrain.mesh ) {
        //if ( vrHelper.currentVRCamera.position.x > -150 && vrHelper.currentVRCamera.position.x < 150 && vrHelper.currentVRCamera.position.z >= -150 && vrHelper.currentVRCamera.position.z <= 150 ) {
        //if ( camera.position.x > -150 && camera.position.x < 150 && camera.position.z >= -150 && camera.position.z <= 150 ) {
        if ( camera.globalPosition.x > -150 && camera.globalPosition.x < 150 && camera.globalPosition.z >= -150 && camera.globalPosition.z <= 150 ) {
          terrain.mesh.setEnabled(false);
          sps.mesh.setEnabled(false);
        } else {
          terrain.mesh.setEnabled(true);
          sps.mesh.setEnabled(true);
        }
      }
      this.scene.render();
    });
  }
  
  createTerrain() {
    var world = this;
    
    world.indicator.add("../../plants/cactus_low_poly/");
    world.indicator.add("../../plants/cactus_1_downloadable/");
    world.indicator.add("../../plants/palm_tree/");
    world.indicator.add("../../plants/bush/");
    world.indicator.add("../../plants/hand_painted_bush/");
    
  // wait for dynamic terrain extension to be loaded
    terrainScript.onload = () => {
      // load all meshes and create terrain
      Promise.all([
          this.loadAsset("../../plants/cactus_low_poly/", "scene.gltf", this.scene).then(function (container) {
              var mesh = container.meshes[container.meshes.length-1];
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.RotationX(-Math.PI/2));
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.Scaling(.2,.2,.2));
              terrainObjects.push( mesh );
              world.indicator.remove("../../plants/cactus_low_poly/");
          })
          ,
          this.loadAsset("../../plants/cactus_1_downloadable/", "scene.gltf", this.scene).then( function (container) {
              var mesh = container.meshes[container.meshes.length-1];
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.RotationX(-Math.PI/2));
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.Scaling(.5,.5,.5));
              terrainObjects.push( mesh );
              world.indicator.remove("../../plants/cactus_1_downloadable/");
          })
          ,
          this.loadAsset("../../plants/palm_tree/", "palm.glb", this.scene).then(function (container) {
              var mesh = container.meshes[container.meshes.length-1];
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.Scaling(.001,.001,.001));
              container.materials[0].needDepthPrePass = true;
              terrainObjects.push( mesh );
              world.indicator.remove("../../plants/palm_tree/");
          })
          ,
          this.loadAsset("../../plants/bush/", "scene.gltf", this.scene).then(function (container) {
              var mesh = container.meshes[container.meshes.length-1];
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0,2,0));
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.RotationX(-Math.PI/2));
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.Scaling(.3,.3,.3));
              terrainObjects.push( mesh );
              world.indicator.remove("../../plants/bush/");
          })
          ,
          this.loadAsset("../../plants/hand_painted_bush/", "scene.gltf", this.scene).then(function (container) {
              var mesh = container.meshes[container.meshes.length-1];
              mesh = mesh.bakeTransformIntoVertices(BABYLON.Matrix.RotationX(-Math.PI/2));
              terrainObjects.push( mesh );
              world.indicator.remove("../../plants/hand_painted_bush/");
          })
          /* too large model, 25k vertices
          ,
          this.loadAsset("../../plants/cactus_2_downloadable/", "scene.gltf", this.scene).then(function (container) {
              //var mesh = container.createRootMesh();
              var mesh = container.meshes[container.meshes.length-1];
              mesh.scaling = new BABYLON.Vector3(.2,.2,.2);
              terrainObjects.push( mesh );
              container.addAllToScene();
          })
          ,
          this.loadAsset("../../plants/phoenix_palm_cities_skylines/", "scene.gltf", this.scene).then(function (container) {
              var mesh = container.createRootMesh();
              mesh.scaling = new BABYLON.Vector3(.01,.01,.01);
              terrainObjects.push( mesh );
              container.addAllToScene();
          })
          */
      ]).then(() => {
        console.log("creating terrain");
        world._createTerrain();
      });
    }
  }
  
  //this is only safe to call after all resources have been loaded:
  //terrain script and plant meshes
  _createTerrain() {
   // Objects
   var spsMaterial = new BABYLON.StandardMaterial("spsm", this.scene);
   var spsUrl = "https://jerome.bousquie.fr/BJS/images/uv_texture.jpg";
   var spsTexture = new BABYLON.Texture(spsUrl, this.scene);
   spsMaterial.diffuseTexture = spsTexture;
  
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
   for ( var i = 0; i < terrainObjects.length; i++ ) {
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
  
         let type = index % terrainObjects.length;
         SPmapData[index % terrainObjects.length].push(xp, yp, zp, 0, ry, 0, sx, sy, sz);
       }
  
       mapData[3 *(l * mapSubX + w)] = x;
       mapData[3 * (l * mapSubX + w) + 1] = y;
       mapData[3 * (l * mapSubX + w) + 2] = z;
  
     }
   }
  
   sps = new BABYLON.SolidParticleSystem("sps", this.scene, {useModelMaterial: true});
   //sps = new BABYLON.SolidParticleSystem("sps", this.scene, {enableMultiMaterial:  true, updatable: false});
   for ( var i = 0; i < terrainObjects.length; i++ ) {
     sps.addShape(terrainObjects[i], 100);
   }
   sps.buildMesh();
  
   // Dynamic Terrain
   // ===============
   var terrainSub = 100;             // 100 terrain subdivisions
   var params = {
     mapData: mapData,               // data map declaration : what data to use ?
     mapSubX: mapSubX,               // how are these data stored by rows and columns
     mapSubZ: mapSubZ,
     terrainSub: terrainSub,         // how many terrain subdivisions wanted
     SPmapData: SPmapData,           // Object map
     sps: sps
   }
   terrain = new BABYLON.DynamicTerrain("terrain", params, this.scene);
   //var terrainMaterial = new BABYLON.StandardMaterial("tm", this.scene);
   //terrainMaterial.diffuseTexture = terrainTexture;
   terrain.mesh.material = this.terrainMaterial;
   // https://www.html5gamedevs.com/topic/35066-babylonjs-dynamic-terrain-collision-fps-issue/
   //the most efficient way to check collisions with a dynamic terrain or any BJS Ground objects
   // (although they aren't the same) keeps to use the methods
   // getHeightAtCoordinates(x, z) and getNormalAtCoordinates(x, z)
   // or getHeithFromMap(x, z) and getNormalFromMap(x, z)
   // depending on the object class
   terrain.mesh.checkCollisions = true;
  
   terrain.update(true);
  } // end terrain onload
  
  
}

export const WORLD = new PersianCity();