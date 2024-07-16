import {VRSPACEUI} from '../vrspace-ui.js';
import {WorldListener} from '../../world/world-listener.js';
import {TextureSelector} from './texture-selector.js';

export class TerrainEditor extends WorldListener {
  constructor(world) {
    super();
    this.world = world;
    this.scene = world.scene;
    this.terrain = world.terrain;
    this.heightIncrement=1;
    this.sharedTerrain = null;
    this.editing = false;
    world.worldListeners.push(this);
    this.textureSelector = new TextureSelector(this.scene, (img) => this.publishTexture(img));
    // add own selection predicate to the world
    this.selectionPredicate = (mesh) => this.isSelectableMesh(mesh);
    world.addSelectionPredicate(this.selectionPredicate);
  }
  /** Called by WorldManager when user enters the world */
  entered(welcome) {
    console.log(welcome);
    if ( welcome.permanents ) {
      console.log( "Terrain exists" );
      welcome.permanents.forEach( obj => {
        if (obj.Terrain) {
          this.sharedTerrain = obj.Terrain;
          if ( obj.Terrain.points ) {
            obj.Terrain.points.forEach( p => {
              this.terrain.update(p.index, p.x, p.y, p.z);
            });
            this.terrain.refresh();
          }
          if ( obj.Terrain.specularColor ) {
            this.terrain.terrainMaterial.specularColor = new BABYLON.Color3(obj.Terrain.specularColor.r, obj.Terrain.specularColor.g, obj.Terrain.specularColor.b)
          }
          if ( obj.Terrain.diffuseColor ) {
            this.terrain.terrainMaterial.diffuseColor = new BABYLON.Color3(obj.Terrain.diffuseColor.r, obj.Terrain.diffuseColor.g, obj.Terrain.diffuseColor.b)
          }
          if ( obj.Terrain.emissiveColor ) {
            this.terrain.terrainMaterial.emissiveColor = new BABYLON.Color3(obj.Terrain.emissiveColor.r, obj.Terrain.emissiveColor.g, obj.Terrain.emissiveColor.b)
          }
          if ( obj.Terrain.diffuseTexture ) {
            this.setTexture(obj.Terrain.diffuseTexture);
          }
        };
      });
    } else {
      console.log("Creating new terrain");
      this.createSharedTerrain();
    }
  }
  
  added(added) {
    if ( added && added.className == "Terrain") {
      console.log("Terrain added", added);
      this.sharedTerrain = added;
      added.addListener((obj,change)=>this.terrainChanged(change));
      this.terrain.mesh().setEnabled(true);
    }
  }
  
  terrainChanged(e) {
    console.log("Terrain changed", e);
    if ( e.change ) {
      this.terrain.update(e.change.index, e.change.point.x, e.change.point.y, e.change.point.z);
      this.terrain.refresh();
    } else {
      for ( const field in e ) {
        if ( field.indexOf('Color') > 0 ) {
          // e.g. emissiveColor, diffuseColor, specularColor
          console.log(field + "="+e[field]);
          this.terrain.terrainMaterial[field] = new BABYLON.Color3(e[field].r, e[field].g, e[field].b);
        } else if (field.indexOf('Texture') > 0) {
          this.setTexture(e[field]);
        }
      }
    }
  }
  
  createSharedTerrain() {
    var object = {
      permanent: true,
      active:true,
      specularColor:this.terrain.terrainMaterial.specularColor,
      diffuseColor:this.terrain.terrainMaterial.diffuseColor,
      emissiveColor:this.terrain.terrainMaterial.emissiveColor
    };
    this.world.worldManager.VRSPACE.createSharedObject(object, "Terrain").then(obj=>{
      console.log("Created new Terrain", obj);
      this.sharedTerrain = obj;
    });
  }
  
