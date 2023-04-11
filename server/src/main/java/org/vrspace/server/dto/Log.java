package org.vrspace.server.dto;

import org.vrspace.server.core.SessionException;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Browsers on mobile devices do not have javscript console, and USB debugging
 * is next to useless. So they can send log messages to the server using this
 * command.
 * 
 * @author joe
 *
 */
@Data
@NoArgsConstructor
@Slf4j
public class Log implements Command {
  /** Log message */
  String message;
  /** Severity: debug, info, warn, error */
  String severity;

  @Override
  public ClientResponse execute(WorldManager manager, Client client) throws ClassNotFoundException, SessionException {
    if (severity == null) {
      severity = "debug";
    }
    String logEntry = "Client " + client.getId() + ": " + message;
    switch (severity) {
    case "debug":
      log.debug(logEntry);
      break;
    case "info":
      log.info(logEntry);
      break;
    case "warn":
      log.warn(logEntry);
      break;
    case "error":
      log.error(logEntry);
      break;
    default:
      log.error("Invalid log level received from Client " + client.getId() + ": " + severity + " Message: " + logEntry);
    }
    return null;
  }
}
