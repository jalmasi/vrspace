import { VRSPACE } from './../client/vrspace.js';
import { VRSPACEUI } from './vrspace-ui.js';
import { VRSpaceAPI } from '../client/rest-api.js';
import { GroupsApi } from '../client/openapi/api/GroupsApi.js';
import { FormArea } from './widget/form-area.js';
import { Dialogue } from "./widget/dialogue.js";
import { ChatLog } from './widget/chat-log.js';
import { CreateGroupForm } from './groups/create-groups-form.js';
import { ListGroupsForm } from './groups/list-groups-form.js';
import { UserInviteForm } from './widget/user-invite-form.js';
import { GroupHelper } from './groups/group-helper.js';

export class ChatUI {
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
    /** @type {UserInviteForm} */
    this.inviteForm = null;
    this.listGroupsButton = null;
    this.createGroupsButton = null;
    this.groupsInvitesButton = null;
    this.activeButton = null;
    this.invitations = [];
    this.listGroupsText = "List Groups";
    this.createGroupText = "Create Group";
    this.listDirectText = "Messages";
    this.createDirectText = "Contact";
    this.unreadGroupsTotal = 0;
    this.unreadChatsTotal = 0;
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

  /**
   * Called from outside
   * @param {*} button HUD button that activates this call
   */
  async show(button) {
    VRSPACEUI.hud.showButtons(false, button);
    VRSPACEUI.hud.newRow();
    let unreadGroups = await this.groupApi.listUnreadGroups();
    this.unreadGroupsTotal = 0;
    this.unreadChatsTotal = 0;
    unreadGroups.forEach(group=>{
      if ( group.direct ) {
        this.unreadChatsTotal += group.unread;
      } else {
        this.unreadGroupsTotal += group.unread;
      }
    });

    this.showChatsButton();
    this.createChatButton = this.hud.addButton(this.createDirectText, this.contentBase + "/content/icons/user-plus.png", () => { this.addContactUI() });
    
    this.showListButton();
    this.createGroupsButton = this.hud.addButton(this.createGroupText, this.contentBase + "/content/icons/user-group-plus.png", () => { this.createGroupUI() });
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
            this.unreadGroupsTotal++;
          }
        }
        this.showListButton();
      } else if (event.invite) {
        this.invitations.push(event.invite);
        this.showInvitesButton();
      }
    });
  }

  async showChatsButton() {
    let listText = this.listDirectText;
    if (this.unreadChatsTotal > 0) {
      listText += ": " + this.unreadChatsTotal;
    }
    if (this.listChatsButton) {
      this.listChatsButton.text = listText;
    } else {
      this.listChatsButton = this.hud.addButton(listText, this.contentBase + "/content/icons/user-chat.png", () => { this.listGroupsUI(true, this.listChatsButton) }, false);
    }
  }
  
  async showListButton() {
    let listText = this.listGroupsText;
    if (this.unreadGroupsTotal > 0) {
      listText += ": " + this.unreadGroupsTotal;
    }
    if (this.listGroupsButton) {
      this.listGroupsButton.text = listText;
    } else {
      this.listGroupsButton = this.hud.addButton(listText, this.contentBase + "/content/icons/user-group-settings.png", () => { this.listGroupsUI() }, false);
    }
    this.listGroups();
  }

  listGroups() {
    Promise.all([this.groupApi.listInvites(), this.groupApi.listMyGroups()]).then(groups => {
      // CHECKME probably need to update internal variables
      this.updateButtons(groups[0], groups[1]);
    });    
  }  
  groupCount(invites,memberships,direct=false) {
    return invites.filter(i=>i.group.direct == direct).length + memberships.filter(m=>m.direct == direct).length;
  }
  async updateButtons(invites, memberships) {  
    let directTotal = this.groupCount(invites,memberships,true);
    let membershipTotal = invites.length+memberships.length - directTotal;
    if (membershipTotal == 0) {
      VRSPACEUI.hud.markDisabled(this.listGroupsButton);
    } else {
      VRSPACEUI.hud.markEnabled(this.listGroupsButton);
    }
    if (directTotal == 0) {
      VRSPACEUI.hud.markDisabled(this.listChatsButton);
    } else {
      VRSPACEUI.hud.markEnabled(this.listChatsButton);
    }
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
    if ( this.activeButton ) {
      this.hud.markEnabled(this.activeButton);
      this.activeButton = null;
    }
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

  /** List invites */
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

  /** 
   * List groups
   * @param {boolean} [direct=false] true for direct messages (private chats) 
   */
  listGroupsUI(direct=false, button=this.listGroupsButton) {
    if (this.listGroupsForm) {
      this.clearForm();
    } else {
      this.hud.markActive(button);
      this.activeButton = button;
      // tracking unread here while group list/chatlog is open is too complicated, so
      this.unreadGroupsTotal = 0;
      // do not do it here - makes additional API calls:
      //this.showListButton();
      Promise.all([this.groupApi.listInvites(), this.groupApi.listMyGroups(), this.groupApi.listOwnedGroups(), this.groupApi.listUnreadGroups()])
        .then(results => {
          this.invitations = results[0]; //.filter(g=>g.direct == direct);
          let myGroups = results[1].filter(g=>g.direct == direct);
          let ownedGroups = results[2];
          let unreadGroups = results[3];

          myGroups.forEach(g => g.isOwned = ownedGroups.some(e => e.id == g.id));
          myGroups.forEach(g => g.unread = unreadGroups.find(e => e.id == g.id)?.unread || "");

          this.showInvitesButton();
          this.updateButtons(this.invitations,myGroups);
          
          // CHECKME - likely wrong
          if (this.groupCount(this.invitations,myGroups,direct) > 0) {
            this.createForm(this.invitations, myGroups, () => this.listGroupsUI(direct, button));
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

  createGroupUI() {
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

  /**
   * Invite a user to a private chat: pop up UserInviteForm to select/enter the user, 
   * then create a private group, and send the invite.
   */
  addContactUI() {
    if ( this.inviteForm ) {
      VRSPACEUI.hud.clearRow();
      VRSPACEUI.hud.showButtons(true);
      this.inviteForm.dispose();
      this.inviteForm = null;
    } else {
      VRSPACEUI.hud.showButtons(false, this.createChatButton);
      VRSPACEUI.hud.newRow();
      this.inviteForm = new UserInviteForm(this.scene, (ok, userId, userName) => {
        if (ok) {
          // TODO this chat may already exist
          let groupName = "Chat: "+VRSPACE.me.name+", "+userName;
          this.groupApi.create(
             groupName,
             {
               isPublic: false,
               isTemporary: false,
               isDirect: true
             }
          ).then(group => {
            this.groupApi.invite(group.id, userId).then(()=>{
              console.log("Invited "+userId+" "+userName+" to "+group.id+" "+group.name);
              GroupHelper.showUnread(group);
            });
            this.listGroups();
          });
        }
        VRSPACEUI.hud.clearRow();
        VRSPACEUI.hud.showButtons(true);
        this.inviteForm.dispose();
        this.inviteForm = null;
      });
      this.inviteForm.init();
      this.inviteForm.addToHud();
    }
  }

  
}