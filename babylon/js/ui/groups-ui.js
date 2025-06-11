import { VRSPACE } from './../client/vrspace.js';
import { VRSPACEUI } from './vrspace-ui.js';
import { VRSpaceAPI } from '../client/rest-api.js';
import { GroupsApi } from '../client/openapi/api/GroupsApi.js';
import { Form } from './widget/form.js';
import { UserGroup } from '../client/openapi/model/UserGroup.js';
import { GroupMember } from '../client/openapi/model/GroupMember.js';
import { FormArea } from './widget/form-area.js';
import { Dialogue } from "./widget/dialogue.js";
import { World } from './../world/world.js';
import { ChatLog } from './widget/chat-log.js';

class CreateGroupForm extends Form {
  constructor(callback) {
    super();
    this.callback = callback;
    this.color = "black";
    this.background = "white";
    this.nameText = "Name:";
    this.publicText = "Public:";
    this.tempText = "Temporary:";
  }
  init() {
    this.createPanel();
    this.grid = new BABYLON.GUI.Grid();
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    this.nameLabel = this.textBlock(this.nameText);
    this.nameInput = this.inputText('name');
    this.publicLabel = this.textBlock(this.publicText);
    this.publicCheckbox = this.checkbox('public');
    this.tempLabel = this.textBlock(this.tempText);
    this.tempCheckbox = this.checkbox('temporary');
    this.submit = this.submitButton("submit", this.callback);

    this.panel.addControl(this.nameLabel);
    this.panel.addControl(this.nameInput);
    this.panel.addControl(this.publicLabel);
    this.panel.addControl(this.publicCheckbox);
    this.panel.addControl(this.tempLabel);
    this.panel.addControl(this.tempCheckbox);
    this.panel.addControl(this.submit);

    this.speechInput.addNoMatch((phrases) => console.log('no match:', phrases));
    this.speechInput.start();
  }

}

