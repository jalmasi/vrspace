package org.vrspace.server.core;

import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AssignableTypeFilter;

import lombok.extern.slf4j.Slf4j;

@Slf4j
public class ClassUtil {

  /**
   * Determines project home directory (parent of server/) from own class
   * location. If the server jar resides in some other directory, returns its
   * parent.
   */
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

  /**
   * Returns all subclasses/implementations of given class/interface.
   */
  public static List<Class<?>> findSubclasses(Class<?> superClass) {
    List<Class<?>> ret = new ArrayList<>();
    Package pkg = superClass.getPackage();

    ClassPathScanningCandidateComponentProvider provider = new ClassPathScanningCandidateComponentProvider(false);
    provider.addIncludeFilter(new AssignableTypeFilter(superClass));

    // scan in org.example.package
    Set<BeanDefinition> components = provider.findCandidateComponents(pkg.getName());
    for (BeanDefinition component : components) {
      try {
        Class<?> c = Class.forName(component.getBeanClassName());
        if (c != superClass && superClass.isAssignableFrom(c)) {
          ret.add(c);
        }
      } catch (ClassNotFoundException e) {
        log.error("Error scanning subclasses of " + superClass.getName(), e);
      }
      // use class cls found
    }
    return ret;
  }
}
