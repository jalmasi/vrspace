package org.vrspace.server.core;

import java.net.URL;

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
    int end = path.indexOf("server/");
    if (end > 0) {
      ret = path.substring(start, end);
    }
    log.debug("VRSpace home directory: " + ret + " deduced from location of " + className + ": " + classUrl);
    return ret;
  }
}