class ListMembersForm extends Form {
  constructor(scene, group, isOwner, close, refresh) {
    super();
    this.scene = scene;
    this.group = group;
    this.members = null;
    /** @type {GroupMember[]} */
    this.requests = [];
    this.close = close;
    this.refresh = refresh;
    this.isOwner = isOwner;
    this.closeText = "Close";
    this.contentBase = VRSPACEUI.contentBase;
    this.kickIcon = this.contentBase + "/content/icons/user-minus.png";
    this.infoIcon = this.contentBase + "/content/icons/user-info.png";
    this.adminIcon = this.contentBase + "/content/icons/user-group-settings.png";
    this.acceptIcon = this.contentBase + "/content/icons/tick.png";
    this.rejectIcon = this.contentBase + "/content/icons/delete.png";
    this.groupApi = VRSpaceAPI.getInstance().endpoint.groups;
    this.table = [];
    this.activeRow == null;
    this.pointerTracker = null;
    this.selectionPredicate = mesh => mesh == this.plane;
  }
  async init() {
    let values = await Promise.all([this.groupApi.show(this.group.id), this.groupApi.listOwners(this.group.id)]);
    this.members = values[0];
    let owners = values[1];
    this.members.forEach(member => {
      member.isOwner = owners.some(o => o.id == member.id);
    });
    if (this.isOwner) {
      this.requests = await this.groupApi.listRequests(this.group.id);
    }

    this.createPanel();
    this.grid = new BABYLON.GUI.Grid();
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.grid.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    this.pointerTracker = this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh) {
        if (pointerInfo.pickInfo.pickedMesh == this.plane) {
          let coord = pointerInfo.pickInfo.getTextureCoordinates();
          // width of group text in column 2
          if (coord.x > 0.05 && coord.x < 0.85) {
            let row = Math.floor((1 - coord.y) * (this.grid.rowCount));
            if (row < this.table.length) {
              // ignore last row - close button
              if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERMOVE) {
                this.pointerEvent(row);
              } else if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN) {
                this.pointerClick();
              }
            }
          }
        } else {
          this.pointerOut();
        }
      } else {
        this.pointerOut();
      }
    });
    World.lastInstance.addSelectionPredicate(this.selectionPredicate);

    this.grid.paddingLeftInPixels = 10;
    this.grid.paddingTopInPixels = 10;
    this.grid.paddingBottomInPixels = 10;

    this.grid.addColumnDefinition(0.05);
    this.grid.addColumnDefinition(0.8);
    this.grid.addColumnDefinition(0.05);
    this.grid.addColumnDefinition(0.05);
    this.grid.addColumnDefinition(0.05);

    let index = 0;
    this.requests.forEach(request => {
      this.grid.addRowDefinition(this.heightInPixels, true);

      this.grid.addControl(this.textBlock(index+1), index, 0);

      let clientName = this.textBlock(request.client.name);
      this.grid.addControl(clientName, index, 1);
      this.table.push(request);

      /*
      // no useful user information to display
      let infoButton = this.submitButton("info", () => this.requestInfo(request), this.infoIcon);
      infoButton.background = this.background;
      this.grid.addControl(infoButton, index, 3);
      */

      let acceptButton = this.submitButton("accept", () => this.acceptRequest(request.group.id, request.client.id), this.acceptIcon);
      this.grid.addControl(acceptButton, index, 3);

      let rejectButton = this.submitButton("reject", () => this.rejectRequest(request), this.rejectIcon);
      rejectButton.background = this.cancelColor;
      this.grid.addControl(rejectButton, index, 4);

      index++;
    });

    this.members.forEach(client => {
      this.grid.addRowDefinition(this.heightInPixels, true);

      this.grid.addControl(this.textBlock(index+1), index, 0);

      let clientName = this.textBlock(client.name);
      this.grid.addControl(clientName, index, 1);
      this.table.push(client);

      let online = this.checkbox("online");
      online.isChecked = client.active;
      online.isReadOnly = true;
      this.grid.addControl(online, index, 2);

      /*
      // no useful user information to display      
      let infoButton = this.submitButton("info", () => this.clientInfo(client), this.infoIcon);
      infoButton.background = this.background;
      this.grid.addControl(infoButton, index, 3);
      infoButton.isVisible = false;
      */

      if (client.isOwner) {
        let adminIcon = this.makeIcon("admin", this.adminIcon);
        this.grid.addControl(adminIcon, index, 3);
      }

      let rejectButton = this.submitButton("kick", () => this.kickUser(client), this.kickIcon);
      this.grid.addControl(rejectButton, index, 4);
      rejectButton.isVisible = false;

      index++;
    });

    // empty row
    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addRowDefinition(this.heightInPixels, true);
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.closeButton = this.textButton(this.closeText, () => this.close(), VRSPACEUI.contentBase + "/content/icons/close.png", this.cancelColor);
    this.grid.addControl(this.closeButton, this.table.length + 1, 1);

    this.panel.addControl(this.grid);
  }

  async kickUser(client) {
    await this.groupApi.kick(this.group.id, client.id);
    this.refresh();
  }
  
  async acceptRequest(groupId, clientId) {
    await this.groupApi.allow(groupId, clientId);
    this.refresh();
  }
  
  async rejectRequest(groupId, clientId) {
    await this.groupApi.kick(groupId, clientId);
    this.refresh();
  }
  
  pointerEvent(row) {
    if (row !== this.activeRow) {
      this.activeRow = row;
      if (this.activeButtons) {
        this.activeButtons.forEach(button => button.isVisible = false);
        this.activeButtons = null;
      }
      if (this.activeText) {
        this.activeText.fontStyle = null;
        this.activeText = null;
      }
      let client = this.table[row];
      if (client.hasOwnProperty("client")) {
        // GroupMember, request
        return;
      }
      // no useful user info
      //let infoButton = this.grid.getChildrenAt(row, 3)[0];
      //infoButton.isVisible = true;
      let kickButton = this.grid.getChildrenAt(row, 4)[0];
      kickButton.isVisible = this.isOwner && client.id != VRSPACE.me.id && !client.isOwner;
      //this.activeButtons = [infoButton,kickButton];
      this.activeButtons = [kickButton];
      this.activeText = this.grid.getChildrenAt(row, 1)[0];
      this.activeText.fontStyle = "bold";
    }
  }

  pointerOut() {
    if (this.activeRow != null) {
      console.log("pointer out");
      if (this.activeButtons) {
        this.activeButtons.forEach(button => button.isVisible = false);
        this.activeButtons = null;
      }
      if (this.activeText) {
        this.activeText.fontStyle = null;
        this.activeText = null;
      }
      this.grid.onPointerMoveObservable.remove(this.pointerTracker);
      this.activeRow = null;
    }
  }

  pointerClick() {
    // CHECKME - anything? E.g. PM, in due time
  }

  dispose() {
    super.dispose();
    World.lastInstance.removeSelectionPredicate(this.selectionPredicate);
    if (this.pointerTracker) {
      this.scene.onPointerObservable.remove(this.pointerTracker);
      this.pointerTracker = null
    }
  }
}

