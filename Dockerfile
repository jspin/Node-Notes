
FROM node:15-alpine

RUN adduser -D app_user

WORKDIR /home/app_user

COPY package* ./
RUN npm install

RUN mkdir data

COPY .env ./
COPY server.js ./
COPY public public

RUN chown -R app_user:app_user ./

USER app_user

EXPOSE 8080

ENTRYPOINT [ "npm", "start" ]

