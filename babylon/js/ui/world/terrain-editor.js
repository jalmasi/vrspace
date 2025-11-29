import { VRSPACEUI } from '../vrspace-ui.js';
import { World } from '../../world/world.js';
import { TextureSelector } from './texture-selector.js';

export class TerrainEditor {
  /**
   * @param {World} world 
   */
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.terrain = world.terrain;
    this.heightIncrement = 1;
    this.editing = false;
    this.textureSelector = new TextureSelector(this.scene, (img) => this.publishTexture(img));
    // add own selection predicate to the world
    this.selectionPredicate = (mesh) => this.isSelectableMesh(mesh);
    world.addSelectionPredicate(this.selectionPredicate);
    this.observer = null;
    this.groundPickable = null;
    this.movementMode = null;
  }

  createSharedTerrain() {
    if (!World.lastInstance.sharedTerrain) {
      var object = {
        permanent: true,
        active: true,
        specularColor: this.terrain.terrainMaterial.specularColor,
        diffuseColor: this.terrain.terrainMaterial.diffuseColor,
        emissiveColor: this.terrain.terrainMaterial.emissiveColor
      };
      this.world.worldManager.VRSPACE.createSharedObject(object, "Terrain").then(obj => {
        console.log("Created new Terrain", obj);
        World.lastInstance.sharedTerrain = obj;
      });
    }
  }

  edit() {
    this.createSharedTerrain();
    if (!this.observer) {
      this.observer = this.scene.onPointerObservable.add((pointerInfo) => {
        switch (pointerInfo.type) {
          case BABYLON.PointerEventTypes.POINTERDOWN:
            if (pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh == this.terrain.mesh()) {
              this.lastIndex = this.updatePicked(pointerInfo.pickInfo);
              this.terrain.mesh().enablePointerMoveEvents = true;
            }
            break;
          case BABYLON.PointerEventTypes.POINTERUP:
            this.lastIndex = -1;
            this.terrain.mesh().enablePointerMoveEvents = false;
            break;
          case BABYLON.PointerEventTypes.POINTERMOVE:
            if (this.lastIndex >= 0 && pointerInfo.pickInfo.pickedMesh == this.terrain.mesh()) {
              var newIndex = this.terrain.findIndex(pointerInfo.pickInfo.pickedPoint.x, pointerInfo.pickInfo.pickedPoint.z);
              if (newIndex != this.lastIndex) {
                this.lastIndex = newIndex;
                this.updatePicked(pointerInfo.pickInfo);
              }
            }
            break;
        }
      });
    }

    if (World.lastInstance.ground) {
      this.groundPickable = World.lastInstance.ground.isPickable;
      World.lastInstance.ground.isPickable = false;
    }

    this.raiseButton = VRSPACEUI.hud.addButton("Raise", VRSPACEUI.contentBase + "/content/icons/upload.png");
    this.digButton = VRSPACEUI.hud.addButton("Dig", VRSPACEUI.contentBase + "/content/icons/download.png");
    this.textureButton = VRSPACEUI.hud.addButton("Texture", VRSPACEUI.contentBase + "/content/icons/terrain-texture.png");
    this.raiseSlider = VRSPACEUI.hud.addSlider("Height", 0, 2, this.heightIncrement)

    this.raiseButton.onPointerDownObservable.add(() => {
      this.direction = 1;
      VRSPACEUI.hud.showButtons(this.editing, this.raiseButton, this.raiseSlider);
      this.world.enableFloorSelection(this.editing);
      this.enableMovement(this.editing);
      this.editing = !this.editing;
      this.terrain.terrainMaterial.wireframe = this.editing;
    });
    this.digButton.onPointerDownObservable.add(() => {
      this.direction = -1;
      VRSPACEUI.hud.showButtons(this.editing, this.digButton, this.raiseSlider);
      this.world.enableFloorSelection(this.editing);
      this.enableMovement(this.editing);
      this.editing = !this.editing;
      this.terrain.terrainMaterial.wireframe = this.editing;
    });
    this.textureButton.onPointerDownObservable.add(() => {
      this.editing = !this.editing;
      if (this.editing) {
        this.textureSelector.show();
      } else {
        this.textureSelector.hide();
      }
      VRSPACEUI.hud.showButtons(!this.editing, this.textureButton);
    });
    this.raiseSlider.onValueChangedObservable.add(value => { this.heightIncrement = value });

    this.diffusePicker = VRSPACEUI.hud.addColorPicker("Diffuse", this.terrain.terrainMaterial.diffuseColor);
    this.specularPicker = VRSPACEUI.hud.addColorPicker("Specular", this.terrain.terrainMaterial.specularColor);
    this.emissivePicker = VRSPACEUI.hud.addColorPicker("Emissive", this.terrain.terrainMaterial.emissiveColor);
    this.specularPicker.onValueChangedObservable.add((val) => {
      //this.terrain.terrainMaterial.specularColor.copyFrom(val);
      this.world.worldManager.VRSPACE.sendEvent(World.lastInstance.sharedTerrain, { specularColor: val });
    });
    this.diffusePicker.onValueChangedObservable.add((val) => {
      //this.terrain.terrainMaterial.diffuseColor.copyFrom(val);
      this.world.worldManager.VRSPACE.sendEvent(World.lastInstance.sharedTerrain, { diffuseColor: val });
    });
    this.emissivePicker.onValueChangedObservable.add((val) => {
      //this.terrain.terrainMaterial.emissiveColor.copyFrom(val);
      this.world.worldManager.VRSPACE.sendEvent(World.lastInstance.sharedTerrain, { emissiveColor: val });
    });

    VRSPACEUI.hud.enableSpeech(true);
  }

  enableMovement(enable) {
    if (!enable) {
      this.movementMode = this.world.xrHelper.disableMovement();
    } else if (this.movementMode) {
      this.world.xrHelper.enableMovement(this.movementMode);
    }
  }

  updatePicked(pickInfo) {
    var index = -1;
    var x = pickInfo.pickedPoint.x;
    var z = pickInfo.pickedPoint.z;
    if (this.editing) {
      var online = this.world.isOnline() && World.lastInstance.sharedTerrain;
      if (online) {
        // if online, terrain is not refreshed until the server responds with updated height
        index = this.terrain.findIndex(x, z);
        if (index) {
          var point = this.terrain.point(index);
          point.y += this.heightIncrement * this.direction;
          // publish updates
          var change = { change: { index: index, point: point } };
          this.world.worldManager.VRSPACE.sendEvent(World.lastInstance.sharedTerrain, change);
        } else {
          console.log("ERROR: index " + index + " for " + x + "," + z);
        }
      } else {
        index = this.terrain.raise(x, z, this.heightIncrement * this.direction, online);
      }
    }
    return index;
  }

  publishTexture(imgUrl) {
    console.log("Publishing texture: " + imgUrl);
    this.world.worldManager.VRSPACE.sendEvent(World.lastInstance.sharedTerrain, { diffuseTexture: imgUrl });
  }

  dispose() {
    this.world.removeSelectionPredicate(this.selectionPredicate);
    this.world.removeListener(this);
    this.terrain.terrainMaterial.wireframe = false;
    this.scene.onPointerObservable.remove(this.observer);
    this.raiseButton.dispose();
    this.digButton.dispose();
    this.textureButton.dispose();
    this.raiseSlider.dispose();
    if (World.lastInstance.ground) {
      World.lastInstance.ground.isPickable = this.groundPickable;
    }
    this.enableMovement(true);
  }

  isSelectableMesh(mesh) {
    // terrain is selectable only while editing
    return this.editing && this.terrain && mesh == this.terrain.mesh();
  }
}
