FROM ubuntu:latest

MAINTAINER Nico Janssens, nico.b.janssens@gmail.com
LABEL version="0.1"

# update and upgrade apt packages
RUN apt-get update
RUN apt-get -y upgrade

# install nodejs 4.x LTS
RUN apt-get -y install wget
RUN wget -qO- https://deb.nodesource.com/setup_4.x | bash -
RUN apt-get install -y nodejs

# create microminion user
RUN /usr/sbin/useradd --create-home --home-dir /home/microminion --shell /bin/false microminion

# create source directory
ENV registrar /home/microminion/1tp-registrar
WORKDIR ${registrar}

# copy all node code
ADD ./ $registrar

# install npm dependencies
RUN npm install

# activate debug output
ENV DEBUG *

# start server
ENTRYPOINT ["node", "index.js"]
