import { VRSPACE } from './../client/vrspace.js';
import { VRSPACEUI } from './vrspace-ui.js';
import { VRSpaceAPI } from '../client/rest-api.js';
import { GroupControllerApi } from '../client/openapi/api/GroupControllerApi.js';
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

class ListMembersForm extends Form {
  constructor(group, members, close, isOwner) {
    super();
    this.group = group;
    this.members = members;
    this.close = close;
    this.isOwner = isOwner;
    this.closeText = "Close";
  }
  init() {
    this.createPanel();
    this.grid = new BABYLON.GUI.Grid();
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.grid.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  
    this.grid.paddingLeftInPixels = 10;
    this.grid.paddingTopInPixels = 10;
    this.grid.paddingBottomInPixels = 10;
    
    this.grid.addColumnDefinition(1);
    this.members.forEach((client,index)=>{
      this.grid.addRowDefinition(this.heightInPixels, true);
      let clientName = this.textBlock(client.name);
      this.grid.addControl(clientName, index, 0);
    });
    // empty row
    this.grid.addRowDefinition(this.heightInPixels, true);
    this.grid.addRowDefinition(this.heightInPixels, true);
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.closeButton = this.textButton(this.closeText, () => this.close(), VRSPACEUI.contentBase+"/content/icons/close.png", this.cancelColor);
    this.grid.addControl(this.closeButton, this.members.length+1, 0);
        
    this.panel.addControl(this.grid);
  }
}

class GroupSettingsForm extends Form {
  constructor(group, isReadOnly, close, listCallback){
    super();
    /** @type {UserGroup} */
    this.group = group;
    this.listCallback = listCallback;
    this.isReadOnly = isReadOnly;
    this.close = close;
    this.nameText = "Name:";
    this.publicText = "Public:";
    this.submitText = "Submit";
    this.cancelText = "Cancel";
    this.closeText = "Close";
    this.membersText = "Members:";
    this.listText = "  List  ";
    this.members = [];
    this.paddingLeftInPixels = 10;
    /** @type {GroupControllerApi} */
    this.groupApi = VRSpaceAPI.getInstance().endpoint.groups;
  }
  init() {
    this.panel1 = this.createPanel();
    this.panel1.height = "128px";
    
    this.nameLabel = this.textBlock(this.nameText);
    this.addControl(this.nameLabel);
    
    this.nameInput = this.inputText('name');
    this.nameInput.text = this.group.name;
    this.nameInput.isReadOnly = this.isReadOnly;
    this.addControl(this.nameInput);
    
    this.publicLabel = this.textBlock(this.publicText);
    this.addControl(this.publicLabel);
    
    this.publicCheckbox = this.checkbox('public');
    this.publicCheckbox.isChecked = this.group.public;
    this.publicCheckbox.isReadOnly = this.isReadOnly;
    this.addControl(this.publicCheckbox);
    
    this.membersLabel = this.textBlock(this.membersText);
    this.addControl(this.membersLabel);
    
    this.membersCount = this.textBlock("");
    this.addControl(this.membersCount);
    this.groupApi.show(this.group.id).then(members=>{
      this.members = members;
      this.membersCount.text = members.length;
    });
    
    this.showMembers = this.textButton(this.listText, () => this.listCallback(this.members), VRSPACEUI.contentBase+"/content/icons/user-group-info.png");
    this.addControl(this.showMembers);
    
    this.panel2 = this.createPanel();
    this.panel2.height = "128px";
    this.panel2.paddingLeft="30%";

    if ( this.isReadOnly ) {
      let noButton = this.textButton(this.closeText, () => this.close(false), VRSPACEUI.contentBase+"/content/icons/close.png", this.cancelColor);
      this.addControl(noButton);
    } else {
      let yesButton = this.textButton(this.submitText, () => this.close(true), VRSPACEUI.contentBase+"/content/icons/tick.png");
      this.addControl(yesButton);
      let noButton = this.textButton(this.cancelText, () => this.close(false), VRSPACEUI.contentBase+"/content/icons/close.png", this.cancelColor);
      this.addControl(noButton);
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
    this.addControl(this.textBlock(this.groupText+" "+this.invite.group.name+" "+this.memberText+" "+this.invite.sponsor.name)); 
    let yesButton = this.textButton(this.acceptText, () => this.callback(true), VRSPACEUI.contentBase+"/content/icons/tick.png");
    this.addControl(yesButton);
    let noButton = this.textButton(this.cancelText, () => this.callback(false), VRSPACEUI.contentBase+"/content/icons/close.png", this.cancelColor);
    this.addControl(noButton);
  }
}
class ListGroupsForm extends Form {
  constructor(scene, invites, groups, privateIcon, leaveGroupIcon, groupSettingIcon, groupInviteIcon, groupInfoIcon, groupAcceptIcon, groupDeleteIcon, groupDeleteCallback, refreshCallback) {
    super();
    this.scene = scene;
    /** @type { [GroupMember]} */
    this.invites = invites;
    /** @type { [UserGroup]} */
    this.groups = groups;
    /** @type { [UserGroup]} */
    this.table = Array(this.invites.length+this.groups.length);
    this.privateIcon = privateIcon;
    this.leaveGroupIcon = leaveGroupIcon;
    this.groupSettingIcon = groupSettingIcon;
    this.groupInviteIcon = groupInviteIcon;
    this.groupInfoIcon = groupInfoIcon;
    this.groupAcceptIcon = groupAcceptIcon;
    this.groupDeleteIcon = groupDeleteIcon;
    this.groupDeleteCallback = groupDeleteCallback;
    this.refreshCallback = refreshCallback;
    this.stackVertical = false;
    this.stackHorizontal = true;
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
        if ( pointerInfo.pickInfo.pickedMesh == this.plane ) {
          let coord = pointerInfo.pickInfo.getTextureCoordinates();
          // width of group text in column 2
          if (coord.x > 0.1 && coord.x < 0.8) {
            if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERMOVE) {
              let row = Math.floor((1-coord.y)*(this.table.length));
              this.pointerEvent(row);
            } else if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN) {
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
      let indexLabel = this.textBlock(index+1);
      indexLabel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.grid.addControl(indexLabel, index, 0);
      
      let privateImage = this.makeIcon("private", this.privateIcon);
      this.grid.addControl(privateImage, index, 1);
      privateImage.isVisible = !invite.group.public;
      this.grid.addControl(this.textBlock(invite.group.name), index, 2);
      
      let infoButton = this.submitButton("info", ()=>this.inviteInfo(invite), this.groupInfoIcon);
      //infoButton.isVisible = false;
      infoButton.background = this.background;
      this.grid.addControl(infoButton, index, 4);
      
      let acceptButton = this.submitButton("accept", ()=>this.inviteAccept(invite), this.groupAcceptIcon);
      this.grid.addControl(acceptButton, index, 5);
      //acceptButton.isVisible = false;
      
      let rejectButton = this.submitButton("reject", ()=>this.inviteReject(invite), this.groupDeleteIcon);
      rejectButton.background = this.cancelColor; 
      this.grid.addControl(rejectButton, index, 6);
      //rejectButton.isVisible = false;
      
      this.table[index] = invite.group;
      this.table[index].isInvite = true;
      index++;
    });
    
