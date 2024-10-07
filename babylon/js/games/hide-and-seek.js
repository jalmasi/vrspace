import { BasicScript } from "../scripts/basic-script.js";
import { VisibilitySensor } from "../world/visibility-sensor.js";
import { Dialogue } from "../ui/widget/dialogue.js";
import { VRSPACE } from "../client/vrspace.js";
import { ID } from "../client/vrspace.js";
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { Form } from '../ui/widget/form.js';

class GameStatus extends Form {
  constructor(isMine, callback) {
    super();
    this.text = "Players joined: ";
    this.callback = callback;
    this.isMine = isMine;
  }  
  
  init() {
    this.verticalPanel = true;
    this.createPanel();
    this.label = this.textBlock(this.text+"0");
    this.addControl(this.label);
    if ( this.isMine ) {
      let startButton = this.textButton("Start", () => this.callback(true));
      this.addControl(startButton);
    }
    let quitButton = this.textButton("Quit", () => this.callback(false), VRSPACEUI.contentBase+"/content/icons/close.png", "red");
    this.addControl(quitButton);

    VRSPACEUI.hud.showButtons(false);
    VRSPACEUI.hud.newRow();
    VRSPACEUI.hud.addForm(this,512,256);
  }
  
  numberOfPlayers(num) {
    this.label.text = this.text+num;
  }
}

/**
 * Super original hide and seek game!
 * 
 * Player that started the game needs to search for other players.
 * If seen, both players rush to the place where the game started, first one to arrive, scores.
 */
export class HideAndSeek extends BasicScript {
  constructor( world, vrObject ) {
    super(world,vrObject);
    this.visibilitySensor = new VisibilitySensor();
    this.fps = 5;
    this.seconds = 20;
    this.goalRadius = 1.5;
    this.gameIcon = VRSPACEUI.contentBase + "/content/emoji/cool.png";
    this.searchIcon = VRSPACEUI.contentBase + "/content/icons/search.png";
    this.foundIcon = VRSPACEUI.contentBase + "/content/icons/eye.png";
    this.wonIcon = VRSPACEUI.contentBase + "/content/icons/tick.png";
    this.lostIcon = VRSPACEUI.contentBase + "/content/icons/close.png";
    this.totalPlayers = vrObject.numberOfPlayers;
    this.invitePlayers();
    this.markStartingPosition();
    this.seen = {};
    this.winners = {};
    this.losers = {};
    this.players = [];
    this.indicators = [];
    this.materials = [];
  }
  
  dispose() {
    this.closeGameStatus();
    this.visibilitySensor.dispose();
    this.visibilitySensor = null;
    if ( this.visibilityCheck ) {
      clearInterval(this.visibilityCheck);
    }
    if ( this.particleSystem ) {
      this.particleSystem.dispose();
      this.particleSystem = null;
      this.particleSource.dispose();
      this.goal.dispose();
      this.goalMaterial.dispose();
    }
    this.indicators.forEach( i => {
      i.parent.GameIndicator = null;
      delete i.parent.GameIndicator;
      i.dispose();
    });
    this.materials.forEach( m => m.dispose());
  }
  
  markStartingPosition() {
    if ( BABYLON.GPUParticleSystem.IsSupported ) {
      this.particleSystem = new BABYLON.GPUParticleSystem("GoalParticles", {capacity: 200}, this.scene);
    } else {
      this.particleSystem = new BABYLON.ParticleSystem("GoalParticles", 200, this.scene);
    }
    this.particleSystem.disposeOnStop = true;
    this.particleSystem.particleTexture = new BABYLON.Texture(this.gameIcon, this.scene);
    this.particleSource = BABYLON.MeshBuilder.CreateSphere("particlePositon",{diameter: 0.1},this.scene);
    this.particleSource.isVisible = false;

    let pos = this.vrObject.position;
    this.particleSource.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);

    this.particleSystem.emitter = this.particleSource;
    this.particleSystem.addColorGradient(0, new BABYLON.Color4(.1, .1, .1, .5), new BABYLON.Color4(.2, .2, .2, .5));
    this.particleSystem.addColorGradient(0.1, new BABYLON.Color4(1, 1, 1, 1), new BABYLON.Color4(0.9, 0.9, 0.9, 1));
    this.particleSystem.addColorGradient(0.5, new BABYLON.Color4(.5, .5, .5, 1), new BABYLON.Color4(0.9, 0.9, 0.9, 1));
    this.particleSystem.addColorGradient(1, new BABYLON.Color4(.1, .1, .1, .5), new BABYLON.Color4(.2, .2, .2, .5));

