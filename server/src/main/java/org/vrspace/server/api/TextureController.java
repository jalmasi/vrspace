package org.vrspace.server.api;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.vrspace.server.core.ClassUtil;

import lombok.extern.slf4j.Slf4j;

/**
 * Manages textures known to the server.
 * 
 * @author joe
 *
 */
@RestController
@Slf4j
@RequestMapping(TextureController.PATH)
public class TextureController extends ApiBase {
  public static final String PATH = API_ROOT + "/textures";
  private String contentDir = ClassUtil.projectHomeDirectory() + "/content";

  /**
   * List all jpg and png files in content directory hierarchy
   */
  @GetMapping("/list")
  public List<String> list() {
    try {
      URI contentUri = new URI("file:" + contentDir);
      log.debug("Listing " + contentUri);
      List<String> ret = Files.find(Paths.get(contentUri), 10, (path, attr) -> attr.isRegularFile())
          .map(path -> path.toUri().toString()).map(fileName -> fileName.substring(fileName.indexOf("/content")))
          .filter(fileName -> fileName.toLowerCase().endsWith(".jpg") || fileName.toLowerCase().endsWith(".png"))
          .collect(Collectors.toList());
      return ret;
    } catch (Exception e) {
      log.error("Error listing textures", e);
      throw new ApiException("Error listing textures: " + e);
    }
  }

  /**
   * Search textures that contain given substring
   */
  @GetMapping("/search")
  public List<String> search(String pattern) {
    try {
      log.debug("Searching textures for " + pattern);
      return list().stream().filter(f -> f.toLowerCase().indexOf(pattern) >= 0).collect(Collectors.toList());
    } catch (Exception e) {
      log.error("Error listing textures", e);
      throw new ApiException("Error listing textures: " + e);
    }
  }
}
