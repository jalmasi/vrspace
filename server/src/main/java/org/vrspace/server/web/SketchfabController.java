package org.vrspace.server.web;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.apache.commons.io.IOUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.vrspace.server.core.ClassUtil;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@RestController
@Slf4j
public class SketchfabController {
  @Autowired
  ObjectMapper objectMapper;

  // TODO: constants, properties
  private String loginUrl = "https://sketchfab.com/oauth2/token/";
  private String clientId = "u9ILgUMHeTRX77rbxPR6OYseVUQrYRD9CoIbNHbK";
  private String clientSecret = "5NyPA76cIHDAyU2BuKcVL2oT730QV3Kv6iHybeiHdkEeaRMH25MS9vofZT7XwFkysd1BGdhOJTCXikTtzzdYb7kqMJULwTQrzJC0F3hug1naQ4ivg7QcZSSPJHMfUfkn";
  private String redirectUri = "http://localhost:8080/callback";

  private String token = "QIEnWRz9vp3F5SPjpFTDs7u2lThAxp";

  // as explained in https://sketchfab.com/developers/oauth#implement-auth-code
  @GetMapping("/callback")
  public void login(String code) {
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
    ResponseEntity<AuthResponse> response = restTemplate.postForEntity(loginUrl, request, AuthResponse.class);
    log.debug("Login response: " + response);

    AuthResponse auth = response.getBody();
    if (auth.getExpires_in() < 7 * 24 * 60 * 60) {
      // renew if it expires in X days
      auth = refresh(auth.getRefresh_token());
    }

    // and now we have token to make calls
    // and now what? :)
    this.token = auth.getAccess_token();
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
    ResponseEntity<AuthResponse> response = restTemplate.postForEntity(loginUrl, authRequest(map), AuthResponse.class);
    log.debug("Refresh response: " + response);
    return response.getBody();
  }

  @Data
  @NoArgsConstructor
  public static class AuthResponse {
    private String access_token;
    private int expires_in;
    private String token_type;
    private String scope;
    private String refresh_token;
  }

  // as explained in
  // https://sketchfab.com/developers/download-api/downloading-models
  @GetMapping("/download")
  public void download(String uid) {
    // TODO: if not authorized ( null token ) authorize first

    String url = "https://api.sketchfab.com/v3/models/" + uid + "/download";
    RestTemplate restTemplate = new RestTemplate();
    HttpHeaders headers = new HttpHeaders();
    headers.setBearerAuth(token);
    HttpEntity<DownloadResponse> entity = new HttpEntity<DownloadResponse>(headers);
    ResponseEntity<DownloadResponse> response = restTemplate.exchange(url, HttpMethod.GET, entity,
        DownloadResponse.class);
    log.debug("Download response: " + response);
    FileInfo gltf = response.getBody().getGltf();
    log.info("Downloading " + gltf.getUrl() + " size " + gltf.getSize());

    try {
      // download
      URL fileUrl = new URL(gltf.getUrl());
      String fileName = fileUrl.getPath();
      fileName = fileName.substring(fileName.lastIndexOf("/") + 1);
      File file = new File(downloadDir(), fileName);
      IOUtils.copy(fileUrl, file);
      log.info("Downloaded to " + file.getCanonicalPath());

      // categories and stuff
      String category = modelInfo(uid).mainCategory();

      // unzip to content directory
      String dir = ClassUtil.projectHomeDirectory() + "/content/" + category;
      Path dest = unzip(file, new File(dir + "/" + fileName.substring(0, fileName.lastIndexOf("."))));
      log.info("Unzipped to " + dest);

      // TODO database
    } catch (Exception e) {
      log.error("Error downloading " + gltf.getUrl(), e);
    }
  }

  private File downloadDir() {
    File dir = new File(System.getProperty("user.home") + "/Downloads");
    if (!(dir.isDirectory() && dir.canWrite())) {
      dir = new File(System.getProperty("java.io.tmpdir"));
    }
    return dir;
  }

  public Path unzip(File file, File dir) throws IOException {
    Path targetDir = dir.toPath().toAbsolutePath();
    try (ZipInputStream zipIn = new ZipInputStream(new FileInputStream(file))) {
      for (ZipEntry entry; (entry = zipIn.getNextEntry()) != null;) {
        Path resolvedPath = targetDir.resolve(entry.getName()).normalize();
        if (!resolvedPath.startsWith(targetDir)) {
          // see: https://snyk.io/research/zip-slip-vulnerability
          throw new RuntimeException("Entry with an illegal path: " + entry.getName());
        }
        if (entry.isDirectory()) {
          Files.createDirectories(resolvedPath);
        } else {
          Files.createDirectories(resolvedPath.getParent());
          Files.copy(zipIn, resolvedPath);
        }
      }
    }
    return targetDir;
  }

  @Data
  @NoArgsConstructor
  public static class DownloadResponse {
    private FileInfo gltf;
    private FileInfo usdz;
  }

  @Data
  @NoArgsConstructor
  public static class FileInfo {
    private String url;
    private long size;
    private int expires;
  }

  @Data
  @NoArgsConstructor
  public static class ModelInfo {
    private String uid;
    private String uri;
    private String name;
    private String description;
    private String license;
    private String author;
    private List<String> categories = new ArrayList<String>();

    public String mainCategory() {
      if (categories.size() == 0) {
        return "unsorted";
      }
      return categories.get(0);
    }
  }

  private ModelInfo modelInfo(String uid) throws JsonMappingException, JsonProcessingException {
    ModelInfo ret = new ModelInfo();

    RestTemplate restTemplate = new RestTemplate();
    String url = "https://api.sketchfab.com/v3/models/" + uid;
    String json = restTemplate.getForEntity(url, String.class).getBody();
    log.debug("Model info: " + json);

    Map info = objectMapper.readValue(json, Map.class);
    ret.setUid((String) info.get("uid"));
    ret.setName((String) info.get("name"));
    ret.setDescription((String) info.get("description"));
    ret.setLicense((String) ((Map) info.get("license")).get("slug"));
    ret.setAuthor((String) ((Map) info.get("user")).get("displayName"));
    @SuppressWarnings("unchecked")
    List<Map> categories = (List<Map>) info.get("categories");
    for (Map category : categories) {
      log.debug("Category: " + category.get("slug") + " " + category.get("name"));
      ret.getCategories().add((String) category.get("slug"));
    }

    return ret;
  }

}
