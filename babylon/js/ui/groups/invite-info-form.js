import { VRSPACEUI } from '../vrspace-ui.js';
import { GroupMember } from '../../client/openapi/model/GroupMember.js';
import { Form } from '../widget/form.js';

export class InviteInfoForm extends Form {
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
