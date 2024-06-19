import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Avatar } from './avatar.js';

/**
GLTF 3D Avatar.
Once GLTF file is loaded, skeleton is inspected for existing arms, legs and head that can be animated.
Animation groups are also inspected and optionally modified.
Optional fixes can be applied to an avatar, typically position of an avatar, or changing the animation.
 */
export class HumanoidAvatar extends Avatar {
  /**
  @param scene
  @param folder ServerFolder with the content
  @param shadowGenerator optional to cast shadows
   */
  constructor(scene, folder, shadowGenerator) {
    // parameters
    super(scene);
    this.humanoid = true;
    /** ServerFolder with content path */
    this.folder = folder;
    /** File name, default scene.gltf */
    this.file = folder.file?folder.file:"scene.gltf";
    /** Optional ShadowGenerator */
    this.shadowGenerator = shadowGenerator;
    /** Optional custom animations */
    this.animations = null;
    /** Animation frames per second, default 10 */
    this.fps = 10;
    /** Height of the ground, default 0 */
    this.groundHeight = 0;
    /** Object containing fixes */
    this.fixes = null;
    /** Wheter to generate animations for arms, legs and body (crouch/jump) movement, default true */
    this.generateAnimations = true;
    /** Return to rest after cloning, default true (otherwise keeps the pose)*/
    this.returnToRest = true;
    /** GLTF characters are facing the user when loaded, turn it around, default false. 
     * Does not apply to cloned characters, only to the first one actually loaded.*/
    this.turnAround = false;
    /** Object containing author, license, source, title */
    this.info = null;
    // state variables
    /** Once the avatar is loaded an processed, body contains body parts, e.g. body.leftArm, body.rightLeg, body.neck */
    this.body = {};
    /** Contains the skeleton once the avatar is loaded and processed */
    this.skeleton = null;
    /** Parent mesh of the avatar, used for movement and attachment */
    this.parentMesh = null;
    /** Original root mesh of the avatar, used to scale the avatar */
    this.rootMesh = null;
    this.bonesTotal = 0;
    this.bonesProcessed = [];
    this.bonesDepth = 0;
    this.character = null;
    this.activeAnimation = null;
    /** fetch API cache control - use no-cache in development */
    this.cache = 'default';
    //this.cache = 'no-cache';

    /** Debug output, default false */
    this.debug = false;
    this.debugViewer1;
    this.debugViewer2;
  }

  createBody() {
    this.bonesTotal = 0;
    this.bonesProcessed = [];
    this.bonesDepth = 0;
    this.neckQuat = null;
    this.neckQuatInv = null;
    this.headQuat = null;
    this.headQuatInv = null;
    this.body = {
      processed: false,
      root: null,
      hips: null, // aka pelvis
      leftLeg: {
        type: 'leg',
        side: 'left',
        upper: null,
        lower: null,
        foot: [] // foot, toe, possibly more
      },
      rightLeg: {
        type: 'leg',
        side: 'right',
        upper: null,
        lower: null,
        foot: []
      },
      spine: [], // can have one or more segments
      // aka clavicle
      leftArm: {
        type: 'arm',
        side: 'left',
        frontAxis: null,
        sideAxis: null, // CHECKME: not used
        shoulder: null,
        upper: null,
        upperRot: null,
        lower: null,
        lowerRot: null,
        hand: null,
        handRot: null,
        pointerQuat: new BABYLON.Quaternion(),
        fingers: {
          thumb: [],
          index: [],
          middle: [],
          ring: [],
          pinky: []
        }
      },
      rightArm: {
        type: 'arm',
        side: 'right',
        frontAxis: null,
        sideAxis: null, // CHECKME: not used
        shoulder: null,
        upper: null,
        upperRot: null,
        lower: null,
        lowerRot: null,
        hand: null,
        handRot: null,
        pointerQuat: new BABYLON.Quaternion(),
        fingers: {
          thumb: [],
          index: [],
          middle: [],
          ring: [],
          pinky: []
        }
      },
      neck: null,
      head: null
    };
  };

  log( anything ) {
    if ( this.debug ) {
      console.log( anything );
    }
  }

  boneProcessed(bone) {
    if ( this.bonesProcessed.includes(bone.name) ) {
      this.log("Already processed bone "+bone.name);
    } else {
      this.bonesTotal++;
      this.bonesProcessed.push(bone.name);
      //this.log("Processed bone "+bone.name);
    }
  }

