package org.vrspace.server.api;

import java.util.Map;

import javax.servlet.http.HttpSession;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.VRObject;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;

@RestController
@RequestMapping(MetakraftController.PATH)
@Slf4j
public class MetakraftController extends ApiBase {
  public static final String PATH = API_ROOT + "/metakraft";

  @Value("${metakraft.key}")
  private String metakraftKey;
  @Value("${metakraft.quality:normal}")
  private String quality;

  @Data
  public static class MetakraftModelInfo {
    private String glbUrl;
    private String image;
    private String id;
  }

  @Data
  public static class MetakraftResponse {
    private boolean success;
    private MetakraftModelInfo data;
  }

  @PostMapping("/generate")
  public MetakraftModelInfo generate(HttpSession session, Double x, Double y, Double z, String prompt) {
    // get user info first (session etc)
    Client client = findClient(session);

    MultiValueMap<String, String> map = new LinkedMultiValueMap<String, String>();
    map.add("prompt", prompt);
    map.add("quality", quality);
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
    headers.set("x-api-key", metakraftKey);
    HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<MultiValueMap<String, String>>(map, headers);

    RestTemplate restTemplate = new RestTemplate();
    ResponseEntity<MetakraftResponse> response = restTemplate
        .postForEntity("https://api.metakraft.ai/v1/3d-model-gen/generate", request, MetakraftResponse.class);
    log.debug("Response: " + response);

    // we get answer like
    // {"success":true,
    // "data":{
    // "glbUrl":"https://spark3d-images.s3.us-east-1.amazonaws.com/3d-models/glb/8f7a9f25-5754-43b7-a398-9e5dab475c29-tmp2xrix4xu.glb",
    // "image":"https://spark3d-images.s3.us-east-1.amazonaws.com/images/65e13ee7-00f2-4e55-be17-45423365b47b-image.png",
    // "id":"66a77f449f2c79348b8f149f"}
    // }

    MetakraftModelInfo modelInfo = response.getBody().getData();

    VRObject obj = new VRObject();
    obj.setMesh(modelInfo.getGlbUrl());
    obj.setActive(true);
    obj.setProperties(Map.of("clientId", client.getId(), "metakraftId", modelInfo.getId()));
    if (x != null & y != null & z != null) {
      Point pos = new Point(x, y, z);
      obj.setPosition(pos);
    }

    worldManager.add(client, obj);
    client.getScene().publish(obj); // so that it gets displayed right away

    return modelInfo;
  }

  public void refine() {
  }

  public void style() {
  }

  public void isRiggable() {
  }

  public void rig() {
  }

  public void animate() {
  }
}
