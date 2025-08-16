import { VRSPACE } from '../../client/vrspace.js';
import { VRSPACEUI } from '../vrspace-ui.js';
import { VRSpaceAPI } from '../../client/rest-api.js';
import { GroupsApi } from '../../client/openapi/api/GroupsApi.js';
import { Form } from '../widget/form.js';
import { UserGroup } from '../../client/openapi/model/UserGroup.js';
import { GroupMember } from '../../client/openapi/model/GroupMember.js';
import { FormArea } from '../widget/form-area.js';
import { World } from '../../world/world.js';
import { ChatLog } from '../widget/chat-log.js';
import { GroupSettingsForm } from './group-settings-form.js';
import { GroupInviteForm } from './group-invite-form.js'; 
import { InviteInfoForm } from './invite-info-form.js';
import { ListMembersForm } from './list-members-form.js';

export class ListGroupsForm extends Form {
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
        group.chatlog.input.attachments=true;
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
        group.chatlog.addListener((text, data, attachments) => {
          if (data) {
            this.groupApi.shareWorld(group.id, data);
          } else {
            this.groupApi.write(group.id, text).then(msgId=>{
              if ( attachments ) {
                console.log("upload attachments to "+msgId);
                attachments.forEach(file=>{
                  VRSpaceAPI.getInstance().attach(file,group.id,msgId);
                });
              }
            });
          }
        });

        group.chatlog.groupListener = VRSPACE.addGroupListener(event => {
          if (event.message && group.id == event.message.group.id) {
            // different serialization:
            //group.chatlog.log(event.message.from.User.name, event.message.content, event.message.link, event.message.local);
            group.chatlog.log(event.message.from.name, event.message.content, event.message.link, event.message.local);
          } else if (event.attachment && group.id == event.attachment.group.id) {
            console.log("TODO process message attachments");
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

