package org.vrspace.server.dto;

import java.util.Optional;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.UserData;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Command to set/clear/get/list UserData of a Client.
 * 
 * @author joe
 *
 */
@lombok.Data
@NoArgsConstructor
@JsonInclude(Include.NON_NULL)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@Slf4j
public class Data implements Command {
  /** list/get/set/clear */
  private String action;
  /** used in get/set/clear */
  private String key;
  /** used in set only */
  private String value;

  @Override
  public ClientResponse execute(WorldManager worldManager, Client client) throws Exception {
    if ("list".equals(action)) {
      return new ClientResponse(worldManager.getDb().listUserData(client.getId()));
    } else if ("clear".equals(action) && key != null) {
      worldManager.getDb().findUserData(client.getId(), key).ifPresent(data -> worldManager.getDb().delete(data));
    } else if ("get".equals(action) && key != null) {
      Optional<UserData> data = worldManager.getDb().findUserData(client.getId(), key);
      if (data.isPresent()) {
        return new ClientResponse(data.get());
      }
    } else if ("set".equals(action) && key != null && value != null) {
      Optional<UserData> data = worldManager.getDb().findUserData(client.getId(), key);
      UserData updated = null;
      if (data.isPresent()) {
        updated = data.get();
        updated.setValue(value);
      } else {
        updated = new UserData(client, key, value);
      }
      worldManager.getDb().save(updated);
    } else {
      throw new UnsupportedOperationException("Invalid action:" + action);
    }
    return null;
  }

}
