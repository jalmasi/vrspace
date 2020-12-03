export class Avatar {
  constructor(scene, folder, shadowGenerator) {
    // parameters
    this.scene = scene;
    this.folder = folder;
    this.shadowGenerator = shadowGenerator;
    this.mirror = true;
    this.fps = 10;
    this.userHeight = 1.8;
    this.groundHeight = 0;
    this.fixes = null;
    this.animateArms = true;
    // author, license, source, title
    this.info = null;
    // state variables
    this.bonesTotal = 0;
    this.bonesProcessed = [];
    this.bonesDepth = 0;
    this.animationTargets = [];
    this.body = {};
    this.character = null;
    this.activeAnimation = null;
    this.rootMesh = null;
    // debug
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
        upper: null,
        lower: null,
        foot: [] // foot, toe, possibly more
      },
      rightLeg: {
        upper: null,
        lower: null,
        foot: []
      },
      spine: [], // can have one or more segments
      // aka clavicle
      leftArm: {
        side: 'left',
        frontAxis: null,
        sideAxis: null,
        shoulder: null,
        upper: null,
        upperRot: null,
        lower: null,
        lowerRot: null,
        hand: null,
        handRot: null,
        fingers: {
          thumb: [],
          index: [],
          middle: [],
          ring: [],
          pinky: []
        }
      },
      rightArm: {
        side: 'right',
        frontAxis: null,
        sideAxis: null,
        shoulder: null,
        upper: null,
        upperRot: null,
        lower: null,
        lowerRot: null,
        hand: null,
        handRot: null,
        fingers: {
          thumb: [],
          index: [],
          middle: [],
          ring: [],
          pinky: []
        }
      },
      neck: {
        neck: null,
        head: null,
        lefEye: null,
        rightEye: null
      }
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

  dispose() {
    this.character.dispose();
    if ( this.debugViewer1 ) {
      this.debugViewer1.dispose();
    }
    if ( this.debugViewer2 ) {
      this.debugViewer2.dispose();
    }
    // TODO also dispose of materials and textures (asset container)
  }

  replace(avatar) {
    if (avatar) {
      avatar.dispose();
    }
    return this;
  }

  _processContainer( container, onSuccess ) {
      this.character = container;

      var meshes = container.meshes;
      this.rootMesh = meshes[0];
      this.animationTargets = [];

      if (container.animationGroups && container.animationGroups.length > 0) {
        container.animationGroups[0].stop();
      }

      this.animationTargets.sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));

      var bbox = this.rootMesh.getHierarchyBoundingVectors();
      this.log("Bounding box:");
      this.log(bbox);
      var scale = this.userHeight/(bbox.max.y-bbox.min.y);
      this.log("Scaling: "+scale);
      this.rootMesh.scaling = new BABYLON.Vector3(scale,scale,scale);

      // Adds all elements to the scene
      container.addAllToScene();
      this.castShadows( this.shadowGenerator );

      // try to place feet on the ground
      // CHECKME is this really guaranteed to work in every time?
      bbox = this.rootMesh.getHierarchyBoundingVectors();
      this.groundLevel(-bbox.min.y);
      // CHECKME we may want to store the value in case we want to apply it again
      
      if ( container.skeletons && container.skeletons.length > 0 ) {
        // CHECKME: should we process multiple skeletons?
        this.skeleton = container.skeletons[0];

        this.createBody();
        //this.log("bones: "+bonesTotal+" "+bonesProcessed);

        //this.rootMesh.computeWorldMatrix(true);
        this.skeleton.computeAbsoluteTransforms();
        this.skeleton.name = this.folder.name;

        this.processBones(this.skeleton.bones);
        this.log( "Head position: "+this.headPos());
        this.initialHeadPos = this.headPos();

        //this.log(this.body);
        this.bonesProcessed.sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}));

        this.calcLength(this.body.leftArm);
        this.calcLength(this.body.rightArm);
        this.calcLength(this.body.leftLeg);
        this.calcLength(this.body.rightLeg);
        this.guessArmsRotations();
        this.guessLegsRotations();

        this.body.processed = true;

        if ( this.debugViewier1 || this.debugViewer2 ) {
          this.scene.registerBeforeRender(function () {
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

      // apply loaded fixes
      // CHECKME not used since proper bounding box calculation
      // might be required in some special cases
      if ( this.fixes && typeof this.fixes.standing !== 'undefined' ) {
        this.log( "Applying fixes for: "+this.folder.name+" standing: "+this.fixes.standing);
        this.groundLevel(this.fixes.standing);
      }

      if ( onSuccess ) {
        onSuccess(this);
      }
  }

  async loadFixes() {
    if ( this.folder.related ) {
      this.log('Loading fixes from '+this.folder.baseUrl+"/"+this.folder.related);
      return fetch(this.folder.baseUrl+"/"+this.folder.related, {cache: 'no-cache'})
      .then(response => response.json())
      .then(json => {
          this.fixes = json;
          this.log( "Loaded fixes: " );
          this.log( json );
      });
    }
  }

  sliceGroup( group, start, end ) {
    var newGroup = new BABYLON.AnimationGroup(group.name+":"+start+"-"+end);
    for ( var i = 0; i < group.targetedAnimations.length; i++ ) {
      var slice = this.sliceAnimation( group.targetedAnimations[i].animation, start, end );
      if ( slice.getKeys().length > 0 ) {
        newGroup.addTargetedAnimation( slice, group.targetedAnimations[i].target );
      }
    }
    return newGroup;
  }

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
    var ret = new BABYLON.Animation(animation.name, animation.targetProperty, animation.framePerSecond, animation.dataType, animation.enableBlending);
    ret.loopMode = animation.loopMode;
    ret.setKeys( slice );
    return ret;
  }

  getAnimationGroups() {
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
          for ( var i = 0; i < this.character.animationGroups.length; i++ ) {
            var group = this.character.animationGroups[i];
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
        this.animationGroups = this.character.animationGroups;
        for ( var i=0; i<this.animationGroups.length; i++ ) {
          this.animationGroups[i].loopAnimation = loopAnimations;
        }
      }
    }
    return this.animationGroups;
  }

  getUrl() {
    return this.folder.url()+"/scene.gltf";
  }
  
  load(success, progress, failure) {
    this.loadFixes().then( () => {
      this.log("loading from "+this.folder.url());
      var avatar = this;
      var plugin = BABYLON.SceneLoader.LoadAssetContainer(
        this.folder.baseUrl+this.folder.name+"/",
        "scene.gltf",
        this.scene,
        // onSuccess:
        (container) => avatar._processContainer(container,success),
        // onProgress:
        (evt) => {
          if ( progress ) {
            progress(evt);
          }
        }
      );
      plugin.onParsedObservable.add(gltfBabylon => {
          var manifest = gltfBabylon.json;
          avatar.info = manifest.asset.extras;
      });
      return plugin;
    });
  }

  headPos() {
    var head = this.skeleton.bones[this.body.head];
    var headPos = head.getAbsolutePosition().scale(this.rootMesh.scaling.x).add(this.rootMesh.position);
    return headPos;
  }

  absVector(vec) {
    var ret = new BABYLON.Vector3();
    ret.x = Math.abs(vec.x);
    ret.y = Math.abs(vec.y);
    ret.z = Math.abs(vec.z);
    return ret;
  }

  roundVector(vec) {
    vec.x = Math.round(vec.x);
    vec.y = Math.round(vec.y);
    vec.z = Math.round(vec.z);
  }

  lookAt( t ) {
    var head = this.skeleton.bones[this.body.head];

    // calc target pos in coordinate system of head
    var target = new BABYLON.Vector3( t.x, t.y, t.z ).subtract(this.rootMesh.position);
    target.rotateByQuaternionToRef(BABYLON.Quaternion.Inverse(this.rootMesh.rotationQuaternion),target);

    var targetVector = target.subtract(this.headPos()).subtract(this.rootMesh.position);
    if ( this.headAxisFix == -1 ) {
      // FIX: neck and head opposite orientation
      // businessman, robot, adventurer, unreal male
      targetVector.y = -targetVector.y;
    }
    targetVector.rotateByQuaternionToRef(this.headQuatInv,targetVector);
    // this results in weird head positions, more natural-looking fix applied after
    //targetVector.rotateByQuaternionToRef(this.headQuat.multiply(this.neckQuatInv),targetVector);

    var rotationMatrix = new BABYLON.Matrix();

    BABYLON.Matrix.RotationAlignToRef(this.headTarget, targetVector.normalizeToNew(), rotationMatrix);
    var quat = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);

    if ( this.headAxisFix != 1 ) {
      // FIX: neck and head opposite or under angle
      // boris, businessman, robot, adventurer, unreal male
      var fix = this.headQuat.multiply(this.neckQuatInv);
      quat = quat.multiply(fix);
    }

    head.getTransformNode().rotationQuaternion = quat;
  }

  thirdAxis( limb ) {
    var ret = new BABYLON.Vector3(1,1,1);
    return ret.subtract(limb.frontAxis.axis).subtract(limb.sideAxis.axis);
  }

  drawVector(from, to) {
    BABYLON.MeshBuilder.CreateLines("vector-"+from+"-"+to, {points:[from,to]}, this.scene);
  }

  reachFor( arm, t ) {

    var upperArm = this.skeleton.bones[arm.upper];
    var lowerArm = this.skeleton.bones[arm.lower];
    var hand = this.skeleton.bones[arm.hand];
    var scaling = this.character.meshes[0].scaling.x;

    // current values
    var armPos = upperArm.getAbsolutePosition().scale(scaling).subtract(this.rootMesh.position);
    var elbowPos = lowerArm.getAbsolutePosition().scale(scaling).subtract(this.rootMesh.position);
    var handPos = hand.getAbsolutePosition().scale(scaling).subtract(this.rootMesh.position);
    var rootQuatInv = BABYLON.Quaternion.Inverse(this.rootMesh.rotationQuaternion);

    // set or get initial values
    if ( arm.upperQuat ) {
      var upperQuat = arm.upperQuat;
      var armVector = arm.armVector;
      var worldQuat = arm.worldQuat;
      var worldQuatInv = arm.worldQuatInv;
    } else {
      var worldQuat = BABYLON.Quaternion.FromRotationMatrix(upperArm.getWorldMatrix().getRotationMatrix());
      arm.worldQuat = worldQuat;
      this.log("Arm angles: "+worldQuat.toEulerAngles());
      var worldQuatInv = BABYLON.Quaternion.Inverse(worldQuat);
      arm.worldQuatInv = worldQuatInv;
      var upperQuat = upperArm.getRotationQuaternion();
      arm.upperQuat = upperQuat;
      var armVector = elbowPos.subtract(armPos);
      armVector.rotateByQuaternionToRef(worldQuatInv,armVector);
      arm.armVector = armVector;
    }

    // calc target pos in coordinate system of character
    var target = new BABYLON.Vector3(t.x, t.y, t.z).subtract(this.rootMesh.position);
    // CHECKME: probable bug, possibly related to worldQuat
    target.rotateByQuaternionToRef(rootQuatInv,target);

    // calc target vectors in local coordinate system of the arm
    var targetVector = target.subtract(armPos).subtract(this.rootMesh.position);
    targetVector.rotateByQuaternionToRef(worldQuatInv,targetVector);

    if ( arm.pointerQuat ) {

      // vector pointing down in local space:
      var downVector = new BABYLON.Vector3(0,-1,0);
      var downRotation = new BABYLON.Matrix();
      BABYLON.Matrix.RotationAlignToRef(armVector.normalizeToNew(), downVector.normalizeToNew(), downRotation);
      var downQuat = BABYLON.Quaternion.FromRotationMatrix(downRotation)
      // (near) parallel vectors still causing trouble
      if ( isNaN(downQuat.x) || isNaN(!downQuat.y) || isNaN(!downQuat.z) || isNaN(!downQuat.y) ) {
        this.log("arm vector: "+armVector+"down vector: "+downVector+" quat: "+downQuat+" rot: ");
        this.log(downRotation);
        // TODO: front axis, sign
        downQuat = BABYLON.Quaternion.FromEulerAngles(0,0,Math.PI);
      }
      armVector.rotateByQuaternionToRef(downQuat,downVector);
      //this.drawVector(armPos, armPos.add(downVector));

      // pointer vector in mesh space:
      var pointerQuat = arm.pointerQuat.multiply(rootQuatInv);
      if ( this.mirror ) {
        // heuristics 1, mirrored arm rotation, works well below shoulder
        pointerQuat.y = - pointerQuat.y;
        // heuristics 2, never point backwards
        //pointerQuat.z = - pointerQuat.z;
        if ( pointerQuat.z < 0 ) {
          pointerQuat.z = 0;
        }
      } else {
        // funny though this seems to just work
      }

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
    } else {
      // just point arm to target
      var finalRotation = new BABYLON.Matrix();
      BABYLON.Matrix.RotationAlignToRef(armVector.normalizeToNew(), targetVector.normalizeToNew(), finalRotation);
    }

    var quat = BABYLON.Quaternion.FromRotationMatrix(finalRotation);

    arm.upperRot = upperQuat.multiply(quat);

    // then bend arm
    var length = targetVector.length();
    var bent = this.bendArm(arm, length);

    this.renderArmRotation(arm);
    return quat;
  }

  // TODO animate rotations here
  renderArmRotation( arm ) {
    var upperArm = this.skeleton.bones[arm.upper];
    var lowerArm = this.skeleton.bones[arm.lower];
    if ( ! this.animateArms ) {
      upperArm.getTransformNode().rotationQuaternion = arm.upperRot;
      lowerArm.getTransformNode().rotationQuaternion = arm.lowerRot;
      return;
    }
    if ( !arm.animation ) {
      var armName = this.folder.name+'-'+arm.side;
      var group = new BABYLON.AnimationGroup(armName+'ArmAnimation');
      
      var upper = this._createArmAnimation(armName+"-upper");
      var lower = this._createArmAnimation(armName+"-lower");
      
      group.addTargetedAnimation(upper, this.skeleton.bones[arm.upper].getTransformNode());
      group.addTargetedAnimation(lower, this.skeleton.bones[arm.lower].getTransformNode());
      arm.animation = group;
    }
    this._updateArmAnimation(upperArm, arm.animation.targetedAnimations[0], arm.upperRot);
    this._updateArmAnimation(lowerArm, arm.animation.targetedAnimations[1], arm.lowerRot);
    if ( arm.animation.isPlaying ) {
      arm.animation.stop();
    }
    arm.animation.play(false);
  }
  
  _createArmAnimation(name) {
    var anim = new BABYLON.Animation(name, 'rotationQuaternion', this.fps, BABYLON.Animation.ANIMATIONTYPE_QUATERNION, BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE);
    var keys = []; 
    keys.push({frame:0, value: 0});
    keys.push({frame:1, value: 0});
    anim.setKeys(keys);
    return anim;
  }
  _updateArmAnimation(arm, anim, dest) {
    anim.animation.getKeys()[0].value = arm.getTransformNode().rotationQuaternion;
    anim.animation.getKeys()[1].value = dest;
  }

  bendArm( arm, length ) {
    var ret = true;
    var upperArm = this.skeleton.bones[arm.upper];
    var lowerArm = this.skeleton.bones[arm.lower];
    var scaling = this.rootMesh.scaling.x;

    if ( length > arm.lowerLength + arm.upperLength ) {
      length = arm.lowerLength + arm.upperLength
      ret = false;
    }

    // simplified math by using same length for both bones
    // it's right angle, hypotenuse is bone
    // length/2 is sinus of half of elbow angle
    var boneLength = (arm.lowerLength + arm.upperLength)/2;
    var innerAngle = Math.asin(length/2/boneLength);
    //this.log("Bone length: "+boneLength+" distance to target "+length);
    var shoulderAngle = Math.PI/2-innerAngle;
    var elbowAngle = shoulderAngle*2;

    var fix = BABYLON.Quaternion.RotationAxis(arm.frontAxis.axis,-shoulderAngle*arm.frontAxis.sign);
    arm.upperRot = arm.upperRot.multiply(fix);

    arm.lowerRot = BABYLON.Quaternion.RotationAxis(arm.frontAxis.axis,elbowAngle*arm.frontAxis.sign);
    //this.log("Angle shoulder: "+shoulderAngle+" elbow: "+elbowAngle+" length: "+length);
    return ret;
  }

  legLength() {
    return (this.body.leftLeg.upperLength + this.body.leftLeg.lowerLength + this.body.rightLeg.upperLength + this.body.rightLeg.lowerLength)/2;
  }

  setPosition( pos ) {
    this.rootMesh.position.x = pos.x;
    this.groundLevel( pos.y );
    this.rootMesh.position.z = pos.z;
  }

  setRotation( quat ) {
    this.rootMesh.rotationQuaternion = quat;
  }

  groundLevel( y ) {
    this.groundHeight = y;
    this.rootMesh.position.y = this.rootMesh.position.y + y;
  }

  jump( height ) {
    this.rootMesh.position.y = this.groundHeight + height;
  }

  standUp() {
    this.jump(0);
    this.bendLeg( this.body.leftLeg, 10 );
    this.bendLeg( this.body.rightLeg, 10 );
  }

  rise( height ) {
    if ( height < 0.001 ) {
      // ignoring anything less than 1mm
      return;
    }

    if ( this.headPos().y + height > this.initialHeadPos.y ) {
      height = this.initialHeadPos.y - this.headPos().y;
    }
    var legLength = (this.body.leftLeg.length + this.body.rightLeg.length)/2;
    var length = legLength+height;
    this.bendLeg( this.body.leftLeg, length );
    this.bendLeg( this.body.rightLeg, length );

    this.rootMesh.position.y += height;
  }

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

    this.rootMesh.position.y -= height;
  }

  bendLeg( leg, length ) {
    if ( length < 0 ) {
      console.log("ERROR: can't bend leg to "+length);
      return
    }
    var upper = this.skeleton.bones[leg.upper];
    var lower = this.skeleton.bones[leg.lower];
    var scaling = this.rootMesh.scaling.x;

    if ( length > leg.lowerLength + leg.upperLength ) {
      length = leg.lowerLength + leg.upperLength;
      if ( length == leg.length ) {
        return;
      }
    }
    leg.length = length;

    if ( ! leg.upperQuat ) {
      leg.upperQuat = BABYLON.Quaternion.FromRotationMatrix(upper.getWorldMatrix().getRotationMatrix());
      leg.upperQuatInv = BABYLON.Quaternion.Inverse(leg.upperQuat);

      leg.lowerQuat = BABYLON.Quaternion.FromRotationMatrix(lower.getWorldMatrix().getRotationMatrix());
      leg.lowerQuatInv = BABYLON.Quaternion.Inverse(leg.lowerQuat);

      leg.upperRot = upper.getTransformNode().rotationQuaternion.clone();
    }

    // simplified math by using same length for both bones
    // it's right angle, hypotenuse is bone
    // length/2 is sinus of half of elbow angle
    var boneLength = (leg.lowerLength + leg.upperLength)/2;
    var innerAngle = Math.asin(length/2/boneLength);
    //this.log("Bone length: "+boneLength+" distance to target "+length);
    var upperAngle = Math.PI/2-innerAngle;
    var lowerAngle = upperAngle*2;

    var axis = leg.frontAxis.axis;
    var sign = leg.frontAxis.sign;

    var upperQuat = BABYLON.Quaternion.RotationAxis(axis,upperAngle*sign);

    //var upperRot = upper.getTransformNode().rotationQuaternion;
    upper.getTransformNode().rotationQuaternion = leg.upperRot.multiply(upperQuat);

    var fix = leg.upperQuat.multiply(leg.lowerQuatInv);
    var lowerQuat = BABYLON.Quaternion.RotationAxis(axis,-lowerAngle*sign);
    lowerQuat = lowerQuat.multiply(fix);

    lower.getTransformNode().rotationQuaternion = lowerQuat;

    return length;
  }

  // lenght of an arm or leg
  calcLength(limb) {
    var upper = this.skeleton.bones[limb.upper];
    var lower = this.skeleton.bones[limb.lower];
    var scaling = this.rootMesh.scaling.x;
    limb.upperLength = upper.getAbsolutePosition().subtract(lower.getAbsolutePosition()).length()*scaling;
    if ( lower.children && lower.children[0] ) {
      limb.lowerLength = lower.getAbsolutePosition().subtract(lower.children[0].getAbsolutePosition()).length()*scaling;
    } else {
      limb.lowerLength = 0;
    }
    limb.length = limb.upperLength+limb.lowerLength;
    this.log("Length of "+upper.name+": "+limb.upperLength+", "+lower.name+": "+limb.lowerLength);
  }

  sum(vector) {
    return vector.x+vector.y+vector.z;
  }

  // FIXME
  rotateBoneTo(bone, axis, angle) {
    var rotationMatrix = BABYLON.Matrix.RotationAxis(axis,angle);
    var rotated = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);
    bone.setRotationQuaternion(rotated);
  }

  rotateBoneFor(bone, axis, increment) {
    var rotationMatrix = BABYLON.Matrix.RotationAxis(axis,increment);
    var quat = bone.rotationQuaternion;
    var rotated = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);
    bone.setRotationQuaternion(quat.multiply(rotated));
  }

  guessArmsRotations() {

    var leftUpperArm = this.skeleton.bones[this.body.leftArm.upper];
    var leftLowerArm = this.skeleton.bones[this.body.leftArm.lower];
    var rightUpperArm = this.skeleton.bones[this.body.rightArm.upper];
    var rightLowerArm = this.skeleton.bones[this.body.rightArm.lower];

    // heuristics, assume both arm rotate around same rotation axis
    this.body.leftArm.sideAxis = this.guessRotation(leftUpperArm, BABYLON.Axis.Y);
    //this.body.rightArm.sideAxis = this.guessRotation(rightUpperArm, BABYLON.Axis.Y);
    this.body.rightArm.sideAxis = this.guessRotation(rightUpperArm, BABYLON.Axis.Y, this.body.leftArm.sideAxis.axis);

    this.body.leftArm.frontAxis = this.guessRotation(leftUpperArm, BABYLON.Axis.Z);
    //this.body.rightArm.frontAxis = this.guessRotation(rightUpperArm, BABYLON.Axis.Z);
    this.body.rightArm.frontAxis = this.guessRotation(rightUpperArm, BABYLON.Axis.Z, this.body.leftArm.frontAxis.axis);

    //this.debugViewer1 = new BABYLON.Debug.BoneAxesViewer(scene, leftUpperArm, this.rootMesh);

    this.log("Left arm axis, side: "+this.body.leftArm.sideAxis.sign + this.body.leftArm.sideAxis.axis);
    this.log("Left arm axis, front: "+this.body.leftArm.frontAxis.sign + this.body.leftArm.frontAxis.axis);
    this.log("Right arm axis, side: "+this.body.rightArm.sideAxis.sign + this.body.rightArm.sideAxis.axis);
    this.log("Right arm axis, front: "+this.body.rightArm.frontAxis.sign + this.body.rightArm.frontAxis.axis);

    this.body.leftArm.upperRot = BABYLON.Quaternion.FromRotationMatrix(leftUpperArm.getRotationMatrix());
    this.body.leftArm.lowerRot = BABYLON.Quaternion.FromRotationMatrix(leftLowerArm.getRotationMatrix());

    this.body.rightArm.upperRot = BABYLON.Quaternion.FromRotationMatrix(rightUpperArm.getRotationMatrix());
    this.body.rightArm.lowerRot = BABYLON.Quaternion.FromRotationMatrix(rightLowerArm.getRotationMatrix());
  }

  guessLegsRotations() {

    var leftUpperLeg = this.skeleton.bones[this.body.leftLeg.upper];
    var leftLowerLeg = this.skeleton.bones[this.body.leftLeg.lower];
    var rightUpperLeg = this.skeleton.bones[this.body.rightLeg.upper];
    var rightLowerLeg = this.skeleton.bones[this.body.rightLeg.lower];

    //this.debugViewer1 = new BABYLON.Debug.BoneAxesViewer(scene, leftUpperLeg, this.rootMesh);
    //this.debugViewer2 = new BABYLON.Debug.BoneAxesViewer(scene, leftLowerLeg, this.rootMesh);

    this.body.leftLeg.frontAxis = this.guessRotation(leftUpperLeg, BABYLON.Axis.Z);
    this.body.rightLeg.frontAxis = this.guessRotation(rightUpperLeg, BABYLON.Axis.Z, this.body.leftLeg.frontAxis.axis);

    //this.log("Left leg axis, front: "+this.body.leftLeg.frontAxis.sign + this.body.leftLeg.frontAxis.axis);

    this.body.leftLeg.upperRot = BABYLON.Quaternion.FromRotationMatrix(leftUpperLeg.getRotationMatrix());
    this.body.leftLeg.lowerRot = BABYLON.Quaternion.FromRotationMatrix(leftLowerLeg.getRotationMatrix());

    this.body.rightLeg.upperRot = BABYLON.Quaternion.FromRotationMatrix(rightUpperLeg.getRotationMatrix());
    this.body.rightLeg.lowerRot = BABYLON.Quaternion.FromRotationMatrix(rightLowerLeg.getRotationMatrix());
  }

  guessRotation(bone, maxAxis, rotationAxis) {
    var axes = [BABYLON.Axis.X,BABYLON.Axis.Y,BABYLON.Axis.Z];
    if ( rotationAxis ) {
      axes = [ rotationAxis ];
    }
    var angles = [Math.PI/2,-Math.PI/2];
    var axis;
    var angle;
    var max = 0;
    for ( var i = 0; i < axes.length; i++ ) {
      for ( var j = 0; j<angles.length; j++ ) {
        var ret = this.tryRotation(bone, axes[i], angles[j]).multiply(maxAxis);
        var result = ret.x+ret.y+ret.z;
        if ( result > max ) {
          axis = axes[i];
          angle = angles[j];
          max = result;
        }
      }
    }
    //this.log("Got it: "+axis+" "+angle+" - "+max);
    return {axis:axis,sign:Math.sign(angle)};
  }

  tryRotation(bone, axis, angle) {
    var target = bone.children[0];
    var original = bone.getRotationQuaternion();
    var oldPos = target.getAbsolutePosition();
    var rotationMatrix = BABYLON.Matrix.RotationAxis(axis,angle);
    var quat = bone.rotationQuaternion;
    var rotated = BABYLON.Quaternion.FromRotationMatrix(rotationMatrix);
    bone.setRotationQuaternion(quat.multiply(rotated));
    //this.scene.render(); // doesn't work in XR
    //bone.computeWorldMatrix(true); // not required
    bone.computeAbsoluteTransforms();
    var newPos = target.getAbsolutePosition();
    bone.setRotationQuaternion(original);
    bone.computeAbsoluteTransforms();
    var ret = newPos.subtract(oldPos);
    //this.log("Tried "+axis+" "+angle+" - "+ret.z);
    return ret;
  }

  euler(node) {
    return node.rotationQuaternion.toEulerAngles();
  }
  degrees(node) {
    var rot = euler(node);
    return toDegrees(rot);
  }

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
            //this.body.root = bones[i].name;
            this.body.root = i;
            this.log("found root "+boneName+" at depth "+this.bonesDepth);
            this.processBones(bones[i].children);
          } else if ( ! this.body.hips && this.isHipsName(boneName) && bones[i].children.length >= 3) {
          //} else if ( ! this.body.hips && bones[i].children.length >= 3) {
            //this.body.hips = bones[i].name;
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
           boneName.includes( lr+'_' ) ||
           boneName.includes( ' '+lr+' ' ) ||
           boneName.includes(lr+'thigh') ||
           boneName.includes(lr+'hip') ||
           ( children.length > 0 && children[0].children.length > 0  && children[0].name.toLowerCase().includes(lr+"_") )
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
    if ( this.body.neck.neck && this.bonesProcessed.includes(bone.name) ) {
      this.log("neck "+bone.name+" already processed: "+this.body.neck.neck);
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
    head.getDirectionToRef(BABYLON.Axis.Z,this.rootMesh,refHead);
    this.roundVector(refHead);
    this.log("RefZ head: "+refHead);

    var refNeck = new BABYLON.Vector3();
    neck.getDirectionToRef(BABYLON.Axis.Z,this.rootMesh,refNeck);
    this.roundVector(refNeck);
    this.log("RefZ neck: "+refNeck);

    // some characters have Z axis of neck and head pointing in opposite direction
    // (rotated around Y) causing rotation to point backwards,
    // they need different calculation
    this.headAxisFix = refHead.z * refNeck.z;

    this.headQuat = BABYLON.Quaternion.FromRotationMatrix(head.getWorldMatrix().getRotationMatrix());
    this.headQuatInv = BABYLON.Quaternion.Inverse(this.headQuat);

    this.neckQuat = BABYLON.Quaternion.FromRotationMatrix(neck.getWorldMatrix().getRotationMatrix());
    this.neckQuatInv = BABYLON.Quaternion.Inverse(this.neckQuat);

    var target = new BABYLON.Vector3(0,0,1);
    target.rotateByQuaternionToRef(BABYLON.Quaternion.Inverse(this.rootMesh.rotationQuaternion),target);
    target.rotateByQuaternionToRef(this.headQuatInv,target);

    this.headTarget = target.negate().normalizeToNew();

    this.log("Head target: "+this.headTarget+" axisFix "+this.headAxisFix);

    this.boneProcessed(bone);
    //this.processBones(bone.children);
    this.countBones(bone.children);
  }

  roundVector(vec) {
    vec.x = Math.round(vec.x);
    vec.y = Math.round(vec.y);
    vec.z = Math.round(vec.z);
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

  // unused, use only for debugging characters
  processAnimations(targeted) {
    var frames = [];
    for ( var j = 0; j < targeted.length; j++ ) {
      //this.log("animation: "+animations[j].animation.name+" target: "+animations[i].target.name);
      if ( !this.animationTargets.includes(targeted[j].target.name) ) {
        this.animationTargets.push(targeted[j].target.name);
        if ( ! this.bonesProcessed.includes(targeted[j].target.name) ) {
          this.log("Missing target "+targeted[j].target.name);
        }
      }
      var keys = targeted[j].animation.getKeys();
      for ( var i = 0; i < keys.length; i++ ) {
        // square complexity
        if ( ! frames.includes(keys[i].frame) ) {
          frames.push( keys[i].frame );
        }
      }
    }
  }

  startAnimation(animationName) {
    for ( var i = 0; i < this.getAnimationGroups().length; i++ ) {
      var group = this.getAnimationGroups()[i];
      if ( group.name == animationName ) {
        //this.log("Animation group: "+animationName);
        if ( group.isPlaying ) {
          group.pause();
          this.log("paused "+animationName);
        } else {
          if ( this.fixes && typeof this.fixes.beforeAnimation !== 'undefined' ) {
            this.log( "Applying fixes for: "+this.folder.name+" beforeAnimation: "+this.fixes.beforeAnimation);
            this.groundLevel( this.fixes.beforeAnimation );
          }
          this.jump(0);
          group.play(group.loopAnimation);
          this.log("playing "+animationName);
          this.activeAnimation = animationName;
        }
      } else if ( group.isPlaying ) {
        // stop all other animations
        group.pause();
        group.reset();
      }
    }
  }

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

  resize() {
    var scale = this.rootMesh.scaling.y;
    scale = scale*this.userHeight/this.headPos().y;
    this.rootMesh.scaling = new BABYLON.Vector3(scale,scale,scale);
    this.initialHeadPos = this.headPos();
    this.log("Rescaling to "+scale+", head position "+this.initialHeadPos);
    return scale;
  }
}