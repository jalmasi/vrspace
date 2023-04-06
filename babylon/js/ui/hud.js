/**
HUD stands for head-up display - a UI container mounted on users head.
Typically we have some buttons around 50 cm front, 10-20 cm below line of sight.
This is common UI supposed to be usefull on VR devices, PC and mobiles, but likely to be suboptimal - UI specifically designed for a device should be more ergonomic.
By default it tracks active camera, and binds to new camera whenever active camera changes,
e.g. upon entering/exiting VR. Constructed with a camera parameter, it does not rebound to a new one,
e.g. switching from first-person view to god mode activates a different HUD.
 */
export class HUD {
  /** @param scene babylonjs scene */
  /** @param camera to track, by default tracks active camera */
  constructor( scene, camera ) {
    // parameters
    this.scene = scene;
    this.onlyCamera = camera;
    // constants
    this.buttonSize = .05;
    this.buttonSpacing = 0.025;
    this.alpha=0.7; // button opacity
    this.distance = .5;
    this.vertical = -0.1;
    this.verticalXR = -0.2;
    // state variables
    this.scale = 1;
    scene.onActiveCameraChanged.add( () => this.trackCamera() );
    this.guiManager = new BABYLON.GUI.GUI3DManager(this.scene);
    this.elements = [];
    this.controls = [];
    this.textures = [];
    this.root = new BABYLON.TransformNode("HUD");
    this.root.position = new BABYLON.Vector3(0,this.vertical,this.distance);
    this.rows = [{root: this.root, elements: this.elements, controls: this.controls, textures: this.textures}];
    window.addEventListener("resize", () => {
      this.rescaleHUD();
    });
    this.trackCamera();
  }
  /**
  Handles camera change events, typically while entering/exiting VR.
   */
  trackCamera() {
    console.log("HUD tracking camera: "+this.scene.activeCamera.getClassName()+" new position "+this.scene.activeCamera.position);
    this.camera = this.scene.activeCamera;
    if ( this.onlyCamera ) {
     if ( this.camera == this.onlyCamera ) {
        // TODO activate this HUD
      } else {
        // TODO deactivate this HUD
      }
    } else {
      this.root.parent = this.camera;
      if ( "WebXRCamera" == this.camera.getClassName() ) {
        this.root.scaling = new BABYLON.Vector3(.5, .5, .5);
        this.root.position = new BABYLON.Vector3(0,this.verticalXR,this.distance);
      } else {
        this.root.position = new BABYLON.Vector3(0,this.vertical,this.distance);
        this.rescaleHUD();
      }
    }
  }
  /**
  Window.resize event handler, rescales the HUD if aspect ratio is too small for all buttons to fit.
   */
  rescaleHUD() {
    var aspectRatio = this.scene.getEngine().getAspectRatio(this.scene.activeCamera);
    // TODO exactly calculate aspect ratio depending on number of buttons, size, spacing
    // 0.75 (10 buttons) on this distance fits at aspect of 2
    var requiredRatio = this.elements.length/10*2;
    this.scale = Math.min(1, aspectRatio/requiredRatio); 
    this.root.scaling = new BABYLON.Vector3(this.scale,this.scale,1);
    console.log("Aspect ratio: "+aspectRatio+" HUD scaling: "+this.scale);
  }
  
  makeRoomForMore() {
	  // TODO take variable size of elements into account
    var width = this.buttonSize+this.buttonSpacing;
    this.elements.forEach(b=>{
      b.position.x = b.position.x - width/2;
    });
    if ( this.input ) {
		  width += .4;
	  }
    return width;
  }
  
  /**
  Create a button with given text and image and add it to the HUD
  @param text description to display
  @param imageUrl image to display
  @param onPointerDown callback function activated when pressed
  @returns a BabylonJS HolographicButton
   */
  addButton(text, imageUrl, onPointerDown) {
    var width = this.makeRoomForMore();
    
    var button = new BABYLON.GUI.HolographicButton(text+"Button");
    this.guiManager.addControl(button);
    button.imageUrl = imageUrl;
    button.text=text;
    button.position = new BABYLON.Vector3(this.elements.length*width/2,0,0);
    button.scaling = new BABYLON.Vector3( this.buttonSize, this.buttonSize, this.buttonSize );
    button.mesh.parent = this.root;
    this.elements.push(button);
    this.controls.push(button);
    button.backMaterial.alpha = this.alpha;
    this.rescaleHUD();
    if ( onPointerDown ) {
      button.onPointerDownObservable.add( (vector3WithInfo) => onPointerDown(button, vector3WithInfo) );
    }
    return button;
  }
  