  /** Dispose of everything */
  dispose() {
    if ( this.character ) {
      VRSPACEUI.assetLoader.unloadAsset(this.getUrl(), this.instantiatedEntries);
      delete this.instantiatedEntries;
      this.character = null;
      //delete this.character.avatar;
      //this.character.dispose();
    }
    if ( this.debugViewer1 ) {
      this.debugViewer1.dispose();
    }
    if ( this.debugViewer2 ) {
      this.debugViewer2.dispose();
    }
    // TODO also dispose of materials and textures (asset container)
  }
  // CHECKME this is called only from avatar-selection dispose()
  hide() {
    if ( this.character && this.parentMesh ) {
      this.parentMesh.setEnabled(false);
      // CHECKME: turnAround for cloned character
      // has to be prepared for cloning
      this.rootMesh.rotationQuaternion = this.rootMesh.rotationQuaternion.multiply(BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,Math.PI));
    }
  }
  /** 
  Utility method, dispose of avatar and return this one.
  @param avatar optional avatar to dispose of
   */
  replace(avatar) {
    if (avatar) {
      avatar.dispose();
    }
    return this;
  }

  hasCustomAnimations() {
    // ReadyPlayerMe avatar:
    for ( var i = 0; this.animations && i < this.character.meshes.length; i++ ) {
      if ( this.character.meshes[i].name == 'Wolf3D_Avatar' ) {
        console.log('RPM avatar detected at '+i);
        return true;
      }
    }
    return false;
  }
  
  _processContainer( container, onSuccess ) {
      this.character = container;
      
      var meshes = container.meshes;
      this.rootMesh = meshes[0];
      
      if ( this.turnAround ) {
        // GLTF characters are facing the user when loaded, turn it around
        this.rootMesh.rotationQuaternion = this.rootMesh.rotationQuaternion.multiply(BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y,Math.PI));
      }

      if (container.animationGroups && container.animationGroups.length > 0) {
        container.animationGroups[0].stop();
        this.animationBlending();
      }

      var bbox = this.rootMesh.getHierarchyBoundingVectors();
      this.log("Bounding box:");
      this.log(bbox);
      var scale = this.userHeight/(bbox.max.y-bbox.min.y);
      this.log("Scaling: "+scale);
      this.rootMesh.scaling = new BABYLON.Vector3(scale,scale,scale);
      this.recompute();

      this.castShadows( this.shadowGenerator );

      // try to place feet on the ground
      // CHECKME is this really guaranteed to work in every time?
      bbox = this.rootMesh.getHierarchyBoundingVectors();
      this.groundLevel(-bbox.min.y);
      // CHECKME we may want to store the value in case we want to apply it again
      
      if ( ! this.name ) {
        this.name = this.folder.name;
      }
      this.parentMesh = container.createRootMesh();
      this.parentMesh.name = "AvatarRoot:"+this.name;
      this.parentMesh.rotationQuaternion = new BABYLON.Quaternion();
      
      // target of 3rd person camera
      this.headPosition = BABYLON.MeshBuilder.CreateSphere("head position", {diameter:0.1}, this.scene);
      this.headPosition.position = new BABYLON.Vector3(0,this.userHeight,0);
      this.headPosition.parent = this.parentMesh;
      this.headPosition.isVisible = false;

      if ( container.skeletons && container.skeletons.length > 0 ) {
        // CHECKME: should we process multiple skeletons?
        this.skeleton = container.skeletons[0];
        // hacking to get avatars working in babylon 5
        // https://doc.babylonjs.com/features/featuresDeepDive/mesh/bonesSkeletons#sharing-skeletons-between-skinned-meshes
        this.skinnedMesh = null;
        meshes.find(m=>{
          if ( m.skeleton = this.skeleton ) {
            if ( ! this.skinnedMesh ) {
              //console.log("Skinned mesh: "+m.name, m);
              this.skinnedMesh = m;
            }
          }
        });

        this.createBody();
        //this.log("bones: "+bonesTotal+" "+bonesProcessed);

        this.skeleton.computeAbsoluteTransforms();
        // different ways to enforce calculation:
        //this.skeleton.computeAbsoluteTransforms(true);
        //this.rootMesh.computeWorldMatrix(true);
        //this.scene.render();
        this.skeleton.name = this.folder.name;

        let bone0quat = this.skeleton.bones[0].getRotationQuaternion();
        let bone1quat = this.skeleton.bones[0].getChildren()[0].getRotationQuaternion();
        this.baseRotation = bone0quat.multiply(bone1quat);
        console.log( "Base rotation: "+bone0quat.toEulerAngles()+" "+bone1quat.toEulerAngles()+" "+this.baseRotation.toEulerAngles());

        this.processBones(this.skeleton.bones);
        this.log( "Base head position: "+this.headPos() );
        this.initialHeadPos = this.headPos();
        this.resize();

        //this.log(this.body);
        this.bonesProcessed.sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));

        this.calcLength(this.body.leftArm);
        this.calcLength(this.body.rightArm);
        this.calcLength(this.body.leftLeg);
        this.calcLength(this.body.rightLeg);
        this.extractInitialArmTransformation(this.body.leftArm);
        this.extractInitialArmTransformation(this.body.rightArm);
        this.extractInitialLegTransformation(this.body.leftLeg);
        this.extractInitialLegTransformation(this.body.rightLeg);
        
        this.body.processed = true;

        if ( this.debugViewier1 || this.debugViewer2 ) {
          this.scene.registerBeforeRender(() => {
              if (this.debugViewer1) {
                this.debugViewer1.update();
              }
              if (this.debugViewer2) {
                this.debugViewer2.update();
              }
          });
        }
      } else {
        console.log("NOT an avatar - no skeletons");
      }

      //this.postProcess();

      container.avatar = this;

      console.log("Avatar loaded: "+this.name);
      
      if ( this.hasCustomAnimations()) {
        // CHECKME: we may need to add these animations to AssetContainer animations list
        var animCnt = 0;
        var animationLoaded = () => {
          if ( ++animCnt == this.animations.length ) {
            console.log("All animations loaded");
            if ( onSuccess ) {
              onSuccess(this);
            }
          }
        }
        this.animations.forEach( a => this.loadAnimations(a, animationLoaded));
      } else if ( onSuccess ) {
        onSuccess(this);
      }
  }

  /**
  Apply fixes after loading/instantiation
   */
  postProcess() {
    if ( this.fixes ) {
      if ( typeof this.fixes.standing !== 'undefined' ) {
        // CHECKME not used since proper bounding box calculation
        // might be required in some special cases
        this.log( "Applying fixes for: "+this.folder.name+" standing: "+this.fixes.standing);
        this.groundLevel(this.fixes.standing);
        // CHECKME we may need to change textwriter position
      }
      this.disableNodes();
      if ( typeof this.fixes.autoPlay !== 'undefined' ) {
        // start playing the animation
        this.startAnimation(this.fixes.autoPlay);
      }
    }
    
  }
  /**
  Load fixes from json file in the same folder, with the same name, and suffix .fixes.
  Called from load().
   */
  async loadFixes() {
    this.log('Loading fixes from '+this.folder.relatedUrl());
    if ( this.folder.related ) {
      return fetch(this.folder.relatedUrl(), {cache: this.cache})
      .then(response => {
        if ( response.ok ) {
          response.json().then(json => {
            this.fixes = json;
            this.log( "Loaded fixes: " );
            this.log( json );
          });
        } else {
          console.log('Error loading fixes: ' + response.status);
        }
      });
    }
  }

  /**
  Disable nodes marked in fixes file
   */
  disableNodes() {
    if ( typeof this.fixes.nodesDisabled !== 'undefined' ) {
      this.enableNodes( this.fixes.nodesDisabled, false );
    }
  }
  
  /**
  Enable/disable given nodes
  @param nodeIds array of node identifiers
  @param enable true/false
   */
  enableNodes( nodeIds, enable ) {
    this.character.getNodes().forEach( node => {
      if ( nodeIds.includes(node.id)) {
        this.log("Node "+node.id+" enabled: "+enable);
        node.setEnabled(enable);
      }
    });
  }
  
  /** 
  Slice an animation group
  @param group AnimationGroup to slice
  @param startTime slice starting time
  @param endTime slice ending time
  @returns new AnimationGroup containing slice of original animations
  */
  sliceGroup( group, startTime, endTime ) {
    let newGroup = new BABYLON.AnimationGroup(group.name+":"+startTime+"-"+endTime);
    let duration = group.getLength();
    for ( let i = 0; i < group.targetedAnimations.length; i++ ) {
      let animation = group.targetedAnimations[i].animation;
      let keys = animation.getKeys();
      if ( keys.length > 0 ) {
        let first = keys[0].frame;
        let last = keys[keys.length-1].frame;
        let fps = (last-first)/duration
        let start = startTime*fps;
        let end = endTime*fps;
        let slice = this.sliceAnimation( animation, start, end );
        if ( slice.getKeys().length > 0 ) {
          newGroup.addTargetedAnimation( slice, group.targetedAnimations[i].target );
        }
      }
    }
    return newGroup;
  }

  /** 
  Slice an animation
  @param animation Animation to slice
  @param start starting key
  @param end ending key
  @returns new Animation containing slice of original animation
  */
  sliceAnimation(animation, start, end) {
    var keys = animation.getKeys();
    var slice = [];
    for ( var i = 0; i < keys.length; i++ ) {
      var key = keys[i];
      if ( key.frame >= start ) {
        if ( key.frame <= end ) {
          slice.push(key);
        } else {
          break;
        }
      }
    }
    var ret = new BABYLON.Animation(animation.name, animation.targetProperty, animation.framePerSecond, animation.dataType, animation.loopMode, animation.enableBlending);
    ret.setKeys( slice );
    return ret;
  }

  /** 
  Returns all animation groups of this avatar.
  Applies fixes first, if any.
  */
  getAnimationGroups(animationGroups = this.character.animationGroups) {
    if (!this.animationGroups) {
      var loopAnimations = true;
      if ( this.fixes && typeof this.fixes.loopAnimations !== 'undefined' ) {
        loopAnimations = this.fixes.loopAnimations;
      }
      if ( this.fixes && this.fixes.animationGroups ) {
        this.animationGroups = [];
        // animation groups overriden; process animation groups and generate new ones
        for ( var j = 0; j < this.fixes.animationGroups.length; j++ ) {
          var override = this.fixes.animationGroups[j];
          // find source group
          for ( var i = 0; i < animationGroups.length; i++ ) {
            var group = animationGroups[i];
            if ( group.name == override.source ) {
              var newGroup = group;
              if ( override.start || override.end ) {
                // now slice it and generate new group
                newGroup = this.sliceGroup( group, override.start, override.end );
              }
              if ( override.name ) {
                newGroup.name = override.name;
              }
              if ( typeof override.loop !== 'undefined' ) {
                newGroup.loopAnimation = override.loop;
              } else {
                newGroup.loopAnimation = loopAnimations;
              }
              this.animationGroups.push( newGroup );
              break;
            }
          }
        }
      } else {
        this.animationGroups = animationGroups;
        for ( var i=0; i<this.animationGroups.length; i++ ) {
          this.animationGroups[i].loopAnimation = loopAnimations;
        }
      }
    }
    return this.animationGroups;
  }

  /** Returns file name of this avatar, consisting of folder name and scene file name */
  getUrl() {
    return this.folder.url()+"/"+this.file;
  }
  
  /**
  Loads the avatar.
  @param success callback to execute on success
  @param failure executed if loading fails
   */
  load(success, failure) {
    this.loadFixes().then( () => {
      this.log("loading from "+this.folder.url());
      var plugin = VRSPACEUI.assetLoader.loadAsset(
        this.getUrl(),
        // onSuccess:
        (loadedUrl, container, info, instantiatedEntries ) => {
          this.info = info
          // https://doc.babylonjs.com/typedoc/classes/babylon.assetcontainer
          // https://doc.babylonjs.com/typedoc/classes/babylon.instantiatedentries
          if ( instantiatedEntries ) {
            //console.log("CHECKME: avatar "+this.name+" already loaded", container.avatar);
            // copy body bones from processed avatar
            this.character = container;
            this.neckQuat = container.avatar.neckQuat;
            this.neckQuatInv = container.avatar.neckQuatInv;
            this.headQuat = container.avatar.headQuat;
            this.headQuatInv = container.avatar.headQuatInv;
            this.body = container.avatar.body;

            // use skeleton and animationGroups from the instance
            this.parentMesh = instantiatedEntries.rootNodes[0];
            this.rootMesh = this.parentMesh.getChildren()[0];

            // remove all children nodes cloned along
            // CHECKME this better be done while instantiating, can we pass a function?
            while ( this.parentMesh.getChildren().length > 1 ) {
              console.log("Disposing of cloned child "+this.parentMesh.getChildren()[1].name)
              this.parentMesh.getChildren()[1].dispose();
            }

            this.getAnimationGroups(instantiatedEntries.animationGroups);
            this.skeleton = instantiatedEntries.skeletons[0];
            if ( this.returnToRest ) {
              this.standUp();
              this.skeleton.returnToRest();
            }
            this.parentMesh.rotationQuaternion = new BABYLON.Quaternion();
            this.instantiatedEntries = instantiatedEntries;
            if ( success ) {
              success(this);
            }
          } else {
            container.addAllToScene();
            try {
              this._processContainer(container,success);
            } catch ( exception ) {
              VRSPACEUI.assetLoader.unloadAsset(this.getUrl());
              if ( failure ) {
                failure(exception);
              } else {
                console.log("Error loading "+this.name,exception);
              }
            }
          }
          this.postProcess();
        },
        (exception)=>{
          if ( failure ) {
            failure(exception);
          } else {
            console.log(exception);
          }
        }
      );
    });
  }

  /** Returns head 'bone' */
  head() {
    return this.skeleton.bones[this.body.head];
  }
  /** Returns absolute position of the the head 'bone' */
  headPos() {
    // FIXME this is way suboptimal as it forces computation
    this.head().getTransformNode().computeWorldMatrix(true);
    var headPos = this.head().getTransformNode().getAbsolutePosition();
    // this returns complete nonsense in some cases (lisa etc), no matter what:
    //var headPos = this.head().getPosition(BABYLON.Space.WORLD, this.skinnedMesh);
    //this.headPosition.position = new BABYLON.Vector3(0,headPos.y,0); // CHECKME/FIXME
    return headPos;
  }

  /** Returns current height - distance head to feet */
  height() {
    return this.headPos().y - this.rootMesh.getAbsolutePosition().y;
  }
  
  /** 
  Returns absolute value of vector, i.e. Math.abs() of every value
  @param vec Vector3 to get absolute
   */
  absVector(vec) {
    var ret = new BABYLON.Vector3();
    ret.x = Math.abs(vec.x);
    ret.y = Math.abs(vec.y);
    ret.z = Math.abs(vec.z);
    return ret;
  }

  /**
  Returns rounded value of vector, i.e. Math.round() of every value
  @param vec Vector3 to round
   */
  roundVector(vec) {
    vec.x = Math.round(vec.x);
    vec.y = Math.round(vec.y);
    vec.z = Math.round(vec.z);
  }

  /**
  Look at given target. Head position is calculated without any bone limits.
  @param t target Vector3
   */
  lookAt( t ) {
    // calc target pos in coordinate system of head
    var totalPos = this.parentMesh.position.add(this.rootMesh.position);
    var totalRot = this.rootMesh.rotationQuaternion.multiply(this.parentMesh.rotationQuaternion);
    var target = new BABYLON.Vector3( t.x, t.y+this.bodyTargetHeight(), t.z ).subtract(totalPos);

    target.rotateByQuaternionToRef(BABYLON.Quaternion.Inverse(totalRot),target);

    // CHECKME: exact calculus?
    var targetVector = target.subtract(this.headPos()).add(totalPos);
    //var targetVector = target.subtract(this.headPos());
    if ( this.headXAxisFix != -1 ) {
      // FIX: neck and head opposite vertical orientation
      // businessman, robot, adventurer, unreal male, solus
      targetVector.y = -targetVector.y;
    }
    targetVector.rotateByQuaternionToRef(this.headQuatInv,targetVector);
    // this results in weird head positions, more natural-looking fix applied after
    //targetVector.rotateByQuaternionToRef(this.headQuat.multiply(this.neckQuatInv),targetVector);

    var rotationMatrix = new BABYLON.Matrix();

    BABYLON.Matrix.RotationAlignToRef(this.headTarget, targetVector.normalizeToNew(), rotationMatrix);
    var quat = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);

    if ( this.headYAxisFix != 1 ) {
      // FIX: neck and head opposite or under angle
      // boris, businessman, robot, adventurer, unreal male
      var fix = this.headQuat.multiply(this.neckQuatInv);
      quat = quat.multiply(fix);
    }

    this.renderHeadRotation(quat);
  }

  renderHeadRotation(quat) {
    let head = this.skeleton.bones[this.body.head];
    if ( !this.generateAnimations ) {
      head.getTransformNode().rotationQuaternion = quat;
      return;
    }
    if ( ! this.body.headAnimation ) {
      this.body.headAnimation = VRSPACEUI.createQuaternionAnimation(head.getTransformNode(), "rotationQuaternion", this.fps);
    }
    VRSPACEUI.updateQuaternionAnimation(this.body.headAnimation, head.getTransformNode().rotationQuaternion.clone(), quat);
  }
  /** Debugging helper, draws a vector between given points */
  drawVector(from, to) {
    BABYLON.MeshBuilder.CreateLines("vector-"+from+"-"+to, {points:[from,to]}, this.scene);
  }

  /**
  Move given arm towards given target. Uses simplified 2-joint IK.
  @param arm arm to move
  @param t target position
   */
  reachFor( arm, t ) {
    var upperArm = this.skeleton.bones[arm.upper];

    //console.log("Parent pos: "+this.parentMesh.position+" root pos: "+this.rootMesh.position);
    var totalPos = this.parentMesh.position.add(this.rootMesh.position);
    // FIXME: take rootMesh.rotationQuaternion into account
    //var totalRot = this.rootMesh.rotationQuaternion.multiply(this.parentMesh.rotationQuaternion);
    var totalRot = this.parentMesh.rotationQuaternion;
    var rootQuatInv = BABYLON.Quaternion.Inverse(totalRot);
    
    var armPos = this.getAbsolutePosition(upperArm);
    //console.log("Arm "+arm.side+" pos "+armPos);
    
    var upperQuat = arm.upperQuat;
    var armVector = arm.armVector;
    var worldQuatInv = arm.worldQuatInv;
    
    // calc target pos in coordinate system of character
    var target = new BABYLON.Vector3(t.x, t.y+this.bodyTargetHeight(), t.z);
    //var target = new BABYLON.Vector3(t.x, t.y, t.z).subtract(totalPos);
    // CHECKME: probable bug, possibly related to worldQuat
    //target.rotateByQuaternionToRef(rootQuatInv,target);

    // calc target vectors in local coordinate system of the arm
    var targetVector = target.subtract(armPos);
    if ( this.instantiatedEntries ) {
      // cloned characters are backwards
      targetVector.rotateByQuaternionToRef(BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, Math.PI), targetVector);
    }
    // TODO: multiply these quaternions some time earlier and only once
    targetVector.rotateByQuaternionToRef(rootQuatInv,targetVector);
    targetVector.rotateByQuaternionToRef(worldQuatInv,targetVector);

    //console.log("arm vector: "+armVector);
    //console.log("target vector: "+targetVector);
    
    // vector pointing down in local space:
    var downVector = new BABYLON.Vector3(0,-1,0);
    var downQuat = this.armDirectionLocal(arm, downVector);
    armVector.rotateByQuaternionToRef(downQuat,downVector);
    //this.drawVector(armPos, armPos.add(downVector));

    // inner angle of the arm (between body and elbow) is determined by VR controller angle
    // i.e. arm.pointerQuat = xrController.pointer.rotationQuaternion
    // 0 by default
    // pointer vector in mesh space:
    var pointerQuat = arm.pointerQuat.multiply(rootQuatInv);

    var pointerVector = new BABYLON.Vector3();
    downVector.rotateByQuaternionToRef(pointerQuat,pointerVector);
    //this.drawVector(armPos, armPos.add(pointerVector));
    // converted to local arm space:
    var sideVector = new BABYLON.Vector3();
    pointerVector.rotateByQuaternionToRef(worldQuatInv,sideVector);

    // rotation from current to side
    var sideRotation = new BABYLON.Matrix();
    BABYLON.Matrix.RotationAlignToRef(armVector.normalizeToNew(), sideVector.normalizeToNew(), sideRotation);
    
    // rotation from side to target
    var targetRotation = new BABYLON.Matrix();
    BABYLON.Matrix.RotationAlignToRef(sideVector.normalizeToNew(), targetVector.normalizeToNew(), targetRotation);
    var finalRotation = sideRotation.multiply(targetRotation);

    var quat = BABYLON.Quaternion.FromRotationMatrix(finalRotation);
    arm.upperRot = upperQuat.multiply(quat);

    // then bend arm
    var bent = this.bendArm(arm, targetVector);

    this.renderLimbRotation(arm);
    return quat;
  }

  /**
  Bend/stretch arm to a length
   */
  bendArm( arm, targetVector ) {
    var ret = true;

    var length = targetVector.length();

    if ( length > arm.lowerLength + arm.upperLength ) {
      length = arm.lowerLength + arm.upperLength
      ret = false;
    }

    // simplified math by using same length for both bones
    // it's right angle, hypotenuse is bone
    // length/2 is sinus of half of elbow angle
    var boneLength = (arm.lowerLength + arm.upperLength)/2;
    var innerAngle = Math.asin(length/2/boneLength);
    var shoulderAngle = -Math.PI/2+innerAngle;
    var elbowAngle = shoulderAngle*2;

    var normal = arm.armVector.normalizeToNew().cross(targetVector.normalizeToNew());
    var fix = BABYLON.Quaternion.RotationAxis(normal,shoulderAngle);
    arm.upperRot = arm.upperRot.multiply(fix);

    arm.lowerRot = BABYLON.Quaternion.RotationAxis(normal,-elbowAngle);
    return ret;
  }

  /**
   * Move an arm or leg, optionally creates/updates arm animation depending on this.generateAnimations flag
   */
  renderLimbRotation( limb ) {
    let upper = this.skeleton.bones[limb.upper];
    let lower = this.skeleton.bones[limb.lower];
    if ( ! this.generateAnimations ) {
      upper.getTransformNode().rotationQuaternion = limb.upperRot;
      lower.getTransformNode().rotationQuaternion = limb.lowerRot;
      return;
    }
    if ( !limb.animation ) {
      let name = this.folder.name+'-'+limb.type+'-'+limb.side;
      let group = new BABYLON.AnimationGroup(name+'Animation');
      
      let upperAnim = this._createLimbAnimation(name+"-upper");
      let lowerAnim = this._createLimbAnimation(name+"-lower");
      
      group.addTargetedAnimation(upperAnim, this.skeleton.bones[limb.upper].getTransformNode());
      group.addTargetedAnimation(lowerAnim, this.skeleton.bones[limb.lower].getTransformNode());
      limb.animation = group;
    }
    this._updateLimbAnimation(upper, limb.animation.targetedAnimations[0], limb.upperRot);
    this._updateLimbAnimation(lower, limb.animation.targetedAnimations[1], limb.lowerRot);
    if ( limb.animation.isPlaying ) {
      limb.animation.stop();
    }
    limb.animation.play(false);
  }
  
  _createLimbAnimation(name) {
    var anim = new BABYLON.Animation(name, 'rotationQuaternion', this.fps, BABYLON.Animation.ANIMATIONTYPE_QUATERNION, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    var keys = []; 
    keys.push({frame:0, value: 0});
    keys.push({frame:1, value: 0});
    anim.setKeys(keys);
    return anim;
  }
  _updateLimbAnimation(limb, anim, dest) {
    anim.animation.getKeys()[0].value = limb.getTransformNode().rotationQuaternion;
    anim.animation.getKeys()[1].value = dest;
  }

  legLength() {
    return (this.body.leftLeg.upperLength + this.body.leftLeg.lowerLength + this.body.rightLeg.upperLength + this.body.rightLeg.lowerLength)/2;
  }

  /**
  Set avatar position.
  @param pos postion
   */
  setPosition( pos ) {
    this.parentMesh.position.x = pos.x;
    //this.groundLevel( pos.y ); // CHECKME
    this.parentMesh.position.y = pos.y;
    this.parentMesh.position.z = pos.z;
  }

  /** 
  Set avatar rotation
  @param quat Quaternion 
  */
  setRotation( quat ) {
    // FIXME this should rotate parentMesh instead
    // but GLTF characters are facing the user when loaded
    this.parentMesh.rotationQuaternion = quat;
  }

  /** 
  Sets the ground level
  @param y height of the ground at current position
   */
  groundLevel( y ) {
    this.groundHeight = y;
    this.rootMesh.position.y = this.rootMesh.position.y + y;
  }

  /**
  Track user height: character may crouch or raise, or jump,
  depending on heights of avatar and user.
  @param height current user height
   */
  trackHeight(height) {
    if ( this.maxUserHeight && height != this.prevUserHeight ) {
      var delta = height-this.prevUserHeight;
      //this.trackDelay = 1000/this.fps;
      //var speed = delta/this.trackDelay*1000; // speed in m/s
      var speed = delta*this.fps;
      if ( this.jumping ) {
        var delay = Date.now() - this.jumping;
        if ( height <= this.maxUserHeight && delay > 300 ) {
          this.standUp();
          this.jumping = null;
          this.log("jump stopped")
        } else if ( delay > 500 ) {
          this.log("jump stopped - timeout")
          this.standUp();
          this.jumping = null;
        } else {
          this.jump(height - this.maxUserHeight);
        }
      } else if ( height > this.maxUserHeight && Math.abs(speed) > 0.2 ) {
        // CHECKME speed is not really important here
        this.jump(height - this.maxUserHeight);
        this.jumping = Date.now();
        this.log("jump starting")
      } else {
        // ignoring anything less than 1mm
        if ( delta > 0.001 ) {
          this.rise(delta);
        } else if ( delta < -0.001 ) {
          this.crouch(-delta);
        }
      }

    } else {
      this.maxUserHeight = height;
    }
    this.prevUserHeight = height;
  }

  /**
  Moves the avatar to given height above the ground
  @param height jump how high
   */
  jump( height ) {
    this.rootMesh.position.y = this.groundHeight + height;
    this.recompute();
    this.changed();
  }

  /**
  Stand up straight, at the ground, legs fully stretched
   */
  standUp() {
    this.jump(0);
    this.bendLeg( this.body.leftLeg, 10 );
    this.bendLeg( this.body.rightLeg, 10 );
  }

  /**
  Rise a bit
  @param height rise how much
   */
  rise( height ) {
    if ( height < 0.001 ) {
      // ignoring anything less than 1mm
      return;
    }

    var legLength = (this.body.leftLeg.length + this.body.rightLeg.length)/2;
    var length = legLength+height;
    this.bendLeg( this.body.leftLeg, length );
    this.bendLeg( this.body.rightLeg, length );

    this.renderBodyPosition(height);
    this.changed();
  }

  /**
   * Renders crouch/raise changes to body: either generates the animation, or changes this.rootMesh position right away,
   * depending on this.generateAnimations flag.
   */
  renderBodyPosition(height) {
    if ( ! this.generateAnimations ) {
      this.rootMesh.position.y += height;
      return;
    }
    
    if ( !this.body.rootAnimation ) {
      let name = this.folder.name+'-body';
      let group = new BABYLON.AnimationGroup(name+'Animation');
      
      let anim = new BABYLON.Animation(name, 'position.y', this.fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
      let keys = []; 
      keys.push({frame:0, value: 0});
      keys.push({frame:1, value: 0});
      anim.setKeys(keys);
      
      group.addTargetedAnimation(anim, this.rootMesh);
      this.body.rootAnimation = group;
    }
    this.body.rootAnimation.targetedAnimations[0].animation.getKeys()[0].value = this.rootMesh.position.y;
    this.body.rootAnimation.targetedAnimations[0].animation.getKeys()[1].value = this.rootMesh.position.y+height;
    this.body.rootAnimation.play(false);
  }
  
  isBodyPositionChanging() {
    return this.body.rootAnimation && this.body.rootAnimation.isPlaying;
  }

  bodyTargetHeight() {
    if ( this.isBodyPositionChanging() ) {
      return this.rootMesh.position.y-this.body.rootAnimation.targetedAnimations[0].animation.getKeys()[1].value;
    }
    return 0;
  }  
  /**
  Crouch a bit
  @param height how much
   */
  crouch( height ) {
    if ( height < 0.001 ) {
      // ignoring anything less than 1mm
      return;
    }

    var legLength = (this.body.leftLeg.length + this.body.rightLeg.length)/2;
    if ( legLength - height < 0.1 ) {
      height = legLength - 0.1;
    }
    var length = legLength-height;

    this.bendLeg( this.body.leftLeg, length );
    this.bendLeg( this.body.rightLeg, length );

    this.renderBodyPosition(-height);
    this.changed();
  }

  extractInitialLegTransformation( leg ) {
    var upper = this.skeleton.bones[leg.upper];
    var lower = this.skeleton.bones[leg.lower];
    
    leg.worldQuat = BABYLON.Quaternion.FromRotationMatrix(upper.getTransformNode().getWorldMatrix().getRotationMatrix());
    leg.worldQuatInv = BABYLON.Quaternion.Inverse(leg.worldQuat);
    if (this.turnAround) {
      // network instances of characters are backwards
      leg.worldQuatInv.multiplyInPlace(BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, Math.PI));
    }
    
    leg.upperQuat = upper.getTransformNode().rotationQuaternion.clone();
    leg.upperQuatInv = BABYLON.Quaternion.Inverse(leg.upperQuat);

    leg.lowerQuat = lower.getTransformNode().rotationQuaternion.clone();
    leg.lowerQuatInv = BABYLON.Quaternion.Inverse(leg.lowerQuat);

    leg.upperRot = upper.getTransformNode().rotationQuaternion.clone();
    leg.lowerRot = lower.getTransformNode().rotationQuaternion.clone();
    
    leg.upperNormal = new BABYLON.Vector3();
    leg.lowerNormal = new BABYLON.Vector3();
    BABYLON.Axis.X.rotateByQuaternionToRef(leg.worldQuatInv,leg.upperNormal);
    BABYLON.Axis.X.rotateByQuaternionToRef(leg.worldQuatInv.multiply(leg.lowerQuat),leg.lowerNormal);
  }
  
  /**
  Bend/stretch leg to a length
  @param leg
  @param length
   */
  bendLeg( leg, length ) {
    if ( length < 0 ) {
      console.log("ERROR: can't bend leg to "+length);
      return
    }

    if ( length > leg.lowerLength + leg.upperLength ) {
      length = leg.lowerLength + leg.upperLength;
      if ( length == leg.length ) {
        return;
      }
    }
    leg.length = length;

    // simplified math by using same length for both bones
    // it's right angle, hypotenuse is bone
    // length/2 is sinus of half of elbow angle
    var boneLength = (leg.lowerLength + leg.upperLength)/2;
    var innerAngle = Math.asin(length/2/boneLength);
    var upperAngle = Math.PI/2-innerAngle;
    var lowerAngle = -upperAngle*2;

    var upperQuat = BABYLON.Quaternion.RotationAxis(leg.upperNormal,upperAngle);

    var lowerQuat = BABYLON.Quaternion.RotationAxis(leg.lowerNormal,lowerAngle);

    leg.upperRot = leg.upperQuat.multiply(upperQuat);
    leg.lowerRot = leg.lowerQuat.multiply(lowerQuat);
    this.renderLimbRotation(leg);
    
    return length;
  }

  /**
  Returns lenght of an arm or leg, in absolute world coordinates.
  @param limb an arm or leg
  @returns total length of lower and upper arm/leg
   */
  calcLength(limb) {
    var upper = this.skeleton.bones[limb.upper];
    var lower = this.skeleton.bones[limb.lower];
    limb.upperLength = this.getAbsolutePosition(upper).subtract(this.getAbsolutePosition(lower)).length();
    if ( lower.children && lower.children[0] ) {
      limb.lowerLength = this.getAbsolutePosition(lower).subtract(this.getAbsolutePosition(lower.children[0])).length();
    } else {
      limb.lowerLength = 0;
    }
    limb.length = limb.upperLength+limb.lowerLength;
    this.log("Length of "+upper.name+": "+limb.upperLength+", "+lower.name+": "+limb.lowerLength);
  }

  /** 
  Returns total weight of a vector, x+y+z
  @param vector Vector3 to sum 
  */
  sum(vector) {
    return vector.x+vector.y+vector.z;
  }

  extractInitialArmTransformation( arm ) {
    var upperArm = this.skeleton.bones[arm.upper];
    var lowerArm = this.skeleton.bones[arm.lower];

    var totalPos = this.parentMesh.position.add(this.rootMesh.position);
    var armPos = this.getAbsolutePosition(upperArm).subtract(totalPos);
    var elbowPos = this.getAbsolutePosition(lowerArm).subtract(totalPos);

    var matrix = upperArm.getTransformNode().getWorldMatrix().getRotationMatrix();
    var worldQuat = BABYLON.Quaternion.FromRotationMatrix(matrix);
    this.log("Arm angles: "+worldQuat.toEulerAngles());
    var worldQuatInv = BABYLON.Quaternion.Inverse(worldQuat);
    arm.worldQuatInv = worldQuatInv;
    var upperQuat = upperArm.getTransformNode().rotationQuaternion;
    arm.upperQuat = upperQuat.clone();
    var armVector = elbowPos.subtract(armPos);
    //console.log("Arm vector: "+armVector);
    armVector.rotateByQuaternionToRef(worldQuatInv,armVector);
    //console.log("Arm vector rotated: "+armVector);
    arm.armVector = armVector;
    
    // need initial value to calc first movement
    arm.upperRot = BABYLON.Quaternion.FromRotationMatrix(upperArm.getRotationMatrix());
    arm.lowerRot = BABYLON.Quaternion.FromRotationMatrix(lowerArm.getRotationMatrix());
  }

  /**
   * Point arm to given direction, in character space
   */
  armDirectionCharacter(arm, targetVector) {
    let rotated = new BABYLON.Vector3();
    targetVector.rotateByQuaternionToRef(arm.worldQuatInv,rotated);
    return this.armDirectionLocal(arm,rotated);
  }
  
  /**
   * Point arm to given direction, in arm space
   */
  armDirectionLocal(arm, targetVector) {
    var armVector = arm.armVector;
    var targetRotation = new BABYLON.Matrix();
    BABYLON.Matrix.RotationAlignToRef(armVector.normalizeToNew(), targetVector.normalizeToNew(), targetRotation);
    var quat = BABYLON.Quaternion.FromRotationMatrix(targetRotation)
    // (near) parallel vectors still causing trouble
    if ( isNaN(quat.x) || isNaN(quat.y) || isNaN(quat.z) || isNaN(quat.y) ) {
      this.log("arm vector: "+armVector+"target vector: "+targetVector+" quat: "+quat+" rot: ");
      this.log(targetRotation);
      // TODO: front axis, sign
      quat = BABYLON.Quaternion.FromEulerAngles(0,0,Math.PI);
    }
    return quat;
  }
  
  setPose(pose) {
    if ( 'I' == pose ) {
      let downVector = new BABYLON.Vector3(0,-1,0);
      var leftQuat = this.armDirectionCharacter(this.body.leftArm, downVector);
      this.body.leftArm.upperRot = this.body.leftArm.upperQuat.multiply(leftQuat);
      this.renderLimbRotation(this.body.leftArm);
      var rightQuat = this.armDirectionCharacter(this.body.rightArm, downVector);
      this.body.rightArm.upperRot = this.body.rightArm.upperQuat.multiply(rightQuat);
      this.renderLimbRotation(this.body.rightArm);
    } else if ( 'T' == pose ) {
      let leftVector = new BABYLON.Vector3(-1,0,0);
      var leftQuat = this.armDirectionCharacter(this.body.leftArm, leftVector);
      this.body.leftArm.upperRot = this.body.leftArm.upperQuat.multiply(leftQuat);
      this.renderLimbRotation(this.body.leftArm);
      let rightVector = new BABYLON.Vector3(1,0,0);
      var rightQuat = this.armDirectionCharacter(this.body.rightArm, rightVector);
      this.body.rightArm.upperRot = this.body.rightArm.upperQuat.multiply(rightQuat);
      this.renderLimbRotation(this.body.rightArm);
    } else if ( 'A' == pose ) {
      let leftVector = new BABYLON.Vector3(-1,-1,0);
      var leftQuat = this.armDirectionCharacter(this.body.leftArm, leftVector);
      this.body.leftArm.upperRot = this.body.leftArm.upperQuat.multiply(leftQuat);
      this.renderLimbRotation(this.body.leftArm);
      let rightVector = new BABYLON.Vector3(1,-1,0);
      var rightQuat = this.armDirectionCharacter(this.body.rightArm, rightVector);
      this.body.rightArm.upperRot = this.body.rightArm.upperQuat.multiply(rightQuat);
      this.renderLimbRotation(this.body.rightArm);
    }
  }
  
  getAbsolutePosition(bone) {
    //return bone.getPosition(BABYLON.Space.WORLD, this.skinnedMesh);
    bone.getTransformNode().computeWorldMatrix(true);
    return bone.getTransformNode().getAbsolutePosition();
  }
  
  /**
  Converts rotation quaternion of a node to euler angles
  @param node
  @returns Vector3 containing rotation around x,y,z
   */
  euler(node) {
    return node.rotationQuaternion.toEulerAngles();
  }
  
  degrees(node) {
    var rot = euler(node);
    return toDegrees(rot);
  }

  /**
  Converts euler radians to degrees
  @param rot Vector3 rotation around x,y,z
  @returns Vector3 containing degrees around x,y,z
   */
  toDegrees(rot) {
    var ret = new BABYLON.Vector3();
    ret.x = rot.x * 180/Math.PI;
    ret.y = rot.y * 180/Math.PI;
    ret.z = rot.z * 180/Math.PI;
    return ret;
  }

  countBones(bones) {
    if ( bones ) {
      this.bonesDepth++;
      for ( var i = 0; i < bones.length; i ++ ) {
        if ( ! this.bonesProcessed.includes( bones[i].name )) {
          this.boneProcessed(bones[i]);
          this.processBones(bones[i].children);
        }
      }
    }
  }
  processBones(bones) {
    if ( bones ) {
      this.bonesDepth++;
      for ( var i = 0; i < bones.length; i ++ ) {
        if ( ! this.bonesProcessed.includes( bones[i].name )) {
          this.boneProcessed(bones[i]);
          var boneName = bones[i].name.toLowerCase();
          if ( ! this.body.root && boneName.includes('rootjoint') ) {
            this.body.root = i;
            this.log("found root "+boneName+" at depth "+this.bonesDepth);
            this.processBones(bones[i].children);
          } else if ( ! this.body.hips && this.isHipsName(boneName) && bones[i].children.length >= 3) {
            this.body.hips = i;
            this.log("found hips "+boneName);
            this.processHips(bones[i].children);
          } else {
            this.processBones(bones[i].children);
          }
        }
      }
      this.bonesDepth--;
    }
  }

  isHipsName(boneName) {
    return boneName.includes('pelvis') || boneName.includes('hip') || boneName.includes('spine') || boneName.includes('root');
  }

  processHips( bones ) {
    // FIXME cyberconnect: tail_02 recognised as left leg due to l_
    // hips have two legs and spine attached, possibly something else
    // TODO rewrite this to find most probable candidates for legs
    for ( var i = 0; i < bones.length; i++ ) {
      var boneName = bones[i].name.toLowerCase();
      if ( boneName.includes("spine") || boneName.includes("body") ) {
        this.processSpine(bones[i]);
      } else if ( boneName.includes( 'left' ) || this.isLegName(boneName, 'l', bones[i].children) ) {
        // left leg/thigh/upLeg/upperLeg
        this.tryLeg(this.body.leftLeg, bones[i]);
      } else if ( boneName.includes( 'right' ) || this.isLegName(boneName, 'r', bones[i].children)) {
        // right leg/thigh/upLeg/upperLeg
        this.tryLeg(this.body.rightLeg, bones[i]);
      } else if ( bones[i].children.length >= 3 && this.isHipsName(boneName) ) {
        this.log("Don't know how to handle bone "+boneName+", assuming hips" );
        this.boneProcessed(bones[i]);
        this.processHips(bones[i].children);
      } else if ( bones[i].children.length > 0 ) {
        this.log("Don't know how to handle bone "+boneName+", assuming spine" );
        this.processSpine(bones[i]);
      } else {
        this.log("Don't know how to handle bone "+boneName );
        this.boneProcessed(bones[i]);
      }
    }
  }

  isLegName(boneName, lr, children ) {
    return boneName.includes( lr+'leg' ) ||
           boneName.includes( lr+'_leg' ) ||
           boneName.includes( 'leg_'+lr ) ||
           
           boneName.includes(lr+' thigh') ||
           boneName.includes(lr+'_thigh') ||
           boneName.includes(lr+'thigh') ||
           boneName.includes('thigh_'+lr) ||
           boneName.includes('thigh.'+lr) ||

           boneName.includes(lr+'hip') 
           // this attempts to catch legs with buttocks, e.g. spiderman
           || ( children && children.length > 0 && children[0].children.length > 0  && this.isLegName(children[0].name.toLowerCase(),lr) )
  }

  tryLeg( leg, bone ) {
    if ( bone.name.toLowerCase().includes( 'thigh' ) || bone.name.toLowerCase().includes( 'leg' )) {
      this.processLeg(leg, bone);
    } else if (bone.children.length == 0 || bone.children.length == 1 && bone.children[0].children.length == 0) {
      this.log("Ignoring bone "+bone.name);
      this.boneProcessed(bone);
    } else if (bone.children.length == 1 && bone.children[0].children.length == 1 && bone.children[0].children[0].children.length == 0 ) {
      // children depth 2, assume leg (missing foot?)
      if ( leg.upper && leg.lower ) {
        this.log( "Ignoring 1-joint leg "+bone.name );
        this.boneProcessed(bone);
      } else {
        this.log( "Processing 1-joint leg "+bone.name );
        this.processLeg(leg, bone.children[0]);
      }
    } else {
      // butt?
      this.log("Don't know how to handle leg "+bone.name+", trying children");
      this.boneProcessed(bone);
      this.processLeg(leg, bone.children[0]);
    }
  }

  processLeg( leg, bone ) {
    this.log("Processing leg "+bone.name);
    if ( leg.upper && leg.lower ) {
      this.log("WARNING: leg already exists");
    }
    this.boneProcessed(bone);
    leg.upper = this.skeleton.getBoneIndexByName(bone.name);
    bone = bone.children[0];
    this.boneProcessed(bone);
    leg.lower = this.skeleton.getBoneIndexByName(bone.name);
    if ( bone.children && bone.children[0] ) {
      // foot exists
      this.processFoot(leg, bone.children[0]);
    }
  }

  processFoot( leg, bone ) {
    //this.log("Processing foot "+bone.name);
    this.boneProcessed(bone);
    leg.foot.push(this.skeleton.getBoneIndexByName(bone.name));
    if ( bone.children && bone.children.length == 1 ) {
      this.processFoot( leg, bone.children[0] );
    }
  }

  processSpine(bone) {
    if ( !bone ) {
      return;
    }
    //this.log("Processing spine "+bone.name);
    // spine has at least one bone, usually 2-3,
    this.boneProcessed(bone);
    if ( bone.children.length == 1 ) {
      this.body.spine.push(this.skeleton.getBoneIndexByName(bone.name));
      this.processSpine(bone.children[0]);
    } else if (bone.children.length >= 3 && this.hasHeadAndShoulders(bone) ) {
      // process shoulders and neck, other joints to be ignored
      for ( var i = 0; i < bone.children.length; i++ ) {
        var boneName = bone.children[i].name.toLowerCase();
        if ( boneName.includes( "neck" ) || boneName.includes("head") || (boneName.includes( "collar" ) && !boneName.includes( "bone" ) && !boneName.includes("lcollar") && !boneName.includes("rcollar")) ) {
          if ( !boneName.includes("head") && bone.children[i].children.length > 2 ) {
            this.log("Neck "+boneName+" of "+bone.name+" has "+bone.children[i].children.length+" children, assuming arms" );
            this.processNeck( bone.children[i] );
            this.processSpine( bone.children[i] );
          } else if ( bone.name.toLowerCase().includes( "neck" ) && boneName.toLowerCase().includes("head") ) {
            this.log("Arms grow out from neck?!");
            this.processNeck( bone );
          } else {
            this.processNeck( bone.children[i] );
          }
        } else if (this.isArm(bone.children[i], boneName)) {
          if ( boneName.includes( "left" ) || this.isArmName(boneName, 'l') ) {
            this.processArms( this.body.leftArm, bone.children[i] );
          } else if ( boneName.includes( "right" ) || this.isArmName(boneName, 'r') ) {
            this.processArms( this.body.rightArm, bone.children[i] );
          } else {
            this.log("Don't know how to handle shoulder "+boneName);
            this.boneProcessed(bone.children[i]);
          }
        } else {
          this.log("Don't know how to handle bone "+boneName);
        }
      }
    } else if ( bone.name.toLowerCase().includes("breast")) {
      this.countBones(bone.children);
    } else {
      this.log("Not sure how to handle spine "+bone.name+", trying recursion");
      this.body.spine.push(this.skeleton.getBoneIndexByName(bone.name));
      this.processSpine(bone.children[0]);
    }
  }

  isArmName(boneName, lr) {
    return boneName.includes( lr+'shoulder' ) ||
           boneName.includes( lr+'clavicle' ) ||
           boneName.includes( lr+'collar' ) ||
           boneName.includes( lr+'arm' ) ||
           boneName.includes( ' '+lr+' ' ) ||
           boneName.includes( lr+"_" );
  }

  isArm( bone, boneName ) {
    //( ! boneName.includes("breast") && !boneName.includes("pistol")) {
    if ( boneName.includes("shoulder") || boneName.includes("clavicle") ) {
      return true;
    }
    return ( this.hasChildren(bone) && this.hasChildren(bone.children[0]) && this.hasChildren(bone.children[0].children[0]) )
  }

  hasChildren( bone ) {
    return bone.children && bone.children.length > 0;
  }

  hasHeadAndShoulders( bone ) {
    var count = 0;
    for ( var i = 0; i < bone.children.length; i ++ ) {
      if ( this.isHeadOrShoulder(bone.children[i]) ) {
        count++;
      }
    }
    this.log("Head and shoulders count: "+count+"/"+bone.children.length);
    return count >= 3;
  }

  isHeadOrShoulder( bone ) {
    var boneName = bone.name.toLowerCase();
    return boneName.includes('head') || boneName.includes('neck') ||
    ((bone.children && bone.children.length > 0)
      && ( boneName.includes('shoulder')
        || boneName.includes( 'clavicle' )
        || boneName.includes( 'collar' )
        || boneName.includes( 'arm' )
    ));
  }

  processNeck( bone ) {
    if ( this.body.neck && this.bonesProcessed.includes(bone.name) ) {
      this.log("neck "+bone.name+" already processed: "+this.body.neck);
      return;
    }
    this.log("processing neck "+bone.name+" children: "+bone.children.length);
    this.body.neck = this.skeleton.getBoneIndexByName(bone.name);
    this.boneProcessed(bone);
    var neck = bone;
    if ( bone.children && bone.children.length > 0 ) {
      bone = bone.children[0];
    } else {
      this.log("Missing head?!");
    }
    this.body.head = this.skeleton.getBoneIndexByName(bone.name);
    var head = bone;

    var refHead = new BABYLON.Vector3();
    // all the same, completelly useles
    head.getDirectionToRef(BABYLON.Axis.Z,this.skinnedMesh,refHead);
    this.roundVector(refHead);
    //this.log("RefZ head: "+refHead);

    var refNeck = new BABYLON.Vector3();
    neck.getDirectionToRef(BABYLON.Axis.Z,this.skinnedMesh,refNeck);
    this.roundVector(refNeck);
    //this.log("RefZ neck: "+refNeck);

    // some characters have Z axis of neck and head pointing in opposite direction
    // (rotated around Y) causing rotation to point backwards,
    // they need different calculation
    this.headYAxisFix = refHead.z * refNeck.z;

    var refHead = new BABYLON.Vector3();
    head.getDirectionToRef(BABYLON.Axis.X,this.skinnedMesh,refHead);
    this.roundVector(refHead);
    //this.log("RefX head: "+refHead);

    var refNeck = new BABYLON.Vector3();
    neck.getDirectionToRef(BABYLON.Axis.X,this.skinnedMesh,refNeck);
    this.roundVector(refNeck);
    //this.log("RefX neck: "+refNeck);

    // and some characters have X axis of neck and head pointing in opposite direction
    // so they have up and down switched
    this.headXAxisFix = refHead.x * refNeck.x;

    this.headQuat = BABYLON.Quaternion.FromRotationMatrix(head.getTransformNode().getWorldMatrix().getRotationMatrix());
    this.headQuatInv = BABYLON.Quaternion.Inverse(this.headQuat);

    this.neckQuat = BABYLON.Quaternion.FromRotationMatrix(neck.getTransformNode().getWorldMatrix().getRotationMatrix());
    this.neckQuatInv = BABYLON.Quaternion.Inverse(this.neckQuat);

    var target = new BABYLON.Vector3(0,0,1);
    target.rotateByQuaternionToRef(BABYLON.Quaternion.Inverse(this.rootMesh.rotationQuaternion),target);
    target.rotateByQuaternionToRef(this.headQuatInv,target);

    this.headTarget = target.negate().normalizeToNew();

    this.log("Head target: "+this.headTarget+" axisYFix "+this.headYAxisFix+" axisXFix "+this.headXAxisFix);

    this.boneProcessed(bone);
    //this.processBones(bone.children);
    this.countBones(bone.children);
  }

  processArms( arm, bone ) {
    this.log("Processing arm "+bone.name+" "+bone.getIndex()+" "+this.skeleton.getBoneIndexByName(bone.name));
    arm.shoulder = this.skeleton.getBoneIndexByName(bone.name);
    this.boneProcessed(bone);
    bone = bone.children[0];
    arm.upper = this.skeleton.getBoneIndexByName(bone.name);
    this.boneProcessed(bone);
    bone = bone.children[0];
    arm.lower = this.skeleton.getBoneIndexByName(bone.name);
    this.boneProcessed(bone);
    bone = bone.children[0];
    arm.hand = this.skeleton.getBoneIndexByName(bone.name);
    this.boneProcessed(bone);
    if ( bone.children ) {
      if ( bone.children.length == 5 ) {
        for ( var i = 0; i < bone.children.length; i++ ) {
          var boneName = bone.children[i].name.toLowerCase();
          if ( boneName.includes("index") || boneName.includes("point") ) {
            this.processFinger(arm.fingers.index, bone.children[i]);
          } else if (boneName.includes("middle")) {
            this.processFinger(arm.fingers.middle, bone.children[i]);
          } else if (boneName.includes("pink") || boneName.includes("little")) {
            this.processFinger(arm.fingers.pinky, bone.children[i]);
          } else if (boneName.includes("ring")) {
            this.processFinger(arm.fingers.ring, bone.children[i]);
          } else if (boneName.includes("thumb")) {
            this.processFinger(arm.fingers.thumb, bone.children[i]);
          } else {
            this.log("Can't process finger "+boneName);
            this.boneProcessed(bone.children[i]);
          }
        }
      } else {
        this.log("Can't process fingers of "+bone.name+" length: "+bone.children.length);
      }
    }
  }

  processFinger( finger, bone ) {
    if ( bone ) {
      finger.push(this.skeleton.getBoneIndexByName(bone.name));
      this.boneProcessed(bone);
      if ( bone.children && bone.children.length > 0 ) {
        this.processFinger(finger,bone.children[0]);
      }
    }
  }

  /**
  Load an animation group from an url
   */
  loadAnimations( url, callback ) {
    fetch(url, {cache: this.cache}).then( response => {
      if ( response.ok ) {
        response.json().then(group => {
          this.attachAnimations(group);
          if ( callback ) {
            callback( this );
          }
        });
      } else {
        console.log('Error loading animations from: ' +url+' - '+ response.status);
      }
    });
  }
  
  /**
   * Enable or disable animation blending for all animation of all groups
   */
  animationBlending( enable = true, speed = 0.05) {
    this.character.animationGroups.forEach(animationGroup => {
      animationGroup.enableBlending = enable;
      animationGroup.blendingSpeed = speed;
      
      animationGroup.targetedAnimations.forEach( ta => {
        ta.animation.enableBlending = enable;
        ta.animation.blendingSpeed = speed;
      });
      
    });
  }
  
  /**
  Create an animation group from given object and attach it to the character.
   */
  attachAnimations( group ) {
    this.log("Animation group:"+group.name, group);
    var animationGroup = new BABYLON.AnimationGroup(group.name, this.scene);
    group.animations.forEach( a => {
      // CHECKME: fps
      var animation = new BABYLON.Animation( a.animationName, a.propertyName, a.fps, a.dataType, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
      animation.enableBlending = true;
      animation.blendingSpeed = 0.1;
      var bone = this.skeleton.getBoneIndexByName(a.targetName);
      if ( bone >= 0 ) {
        var target = this.skeleton.bones[bone].getTransformNode();
      } else {
        console.log("Missing target "+a.targetName);
        return;
      }
      var keys = [];
      if ( a.dataType == BABYLON.Animation.ANIMATIONTYPE_VECTOR3 ) {
        a.keys.forEach( key => {
          var k = {frame: key.frame, value:new BABYLON.Vector3(key.value.x, key.value.y, key.value.z)};
          if ( key.interpolation ) {
            k.interpolation = key.interpolation;
          }
          keys.push( k );
        });
      } else if ( a.dataType == BABYLON.Animation.ANIMATIONTYPE_QUATERNION ) {
        a.keys.forEach( key => {
          keys.push( {frame: key.frame, value:new BABYLON.Quaternion(key.value.x, key.value.y, key.value.z, key.value.w)} );
        });
      } else {
        // ERROR
        console.log("Unsupported datatype "+a.dataType);
      }
      animation.setKeys(keys);
      animationGroup.addTargetedAnimation(animation, target);
    });
    
    animationGroup.loopAnimation = true; // CHECKME
    
    var groups = this.getAnimationGroups();
    for ( var i = 0; i < groups.length; i++ ) {
      if ( groups[i].name == animationGroup.name ) {
        var old = groups[i];
        console.log("old",old);
        groups[i] = animationGroup;
        if ( old.isPlaying ) {
          old.stop();
        }
        old.dispose();
        return;
      }
    }
    groups.push(animationGroup);
  }
  
  /**
  Saves all animations in given animation group.
  Opens save file dialog.
   */
  saveAnimations(groupName) {
    for ( var i = 0; i < this.character.animationGroups.length; i++ ) {
      var animationGroup = this.character.animationGroups[i];
      if ( animationGroup.name === groupName ) {
        var group = this.processAnimations(animationGroup);
        var json = JSON.stringify(group);
        this.attachAnimations(group);
        VRSPACEUI.saveFile(animationGroup.name+'.json', json);
        return;
      }
    }
    console.log("No such animation group:"+groupName);
  }
  
  /**
  Processes all animation in an animation group.
  @returns object suitable for saving
   */
  processAnimations(animationGroup) {
    var group = {
      name: animationGroup.name,
      animations: []
    };
    animationGroup.targetedAnimations.forEach( ta => {
      //console.log("animation: "+ta.animation.name+" target: "+ta.target.getClassName()+" "+ta.target.name+" type "+ta.animation.dataType+" property "+ta.animation.targetProperty);
      var animation = {
        animationName:ta.animation.name,
        fps: ta.animation.framePerSecond,
        targetName:ta.target.name,
        propertyName: ta.animation.targetProperty,
        dataType: ta.animation.dataType,
        keys: []
      };
      var keys = ta.animation.getKeys();
      // position, rotation, scaling
      if ( ta.animation.dataType == BABYLON.Animation.ANIMATIONTYPE_VECTOR3 ) {
        keys.forEach( key => {
          var k = {frame:key.frame, value:{x:key.value.x, y:key.value.y, z:key.value.z}};
          if ( key.interpolation ) {
            k.interpolation = key.interpolation;
          }
          animation.keys.push(k);
        });
      } else if ( ta.animation.dataType == BABYLON.Animation.ANIMATIONTYPE_QUATERNION ) {
        keys.forEach( key => {
          animation.keys.push({frame:key.frame, value:{x:key.value.x, y:key.value.y, z:key.value.z, w:key.value.w}});
        });
      } else {
        // ERROR
        console.log("Error processing "+group.name+" = can't hanle type "+ta.animation.dataType)
      }
      group.animations.push(animation);
    });
    return group;
  }

  /**
   * Stop an animation. To allow for blending, just turns off looping rather than stopping it right away, unless forced.
   */
  stopAnimation(animationName, force=false) {
    for ( var i = 0; i < this.getAnimationGroups().length; i++ ) {
      var group = this.getAnimationGroups()[i];
      if ( (group.name == animationName || group.name == "Clone of "+animationName) && group.isPlaying ) {
        group.loopAnimation = false;
        if ( force ) {
          group.pause();
        }
        this.activeAnimation = null;
        break;
      }
    }
  }
  
  /**
  Start a given animation
  @param animationName animation to start
  @param loop if set, changes AnimationGroup.loopAnimation property
  @param speedRatio if set, changes AnimationGroup.speedRatio
   */
  startAnimation(animationName, loop, speedRatio) {
    var started = false; // to ensure we start only one animation
    for ( var i = 0; i < this.getAnimationGroups().length; i++ ) {
      var group = this.getAnimationGroups()[i];
      if ( (group.name == animationName || group.name == "Clone of "+animationName) && !started ) {
        started = true;
        //this.log("Animation group: "+animationName);
        if ( !group.isPlaying ) {
          if ( this.fixes ) {
            if (typeof this.fixes.beforeAnimation !== 'undefined' ) {
              this.log( "Applying fixes for: "+this.folder.name+" beforeAnimation: "+this.fixes.beforeAnimation);
              this.groundLevel( this.fixes.beforeAnimation );
            }
            this.disableNodes();
            if (typeof this.fixes.before !== 'undefined' ) {
              this.fixes.before.forEach( obj => {
                if ( animationName == obj.animation && obj.enableNodes ) {
                  //console.log(obj);
                  this.enableNodes(obj.enableNodes, true);
                }
              });
            }
          }
          this.jump(0);
          if ( typeof loop != 'undefined') {
            group.loopAnimation = loop;
          }
          if ( typeof speedRatio != 'undefined') {
            group.speedRatio=speedRatio;
          }
          group.play(loop);
          this.log("playing "+animationName+" loop:"+group.loopAnimation+" "+loop+" speed "+speedRatio);
          this.log(group);
        }
        this.activeAnimation = animationName;
      } else if ( group.isPlaying ) {
        // stop all other animations
        //this.log("paused other "+group.name);
        //group.reset(); // this disables blending
        //group.pause(); // this disables blending, but not always
        group.loopAnimation = false;
      }
    }
  }

  /**
  Adds or remove all avatar meshes to given ShadowGenerator.
  @param shadowGenerator removes shadows if null
   */
  castShadows( shadowGenerator ) {
    if ( this.character && this.character.meshes ) {
      for ( var i = 0; i < this.character.meshes.length; i++ ) {
        if (shadowGenerator) {
          shadowGenerator.getShadowMap().renderList.push(this.character.meshes[i]);
        } else if ( this.shadowGenerator ) {
          var index = this.shadowGenerator.getShadowMap().renderList.indexOf(this.character.meshes[i]);
          if ( index >= 0 ) {
            this.shadowGenerator.getShadowMap().renderList.splice(index,1);
          }
        }
      }
    }
    this.shadowGenerator = shadowGenerator;
  }

  /**
  After resizing and some other manipulations, matrices may need to be recomputed in a reliable way.
  How to do it depends on babylon.js version.
   */
  recompute() {
    //this.scene.render(false,true);
    this.rootMesh.computeWorldMatrix(true);
    this.character.transformNodes.forEach( t => t.computeWorldMatrix());
  }
  /**
  Resize the avatar taking into account userHeight and headPos.
   */
  resize() {
    this.recompute();
    var oldScale = this.rootMesh.scaling.y;
    var oldHeadPos = this.headPos();
    var scale = oldScale*this.userHeight/oldHeadPos.y;
    this.rootMesh.scaling = new BABYLON.Vector3(scale,scale,scale);
    this.recompute();
    this.initialHeadPos = this.headPos();
    this.log("Rescaling from "+oldScale+ " to "+scale+", head position from "+oldHeadPos+" to "+this.initialHeadPos);
    this.changed();
    return scale;
  }

  /** TODO Called when avatar size/height changes, supposed move name/text above the head, notify listeners */ 
  changed() {
  }

  basePosition() {
    return this.parentMesh.position;
  }
  
  baseMesh() {
    return this.parentMesh;
  }
}