    this.groups.forEach(group => {
      this.grid.addRowDefinition(this.heightInPixels, true);
      
      let indexLabel = this.textBlock(index+1);
      indexLabel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.grid.addControl(indexLabel, index, 0);
      
      let privateImage = this.makeIcon("private", this.privateIcon);
      this.grid.addControl(privateImage, index, 1);
      privateImage.isVisible = !group.public;
      
      this.grid.addControl(this.textBlock(group.name), index, 2);
      
      this.grid.addControl(this.textBlock(group.unread), index, 3);
      
      let button;
      if ( group.isOwned ) {
        button = this.submitButton("settings", ()=>this.groupSettings(group), this.groupSettingIcon);
      } else {
        button = this.submitButton("info", ()=>this.groupInfo(group), this.groupInfoIcon);
      }
      button.isVisible = false;
      button.background = this.background;
      this.grid.addControl(button, index, 4);

      let inviteButton = this.submitButton("invite", ()=>this.groupInvite(group), this.groupInviteIcon);
      this.grid.addControl(inviteButton, index, 5);
      inviteButton.isVisible = false;
      
      let deleteButton = this.submitButton("delete", ()=>this.groupDeleteCallback(group), this.groupDeleteIcon);
      deleteButton.background = this.cancelColor; 
      this.grid.addControl(deleteButton, index, 6);
      deleteButton.isVisible = false;
      
      this.table[index] = group;
      index++;
    });

    this.panel.addControl(this.grid);

