package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.obj.Client;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest(classes = JacksonConfig.class)
public class SanitationTest {

  @Autowired
  ObjectMapper jackson;

  @Mock
  private ConcurrentWebSocketSessionDecorator session;

  @Captor
  private ArgumentCaptor<WebSocketMessage<?>> message;

  private String evil = "a <script>javascript:alert('pwned')</script> string";
  private String good = "a javascript:alert('pwned') string";

  @Test
  public void testString() throws Exception {
    String ret = jackson.readValue("\"" + evil + "\"", String.class);
    assertEquals(good, ret);
  }

  @Test
  public void testEvents() throws Exception {
    when(session.isOpen()).thenReturn(true);
    doNothing().when(session).sendMessage(message.capture());

    Client client = new Client();
    Client recepient = new Client() {
      @Override
      public void processEvent(VREvent event) {
        // internally generated strings are distributed untouched
        assertEquals(evil, event.getChanges().get("name"));
        super.processEvent(event);
      }
    };
    recepient.setMapper(jackson);
    recepient.setSession(session);
    client.addListener(recepient);

    VREvent event = new VREvent(client, client);
    event.addChange("name", evil);

    Dispatcher d = new Dispatcher(jackson);
    d.dispatch(event);
    // CHECKME: why single space?
    assertEquals(good, client.getName());

    // distributed sanitized string
    String msg = ((TextMessage) message.getValue()).getPayload();
    assertTrue(msg.contains("{\"name\":\"" + good + "\"}"));
  }
}
