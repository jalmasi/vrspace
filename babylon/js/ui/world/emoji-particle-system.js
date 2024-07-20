export class EmojiParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particleSystem = null;
    this.particleSource = null;
    this.particleSystem = null;
  }
  
  init(url, avatar, particleDirection=5){
    //this.dispose();
    if ( BABYLON.GPUParticleSystem.IsSupported ) {
      this.particleSystem = new BABYLON.GPUParticleSystem("Emojis", {capacity: 100}, this.scene);
    } else {
      this.particleSystem = new BABYLON.ParticleSystem("Emojis", 100, this.scene);
    }
    //this.particleSystem.disposeOnStop = true;
    this.particleSystem.particleTexture = new BABYLON.Texture(url, this.scene);

    // fixed position    
    //let pos = this.scene.activeCamera.position.add(this.scene.activeCamera.getForwardRay(1).direction.scale(2));
    //this.particleSystem.emitter = pos;
    // position bound to the camera
    if ( ! this.particleSource ) {
      this.particleSource = BABYLON.MeshBuilder.CreateSphere("particlePositon",{diameter: 0.1},this.scene);
      this.particleSource.isVisible = false;
    }
    if ( avatar ) {
      this.particleSource.parent = avatar.baseMesh();
      this.particleSource.position = avatar.topPositionRelative();
    } else {
      this.particleSource.parent = this.scene.activeCamera;
      this.particleSource.position = new BABYLON.Vector3(0,0,0.5);
    }      
    this.particleSystem.emitter = this.particleSource;

    this.particleSystem.color1 = new BABYLON.Color4(1, 1, 1, 1.0);
    this.particleSystem.color2 = new BABYLON.Color4(1, 1, 1, 1.0);
    this.particleSystem.colorDead = new BABYLON.Color4(0.1, 0.1, 0.1, .5);
    // these make particles not disappear:
    //this.particleSystem.addColorGradient(0, new BABYLON.Color4(.2, .2, .2, 0.2), new BABYLON.Color4(.5, .5, .5, .5));
    //this.particleSystem.addColorGradient(0.2, new BABYLON.Color4(1, 1, 1, 1), new BABYLON.Color4(1, 1, 1, 1));
    //this.particleSystem.addColorGradient(0.8, new BABYLON.Color4(1, 1, 1, 1), new BABYLON.Color4(1, 1, 1, 1));
    //this.particleSystem.addColorGradient(1, new BABYLON.Color4(.2, .2, .2, 0), new BABYLON.Color4(.5, .5, .5, 0));

    // either randomize the size or animate the size all the same
    //this.particleSystem.minSize = 0.01;
    //this.particleSystem.maxSize = 0.1;
    this.particleSystem.addSizeGradient(0, 0.05); //size at start of particle lifetime
    this.particleSystem.addSizeGradient(0.5, 0.5); //size at half lifetime
    this.particleSystem.addSizeGradient(1, 1); //size at end of particle lifetime

    // and they slow down over time
    this.particleSystem.addVelocityGradient(0, 5);
    this.particleSystem.addVelocityGradient(1, 1);

    this.particleSystem.minLifeTime = 0.5;
    this.particleSystem.maxLifeTime = 3;

    this.particleSystem.emitRate = 20;
    
    this.particleSystem.createDirectedSphereEmitter(0.5, new BABYLON.Vector3(-0.5, -0.5, particleDirection), new BABYLON.Vector3(0.5, 0.5, particleDirection));

    this.particleSystem.minEmitPower = 1;
    this.particleSystem.maxEmitPower = 5;
    this.particleSystem.updateSpeed = 0.005;
    this.particleSystem.gravity = new BABYLON.Vector3(0,2,0);
    
    this.particleSystem.onStoppedObservable.add( ()=> console.log("Emoji system stopped: "+url));
    this.particleSystem.onDisposeObservable.add( ()=> console.log("Emoji system disposed: "+url));
    
    return this;
  }

  start(){
    this.particleSystem.start();
  }
  
  stop() {
    if (this.particleSystem) {
      this.particleSystem.stop();
      let ps = this.particleSystem;
      this.particleSystem = null;
      setTimeout(() => ps.dispose(), ps.maxLifeTime*2000);
    }
  }
  
  dispose() {
    if (this.particleSystem) {
      this.particleSystem.dispose();
    }
    if ( this.particleSource ) {
      this.particleSource.dispose();
      this.particleSource = null;
    }
  }
}