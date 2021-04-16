
This is a basic app to demonstrate using Node (Express) as a server and Vue as the UI.


A Dockerfile is provided if you prefer not running it locally.

Refer to .env for port, db-name, cookie attributes, etc

COOKIE_AGE is specified in hours which will be converted to milliseconds

It uses sqlite for data persistence and will create a new schema or use existing (with matching schema)

