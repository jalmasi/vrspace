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
    this.nameText = "                     Name:";
    this.radios = {};
  }
  init() {
    this.createPanel();
    
    this.label = this.textBlock(this.nameText);
    this.panel.addControl(this.label);

    this.input = this.inputText('name');
    this.input.onTextChangedObservable.add(()=>this.changeCallback(this.input.text))
    this.input.onBlurObservable.add(()=>this.blurCallback())
    this.panel.addControl(this.input);

    this.speechInput.addNoMatch((phrases)=>console.log('no match:',phrases));
    this.speechInput.start();
  }
  
  createKeyboardPlane() {
    let size = this.planeSize * 5;
    this.keyboardPlane = BABYLON.MeshBuilder.CreatePlane("KeyboardPlane", {width: size*2, height: size});
    this.keyboardPlane.position = new BABYLON.Vector3(0,-size/2,0);
    this.keyboardPlane.parent = this.plane;
    this.keyboardTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(this.keyboardPlane,512,256);
    // advancedTexture creates material and attaches it to the plane
    this.keyboardPlane.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
    this.keyboard(this.keyboardTexture);
    return this.plane;
  }

  inputFocused(input, focused) {
    this.virtualKeyboardEnabled = VRSPACEUI.hud.inXR();
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
    this.spacer = "                     ";
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
 */
export class LoginForm extends Form {
  constructor(changeCallback, blurCallback, buttonCallback, providers) {
    super();
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
    this.providerForm.panel.isVisible = true;
    this.blurCallback();
  }
  init() {
    this.verticalPanel = true;
    this.createPanel();
    this.panel.height = "128px";
    this.panel.width = "1280px";

    this.nameForm.init();
    this.nameForm.createKeyboardPlane();
    this.nameForm.panel.height = "64px";
    this.addControl(this.nameForm.panel);

    if ( this.providers && Object.keys(this.providers).length > 0 ) {
      this.providerForm.init();
      this.providerForm.panel.height = "64px";
      this.addControl(this.providerForm.panel);
      this.providerForm.panel.isVisible = false;
    }

    VRSPACEUI.hud.addForm(this,1240,128);
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
    VRSPACEUI.hud.clearControls();
  }
}

