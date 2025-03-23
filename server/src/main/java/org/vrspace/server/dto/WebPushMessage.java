package org.vrspace.server.dto;

import lombok.Data;

@Data
public class WebPushMessage {
  public static enum Type {
    GROUP_INVITE, GROUP_MESSAGE, WORLD_INVITE
  }

  private Type type;
  /** Name of the client that sends the message */
  private String sender;
  private String group;
  private String world;
  private String message;
  private String url;
}
