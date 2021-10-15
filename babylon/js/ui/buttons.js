/** Menu consisting of vertical buttons in 3D space and associated labels.
 */
export class Buttons {
  /**
  @param scene
  @param title string displayed above the menu
  @param options array of options, string labels or objects
  @param callback executed when button is activated
  @param property optional, if options are object, this specifies string property to display as label
   */
  constructor(scene,title,options,callback,property) {
    this.scene = scene;
    this.title = title;
    this.options = options;
    this.callback = callback;
    this.property = property;
    this.buttonHeight = 1;
    this.color = "white";
    this.addBackground = false; // experimental
    this.group = new BABYLON.TransformNode("ButtonGroup:"+this.title, scene);
    this.groupWidth = 0;
    this.buttons = [];
    this.selectedOption = -1;
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    this.turOff = false;
    this.controls = [];
    this.textures = [];
    this.materials = [];
    this.display();
  }

  /** Dispose of everything */
  dispose() {
    delete this.selectedMaterial;
    delete this.unselectedMaterial;
    this.group.dispose();
    for ( var i = 0; i < this.controls.length; i++ ) {
      this.controls[i].dispose();
    }
    for ( var i = 0; i < this.textures.length; i++ ) {
      this.textures[i].dispose();
    }
    for ( var i = 0; i < this.materials.length; i++ ) {
      this.materials[i].dispose();
    }
    console.log("Disposed of buttons "+this.title);
  }

  /** Set the height, rescales the menu */
  setHeight(height) {
    var scale = height/this.options.length;
    this.group.scaling = new BABYLON.Vector3(scale, scale, scale);
  }

  /** Display the menu, adds a pointer observable */
  display() {
    var buttonHeight = 1;
    var spacing = 1.1;

    // CHECKME: better use emissive color?
    this.selectedMaterial = new BABYLON.StandardMaterial("selectedButtonMaterial", this.scene);
    this.selectedMaterial.diffuseColor = new BABYLON.Color3(0,0,0);
    this.selectedMaterial.emissiveColor = new BABYLON.Color3(.4,.8,.4);
    this.selectedMaterial.disableLighting = true;
    this.materials.push(this.selectedMaterial);
    this.unselectedMaterial = new BABYLON.StandardMaterial("unselectedButtonMaterial", this.scene);
    this.unselectedMaterial.diffuseColor = new BABYLON.Color3(0,0,0);
    this.unselectedMaterial.emissiveColor = new BABYLON.Color3(.2,.2,.2);
    this.unselectedMaterial.disableLighting = true;
    this.materials.push(this.unselectedMaterial);

    if ( this.title && this.title.length > 0 ) {
      var titleText = new BABYLON.GUI.TextBlock();
      titleText.text = this.title;
      titleText.textHorizontalAlignment = this.horizontalAlignment;
      titleText.textVerticalAlignment = this.verticalAlignment;
      titleText.color = this.color;

      var titlePlane = BABYLON.MeshBuilder.CreatePlane("Text"+this.title, {height:2,width:this.title.length*2}, this.scene);
      titlePlane.parent = this.group;
      titlePlane.position = new BABYLON.Vector3(this.title.length,spacing*2,0);

      var titleTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
        titlePlane,
        titleText.fontSizeInPixels * titleText.text.length,
        titleText.fontSizeInPixels,
        false // mouse events disabled
      );
      titleTexture.addControl(titleText);
      this.controls.push(titleText);
      this.textures.push(titleTexture);
      this.materials.push(titlePlane.material);
    }

    for ( var i = 0; i < this.options.length; i ++ ) {
      if ( this.property ) {
        var option = this.options[i][this.property];
      } else {
        var option = this.options[i];
      }
      this.groupWidth = Math.max( this.groupWidth, option.length);
      var buttonText = new BABYLON.GUI.TextBlock();
      buttonText.text = option;
      buttonText.textHorizontalAlignment = this.horizontalAlignment;
      buttonText.textVerticalAlignment = this.verticalAlignment;

      var buttonWidth = buttonText.text.length;
      var buttonPlane = BABYLON.MeshBuilder.CreatePlane("Text"+option, {height:1,width:buttonWidth}, this.scene);
      buttonPlane.position = new BABYLON.Vector3(buttonWidth/2+buttonHeight,-i*spacing,0);
      buttonText.color = this.color;
      buttonPlane.parent = this.group;

      var aTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
        buttonPlane,
        buttonText.fontSizeInPixels*buttonText.text.length, // CHECKME: this is about twice the size of the text
        buttonText.fontSizeInPixels+2, // CHECKME: padding or something?
        false // mouse events disabled
      );
      //aTexture.background="black";
      aTexture.addControl(buttonText);
      this.controls.push(buttonText);
      this.textures.push(aTexture);
      // buttonPlane.material.needDepthPrePass = true; // trying to get proper transparency
      buttonPlane.material.alphaMode = 5; // ALPHA_MAXIMIZED
      this.materials.push(buttonPlane.material);

      var button = BABYLON.MeshBuilder.CreateCylinder("Button"+option, {height:.1, diameter:buttonHeight*.8}, this.scene);
      button.material = this.unselectedMaterial;
      button.rotation = new BABYLON.Vector3(Math.PI/2, 0, 0);
      button.position = new BABYLON.Vector3(buttonHeight/2, -i*spacing, 0);
      button.parent = this.group;
      this.buttons.push(button);
    }

    this.scene.onPointerObservable.add( (e) => {
      if(e.type == BABYLON.PointerEventTypes.POINTERDOWN){
        var p = e.pickInfo;
        for ( var i = 0; i < this.options.length; i++ ) {
          if ( p.pickedMesh == this.buttons[i] ) {
            // CHECKME we may want to handle double click somehow
            if ( i != this.selectedOption || this.turnOff) {
              this.select(i);
            }
            break;
          }
        }
      }
    });

    // paints background plane, can't be semi-transparent though
    if ( this.addBackground ) {
      console.log("Group width: "+this.groupWidth);
      var backgroundWidth = this.groupWidth/1.8;
      var backgroundHeight = this.options.length*spacing;
      var backgroundOffset = buttonHeight*.8; // same as button cylinder diameter
      var backPlane = BABYLON.MeshBuilder.CreatePlane("ButtonBackground:"+this.title, {height:backgroundHeight,width:backgroundWidth}, this.scene);
      backPlane.position = new BABYLON.Vector3(backgroundWidth/2+backgroundOffset,-backgroundHeight/2+spacing/2,.2);
      backPlane.parent = this.group;
      var backgroundMaterial = new BABYLON.StandardMaterial("unselectedButtonMaterial", this.scene);
      backgroundMaterial.disableLighting = true;
      //backgroundMaterial.alpha = 0.5; // produces weird transparency effects
      this.materials.push(backgroundMaterial);
      backPlane.material = backgroundMaterial;
    }
  }
  
  /** Select an option, executed when a button is pressed.
  Executes the callback passing selected option as parameter.
   */
  select(i) {
    console.log("Selected: "+this.options[i].name);
    if ( this.callback ) {
      this.callback(this.options[i]);
    }
    this.buttons[i].material = this.selectedMaterial;
    if ( this.selectedOption > -1 ) {
      this.buttons[this.selectedOption].material = this.unselectedMaterial;
    }
    if ( i != this.selectedOption ) {
      this.selectedOption = i;
    } else {
      this.selectedOption = -1;
    }
  }
  
  // CHECKME: not used so far
  hide() {
    this.group.isEnabled = false;
  }

  show() {
    this.group.isEnabled = true;
  }
}

