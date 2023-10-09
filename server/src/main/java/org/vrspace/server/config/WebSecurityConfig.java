package org.vrspace.server.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.vrspace.server.api.Oauth2Controller;

/**
 * Configures Oauth2 authentication endpoints
 * 
 * @author joe
 *
 */
@Configuration
@EnableWebSecurity
public class WebSecurityConfig extends WebSecurityConfigurerAdapter {
  // as the matter of fact, we do have dependency on the controller due to path
  // might as well make it explicit
  public static final String ENDPOINT = Oauth2Controller.PATH;

  @Override
  protected void configure(HttpSecurity httpSecurity) throws Exception {
    httpSecurity.csrf().disable().authorizeRequests().antMatchers(ENDPOINT + "/login**").authenticated().and()
        .oauth2Login().loginPage(ENDPOINT + "/provider").authorizationEndpoint().baseUri(ENDPOINT + "/authorization");
  }

}
