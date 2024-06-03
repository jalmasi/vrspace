import { World } from '../../../babylon/js/vrspace-min.js';

export class ServerWorld extends World {

  /**
  Make me a galaxy, see playground examples.
  Points: https://playground.babylonjs.com/#UI95UC#1660
  Spheres: https://playground.babylonjs.com/#GLZ1PX#1038
  Particles: https://playground.babylonjs.com/#0K3AQ2#2026
  */
  createGalaxy() {
    if (this.particleSystem) {
      this.particleSystem.dispose();
    }
    this.particleSystem = new BABYLON.ParticleSystem("particles", this.size, this.scene);

    let k = this.arms*1.2;

    this.particleSystem.emitRate = 1000000;
    this.particleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", this.scene);

    this.particleSystem.minSize = .5;
    this.particleSystem.maxSize = 2;

    var initialized = false;

    // override defaults to nothing
    this.particleSystem.startDirectionFunction = (emitPower, worldMatrix, directionToUpdate, particle, isLocal) => { };

    // set particle color and stop
    this.particleSystem.updateFunction = (particles) => {
      if (particles.length < this.size) {
        return;
      }
      if (initialized) {
        return;
      }
      initialized = true;
      particles.forEach(particle => {

        let radius = Math.sqrt(particle.position.x * particle.position.x + particle.position.z * particle.position.z)
        let distro = radius / this.maxRadius * Math.random();
        if (distro < .25) {
          // inner star - yellow/red
          let r = Math.random() / 2 + .5;
          let g = Math.random() / 2 + .5;
          let b = Math.random() / 2;
          if (g > r) {
            g = r; // no green stars
          }
          particle.color = new BABYLON.Color3(r, g, b);
        } else {
          // outer star - white/blue
          let r = Math.random() / 2;
          let g = Math.random() / 2;
          let b = Math.random() / 2 + .5;
          if (g > r) {
            g = r; // no green stars
          }
          particle.color = new BABYLON.Color3(r, g, b);
        }


      });
      // and stop once done
      this.particleSystem.stop();
    };

    // slightly modified Euclydean spiral(s) 
    this.particleSystem.startPositionFunction = (worldMatrix, position, particle, isLocal) => {
      k += this.radiusIncrement;
      this.radius = this.angle * (k);
      let x = Math.cos(this.angle + (this.arm * 2 * Math.PI / this.arms)) * this.radius;
      let z = Math.sin(this.angle + (this.arm * 2 * Math.PI / this.arms)) * this.radius;
      let y = -3;

      x += BABYLON.Scalar.RandomRange(-this.range, this.range);
      y += BABYLON.Scalar.RandomRange(-this.range / 2, this.range / 2);
      z += BABYLON.Scalar.RandomRange(-this.range, this.range);;
      BABYLON.Vector3.TransformCoordinatesFromFloatsToRef(x, y, z, worldMatrix, position);

      this.angle += this.angleIncrement;
      let maxAngle = this.maxRings * 2 * Math.PI;
      if (this.angle > maxAngle) {
        // done with this arm, do another
        this.angle = 0;
        k = this.arms * 1.2;
        this.arm++;
        if (this.arm > this.arms) {
          // done with all arms, start over
          this.arm = 0;
          this.maxRadius = this.radius;
        }
      }

    };

    this.particleSystem.start();
  }

  async load(callback) {

    this.angle = 0;
    this.angleIncrement = .02;
    this.maxRings = 2;
    this.arms = 3;
    this.arm = 0;
    this.range = 8;
    this.radiusIncrement = .006;
    this.size = 20000;
    // more arms, more we spread them
    this.maxRadius = 0; // set later

    this.createGalaxy();

    // we're not loading any models, only ones sent by the server
    // now proceed with normal loading sequence
    if (callback) {
      callback(this);
    }
  }

  async createCamera() {
    // utility function to create UniversalCamera:
    this.camera = this.firstPersonCamera(new BABYLON.Vector3(0, 2, 0));
    this.camera.setTarget(new BABYLON.Vector3(2, 2, -10));
    this.camera.speed = .2;
    this.thirdPersonCamera();
    return this.camera;
  }

  async createGround() {
    this.ground = BABYLON.MeshBuilder.CreateDisc("ground", { radius: 100 }, this.scene);
    this.ground.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    this.ground.position = new BABYLON.Vector3(0, -0.05, 0);
    this.ground.parent = this.floorGroup;
    this.ground.isVisible = false;
    this.ground.checkCollisions = true;

    // handy material
    this.ground.material = new BABYLON.GridMaterial("groundMaterial", this.scene);
    this.ground.material.opacity = 0.95;
    this.ground.material.alphaMode = BABYLON.Constants.ALPHA_PREMULTIPLIED;
    return this.ground;
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
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(this.assetPath("../../skybox/spacescape/galaxy-background"), this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    return skybox;
  }

  async createPhysics() {
    // default Earth gravity is too high, set your own here
    this.scene.gravity = new BABYLON.Vector3(0, -.05, 0);
    super.createPhysics();
  }

  loaded(file, mesh) {
    super.loaded(file, mesh);
  }

  // OPTIONAL, RECOMMENDED:
  // executed once connected to the server and entered the space
  entered(welcome) {
    super.entered(welcome);
    this.worldManager.debug = true;
    this.worldManager.VRSPACE.debug = true;
    console.log("CONNECTED as " + welcome.client.id, this.worldManager.VRSPACE.me);
    console.log("Welcome: ", welcome);
  }

}

export const WORLD = new ServerWorld();