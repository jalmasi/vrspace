package org.vrspace.server.connect.sketchfab;

import java.util.List;

import lombok.Data;

/** One model returned in search response. */
@Data
public class ModelSearchList {
  String uri;
  String uid;
  String name;
  String staffpickedAt;
  Integer viewCount;
  Integer likeCount;
  Integer animationCount;
  String viewerUrl;
  String embedUrl;
  Integer commentCount;
  Boolean isDownloadable;
  String publishedAt;
  List<ModelTag> tags;
  List<ModelCategory> categories;
  ThumbnailsRelated thumbnails;
  UserRelated user;
  String description;
  Integer faceCount;
  String createdAt;
  Integer vertexCount;
  Boolean isAgeRestricted;
  InlineArchives archives;
  ModelLicense license;
  // does not seem to exist:
  Boolean isPublished;
  /** Not part of the sketchfab API, we set it if the query requested rigged model */
  Boolean rigged;
}
