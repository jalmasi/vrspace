package org.vrspace.server.config;

import java.security.Security;

import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.PushService;

@ConditionalOnProperty("webpush.privateKey")
@Configuration
@Slf4j
public class WebPushConfig {
  @Value("${webpush.privateKey}")
  private String privateKey;
  @Value("${webpush.publicKey}")
  private String publicKey;
  @Value("${webpush.subject}")
  private String subject;

  @Bean
  PushService pushService() {
    try {
      // Add BouncyCastle as an algorithm provider
      if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
        Security.addProvider(new BouncyCastleProvider());
      }

      PushService pushService = new PushService();
      pushService.setPublicKey(publicKey);
      pushService.setPrivateKey(privateKey);
      pushService.setSubject(subject);
      return pushService;
    } catch (Exception e) {
      log.error("Can't configure push service", e);
      return null;
    }
  }
}
