import { VRSPACEUI } from '../vrspace-ui.js';
import { VRSpaceAPI } from '../../client/rest-api.js';
import { GroupsApi } from '../../client/openapi/api/GroupsApi.js';
import { Form } from '../widget/form.js';
import { UserGroup } from '../../client/openapi/model/UserGroup.js';

export class GroupSettingsForm extends Form {
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

