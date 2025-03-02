import { VRSPACEUI } from './vrspace-ui.js';
import { VRSpaceAPI } from '../client/rest-api.js';
import { GroupControllerApi } from '../client/openapi/api/GroupControllerApi.js';
import { Form } from './widget/form.js';
import { UserGroup } from '../client/openapi/model/UserGroup.js';
import { FormArea } from './widget/form-area.js';
import { Dialogue } from "./widget/dialogue.js";

class CreateGroupForm extends Form {
  constructor(callback) {
    super();
    this.callback = callback;
    this.color = "black";
    this.background = "white";
    this.nameText = "Group name:";
    this.publicText = "Make public:";
  }
  init() {
    this.createPanel();
    this.grid = new BABYLON.GUI.Grid();
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.grid.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    this.grid.paddingLeft = 10;
    this.grid.paddingTop = 10;
    this.grid.addColumnDefinition(0.2);
    this.grid.addColumnDefinition(0.5);
    this.grid.addColumnDefinition(0.2);
    this.grid.addColumnDefinition(0.05);
    this.grid.addColumnDefinition(0.05);

    this.nameLabel = this.textBlock(this.nameText);
    this.nameInput = this.inputText('name');
    this.publicLabel = this.textBlock(this.publicText);
    this.publicCheckbox = this.checkbox('public');
    this.submit = this.submitButton("submit", this.callback);
    this.grid.addControl(this.nameLabel, 0, 0);
    this.grid.addControl(this.nameInput, 0, 1);
    this.grid.addControl(this.publicLabel, 0, 2);
    this.grid.addControl(this.publicCheckbox, 0, 3);
    this.grid.addControl(this.submit, 0, 4);

    this.panel.addControl(this.grid);

    this.speechInput.addNoMatch((phrases) => console.log('no match:', phrases));
    this.speechInput.start();
  }

}

class GroupSettingsForm extends Form {
  constructor(group, close){
    super();
    this.group = group;
    this.nameText = "Name:";
    this.publicText = "Public:";
    this.submitText = "Submit";
    this.cancelText = "Cancel";
    this.close = close;
  }
  init() {
    this.panel1 = this.createPanel();
    this.panel1.height = "128px";
    
    this.nameLabel = this.textBlock(this.nameText);
    this.addControl(this.nameLabel);
    this.nameInput = this.inputText('name');
    this.nameInput.text = this.group.name;
    this.addControl(this.nameInput);
    this.publicLabel = this.textBlock(this.publicText);
    this.addControl(this.publicLabel);
    this.publicCheckbox = this.checkbox('public');
    this.publicCheckbox.isChecked = this.group.public;
    this.addControl(this.publicCheckbox);
    
    this.panel2 = this.createPanel();
    this.panel2.height = "128px";
    this.panel2.paddingLeft="30%";
    
    let yesButton = this.textButton(this.submitText, () => this.close(true), VRSPACEUI.contentBase+"/content/icons/tick.png");
    this.addControl(yesButton);
    let noButton = this.textButton(this.cancelText, () => this.close(false), VRSPACEUI.contentBase+"/content/icons/close.png", this.cancelColor);
    this.addControl(noButton);
    
    this.verticalPanel = true;
    this.createPanel();
    this.addControl(this.panel1);
    this.addControl(this.panel2);
  }
}

class GroupInviteForm extends Form {
  constructor(scene, group, callback) {
    super();
    this.scene = scene;
    this.group = group;
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
    this.nameInput.onBlurObservable.add(()=>this.checkName());
    this.addControl(this.nameInput);
    this.yesButton = this.textButton(this.submitText, () => this.callback(true, this.clientId), VRSPACEUI.contentBase+"/content/icons/tick.png");
    this.addControl(this.yesButton);
    this.yesButton.isVisible = false;
    let noButton = this.textButton(this.cancelText, () => this.callback(false), VRSPACEUI.contentBase+"/content/icons/close.png", this.cancelColor);
    this.addControl(noButton);
    this.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN && pointerInfo.pickInfo.hit) {
        let rootNode = VRSPACEUI.findRootNode(pointerInfo.pickInfo.pickedMesh);
        if ( rootNode.VRObject && rootNode.VRObject.avatar && rootNode.VRObject.name ) {
          this.nameInput.text = rootNode.VRObject.name;
          this.checkName();
        }
      }
    });
  }
  checkName() {
    this.userApi.find(this.nameInput.text).then(client=>{
      this.clientId = client.id;
      this.nameInput.color = this.color;
      this.yesButton.isVisible = true;
    }).catch(reason=>{
      console.log(reason);
      this.nameInput.color = this.cancelColor;
      this.yesButton.isVisible = false;
    });
  }
  dispose() {
    super.dispose();
    this.scene.onPointerObservable.remove(this.clickHandler);
  }
}

