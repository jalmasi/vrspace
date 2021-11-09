package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.Owned;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;

@SpringBootTest(classes = JacksonConfig.class)
@ExtendWith(MockitoExtension.class)
public class DispatcherTest {

  @Autowired
  private ObjectMapper mapper;

  @Mock
  Client listener;

  Dispatcher dispatcher;

  @BeforeEach
  public void setUp() {
    dispatcher = new Dispatcher(mapper);
  }

  @Test
  public void testMergeChanges() throws Exception {
    VRObject t = new VRObject(1L);
    t.setPosition(new Point(1, 0, 0));
    // t.setX(1);
    printJson(t);

    ObjectReader reader = mapper.readerForUpdating(t);
    reader.readValue("{\"position\":{\"x\":2}}");
    printJson(t);
    assertEquals(2.0, t.getPosition().getX(), 0.01);

    VREvent e = new VREvent(t, new Client());
    e.addChange("position", new Point(1, 0, 0));
    printJson(e);

    dispatcher.dispatch(e);

    printJson(t);
    assertEquals(1.0, t.getPosition().getX(), 0.01);
  }

  @Test
  public void testPayload() throws Exception {
    VRObject t = new VRObject(1L, 1, 2, 3);
    printJson(t);
    VREvent e = new VREvent(t, new Client());
    e.setPayload("{{}{\"position\":{\"x\":2,\"y\":1}}}");
    e.addChange("x", 2);
    dispatcher.dispatch(e);
    printJson(t);
    assertEquals(2.0, t.getPosition().getX(), 0.01);
    assertEquals(1.0, t.getPosition().getY(), 0.01);
    // CHECKME: do we need to merge member objects?
    // assertEquals(3.0, t.getZ(), 0.01);
  }

  @Test
  public void testEmptyChanges() throws Exception {
    VREvent e = new VREvent();
    assertThrows(IllegalArgumentException.class, () -> dispatcher.dispatch(e));
  }

  @Test
  public void testChangeId() throws Exception {
    VREvent e = new VREvent();
    e.addChange("id", 101);
    assertThrows(IllegalArgumentException.class, () -> dispatcher.dispatch(e));
  }

  @Test
  public void testUnknownField() throws Exception {
    VREvent e = new VREvent(new VRObject(), new Client());
    e.addChange("unknown", 0);
    // we actually allow for sending arbitrary events
    // assertThrows(UnrecognizedPropertyException.class, () ->
    // dispatcher.dispatch(e));
  }

  @Test
  public void testInvalidValueFormat() throws Exception {
    VREvent e = new VREvent(new VRObject(), new Client());
    e.addChange("position", "y");
    assertThrows(MismatchedInputException.class, () -> dispatcher.dispatch(e));
  }

  @Test()
  public void testInvalidValue() throws Exception {
    VREvent e = new VREvent(new VRObject(), new Client());
    e.addChange("permanent", "x");
    assertThrows(InvalidFormatException.class, () -> dispatcher.dispatch(e));
  }

  @Test
  public void testPrivate() throws Exception {
    Client c = new Client();
    c.setName("client 1");
    c.setSceneProperties(new SceneProperties());
    c.getSceneProperties().setRange(200);
    printJson(c);

    c.addListener(listener);

    // request change of name and scene range
    String payload = "{\"object\":{\"Client\":1},\"changes\":{\"name\":\"client 2\",\"sceneProperties\":{\"range\":100}}}";
    System.err.println(payload);
    ClientRequest req = mapper.readValue(payload, ClientRequest.class);
    req.setSource(c);
    req.setClient(c);

    dispatcher.dispatch(req);
    printJson(c);

    // verify values are changed
    assertEquals(100, c.getSceneProperties().getRange(), 0.01);
    assertEquals("client 2", c.getName());

    // verify listeners are notified
    verify(listener, times(1)).processEvent(any(VREvent.class));

    // request only scene range change
    payload = "{\"object\":{\"Client\":1},\"changes\":{\"sceneProperties\":{\"range\":300}}}";
    System.err.println(payload);
    req = mapper.readValue(payload, ClientRequest.class);
    req.setSource(c);
    req.setClient(c);

    dispatcher.dispatch(req);
    printJson(c);

    // verify value changed
    assertEquals(300, c.getSceneProperties().getRange(), 0.01);
    assertEquals("client 2", c.getName());

    // verify listeners were not notified
    verify(listener, times(1)).processEvent(any(VREvent.class));
  }

  @Test
  public void testOwnedClass() throws Exception {
    Client c1 = new Client(1L);
    Client c2 = new Client(2L);
    // one client can't change properties of other client
    String payload = "{\"object\":{\"Client\":2},\"changes\":{\"name\":\"client 2\"}}";
    printJson(c2);
    System.err.println(payload);
    ClientRequest req = mapper.readValue(payload, ClientRequest.class);
    req.setSource(c2);
    req.setClient(c1);

    assertThrows(SecurityException.class, () -> dispatcher.dispatch(req));
  }

  @Test
  public void testOwnedField() throws Exception {
    // dispatcher can't work with anonymous classes but will throw security
    // exception before deserialization attempt
    VRObject obj = new VRObject(2L) {
      @Owned
      private String something;
    };
    Client c = new Client(1L);
    String payload = "{\"object\":{\"VRObject\":2},\"changes\":{\"something\":\"else\"}}";
    printJson(c);
    System.err.println(payload);

    ClientRequest req = mapper.readValue(payload, ClientRequest.class);
    req.setSource(obj);
    req.setClient(c);

    assertThrows(SecurityException.class, () -> dispatcher.dispatch(req));
  }

  private void printJson(Object whatever) throws Exception {
    System.err.println(mapper.writeValueAsString(whatever));
  }

}
