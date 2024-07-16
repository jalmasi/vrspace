import { ImageArea } from "../widget/image-area.js";
import { ColorPickerPanel } from '../widget/colorpicker-panel.js';
import { SliderPanel } from '../widget/slider-panel.js';
import { WorldManager } from "../../core/world-manager.js";
import { VRSPACE } from '../../client/vrspace.js';
import { VRSPACEUI } from '../vrspace-ui.js';

export class Whiteboard extends ImageArea {
  constructor(scene, name = "Whiteboard-root") {
    super(scene, name);
    this.backgroundColor = new BABYLON.Color3(1, 1, 1);
    this.foregroundColor = new BABYLON.Color3(0, 0, 0);
    this.lineWidth = 1;

    this.share = null;
    this.closeCallback = null;
    this.selectionPredicate = (mesh) => this.isSelectableMesh(mesh);
    this.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  }

  show() {
    super.show();
    this.ui();

    this.texturesDispose();
    //new DynamicTexture(name, options, scene?, generateMipMaps?, samplingMode?, format?, invertY?)
    this.texture = new BABYLON.DynamicTexture(
      "Whiteboard",
      { width: this.width, height: this.height },
      this.scene,
      false,
      BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
      BABYLON.Engine.TEXTUREFORMAT_RGBA,
      false
    );
    this.material.diffuseTexture = this.texture;

    this.fullyVisible();

    this.canvas = this.texture.getContext();
    this.canvas.fillStyle = this.backgroundColor.toHexString();
    this.canvas.fillRect(0, 0, this.width - 1, this.height - 1);
    this.texture.update();
  }

  ui() {
    this.buttonClose = new BABYLON.GUI.HolographicButton("close");
    this.buttonClose.imageUrl = VRSPACEUI.contentBase + "/content/icons/close.png";
    VRSPACEUI.guiManager.addControl(this.buttonClose);
    this.buttonClose.backMaterial.alpha = this.handles.material.alpha;
    this.buttonClose.linkToTransformNode(this.handles.box);
    this.buttonClose.position = new BABYLON.Vector3(5, 0, 0);
    this.buttonClose.scaling = new BABYLON.Vector3(2, 2, 2);
    this.buttonClose.text = "Close";
    this.buttonClose.onPointerDownObservable.add(() => this.close());

    this.buttonUndo = new BABYLON.GUI.HolographicButton("undo");
    this.buttonUndo.imageUrl = VRSPACEUI.contentBase + "/content/icons/undo.png";
    VRSPACEUI.guiManager.addControl(this.buttonUndo);
    this.buttonUndo.backMaterial.alpha = this.handles.material.alpha;
    this.buttonUndo.linkToTransformNode(this.handles.box);
    this.buttonUndo.position = new BABYLON.Vector3(10, 0, 0);
    this.buttonUndo.scaling = new BABYLON.Vector3(2, 2, 2);
    this.buttonUndo.text = "Undo";
    this.buttonUndo.onPointerDownObservable.add(() => {
      this.undo();
      this.sendEvent({ undo: {} });
    });

    this.widthPanel = new SliderPanel(3, "Width", 1, 20, 1);
    this.widthPanel.plane.parent = this.handles.box;
    this.widthPanel.plane.position = new BABYLON.Vector3(43, 0, 0);
    this.widthPanel.slider.onValueChangedObservable.add(value => {
      this.setLineWidth(value);
      this.sendEvent({ setLineWidth: value });
    });

    this.foregroundSelector = new ColorPickerPanel(4, "Foreground", this.foregroundColor);
    this.foregroundSelector.plane.parent = this.handles.box;
    this.foregroundSelector.plane.position = new BABYLON.Vector3(46, 0, 0);
    this.foregroundSelector.picker.onValueChangedObservable.add(val => {
      this.changeForeground(val);
      this.sendEvent({ foreground: { r: val.r, g: val.g, b: val.b } });
    });

    this.backgroundSelector = new ColorPickerPanel(4, "Background", this.backgroundColor);
    this.backgroundSelector.plane.parent = this.handles.box;
    this.backgroundSelector.plane.position = new BABYLON.Vector3(50, 0, 0);
    this.backgroundSelector.picker.onValueChangedObservable.add(color => {
      this.changeBackground(color);
      this.sendEvent({ background: { r: color.r, g: color.g, b: color.b } });
    });

  }

