package org.vrspace.server.core;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.vrspace.server.config.ServerConfig;
import org.vrspace.server.obj.Client;

/**
 * Used to limit number of concurrent active sessions.
 * 
 * @author joe
 *
 */
public class SessionTracker {
  private ServerConfig config;

  private ArrayBlockingQueue<Long> activeSessions;

  public SessionTracker(ServerConfig config) {
    this.config = config;
    this.setMaxSessions(config.getMaxSessions());
  }

  public void setMaxSessions(int max) {
    if (max == 0) {
      activeSessions = null;
    } else if (config.getMaxSessions() == 0) {
      activeSessions = new ArrayBlockingQueue<>(max);
    } else {
      ArrayBlockingQueue<Long> q = new ArrayBlockingQueue<>(max);
      if (activeSessions != null) {
        activeSessions.drainTo(q);
      }
      activeSessions = q;
    }
    config.setMaxSessions(max);
  }

  public void addSession(Client client) {
    if (config.getMaxSessions() > 0) {
      boolean started;
      try {
        started = activeSessions.offer(client.getId(), config.getSessionStartTimeout(), TimeUnit.SECONDS);
      } catch (InterruptedException e) {
        throw new RuntimeException("Interrupted waiting to start session for client " + client.getId());
      }
      if (!started) {
        throw new RuntimeException("Failed to start session " + config.getMaxSessions() + " in "
            + config.getSessionStartTimeout() + " seconds ");
      }
    }
  }

  public void remove(Client client) {
    if (config.getMaxSessions() > 0) {
      try {
        activeSessions.take();
      } catch (InterruptedException e) {
        throw new RuntimeException("Interupted while removing session of " + client.getId());
      }
    }

  }
}
