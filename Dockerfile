FROM node:14

# Bundle app source
WORKDIR /usr/src/app

COPY . .

# Declare entrypoints
EXPOSE 9000
ENTRYPOINT [ "node", "./build/server.js" ]