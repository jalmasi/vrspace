
FROM debian:latest

#Install git, bash, java, maven
RUN apt update && apt install -y \
    git \
    bash-completion \
    default-jdk\
    maven

#Set working directory
WORKDIR /home/

#Clone VRSpace from github       
RUN git clone https://github.com/ammarzafar257/vrspace.git

#Expose ports 8080 and 8443
EXPOSE 8080
EXPOSE 8443