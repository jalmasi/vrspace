package org.vrspace.server.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.vrspace.server.api.Oauth2Login;

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
  public static final String ENDPOINT = Oauth2Login.PATH;

  // CHECKME/TODO: missing Oauth2 refresh?
  // https://stackoverflow.com/questions/68899669/how-to-perform-a-refresh-with-spring-boot-starter-oauth2-client
  @Bean
  SecurityFilterChain filterChain(HttpSecurity httpSecurity) throws Exception {
    httpSecurity.csrf(csrf -> csrf.disable());

    httpSecurity.authorizeHttpRequests(requests -> requests.requestMatchers(ENDPOINT + "/login**").authenticated());
    httpSecurity.oauth2Login(login -> {
      login.loginPage(ENDPOINT + "/provider");
      login.authorizationEndpoint(config -> config.baseUri(ENDPOINT + "/authorization"));
    });
    httpSecurity.authorizeHttpRequests(requests -> requests.requestMatchers("/**").permitAll());

    return httpSecurity.build();
  }
}