    this.particleSystem.addSizeGradient(0, 0.05); //size at start of particle lifetime
    this.particleSystem.addSizeGradient(.5, .3); //size at half lifetime
    this.particleSystem.addSizeGradient(1, .1); //size at end of particle lifetime

    this.particleSystem.addVelocityGradient(0, 1);
    this.particleSystem.addVelocityGradient(1, 0);
    this.particleSystem.maxInitialRotation=Math.PI;
    this.particleSystem.maxAngularSpeed=5*Math.PI;

    this.particleSystem.minLifeTime = 3;
    this.particleSystem.maxLifeTime = 4;

    this.particleSystem.emitRate = 50;
    
    this.particleSystem.createSphereEmitter(0.5,1);
    
    this.particleSystem.minEmitPower = 0.1;
    this.particleSystem.maxEmitPower = 1;
    this.particleSystem.updateSpeed = 0.005;
    this.particleSystem.gravity = new BABYLON.Vector3(0,-10,0);
    
    this.particleSystem.start();
    
    let animation = VRSPACEUI.createAnimation(this.particleSource, "position", 0.05);
    VRSPACEUI.updateAnimation(animation,new BABYLON.Vector3(pos.x, pos.y, pos.z),new BABYLON.Vector3(pos.x, pos.y+20, pos.z));
    
