import {Form} from './form.js';
/**
 * Login name input form
 */
class NameForm extends Form {
  constructor(changeCallback, blurCallback) {
    super();
    this.changeCallback = changeCallback;
    this.blurCallback = blurCallback;
    this.color = "black";
    this.background = "white";
    //this.nameText = "                     Name:"; // babylon 4
    this.nameText = "      Name:"; // babylon 5,6
    this.radios = {};
  }
  init() {
    this.createPanel();
    
    this.label = this.textBlock(this.nameText);
    this.label.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.panel.addControl(this.label);

    this.input = this.inputText('name');
    this.input.onTextChangedObservable.add(()=>this.changeCallback(this.input.text))
    this.input.onBlurObservable.add(()=>this.blurCallback())
    this.panel.addControl(this.input);

    this.speechInput.addNoMatch((phrases)=>console.log('no match:',phrases));
    this.speechInput.start();
  }
  
  createKeyboardPlane(parentForm) {
    let size = parentForm.planeSize * 2;
    this.keyboardPlane = BABYLON.MeshBuilder.CreatePlane("KeyboardPlane", {width: size*2, height: size});
    this.keyboardPlane.position = new BABYLON.Vector3(0,-size/2,0.1);
    this.keyboardPlane.parent = parentForm.plane;
    this.keyboardTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.keyboardPlane,512,256);
    // advancedTexture creates material and attaches it to the plane
    this.keyboardPlane.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
    this.keyboard(this.keyboardTexture);
  }

  inputFocused(input, focused) {
    this.virtualKeyboardEnabled = VRSPACEUI.hud.inXR();
    //this.virtualKeyboardEnabled = true;
    super.inputFocused(input,focused);
  }
  
  dispose() {
    this.keyboardPlane.dispose();
    this.keyboardTexture.dispose();
    super.dispose();
  }
}

/**
 * Authentication provider selection form
 */
class ProviderForm extends Form {
  constructor(buttonCallback, radios) {
    super();
    this.buttonCallback = buttonCallback;
    this.radios = radios;
    this.color = "black";
    this.background = "white";
    //this.spacer = "                     "; // babylon 4
    this.spacer = "      "; // babylon 5,6
    this.selectedKey = null;
    this.selectedValue = null;
  }
  init() {
    this.createPanel();
    this.label = this.textBlock(this.spacer);
    this.panel.addControl(this.label);

    var login = this.submitButton("submit", () => this.buttonCallback(this.selectedKey, this.selectedValue));
    //var login = this.textButton("login", () => this.buttonCallback(this.selectedKey, this.selectedValue));
    login.isVisible = false;

    for ( let key in this.radios ) {
      this.panel.addControl(this.textBlock(this.radios[key]));
      let radio = this.radio(key);
      this.panel.addControl(radio);
      radio.onIsCheckedChangedObservable.add((state) => {
          if (state) {
              this.selectedKey = key;
              this.selectedValue = this.radios[key];
              login.isVisible = true;
          }
      }); 
    }

    this.panel.addControl(login);

    this.speechInput.addNoMatch((phrases)=>console.log('no match:',phrases));
    this.speechInput.start();
  }
}

/**
 * Complete login form hosts login name form and authentication provider selection form.
 * By default, the form is bound to HUD. If position property is set, form is placed at the position instead,
 * and scaled to planeSize, default 0.5.
 */
export class LoginForm extends Form {
  constructor(changeCallback, blurCallback, buttonCallback, providers) {
    super();
    this.position = null;
    this.planeSize = .25;
    this.providers = providers;
    this.changeCallback = changeCallback;
    this.blurCallback = blurCallback;
    this.nameForm = new NameForm((text)=>this.nameChanged(text), ()=>this.inputFocusLost());
    this.providerForm = new ProviderForm(buttonCallback, providers);
  }
  nameChanged(text) {
    //this.providerForm.panel.isVisible = true;
    this.changeCallback(text);
  }
  inputFocusLost() {
    if ( this.nameForm.input.text ) {
      this.providerForm.panel.isVisible = true;
    } else {
      this.providerForm.panel.isVisible = false;
    }
    this.blurCallback();
  }
  init() {
    this.verticalPanel = true;
    this.createPanel();
    this.panel.height = "128px";
    this.panel.width = "1280px";

    if ( this.position ) {
      this.createPlane(this.planeSize, 1240, 128);
      this.plane.position = this.position;
    } else {
      VRSPACEUI.hud.addForm(this,1240,128);
    }
    
    this.nameForm.init();
    this.nameForm.createKeyboardPlane(this); // CHECKME when on HUD
    this.nameForm.panel.height = "64px";
    this.addControl(this.nameForm.panel);

    if ( this.providers && Object.keys(this.providers).length > 0 ) {
      this.providerForm.init();
      this.providerForm.panel.height = "64px";
      this.addControl(this.providerForm.panel);
      this.providerForm.panel.isVisible = false;
    }
    // CHECKME do we want to auto-focus name input?
    // available since babylon 5
    //this.nameForm.input.focus();

  }
  defaultLabel() {
    this.nameForm.label.text=this.nameForm.nameText;
  }
  setLabel(text) {
    this.nameForm.label.text="   "+text;
  }
  dispose() {
    this.nameForm.dispose();
    if ( this.providerForm ) {
      this.providerForm.dispose();
    }
    if ( ! this.position ) {
      VRSPACEUI.hud.clearControls();
    }
    super.dispose();
  }

  isSelectableMesh(mesh) {
    return (this.plane && mesh == this.plane) || mesh == this.nameForm.keyboardPlane; 
  }
}

