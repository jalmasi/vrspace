#!/bin/sh

JAVA=java
DIR=`dirname $0/`
JAR=`ls $DIR/../target/server-*-executable.jar`

echo "Java:"
echo $JAVA
echo "Jar:"
echo $JAR

$JAVA \
--add-opens java.base/java.lang=ALL-UNNAMED \
--add-opens java.base/java.nio=ALL-UNNAMED \
--add-opens java.base/java.io=ALL-UNNAMED \
--add-opens java.base/java.util=ALL-UNNAMED \
--add-opens java.base/java.util.concurrent=ALL-UNNAMED \
--add-opens java.base/sun.net.www.protocol.http=ALL-UNNAMED \
--add-opens java.base/sun.nio.ch=ALL-UNNAMED \
-Dslf4j.provider=ch.qos.logback.classic.spi.LogbackServiceProvider \
-jar $JAR
