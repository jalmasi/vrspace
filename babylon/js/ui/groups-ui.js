import { VRSPACE } from './../client/vrspace.js';
import { VRSPACEUI } from './vrspace-ui.js';
import { VRSpaceAPI } from '../client/rest-api.js';
import { GroupsApi } from '../client/openapi/api/GroupsApi.js';
import { FormArea } from './widget/form-area.js';
import { Dialogue } from "./widget/dialogue.js";
import { ChatLog } from './widget/chat-log.js';
import { CreateGroupForm } from './groups/create-groups-form.js';
import { ListGroupsForm } from './groups/list-groups-form.js';

export class GroupsUI {
  constructor(scene) {
    this.scene = scene;
    this.hud = VRSPACEUI.hud;
    this.contentBase = VRSPACEUI.contentBase;
    /** @type {VRSpaceAPI} */
    this.api = VRSpaceAPI.getInstance();
    /** @type {GroupsApi} */
    this.groupApi = this.api.endpoint.groups;
    /** @type {CreateGroupForm} */
    this.createGroupForm = null;
    /** @type {FormArea} */
    this.listGroupsForm = null;
    this.listGroupsButton = null;
    this.createGroupsButton = null;
    this.groupsInvitesButton = null;
    this.invitations = [];
  }

  dispose() {
    this.listGroupsButton.dispose();
    this.createGroupsButton.dispose();
    this.listGroupsButton = null;
    this.createGroupsButton = null;
    if (this.groupsInvitesButton) {
      this.groupsInvitesButton.dispose();
      this.groupsInvitesButton = null;
    }
    if (this.createGroupForm) {
      this.createGroupForm.dispose();
      this.createGroupForm = null;
    }
    if (this.listGroupsForm) {
      this.listGroupsForm.dispose();
      this.listGroupsForm = null;
    }
    VRSPACE.removeGroupListener(this.groupEventListener);
  }

  async show(button) {
    VRSPACEUI.hud.showButtons(false, button);
    VRSPACEUI.hud.newRow();
    let unreadGroups = await this.groupApi.listUnreadGroups();
    this.unreadTotal = unreadGroups.reduce((sum, group) => sum + group.unread, 0);
    this.inviteTotal = 0;

    this.showListButton();
    this.createGroupsButton = this.hud.addButton("Create", this.contentBase + "/content/icons/user-group-plus.png", () => { this.createUI() });
    this.showInvitesButton();
    this.groupApi.listInvites().then(invites => {
      this.invitations = invites;
      this.showInvitesButton();
    });
    this.groupEventListener = VRSPACE.addGroupListener(event => {
      if (event.message) {
        // groups form tracks unread count
        if (!this.listGroupsForm) {
          // chatlog tracks unread count
          let chatlog = ChatLog.findInstance(event.message.group.name, "ChatLog:" + event.message.group.name);
          if (!chatlog) {
            this.unreadTotal++;
          }
        }
        this.showListButton();
      } else if (event.invite) {
        this.invitations.push(event.invite);
        this.showInvitesButton();
      }
    });
  }

  async showListButton() {
    let listText = "List";
    if (this.unreadTotal > 0) {
      listText += ": " + this.unreadTotal;
    }
    if (this.listGroupsButton) {
      this.listGroupsButton.text = listText;
    } else {
      this.listGroupsButton = this.hud.addButton(listText, this.contentBase + "/content/icons/user-group-settings.png", () => { this.listGroupsUI() }, false);
    }
    Promise.all([this.groupApi.listInvites(), this.groupApi.listMyGroups()]).then(groups => {
      if (groups[0].length + groups[1].length == 0) {
        VRSPACEUI.hud.markDisabled(this.listGroupsButton);
      } else {
        VRSPACEUI.hud.markEnabled(this.listGroupsButton);
      }
    });
  }

  showInvitesButton() {
    if (this.groupsInvitesButton) {
      this.hud.removeButton(this.groupsInvitesButton);
      this.groupsInvitesButton = null
    }
    if (this.invitations.length > 0) {
      this.groupsInvitesButton = this.hud.addButton("Invites:" + this.invitations.length, this.contentBase + "/content/icons/user-group-info.png", () => { this.listInvitesUI() }, false);
    }
  }

  hide() {
    VRSPACEUI.hud.clearRow();
    VRSPACEUI.hud.showButtons(true);
    this.dispose();
  }

  clearForm() {
    this.listGroupsForm.dispose();
    this.listGroupsForm = null;
    this.hud.markEnabled(this.listGroupsButton);
    this.showInvitesButton();
  }

  createForm(invites, groups, refresh) {
    let form = new ListGroupsForm(
      this.scene,
      invites,
      groups,
      group => this.groupDelete(group),
      () => this.refreshList(() => refresh())
    );
    form.init();

    this.listGroupsForm = new FormArea(this.scene, form);
    this.listGroupsForm.size = .1;
    this.listGroupsForm.show(form.textureWidth, form.textureHeight);
    this.listGroupsForm.attachToHud();
    this.listGroupsForm.detach(1);
    this.listGroupsForm.group.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  }

  listInvitesUI() {
    if (this.listGroupsForm) {
      this.clearForm();
    } else {
      this.hud.markActive(this.groupsInvitesButton);
      this.groupApi.listInvites()
        .then(invites => {
          this.invitations = invites;
          if (invites.length > 0) {
            this.createForm(this.invitations, [], () => this.listInvitesUI());
          }
        });
    }
  }

  listGroupsUI() {
    if (this.listGroupsForm) {
      this.clearForm();
    } else {
      this.hud.markActive(this.listGroupsButton);
      // tracking unread here while group list/chatlog is open is too complicated, so
      this.unreadTotal = 0;
      this.showListButton();
      Promise.all([this.groupApi.listInvites(), this.groupApi.listMyGroups(), this.groupApi.listOwnedGroups(), this.groupApi.listUnreadGroups()])
        .then(results => {
          this.invitations = results[0];
          let myGroups = results[1];
          let ownedGroups = results[2];
          let unreadGroups = results[3];

          myGroups.forEach(g => g.isOwned = ownedGroups.some(e => e.id == g.id));
          myGroups.forEach(g => g.unread = unreadGroups.find(e => e.id == g.id)?.unread || "");

          this.showInvitesButton();
          if (myGroups.length + this.invitations.length > 0) {
            this.createForm(this.invitations, myGroups, () => this.listGroupsUI());
          }
        });
    }
  }

  groupDelete(group) {
    let dialogue = new Dialogue("Delete " + group.name + " ?", (yes) => {
      if (yes) {
        this.groupApi.deleteGroup(group.id).then(() => {
          this.refreshList(() => this.listGroupsUI());
        });
      }
    });
    dialogue.init();
  }

  refreshList(refresh) {
    refresh();
    refresh();
    this.showInvitesButton();
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
        this.groupApi.create(
          this.createGroupForm.nameInput.text,
          {
            isPublic: this.createGroupForm.publicCheckbox.isChecked,
            isTemporary: this.createGroupForm.tempCheckbox.isChecked
          }
        ).then(res => {
          console.log(res);
          this.createGroupForm.dispose();
          this.createGroupForm = null;
          VRSPACEUI.hud.clearRow();
          VRSPACEUI.hud.showButtons(true);
          this.showListButton();
          if (this.listGroupsForm) {
            this.refreshList(() => this.listGroupsUI());
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

}