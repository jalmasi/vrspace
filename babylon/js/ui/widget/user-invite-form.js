import { VRSPACEUI } from '../vrspace-ui.js';
import { VRSpaceAPI } from '../../client/rest-api.js';
import { Form } from './form.js';

/**
 * Type user name, or select avatar. CHECKME requires live connection to the server
 */
export class UserInviteForm extends Form {
  constructor(scene, callback) {
    super();
    this.scene = scene;
    this.callback = callback;
    this.userApi = VRSpaceAPI.getInstance().endpoint.user;
    this.text = "Select user, or type name:"
    this.submitText = "Invite";
    this.cancelText = "Cancel";
    this.clientId = null;
  }
  init() {
    this.createPanel();
    this.addControl(this.textBlock(this.text));
    this.nameInput = this.inputText('name');
    //this.nameInput.onTextChangedObservable.add(()=>this.checkName());
    this.nameInput.onBlurObservable.add(() => this.checkName());
    this.addControl(this.nameInput);
    this.yesButton = this.textButton(this.submitText, () => this.callback(true, this.clientId), VRSPACEUI.contentBase + "/content/icons/tick.png");
    this.addControl(this.yesButton);
    this.yesButton.isVisible = false;
    let noButton = this.textButton(this.cancelText, () => this.callback(false), VRSPACEUI.contentBase + "/content/icons/close.png", this.cancelColor);
    this.addControl(noButton);
    this.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN && pointerInfo.pickInfo.hit) {
        let rootNode = VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh);
        if (rootNode.VRObject && rootNode.VRObject.avatar && rootNode.VRObject.name) {
          this.nameInput.text = rootNode.VRObject.name;
          this.checkName();
        }
      }
    });
  }
  checkName() {
    if ( this.nameInput.text ) {
      this.userApi.find(this.nameInput.text).then(client => {
        this.clientId = client.id;
        this.nameInput.color = this.color;
        this.yesButton.isVisible = true;
      }).catch(reason => {
        console.log(reason);
        this.nameInput.color = this.cancelColor;
        this.yesButton.isVisible = false;
      });
    }
  }
  dispose() {
    super.dispose();
    this.scene.onPointerObservable.remove(this.clickHandler);
  }
  addToHud() {
    if (VRSPACEUI.hud.inXR()) {
      let texture = VRSPACEUI.hud.addForm(this, 1536, 512);
      this.keyboard(texture);
    } else {
      VRSPACEUI.hud.addForm(this, 1536, 64);
    }
    
  }
}