  edit() {
    this.observer = this.scene.onPointerObservable.add((pointerInfo) => {
      switch (pointerInfo.type) {
        case BABYLON.PointerEventTypes.POINTERDOWN:
          if(pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh == this.terrain.mesh()) {
            this.lastIndex = this.updatePicked(pointerInfo.pickInfo);
            this.terrain.mesh().enablePointerMoveEvents = true;
          }
          break;
        case BABYLON.PointerEventTypes.POINTERUP:
          this.lastIndex = -1;
          this.terrain.mesh().enablePointerMoveEvents = false;
          break;
        case BABYLON.PointerEventTypes.POINTERMOVE:
          if ( this.lastIndex >= 0 && pointerInfo.pickInfo.pickedMesh == this.terrain.mesh() ) {
            var newIndex = this.terrain.findIndex(pointerInfo.pickInfo.pickedPoint.x,pointerInfo.pickInfo.pickedPoint.z);
            if ( newIndex != this.lastIndex ) {
              this.lastIndex = newIndex;
              this.updatePicked(pointerInfo.pickInfo);
            }
          }
          break;
        }
    });
    
    this.raiseButton = VRSPACEUI.hud.addButton("Raise", VRSPACEUI.contentBase+"/content/icons/upload.png");
    this.digButton = VRSPACEUI.hud.addButton("Dig", VRSPACEUI.contentBase+"/content/icons/download.png");
    this.textureButton = VRSPACEUI.hud.addButton("Texture", VRSPACEUI.contentBase+"/content/icons/terrain-texture.png");    
    this.raiseSlider = VRSPACEUI.hud.addSlider("Height",0,2,this.heightIncrement)
    
    this.raiseButton.onPointerDownObservable.add( () => {
      this.direction = 1;
      VRSPACEUI.hud.showButtons(this.editing,this.raiseButton,this.raiseSlider);
      this.editing = !this.editing;
      this.terrain.terrainMaterial.wireframe = this.editing;
    });
    this.digButton.onPointerDownObservable.add( () => {
      this.direction = -1;
      VRSPACEUI.hud.showButtons(this.editing,this.digButton,this.raiseSlider);
      this.editing = !this.editing;
      this.terrain.terrainMaterial.wireframe = this.editing;
    });
    this.textureButton.onPointerDownObservable.add( () => {
      this.editing = !this.editing;
      if ( this.editing ) {
        this.textureSelector.show();
      } else {
        this.textureSelector.hide();
      }
      VRSPACEUI.hud.showButtons(!this.editing,this.textureButton,this);
    });
    this.raiseSlider.onValueChangedObservable.add(value=>{this.heightIncrement=value});
    
    this.diffusePicker = VRSPACEUI.hud.addColorPicker("Diffuse", this.terrain.terrainMaterial.diffuseColor);
    this.specularPicker = VRSPACEUI.hud.addColorPicker("Specular", this.terrain.terrainMaterial.specularColor);
    this.emissivePicker = VRSPACEUI.hud.addColorPicker("Emissive", this.terrain.terrainMaterial.emissiveColor);
    this.specularPicker.onValueChangedObservable.add( (val) => {
      //this.terrain.terrainMaterial.specularColor.copyFrom(val);
      this.world.worldManager.VRSPACE.sendEvent(this.sharedTerrain, {specularColor:val});      
    });
    this.diffusePicker.onValueChangedObservable.add( (val) => {
      //this.terrain.terrainMaterial.diffuseColor.copyFrom(val);
      this.world.worldManager.VRSPACE.sendEvent(this.sharedTerrain, {diffuseColor:val});      
    });
    this.emissivePicker.onValueChangedObservable.add( (val) => {
      //this.terrain.terrainMaterial.emissiveColor.copyFrom(val);
      this.world.worldManager.VRSPACE.sendEvent(this.sharedTerrain, {emissiveColor:val});      
    });
    
    VRSPACEUI.hud.enableSpeech(true);
  }
  
  updatePicked( pickInfo ) {
    var index = -1;
    var x = pickInfo.pickedPoint.x;
    var z = pickInfo.pickedPoint.z;
    if ( this.editing ) {
      var online = this.world.isOnline() && this.sharedTerrain;
      if ( online ) {
        // if online, terrain is not refreshed until the server responds with updated height
        index = this.terrain.findIndex(x,z);
        if ( index ) {
          var point = this.terrain.point(index);
          point.y += this.heightIncrement*this.direction;
          // publish updates
          var change = { change: {index: index, point: point} };
          this.world.worldManager.VRSPACE.sendEvent(this.sharedTerrain, change);
        } else {
          console.log("ERROR: index "+index+" for "+x+","+z);
        }
      } else {
        index = this.terrain.raise(x,z,this.heightIncrement*this.direction, online);
      }
    }
    return index;
  }
  publishTexture(imgUrl) {
    console.log("Publishing texture: "+imgUrl);
    this.world.worldManager.VRSPACE.sendEvent(this.sharedTerrain, {diffuseTexture:imgUrl});
  }
  setTexture(imgUrl) {
    console.log("New texture: "+imgUrl);
    if ( this.terrainTexture ) {
      this.terrainTexture.dispose();
    }
    this.terrainTexture = new BABYLON.Texture(imgUrl, this.scene);
    this.terrain.mesh().material.diffuseTexture = this.terrainTexture;
  }
  dispose() {
    this.world.removeSelectionPredicate(this.selectionPredicate);
    // TODO
  }
  isSelectableMesh(mesh) {
    // terrain is selectable only while editing
    return this.editing && this.terrain && mesh == this.terrain.mesh();
  }
}
