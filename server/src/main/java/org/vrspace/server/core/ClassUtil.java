package org.vrspace.server.core;

import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.nio.file.Paths;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class ClassUtil {
  public static String projectHomeDirectory() {
    String ret = null;
    String className = ClassUtil.class.getName().replace(".", "/") + ".class";
    URL classUrl = ClassUtil.class.getClassLoader().getResource(className);

    String path = classUrl.getPath();
    // starts with "file:" when running jar, can also be guessed from the URL scheme
    int start = path.indexOf("file:");
    if (start < 0) {
      start = 0;
    } else {
      start += "file:".length();
    }
    int end = path.lastIndexOf("/server/target");
    if (end > 0) {
      // running from IDE
      ret = path.substring(start, end);
    } else {
      // running from jar
      end = path.lastIndexOf("/server-");
      if (end > 0) {
        ret = path.substring(start, end);
        // now path points to directory, need to find parent dir
        File serverDir = new File(ret);
        try {
          ret = serverDir.getParentFile().getCanonicalPath();
        } catch (IOException e) {
          log.error("Can't deduce parent dir of " + path + " - using current dir", e);
          ret = Paths.get(".").toAbsolutePath().normalize().toString();
        }
      }
    }
    log.debug("VRSpace home directory: " + ret + " deduced from location of " + className + ": " + classUrl);
    return ret;
  }
}
