import { Label } from './label.js';

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
    this.spacing = 1.1;
    this.color = "white";
    //this.background = true; //experimental
    this.group = new BABYLON.TransformNode("ButtonGroup:"+this.title, scene);
    this.groupWidth = 0;
    this.buttons = [];
    this.selectedOption = -1;
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
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
      var titleLabel = new Label( this.title, new BABYLON.Vector3(this.title.length/Label.fontRatio,this.spacing*2,0), this.group );
      titleLabel.height = 2;
      titleLabel.horizontalAlignment = this.horizontalAlignment;
      titleLabel.verticalAlignment = this.verticalAlignment;
      titleLabel.display();
      this.controls.push(titleLabel);
    }

    for ( var i = 0; i < this.options.length; i ++ ) {
      if ( this.property ) {
        var option = this.options[i][this.property];
      } else {
        var option = this.options[i];
      }
      this.groupWidth = Math.max( this.groupWidth, option.length);
      
      var buttonLabel = new Label( option, new BABYLON.Vector3(option.length/(Label.fontRatio*2)+this.buttonHeight,-i*this.spacing,0), this.group );
      buttonLabel.horizontalAlignment = this.horizontalAlignment;
      buttonLabel.verticalAlignment = this.verticalAlignment;
      buttonLabel.display();
      this.controls.push(buttonLabel);

      var button = BABYLON.MeshBuilder.CreateCylinder("Button"+option, {height:.1, diameter:this.buttonHeight*.8}, this.scene);
      button.material = this.unselectedMaterial;
      button.rotation = new BABYLON.Vector3(Math.PI/2, 0, 0);
      button.position = new BABYLON.Vector3(this.buttonHeight/2, -i*this.spacing, 0);
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
    if ( this.background ) {
      console.log("Group width: "+this.groupWidth);
      var backgroundWidth = this.groupWidth/1.8;
      var backgroundHeight = this.options.length*this.spacing;
      var backgroundOffset = this.buttonHeight*.8; // same as button cylinder diameter
      var backPlane = BABYLON.MeshBuilder.CreatePlane("ButtonBackground:"+this.title, {height:backgroundHeight,width:backgroundWidth}, this.scene);
      backPlane.position = new BABYLON.Vector3(backgroundWidth/2+backgroundOffset,-backgroundHeight/2+this.spacing/2,.2);
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

