package org.vrspace.server;

import java.util.HashMap;
import java.util.Map;

import org.junit.Assert;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.test.context.junit4.SpringRunner;
import org.vrspace.server.dto.Add;
import org.vrspace.server.dto.ClientRequest;
import org.vrspace.server.dto.Echo;
import org.vrspace.server.dto.Remove;
import org.vrspace.server.dto.SceneProperties;
import org.vrspace.server.dto.VREvent;
import org.vrspace.server.dto.Welcome;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.VRObject;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

@RunWith(SpringRunner.class)
public class JsonTest {

  private ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule())
      .configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);

  @Test
  public void testObject() throws Exception {
    VRObject t = new VRObject(1L);
    t.addChildren(new VRObject(2L), new VRObject(3L));
    testConversion(t);
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
    testConversion(ev);
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

  private void testConversion(Object obj) throws Exception {
    testConversion(obj, true);
  }

  private void testConversion(Object obj, boolean resultEquals) throws Exception {
    String json = mapper.writeValueAsString(obj);
    println(json);
    Object res = mapper.readValue(json, obj.getClass());
    String jsonRes = mapper.writeValueAsString(res);
    println(jsonRes);

    Assert.assertEquals(json, jsonRes);
    if (resultEquals) {
      Assert.assertEquals(obj, res);
    }
  }

}
