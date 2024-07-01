package org.vrspace.server.api;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.vrspace.server.core.ClientFactory;
import org.vrspace.server.core.FileUtil;
import org.vrspace.server.core.WorldManager;
import org.vrspace.server.obj.Client;
import org.vrspace.server.obj.Content;
import org.vrspace.server.obj.VRFile;

import lombok.extern.slf4j.Slf4j;

@RestController
@Slf4j
@RequestMapping(UploadController.PATH)
public class UploadController extends ApiBase {
  public static final String PATH = API_ROOT + "/files";
  @Autowired
  WorldManager worldManager;

  @PutMapping("/upload")
  public void upload(HttpSession session, HttpServletRequest request, String fileName, String contentType,
      @RequestPart MultipartFile fileData) throws IOException {

    // get user info first (session etc)
    // TODO return error if this does not exist
    Long clientId = (Long) session.getAttribute(ClientFactory.CLIENT_ID_ATTRIBUTE);
    Client client = worldManager.getClient(clientId);

    if (client == null) {
      throw new SecurityException("The client is not connected");
    }

    String path = FileUtil.uploadDir();
    Long fileSize = fileData.getSize();
    File dest = new File(path + File.separator + fileName);
    log.debug("uploading " + contentType + " to " + dest + " " + fileSize);
    if ("model/gltf+json".equals(fileData.getContentType())) {
      // TODO: handle gltf upload
    }
    dest.mkdirs();
    try (InputStream inputStream = fileData.getInputStream()) {
      Files.copy(inputStream, dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
      // FileCopyUtils.copy(file.getInputStream(), new FileOutputStream(new
      // File("/storage/upload/", file.getOriginalFilename())));
    } catch (Exception e) {
      log.error("Upload error", e);
    }

    // create Content
    Content content = new Content();
    content.setFileName(fileName);
    content.setFolder(path);
    content.setContentType(contentType);
    content.setLength(fileSize);
    // create VRObject, set URL
    // drop VRObject at position
    // set owner
    VRFile obj = new VRFile();
    obj.setContent(content);
    worldManager.add(client, obj);
  }
}
