# 1. Base image
FROM node:18

# 2. Working directory
WORKDIR /app

# 3. Package files copy
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Full code copy
COPY . .

# 6. Port expose
EXPOSE 5000

# 7. Run server
CMD ["node", "server.js"]