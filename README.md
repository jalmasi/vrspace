# VRSpace: Multiuser Virtual Reality Engine

# Quickstart

1) cd server

2) mvn clean install

3) `java -jar target/server-VERSION-executable.jar` (*)

4) open http://localhost:8080/babylon/multiuser-test.html with TWO browsers

Main entry point is http://localhost:8080/babylon/avatar-selection.html - choose your avatar and enter a world.
Use content/worlds/template as a template for your own multiuser worlds, it's all exposed at http://localhost:8080/content/

*) Java 17+ users instead use this:

    java --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.nio=ALL-UNNAMED --add-opens java.base/java.io=ALL-UNNAMED --add-opens java.base/java.util=ALL-UNNAMED --add-opens java.base/java.util.concurrent=ALL-UNNAMED --add-opens java.base/sun.net.www.protocol.http=ALL-UNNAMED --add-opens java.base/sun.nio.ch=ALL-UNNAMED -jar target/server-VERSION-executable.jar

# Live Demo

Fully featured live demo/test instance of current development version is available at http://www.vrspace.org/

# Community

Wiki, issue tracker, forums, and everything else: https://redmine.vrspace.org/projects/vrspace-org/wiki

Facebook page: https://www.facebook.com/vrspace.org

Youtube channel: https://www.youtube.com/channel/UCLdSg22i9MZ3u7ityj_PBxw

# Using VRSpace in your own applications

VRSpace client code is published as node.js package: https://www.npmjs.com/package/@vrspace/babylonjs
An example Vue single-page application: https://github.com/jalmasi/vrspace-webapp-vue

VRSpace server code is published as maven artifact to maven central: https://central.sonatype.com/artifact/org.vrspace/server
If you need to extend the server, see example spring boot application: https://github.com/jalmasi/vrspace-server-springboot

# Server binary

Instead of building the server, you can simply download released executable jar file: https://github.com/jalmasi/vrspace/releases/

# Docker image

Start here: https://hub.docker.com/r/gangrif/vrspace