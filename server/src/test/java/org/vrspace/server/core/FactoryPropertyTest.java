package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;
import org.vrspace.server.config.FactoryConfig;

/**
 * Replace Client factory by changing a property
 * 
 * @author joe
 *
 */
@SpringBootTest(properties = {
    "org.vrspace.server.clientFactory:org.vrspace.server.core.FactoryPropertyTest$TestClientFactory" }, classes = FactoryConfig.class)
@RunWith(SpringRunner.class)
public class FactoryPropertyTest {
  @Autowired
  ClientFactory clientFactory;

  @Test
  public void testSomething() {
    assertEquals(TestClientFactory.class, clientFactory.getClass());
  }

  // inner class has to be static, otherwise can't be instantiated elsewhere
  public static class TestClientFactory implements ClientFactory {
  }

}