class GroupSettingsForm extends Form {
  constructor(group, isOwner, close, listCallback) {
    super();
    /** @type {UserGroup} */
    this.group = group;
    this.listCallback = listCallback;
    this.isOwner = isOwner;
    this.close = close;
    this.nameText = "Name:";
    this.publicText = "Public:";
    this.submitText = "Submit";
    this.cancelText = "Cancel";
    this.closeText = "Close";
    this.leaveText = "Leave group";
    this.membersText = "Members:";
    this.listText = "  List  ";
    this.members = [];
    this.paddingLeftInPixels = 10;
    /** @type {GroupsApi} */
    this.groupApi = VRSpaceAPI.getInstance().endpoint.groups;
  }
  init() {
    this.panel1 = this.createPanel();
    this.panel1.height = "128px";

    this.nameLabel = this.textBlock(this.nameText);
    this.addControl(this.nameLabel);

    this.nameInput = this.inputText('name');
    this.nameInput.text = this.group.name;
    this.nameInput.isReadOnly = !this.isOwner;
    this.addControl(this.nameInput);

    this.publicLabel = this.textBlock(this.publicText);
    this.addControl(this.publicLabel);

    this.publicCheckbox = this.checkbox('public');
    this.publicCheckbox.isChecked = this.group.public;
    this.publicCheckbox.isReadOnly = !this.isOwner;
    this.addControl(this.publicCheckbox);

    this.membersLabel = this.textBlock(this.membersText);
    this.addControl(this.membersLabel);

    this.membersCount = this.textBlock("");
    this.addControl(this.membersCount);
    this.groupApi.show(this.group.id).then(members => {
      this.members = members;
      this.membersCount.text = members.length;
    });

    this.showMembers = this.textButton(this.listText, () => this.listCallback(this.members), VRSPACEUI.contentBase + "/content/icons/user-group-info.png");
    this.addControl(this.showMembers);

    this.panel2 = this.createPanel();
    this.panel2.height = "128px";
    this.panel2.paddingLeft = "30%";

    if (this.isOwner) {
      let yesButton = this.textButton(this.submitText, () => this.close(true), VRSPACEUI.contentBase + "/content/icons/tick.png");
      this.addControl(yesButton);
      let noButton = this.textButton(this.cancelText, () => this.close(false), VRSPACEUI.contentBase + "/content/icons/close.png", this.cancelColor);
      this.addControl(noButton);
    } else {
      let closeButton = this.textButton(this.closeText, () => this.close(false), VRSPACEUI.contentBase + "/content/icons/close.png");
      this.addControl(closeButton);
      let leaveButton = this.textButton(this.leaveText, () => this.close(true), VRSPACEUI.contentBase + "/content/icons/user-group-minus.png", this.cancelColor);
      this.addControl(leaveButton);
    }

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
  dispose() {
    super.dispose();
    this.scene.onPointerObservable.remove(this.clickHandler);
  }
}

class InviteInfoForm extends Form {
  constructor(invite, callback) {
    super();
    /** @type {GroupMember} */
    this.invite = invite;
    this.callback = callback;
    this.groupText = "Invited to group";
    this.memberText = "by";
    this.acceptText = "Join";
    this.cancelText = "Reject";
  }
  init() {
    this.createPanel();
    this.addControl(this.textBlock(this.groupText + " " + this.invite.group.name + " " + this.memberText + " " + this.invite.sponsor.name));
    let yesButton = this.textButton(this.acceptText, () => this.callback(true), VRSPACEUI.contentBase + "/content/icons/tick.png");
    this.addControl(yesButton);
    let noButton = this.textButton(this.cancelText, () => this.callback(false), VRSPACEUI.contentBase + "/content/icons/close.png", this.cancelColor);
    this.addControl(noButton);
  }
}
class ListGroupsForm extends Form {
  constructor(scene, invites, groups, groupDeleteCallback, refreshCallback) {
    super();
    this.scene = scene;
    /** @type { GroupMember[] } */
    this.invites = invites;
    /** @type { UserGroup[] } */
    this.groups = groups;
    /** @type { UserGroup[] } */
    this.table = Array(this.invites.length + this.groups.length);
    this.contentBase = VRSPACEUI.contentBase;
    this.privateIcon = this.contentBase + "/content/icons/private-message.png";
    this.leaveGroupIcon = this.contentBase + "/content/icons/user-group-minus.png";
    this.groupSettingIcon = this.contentBase + "/content/icons/user-group-settings.png";
    this.groupInviteIcon = this.contentBase + "/content/icons/user-group-plus.png";
    this.groupInfoIcon = this.contentBase + "/content/icons/user-group-info.png";
    this.groupAcceptIcon = this.contentBase + "/content/icons/tick.png";
    this.groupDeleteIcon = this.contentBase + "/content/icons/delete.png";
    this.groupDeleteCallback = groupDeleteCallback;
    this.refreshCallback = refreshCallback;
    this.stackVertical = true;
    this.stackHorizontal = true;
    /** @type {GroupsApi} */
    this.groupApi = VRSpaceAPI.getInstance().endpoint.groups;
    /** @type {number} */
    this.activeRow = null;
    this.activeButton = null;
    this.pointerTracker = null;
    this.style = null;
    /** @type {GroupSettingsForm} */
    this.settingsForm = null;
    /** @type {GroupInviteForm} */
    this.inviteForm = null;
    this.selectionPredicate = mesh => mesh == this.plane;
    this.groupEventListener = null;
  }