class ListGroupsForm extends Form {
  constructor(groups, scene, privateIcon, leaveGroupIcon, groupSettingIcon, groupInviteIcon, groupDeleteIcon, groupDeleteCallback) {
    super();
    /** @type { [UserGroup]} */
    this.groups = groups;
    this.scene = scene;
    this.privateIcon = privateIcon;
    this.leaveGroupIcon = leaveGroupIcon;
    this.groupSettingIcon = groupSettingIcon;
    this.groupInviteIcon = groupInviteIcon;
    this.groupDeleteIcon = groupDeleteIcon;
    this.groupDeleteCallback = groupDeleteCallback;
    /** @type {GroupControllerApi} */
    this.groupApi = VRSpaceAPI.getInstance().endpoint.groups;
    
    this.activeRow = null;
    this.activeButton = null;
    this.pointerTracker = null;
    this.style = null;
    /** @type {GroupSettingsForm} */
    this.settingsForm = null;
    /** @type {GroupInviteForm} */
    this.inviteForm = null;
    this.trackPointer = true;
  }
  init() {
    this.createPanel();
    this.grid = new BABYLON.GUI.Grid();
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.grid.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    this.grid.paddingLeftInPixels = 10;
    this.grid.paddingTopInPixels = 10;
    this.grid.paddingBottomInPixels = 10;
    
    this.grid.isPointerBlocker = true;
    this.grid.onPointerEnterObservable.add(()=>this.pointerEnter());
    this.grid.onPointerOutObservable.add(()=>this.pointerOut());
    this.grid.onPointerClickObservable.add(()=>this.pointerClick());

    this.grid.addColumnDefinition(0.1);
    this.grid.addColumnDefinition(0.1);
    this.grid.addColumnDefinition(0.5);
    this.grid.addColumnDefinition(0.1);
    this.grid.addColumnDefinition(0.1);
    this.grid.addColumnDefinition(0.1);

    this.groups.forEach((group, index) => {
      this.grid.addRowDefinition(this.heightInPixels, true);
      let indexLabel = this.textBlock(index+1);
      indexLabel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.grid.addControl(indexLabel, index, 0);
      let privateImage = this.makeIcon("private", this.privateIcon);
      this.grid.addControl(privateImage, index, 1);
      privateImage.isVisible = !group.public;
      this.grid.addControl(this.textBlock(group.name), index, 2);
      let button;
      if ( group.isOwned ) {
        button = this.submitButton("settings", ()=>this.groupSettings(), this.groupSettingIcon);
      } else {
        button = this.submitButton("leave", ()=>this.groupLeave(), this.leaveGroupIcon);
      }
      button.isVisible = false;
      button.background = this.background;
      this.grid.addControl(button, index, 3);
      let inviteButton = this.submitButton("invite", ()=>this.groupInvite(group), this.groupInviteIcon);
      this.grid.addControl(inviteButton, index, 4);
      inviteButton.isVisible = false;
      let deleteButton = this.submitButton("delete", ()=>this.groupDeleteCallback(group), this.groupDeleteIcon);
      deleteButton.background = this.cancelColor; 
      this.grid.addControl(deleteButton, index, 5);
      deleteButton.isVisible = false;
    });

    this.panel.addControl(this.grid);

    this.textureWidth = 768;
    this.textureHeight = this.heightInPixels * (Math.max(this.grid.rowCount, 1))+this.grid.paddingTopInPixels+this.grid.paddingBottomInPixels;
  }
  pointerEvent(vec) {
    if ( !this.trackPointer ) {
      return;
    }
    let row = Math.floor((vec.y - this.grid.paddingTopInPixels)/this.heightInPixels);
    if ( row !== this.activeRow ) {
      this.activeRow = row;
      if ( this.activeButtons ) {
        this.activeButtons.forEach(button=>button.isVisible = false);
      }
      if ( this.activeText ) {
        this.activeText.fontStyle = null;
      }
      let group = this.groups[row];
      let button = this.grid.getChildrenAt(row,3)[0];
      let inviteButton = this.grid.getChildrenAt(row,4)[0];
      let deleteButton = this.grid.getChildrenAt(row,5)[0];
      button.isVisible = true;
      inviteButton.isVisible = (group.isOwned || group.public);
      deleteButton.isVisible = group.isOwned;
      this.activeButtons = [button,inviteButton,deleteButton];
      this.activeText = this.grid.getChildrenAt(row,2)[0];
      this.activeText.fontStyle = "bold";
    }
  }
  pointerOut() {
    console.log("pointer out");
    if ( this.activeButtons ) {
      this.activeButtons.forEach(button=>button.isVisible = false);
      this.activeButtons = null;
    }
    if ( this.activeText ) {
      this.activeText.fontStyle = null;
      this.activeText = null;
    }
    this.grid.onPointerMoveObservable.remove(this.pointerTracker);
    this.activeRow = null;
    this.pointerTracker = null;
  }
  pointerEnter() {
    // for reasons unknown, babylon may not send pointer out event
    // so we have to double check here just in case
    if ( ! this.pointerTracker ) {
      console.log("pointer in");
      this.pointerTracker = this.grid.onPointerMoveObservable.add((vec)=>this.pointerEvent(vec));
    }
  }
  pointerClick() {
    console.log("TODO read messages of: "+this.activeRow);
  }
  groupLeave() {
    console.log("TODO leave group: "+this.activeRow);
  }
  groupSettings() {
    if ( this.settingsForm != null ) {
      this.settingsForm.dispose();
      this.settingsArea.dispose();
    }
    let group = this.groups[this.activeRow];
    this.settingsForm = new GroupSettingsForm(group, (ok)=>{
      if(ok) {
        // TODO submit
        let isPublic = this.settingsForm.publicCheckbox.isChecked;
        let groupName = this.settingsForm.nameInput.text.trim()
        group.name = groupName;
        group.public = isPublic;
        this.groupApi.update(group).then(() => {
          let icon = this.grid.getChildrenAt(this.activeRow,1)[0];
          icon.isVisible = !this.settingsForm.publicCheckbox.isChecked;
          let groupNameLabel = this.grid.getChildrenAt(this.activeRow,2)[0];
          groupNameLabel.text = groupName;
        });
      }
      this.settingsArea.dispose();
    });
    this.settingsForm.init();
    
    this.settingsArea = new FormArea(this.scene, this.settingsForm);
    this.settingsArea.size = .25;
    this.settingsArea.show(1024,256);
    this.settingsArea.attachToHud();
    this.settingsArea.detach(1);
    this.settingsArea.group.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  }
  groupInvite(group) {
    VRSPACEUI.hud.showButtons(false);
    VRSPACEUI.hud.newRow();
    this.inviteForm = new GroupInviteForm(this.scene, group, (ok,userId)=>{
      if ( ok ) {
        this.groupApi.invite(group.id,userId);
      }
      VRSPACEUI.hud.clearRow();
      VRSPACEUI.hud.showButtons(true);
      this.trackPointer = true;
    });
    this.inviteForm.init();
    if (VRSPACEUI.hud.inXR()) {
      let texture = VRSPACEUI.hud.addForm(this.inviteForm, 1536, 512);
      this.inviteForm.keyboard(texture);
    } else {
      VRSPACEUI.hud.addForm(this.inviteForm, 1536, 64);
    }
    this.trackPointer = false;
  }
}

