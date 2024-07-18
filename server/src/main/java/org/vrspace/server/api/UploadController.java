package org.vrspace.server.api;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Map;

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
import org.vrspace.server.obj.Point;
import org.vrspace.server.obj.Rotation;
import org.vrspace.server.obj.VRFile;
import org.vrspace.server.obj.VRObject;

import lombok.extern.slf4j.Slf4j;

@RestController
@Slf4j
@RequestMapping(UploadController.PATH)
public class UploadController extends ApiBase {
  public static final String PATH = API_ROOT + "/files";
  @Autowired
  WorldManager worldManager;

  private Client findClient(HttpSession session) {
    Long clientId = (Long) session.getAttribute(ClientFactory.CLIENT_ID_ATTRIBUTE);
    Client client = worldManager.getClient(clientId);

    if (client == null) {
      throw new SecurityException("The client is not connected");
    }

    return client;
  }

  @PutMapping("/upload")
  public void upload(HttpSession session, HttpServletRequest request, String fileName, String contentType, Double x,
      Double y, Double z, Double rotX, Double rotY, Double rotZ, Double angle, @RequestPart MultipartFile fileData)
      throws IOException {

    // get user info first (session etc)
    Client client = findClient(session);

    String path = FileUtil.uploadDir();
    Long fileSize = fileData.getSize();
    File dest = new File(path + File.separator + fileName);
    dest.mkdirs();

    log.debug("uploading " + contentType + "/" + fileData.getContentType() + " to " + dest + " size " + fileSize
        + " pos " + x + "," + y + "," + z + " rot " + rotX + "," + rotY + "," + rotZ + "," + angle);

    try (InputStream inputStream = fileData.getInputStream()) {
      Files.copy(inputStream, dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
    } catch (Exception e) {
      log.error("Upload error", e);
    }

    VRObject obj = null;
    Content content = null;

    if ("model/gltf+json".equals(contentType)) {
      // TODO: handle gltf upload
      // they are going to come in zip format anyway
    } else if ("model/gltf-binary".equals(contentType)) {
      obj = new VRObject();
      obj.setMesh("/content/tmp/" + fileName);
      obj.setActive(false);
    } else {
      content = new Content();
      content.setFileName(fileName);
      content.setFolder(path);
      content.setContentType(contentType);
      content.setLength(fileSize);

      obj = new VRFile();
      ((VRFile) obj).setContent(content);
      obj.setActive(true);
    }

    Point pos = null;
    Rotation rot = null;
    if (x != null & y != null & z != null) {
      pos = new Point(x, y, z);
    }
    if (rotX != null & rotY != null & rotZ != null && angle != null) {
      rot = new Rotation(rotX, rotY, rotZ, angle);
    } else if (rotX != null & rotY != null & rotZ != null) {
      rot = new Rotation(rotX, rotY, rotZ);
    }

    obj.setPosition(pos);
    obj.setRotation(rot);
    obj.setProperties(Map.of("clientId", client.getId()));

    worldManager.add(client, obj);
    client.getScene().publish(obj); // so that it gets displayed right away

  }

}
