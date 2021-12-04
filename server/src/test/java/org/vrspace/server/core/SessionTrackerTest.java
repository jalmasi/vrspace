package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.vrspace.server.config.ServerConfig;
import org.vrspace.server.obj.Client;

/**
 * Does not test much, just checks for runtime exceptions (NPE)
 * 
 * @author joe
 *
 */
public class SessionTrackerTest {

  @Test
  public void testLimitConfigured() throws Exception {
    ServerConfig config = new ServerConfig();
    config.setMaxSessions(100);
    SessionTracker tracker = new SessionTracker(config);
    tracker.addSession(new Client(1L));
  }

  @Test
  public void testNoLimitConfigured() throws Exception {
    ServerConfig config = new ServerConfig();
    config.setMaxSessions(0);
    SessionTracker tracker = new SessionTracker(config);
    tracker.addSession(new Client(1L));
  }

  @Test
  public void testChangeLimits() throws Exception {
    ServerConfig config = new ServerConfig();
    SessionTracker tracker = new SessionTracker(config);
    // test default, whatever that is
    Client client = new Client(1L);
    tracker.addSession(client);
    tracker.remove(client);
    // test 0
    tracker.setMaxSessions(0);
    assertEquals(0, config.getMaxSessions());
    tracker.addSession(client);
    tracker.remove(client);
    // test changing 0 to anything
    tracker.setMaxSessions(10);
    assertEquals(10, config.getMaxSessions());
    tracker.addSession(client);
    tracker.remove(client);
    // test changing anything to 0
    tracker.setMaxSessions(0);
    assertEquals(0, config.getMaxSessions());
    tracker.addSession(client);
    tracker.remove(client);
  }
}