export class GroupsUI {
  constructor(scene) {
    this.scene = scene;
    this.hud = VRSPACEUI.hud;
    this.contentBase = VRSPACEUI.contentBase;
    /** @type {VRSpaceAPI} */
    this.api = VRSpaceAPI.getInstance();
    /** @type {GroupControllerApi} */
    this.groupApi = this.api.endpoint.groups;
    /** @type {CreateGroupForm} */
    this.createGroupForm = null;
    /** @type {FormArea} */
    this.listGroupsForm = null;
  }

  dispose() {
    this.listGroupsButton.dispose();
    this.createGroupsButton.dispose();
    this.groupsInvitesButton.dispose();
    if ( this.createGroupForm ) {
      this.createGroupForm.dispose();
      this.createGroupForm = null;
    }
    if ( this.listGroupsForm ) {
      this.listGroupsForm.dispose();
      this.listGroupsForm = null;
    }
  }

  show(button) {
    VRSPACEUI.hud.showButtons(false, button);
    VRSPACEUI.hud.newRow();
    this.listGroupsButton = this.hud.addButton("List", this.contentBase + "/content/icons/user-group-settings.png", () => { this.listUI() }, false);
    this.createGroupsButton = this.hud.addButton("Create", this.contentBase + "/content/icons/user-group-plus.png", () => { this.createUI() });
    this.groupsInvitesButton = this.hud.addButton("Invites", this.contentBase + "/content/icons/user-group-info.png", () => { this.invites() });
  }

