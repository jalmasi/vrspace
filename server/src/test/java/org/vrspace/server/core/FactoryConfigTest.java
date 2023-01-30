package org.vrspace.server.core;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.vrspace.server.config.FactoryConfig;

/**
 * Replace factory configuration by defining a Primary bean that returns the
 * same type
 * 
 * @author joe
 *
 */
@SpringBootTest
@Disabled("CHECKME - runs only if started alone")
public class FactoryConfigTest {
  @Autowired
  ClientFactory clientFactory;

  @Test
  public void testSomething() {
    assertEquals(TestClientFactory.class, clientFactory.getClass());
  }

  public static class TestClientFactory extends DefaultClientFactory {
  }

  @Import({ FactoryConfig.class })
  @TestConfiguration
  public static class FactoryTestConfiguration {
    @Bean
    @Primary
    public ClientFactory clientFactoryReplacement() {
      return new TestClientFactory();
    }
  }
}
