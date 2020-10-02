import { World } from './vrspace-ui.js'

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
    this.baseUrl = 
    BABYLON.SceneLoader.LoadAssetContainer("../content/char/lola_samba_dancing/", "scene.gltf", scene, (container) => {
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
        //doSoundStuff();
        if ( callback ) {
          callback(this);
        }
    });
    
  }
}

export class MediaStreams {
  constructor(htmlElementName) {
    // CHECKME null check that element?
    import('./openvidu-browser-2.15.0.js').then( () => {
      this.OV = new OpenVidu();
      this.session = this.OV.initSession();
      this.session.on('streamCreated', (event) => {
        // id of this connection can be used to match the stream with the avatar
        console.log("New stream "+event.stream.connection.connectionId)
        console.log(event);
        this.subscriber = this.session.subscribe(event.stream, htmlElementName);
        this.subscriber.on('videoElementCreated', e => {
          console.log("Video element created:");
          console.log(e.element);
          e.element.muted = true; // mute altogether
        });
      });
    
      // On every new Stream destroyed...
      this.session.on('streamDestroyed', function (event) {
        // TODO remove from the scene
        console.log("Stream destroyed!")
        console.log(event);
      });
      
    });
  }
  
  async connect(room) {
    // CHECKME: chaining promisses?
    await getToken(room).then(token => {
      // Connect with the token
      return this.session.connect(token);
    });
  }

  // htmlElement is needed only for local feedback (testing)
  publish(htmlElementName) {
    this.publisher = this.OV.initPublisher(htmlElementName, {
      videoSource: false, // The source of video. If undefined default video input
      audioSource: undefined, // The source of audio. If undefined default audio input
      publishAudio: true   // Whether to start publishing with your audio unmuted or not
    });

    // this is only triggered if htmlElement is specified
    this.publisher.on('videoElementCreated', e => {
      console.log("Video element created:");
      console.log(e.element);
      e.element.muted = true; // mute altogether
    });

    // in test mode subscribe to remote stream that we're sending
    if ( htmlElementName ) {
      this.publisher.subscribeToRemote(); 
    }
    // publish own sound
    this.session.publish(this.publisher);
    // id of this connection can be used to match the stream with the avatar
    console.log("Publishing "+this.publisher.stream.connection.connectionId);
    console.log(this.publisher);
  }
  
  subscribe(mesh) {
    this.subscriber.on('streamPlaying', event => {
      console.log('remote stream playing');
      console.log(event);
      var mediaStream = event.target.stream.getMediaStream();
      // see details of
      // https://forum.babylonjs.com/t/sound-created-with-a-remote-webrtc-stream-track-does-not-seem-to-work/7047/6
      var voice = new BABYLON.Sound(
        "voice",
        mediaStream,
        scene, null, {
          loop: false,
          autoplay: true,
          spatialSound: true,
          streaming: true,
          distanceModel: "linear",
          maxDistance: 50, // default 100, used only when linear
          panningModel: "equalpower" // or "HRTF"
        });
      voice.attachToMesh(mesh);
      
      var ctx = voice._inputAudioNode.context;
      var gainNode = voice.getSoundGain();
      voice._streamingSource.connect(voice._soundPanner);
      voice._soundPanner.connect(gainNode);
      gainNode.connect(ctx.destination);
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

