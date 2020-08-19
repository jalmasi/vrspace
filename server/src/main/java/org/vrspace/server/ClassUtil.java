package org.vrspace.server;

import java.net.URL;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class ClassUtil {
  public static String serverDirectory() {
    String className = ClassUtil.class.getName().replace(".", "/") + ".class";
    URL classUrl = ClassUtil.class.getClassLoader().getResource(className);
    // log.debug("Location of " + className + ":" + classUrl);

    String path = classUrl.getPath();
    int pos = path.indexOf("server/target/classes");
    if (pos > 0) {
      return path.substring(0, pos);
    }
    log.warn("Could not find servere directory in " + classUrl);
    return null;
  }
}
