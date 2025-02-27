import { VRSPACEUI } from './vrspace-ui.js';
import { VRSpaceAPI } from '../client/rest-api.js';
import { GroupControllerApi } from '../client/openapi/api/GroupControllerApi.js';
import { Form } from './widget/form.js';
import { UserGroup } from '../client/openapi/model/UserGroup.js';
import { FormArea } from './widget/form-area.js';

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

class ListGroupsForm extends Form {
  constructor(groups, privateIcon, leaveGroupIcon, groupSettingIcon) {
    super();
    /** @type { [UserGroup]} */
    this.groups = groups;
    this.privateIcon = privateIcon;
    this.leaveGroupIcon = leaveGroupIcon;
    this.groupSettingIcon = groupSettingIcon;
    this.activeRow = null;
    this.activeButton = null;
    this.pointerTracker = null;
    this.style = null;
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
    this.grid.onPointerEnterObservable.add((vec)=>this.pointerEnter());
    this.grid.onPointerOutObservable.add((vec)=>this.pointerOut());
    this.grid.onPointerClickObservable.add((vec)=>this.pointerClick());

    this.grid.addColumnDefinition(0.1);
    this.grid.addColumnDefinition(0.1);
    this.grid.addColumnDefinition(0.7);
    this.grid.addColumnDefinition(0.1);

    this.groups.forEach((group, index) => {
      this.grid.addRowDefinition(this.heightInPixels, true);
      let indexLabel = this.textBlock(index);
      indexLabel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.grid.addControl(indexLabel, index, 0);
      if (!group.public) {
        let privateImage = this.makeIcon("private", this.privateIcon);
        this.grid.addControl(privateImage, index, 1);
      }
      this.grid.addControl(this.textBlock(group.name), index, 2);
      let button;
      if ( group.isOwned ) {
        button = this.submitButton("settings", ()=>this.groupSettings(), this.groupSettingIcon);
      } else {
        button = this.submitButton("leave", ()=>this.groupLeave(), this.leaveGroupIcon);
      }
      button.isVisible = false;
      this.grid.addControl(button, index, 3);
    });

    this.panel.addControl(this.grid);

    this.textureWidth = 768;
    this.textureHeight = this.heightInPixels * (Math.max(this.grid.rowCount, 1))+this.grid.paddingTopInPixels+this.grid.paddingBottomInPixels;
  }
  pointerEvent(vec) {
    let row = Math.floor((vec.y - this.grid.paddingTopInPixels)/this.heightInPixels);
    if ( row !== this.activeRow ) {
      this.activeRow = row;
      if ( this.activeButton ) {
        this.activeButton.isVisible = false;
      }
      if ( this.activeText ) {
        this.activeText.fontStyle = null;
      }
      this.activeButton = this.grid.getChildrenAt(row,3)[0];
      this.activeButton.isVisible = true;
      this.activeText = this.grid.getChildrenAt(row,2)[0];
      this.activeText.fontStyle = "bold";
    }
  }
  pointerOut() {
    console.log("pointer out");
    if ( this.activeButton ) {
      this.activeButton.isVisible = false;
      this.activeButton = null;
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
    console.log("TODO group settings: "+this.activeRow);
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
    VRSPACEUI.loadScriptsToDocument(this.contentBase + '/babylon/js/client/openapi/superagent.js');
  }

  dispose() {
    this.listGroupsButton.dispose();
    this.createGroupsButton.dispose();
    this.groupsInvitesButton.dispose();
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
          this.contentBase + "/content/icons/private-message.png", 
          this.contentBase + "/content/icons/user-group-minus.png", 
          this.contentBase + "/content/icons/user-group-settings.png"
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