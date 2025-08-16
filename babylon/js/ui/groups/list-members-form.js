import { VRSPACE } from '../../client/vrspace.js';
import { VRSPACEUI } from '../vrspace-ui.js';
import { VRSpaceAPI } from '../../client/rest-api.js';
import { GroupsApi } from '../../client/openapi/api/GroupsApi.js';
import { Form } from '../widget/form.js';
import { World } from '../../world/world.js';

export class ListMembersForm extends Form {
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
    /** @type {GroupsApi} */
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

