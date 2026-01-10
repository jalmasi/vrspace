package org.vrspace.server.api;

import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.apache.commons.io.IOUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.vrspace.server.connect.SketchfabConnector;
import org.vrspace.server.connect.sketchfab.AuthResponse;
import org.vrspace.server.connect.sketchfab.DownloadResponse;
import org.vrspace.server.connect.sketchfab.FileInfo;
import org.vrspace.server.connect.sketchfab.ModelSearchRequest;
import org.vrspace.server.connect.sketchfab.ModelSearchResponse;
import org.vrspace.server.core.ClassUtil;
import org.vrspace.server.core.FileUtil;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.GltfModel;

import com.fasterxml.jackson.core.JacksonException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * You want to download free content from sketchfab, you have to be OAuth2
 * authorized with them. Once done, the server uses the same credentials for all
 * further communication with sketchfab, until restart. This is completely
 * different than Oauth2 used to authenticate with vrspace server, i.e. this is
 * how vrspace server authenticates with sketchfab. Credentials are kept in
 * memory only, but the content is cached locally, under content directory
 * hierarchy, where sketchfab content categories are used for subdirectory name.
 * Content metadata is stored in the database, as GltfModel entities.
 * 
 * @author joe
 *
 */
@RestController
@RequestMapping(Sketchfab.PATH)
@Slf4j
public class Sketchfab extends ApiBase {
  public static final String PATH = API_ROOT + "/sketchfab";
  @Autowired
  private ObjectMapper objectMapper;
  @Autowired
  private VRObjectRepository db;
  @Autowired
  private SketchfabConnector connector;

  @Value("${sketchfab.clientId:none}")
  private String clientId;
  @Value("${sketchfab.clientSecret:none}")
  private String clientSecret;
  @Value("${sketchfab.redirectUri:none}")
  private String redirectUri;

  private String token;
  private String referrer;

  @Data
  @NoArgsConstructor
  @AllArgsConstructor
  public static class LoginResponse {
    String url;
  }

  @GetMapping("/available")
  public boolean isAvailable() {
    return !"none".equals(clientId) && !"none".equals(clientSecret) && !"none".equals(redirectUri);
  }

  /**
   * Start of the login sequence. Returns the sketchfab login url, containing
   * client id and redirect url. Client is then expected to open that url and
   * authorise there. Saves the referrer for later use in callback.
   */
  @GetMapping("/login")
  public LoginResponse sketchfabLogin(HttpServletRequest request) {
    this.referrer = request.getHeader(HttpHeaders.REFERER);
    // CHECKME: return entire url or better structured response?
    LoginResponse ret = new LoginResponse(
        "https://sketchfab.com/oauth2/authorize/?response_type=code&client_id=" + clientId + "&redirect_uri=" + redirectUri);
    return ret;
  }

  /**
   * Sketchfab oauth2 callback, as explained in
   * https://sketchfab.com/developers/oauth#implement-auth-code Uses code provided
   * by client to authorise at sketchfab, and returns 302 redirect to the saved
   * referrer.
   * 
   * @param code provided to the client by sketchfab
   * @return
   */
  @GetMapping("/oauth2")
  public ResponseEntity<String> sketchfabCallback(String code) {
    log.info("Login code " + code);

    MultiValueMap<String, String> map = new LinkedMultiValueMap<String, String>();
    map.add("grant_type", "authorization_code");
    map.add("code", code);
    map.add("client_id", clientId);
    map.add("client_secret", clientSecret);
    map.add("redirect_uri", redirectUri);

    HttpEntity<MultiValueMap<String, String>> request = authRequest(map);

    RestTemplate restTemplate = new RestTemplate();
    // TODO handle thrown exceptions - 401 unauthorised
    ResponseEntity<AuthResponse> response = restTemplate.postForEntity(connector.loginUrl, request, AuthResponse.class);
    log.debug("Login response: " + response);

    AuthResponse auth = response.getBody();
    if (auth.getExpires_in() < 7 * 24 * 60 * 60) {
      // renew if it expires in X days
      auth = refresh(auth.getRefresh_token());
    }

    // and now we have token to make calls
    // and now what? :)
    this.token = auth.getAccess_token();
    return ResponseEntity.status(HttpStatus.FOUND).header("Location", referrer).body("Redirecting to " + referrer);
  }

