package org.vrspace.server.core;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class FileUtil {
  /**
   * Returns location of downloads directory: either Downloads under user home directory if exists, or system temporary
   * directory
   */
  public static File downloadDir() {
    File dir = new File(System.getProperty("user.home") + "/Downloads");
    if (!(dir.isDirectory() && dir.canWrite())) {
      dir = new File(System.getProperty("java.io.tmpdir"));
    }
    return dir;
  }

  /**
   * Returns absolute name of content directory. Public access.
   */
  public static String contentDir() {
    return ClassUtil.projectHomeDirectory() + "/content";
  }

  /**
   * Returns absolute name of worlds directory, content/worlds.
   */
  public static String worldDir() {
    return contentDir() + "/worlds";
  }

  /**
   * Returns absolute name of uploaded content directory, public access.
   */
  public static String uploadDir() {
    return contentDir() + "/tmp";
  }

  /**
   * Returns absolute name of attachment directory. Attachments must not be accessible over the web, but only through web API to
   * authorized users.
   */
  public static String attachmentDir() {
    return ClassUtil.projectHomeDirectory() + "/attachments";
  }

  /**
   * Unzip a file to a directory
   * 
   * @param file zip to unzip
   * @param dir  where to
   * @return newly created directory containing extracted files
   * @throws IOException if anything goes wrong
   */
  public static Path unzip(File file, File dir) throws IOException {
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
}