  init() {
    this.createPanel();
    this.grid = new BABYLON.GUI.Grid();
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.grid.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

    this.grid.paddingLeftInPixels = 10;
    this.grid.paddingTopInPixels = 10;
    this.grid.paddingBottomInPixels = 10;

    /* 
    // GUI pointer observables work in mozilla, not in chrome
    // CHECKME may just require selection predicate
    this.grid.isPointerBlocker = true;
    this.grid.onPointerEnterObservable.add(()=>this.pointerEnter());
    this.grid.onPointerOutObservable.add(()=>this.pointerOut());
    this.grid.onPointerClickObservable.add(()=>this.pointerClick());
    // so, use scene facilities instead
     */
    this.pointerTracker = this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.pickInfo.hit && pointerInfo.pickInfo.pickedMesh) {
        if (pointerInfo.pickInfo.pickedMesh == this.plane) {
          let coord = pointerInfo.pickInfo.getTextureCoordinates();
          // width of group text in column 2
          if (coord.x > 0.1 && coord.x < 0.8) {
            if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERMOVE) {
              let row = Math.floor((1 - coord.y) * (this.table.length));
              this.pointerEvent(row);
            } else if (pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN && this.groups.length > 0) {
              this.pointerClick();
            }
          }
        } else {
          this.pointerOut();
        }
      } else {
        this.pointerOut();
      }
    });
    World.lastInstance.addSelectionPredicate(this.selectionPredicate);

    this.grid.addColumnDefinition(0.05);
    this.grid.addColumnDefinition(0.05);
    this.grid.addColumnDefinition(0.7);
    this.grid.addColumnDefinition(0.05);
    this.grid.addColumnDefinition(0.05);
    this.grid.addColumnDefinition(0.05);
    this.grid.addColumnDefinition(0.05);

    let index = 0;
    this.invites.forEach(invite => {
      this.grid.addRowDefinition(this.heightInPixels, true);
      let indexLabel = this.textBlock(index + 1);
      indexLabel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.grid.addControl(indexLabel, index, 0);

      let privateImage = this.makeIcon("private", this.privateIcon);
      this.grid.addControl(privateImage, index, 1);
      privateImage.isVisible = !invite.group.public;
      this.grid.addControl(this.textBlock(invite.group.name), index, 2);

      let infoButton = this.submitButton("info", () => this.inviteInfo(invite), this.groupInfoIcon);
      //infoButton.isVisible = false;
      infoButton.background = this.background;
      this.grid.addControl(infoButton, index, 4);

      let acceptButton = this.submitButton("accept", () => this.inviteAccept(invite), this.groupAcceptIcon);
      this.grid.addControl(acceptButton, index, 5);
      //acceptButton.isVisible = false;

      let rejectButton = this.submitButton("reject", () => this.inviteReject(invite), this.groupDeleteIcon);
      rejectButton.background = this.cancelColor;
      this.grid.addControl(rejectButton, index, 6);
      //rejectButton.isVisible = false;

      this.table[index] = invite.group;
      this.table[index].isInvite = true;
      index++;
    });

    this.groups.forEach(group => {
      this.grid.addRowDefinition(this.heightInPixels, true);

      let indexLabel = this.textBlock(index + 1);
      indexLabel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.grid.addControl(indexLabel, index, 0);

      let privateImage = this.makeIcon("private", this.privateIcon);
      this.grid.addControl(privateImage, index, 1);
      privateImage.isVisible = !group.public;

      this.grid.addControl(this.textBlock(group.name), index, 2);

      this.grid.addControl(this.textBlock(group.unread), index, 3);

      let button;
      if (group.isOwned) {
        button = this.submitButton("settings", () => this.groupSettings(group), this.groupSettingIcon);
      } else {
        button = this.submitButton("info", () => this.groupInfo(group), this.groupInfoIcon);
      }
      button.isVisible = false;
      button.background = this.background;
      this.grid.addControl(button, index, 4);

      let inviteButton = this.submitButton("invite", () => this.groupInvite(group), this.groupInviteIcon);
      this.grid.addControl(inviteButton, index, 5);
      inviteButton.isVisible = false;

      let deleteButton = this.submitButton("delete", () => this.groupDeleteCallback(group), this.groupDeleteIcon);
      deleteButton.background = this.cancelColor;
      this.grid.addControl(deleteButton, index, 6);
      deleteButton.isVisible = false;

      this.table[index] = group;
      index++;
    });

    this.panel.addControl(this.grid);

    this.textureWidth = 1280;
    this.textureHeight = this.heightInPixels * (Math.max(this.grid.rowCount, 1)) + this.grid.paddingTopInPixels + this.grid.paddingBottomInPixels;

    this.groupEventListener = VRSPACE.addGroupListener(event => {
      if (event.message) {
        let groupIndex = this.groups.findIndex(group => group.id == event.message.group.id);
        if (groupIndex >= 0 && typeof this.groups[groupIndex].chatlog == "undefined") {
          this.groups[groupIndex].unread++;
          let row = groupIndex + this.invites.length;
          this.grid.getChildrenAt(row, 3)[0].text = this.groups[groupIndex].unread;
        }
      } else if (event.invite) {
        // CHECKME: what to do with invites?
        if (this.groups.find(group => group.id == event.invite.group.id)) {
          console.error("Received invalid invite:", event.invite);
        } else {
          this.refreshCallback();
        }
      } else if (event.ask) {
        console.log("TODO asked to join:", event.ask);
      } else if (event.allowed) {
        console.log("TODO allowed to join:", event.ask);
      }
    });
  }

  pointerEvent(row) {
    if (row !== this.activeRow) {
      this.activeRow = row;
      if (this.activeButtons) {
        this.activeButtons.forEach(button => button.isVisible = false);
        this.activeButtons = null;
      }
      if (this.activeText) {
        this.activeText.fontStyle = null;
        this.activeText = null;
      }
      let group = this.table[row];
      if (group.isInvite) {
        // not changing anything for invites
        return;
      }
      let button = this.grid.getChildrenAt(row, 4)[0];
      let inviteButton = this.grid.getChildrenAt(row, 5)[0];
      let deleteButton = this.grid.getChildrenAt(row, 6)[0];
      button.isVisible = true;
      inviteButton.isVisible = (group.isOwned || group.public || group.isInvite);
      deleteButton.isVisible = group.isOwned || group.isInvite;
      this.activeButtons = [button, inviteButton, deleteButton];
      this.activeText = this.grid.getChildrenAt(row, 2)[0];
      this.activeText.fontStyle = "bold";
    }
  }

  pointerOut() {
    if (this.activeRow != null) {
      console.log("pointer out");
      if (this.activeButtons) {
        this.activeButtons.forEach(button => button.isVisible = false);
        this.activeButtons = null;
      }
      if (this.activeText) {
        this.activeText.fontStyle = null;
        this.activeText = null;
      }
      this.grid.onPointerMoveObservable.remove(this.pointerTracker);
      this.activeRow = null;
    }
  }

  inviteInfo(invite) {
    let inviteForm = new InviteInfoForm(invite, accepted => {
      if (accepted) {
        this.inviteAccept(invite);
      } else {
        this.inviteReject(invite);
      }
      VRSPACEUI.hud.clearRow();
      VRSPACEUI.hud.showButtons(true);
    });
    inviteForm.init();
    VRSPACEUI.hud.showButtons(false);
    VRSPACEUI.hud.newRow();
    VRSPACEUI.hud.addForm(inviteForm, 1024, 64);
  }

  async inviteAccept(invite) {
    await this.groupApi.accept(invite.group.id)
    this.invites.splice(this.invites.findIndex(i => i == invite), 1);
    this.refreshCallback();
  }

  async inviteReject(invite) {
    await this.groupApi.leave(invite.group.id)
    this.invites.splice(this.invites.findIndex(i => i == invite), 1);
    this.refreshCallback();
  }

  pointerClick() {
    let group = this.table[this.activeRow];
    console.log("read messages of: " + group.isInvite, group);

    if (typeof group.chatlog == "undefined") {
      group.chatlog = ChatLog.findInstance(group.name, "ChatLog:" + group.name);
      if (group.chatlog == null) {
        group.chatlog = new ChatLog(this.scene, group.name, "ChatLog:" + group.name);
        group.chatlog.canClose = true;
        group.chatlog.minimizeTitle = false;
        group.chatlog.minimizeInput = true;
        group.chatlog.autoHide = false;
        if (this.stackVertical) {
          group.chatlog.verticalAnchor = group.chatlog.verticalAnchor + 0.05 * (ChatLog.instanceCount - 1);
        }
        if (this.stackHorizontal) {
          group.chatlog.baseAnchor = group.chatlog.baseAnchor + 0.25 * (ChatLog.instanceCount - 1);
        }
        group.chatlog.show();
        group.chatlog.input.autoWrite = false;
        group.chatlog.input.virtualKeyboardEnabled = World.lastInstance.inXR();
        // add listener for share world (default-hud)
        group.chatlog.addListener((text, data) => {
          if (data) {
            this.groupApi.shareWorld(group.id, data);
          } else {
            this.groupApi.write(group.id, text);
          }
        });

        group.chatlog.groupListener = VRSPACE.addGroupListener(event => {
          if (event.message && group.id == event.message.group.id) {
            // different serialization:
            //group.chatlog.log(event.message.from.User.name, event.message.content, event.message.link, event.message.local);
            group.chatlog.log(event.message.from.name, event.message.content, event.message.link, event.message.local);
          }
        });
      }

      // previously existing chatlog refers to previously existing group, that may no longer exist/be visible
      // so, replace existing close event handler (installed in show() call) 
      group.chatlog.handles.onClose = () => {
        VRSPACE.removeGroupListener(group.chatlog.groupListener);
        group.chatlog.dispose();
        //World.lastInstance.removeSelectionPredicate(group.chatlogSelection);
        delete group.chatlog;
      }

      // this is not safe to do after listUnreadMessages returns - activeRow may have be changed
      this.grid.getChildrenAt(this.activeRow, 3)[0].text = "";
      group.unread = 0;
      this.groupApi.listUnreadMessages(group.id).then(messages => {
        messages.forEach(message => {
          // CHECKME: include links?
          group.chatlog.log(message.from.name, message.content, message.link);
        });
      });

    }
  }

  async groupLeave(group) {
    await this.groupApi.leave(group.id)
    this.refreshCallback();
  }

  closeMembersForm() {
    if (this.listMembersForm != null) {
      this.listMembersForm.dispose();
      this.listArea.dispose();
      this.listMembersForm = null;
      this.listArea = null;
    }
  }

  async memberList(group, isOwner) {
    this.closeMembersForm();
    this.listMembersForm = new ListMembersForm(
      this.scene,
      group,
      isOwner,
      () => this.closeMembersForm(),
      () => this.memberList(group, isOwner)
    );
    await this.listMembersForm.init();

    this.listArea = new FormArea(this.scene, this.listMembersForm);
    this.listArea.size = .2;
    this.listArea.show(1280, this.listMembersForm.heightInPixels * (this.listMembersForm.table.length + 3));
    this.listArea.attachToHud();
    this.listArea.detach(.7);
    this.listArea.group.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  }

  groupCommon(group, isOwner, callback) {
    if (this.settingsForm != null) {
      this.settingsForm.dispose();
      this.settingsArea.dispose();
    }
    this.settingsForm = new GroupSettingsForm(group, isOwner, (ok) => {
      this.settingsArea.dispose();
      callback(ok);
    }, () => this.memberList(group, isOwner));
    this.settingsForm.init();

    this.settingsArea = new FormArea(this.scene, this.settingsForm);
    this.settingsArea.size = .2;
    this.settingsArea.show(1280, 256);
    this.settingsArea.attachToHud();
    this.settingsArea.detach(.8);
    this.settingsArea.group.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  }

  groupInfo(group) {
    this.groupCommon(group, false, (leave) => {
      if (leave) {
        this.groupLeave(group);
      }
    });
  }

  groupSettings(group) {
    this.groupCommon(group, true, (ok) => {
      if (ok) {
        let isPublic = this.settingsForm.publicCheckbox.isChecked;
        let groupName = this.settingsForm.nameInput.text.trim()
        group.name = groupName;
        group.public = isPublic;
        this.groupApi.update(group).then(() => {
          let icon = this.grid.getChildrenAt(this.activeRow, 1)[0];
          icon.isVisible = !this.settingsForm.publicCheckbox.isChecked;
          let groupNameLabel = this.grid.getChildrenAt(this.activeRow, 2)[0];
          groupNameLabel.text = groupName;
        });
      }
    });
  }

  groupInvite(group) {
    VRSPACEUI.hud.showButtons(false);
    VRSPACEUI.hud.newRow();
    this.inviteForm = new GroupInviteForm(this.scene, group, (ok, userId) => {
      if (ok) {
        this.groupApi.invite(group.id, userId);
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
  dispose() {
    super.dispose();
    World.lastInstance.removeSelectionPredicate(this.selectionPredicate);
    if (this.pointerTracker) {
      this.scene.onPointerObservable.remove(this.pointerTracker);
      this.pointerTracker = null
    }
    if (this.groupEventListener) {
      VRSPACE.removeGroupListener(this.groupEventListener);
      this.groupEventListener = null;
    }
    this.closeMembersForm();
    if (this.settingsForm != null) {
      this.settingsForm.dispose();
      this.settingsArea.dispose();
    }
  }
}

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