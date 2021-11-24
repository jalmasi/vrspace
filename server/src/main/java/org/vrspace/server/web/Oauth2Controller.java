package org.vrspace.server.web;

import javax.servlet.http.HttpServletRequest;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.extern.slf4j.Slf4j;

@RestController
@Slf4j
@RequestMapping("/oauth2")
public class Oauth2Controller {
  @GetMapping("/login")
  public void login(HttpServletRequest req) {
    // if this passes, client is already logged in
    log.debug("oauth login:" + req);
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

    log.debug("blah:" + authentication);
  }

  @GetMapping("/callback")
  public void callback(String code, String state, HttpServletRequest request) {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

    OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
    log.debug("oauth callback: code=" + code + " " + oauthToken);
  }
}