  hide() {
    VRSPACEUI.hud.clearRow();
    VRSPACEUI.hud.showButtons(true);
    this.dispose();
  }
  
  listUI() {
    if (this.listGroupsForm) {
      this.listGroupsForm.dispose();
      this.listGroupsForm = null;
      this.hud.markEnabled(this.listGroupsButton);
    } else {
      this.hud.markActive(this.listGroupsButton);
      Promise.all([this.groupApi.listMyGroups(), this.groupApi.listOwnedGroups()])
      .then(results => {
        let myGroups = results[0];
        let ownedGroups = results[1];
        myGroups.forEach(g=>g.isOwned = ownedGroups.some(e=>e.id == g.id));

        console.log(myGroups);
        
        let form = new ListGroupsForm(
          myGroups, 
          this.scene,
          this.contentBase + "/content/icons/private-message.png", 
          this.contentBase + "/content/icons/user-group-minus.png", 
          this.contentBase + "/content/icons/user-group-settings.png",
          this.contentBase + "/content/icons/user-group-plus.png", 
          this.contentBase + "/content/icons/delete.png",
          group=>this.groupDelete(group)
        );
        form.init();

        this.listGroupsForm = new FormArea(this.scene, form);
        this.listGroupsForm.size = .5;
        this.listGroupsForm.show(form.textureWidth, form.textureHeight);
        this.listGroupsForm.attachToHud();
        this.listGroupsForm.detach(2);
        this.listGroupsForm.group.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
      });
    }
  }

  groupDelete(group) {
    let dialogue = new Dialogue("Delete "+group.name+" ?", (yes)=>{
      if ( yes ) {
        this.groupApi.callDelete(group.id).then(()=>{
          this.listUI();
          this.listUI();
        });
      }
    });
    dialogue.init();
  }

  createUI() {
    if (this.createGroupForm) {
      this.createGroupForm.dispose();
      this.createGroupForm = null;
      VRSPACEUI.hud.clearRow();
      VRSPACEUI.hud.showButtons(true);
    } else {
      VRSPACEUI.hud.showButtons(false, this.createGroupsButton);
      VRSPACEUI.hud.newRow();
      this.createGroupForm = new CreateGroupForm(() => {
        this.groupApi.create(this.createGroupForm.nameInput.text, { isPublic: this.createGroupForm.publicCheckbox.isChecked }).then(res => {
          console.log(res);
          this.createGroupForm.dispose();
          this.createGroupForm = null;
          VRSPACEUI.hud.clearRow();
          VRSPACEUI.hud.showButtons(true);
          if ( this.listGroupsForm ) {
            this.listUI();
            this.listUI();
          }
        });
      });
      this.createGroupForm.init();
      if (VRSPACEUI.hud.inXR()) {
        let texture = VRSPACEUI.hud.addForm(this.createGroupForm, 1536, 512);
        this.createGroupForm.keyboard(texture);
      } else {
        VRSPACEUI.hud.addForm(this.createGroupForm, 1280, 64);
      }
    }
  }

  invites() {
    this.groupApi.listInvites().then(res => {
      console.log(res);
    });
  }
}