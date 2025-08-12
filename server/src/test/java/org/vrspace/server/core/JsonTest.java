package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
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
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.RemoteServer;
import org.vrspace.server.obj.Terrain;
import org.vrspace.server.obj.TerrainPoint;
import org.vrspace.server.obj.VRObject;
import org.vrspace.server.types.ID;

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest(classes = JacksonConfig.class)
public class JsonTest {

  @Autowired
  @Qualifier("objectMapper")
  private ObjectMapper mapper;
  @Autowired
  @Qualifier("privateMapper")
  private ObjectMapper privateMapper;

  @Test
  public void testObject() throws Exception {
    VRObject t = new VRObject("1");
    t.addChildren(new VRObject("2"), new VRObject("3"));
    testConversion(t);
  }

  @Test
  public void testTemporary() throws Exception {
    VRObject o = new VRObject("1");
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
    VRObject o = new VRObject("1", 1, 2, 3, new VRObject("2", 3, 2, 1), new VRObject("3"));
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
    Add add = new Add(new VRObject("1", new VRObject("2")), new VRObject("3", new VRObject("4")));
    testConversion(add);
  }

  @Test
  public void testRemove() throws Exception {
    Remove rm = new Remove(new ID("VRObject", "1"), new ID("VRObject", "2"), new ID("Client", "1"));
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
    VREvent ev = new ClientRequest(new VRObject("1"));
    ev.addChange("field1", "value1");
    ev.addChange("field2", 5);
    testConversion(ev, false, mapper); // source is not set during deserialization
  }

  @Test
  public void testEvent() throws Exception {
    VREvent ev = new VREvent(new VRObject("1"));
    ev.addChange("field1", "value1");
    ev.addChange("field2", 5);
    ev.addChange("field1", "value2");
    ev.addChange("field3", new VRObject("2"));
    Map<String, Object> map = new HashMap<String, Object>();
    map.put("one", 1);
    map.put("two", "two");
    ev.addChange("field4", map);
    // CHECKME: how do we transfer objects then?
    testConversion(ev, false, mapper);
  }

  @Test
  public void testWelcome() throws Exception {
    Welcome welcome = new Welcome(new Client(), new VRObject("1"), new VRObject("2"));
    testConversion(welcome);
  }

  @Test
  public void testEchoCommand() throws Exception {
    Echo echo = new Echo(new Remove(new ID("VRObject", "1"), new ID("VRObject", "2"), new ID("Client", "1")));
    testConversion(echo);
  }

  @Test
  public void testEchoEvent() throws Exception {
    VREvent ev = new VREvent(new VRObject("1"));
    ev.addChange("field1", "value1");
    ev.addChange("field2", 5);
    ev.addChange("field1", "value2");
    ev.addChange("field3", new VRObject("2"));
    Map<String, Object> map = new HashMap<String, Object>();
    map.put("one", 1);
    map.put("two", "two");
    ev.addChange("field4", map);
    Echo echo = new Echo(ev);
    // event.equals() workaround:
    testConversion(echo, false, mapper);
  }

  private void println(Object whatever) {
    System.err.println(whatever);
  }

  private <T> T testConversion(T obj) throws Exception {
    return testConversion(obj, true, mapper);
  }

  private <T> T testConversion(T obj, boolean resultEquals, ObjectMapper objectMapper) throws Exception {
    String json = objectMapper.writeValueAsString(obj);
    println(json);
    @SuppressWarnings("unchecked")
    T res = (T) objectMapper.readValue(json, obj.getClass());
    String jsonRes = objectMapper.writeValueAsString(res);
    println(jsonRes);

    assertEquals(json, jsonRes);
    if (resultEquals) {
      assertEquals(obj, res);
    }
    return res;
  }

  @Test
  public void testPrivateField() throws Exception {
    Client c = new Client();
    c.setToken("test", "secretToken");
    String json = mapper.writeValueAsString(c);
    System.err.println(json);
    assertFalse(json.contains("secretToken"));
  }

  @Test
  public void testTerrain() throws Exception {
    Terrain t = new Terrain();
    t.setActive(true);
    t.setPermanent(true);
    t.setId("1");
    /*
     * // can't do this any longer Terrain.TerrainChange change = new
     * Terrain.TerrainChange(); change.setIndex(100); change.setPoint(new Point(1,
     * 2, 3)); t.setChange(change); t.changed();
     */
    TerrainPoint point = new TerrainPoint(t, 1L, new Point(1, 2, 3));
    t.setPoints(Set.of(point));

    String json = mapper.writeValueAsString(t);
    System.err.println(json);
    assertTrue(json.contains("id\":\"1\""));
    assertTrue(json.contains("permanent"));
    assertTrue(json.contains("active"));
    assertTrue(json.contains("points"));
    assertTrue(json.contains("index"));

    HashSet<VRObject> p = new HashSet<>();
    p.add(t);
    Welcome w = new Welcome();
    w.setPermanents(p);
    String welcome = mapper.writeValueAsString(w);
    System.err.println(welcome);
    assertTrue(welcome.contains("Terrain"));
    assertTrue(welcome.contains("points"));

  }

  @Test
  @Disabled("Not readonly, WIP, CHECKME")
  public void testReadOnlyScript() throws Exception {
    RemoteServer server = new RemoteServer();
    server.setName("test");
    server.setUrl("https://some.url/");
    server.setScript("/portal.js");

    String json = mapper.writeValueAsString(server);
    println(json);
    RemoteServer result = mapper.readValue(json, RemoteServer.class);
    assertNull(result.getScript());
  }
}
