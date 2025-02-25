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
  constructor(groups, privateIcon) {
    super();
    /** @type { [UserGroup]} */
    this.groups = groups;
    this.privateIcon = privateIcon;
  }
  init() {
    this.createPanel();
    this.grid = new BABYLON.GUI.Grid();
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.grid.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    this.grid.paddingLeft = 10;
    this.grid.paddingTop = 10;

    this.grid.addColumnDefinition(0.1);
    this.grid.addColumnDefinition(0.9);

    this.groups.forEach((group, index) => {
      this.grid.addRowDefinition(this.heightInPixels, true);
      if (!group.public) {
        let privateImage = this.makeIcon("private", this.privateIcon);
        this.grid.addControl(privateImage, index, 0);
      }
      this.grid.addControl(this.textBlock(group.name), index, 1);
    });

    this.panel.addControl(this.grid);

    this.textureWidth = 768;
    this.textureHeight = this.heightInPixels * 4 + this.heightInPixels * (Math.max(this.grid.rowCount - 3, 1));
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
      this.groupApi.listMyGroups().then(res => {
        console.log(res);
        let form = new ListGroupsForm(res, this.contentBase + "/content/icons/private-message.png");
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