import { World, SharedScreencast } from '../../../babylon/js/vrspace-min.js';

export class Classroom extends World {
  constructor() {
    super();
    this.file = null;
    this.worldObjects = {
      "scene.gltf":{
        instances:[
          {
            scale:{x:0.3,y:0.3,z:0.3}
          }
        ]
      },
      "city/scene.gltf":{
        instances:[
          {
            scale:{x:200,y:200,z:200},
            position:{x:100,y:68.7,z:-350},
            rotation:{x:0,y:5.69,z:0}
          }
        ]
      }
    }
  }
  async createCamera() {
    //lecturer view
    //this.camera = this.universalCamera(new BABYLON.Vector3(0, 2, 0));
    //this.camera.setTarget(new BABYLON.Vector3(0,2,10));
    this.camera = this.firstPersonCamera(new BABYLON.Vector3(-6, 2, 16));
    this.camera.setTarget(new BABYLON.Vector3(0,2,0));
    this.camera.speed = .2;
    // collision debug
    //this.camera.onCollide = (mesh)=>console.log('collided with '+mesh.id);
    this.thirdPersonCamera();
    this.camera3p.radius = 0.5;    
    this.camera3p.upperRadiusLimit = 2;
    return this.camera;
  }
  async createLights() {
    var light = new BABYLON.DirectionalLight("light", new BABYLON.Vector3(-1, -1, 0), this.scene);
    light.intensity = 2;
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), this.scene);
    return light1;
  }
  async createSkyBox() {
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 10000, this.scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("https://www.babylonjs.com/assets/skybox/TropicalSunnyDay", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }
  
  createGround() {
    this.ground = BABYLON.MeshBuilder.CreateDisc("ground", {radius:100}, this.scene);
    this.ground.rotation = new BABYLON.Vector3( Math.PI/2, 0, 0 );
    this.ground.position = new BABYLON.Vector3( 0, -0.05, 0 );
    this.ground.parent = this.floorGroup;
    this.ground.isVisible = false;
    this.ground.checkCollisions = true;
    return this.ground;
  }
  
  async createPhysics() {
    this.scene.gravity = new BABYLON.Vector3(0,-.05,0);
    super.createPhysics();
    
    // walls mess with collision detection, easy to get stuck
    // so add two invisible planes just for collision detection
    var wall1 = BABYLON.MeshBuilder.CreatePlane('wall1', {width:18, height:3}, this.scene);
    wall1.position = new BABYLON.Vector3(7.8, 2, 9);
    wall1.rotation = new BABYLON.Vector3(0, Math.PI/2, 0);
    wall1.checkCollisions = true;
    wall1.visibility = 0;

    var wall2 = BABYLON.MeshBuilder.CreatePlane('wall2', {width:14, height:3}, this.scene);
    wall2.position = new BABYLON.Vector3(-7.8, 2, 9);
    wall2.rotation = new BABYLON.Vector3(0, -Math.PI/2, 0);
    wall2.checkCollisions = true;
    wall2.visibility = 0;
  }
  
  isSelectableMesh(mesh) {
    // pPlane5_pantalla_0 - board
    // pCube30_blanco_0 - lecturer desk front
    // pCube78, pCube81 (transform), pCube78_puerta_0, pCube81_puerta_0 - doors
    return this.screencast && this.screencast.screenShareMesh && mesh === this.screencast.screenShareMesh;
  }

  setMeshCollisions(mesh, state) {
    if (
      // doors: 
      mesh.name != 'pCube78_puerta_0' && mesh.name != 'pCube81_puerta_0'
      // fila1-fila6 = rows with tables and chairs
      // (actual meshes are named like pCubeSomething)
      && ! (
        mesh.parent &&
        mesh.parent.parent &&
        mesh.parent.parent.parent &&
        mesh.parent.parent.parent.name.startsWith('fila')
      ) 
    ) {
      mesh.checkCollisions = state;
    }
  }
  
  // executed once the world is loaded
  loaded(file, mesh) {
    
    this.floorMeshes = [
      this.scene.getMeshByID('pCube36_suelo_text_0'),
      this.scene.getMeshByID('pCube49_suelo_text_0'),
      this.scene.getMeshByID('pCube50_suelo_text_0'),
      this.scene.getMeshByID('pCube51_suelo_text_0'),
      this.ground
    ];
    
  }

  // executed once connected to the server and entered the space
  entered( welcome ) {
    super.entered( welcome );
    this.screencast = new SharedScreencast( this, 'teacher' );
    this.screencast.screenShareMesh.position = new BABYLON.Vector3(-0.04, 1, 1.2);
    this.screencast.screenShareMesh.rotation = new BABYLON.Vector3(0, Math.PI, 0);
    this.screencast.init();
  }

}

export const WORLD = new Classroom();