  private HttpEntity<MultiValueMap<String, String>> authRequest(MultiValueMap<String, String> fields) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
    HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<MultiValueMap<String, String>>(fields, headers);
    return request;
  }

  private AuthResponse refresh(String refreshToken) {
    MultiValueMap<String, String> map = new LinkedMultiValueMap<String, String>();
    map.add("grant_type", "refresh_token");
    map.add("client_id", clientId);
    map.add("client_secret", clientSecret);
    map.add("refresh_token", refreshToken);

    RestTemplate restTemplate = new RestTemplate();
    ResponseEntity<AuthResponse> response = restTemplate.postForEntity(connector.loginUrl, authRequest(map),
        AuthResponse.class);
    log.debug("Refresh response: " + response);
    return response.getBody();
  }

  /**
   * Search free models available at Sketchfab. Search request and response
   * contain the same data as when querying Sketchfab directly, though with the
   * different request method (POST vs GET). But, this one allows the server to
   * get model information.
   * 
   * @param params search criteria, recommended minimum is q (query string)
   * @return structured list of models matching the criteria
   */
  @PostMapping("/search")
  public ResponseEntity<ModelSearchResponse> searchModels(@RequestBody ModelSearchRequest params) {
    try {
      ModelSearchResponse ret = connector.searchModels(params);
      return ResponseEntity.ofNullable(ret);
    } catch (JacksonException e) {
      log.error("Internal error", e);
      return new ResponseEntity<ModelSearchResponse>(HttpStatus.INTERNAL_SERVER_ERROR);
    } catch (IOException e) {
      log.error("Connection error", e);
      return new ResponseEntity<ModelSearchResponse>(HttpStatus.BAD_GATEWAY);
    } catch (InterruptedException e) {
      log.error("Connection timeout", e);
      return new ResponseEntity<ModelSearchResponse>(HttpStatus.GATEWAY_TIMEOUT);
    } catch (Exception e) {
      log.error("Internal error", e);
      return new ResponseEntity<ModelSearchResponse>(HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Sketchfab download, as explained in
   * https://sketchfab.com/developers/download-api/downloading-models Requires
   * successful authentication, returns 401 unauthorised unless the server is
   * authorised with sketchfab (token exists). In that case, client is expected to
   * attempt to login.
   * 
   * @param uid     unique id of the model
   * @param request original request, referrer is saved for later use in case the
   *                authentication fails
   * @return
   */
  @GetMapping("/download")
  public ResponseEntity<GltfModel> download(String uid, HttpServletRequest request) {
    // if not authorized ( null token ) authorize first
    if (this.token == null) {
      this.referrer = request.getHeader(HttpHeaders.REFERER);
      return new ResponseEntity<GltfModel>(HttpStatus.UNAUTHORIZED);
    }

    Optional<GltfModel> existing = db.findGltfModelByUid(uid);
    if (existing.isPresent()) {
      GltfModel model = existing.get();
      File modelFile = new File(
          ClassUtil.projectHomeDirectory() + "/content/" + model.mainCategory() + "/" + model.getFileName());
      if (modelFile.exists()) {
        log.debug("Model directory already exists, skipping download: " + modelFile);
        return new ResponseEntity<GltfModel>(model, HttpStatus.OK);
      } else {
        log.debug("Model directory does not exist, downloading");
      }
    }

    // download request call
    String url = "https://api.sketchfab.com/v3/models/" + uid + "/download";
    RestTemplate restTemplate = new RestTemplate();
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(token);
    HttpEntity<DownloadResponse> entity = new HttpEntity<DownloadResponse>(headers);
    ResponseEntity<DownloadResponse> response = restTemplate.exchange(url, HttpMethod.GET, entity, DownloadResponse.class);
    log.debug("Download response: " + response);
    FileInfo gltf = response.getBody().getGltf();

    try {
      GltfModel model;
      // get metadata if not already present - categories and stuff
      if (existing.isPresent()) {
        // model.setId(existing.get().getId());
        // log.warn("Overriding existing model data " + model.getId());
        model = existing.get();
      } else {
        model = modelInfo(uid);
      }
      String category = model.mainCategory();

      // source file name
      URL fileUrl = new URL(gltf.getUrl());
      String fileName = fileUrl.getPath();
      fileName = fileName.substring(fileName.lastIndexOf("/") + 1); // includes .zip
      String modelName = fileName.substring(0, fileName.lastIndexOf(".")); // without .zip
      // model name still can contain dot, but directory can not
      // CHECKME: what else we need to clear out?
      modelName = modelName.replaceAll("\\.", "");
      // destination directory
      // TODO sanitize directory and file name
      File modelDir = new File(FileUtil.contentDir() + "/" + category + "/" + modelName);
      if (modelDir.exists()) {
        log.warn("Destination directory already exists, download skipped: " + modelDir);
      } else {
        // download
        log.info("Downloading " + gltf.getUrl() + " size " + gltf.getSize());
        File file = new File(FileUtil.downloadDir(), fileName);
        IOUtils.copy(fileUrl, file);
        log.info("Downloaded to " + file.getCanonicalPath());
        // unzip to content directory
        Path dest = FileUtil.unzip(file, modelDir);
        log.info("Unzipped to " + dest);
      }
      // store to the database
      model.setFileName(modelDir.getName());
      model.setMesh("/content/" + model.mainCategory() + "/" + model.getFileName() + "/scene.gltf");
      db.save(model);
      log.info("Stored " + model);
      return new ResponseEntity<GltfModel>(model, HttpStatus.OK);
    } catch (Exception e) {
      throw new RuntimeException("Error downloading " + gltf.getUrl(), e);
    }
  }

  // this is called ONLY when GltfFile does not exist before download
  private GltfModel modelInfo(String uid) throws JsonMappingException, JsonProcessingException {
    GltfModel ret = new GltfModel();

    RestTemplate restTemplate = new RestTemplate();
    String url = "https://api.sketchfab.com/v3/models/" + uid;
    String json = restTemplate.getForEntity(url, String.class).getBody();
    log.debug("Model info: " + json);

    Map<?, ?> info = objectMapper.readValue(json, Map.class);
    ret.setUid((String) info.get("uid"));
    ret.setUri((String) info.get("uri"));
    ret.setName((String) info.get("name"));
    ret.setDescription((String) info.get("description"));
    ret.setLicense((String) ((Map<?, ?>) info.get("license")).get("slug"));
    ret.setAuthor((String) ((Map<?, ?>) info.get("user")).get("displayName"));
    @SuppressWarnings("unchecked")
    List<Map<String, String>> categories = (List<Map<String, String>>) info.get("categories");
    for (Map<?, ?> category : categories) {
      log.debug("Category: " + category.get("slug") + " " + category.get("name"));
      String catName = (String) category.get("slug");
      ret.getCategories().add(connector.updateCategory(catName));
    }

    return ret;
  }

}
