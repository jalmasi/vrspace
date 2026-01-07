import { VRSPACEUI, World, SharedScreencast, Skybox } from '../../../babylon/js/vrspace-min.js';

export class Conference extends World {
  constructor() {
    super();
    this.file = null;
    this.worldObjects = {
      "scene.gltf":{
        instances:[
          {
            //scale:{x:0.3,y:0.3,z:0.3}
          }
        ]
      }
    }
  }
  async createCamera() {
    //lecturer view
    this.camera = this.firstPersonCamera(new BABYLON.Vector3(-12, 5, -9));
    this.camera.setTarget(new BABYLON.Vector3(4,3,-4));
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
    return new Skybox(this.scene, VRSPACEUI.contentBase+"/content/skybox/babylon/TropicalSunnyDay").create();
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
  }
  
  isSelectableMesh(mesh) {
    // pPlane5_pantalla_0 - board
    // pCube30_blanco_0 - lecturer desk front
    // pCube78, pCube81 (transform), pCube78_puerta_0, pCube81_puerta_0 - doors
    return (this.screencast && this.screencast.screenShareMesh && mesh === this.screencast.screenShareMesh)||super.isSelectableMesh(mesh);
  }

  // executed once the world is loaded
  loaded(file, mesh) {
    
    this.floorMeshes = [
      this.ground
    ];
    
  }

  // executed once connected to the server and entered the space
  entered( welcome ) {
    super.entered( welcome );
    this.screencast = new SharedScreencast( this, 'speaker' );
    this.screencast.size = 7;
    this.screencast.position = new BABYLON.Vector3(5, 4, -3.5);
    this.screencast.rotation = new BABYLON.Vector3(0, Math.PI*.5, 0);
    this.screencast.screenShareMesh.position = new BABYLON.Vector3(3, 1, -3);
    this.screencast.screenShareMesh.rotation = new BABYLON.Vector3(0, Math.PI/2, 0);
    this.screencast.callback = (streaming) => this.screencasting(streaming);
    this.screencast.init();
  }

  screencasting(streaming) {
    let node = this.scene.getNodeById('ekran_289');
    if ( node ) {
      node.setEnabled(!streaming);
    }
  }
}

export const WORLD = new Conference();