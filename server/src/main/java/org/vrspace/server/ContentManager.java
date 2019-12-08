package org.vrspace.server;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

import javax.servlet.http.HttpServletRequest;

import org.apache.commons.compress.utils.IOUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
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

@RestController
public class ContentManager {
  static final Log LOG = LogFactory.getLog(ContentManager.class);

  public static final String root = ".";

  private String getPath(String path) {
    if (path.length() < "/pub/".length()) {
      path = null;
    } else {
      path = path.substring(4);
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
    LOG.debug("list " + path);
    File dir = new File(path);
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
    LOG.debug("get " + path);
    File file = new File(path);
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
    LOG.debug("uploading to " + path + ": " + fileName + " " + fileSize + " " + fileData.getSize());
  }
}