  setLineWidth(value) {
    this.lineWidth = value;
    this.canvas.lineWidth = value;
  }
  
  foreground(r,g,b) {
    this.changeForeground( new BABYLON.Color3(r,g,b) );
  }
  
  changeForeground(color) {
    this.foregroundColor = color;
    this.canvas.strokeStyle = this.foregroundColor.toHexString();
  }
  
  background(r,g,b) {
    this.changeBackground( new BABYLON.Color3(r,g,b) );
  }
  
  changeBackground(color) {
    this.imageData = this.canvas.getImageData(0, 0, this.width, this.height);
    this.backgroundColor = color;
    this.canvas.fillStyle = this.backgroundColor.toHexString();
    this.canvas.fillRect(0, 0, this.width - 1, this.height - 1);
    this.texture.update();
  }

  clickAt(x,y) {
    super.click(x, y);

    this.canvas.save();
    this.imageData = this.canvas.getImageData(0, 0, this.width, this.height);

    this.canvas.beginPath();
    this.canvas.moveTo(x, y);
    this.scene.activeCamera.detachControl();
  }
  
  click(x, y) {
    this.clickAt(x,y);
    this.sendEvent({ clickAt: { x: x, y: y } });
  }

  dragTo(x,y) {
    this.canvas.lineTo(x, y);
    this.canvas.stroke();
    this.texture.update();
  }
  
  pointerDrag(x, y) {
    this.dragTo(x,y);
    this.sendEvent({ dragTo: { x: x, y: y } });
  }

  dragEnd() {
    this.scene.activeCamera.attachControl();
  }
  
  pointerUp() {
    this.dragEnd();
    this.sendEvent({ dragEnd: {} });
  }

  undo() {
    this.canvas.restore();
    if (this.imageData) {
      this.canvas.putImageData(this.imageData, 0, 0);
      this.texture.update();
      this.imageData = null;
    }
  }

  dispose() {
    this.deleteSharedObject();
    this.buttonClose.dispose();
    this.buttonUndo.dispose();
    this.widthPanel.dispose();
    this.foregroundSelector.dispose();
    this.backgroundSelector.dispose();
    super.dispose();
  }

  async startSharing() {
    if (!WorldManager.instance) {
      console.log("Can't share whiteboard - WorldManager offline");
      return;
    }
    VRSPACE.createScriptedObject({
      properties: { name: this.name, type: "Whiteboard", clientId: VRSPACE.me.id, size: this.size, addHandles: this.addHandles },
      active: true,
      script: '/babylon/js/scripts/remote-whiteboard.js',
      position: { x: this.position.x, y: this.position.y, z: this.position.z }
      //rotation: {x: this.rotation.x, y: this.rotation.y, z: this.rotation.z}
    }).then( obj => {
      this.share = obj;
      console.log("Created new VRObject", obj);
    });
  }

  deleteSharedObject() {
    if (this.share) {
      VRSPACE.deleteSharedObject(this.share);
      this.share = null;
    }
  }

  sendEvent(event) {
    if (!this.share) {
      this.startSharing();
    }
    if (this.share) {
      event['clientId'] = VRSPACE.me.id;
      //console.log("Sending ", event);
      VRSPACE.sendEvent(this.share, event);
    }
  }

  close() {
    this.deleteSharedObject()
    this.dispose();
    if ( this.closeCallback ) {
      this.closeCallback();
    }
  }
  
  isSelectableMesh(mesh) {
    return this.areaPlane == mesh;
  }

  /**
   * WorldListener interface. Upon receiving own notification, adds itself to the VRObject.
   * This prevents creation of another whiteboard instance when VRObject loads.
   */
  loaded(vrobject){
    if ( vrobject.properties && vrobject.properties.name == this.name ) {
      console.log("Shared object added to the scene", vrobject);
      this.share = vrobject;
      vrobject.attachedScript.whiteboard = this;
    }
  }
}