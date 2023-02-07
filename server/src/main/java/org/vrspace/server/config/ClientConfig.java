package org.vrspace.server.config;

import java.net.URI;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.vrspace.client.VRSpaceClient;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Configuration
@Slf4j
public class ClientConfig {
  @Autowired
  ObjectMapper objectMapper;
  @Autowired
  ServerConfig serverConfig;

  @Bean
  public VRSpaceClient connectToVRSpace() {
    URI uri = URI.create("wss://www.vrspace.org/vrspace/server");
    VRSpaceClient client = new VRSpaceClient(uri, objectMapper);
    client.connectAndEnter("galaxy", Map.of("url", serverConfig.getServerUrl(), "thumbnail",
        serverConfig.getServerThumbnail(), "description", serverConfig.getServerDescripton()));
    return client;
  }

}