  addPanel(panel,textureWidth,textureHeight) {
	  var size = 0.03 * this.scale;

    var plane = BABYLON.MeshBuilder.CreatePlane("Plane-TextInput", {width: size*textureWidth/textureHeight, height: size});
    plane.parent = this.root;
    plane.position = new BABYLON.Vector3(0,0,0.02);
    this.advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(plane,textureWidth,textureHeight);
    // advancedTexture creates material and attaches it to the plane
    plane.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
    
    this.advancedTexture.addControl(panel);

    this.elements.push(plane);
    this.controls.push(panel);
    
  	return this.advancedTexture;
  }
  /**
  Adds a slider to the HUD.
  @return babylon Slider object
   */
  addSlider(text="Value",min,max,value=0) {
    var width = this.makeRoomForMore();

    var plane = BABYLON.MeshBuilder.CreatePlane("Plane-Slider:"+text, {width: 0.07, height: 0.07});
    plane.parent = this.root;
    //plane.position.z = 0.02;
    plane.position = new BABYLON.Vector3(this.elements.length*width/2,0,0.02);

    var advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(plane,256,256);

    var panel = new BABYLON.GUI.StackPanel();
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    advancedTexture.addControl(panel);
    this.textures.push(advancedTexture);

    var header = new BABYLON.GUI.TextBlock("Text-Slider:"+text);
    header.text = text+": "+value;
    header.height = "30px";
    header.color = "white";
    panel.addControl(header); 

    var slider = new BABYLON.GUI.Slider("Slider:"+text);
    slider.minimum = min;
    slider.maximum = max;
    slider.value = value;
    slider.isVertical = true;
    slider.height = "220px";
    slider.width = "20px";
    slider.onValueChangedObservable.add((value) =>{
        header.text = text+": "+value;
    });
    panel.addControl(slider);
    this.elements.push(plane);
    this.controls.push(panel);
    return slider;
  }
  /**
  Adds color picker to the HUD.
  @return babylon ColorPicker object
   */
  addColorPicker(text="Color",value=new BABYLON.Color3()) {
    var width = this.makeRoomForMore();
    
    var plane = BABYLON.MeshBuilder.CreatePlane("Plane-Picker:"+text, {width: 0.07, height: 0.07});
    plane.parent = this.root;
    plane.position = new BABYLON.Vector3(this.elements.length*width/2,0,0);

    var advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(plane,256,256);
    var panel = new BABYLON.GUI.StackPanel();
    panel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    panel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    advancedTexture.addControl(panel);
    this.textures.push(advancedTexture);
    
    var header = new BABYLON.GUI.TextBlock("Text-Picker:"+text);
    header.text = text;
    header.height = "30px";
    header.color = "white";
    panel.addControl(header); 

    var picker = new BABYLON.GUI.ColorPicker("Picker:"+text);
    picker.value = value;
    picker.height = "150px";
    picker.width = "150px";
    picker.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;

    panel.addControl(picker);
    this.elements.push(plane);
    this.controls.push(panel);

    this.rescaleHUD();
    return picker;
  }

  /**
  Show or hide all HUD elements (buttons)
  @param show show or hide
  @param except optional element(s) to skip
   */
  showButtons(show, ...except) {
    this.controls.forEach( (element) => {
      if ( !except
        // no children - button 
        || (!element.children && !except.includes(element))
        // panel contains text and control 
        || ( element.children && !except.includes(element.children[1]))  
      ) {
        element.isVisible = show;
      }
    });
  }
  
  newRow() {
    this.root.scaling = new BABYLON.Vector3(this.scale*.5,this.scale*.5,this.scale*.5);
    this.root.position.y += this.vertical/2;
 
    this.root = new BABYLON.TransformNode("HUD");
    this.root.parent = this.camera;
    this.root.position = new BABYLON.Vector3(0,this.vertical,this.distance);
 
    this.elements = [];
    this.controls = [];
    this.textures = [];
    this.rows.push({root: this.root, elements: this.elements, controls: this.controls, textures: this.textures});
  }

  clearRow() {
	  if ( this.advancedTexture ) {
		  this.advancedTexture.dispose();
		  delete this.advancedTexture;
	  }
    // TODO check rows length
    // CHECKME: dispose of all elements/controls?
    this.controls.forEach(c=>c.dispose());
    this.elements.forEach(e=>{
      if ( e.material ) {
        // apparently AdvancedDynamicTexture creates and leaks material for Plane
        e.material.dispose();
      }
      e.dispose();
    });
    this.textures.forEach(t=>t.dispose());
    this.root.dispose();
    this.rows.pop();
    var row = this.rows[this.rows.length-1]
    this.root = row.root;
    this.root.scaling = new BABYLON.Vector3(this.scale,this.scale,this.scale);
    this.root.position.y -= this.vertical/2;

    this.elements = row.elements;
    this.controls = row.controls;
    this.textures = row.textures;
  }
  
}