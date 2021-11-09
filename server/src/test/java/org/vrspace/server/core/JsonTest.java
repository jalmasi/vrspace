package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.vrspace.server.config.JacksonConfig;
import org.vrspace.server.dto.Add;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.Echo;
import org.vrspace.server.dto.Remove;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest(classes = JacksonConfig.class)
public class JsonTest {

  @Autowired
  private ObjectMapper mapper;

  @Test
  public void testObject() throws Exception {
    VRObject t = new VRObject(1L);
    t.addChildren(new VRObject(2L), new VRObject(3L));
    testConversion(t);
  }

  @Test
  public void testTemporary() throws Exception {
    VRObject o = new VRObject(1L);
    VRObject ret = testConversion(o);

    assertNull(ret.getTemporary());
    assertFalse(ret.isTemporary());

    o.setTemporary(false);
    ret = testConversion(o);

    assertNotNull(ret.getTemporary());
    assertFalse(ret.isTemporary());

    o.setTemporary(true);
    ret = testConversion(o);

    assertNotNull(ret.getTemporary());
    assertTrue(ret.isTemporary());
  }

  @Test
  public void testPosition() throws Exception {
    VRObject o = new VRObject(1L, 1, 2, 3, new VRObject(2L, 3, 2, 1), new VRObject(3L));
    testConversion(o);
  }

  @Test
  public void testClient() throws Exception {
    Client c = new Client();
    c.setSceneProperties(new SceneProperties());
    c.setName("client");
    testConversion(c);
  }

  @Test
  public void testClientProperties() throws Exception {
    Client c = new Client();
    c.setSceneProperties(new SceneProperties());
    c.setName("client");
    Map<String, Object> properties = new HashMap<>();
    properties.put("string", "string");
    properties.put("long", 1L);
    properties.put("float", 1.2);
    c.setProperties(properties);
    testConversion(c);
  }

  @Test
  public void testAdd() throws Exception {
    Add add = new Add(new VRObject(1L, new VRObject(2L)), new VRObject(3L, new VRObject(4L)));
    testConversion(add);
  }

  @Test
  public void testRemove() throws Exception {
    Remove rm = new Remove(new ID("VRObject", 1L), new ID("VRObject", 2L), new ID("Client", 1L));
    testConversion(rm);
  }

  @Test
  public void testAddClient() throws Exception {
    Add add = new Add(new Client());
    testConversion(add);
  }

  @Test
  public void testDeserializeEvent() throws Exception {
    String string = "{\"object\":{\"Client\":1},\"changes\":{\"position\":{\"org.vrspace.server.Point\":{\"x\":3.0,\"y\":2.0,\"z\":1.0}}}}";

    println(string);
    VREvent e1 = mapper.readValue(string, VREvent.class);
    println(e1);
  }

  @Test
  public void testClientRequest() throws Exception {
    ClientRequest req = new ClientRequest();
    req.setCommand(new Add(new VRObject()));
    testConversion(req);
    VREvent ev = new ClientRequest(new VRObject(1L));
    ev.addChange("field1", "value1");
    ev.addChange("field2", 5);
    testConversion(ev, false); // source is not set during deserialization
  }

  @Test
  public void testEvent() throws Exception {
    VREvent ev = new VREvent(new VRObject(1L));
    ev.addChange("field1", "value1");
    ev.addChange("field2", 5);
    ev.addChange("field1", "value2");
    ev.addChange("field3", new VRObject(2L));
    Map<String, Object> map = new HashMap<String, Object>();
    map.put("one", 1);
    map.put("two", "two");
    ev.addChange("field4", map);
    // CHECKME: how do we transfer objects then?
    testConversion(ev, false);
  }

  @Test
  public void testWelcome() throws Exception {
    Welcome welcome = new Welcome(new Client(), new VRObject(1L), new VRObject(2L));
    testConversion(welcome);
  }

  @Test
  public void testEchoCommand() throws Exception {
    Echo echo = new Echo(new Remove(new ID("VRObject", 1L), new ID("VRObject", 2L), new ID("Client", 1L)));
    testConversion(echo);
  }

  @Test
  public void testEchoEvent() throws Exception {
    VREvent ev = new VREvent(new VRObject(1L));
    ev.addChange("field1", "value1");
    ev.addChange("field2", 5);
    ev.addChange("field1", "value2");
    ev.addChange("field3", new VRObject(2L));
    Map<String, Object> map = new HashMap<String, Object>();
    map.put("one", 1);
    map.put("two", "two");
    ev.addChange("field4", map);
    Echo echo = new Echo(ev);
    // event.equals() workaround:
    testConversion(echo, false);
  }

  private void println(Object whatever) {
    System.err.println(whatever);
  }

  private <T> T testConversion(T obj) throws Exception {
    return testConversion(obj, true);
  }

  private <T> T testConversion(T obj, boolean resultEquals) throws Exception {
    String json = mapper.writeValueAsString(obj);
    println(json);
    @SuppressWarnings("unchecked")
    T res = (T) mapper.readValue(json, obj.getClass());
    String jsonRes = mapper.writeValueAsString(res);
    println(jsonRes);

    assertEquals(json, jsonRes);
    if (resultEquals) {
      assertEquals(obj, res);
    }
    return res;
  }

}
