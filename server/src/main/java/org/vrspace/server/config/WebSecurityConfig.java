package org.vrspace.server.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.vrspace.server.api.Oauth2Controller;

/**
 * Configures Oauth2 authentication endpoints
 * 
 * @author joe
 *
 */
@Configuration
@ConditionalOnProperty("org.vrspace.oauth2.enabled")
@EnableWebSecurity
public class WebSecurityConfig {
  // as the matter of fact, we do have dependency on the controller due to path
  // might as well make it explicit
  public static final String ENDPOINT = Oauth2Controller.PATH;

  @Bean
  SecurityFilterChain filterChain(HttpSecurity httpSecurity) throws Exception {
    return httpSecurity.csrf(csrf -> csrf.disable())
        .authorizeRequests(requests -> requests.antMatchers(ENDPOINT + "/login**").authenticated())
        .oauth2Login(login -> login.loginPage(ENDPOINT + "/provider").authorizationEndpoint()
            .baseUri(ENDPOINT + "/authorization"))
        .build();
  }
}
