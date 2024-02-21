package org.vrspace.server.dto;

import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.EventRecorder;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Command to start/stop/play recording of client's events.
 * 
 * @see EventRecorder
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@JsonInclude(Include.NON_NULL)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.WRAPPER_OBJECT)
@Slf4j
public class Recording implements Command {
  private String action;
  private String name;

  public ClientResponse execute(WorldManager worldManager, Client client) {
    EventRecorder recorder = null;
    if (this.name == null) {
      this.name = "Recorder:" + client.getId();
    }
    Client recorderClient = worldManager.getClientByName(this.name);
    if (recorderClient == null) {
      recorder = new EventRecorder(worldManager, client, this.name);
      // TODO make these command parameters
      recorder.setRecordClient(true);
      recorder.setRecordScene(false);
      recorder.setLoop(true);
      worldManager.save(recorder);
      log.debug("Created new recorder for " + client);
    } else if (recorderClient instanceof EventRecorder) {
      recorder = (EventRecorder) recorderClient;
      log.debug("Found recorder " + recorder);
    }
    if ("record".equals(this.action)) {
      recorder.init(worldManager, client);
      recorder.start();
    } else if ("play".equals(this.action)) {
      recorder.setLoop(true);
      recorder = worldManager.save(recorder);
      recorder.play();
    } else if ("stop".equals(this.action)) {
      recorder.setLoop(false);
      recorder.stop();
      recorder = worldManager.save(recorder);
      log.debug("Saved recorder " + recorder);
      // so that recorder reloads:
      client.getScene().setDirty();
      client.getScene().update();
    } else {
      throw new IllegalArgumentException("Invalid action: " + action);
    }
    return null;
  }
}