    this.goal = BABYLON.MeshBuilder.CreateCylinder("Goal", {height:.2,diameter:this.goalRadius*2}, this.scene);
    this.goal.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    this.goalMaterial = new BABYLON.StandardMaterial("GoalMaterial",this.scene);
    this.goalMaterial.emissiveTexture = new BABYLON.Texture(this.gameIcon, this.scene);
    this.goalMaterial.disableLighting = true;
    this.goal.material = this.goalMaterial;
  }
  
  invitePlayers() {
    if ( this.isMine() ) {
      this.joinGame(true);
    } else {
      let yesNo = new Dialogue("Join "+this.vrObject.name+" ?", (yes)=>this.joinGame(yes));
      yesNo.init();
    }
  }
  
  showGameStatus() {
    if ( ! this.gameStatus ) {
      this.gameStatus = new GameStatus(this.isMine(), (start)=>{
        if ( start ) {
          this.startGame();
        } else {
          this.quitGame();
        }
      });
      this.gameStatus.init();
      this.gameStatus.numberOfPlayers(this.totalPlayers);
    }
  }
  
  closeGameStatus() {
    if ( this.gameStatus ) {
      VRSPACEUI.hud.clearRow();
      VRSPACEUI.hud.showButtons(true);
      this.gameStatus.dispose();
      this.gameStatus = null;
    }
  }
  
  joinGame(yes) {
    if ( yes ) {
      this.showGameStatus();
      VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"join"});
      // TODO replace current HUD with in-game HUD
    }
  }

  quitGame() {
    VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"quit"});
    // TODO replace in-game HUD with previous one
  }
  
  addIndicator(baseMesh,icon,color=new BABYLON.Color4(1,1,1,1)) {
    if ( typeof baseMesh.GameIndicator !== "undefined") {
      //baseMesh.GameIndicator.material.emissiveTexture = new BABYLON.Texture(icon, this.scene);
      baseMesh.GameIndicator.material.diffuseTexture = new BABYLON.Texture(icon, this.scene);
    } else {
      let indicator = BABYLON.MeshBuilder.CreatePlane("IndicatorIcon", {}, this.scene);
      indicator.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
      let material = new BABYLON.StandardMaterial("IndicatorMaterial",this.scene);
      //material.emissiveTexture = new BABYLON.Texture(icon, this.scene);
      material.diffuseTexture = new BABYLON.Texture(icon, this.scene);
      material.disableLighting = true;
      material.alpha = 0;
      material.alphaMode = BABYLON.Constants.ALPHA_ONEONE;
      //material.backFaceCulling = false;
      indicator.material = material;
      indicator.position = new BABYLON.Vector3(0,2.5,0);
      //indicator.rotation = new BABYLON.Vector3(Math.PI,0,0);
      indicator.parent = baseMesh;
      baseMesh.GameIndicator = indicator;
      this.indicators.push(indicator);
    }
    baseMesh.GameIndicator.material.emissiveColor = color;
  }
  
  updateStatus() {
    // may not be displayed before this player joins/after quit/etc
    if ( this.gameStatus ) {
      this.gameStatus.numberOfPlayers(this.totalPlayers);
    }
  }
  
  changePlayerIcon( playerEvent, icon, color ) {
    if ( playerEvent.className == VRSPACE.me.className && playerEvent.id == VRSPACE.me.id ) {
      // my avatar
      this.addIndicator( this.world.avatar.baseMesh(), icon, color);
    } else {
      // someone else
      let avatar = this.players.find(baseMesh => baseMesh.VRObject.id == playerEvent.id);
      // CHECKME in some cases this avatar may not exist
      this.addIndicator( avatar, icon, color );
    }
  }
  
  remoteChange(vrObject, changes) {
    console.log("Remote changes for "+vrObject.id, changes);
    if ( changes.joined ) {
      this.totalPlayers++;
      this.updateStatus();
      let id = new ID(changes.joined.className,changes.joined.id);
      if ( id.className == VRSPACE.me.className && id.id == VRSPACE.me.id ) {
        console.log("that's me");
      } else {
        let user = VRSPACE.getScene().get(id.toString());
        if ( user ) {
          this.players.push(user.avatar.baseMesh());
        } else {
          console.error( id +" joined the game but is not in local scene");
        }
      }
    } else if ( changes.quit ) {
      this.totalPlayers--;
      this.updateStatus();
      let id = new ID(changes.quit.className,changes.quit.id);
      if ( id.className == VRSPACE.me.className && id.id == VRSPACE.me.id ) {
        console.log("that's me");
      } else {
        let user = VRSPACE.getScene().get(id.toString());
        if ( user ) {
          let pos = this.players.indexOf(user.avatar.baseMesh());
          if ( pos > -1 ) {
            this.players.splice(pos,1);
          }
        } else {
          console.error( id +" quit the game but is not in local scene");
        }
      }
    } else if ( changes.seen ) {
      this.changePlayerIcon(changes.seen, this.foundIcon);
    } else if ( changes.start ) {
      this.closeGameStatus();
      this.changePlayerIcon(changes.start, this.searchIcon);
    } else if (changes.won) {
      this.changePlayerIcon(changes.won, this.wonIcon, new BABYLON.Color4(0,1,0,1));
    } else if (changes.lost) {
      this.changePlayerIcon(changes.lost, this.lostIcon, new BABYLON.Color4(1,0,0,1));
    } else if ( changes.end ) {
      console.log("TODO game ended, who won?")
    } else {
      console.error("Unknown notification: ", changes);
    }
  }
 
  startGame() {
    console.log("TODO: countdown");
    // and then
    if ( this.isMine() ) {
      this.visibilityCheck = setInterval( () => this.checkVisibility(), 1000/this.fps);
      VRSPACE.sendCommand("Game", {id: this.vrObject.id, action:"start"});
    }
    // TODO range check, victory conditions check
  }
  
  inGoalRange(pos) {
    let dx = pos.x - this.goal.position.x;
    let dz = pos.z - this.goal.position.z;
    let radius = Math.sqrt( dx*dx + dz*dz );
    return radius <= this.goalRadius;
  }
  
  checkVisibility() {
    let visible = this.visibilitySensor.getVisibleOf(this.players);
    if ( visible.length > 0 ) {
      // anyone not seen before?
      visible.forEach( (parentMesh) => {
        let id = parentMesh.VRObject.className+" "+parentMesh.VRObject.id;
        if ( ! this.seen[id]) {
          this.seen[id] = parentMesh.VRObject;
          VRSPACE.sendEvent(this.vrObject, {seen: {className: parentMesh.VRObject.className, id: parentMesh.VRObject.id} });
        }
      });
      // anyone at the goal area?
      for ( let id in this.seen ) {
        let vrObject = this.seen[id];
        if ( !this.winners.hasOwnProperty(id) && !this.losers.hasOwnProperty(id) && this.inGoalRange(vrObject.avatar.baseMesh().position) ) {
          // add to winners, send notification
          this.winners[id] = vrObject;
          VRSPACE.sendEvent(this.vrObject, {won: {className: vrObject.className, id: vrObject.id} });
          console.log("TODO: check for game end")
        }
      }
      // am I at the goal area?
      // FIXME this works only for 1st person camera
      if ( this.inGoalRange(this.scene.activeCamera.position) ) {
        let caught = 0;
        for ( let id in this.seen ) {
          if ( !this.winners.hasOwnProperty(id) && !this.losers.hasOwnProperty(id) ) {
            caught++;
            let vrObject = this.seen[id];
            // add to losers, send notification
            this.losers[id] = vrObject;
            VRSPACE.sendEvent(this.vrObject, {lost: {className: vrObject.className, id: vrObject.id} });
          }
        }
        if ( caught > 0 ) {
          console.log("TODO option to end the game");
        }
      }
      
    }
  }
  
}