    this.textureWidth = 1280;
    this.textureHeight = this.heightInPixels * (Math.max(this.grid.rowCount, 1))+this.grid.paddingTopInPixels+this.grid.paddingBottomInPixels;
    
    this.groupEventListener = VRSPACE.addGroupListener(event=>{
      if ( event.message ) {
        let groupIndex = this.groups.findIndex(group => group.id == event.message.group.id);
        if ( groupIndex >= 0 ) {
          this.groups[groupIndex].unread++;
          let row = groupIndex + this.invites.length;
          this.grid.getChildrenAt(row,3)[0].text = this.groups[groupIndex].unread; 
        }
      } else if ( event.invite ) {
        // CHECKME: what to do with invites?
        this.groups.find(group => group.id == event.invite.userGroup.id);
      }
    });
  }
  pointerEvent(row) {
    if ( row !== this.activeRow ) {
      this.activeRow = row;
      if ( this.activeButtons ) {
        this.activeButtons.forEach(button=>button.isVisible = false);
        this.activeButtons = null;
      }
      if ( this.activeText ) {
        this.activeText.fontStyle = null;
        this.activeText = null;
      }
      let group = this.table[row];
      if ( group.isInvite ) {
        // not changing anything for invites
        return;
      }
      let button = this.grid.getChildrenAt(row,4)[0];
      let inviteButton = this.grid.getChildrenAt(row,5)[0];
      let deleteButton = this.grid.getChildrenAt(row,6)[0];
      button.isVisible = true;
      inviteButton.isVisible = (group.isOwned || group.public || group.isInvite);
      deleteButton.isVisible = group.isOwned || group.isInvite ;
      this.activeButtons = [button,inviteButton,deleteButton];
      this.activeText = this.grid.getChildrenAt(row,2)[0];
      this.activeText.fontStyle = "bold";
    }
  }
  pointerOut() {
    if ( this.activeRow != null ) {
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
    }
  }
  inviteInfo(invite) {
    let inviteForm = new InviteInfoForm(invite, accepted=>{
      if ( accepted ) {
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
    this.refreshCallback();
  }
  async inviteReject(invite) {
    await this.groupApi.leave(invite.group.id)
    this.refreshCallback();
  }
  pointerClick() {
    let group = this.groups[this.activeRow];
    // TODO check group.isInvite
    console.log("read messages of: "+group.isInvite,group);
    
    if ( typeof group.chatlog == "undefined") {
      group.chatlog = ChatLog.findInstance(group.name, "ChatLog:"+group.name);
      if ( group.chatlog == null ) {
        group.chatlog = new ChatLog(this.scene, group.name, "ChatLog:"+group.name);
        group.chatlog.canClose = true;
        group.chatlog.minimizeTitle = false;
        group.chatlog.minimizeInput = true;
        group.chatlog.autoHide = false;
        if ( this.stackVertical ) {
          group.chatlog.verticalAnchor = group.chatlog.verticalAnchor + 0.05 * (ChatLog.instanceCount-1); 
        }
        if ( this.stackHorizontal ) {
          group.chatlog.baseAnchor = group.chatlog.baseAnchor + 0.25 * (ChatLog.instanceCount-1);
        } 
        group.chatlog.show();
        //group.chatlogSelection = World.lastInstance.addSelectionPredicate((mesh) => group.chatLog.isSelectableMesh(mesh));
        group.chatlog.input.autoWrite = false;
        group.chatlog.input.virtualKeyboardEnabled = World.lastInstance.inXR();
        group.chatlog.input.addListener(text => {
          // TODO send a group message message
          this.groupApi.write(group.id,text);
        });

        group.chatlog.groupListener = VRSPACE.addGroupListener(event=>{
          if ( event.message && group.id == event.message.group.id) {
            group.chatlog.log(event.message.from.User.name, event.message.content);
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
      
      this.groupApi.listUnreadMessages(group.id).then(messages=>{
        messages.forEach(message=>{
          group.chatlog.log(message.from.name, message.content);
        });
      });

    }
  }
  async groupLeave(group) {
    await this.groupApi.leave(group.id)
    this.refreshCallback();
  }
  groupList(members) {
    if ( this.listMembersForm != null ) {
      this.listMembersForm.dispose();
      this.listArea.dispose();
    }
    let group = this.groups[this.activeRow];
    this.listMembersForm = new ListMembersForm(group, members, ()=>{
      this.listMembersForm.dispose();
      this.listArea.dispose();
      this.listMembersForm = null;
      this.listArea = null;
    });
    this.listMembersForm.init();

    this.listArea = new FormArea(this.scene, this.listMembersForm);
    this.listArea.size = .2;
    this.listArea.show(1024,this.listMembersForm.heightInPixels*(members.length+3));
    this.listArea.attachToHud();
    this.listArea.detach(.7);
    this.listArea.group.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  }
  groupCommon(group, isReadOnly, callback) {
    if ( this.settingsForm != null ) {
      this.settingsForm.dispose();
      this.settingsArea.dispose();
    }
    this.settingsForm = new GroupSettingsForm(group, isReadOnly, (ok)=>{
      callback(ok);
      this.settingsForm.dispose();
      this.settingsArea.dispose();
    }, (members)=>this.groupList(members));
    this.settingsForm.init();

    this.settingsArea = new FormArea(this.scene, this.settingsForm);
    this.settingsArea.size = .2;
    this.settingsArea.show(1280,256);
    this.settingsArea.attachToHud();
    this.settingsArea.detach(.8);
    this.settingsArea.group.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  }
  groupInfo(group) {
    this.groupCommon(group, true, ()=>this.settingsArea.dispose());
  }
  groupSettings(group) {
    this.groupCommon(group, false, (ok)=>{
      if(ok) {
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
    });
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
  dispose() {
    super.dispose();
    World.lastInstance.removeSelectionPredicate(this.selectionPredicate);
    if ( this.pointerTracker ) {
      this.scene.onPointerObservable.remove(this.pointerTracker);
      this.pointerTracker = null
    }
    if ( this.groupEventListener ) {
      VRSPACE.removeGroupListener(this.groupEventListener);
      this.groupEventListener = null;
    }
    if ( this.listMembersForm != null ) {
      this.listMembersForm.dispose();
      this.listArea.dispose();
    }
    if ( this.settingsForm != null ) {
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
  }

  async show(button) {
    VRSPACEUI.hud.showButtons(false, button);
    VRSPACEUI.hud.newRow();
    let unreadGroups = await this.groupApi.listUnreadGroups();
    let unreadTotal = unreadGroups.reduce((sum,group)=>sum + group.unread, 0);
    let listText = "List";
    if (unreadTotal > 0){
      listText += ": "+unreadTotal;
    }
    this.listGroupsButton = this.hud.addButton(listText, this.contentBase + "/content/icons/user-group-settings.png", () => { this.listUI() }, false);
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
      Promise.all([this.groupApi.listInvites(), this.groupApi.listMyGroups(), this.groupApi.listOwnedGroups(), this.groupApi.listUnreadGroups()])
      .then(results => {
        let invites = results[0];
        let myGroups = results[1];
        let ownedGroups = results[2];
        let unreadGroups = results[3];
        
        myGroups.forEach(g=>g.isOwned = ownedGroups.some(e=>e.id == g.id));
        myGroups.forEach(g=>g.unread = unreadGroups.find(e=>e.id == g.id)?.unread || "");

        console.log(invites, myGroups);
        
        let form = new ListGroupsForm(
          this.scene,
          invites,
          myGroups, 
          this.contentBase + "/content/icons/private-message.png", 
          this.contentBase + "/content/icons/user-group-minus.png", 
          this.contentBase + "/content/icons/user-group-settings.png",
          this.contentBase + "/content/icons/user-group-plus.png", 
          this.contentBase + "/content/icons/user-group-info.png", 
          this.contentBase + "/content/icons/tick.png",
          this.contentBase + "/content/icons/delete.png",
          group=>this.groupDelete(group),
          () => this.refreshList()
        );
        form.init();

        this.listGroupsForm = new FormArea(this.scene, form);
        this.listGroupsForm.size = .1;
        this.listGroupsForm.show(form.textureWidth, form.textureHeight);
        this.listGroupsForm.attachToHud();
        this.listGroupsForm.detach(1);
        this.listGroupsForm.group.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
      });
    }
  }

  groupDelete(group) {
    let dialogue = new Dialogue("Delete "+group.name+" ?", (yes)=>{
      if ( yes ) {
        this.groupApi.callDelete(group.id).then(()=>{
          this.refreshList();
        });
      }
    });
    dialogue.init();
  }

  refreshList() {
    this.listUI();
    this.listUI();
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