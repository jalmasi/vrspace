package org.vrspace.server.dto;

import lombok.Data;

@Data
public class WebPushMessage {
  public static enum Type {
    // TODO join request event, request accepted event?
    GROUP_INVITE, GROUP_MESSAGE, WORLD_INVITE, GROUP_ASK, GROUP_ALLOWED, MESSAGE_ATTACHMENT
  }

  private Type type;
  /** Name of the client that sends the message */
  private String sender;
  private String groupId;
  private String groupName;
  private String worldId;
  private String worldName;
  private String message;
  private String url;
}
