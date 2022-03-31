package org.vrspace.server.obj;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.data.annotation.Transient;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

/**
 * A proprietary bot. TODO remove
 * 
 * @author joe
 *
 */
@Slf4j
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(callSuper = true, onlyExplicitlyIncluded = true)
@Node
public class ArthurBot extends Bot {

  @JsonIgnore
  @Transient
  private RestTemplate restTemplate = new RestTemplate();

  @Data
  @NoArgsConstructor
  public static class Response {
    private String response;
  }

  @Override
  public void selfTest() throws Exception {
    ResponseEntity<String> result = sendQuery("hello world");
    if (result.getStatusCodeValue() == 200) {
      String response = result.getBody();
      log.debug(this + " initial response: " + response);
    } else {
      throw new IllegalStateException("Invalid response code: " + result.getStatusCodeValue());
    }
    List<String> contentType = result.getHeaders().get("Content-Type");
    if (contentType.size() == 0) {
      throw new IllegalStateException("Invalid response - no content type");
    }
    if (contentType.size() == 1) {
      String cType = contentType.get(0);
      log.debug("Response content type: " + cType);
      if (!"application/json".equals(cType)) {
        throw new IllegalStateException("Invalid response content type: " + contentType);
      }
    } else {
      throw new IllegalStateException("Invalid response content type - size " + contentType.size() + " " + contentType);
    }
    log.debug(getResponse(null, "hello again"));
  }

  @Override
  public String getResponse(Client c, String query) {
    String ret = "";
    try {
      ResponseEntity<String> result = sendQuery(query);
      Response response = getMapper().readValue(result.getBody(), Response.class);
      ret = response.getResponse();
    } catch (Exception e) {
      log.error("Can't get response to: " + query, e);
    }
    return ret;
  }

  private ResponseEntity<String> sendQuery(String what) throws Exception {
    log.debug(this + " request: " + what);
    String encoded = URLEncoder.encode(what, StandardCharsets.UTF_8.toString());
    URI uri = new URI(getUrl() + encoded);
    ResponseEntity<String> result = restTemplate.getForEntity(uri, String.class);
    log.debug(this + " response: " + result.getBody());
    return result;
  }

}
