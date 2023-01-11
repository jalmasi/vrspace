# VRSpace: Multiuser Virtual Reality Engine

# Quickstart

1) cd server
2) mvn clean install
3) `java -jar target/server-0.4.8-SNAPSHOT.jar` (*)
4) open http://localhost:8080/babylon/multiuser-test.html with TWO browsers

Main entry point is http://localhost:8080/babylon/avatar-selection.html - choose your avatar and enter a world.
Use content/worlds/template as a template for your own multiuser worlds, it's all published at http://localhost:8080/content/

*) Java 17 users instead use this:

    java --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.nio=ALL-UNNAMED --add-opens java.base/java.io=ALL-UNNAMED --add-opens java.base/java.util=ALL-UNNAMED --add-opens java.base/java.util.concurrent=ALL-UNNAMED --add-opens java.base/sun.net.www.protocol.http=ALL-UNNAMED --add-opens java.base/sun.nio.ch=ALL-UNNAMED -jar target/server-0.4.8-SNAPSHOT.jar

# Live Demo

Fully featured live demo/test instance of current development version is available at http://www.vrspace.org/

# Community

Wiki, forums, and everything else: https://redmine.vrspace.org/projects/vrspace-org/wiki

Facebook page: https://www.facebook.com/vrspace.org

Youtube channel: https://www.youtube.com/channel/UCLdSg22i9MZ3u7ityj_PBxw

# Server binary

Instead of building the server, you can simply download built executable jar file.
Snapshots are available at https://s01.oss.sonatype.org/content/repositories/snapshots/org/vrspace/server/