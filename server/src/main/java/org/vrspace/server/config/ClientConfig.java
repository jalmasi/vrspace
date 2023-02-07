package org.vrspace.server.config;

import java.net.URI;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.vrspace.client.VRSpaceClient;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

//@Configuration
@Slf4j
public class ClientConfig {
  @Autowired
  ObjectMapper objectMapper;

  @Bean
  public VRSpaceClient connectToVRSpace() {
    URI uri = URI.create("wss://www.vrspace.org/vrspace");
    VRSpaceClient client = new VRSpaceClient(uri, objectMapper);
    client.connectAndEnter("galaxy");
    return client;
  }

}
