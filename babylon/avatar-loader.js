import { VRSPACEUI, HumanoidAvatar } from './js/vrspace-min.js';
import { AvatarSelection } from './avatar-selection.js'

var selectButtons = [];
var avatars = [];

export class AvatarLoader extends AvatarSelection {
  constructor() {
    super();
    this.enableLogin = false;
  }
  createSelection() {
    this.manager = new BABYLON.GUI.GUI3DManager(scene);
    VRSPACEUI.debug = true;
    VRSPACEUI.listMatchingFiles( '../content/char/', (folders) => {
      var listed = 0;
      for ( var i = 0; i < folders.length; i++ ) {
        VRSPACEUI.listCharacters( folders[i].url(), (avatarDirs) => {
          avatars = avatars.concat(avatarDirs);
          if ( ++listed == folders.length ) {
            this.showWorld();
          }
        });
      }
    });
  }

  showWorld() {
    console.log("Avatars available: "+avatars.length);
    var circumference = 2*avatars.length; // 2m for each avatar
    var radius = circumference/Math.PI/2;
    var angleIncrement = 2*Math.PI/avatars.length;
    var angle = 0;
    this.room.setDiameter(2.2*radius);
    for ( var i=0; i < avatars.length; i++ ) {
      var x = Math.sin(angle)*radius;
      var z = Math.cos(angle)*radius;
      var pos = new BABYLON.Vector3(x,0,z);
      this.loadAvatar( avatars[i], pos, angle, this.indicator, (avatar) => this.createAvatarUI(avatar,this.manager) );
      angle += angleIncrement;
    }
  }
  
  loadAvatar( dir, pos, angle, indicator, callback ) {
    var avatar = new HumanoidAvatar(scene, dir);
    indicator.add(avatar);
    avatar.particles = this.startParticles(avatar.folder.name, pos);

    avatar.load( (avatar) => {
        this.character = avatar;
        if ( avatar.particles ) {
          avatar.particles.emitter.dispose();
          avatar.particles.dispose();
          delete( avatar.particles );
        }
        indicator.remove(avatar);

        avatar.setPosition(pos);
        // CHECKME GLTF characters are facing the user when loaded
        avatar.setRotation( new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,angle));

        if ( callback ) {
          callback( avatar );
        }

    },
    (evt) => { indicator.progress( evt, avatar ) }
    );
  }
  
  createAvatarUI(avatar, manager) {

    var pos = avatar.parentMesh.position;
    var rot = avatar.parentMesh.rotationQuaternion;

    var text = new BABYLON.GUI.TextBlock();
    text.text = "Avatar: "+avatar.folder.name;
    if ( avatar.info ) {
      text.text +=
      '\n\nTitle: '+avatar.info.title+
      '\n\nAuthor: '+avatar.info.author.replace('(','\n(')+
      '\n\nLicense: '+avatar.info.license.replace('(','\n(')
      //+'\nSource:\n'+avatar.info.source; // too long
      ;
    }
    text.color = "white";
    text.fontSize = 24;
    //text.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    text.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;

    var selectButton = new BABYLON.GUI.HolographicButton("select:"+avatar.folder.name);
    selectButton.imageUrl = this.contentBase+"/content/icons/zoom.png";
    //selectButton.contentResolution = 1024;
    selectButton.contentScaleRatio = 4;
    selectButton.onPointerDownObservable.add( function() {
        console.log( "Selected "+avatar.folder.name );
        selectButton.imageUrl = this.contentBase+"/content/icons/back.png";
        if ( avatar.caption ) {
          avatar.caption.dispose();
          avatar.caption = null;
        }
        avatar.castShadows(this.shadowGenerator);
        for ( var i = 0; i < selectButtons.length; i++ ) {
          if ( selectButtons[i] != selectButton ) {
            selectButtons[i].isVisible = false;
          }
        }
    });
    selectButton.onPointerEnterObservable.add( function () {
        if ( ! avatar.caption ) {
          var group = new BABYLON.TransformNode();
          group.position = new BABYLON.Vector3( pos.x*0.9,1,pos.z*0.9 );
          //group.rotationQuaternion = new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,angle);
          group.rotationQuaternion = rot;

          var titlePlane = BABYLON.MeshBuilder.CreatePlane("Text"+avatar.folder.name, {height:1.5,width:6}, scene);
          titlePlane.parent = group;

          var titleTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
            titlePlane,
            1024,
            256,
            false // mouse events disabled
          );
          titleTexture.addControl(text);
          avatar.caption = group;
        }
    });
    selectButton.onPointerOutObservable.add( function () {
        if ( avatar.caption ) {
          avatar.caption.dispose();
          avatar.caption = null;
        }
    });

    manager.addControl(selectButton);
    // all of these must be set after control is added to manager
    // transform node does not exist earlier
    selectButton.position = new BABYLON.Vector3( pos.x*0.9,0.2,pos.z*0.9 );
    //selectButton.scaling = new BABYLON.Vector3( 1.5,1.5,1.5 );
    selectButton.scaling = new BABYLON.Vector3( .2, .2, .2 );
    //selectButton.node.rotationQuaternion =  new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,angle);
    selectButton.node.rotationQuaternion = rot;

    selectButtons.push(selectButton);
  }

  startParticles( dir, pos ) {
    var particleSystem;

    if (false && BABYLON.GPUParticleSystem.IsSupported) {
      // does not work in XR, renders only in one eye
      particleSystem = new BABYLON.GPUParticleSystem("particles:"+dir, { capacity:100 }, scene);
      particleSystem.activeParticleCount = 100;
    } else {
      particleSystem = new BABYLON.ParticleSystem("particles:"+dir, 100, scene);
    }

    particleSystem.worldOffset = pos;
    particleSystem.color1 = this.randomColor();
    particleSystem.color2 = this.randomColor();
    particleSystem.colorDead = new BABYLON.Color4(particleSystem.color2.r/10,particleSystem.color2.g/10,particleSystem.color2.b/10,0);
    particleSystem.emitRate = 10;
    particleSystem.particleEmitterType = new BABYLON.SphereParticleEmitter(0.5);
    particleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com//textures/flare.png", scene); // FIXME: cdn
    particleSystem.gravity = new BABYLON.Vector3(0, 2, 0);
    particleSystem.minLifeTime = 0.5;
    particleSystem.maxLifeTime = 3;
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.2;
    particleSystem.minEmitPower = 0.1;
    particleSystem.maxEmitPower = 0.3;
    var fountain = BABYLON.Mesh.CreateBox("foutain", 0.1, scene);
    fountain.visibility = 0;
    particleSystem.emitter = fountain;

    particleSystem.start();
    return particleSystem;
  }

  randomColor() {
    return new BABYLON.Color4(Math.random(), Math.random, Math.random(), Math.random()/5+0.8);
  }


}

export const WORLD = new AvatarLoader();