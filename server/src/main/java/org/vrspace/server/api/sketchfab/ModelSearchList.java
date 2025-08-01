package org.vrspace.server.api.sketchfab;

import lombok.Data;

/** One model returned in search response. */
@Data
public class ModelSearchList {
  String uid;
  Integer animationCount;
  String viewerUrl;
  String publishedAt;
  Integer likeCount;
  Integer commentCount;
  UserRelated user;
  Boolean isDownloadable;
  String name;
  Integer viewCount;
  ThumbnailsRelated thumbnails;
  String license;
  Boolean isPublished;
  String staffpickedAt;
  InlineArchives archives;
  String embedUrl;
}
