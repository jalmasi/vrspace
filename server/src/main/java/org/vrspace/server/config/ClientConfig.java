package org.vrspace.server.config;

import java.net.URI;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.vrspace.client.VRSpaceClient;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * This configures VRSpace client that connects to and advertises at central
 * vrspace.org server - if org.vrspace.server.advertise property is true.
 */
@Configuration
@ConditionalOnProperty(name = "org.vrspace.server.advertise", havingValue = "true")
public class ClientConfig {
  @Autowired
  ObjectMapper objectMapper;
  @Autowired
  ServerConfig serverConfig;

  @Bean
  VRSpaceClient connectToVRSpace() {
    URI uri = URI.create("wss://www.vrspace.org/vrspace/server");
    VRSpaceClient client = new VRSpaceClient(uri, objectMapper);
    client.connectAndEnter("galaxy", Map.of("url", serverConfig.getServerUrl(), "thumbnail",
        serverConfig.getServerThumbnail(), "description", serverConfig.getServerDescripton()));
    return client;
  }

}
