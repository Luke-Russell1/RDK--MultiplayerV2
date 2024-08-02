FROM ubuntu:22.04
RUN apt-get update && apt-get install -y nodejs npm

WORKDIR /tmp
COPY  newcastleRDK newcastleRDK
COPY package*.json ./
RUN npm install

EXPOSE 3000
ENTRYPOINT ["/usr/bin/bash", "-c"]
CMD ["npx ts-node server.ts"]