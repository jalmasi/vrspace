import { VRSPACE } from '../../client/vrspace.js';
import { VRSpaceAPI } from '../../client/rest-api.js';
import { UserGroup } from '../../client/openapi/model/UserGroup.js';
import { ChatLog } from '../widget/chat-log.js';
import { World } from '../../world/world.js';

// CHECKME: Helper or Util class?
export class GroupHelper {
  /**
   * @param {UserGroup} group 
   * @param {*} scene 
   */
  static attachChatlog(group, scene, stackVertical, stackHorizontal) {
    group.chatlog = ChatLog.findInstance(group.name, "ChatLog:" + group.name);
    if (group.chatlog == null) {
      let groupApi = VRSpaceAPI.getInstance().endpoint.groups;
      group.chatlog = new ChatLog(scene, group.name, "ChatLog:" + group.name);
      group.chatlog.canClose = true;
      group.chatlog.minimizeTitle = false;
      group.chatlog.minimizeInput = true;
      group.chatlog.autoHide = false;
      group.chatlog.input.attachments=true;
      if (stackVertical) {
        group.chatlog.verticalAnchor = group.chatlog.verticalAnchor + 0.05 * (ChatLog.instanceCount - 1);
      }
      if (stackHorizontal) {
        group.chatlog.baseAnchor = group.chatlog.baseAnchor + 0.25 * (ChatLog.instanceCount - 1);
      }
      group.chatlog.show();
      group.chatlog.input.autoWrite = false;
      group.chatlog.input.virtualKeyboardEnabled = World.lastInstance.inXR();
      // add listener for share world (default-hud)
      group.chatlog.addListener((text, data, attachments) => {
        if (data) {
          groupApi.shareWorld(group.id, data);
        } else {
          groupApi.write(group.id, text).then(msgId=>{
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
          //group.chatlog.log(event.message.from.name, event.message.content, event.message.link, event.message.local);
          group.chatlog.logMessage(event.message);
        } else if (event.attachment && group.id == event.attachment.group.id) {
          console.log("TODO process message attachments");
          group.chatlog.addAttachment(event.attachment);
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
    
  }
  
  static showUnread(group) {
    VRSpaceAPI.getInstance().endpoint.groups.listUnreadMessages(group.id).then(messages => {
      messages.forEach(message => {
        // CHECKME: include links?
        //group.chatlog.log(message.from.name, message.content, message.link);
        group.chatlog.logMessage(message);
      });
    });
    
  }
}