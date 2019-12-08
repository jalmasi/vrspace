package org.vrspace.server;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.Assert;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.Mock;
import org.springframework.test.context.junit4.SpringRunner;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.VRObject;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectReader;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;

@RunWith(SpringRunner.class)
public class DispatcherTest {
  private ObjectMapper mapper = new ObjectMapper();

  @Mock
  Client listener;

  Dispatcher dispatcher = new Dispatcher();

  @Test
  public void testMergeChanges() throws Exception {
    VRObject t = new VRObject(1L);
    t.setPosition(new Point(1, 0, 0));
    // t.setX(1);
    printJson(t);

    ObjectReader reader = mapper.readerForUpdating(t);
    reader.readValue("{\"position\":{\"x\":2}}");
    printJson(t);
    Assert.assertEquals(2.0, t.getPosition().getX(), 0.01);

    VREvent e = new VREvent(t, new Client());
    e.addChange("position", new Point(1, 0, 0));
    printJson(e);

    dispatcher.dispatch(e);

    printJson(t);
    Assert.assertEquals(1.0, t.getPosition().getX(), 0.01);
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
    Assert.assertEquals(2.0, t.getPosition().getX(), 0.01);
    Assert.assertEquals(1.0, t.getPosition().getY(), 0.01);
    // CHECKME: do we need to merge member objects?
    // Assert.assertEquals(3.0, t.getZ(), 0.01);
  }

  @Test(expected = IllegalArgumentException.class)
  public void testEmptyChanges() throws Exception {
    VREvent e = new VREvent();
    dispatcher.dispatch(e);
  }

  @Test(expected = IllegalArgumentException.class)
  public void testChangeId() throws Exception {
    VREvent e = new VREvent();
    e.addChange("id", 101);
    dispatcher.dispatch(e);
  }

  @Test(expected = UnrecognizedPropertyException.class)
  public void testUnknownField() throws Exception {
    VREvent e = new VREvent(new VRObject(), new Client());
    e.addChange("unknown", 0);
    dispatcher.dispatch(e);
  }

  @Test(expected = MismatchedInputException.class)
  public void testInvalidValueFormat() throws Exception {
    VREvent e = new VREvent(new VRObject(), new Client());
    e.addChange("position", "y");
    dispatcher.dispatch(e);
  }

  @Test(expected = InvalidFormatException.class)
  public void testInvalidValue() throws Exception {
    VREvent e = new VREvent(new VRObject(), new Client());
    e.addChange("permanent", "x");
    dispatcher.dispatch(e);
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
    Assert.assertEquals(100, c.getSceneProperties().getRange(), 0.01);
    Assert.assertEquals("client 2", c.getName());

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
    Assert.assertEquals(300, c.getSceneProperties().getRange(), 0.01);
    Assert.assertEquals("client 2", c.getName());

    // verify listeners were not notified
    verify(listener, times(1)).processEvent(any(VREvent.class));
  }

  @Test(expected = SecurityException.class)
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

    dispatcher.dispatch(req);
  }

  @Test(expected = SecurityException.class)
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

    dispatcher.dispatch(req);
  }

  private void printJson(Object whatever) throws Exception {
    System.err.println(mapper.writeValueAsString(whatever));
  }

}
