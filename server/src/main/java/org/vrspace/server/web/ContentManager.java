package org.vrspace.server.web;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

import javax.servlet.http.HttpServletRequest;

import org.apache.commons.compress.utils.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.vrspace.server.dto.FileList;
import org.vrspace.server.obj.Content;

import lombok.extern.slf4j.Slf4j;

/**
 * Simple content manager, allows for browsing and uploading of files under
 * org.vrspace.adminUI.contentRoot. Optionally activated when
 * org.vrspace.adminUI.enabled=true.
 * 
 * @author joe
 *
 */
@RestController
@Slf4j
@ConditionalOnProperty("org.vrspace.adminUI.enabled")
public class ContentManager {
  @Value("${org.vrspace.adminUI.contentRoot}")
  private String root;
  @Value("${org.vrspace.adminUI.path}")
  private String uiPath;

  private String getPath(String path) {
    String fullPath = uiPath + "/pub/";
    if (path.length() < fullPath.length()) {
      path = null;
    } else {
      path = path.substring(fullPath.length() - 1);
    }
    if (StringUtils.isEmpty(path)) {
      path = root;
    } else {
      path = root + path;
    }
    return path;
  }

  @PostMapping("/pub/**")
  public FileList list(@RequestParam(value = "uploadFiles", required = false) MultipartFile[] uploadFiles,
      HttpServletRequest request) throws IOException {
    FileList ret = new FileList();
    String path = getPath(request.getRequestURI());
    ret.setPath(path);
    File dir = new File(path);
    log.debug("list " + path + " -> " + dir.getCanonicalPath());
    List<Content> dirs = new ArrayList<Content>();
    List<Content> files = new ArrayList<Content>();
    if (dir.isDirectory()) {
      for (File file : dir.listFiles()) {
        if (file.isDirectory()) {
          dirs.add(new Content(file.getName(), "dir", file.length()));
        } else {
          String mimeType = Files.probeContentType(file.toPath());
          if (mimeType == null) {
            mimeType = "application/octet-stream";
          }
          files.add(new Content(file.getName(), mimeType, file.length()));
        }
      }
    }
    ret.getContentList().addAll(dirs);
    ret.getContentList().addAll(files);
    return ret;
  }

  @GetMapping("/pub/**")
  public ResponseEntity<byte[]> get(HttpServletRequest request) throws IOException {
    FileList ret = new FileList();
    String path = getPath(request.getRequestURI());
    ret.setPath(path);
    File file = new File(path);
    log.debug("get " + path + " -> " + file.getCanonicalPath());
    if (file.exists()) {
      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
      headers.setContentDispositionFormData(file.getName(), file.getName());
      // headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");
      byte[] contents = IOUtils.toByteArray(new FileInputStream(file));
      ResponseEntity<byte[]> response = new ResponseEntity<>(contents, headers, HttpStatus.OK);
      return response;
    } else {
      // TODO error
    }
    return null;
  }

  @PutMapping("/pub/**")
  public void upload(HttpServletRequest request, String fileName, int fileSize, MultipartFile fileData)
      throws IOException {
    String path = getPath(request.getRequestURI());
    log.debug("uploading to " + path + ": " + fileName + " " + fileSize + " " + fileData.getSize());
  }
}
