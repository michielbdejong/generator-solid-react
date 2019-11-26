FROM node
ADD . .
WORKDIR generators/app/templates/
RUN npm install
EXPOSE 3000
CMD npm start
