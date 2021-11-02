import { World, OpenViduStreams } from './js/vrspace-min.js'

export class Dance extends World {
  async createScene(engine) {
    // Create the scene space
    this.scene = new BABYLON.Scene(engine);
    this.scene.gravity = new BABYLON.Vector3(0, -9.81, 0);

    // Add a camera to the scene and attach it to the canvas
    this.camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(0, 3, -10), this.scene);
    this.camera.maxZ = 100000;
    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.attachControl(canvas, true);
    this.camera.applyGravity = true;
    this.camera.ellipsoid = new BABYLON.Vector3(.5, 1.8, .5);
    this.scene.collisionsEnabled = true;
    this.camera.checkCollisions = true;

    // Add lights to the scene
    var light1 = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(1, 1, 0), this.scene);
    var light2 = new BABYLON.PointLight("light2", new BABYLON.Vector3(1, 3, -3), this.scene);

    var skybox = BABYLON.Mesh.CreateBox("skyBox", 100.0, this.scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("../content/skybox/mp_drakeq/drakeq", this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

    //Ground
    var ground = BABYLON.Mesh.CreatePlane("ground", 200.0, this.scene);
    ground.material = new BABYLON.StandardMaterial("groundMat", this.scene);
    ground.material.diffuseColor = new BABYLON.Color3(.5, 1, .5);
    ground.material.backFaceCulling = false;
    ground.material.alpha = 0.5;
    ground.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    ground.checkCollisions = true;
    ground.receiveShadows = true;

    return this.scene;
  }
  
  load( callback ) {
    BABYLON.SceneLoader.LoadAssetContainer("../content/char/female/lola_samba_dancing/", "scene.gltf", scene, (container) => {
        var meshes = container.meshes;
        var materials = container.materials;
        //...

        container.meshes[0].scaling = new BABYLON.Vector3(.02,.02,.02);
        // Adds all elements to the scene
        container.addAllToScene();

        // do something with the scene
        console.log("Character loaded");

        //doSoundStuff(container.meshes[0]);
        this.mesh = container.meshes[0];
        this.media = new OpenViduStreams(this.scene, 'videos');
        if ( callback ) {
          callback(this);
        }
    });
    
  }
  
  async connect(room, callback) {
    // CHECKME: chaining promisses?
    // example token: wss://localhost:4443?sessionId=test&token=tok_ZPbGnzp634FOl5pv&role=PUBLISHER&version=2.15.0
    await getToken(room).then(token => {
      // Connect with the token
      console.log('Token: '+token)
      return this.media.connect(token, callback);
    });
  }
  
}

var OPENVIDU_SERVER_URL = "https://" + location.hostname + ":4443";
var OPENVIDU_SERVER_SECRET = "MY_SECRET";

async function getToken(mySessionId) {
  return createSession(mySessionId).then(sId => createToken(sId));
}

function createSession(sId) { // See https://docs.openvidu.io/en/stable/reference-docs/REST-API/#post-apisessions
  return new Promise((resolve, reject) => {
    $.ajax({
      type: "POST",
      url: OPENVIDU_SERVER_URL + "/api/sessions",
      data: JSON.stringify({ customSessionId: sId }),
      headers: {
        "Authorization": "Basic " + btoa("OPENVIDUAPP:" + OPENVIDU_SERVER_SECRET),
        "Content-Type": "application/json"
      },
      success: response => resolve(response.id),
      error: (error) => {
        if (error.status === 409) {
          resolve(sId);
        } else {
          console.warn('No connection to OpenVidu Server. This may be a certificate error at ' + OPENVIDU_SERVER_URL);
          if (window.confirm('No connection to OpenVidu Server. This may be a certificate error at \"' + OPENVIDU_SERVER_URL + '\"\n\nClick OK to navigate and accept it. ' +
            'If no certificate warning is shown, then check that your OpenVidu Server is up and running at "' + OPENVIDU_SERVER_URL + '"')) {
            location.assign(OPENVIDU_SERVER_URL + '/accept-certificate');
          }
        }
      }
    });
  });
}

function createToken(sId) { // See https://docs.openvidu.io/en/stable/reference-docs/REST-API/#post-apitokens
  return new Promise((resolve, reject) => {
    $.ajax({
      type: "POST",
      url: OPENVIDU_SERVER_URL + "/api/tokens",
      data: JSON.stringify({ session: sId }),
      headers: {
        "Authorization": "Basic " + btoa("OPENVIDUAPP:" + OPENVIDU_SERVER_SECRET),
        "Content-Type": "application/json"
      },
      success: response => resolve(response.token),
      error: error => reject(error)
    });
  });
}

