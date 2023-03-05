import {VRSPACEUI} from './vrspace-ui.js';
import {TextWriter} from './text-writer.js';

export class ScrollablePanel {
  constructor(scene,name) {
    this.scene = scene;
    this.uiRoot = new BABYLON.TransformNode(name);
    this.writer = new TextWriter(this.scene);

    this.uiRoot.position = new BABYLON.Vector3(0,2,0);
    this.uiRoot.rotation = new BABYLON.Vector3(0,0,0);
    //this.guiManager = new BABYLON.GUI.GUI3DManager(this.scene); // causes transparency issues
    this.guiManager = VRSPACEUI.guiManager;
    this.panel = new BABYLON.GUI.CylinderPanel();
    this.panel.blocklayout = true; // optimization, requires updateLayout() call
    this.panel.margin = 0.05;
    this.panel.columns = 6;
    this.guiManager.addControl(this.panel);
    this.panel.linkToTransformNode(this.uiRoot);

    this.buttonPrev = new BABYLON.GUI.HolographicButton("prev");
    this.buttonPrev.imageUrl = VRSPACEUI.contentBase+"/content/icons/upload.png";
    this.guiManager.addControl(this.buttonPrev);
    this.buttonPrev.linkToTransformNode(this.uiRoot);
    this.buttonPrev.position = new BABYLON.Vector3(-4,0,4);
    this.buttonPrev.mesh.rotation = new BABYLON.Vector3(0,0,Math.PI/2);
    this.buttonPrev.tooltipText = "Previous";
    this.buttonPrev.isVisible = false;

    this.buttonNext = new BABYLON.GUI.HolographicButton("next");
    this.buttonNext.imageUrl = VRSPACEUI.contentBase+"/content/icons/upload.png";
    this.guiManager.addControl(this.buttonNext);
    this.buttonNext.linkToTransformNode(this.uiRoot);
    this.buttonNext.position = new BABYLON.Vector3(4,0,4);
    this.buttonNext.mesh.rotation = new BABYLON.Vector3(0,0,-Math.PI/2);
    this.buttonNext.tooltipText = "Next";
    this.buttonNext.isVisible = false;
    
    // same material used for all buttons in this UI:
    this.buttonNext.backMaterial.alpha = .5;

  }

  relocatePanel(distanceFromCamera = 6) {
    var forwardDirection = VRSPACEUI.hud.camera.getForwardRay(distanceFromCamera).direction;
    this.uiRoot.position = VRSPACEUI.hud.camera.position.add(forwardDirection);
    this.uiRoot.rotation = new BABYLON.Vector3(VRSPACEUI.hud.camera.rotation.x,VRSPACEUI.hud.camera.rotation.y,VRSPACEUI.hud.camera.rotation.z);
  }

  beginUpdate(hasPrevious,hasNext,onPrevious,onNext) {
    // workaround for panel buttons all messed up
    this.previousCoord = { pos:this.uiRoot.position, rot:this.uiRoot.rotation };
    this.uiRoot.position = new BABYLON.Vector3(0,2,0);
    this.uiRoot.rotation = new BABYLON.Vector3(0,0,0);
    this.panel.linkToTransformNode();
    
    this.panel.children.forEach( (button) => {button.dispose()} );
    
    this.buttonPrev.isVisible = hasPrevious;
    this.buttonPrev.onPointerDownObservable.clear();
    this.buttonPrev.onPointerDownObservable.add( onPrevious );

    this.buttonNext.isVisible = hasNext;
    this.buttonNext.onPointerDownObservable.clear();
    this.buttonNext.onPointerDownObservable.add( onNext );
    
  }  

  endUpdate(relocate) {
    this.panel.linkToTransformNode(this.uiRoot);
    this.panel.updateLayout();
    if ( relocate ) {
      this.relocatePanel();
    } else {
      this.uiRoot.position = this.previousCoord.pos;
      this.uiRoot.rotation = this.previousCoord.rot;
    }
  }

  addButton(text,image,callback) {
    if ( typeof(text) === "string" ) {
      text = [text];
    }
    
    var button = new BABYLON.GUI.HolographicButton(text[0]);
    this.panel.addControl(button);

    button.imageUrl = image;
    
    button.plateMaterial.disableLighting = true;

    button.content.scaleX = 2;
    button.content.scaleY = 2;
    
    button.onPointerEnterObservable.add( () => {
        this.writer.writeArray(button.node,text);
    });
    button.onPointerOutObservable.add( () => {
        this.writer.clear(button.node);
    });
    button.onPointerDownObservable.add( ()=>callback(button) );
    
  }
  
  dispose() {
    this.buttonPrev.dispose();
    this.buttonNext.dispose();
    this.panel.dispose();
  }
}